import { z } from "zod";
import { researchStatus, searchResearch } from "@/lib/korea/index";
import { SourceError } from "@/lib/korea/http";

const input = z.object({
  query: z.string().trim().min(1).max(4000),
  sources: z.array(z.enum(["law", "dart"])).min(1).max(2).default(["law", "dart"]),
  k: z.number().int().min(1).max(20).default(6),
  asOf: z.iso.date().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON body가 필요합니다." }, { status: 400 });
  }
  const parsed = input.safeParse(body);
  if (!parsed.success) return Response.json({ error: "검색 조건과 기준일을 확인하세요." }, { status: 400 });
  try {
    const { query, sources, k, asOf } = parsed.data;
    // 출처별 후보를 확보해 한 출처가 다른 출처의 결과를 밀어내지 않게 한다.
    const groups = await Promise.all(sources.map((source) => searchResearch(query, [source], k, asOf)));
    return Response.json({ hits: groups.flat(), status: await researchStatus() });
  } catch (error) {
    return Response.json({
      error: error instanceof SourceError ? error.message : "참고 자료를 검색하지 못했습니다.",
    }, { status: 500 });
  }
}
