import { mockComparison, mockEnabled } from "@/lib/mockApi";
import OpenAI from "openai";
import { z } from "zod";
import { comparePatent } from "@/lib/agent";
import { readResearchIndex } from "@/lib/korea/index";

const compareInput = z.object({
  idea: z.string().trim().min(5).max(4000),
  id: z.string().regex(/^kipris:\d{10,13}$/),
});

/** POST { idea, id } → PatentComparison (기술 요소별 비교표 + 기술 근접도) */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON body가 필요합니다." }, { status: 400 });
  }
  // 목업 모드에서는 샘플 특허 번호도 받아서 비교 카드 모양을 확인할 수 있게 한다
  if (mockEnabled()) {
    const id = typeof (body as { id?: unknown })?.id === "string" ? (body as { id: string }).id : "mock";
    return Response.json(mockComparison(id));
  }
  const parsed = compareInput.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "기술 설명(5~4,000자)과 한국 특허 ID를 확인하세요." }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return Response.json({ error: "기술 요소별 비교에는 OPENAI_API_KEY가 필요합니다. .env에 넣고 개발 서버를 재시작하세요." }, { status: 503 });
  }
  const index = await readResearchIndex();
  const document = index?.documents.find((candidate) => candidate.id === parsed.data.id);
  if (!document || document.source !== "kipris") {
    return Response.json({ error: "비교할 한국 특허를 색인에서 찾을 수 없습니다. 먼저 검색하세요." }, { status: 404 });
  }
  try {
    return Response.json(await comparePatent(parsed.data.idea, document));
  } catch (error) {
    if (error instanceof OpenAI.AuthenticationError) {
      return Response.json({ error: "OpenAI API 키가 잘못되었습니다. .env의 OPENAI_API_KEY를 확인하세요." }, { status: 502 });
    }
    if (error instanceof OpenAI.RateLimitError) {
      return Response.json({ error: "OpenAI 호출 한도에 걸렸습니다. 잠시 뒤 다시 시도하세요." }, { status: 429 });
    }
    return Response.json({
      error: `비교를 만들지 못했습니다. 다시 시도하세요. (${error instanceof Error ? error.message : "알 수 없는 오류"})`,
    }, { status: 502 });
  }
}
