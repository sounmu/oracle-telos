import { embedTexts } from "@/lib/embeddings";
import { getPatentIndex, MISSING_DATA_MESSAGE, toHit } from "@/lib/patents";
import { topK } from "@/lib/similarity";
import { z } from "zod";
import { patentFromDocument, readResearchIndex, searchResearch } from "@/lib/korea/index";
import { SourceError } from "@/lib/korea/http";

const searchInput = z.object({
  query: z.string().trim().min(1).max(4000),
  k: z.number().int().min(1).max(50).default(10),
  dataset: z.enum(["korea", "sample"]).default("sample"),
  decision: z.enum(["ACCEPTED", "REJECTED", "PENDING", "UNKNOWN"]).optional(),
});

/** POST { query: string, k?: number, decision?: Decision } → { hits: SearchHit[] } */
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
      const index = await readResearchIndex();
      if (!index?.points.length) {
        return Response.json({ error: "한국 특허 색인이 없습니다. KIPRIS_API_KEY를 설정하고 pnpm sync:korea --source kipris --query \"반려동물\"을 실행하세요." }, { status: 503 });
      }
      const results = await searchResearch(query, ["kipris"], k, undefined, decision);
      return Response.json({
        hits: results.flatMap((hit) => {
          const document = index.documents.find((document) => document.id === hit.id);
          if (!document || document.source !== "kipris") return [];
          return [toHit(patentFromDocument(document, index), hit.score)];
        }),
      });
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
