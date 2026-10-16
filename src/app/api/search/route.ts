import { embedTexts } from "@/lib/embeddings";
import { getPatentIndex, MISSING_DATA_MESSAGE, toHit } from "@/lib/patents";
import { topK } from "@/lib/similarity";
import { z } from "zod";
import { searchKoreanPatents } from "@/lib/korea/search";
import { SourceError } from "@/lib/korea/http";

const searchInput = z.object({
  query: z.string().trim().min(1).max(4000),
  k: z.number().int().min(1).max(50).default(10),
  dataset: z.enum(["korea", "sample"]).default("sample"),
  decision: z.enum(["ACCEPTED", "REJECTED", "PENDING", "UNKNOWN"]).optional(),
});

/**
 * POST { query, k?, dataset?, decision? } → { hits: SearchHit[] }
 * dataset=korea면 KIPRIS 실시간 조회 결과를 캐시하고 { hits, addedPoints, warnings }를 돌려준다.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON body가 필요합니다." }, { status: 400 });
  }
  const parsed = searchInput.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "검색어와 검색 조건을 확인하세요." }, { status: 400 });
  }
  const { query, k, decision, dataset } = parsed.data;
  try {
    if (dataset === "korea") {
      try {
        return Response.json(await searchKoreanPatents(query, k, decision, { signal: request.signal }));
      } catch (error) {
        // 키·색인이 모두 없거나 재색인이 필요한 상태: 서버 오류가 아니라 설정이 필요하다.
        if (error instanceof SourceError) return Response.json({ error: error.message }, { status: 503 });
        throw error;
      }
    }
    const index = await getPatentIndex();
    if (!index) return Response.json({ error: MISSING_DATA_MESSAGE }, { status: 503 });
    const [vec] = await embedTexts([query]);
    const scored = topK(vec, index.vectors, index.meta.dim, k, (i) =>
      decision ? index.patents[i].decision === decision : true,
    );
    return Response.json({ hits: scored.map((s) => toHit(index.patents[s.index], s.score)) });
  } catch (error) {
    return Response.json({
      error: error instanceof SourceError ? error.message : "검색을 처리하지 못했습니다. 서버 상태를 확인하세요.",
    }, { status: 500 });
  }
}
