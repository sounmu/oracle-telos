import { z } from "zod";
import { embedTexts } from "@/lib/embeddings";
import { getPatentIndex, MISSING_DATA_MESSAGE } from "@/lib/patents";
import { mockEnabled } from "@/lib/mockApi";
import { topK } from "@/lib/similarity";
import type { Neighbor } from "@/lib/phaseFeatures";

const locateInput = z.object({
  idea: z.string().trim().min(5).max(4000),
  k: z.number().int().min(1).max(20).default(8),
  dataset: z.enum(["korea", "sample"]).default("sample"),
});

/**
 * POST { idea, k?, dataset? } → { neighbors: Neighbor[] }
 * 아이디어를 같은 임베딩 공간에 넣어 가까운 특허 k건을 돌려준다. 위치 계산은 브라우저가 한다.
 * 한국 데이터의 위치 계산은 아직 지원하지 않는다.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON body가 필요합니다." }, { status: 400 });
  }
  const parsed = locateInput.safeParse(body);
  if (!parsed.success) return Response.json({ error: "아이디어는 5~4,000자로 입력하세요." }, { status: 400 });
  const { idea, k } = parsed.data;
  // 목업 모드에서는 한국 지도도 샘플 점으로 그리므로, 위치도 샘플 기준으로 계산한다
  const dataset = mockEnabled() ? "sample" : parsed.data.dataset;
  if (dataset !== "sample") {
    return Response.json({ error: "위치 계산은 아직 샘플 데이터에서만 지원합니다." }, { status: 501 });
  }
  try {
    const index = await getPatentIndex();
    if (!index) return Response.json({ error: MISSING_DATA_MESSAGE }, { status: 503 });
    const toNeighbor = (i: number, score: number): Neighbor => ({
      id: index.patents[i].id,
      title: index.patents[i].title,
      x: index.patents[i].x,
      y: index.patents[i].y,
      score,
    });
    if (mockEnabled()) {
      const neighbors = index.patents.slice(0, k).map((_, i) => toNeighbor(i, 0.9 - i * 0.05));
      return Response.json({ neighbors, warnings: ["목업 모드: 실제 임베딩 없이 샘플 앞쪽 특허로 위치를 흉내 냅니다."] });
    }
    const [vec] = await embedTexts([idea]);
    const scored = topK(vec, index.vectors, index.meta.dim, k);
    return Response.json({ neighbors: scored.map((s) => toNeighbor(s.index, s.score)), warnings: [] });
  } catch {
    return Response.json({ error: "위치를 계산하지 못했습니다. 서버 상태를 확인하세요." }, { status: 500 });
  }
}
