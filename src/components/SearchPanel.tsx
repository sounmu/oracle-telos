"use client";

import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { DECISION_LABELS, DECISION_TAG_STYLES } from "@/lib/colors";
import { PROXIMITY_LABELS } from "@/lib/proximity";
import type {
  AgentEvent,
  ComparisonState,
  PatentDataset,
  PatentPoint,
  ResearchHit,
  ResearchStatus,
  SearchCoverage,
  SearchHit,
  SearchResponse,
} from "@/lib/types";
import { ProximityBadge } from "./Comparison";
import ProximitySummary from "./ProximitySummary";
import DisputeCases, { matchCases } from "./DisputeCases";
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
  /** 서버에 OpenAI 키가 있는지. false면 AI 분석과 자동 비교를 끈다 */
  aiReady: boolean;
  idea: string;
  onIdeaChange: (idea: string) => void;
  onMatches: (hits: SearchHit[], replace: boolean) => void;
  onPointsAdded: (points: PatentPoint[]) => void;
  onPick: (id: string) => void;
  selectedId: string | null;
  comparisons: ReadonlyMap<string, ComparisonState>;
  /** 새 검색을 시작하면 이전 기술 설명으로 만든 비교를 버린다 */
  onSearchStart: (idea: string) => void;
  onCompare: (id: string, idea: string) => void;
}

// MVP: 가장 가까운 3건을 먼저 비교해 보여 준다.
const AUTO_COMPARE = 3;

type Phase = "idle" | "running" | "done" | "error";
type Terminal = "done" | "error" | null;

const EXAMPLES = [
  "생분해성 고분자 미립구에 GLP-1 유사체를 담아 4주 동안 방출하는 서방형 주사제",
  "PDLLA 미세입자를 다공성으로 만들어 콜라겐 생성을 유도하는 주사제",
  "반려동물 사진을 찍으면 AI가 건강 상태를 분석해 맞춤 사료를 추천하는 앱",
  "스마트 거울이 사용자의 피부 상태를 매일 기록하고 화장품을 추천",
  "드론이 농지를 촬영해 병충해를 조기에 탐지하는 서비스",
];

type InputMode = "text" | "question" | "patent" | "category";

const INPUT_MODES: { id: InputMode; label: string; field: string; placeholder: string }[] = [
  { id: "text", label: "기술 설명", field: "내 기술을 한두 문장으로 적어 주세요", placeholder: "예) 생분해성 고분자 미립구에 GLP-1 유사체를 담아 4주 동안 방출하는 서방형 주사제" },
  { id: "question", label: "질문", field: "궁금한 걸 편하게 물어보세요", placeholder: "예) 미세유체 칩으로 미립구를 만드는 공정에 비슷한 특허가 있을까요?" },
  { id: "patent", label: "특허·회사", field: "특허 제목이나 회사의 핵심 기술을 적어 주세요", placeholder: "예) 경쟁사 특허 제목이나 우리 회사 대표 기술" },
  { id: "category", label: "카테고리", field: "", placeholder: "" },
];

const CATEGORIES: { name: string; sub: string; idea: string }[] = [
  { name: "톡신", sub: "균주 · 정제 · 제형", idea: "보툴리눔 톡신 균주를 배양하고 정제해 주사제로 만드는 공정" },
  { name: "필러", sub: "HA · PLLA · PCL · 가교", idea: "가교 히알루론산에 리도카인을 섞은 피부 주입용 필러" },
  { name: "스킨부스터", sub: "PDRN · PN · 엑소좀", idea: "연어 정소에서 추출한 PDRN을 정제해 피부에 주입하는 스킨부스터" },
  { name: "콜라겐부스터", sub: "고분자 미세입자 · 제조공정", idea: "PDLLA 미세입자를 다공성으로 만들어 콜라겐 생성을 유도하는 주사제" },
  { name: "서방형 주사제", sub: "미립구 · 방출 제어", idea: "생분해성 고분자 미립구에 GLP-1 유사체를 담아 4주 동안 방출하는 서방형 주사제" },
  { name: "에너지 장비", sub: "HIFU · RF · 레이저", idea: "고강도 집속 초음파로 피부 진피층을 가열하는 리프팅 장비" },
];

