import { mockEnabled } from "@/lib/mockApi";
import { getPatentIndex } from "@/lib/patents";
import { readResearchIndex, researchStatus } from "@/lib/korea/index";
import type { PatentMapResponse } from "@/lib/types";

export async function GET(request: Request) {
  const dataset = new URL(request.url).searchParams.get("dataset");
  if (dataset !== "korea" && dataset !== "sample") {
    return Response.json({ error: "dataset은 korea 또는 sample이어야 합니다." }, { status: 400 });
  }
  try {
    const status = await researchStatus();
    const aiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim()) || mockEnabled();
    // 목업 모드에서는 한국 색인이 없어도 샘플 점으로 지도를 채워 UI를 확인할 수 있게 한다
    if (dataset === "korea" && !mockEnabled() && process.env.TELOS_DEMO !== "1") {
      const index = await readResearchIndex();
      return Response.json({
        dataset,
        points: index?.points ?? [],
        builtAt: index?.builtAt ?? null,
        status,
        aiConfigured,
      } satisfies PatentMapResponse);
    }
    const index = await getPatentIndex();
    return Response.json({
      dataset,
      points: index?.patents.map(({ id, title, decision, cpc, filed, x, y, abstract, source, cites }) => ({
        id, title, decision, cpc, filed, x, y, source, cites, abstract: abstract.slice(0, 300),
      })) ?? [],
      builtAt: index?.meta.builtAt ?? null,
      status,
      aiConfigured,
    } satisfies PatentMapResponse);
  } catch {
    return Response.json({ error: "특허 색인을 읽지 못했습니다. 서버의 데이터 파일을 확인하세요." }, { status: 500 });
  }
}
