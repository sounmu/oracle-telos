// 서버 전용. Claude 에이전트: 아이디어 → 특허 검색 도구 호출 → 비교 분석 (스트리밍)
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { embedTexts } from "./embeddings";
import { getPatentIndex, MISSING_DATA_MESSAGE, toHit, truncate } from "./patents";
import { topK } from "./similarity";
import type { AgentEvent, SearchHit } from "./types";

export const AGENT_MODEL = "claude-opus-5-5";

const SYSTEM_PROMPT = `당신은 "Telos"의 특허 분석 에이전트입니다. 창업 지망생이 구상 중인 아이디어를 설명하면, 기존 특허 데이터베이스(USPTO 2016년 1월 출원 샘플, 영어)에서 유사 특허를 찾아 비교하고 아이템의 방향성을 잡도록 돕습니다.

데이터베이스의 각 특허에는 심사 결과가 있습니다:
- ACCEPTED: 등록(통과)된 특허
- REJECTED: 거절된 출원 — 비슷한 시도가 왜 막혔는지 힌트가 됩니다
- PENDING: 심사 중

작업 절차:
1. 사용자의 아이디어를 핵심 기술 요소로 분해합니다.
2. search_patents 도구를 **영어 질의**로 2~3회 호출합니다 (서로 다른 관점: 핵심 기능, 적용 분야, 기술 구성). 특허 원문이 영어이므로 영어 질의가 정확합니다.
3. 가장 유사한 2~3건은 get_patent 로 첫 청구항을 확인합니다. 청구항은 특허의 실제 권리 범위입니다.
4. 분석을 작성합니다.

출력 형식 (마크다운, 사용자가 쓴 언어로. 특허 제목은 영어 원문 유지):
## 한 줄 요약
## 유사 특허
각 특허마다: **제목** (출원번호, 결정) — 유사점 / 차이점 한두 문장씩. 유사도가 높은 순.
## 거절 사례에서 얻는 시사점
거절된 유사 특허가 있으면 어떤 점이 선행기술과 겹쳤을지 추정. 없으면 생략.
## 방향 제안
사용자의 아이디어가 기존 특허와 차별화될 수 있는 구체적 포인트 2~3개.

주의: 이 분석은 참고용이며 법률 자문이 아님을 마지막에 한 줄로 밝히세요. 데이터베이스가 샘플이라 실제 선행기술은 더 많을 수 있다는 점도 함께.
근거 없는 특허를 지어내지 마세요. 도구가 돌려준 특허만 언급합니다.`;

export interface AgentRunOptions {
  idea: string;
  emit: (event: AgentEvent) => void;
  signal?: AbortSignal;
}

export async function runPatentAgent({ idea, emit, signal }: AgentRunOptions): Promise<void> {
  const index = await getPatentIndex();
  if (!index) {
    emit({ type: "error", message: MISSING_DATA_MESSAGE });
    return;
  }

  // 자격 증명은 환경(ANTHROPIC_API_KEY 등)에서 읽는다. 없으면 첫 요청 시 일반 Error가 던져지고
  // route handler의 describeError가 한국어 안내로 바꾼다.
  const client = new Anthropic();

  const searchPatents = betaZodTool({
    name: "search_patents",
    description:
      "Semantic search over the patent database. Returns the most similar patents to the query with their examination decision (ACCEPTED / REJECTED / PENDING). Query in English for best results.",
    inputSchema: z.object({
      query: z
        .string()
        .min(3)
        .describe("A short English description of the technology to search for"),
      k: z.number().int().min(1).max(15).default(8).describe("How many results to return"),
      decision: z
        .enum(["ACCEPTED", "REJECTED", "PENDING"])
        .optional()
        .describe("Optionally restrict to one examination decision"),
    }),
    run: async ({ query, k, decision }) => {
      emit({ type: "tool", name: "search_patents", input: { query, k, decision } });
      const [vec] = await embedTexts([query]);
      const scored = topK(vec, index.vectors, index.meta.dim, k, (i) =>
        decision ? index.patents[i].decision === decision : true,
      );
      const hits: SearchHit[] = scored.map((s) => toHit(index.patents[s.index], s.score));
      emit({ type: "matches", query, hits });
      return JSON.stringify(
        hits.map((h) => ({
          id: h.id,
          title: h.title,
          decision: h.decision,
          similarity: Number(h.score.toFixed(3)),
          cpc: h.cpc,
          filed: h.filed,
          abstract: h.abstract,
        })),
      );
    },
  });

  const getPatent = betaZodTool({
    name: "get_patent",
    description:
      "Fetch the full abstract, CPC labels and the first independent claim of one patent by its application number (id from search_patents).",
    inputSchema: z.object({
      id: z.string().describe("Application number returned by search_patents"),
    }),
    run: async ({ id }) => {
      emit({ type: "tool", name: "get_patent", input: { id } });
      const p = index.byId.get(id);
      if (!p) return JSON.stringify({ error: `No patent with id ${id}` });
      return JSON.stringify({
        id: p.id,
        title: p.title,
        decision: p.decision,
        filed: p.filed,
        cpcLabels: p.cpcLabels,
        abstract: truncate(p.abstract, 1500),
        firstClaim: truncate(p.firstClaim, 1500),
      });
    },
  });

  const runner = client.beta.messages.toolRunner(
    {
      model: AGENT_MODEL,
      max_tokens: 16000,
      stream: true,
      max_iterations: 10,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [searchPatents, getPatent],
      messages: [{ role: "user", content: idea }],
    },
    { signal },
  );

  emit({ type: "status", message: "아이디어를 분석하고 있어요…" });

  for await (const stream of runner) {
    let emittedText = false;
    stream.on("text", (delta) => {
      emittedText = true;
      emit({ type: "text", delta });
    });
    const message = await stream.finalMessage();
    if (emittedText && message.stop_reason === "tool_use") {
      emit({ type: "text", delta: "\n\n" });
    }
    if (message.stop_reason === "refusal") {
      emit({
        type: "error",
        message: "이 요청은 모델이 처리하지 않았습니다. 아이디어를 다르게 표현해 보세요.",
      });
      return;
    }
    if (message.stop_reason === "max_tokens") {
      emit({ type: "error", message: "응답이 길이 제한에 걸렸습니다. 다시 시도해 주세요." });
      return;
    }
  }

  emit({ type: "done" });
}
