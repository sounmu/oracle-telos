"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { DECISION_COLORS, DECISION_LABELS } from "@/lib/colors";
import type {
  AgentEvent,
  PatentDataset,
  PatentPoint,
  ResearchHit,
  ResearchStatus,
  SearchHit,
} from "@/lib/types";
import ResearchReferences, {
  IDLE_REFERENCES,
  readErrorMessage,
  scoreLabel,
  type ReferencesState,
} from "./ResearchReferences";

interface Props {
  dataset: PatentDataset;
  status: ResearchStatus | null;
  disabled: boolean;
  idea: string;
  onIdeaChange: (idea: string) => void;
  onMatches: (hits: SearchHit[], replace: boolean) => void;
  onPointsAdded: (points: PatentPoint[]) => void;
  onPick: (id: string) => void;
  selectedId: string | null;
}

type Phase = "idle" | "running" | "done" | "error";
type Terminal = "done" | "error" | null;

const EXAMPLES = [
  "반려동물 사진을 찍으면 AI가 건강 상태를 분석해 맞춤 사료를 추천하는 앱",
  "스마트 거울이 사용자의 피부 상태를 매일 기록하고 화장품을 추천",
  "드론이 농지를 촬영해 병충해를 조기에 탐지하는 서비스",
];

const DATASET_NOTES: Record<PatentDataset, string> = {
  korea: "KIPRIS를 실시간 조회해 로컬 색인에 더한 뒤 찾습니다.",
  sample: "USPTO 2016.01 미국 샘플에서 찾습니다. 특허 원문은 영어입니다.",
};

const JSON_HEADERS = { "Content-Type": "application/json" };

