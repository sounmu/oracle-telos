// 서버 전용. GPT 에이전트: 아이디어 → 특허 검색 도구 호출 → 비교 분석 (스트리밍)
// OpenAI Responses API + function calling. 루프는 직접 돌린다 (previous_response_id로 이어감).
import OpenAI from "openai";
import { z } from "zod";
import { embedTexts } from "./embeddings";
import { getPatentIndex, MISSING_DATA_MESSAGE, toHit, truncate } from "./patents";
import { topK } from "./similarity";
import type { AgentEvent, SearchHit } from "./types";

export const AGENT_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.5";
const REASONING_EFFORT = (process.env.OPENAI_REASONING_EFFORT ??
  "low") as NonNullable<OpenAI.Reasoning["effort"]>;
const MAX_ITERATIONS = 10;

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

// strict 모드: 모든 키가 required여야 하므로 선택 값은 nullable로 둔다.
const SearchInput = z.object({
  query: z.string().min(3),
  k: z.number().int().min(1).max(15),
  decision: z.enum(["ACCEPTED", "REJECTED", "PENDING"]).nullable(),
});
const GetPatentInput = z.object({ id: z.string() });

const TOOLS: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    name: "search_patents",
    description:
      "Semantic search over the patent database. Returns the most similar patents to the query with their examination decision (ACCEPTED / REJECTED / PENDING). Query in English for best results.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A short English description of the technology to search for",
        },
        k: { type: "integer", description: "How many results to return (1-15, usually 8)" },
        decision: {
          type: ["string", "null"],
          enum: ["ACCEPTED", "REJECTED", "PENDING", null],
          description: "Restrict to one examination decision, or null for all",
        },
      },
      required: ["query", "k", "decision"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_patent",
    description:
      "Fetch the full abstract, CPC labels and the first independent claim of one patent by its application number (id from search_patents).",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Application number returned by search_patents" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
];

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

  let client: OpenAI;
  try {
    client = new OpenAI(); // OPENAI_API_KEY 환경변수에서 읽는다. 없으면 여기서 던진다.
  } catch {
    emit({
      type: "error",
      message:
        "OpenAI API 키가 설정되지 않았습니다. .env에 OPENAI_API_KEY를 넣고 개발 서버를 재시작하세요. (키 없이도 '유사 특허만 찾기'는 동작합니다)",
    });
    return;
  }

  async function runTool(name: string, rawArgs: string): Promise<string> {
    let args: unknown;
    try {
      args = JSON.parse(rawArgs);
    } catch {
      return JSON.stringify({ error: "arguments is not valid JSON" });
    }
    if (name === "search_patents") {
      const parsed = SearchInput.safeParse(args);
      if (!parsed.success) return JSON.stringify({ error: parsed.error.message });
      const { query, k, decision } = parsed.data;
      emit({ type: "tool", name, input: { query, k, decision } });
      const [vec] = await embedTexts([query]);
      const scored = topK(vec, index!.vectors, index!.meta.dim, k, (i) =>
        decision ? index!.patents[i].decision === decision : true,
      );
      const hits: SearchHit[] = scored.map((s) => toHit(index!.patents[s.index], s.score));
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
    }
    if (name === "get_patent") {
      const parsed = GetPatentInput.safeParse(args);
      if (!parsed.success) return JSON.stringify({ error: parsed.error.message });
      const { id } = parsed.data;
      emit({ type: "tool", name, input: { id } });
      const p = index!.byId.get(id);
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
    }
    return JSON.stringify({ error: `Unknown tool ${name}` });
  }

  emit({ type: "status", message: "아이디어를 분석하고 있어요…" });

  let input: OpenAI.Responses.ResponseInput = [{ role: "user", content: idea }];
  let previousResponseId: string | undefined;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const stream = client.responses.stream(
      {
        model: AGENT_MODEL,
        instructions: SYSTEM_PROMPT,
        input,
        tools: TOOLS,
        reasoning: { effort: REASONING_EFFORT },
        previous_response_id: previousResponseId,
        store: true,
      },
      { signal },
    );

    let emittedText = false;
    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        emittedText = true;
        emit({ type: "text", delta: event.delta });
      }
    }
    const response = await stream.finalResponse();
    previousResponseId = response.id;

    if (response.status === "incomplete") {
      emit({
        type: "error",
        message: `응답이 중단되었습니다 (${response.incomplete_details?.reason ?? "unknown"}). 다시 시도해 주세요.`,
      });
      return;
    }

    // finalResponse()는 ParsedResponse를 돌려주므로 평이한 타입으로 좁힌다
    const calls = response.output.flatMap((item) =>
      item.type === "function_call"
        ? [item as unknown as OpenAI.Responses.ResponseFunctionToolCall]
        : [],
    );
    if (calls.length === 0) {
      emit({ type: "done" });
      return;
    }
    if (emittedText) emit({ type: "text", delta: "\n\n" });

    const outputs: OpenAI.Responses.ResponseInputItem.FunctionCallOutput[] = [];
    for (const call of calls) {
      outputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: await runTool(call.name, call.arguments),
      });
    }
    input = outputs;
  }

  emit({ type: "error", message: "도구 호출이 너무 많아 분석을 중단했습니다. 다시 시도해 주세요." });
}
