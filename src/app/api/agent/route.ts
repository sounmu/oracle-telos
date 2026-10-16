import { mockAgentEvents, mockEnabled } from "@/lib/mockApi";
import OpenAI from "openai";
import { runPatentAgent } from "@/lib/agent";
import type { AgentEvent } from "@/lib/types";
import { z } from "zod";

const agentInput = z.object({
  idea: z.string().trim().min(5).max(4000),
  dataset: z.enum(["korea", "sample"]).default("sample"),
  includeContext: z.boolean().default(false),
  asOf: z.iso.date().optional(),
});

export const maxDuration = 300;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON body가 필요합니다." }, { status: 400 });
  }
  const parsed = agentInput.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "아이디어와 검색 조건을 확인해 주세요. 아이디어는 5~4,000자로 입력하세요." }, { status: 400 });
  }

  if (mockEnabled()) return mockAgentResponse();

  const encoder = new TextEncoder();
  const cancellation = new AbortController();
  const signal = AbortSignal.any([request.signal, cancellation.signal]);
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentEvent) => {
        if (closed || signal.aborted) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await runPatentAgent({ ...parsed.data, emit, signal });
      } catch (err) {
        emit({ type: "error", message: describeError(err) });
      } finally {
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
      cancellation.abort();
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

/** 목업 모드: 실제 에이전트 대신 고정 이벤트를 짧은 간격으로 흘려보낸다 */
async function mockAgentResponse(): Promise<Response> {
  const events = await mockAgentEvents();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
