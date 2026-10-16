import OpenAI from "openai";
import { runPatentAgent } from "@/lib/agent";
import type { AgentEvent } from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  let idea: string;
  try {
    const body = (await request.json()) as { idea?: unknown };
    idea = typeof body.idea === "string" ? body.idea.trim() : "";
  } catch {
    return Response.json({ error: "JSON body가 필요합니다." }, { status: 400 });
  }
  if (idea.length < 5) {
    return Response.json({ error: "아이디어를 조금 더 자세히 적어 주세요." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (event: AgentEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await runPatentAgent({ idea, emit, signal: request.signal });
      } catch (err) {
        emit({ type: "error", message: describeError(err) });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function describeError(err: unknown): string {
  if (err instanceof OpenAI.AuthenticationError) {
    return "OpenAI API 키가 잘못되었습니다. .env의 OPENAI_API_KEY를 확인하세요.";
  }
  if (err instanceof OpenAI.NotFoundError) {
    return `모델을 찾을 수 없습니다. .env의 OPENAI_MODEL을 확인하세요. (${err.message})`;
  }
  if (err instanceof OpenAI.RateLimitError) {
    return "OpenAI API 요청 한도에 걸렸습니다. 잠시 후 다시 시도하세요.";
  }
  if (err instanceof OpenAI.APIError) {
    return `OpenAI API 오류 (${err.status}): ${err.message}`;
  }
  if (err instanceof Error) {
    if (err.name === "AbortError") return "요청이 취소되었습니다.";
    return err.message;
  }
  return "알 수 없는 오류";
}