/** 답변 표시 전용 보정: 한국어 줄바꿈과 CommonMark 강조 규칙. 내용은 바꾸지 않는다 */
function readableKorean(markdown: string): string {
  return (
    markdown
      // **“…”**은 처럼 닫는 ** 앞이 따옴표이고 뒤가 조사면 강조가 풀리지 않는다 → “**…**”은
      .replace(/\*\*([“‘"(「『])([^*\n]+?)([”’")」』])\*\*/g, "$1**$2**$3")
      // 의존 명사 구문(할 수 있다/없다)을 한 줄에 둔다
      .replace(/(\S) 수([는도가]?) (있|없)/g, "$1\u00a0수$2\u00a0$3")
      // 닫는 따옴표·괄호와 뒤따르는 조사 사이에서 줄을 바꾸지 않는다
      .replace(/([”’")\]」』])(?=[가-힣])/g, "$1\u2060")
  );
}

const TOOL_LABELS: Record<string, { label: string; arg: "query" | "id" }> = {
  search_patents: { label: "검색", arg: "query" },
  search_laws: { label: "법령 검색", arg: "query" },
  search_disclosures: { label: "공시 검색", arg: "query" },
  get_patent: { label: "청구항 확인", arg: "id" },
  get_law_article: { label: "법령 조문 확인", arg: "id" },
  get_disclosure: { label: "공시 확인", arg: "id" },
};

const AGENT_EVENT_TYPES = new Set<AgentEvent["type"]>([
  "status",
  "tool",
  "points_added",
  "matches",
  "references",
  "text",
  "done",
  "error",
]);

export default function SearchPanel({
  dataset,
  status,
  disabled,
  idea,
  onIdeaChange,
  onMatches,
  onPointsAdded,
  onPick,
  selectedId,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusLine, setStatusLine] = useState("");
  const [toolLog, setToolLog] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [includeContext, setIncludeContext] = useState(false);
  const [asOf, setAsOf] = useState("");
  const [references, setReferences] = useState<ReferencesState>(IDLE_REFERENCES);
  const [sourceStatus, setSourceStatus] = useState<ResearchStatus | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hitsRef = useRef<SearchHit[]>([]);
  const referencesRef = useRef<ResearchHit[]>([]);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  function begin(): AbortController {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStatusLine("");
    setToolLog([]);
    setAnswer("");
    setError(null);
    hitsRef.current = [];
    setHits([]);
    onMatches([], true);
    referencesRef.current = [];
    setReferences(IDLE_REFERENCES);
    return ac;
  }

  function fail(err: unknown) {
    // fetch의 네트워크 실패는 TypeError("Failed to fetch")로 오므로 사용자 문장으로 바꾼다
    setError(
      err instanceof TypeError
        ? "서버에 연결하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도하세요."
        : err instanceof Error
          ? err.message
          : "요청을 처리하지 못했습니다.",
    );
    setPhase("error");
    setStatusLine("");
  }

  function mergeHits(incoming: SearchHit[]) {
    const map = new Map(hitsRef.current.map((h) => [h.id, h]));
    for (const h of incoming) {
      const old = map.get(h.id);
      if (!old || old.score < h.score) map.set(h.id, h);
    }
    const merged = [...map.values()].sort((a, b) => b.score - a.score);
    hitsRef.current = merged;
    setHits(merged);
    onMatches(merged, true);
  }

  function mergeReferences(incoming: ResearchHit[]) {
    const map = new Map(referencesRef.current.map((h) => [h.id, h]));
    for (const h of incoming) {
      const old = map.get(h.id);
      if (!old || old.score < h.score) map.set(h.id, h);
    }
    const merged = [...map.values()].sort((a, b) => b.score - a.score);
    referencesRef.current = merged;
    setReferences((r) => ({ ...r, requested: true, hits: merged }));
  }

  // 보조 근거 검색은 실패해도 특허 결과(hits·answer·phase)에 손대지 않는다
  async function loadReferences(query: string, ac: AbortController) {
    setReferences({ requested: true, loading: true, hits: [], error: null });
    try {
      const res = await fetch("/api/research/search", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ query, sources: ["law", "dart"], k: 6, ...(asOf ? { asOf } : {}) }),
        signal: ac.signal,
      });
      const body: unknown = await res.json().catch(() => null);
      if (ac.signal.aborted) return;
      if (!res.ok || !isResearchResponse(body)) {
        throw new Error(readErrorMessage(body) ?? `HTTP ${res.status}`);
      }
      setSourceStatus(body.status);
      mergeReferences(body.hits);
      setReferences((r) => ({ ...r, loading: false }));
    } catch (err) {
      if (ac.signal.aborted) return;
      setReferences((r) => ({
        ...r,
        loading: false,
        error: err instanceof Error ? err.message : "참고 자료를 불러오지 못했습니다.",
      }));
    }
  }

  async function runQuickSearch() {
    const query = idea.trim();
    if (!query) return;
    const ac = begin();
    setPhase("running");
    setStatusLine("임베딩 유사도로 찾는 중…");
    if (includeContext) void loadReferences(query, ac);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ query, k: 12, dataset }),
        signal: ac.signal,
      });
      const body: unknown = await res.json().catch(() => null);
      if (ac.signal.aborted) return;
      if (!res.ok || !isSearchResponse(body)) {
        throw new Error(readErrorMessage(body) ?? `HTTP ${res.status}`);
      }
      if (body.addedPoints?.length) onPointsAdded(body.addedPoints);
      mergeHits(body.hits);
      setStatusLine(body.warnings?.join(" ") ?? "");
      setPhase("done");
    } catch (err) {
      if (ac.signal.aborted) return;
      fail(err);
    }
  }

  async function runAgent() {
    const query = idea.trim();
    if (!query) return;
    const ac = begin();
    setPhase("running");
    setStatusLine("에이전트에 연결하는 중…");
    if (includeContext) void loadReferences(query, ac);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          idea: query,
          dataset,
          includeContext,
          ...(asOf ? { asOf } : {}),
        }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const body: unknown = await res.json().catch(() => null);
        throw new Error(readErrorMessage(body) ?? `HTTP ${res.status}`);
      }
      const terminal = await consumeStream(res.body, ac);
      if (ac.signal.aborted) return;
      if (terminal === null) {
        throw new Error("응답이 끝나기 전에 연결이 끊겼습니다. 다시 시도해 주세요.");
      }
      if (terminal === "done") {
        setStatusLine("");
        setPhase("done");
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      fail(err);
    }
  }

  // done/error 이벤트 없이 스트림이 닫히면 null → 호출자가 오류로 처리한다.
  // 중단되었거나 다른 실행에 밀린 뒤에는 이미 버퍼에 들어온 프레임도 버린다.
  async function consumeStream(
    body: ReadableStream<Uint8Array>,
    ac: AbortController,
  ): Promise<Terminal> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    const stale = () => ac.signal.aborted || abortRef.current !== ac;
    let buffer = "";
    let terminal: Terminal = null;
    try {
      while (terminal === null) {
        const { value, done } = await reader.read();
        if (done || stale()) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while (terminal === null && (idx = buffer.indexOf("\n\n")) >= 0) {
          if (stale()) return null;
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event = parseEvent(line.slice(6));
          if (event) terminal = handleEvent(event);
        }
      }
      return terminal;
    } finally {
      reader.cancel().catch(() => {});
    }
  }

  function handleEvent(event: AgentEvent): Terminal {
    switch (event.type) {
      case "status":
        setStatusLine(event.message);
        return null;
      case "tool": {
        const label = TOOL_LABELS[event.name];
        const arg = String(
          (label ? event.input[label.arg] : (event.input.query ?? event.input.id)) ?? "",
        ).replace(/^kipris:/, "");
        const name = label?.label ?? event.name;
        setStatusLine(arg ? `${name}: ${arg}` : name);
        setToolLog((log) => [
          ...log,
          label?.arg === "id" ? `${name} #${arg}` : arg ? `${name} "${arg}"` : name,
        ]);
        return null;
      }
      case "points_added":
        onPointsAdded(event.points);
        return null;
      case "matches":
        mergeHits(event.hits);
        return null;
      case "references":
        mergeReferences(event.hits);
        return null;
      case "text":
        setStatusLine("분석 작성 중…");
        setAnswer((a) => a + event.delta);
        return null;
      case "done":
        setStatusLine("");
        return "done";
      case "error":
        fail(new Error(event.message));
        return "error";
    }
  }

  function stop() {
    abortRef.current?.abort();
    setPhase("idle");
    setStatusLine("중지했습니다.");
    setReferences((r) => ({ ...r, loading: false }));
  }

  const running = phase === "running";
  const canRun = !disabled && !running && idea.trim().length > 0;
  const idle = phase === "idle" && !answer && hits.length === 0;

  // 폰은 페이지 전체가 하나의 스크롤, md 이상은 결과 영역만 스크롤한다
  return (
    <div className="flex flex-col md:h-full md:min-h-0">
      <div className="border-b border-border p-3 md:p-4">
        <label htmlFor="idea" className="mb-2 block text-xs font-medium text-muted">
          구상 중인 아이디어를 적어 주세요
        </label>
        <textarea
          id="idea"
          value={idea}
          onChange={(e) => onIdeaChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canRun) runAgent();
          }}
          placeholder="예) AI가 반려동물 사진으로 건강 상태를 분석해 사료를 추천하는 앱"
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
        />
        <p className="mt-1 text-[11px] text-muted/80">{DATASET_NOTES[dataset]}</p>
        {/* 예시를 항상 두어 입력 후 버튼이 포인터 아래로 옮겨가지 않게 한다 (더블클릭 오실행 방지) */}
        <div className="mt-2 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                title={ex}
                onClick={() => onIdeaChange(ex)}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted hover:border-accent hover:text-foreground"
              >
                {ex.slice(0, 22)}…
              </button>
            ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canRun}
            onClick={runAgent}
            className="min-h-11 flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-background hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 md:min-h-0"
          >
            AI 분석 <span className="font-normal opacity-80">⌘↵</span>
          </button>
          <button
            type="button"
            disabled={!canRun}
            onClick={runQuickSearch}
            className="min-h-11 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent disabled:cursor-not-allowed disabled:opacity-60 md:min-h-0"
          >
            유사 특허만 찾기
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={includeContext}
              disabled={running}
              onChange={(e) => setIncludeContext(e.target.checked)}
              className="h-3.5 w-3.5 accent-accent"
            />
            법령·공시 참고 자료도 찾기 <span className="text-muted">(선택)</span>
          </label>
          {includeContext && (
            <label className="flex items-center gap-1.5 text-muted">
              기준일
              <input
                type="date"
                value={asOf}
                disabled={running}
                onChange={(e) => setAsOf(e.target.value)}
                aria-label="참고 자료 기준일 (선택)"
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground [color-scheme:dark] focus:border-accent"
              />
            </label>
          )}
        </div>
      </div>

      <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
        {(statusLine || toolLog.length > 0) && (
          <div className="border-b border-border px-4 py-3 text-xs" aria-live="polite">
            {/* 중지는 상태 줄에 둔다: 눌러도 다른 버튼이 포인터 아래로 밀려오지 않는다 */}
            {statusLine && (
              <div className={`flex items-center gap-2 ${running ? "text-accent" : "text-muted"}`}>
                {running && (
                  <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" />
                )}
                <span className="min-w-0 flex-1 break-words">{statusLine}</span>
                {running && (
                  <button
                    type="button"
                    onClick={stop}
                    className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-accent"
                  >
                    중지
                  </button>
                )}
              </div>
            )}
            {toolLog.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-muted">
                {toolLog.map((t, i) => (
                  <li key={i} className="break-words">
                    · {t}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="m-4 rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs text-red-200"
          >
            {error}
          </div>
        )}

        {/* 특허 목록을 답변보다 먼저 둔다: 스트리밍 답변이 목록을 밀어내지 않는다 */}
        {hits.length > 0 && (
          <div className="border-b border-border px-4 py-3">
            <div className="mb-2 text-xs font-medium text-muted">
              유사 특허 {hits.length}건 · 지도에 표시됨
            </div>
            <ul className="space-y-1" aria-label="유사 특허 목록">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => onPick(h.id)}
                    aria-pressed={selectedId === h.id}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/5 ${
                      selectedId === h.id ? "bg-white/10" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: DECISION_COLORS[h.decision] }}
                      />
                      <span className="shrink-0 text-muted">
                        {DECISION_LABELS[h.decision]} · {scoreLabel(h.score)}
                      </span>
                      <span className="truncate">{h.title}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {answer && (
          <div className="prose-telos break-words border-b border-border px-4 py-4 text-sm">
            <ReactMarkdown>{readableKorean(answer)}</ReactMarkdown>
          </div>
        )}

        {includeContext && references.requested && (
          <ResearchReferences state={references} status={sourceStatus ?? status} />
        )}

        {idle && (
          <div className="px-4 py-6 text-xs leading-relaxed text-muted">
            {disabled && (
              <p className="mb-2 text-foreground">
                지도 데이터가 준비되면 검색할&nbsp;수&nbsp;있습니다. 지도 상단에서
                데이터셋을 바꿀&nbsp;수&nbsp;있습니다.
              </p>
            )}
            <p>
              <b className="text-foreground">AI 분석</b>: GPT 에이전트가 특허를 여러 번 검색하고
              청구항까지 읽은 뒤 유사점·차이점·거절 사례·방향을 정리합니다.
              OPENAI_API_KEY가&nbsp;필요합니다.
            </p>
            <p className="mt-2">
              <b className="text-foreground">유사 특허만 찾기</b>: 임베딩 유사도만으로 즉시
              찾습니다. OpenAI&nbsp;키&nbsp;없이&nbsp;동작합니다.
            </p>
            <p className="mt-2">
              <b className="text-foreground">법령·공시 참고 자료</b>: 켜면 법령과 기업 공시를 보조
              근거로 함께 찾습니다. 특허 결과와 별개이며, 자료가 없다고 해서 관련 법령이나
              경쟁사가 없다는 뜻은 아닙니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function parseEvent(raw: string): AgentEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("서버 응답을 해석하지 못했습니다.");
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const type = (parsed as { type?: unknown }).type;
  if (typeof type !== "string" || !AGENT_EVENT_TYPES.has(type as AgentEvent["type"])) return null;
  return parsed as AgentEvent;
}

function isSearchResponse(
  v: unknown,
): v is { hits: SearchHit[]; addedPoints?: PatentPoint[]; warnings?: string[] } {
  return typeof v === "object" && v !== null && Array.isArray((v as { hits?: unknown }).hits);
}

function isResearchResponse(v: unknown): v is { hits: ResearchHit[]; status: ResearchStatus } {
  if (typeof v !== "object" || v === null) return false;
  const r = v as { hits?: unknown; status?: unknown };
  return Array.isArray(r.hits) && typeof r.status === "object" && r.status !== null;
}