type ResultTab = "patents" | "cases";
type LevelFilter = "all" | "hot" | "warm" | "cool" | "insufficient" | "none";

const LEVEL_FILTERS: LevelFilter[] = ["all", "hot", "warm", "cool", "insufficient", "none"];

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

/** readableKorean이 넣은 줄바꿈 보정 문자(U+2060, NBSP)를 복사 결과에서 뛴다 */
function copyWithoutLayoutMarks(event: ClipboardEvent<HTMLDivElement>) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;
  const holder = document.createElement("div");
  for (let i = 0; i < selection.rangeCount; i++) holder.append(selection.getRangeAt(i).cloneContents());
  event.preventDefault();
  event.clipboardData.setData("text/plain", selection.toString().replace(/\u2060/g, "").replace(/\u00a0/g, " "));
  event.clipboardData.setData("text/html", holder.innerHTML.replace(/\u2060/g, "").replace(/&nbsp;|\u00a0/g, " "));
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
  aiReady,
  idea,
  onIdeaChange,
  onMatches,
  onPointsAdded,
  onPick,
  selectedId,
  comparisons,
  onSearchStart,
  onCompare,
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
  const [warnings, setWarnings] = useState<string[]>([]);
  const [coverage, setCoverage] = useState<SearchCoverage | null>(null);
  const [searchedIdea, setSearchedIdea] = useState("");
  const [elements, setElements] = useState<string[]>([]);
  const [mode, setMode] = useState<InputMode>("text");
  const [tab, setTab] = useState<ResultTab>("patents");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
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
    setWarnings([]);
    setCoverage(null);
    setElements([]);
    setTab("patents");
    setLevelFilter("all");
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

  function startSearch(query: string): AbortController {
    const ac = begin();
    setSearchedIdea(query);
    onSearchStart(query);
    return ac;
  }

  function addWarnings(incoming: readonly string[]) {
    setWarnings((prev) => [...new Set([...prev, ...incoming])]);
  }

  function compareTop(query: string) {
    if (dataset !== "korea" || !aiReady) return;
    for (const hit of hitsRef.current.slice(0, AUTO_COMPARE)) onCompare(hit.id, query);
  }

  async function runQuickSearch() {
    const query = idea.trim();
    if (!query) return;
    const ac = startSearch(query);
    setPhase("running");
    setStatusLine(
      dataset === "korea"
        ? "기술 요소로 검색어를 만들고 KIPRIS 후보를 찾는 중…"
        : "임베딩 유사도로 찾는 중…",
    );
    if (includeContext) void loadReferences(query, ac);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ query, k: 10, dataset, ...(mode === "patent" ? { intent: "lookup" } : {}) }),
        signal: ac.signal,
      });
      const body: unknown = await res.json().catch(() => null);
      if (ac.signal.aborted) return;
      if (!res.ok || !isSearchResponse(body)) {
        throw new Error(readErrorMessage(body) ?? `HTTP ${res.status}`);
      }
      if (body.addedPoints?.length) onPointsAdded(body.addedPoints);
      mergeHits(body.hits);
      addWarnings(body.warnings ?? []);
      setCoverage(body.coverage ?? null);
      setElements(body.elements ?? []);
      setStatusLine("");
      setPhase("done");
      compareTop(query);
    } catch (err) {
      if (ac.signal.aborted) return;
      fail(err);
    }
  }

  async function runAgent() {
    const query = idea.trim();
    if (!query || !aiReady) return;
    const ac = startSearch(query);
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
        compareTop(query);
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
        if (event.warnings) addWarnings(event.warnings);
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
  const korean = dataset === "korea";
  const currentMode = INPUT_MODES.find((m) => m.id === mode) ?? INPUT_MODES[0];
  const caseMatches = searchedIdea
    ? matchCases([searchedIdea, ...elements, ...(coverage?.queries ?? []), ...hits.map((h) => h.title)], 6)
    : [];

  function levelOf(id: string): LevelFilter {
    const c = comparisons.get(id);
    if (!c || c.status !== "ready") return "none";
    return c.data.proximity.level;
  }
  const levelCounts = Object.fromEntries(
    LEVEL_FILTERS.map((key) => [key, key === "all" ? hits.length : hits.filter((h) => levelOf(h.id) === key).length]),
  ) as Record<LevelFilter, number>;
  const shownHits = levelFilter === "all" ? hits : hits.filter((h) => levelOf(h.id) === levelFilter);
  const showLevelFilters = korean && [...comparisons.values()].some((c) => c.status === "ready");

  // 폰은 페이지 전체가 하나의 스크롤, md 이상은 왼쪽 열 전체가 스크롤한다
  return (
    <div className="flex flex-col gap-3">
      {idle && (
        <div className="px-1 pb-2 pt-3">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">
            어떤 기술을
            <br />
            확인해 볼까요?
          </h1>
          <p className="mt-2 text-base leading-relaxed text-ink-2">
            비슷한 특허와 분쟁 사례를 찾아서
            <br />내 기술과 얼마나 가까운지 온도로 알려드려요
          </p>
        </div>
      )}

      <section aria-label="기술 입력" className="rounded-3xl bg-panel p-5 md:p-6">
        <div role="group" aria-label="입력 방식" className="scroll-row -mx-5 flex gap-2 overflow-x-auto px-5 md:-mx-6 md:px-6">
          {INPUT_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`min-h-10 shrink-0 rounded-full px-4 text-[15px] font-semibold transition ${
                mode === m.id ? "bg-foreground text-white" : "bg-background text-ink-2 hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "category" ? (
          <ul className="mt-3 divide-y divide-background" aria-label="제품군">
            {CATEGORIES.map((c) => (
              <li key={c.name}>
                <button
                  type="button"
                  onClick={() => {
                    onIdeaChange(c.idea);
                    setMode("text");
                  }}
                  className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-[17px] font-semibold">{c.name}</span>
                    <span className="block text-sm text-muted">{c.sub}</span>
                  </span>
                  <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-muted" aria-hidden="true">
                    <path d="M8 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <label htmlFor="idea" className="mb-2 block text-[15px] font-semibold text-ink-2">
              {currentMode.field}
            </label>
            <textarea
              id="idea"
              value={idea}
              onChange={(e) => onIdeaChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canRun) {
                  if (aiReady) runAgent();
                  else runQuickSearch();
                }
              }}
              placeholder={currentMode.placeholder}
              rows={4}
              maxLength={4000}
              className="w-full resize-y rounded-2xl border-0 bg-background px-4 py-3.5 text-[17px] leading-relaxed outline-none placeholder:text-muted focus:bg-panel focus:ring-2 focus:ring-accent"
            />
            <div className="mt-1.5 flex justify-between gap-3 text-[13px] text-muted">
              <span>{DATASET_NOTES[dataset]}</span>
              <span className="shrink-0 tabular-nums">{idea.trim().length.toLocaleString()} / 4,000</span>
            </div>
          </div>
        )}

        {/* 예시를 항상 두어 입력 후 버튼이 포인터 아래로 옮겨가지 않게 한다 (더블클릭 오실행 방지) */}
        <div className="mt-4">
          <span className="text-[13px] text-muted">예시로 채우기</span>
          <div className="scroll-row -mx-5 mt-1.5 flex gap-2 overflow-x-auto px-5 md:-mx-6 md:flex-wrap md:overflow-visible md:px-6">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                title={ex}
                onClick={() => {
                  onIdeaChange(ex);
                  setMode("text");
                }}
                className="min-h-9 shrink-0 rounded-full border border-border bg-panel px-3 text-sm text-ink-2 hover:border-accent hover:text-foreground"
              >
                {ex.length > 20 ? `${ex.slice(0, 20)}…` : ex}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={!canRun}
            onClick={runQuickSearch}
            className="min-h-14 flex-1 rounded-2xl bg-accent px-4 text-[17px] font-bold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            찾아보기
          </button>
          <button
            type="button"
            disabled={!canRun || !aiReady}
            title={aiReady ? undefined : "OpenAI 키가 있어야 쓸 수 있어요"}
            onClick={runAgent}
            className="min-h-14 rounded-2xl bg-accent-soft px-5 text-base font-bold text-accent-strong transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            AI 분석까지 <span className="font-medium opacity-70">⌘↵</span>
          </button>
        </div>
        {!aiReady && (
          <p className="mt-2 rounded-2xl bg-background px-4 py-3 text-[13px] leading-relaxed text-ink-2">
            OpenAI 키가 없어서 AI 분석과 근접도 온도는 꺼져 있어요. 찾아보기는 키 없이도 돼요. 켜려면{" "}
            <code className="rounded bg-panel px-1">.env</code>에 <code className="rounded bg-panel px-1">OPENAI_API_KEY</code>를
            넣어 주세요.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <label className="flex min-h-10 items-center gap-2">
            <input
              type="checkbox"
              checked={includeContext}
              disabled={running}
              onChange={(e) => setIncludeContext(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            법령·공시 참고 자료도 찾기 <span className="text-muted">(선택)</span>
          </label>
          {includeContext && (
            <label className="flex min-h-10 items-center gap-2 text-muted">
              기준일
              <input
                type="date"
                value={asOf}
                disabled={running}
                onChange={(e) => setAsOf(e.target.value)}
                aria-label="참고 자료 기준일 (선택)"
                className="rounded-lg border border-border bg-panel px-2 py-1.5 text-sm text-foreground focus:border-accent"
              />
            </label>
          )}
        </div>
      </section>

      {(statusLine || toolLog.length > 0) && (
        <section aria-live="polite" className="rounded-3xl bg-panel px-5 py-4 text-[15px]">
          {/* 중지는 상태 줄에 둔다: 눌러도 다른 버튼이 포인터 아래로 밀려오지 않는다 */}
          {statusLine && (
            <div className={`flex items-center gap-3 ${running ? "text-foreground" : "text-muted"}`}>
              {running && (
                <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-accent" />
              )}
              <span className="min-w-0 flex-1 break-words">{statusLine}</span>
              {running && (
                <button
                  type="button"
                  onClick={stop}
                  className="min-h-10 shrink-0 rounded-xl bg-background px-3.5 text-sm font-semibold hover:bg-border"
                >
                  중지
                </button>
              )}
            </div>
          )}
          {toolLog.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[13px] text-muted">
              {toolLog.map((t, i) => (
                <li key={i} className="break-words">
                  · {t}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {error && (
        <div role="alert" className="rounded-3xl bg-red-50 px-5 py-4 text-[15px] leading-relaxed text-red-700">
          {error}
        </div>
      )}

      {warnings.length > 0 && (
        <ul aria-label="검색 경고" className="space-y-1 rounded-3xl bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-900">
          {warnings.map((w) => (
            <li key={w} className="break-words">
              {w}
            </li>
          ))}
        </ul>
      )}

      {korean && <ProximitySummary hits={hits} comparisons={comparisons} onPick={onPick} />}

      {(elements.length > 0 || coverage) && (
        <section aria-label="검색 요약" className="rounded-3xl bg-panel p-5 md:p-6">
          <h2 className="text-lg font-bold tracking-tight">이렇게 나눠서 찾았어요</h2>
          {elements.length > 0 && (
            <div className="mt-3">
              <span className="text-[13px] text-muted">기술 요소</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {elements.map((e) => (
                  <span key={e} className="inline-flex min-h-8 items-center rounded-full border border-border px-3 text-sm">
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}
          {coverage && coverage.queries.length > 0 && (
            <div className="mt-3">
              <span className="text-[13px] text-muted">검색어 묶음</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {coverage.queries.map((q) => (
                  <span key={q} className="inline-flex min-h-8 items-center rounded-full bg-background px-3 text-sm text-ink-2">
                    {q}
                  </span>
                ))}
              </div>
            </div>
          )}
          {coverage && (
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              후보 {coverage.candidates.toLocaleString()}건 중 관련도 순위예요. 국내 전체 검색이 아니에요.
              {coverage.detailed ? ` 이번 검색으로 상세를 새로 받은 특허는 ${coverage.detailed}건이에요.` : ""}
            </p>
          )}
        </section>
      )}

      {phase === "done" && hits.length === 0 && (
        <section className="rounded-3xl bg-panel px-5 py-5">
          <p className="text-[17px] font-bold">관련 특허를 찾지 못했어요</p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
            {coverage && coverage.candidates === 0
              ? "KIPRIS 검색어로 찾은 후보가 없어요. 핵심 기술을 더 짧고 일반적인 말로 적어 다시 찾아보세요."
              : "확보한 후보 안에서 관련 특허가 없었어요. 다른 표현이나 기술 요소로 다시 찾아보세요."}{" "}
            결과가 없다고 해서 관련 특허가 없다는 뜻은 아니에요.
          </p>
        </section>
      )}

      {/* 특허 목록을 답변보다 먼저 둔다: 스트리밍 답변이 목록을 밀어내지 않는다 */}
      {hits.length > 0 && (
        <section aria-label="찾기 결과" className="rounded-3xl bg-panel p-5 md:p-6">
          <div role="tablist" aria-label="결과 종류" className="grid grid-cols-2 gap-1 rounded-2xl bg-background p-1">
            {(
              [
                ["patents", `관련 특허 ${hits.length}`],
                ["cases", `분쟁 사례 ${caseMatches.length}`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`min-h-11 rounded-xl text-[15px] font-semibold transition ${
                  tab === key ? "bg-panel text-foreground shadow-sm" : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "patents" ? (
            <>
              {showLevelFilters && (
                <div role="group" aria-label="근접도 필터" className="scroll-row -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 md:-mx-6 md:px-6">
                  {LEVEL_FILTERS.filter((k) => k === "all" || levelCounts[k] > 0).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={levelFilter === k}
                      onClick={() => setLevelFilter(k)}
                      className={`min-h-10 shrink-0 rounded-full px-3.5 text-sm font-semibold transition ${
                        levelFilter === k ? "bg-foreground text-white" : "bg-background text-ink-2 hover:text-foreground"
                      }`}
                    >
                      {k === "all" ? "전체" : k === "none" ? "비교 전" : PROXIMITY_LABELS[k].title} {levelCounts[k]}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[13px] leading-relaxed text-muted">
                지도에 표시돼요.{" "}
                {korean
                  ? "뜨거움·따뜻은 청구항 1의 구성이 모두 내 설명에 대응되는 특허, 서늘은 내 설명에 없는 구성이 있는 특허예요. 상위 3건은 자동으로 비교해요."
                  : "특허를 누르면 상세를 볼 수 있어요."}
              </p>
              <ul className="mt-1 divide-y divide-background" aria-label="관련 특허 목록">
                {shownHits.map((h) => {
                  const comparison = comparisons.get(h.id);
                  const tag = DECISION_TAG_STYLES[h.decision];
                  return (
                    <li key={h.id} className={`-mx-2 rounded-2xl px-2 ${selectedId === h.id ? "bg-accent-soft/60" : ""}`}>
                      <div className="flex flex-col gap-2.5 py-4 sm:flex-row sm:items-start">
                        <button
                          type="button"
                          onClick={() => onPick(h.id)}
                          aria-pressed={selectedId === h.id}
                          className="group min-w-0 flex-1 text-left"
                        >
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                            <span className="rounded-md px-1.5 py-0.5 font-bold" style={{ background: tag.bg, color: tag.ink }}>
                              {DECISION_LABELS[h.decision]}
                            </span>
                            {h.applicant && <span>{h.applicant}</span>}
                            <span className="break-all">
                              {h.id.startsWith("kipris:") ? `출원번호 ${h.id.slice(7)}` : `#${h.id}`}
                            </span>
                            {h.filed && <span>{h.filed}</span>}
                          </span>
                          <span className="mt-1 block text-[17px] font-semibold leading-snug group-hover:text-accent-strong">
                            {h.title}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-muted">
                            {comparison?.status === "ready" && comparison.data.summary ? comparison.data.summary : h.abstract}
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                          {comparison ? (
                            <ProximityBadge state={comparison} />
                          ) : (
                            korean &&
                            aiReady &&
                            searchedIdea && (
                              <button
                                type="button"
                                onClick={() => onCompare(h.id, searchedIdea)}
                                className="min-h-10 rounded-xl bg-background px-3.5 text-sm font-semibold text-ink-2 hover:bg-border"
                              >
                                근접도 보기
                              </button>
                            )
                          )}
                          <span className="text-[13px] text-muted">{scoreLabel(h.score)}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
                {shownHits.length === 0 && <li className="py-6 text-center text-sm text-muted">이 조건에 맞는 특허가 없어요</li>}
              </ul>
              {korean && (
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  기술 근접도는 청구항 1의 구성이 내 설명에 모두 있는지로 정한 기술적 거리이며 법적 위험도·침해 확률이 아니에요.
                  특허를 누르면 청구항 구성 대비와 판정 근거를 볼 수 있어요.
                </p>
              )}
            </>
          ) : (
            <div className="mt-3">
              <p className="mb-3 text-[13px] leading-relaxed text-muted">
                내 기술 설명, 기술 요소, 찾은 특허 제목과 키워드가 겹치는 분쟁이에요. 어떤 기술 차이가 결론을 갈랐는지 보여
                드려요.
              </p>
              <DisputeCases matches={caseMatches} />
            </div>
          )}
        </section>
      )}

      {answer && (
        <section aria-label="AI 분석" className="rounded-3xl bg-panel p-5 md:p-6">
          <h2 className="mb-3 text-lg font-bold tracking-tight">AI 분석</h2>
          <div className="prose-telos break-words text-[15px]" onCopy={copyWithoutLayoutMarks}>
            <ReactMarkdown>{readableKorean(answer)}</ReactMarkdown>
          </div>
        </section>
      )}

      {includeContext && references.requested && (
        <div className="overflow-hidden rounded-3xl bg-panel">
          <ResearchReferences state={references} status={sourceStatus ?? status} />
        </div>
      )}

      {idle && (
        <section aria-label="Telos 사용법" className="rounded-3xl bg-panel px-5 py-2 md:px-6">
          {disabled && (
            <p className="border-b border-background py-4 text-[15px] text-foreground">
              지도 데이터가 준비되면 찾을&nbsp;수&nbsp;있어요. 위에서 데이터셋을 바꿀&nbsp;수&nbsp;있어요.
            </p>
          )}
          <ul className="divide-y divide-background">
            {[
              ["찾기", "기술을 요소로 나눠 여러 검색어로 특허를 찾아요. OpenAI 키가 없으면 입력 문장으로 바로 찾아요."],
              ["비교", "원문 인용으로 확인한 공통점과 차이만 보여줘요. 특허를 누르면 기술 요소별로 나란히 놓아요."],
              ["기술 근접도", "청구항 1의 구성이 내 설명에 모두 있는지 판례의 구성요소 대비 방식으로 따져요. 법적 위험도가 아니에요."],
              ["AI 분석까지", "GPT 에이전트가 특허를 여러 번 찾고 청구항까지 읽은 뒤 유사점·차이점·방향을 정리해요. OPENAI_API_KEY가 필요해요."],
              ["법령·공시 참고 자료", "켜면 법령과 기업 공시를 보조 근거로 함께 찾아요. 자료가 없다고 해서 관련 법령이나 경쟁사가 없다는 뜻은 아니에요."],
            ].map(([title, body]) => (
              <li key={title} className="py-4">
                <div className="text-[17px] font-semibold">{title}</div>
                <p className="mt-0.5 text-sm leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
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

function isSearchResponse(v: unknown): v is SearchResponse {
  return typeof v === "object" && v !== null && Array.isArray((v as { hits?: unknown }).hits);
}

function isResearchResponse(v: unknown): v is { hits: ResearchHit[]; status: ResearchStatus } {
  if (typeof v !== "object" || v === null) return false;
  const r = v as { hits?: unknown; status?: unknown };
  return Array.isArray(r.hits) && typeof r.status === "object" && r.status !== null;
}
