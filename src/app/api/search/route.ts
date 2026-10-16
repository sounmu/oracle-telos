import { embedTexts } from "@/lib/embeddings";
import { getPatentIndex, MISSING_DATA_MESSAGE, toHit } from "@/lib/patents";
import { topK } from "@/lib/similarity";
import { DECISIONS, type Decision } from "@/lib/types";

/** POST { query: string, k?: number, decision?: Decision } → { hits: SearchHit[] } */
export async function POST(request: Request) {
  let body: { query?: unknown; k?: unknown; decision?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON body가 필요합니다." }, { status: 400 });
  }
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) return Response.json({ error: "query가 필요합니다." }, { status: 400 });
  const k = Math.min(50, Math.max(1, Number(body.k ?? 10) || 10));
  const decision = DECISIONS.includes(body.decision as Decision)
    ? (body.decision as Decision)
    : undefined;

  const index = await getPatentIndex();
  if (!index) return Response.json({ error: MISSING_DATA_MESSAGE }, { status: 503 });

  const [vec] = await embedTexts([query]);
  const scored = topK(vec, index.vectors, index.meta.dim, k, (i) =>
    decision ? index.patents[i].decision === decision : true,
  );
  return Response.json({
    hits: scored.map((s) => toHit(index.patents[s.index], s.score)),
  });
}
