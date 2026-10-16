"use client";

import { DEMO_AGENT_TEXT, demoCompare, demoPatent, demoPatents, demoSearch } from "@/lib/demo";
import type { AgentEvent } from "@/lib/types";

// 시연 모드: 주소에 ?demo=1 이 있을 때만 한국 데이터셋 API 응답을 예시 데이터로 바꾼다.
// 기존 화면 코드의 요청 로직은 그대로 두고 fetch만 가로챈다. 미국 샘플(dataset=sample)은 실제 서버로 보낸다.

const json = (body: unknown, delay: number) =>
  new Promise<Response>((resolve) =>
    setTimeout(() => resolve(new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } })), delay),
  );

function sse(events: AgentEvent[], gap: number): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const event of events) {
        await new Promise((r) => setTimeout(r, gap));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
}

async function readBody(init?: RequestInit): Promise<Record<string, unknown>> {
  if (typeof init?.body !== "string") return {};
  try {
    return JSON.parse(init.body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

let installed = false;

function install() {
  if (installed || typeof window === "undefined") return;
  if (!new URLSearchParams(window.location.search).has("demo")) return;
  installed = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
    const path = url.pathname;
    if (path === "/api/patents" && url.searchParams.get("dataset") === "korea") return json(demoPatents(), 150);
    if (path === "/api/search") {
      const body = await readBody(init);
      if (body.dataset === "korea") return json(demoSearch(), 900);
    }
    if (path === "/api/compare") {
      const body = await readBody(init);
      return json(demoCompare(String(body.id ?? "")), 700 + Math.random() * 900);
    }
    if (path.startsWith("/api/patent/")) {
      const id = decodeURIComponent(path.slice("/api/patent/".length));
      if (id.startsWith("kipris:")) return json(demoPatent(id), 250);
    }
    if (path === "/api/agent") {
      const body = await readBody(init);
      if (body.dataset === "korea") {
        const search = demoSearch();
        const pieces = DEMO_AGENT_TEXT.match(/[\s\S]{1,12}/g) ?? [];
        return sse(
          [
            { type: "status", message: "특허를 찾고 있어요" },
            { type: "tool", name: "search_patents", input: { query: "생분해성 미립구 서방형" } },
            { type: "points_added", points: search.addedPoints ?? [] },
            { type: "matches", query: "생분해성 미립구 서방형", hits: search.hits },
            ...pieces.map((delta): AgentEvent => ({ type: "text", delta })),
            { type: "done" },
          ],
          40,
        );
      }
    }
    return realFetch(input, init);
  };
}

// 화면 컴포넌트의 첫 요청보다 먼저 설치되도록 모듈을 불러올 때 바로 설치한다.
install();

export default function DemoFetch() {
  return null;
}
