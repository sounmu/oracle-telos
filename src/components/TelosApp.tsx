"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PatentMap from "./PatentMap";
import Dashboard from "./Dashboard";
import PatentDetail from "./PatentDetail";
import { NewChatBar, Stepper, InputStep, ExploreReport, VerifyReport, ReportPanel, locateIdea } from "./SessionSteps";
import { queryOf } from "@/lib/explore";
import { countWithin } from "@/lib/phaseFeatures";
import { formatDate, readErrorMessage } from "./ResearchReferences";
import { ACTIVE_CASES } from "@/lib/cases";
import { linkedCases } from "@/lib/phaseFeatures";
import { describeSession, loadSessions, makeSession, saveSessions, sortSessions, type Session, type StepIndex, type Template } from "@/lib/sessions";
import { DECISION_COLORS, DECISION_LABELS } from "@/lib/colors";
import {
  DECISIONS,
  type ComparisonState,
  type Decision,
  type PatentComparison,
  type PatentDataset,
  type PatentMapResponse,
  type PatentPoint,
  type ResearchStatus,
  type SearchHit,
} from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

// 지금 데이터셋은 한국 KIPRIS 하나다. 시연 모드에서는 시연 마스터(sample 경로)를 쓴다
const DATASET_LABEL = {
  title: process.env.NEXT_PUBLIC_TELOS_DEMO === "1" ? "시연 데이터" : "KIPRIS 한국 특허",
  note: "검색할 때 KIPRIS를 조회해 색인에 더합니다",
};

/** 지도 카메라 이동을 알리는 번호 (이벤트 핸들러에서만 호출) */
function stampNonce(): number {
  return Date.now();
}

/** 새 세션 id (이벤트 핸들러에서만 호출) */
function newSessionId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** 오늘의 랜덤 특허 한 건 (이벤트 핸들러에서만 호출) */
function pickRandom<T>(items: readonly T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

export default function TelosApp() {
  const [dataset] = useState<PatentDataset>(process.env.NEXT_PUBLIC_TELOS_DEMO === "1" ? "sample" : "korea");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [points, setPoints] = useState<PatentPoint[]>([]);
  const [builtAt, setBuiltAt] = useState<string | null>(null);
  const [status, setStatus] = useState<ResearchStatus | null>(null);
  // null은 아직 모름. 키가 없다고 확인된 경우에만 AI 기능을 끈다
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [load, setLoad] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visible, setVisible] = useState<Set<Decision>>(() => new Set(DECISIONS));
  const [highlights, setHighlights] = useState<Map<string, number> | null>(null);
  // 조회·위치 계산의 진행 상태와 오류는 요청한 세션 id에 묶는다
  const [locateError, setLocateError] = useState<{ id: string; message: string } | null>(null);
  const [locatingId, setLocatingId] = useState<string | null>(null);
  const [queryBusyId, setQueryBusyId] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<{ id: string; message: string } | null>(null);
  const [riskOn, setRiskOn] = useState(false);
  const [edgesOn, setEdgesOn] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null);
  const [comparisonIdea, setComparisonIdea] = useState("");
  const [comparisons, setComparisons] = useState<Map<string, ComparisonState>>(() => new Map());
  const compareAbortRef = useRef<AbortController | null>(null);
  const requestedRef = useRef(new Set<string>());
  const leftRef = useRef<HTMLDivElement>(null);
  const homeDetailRef = useRef<HTMLDivElement>(null);

  // 세션: 사업 아이템 하나. 저장소는 브라우저에만 있으므로 마운트 뒤에 한 번 읽는다
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sessionsReady, setSessionsReady] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessions(loadSessions());
    setSessionsReady(true);
  }, []);
  useEffect(() => {
    if (sessionsReady) saveSessions(sessions);
  }, [sessions, sessionsReady]);
  const activeSession = activeId ? sessions.find((s) => s.id === activeId) ?? null : null;

  function updateSession(id: string, patch: Partial<Session>) {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function createSession(text: string) {
    const session = makeSession(text, Date.now(), newSessionId());
    setSessions((prev) => [session, ...prev]);
    setActiveId(session.id);
    setSelectedId(null);
  }
  /** 홈(새 대화)으로 돌아간다. 세션에서 고른 특허가 홈 상세로 따라오지 않게 선택도 비운다 */
  function goHome() {
    setActiveId(null);
    setSelectedId(null);
  }
  function openSession(id: string) {
    setActiveId(id);
    setSelectedId(null);
  }
  function goStep(i: StepIndex) {
    if (!activeSession) return;
    updateSession(activeSession.id, { step: i });
  }
  function confirmTemplate(tpl: Template) {
    if (!activeSession) return;
    // 조건이 바뀌므로 이전 결과와 위치는 버린다
    updateSession(activeSession.id, { tpl, name: tpl.item.slice(0, 18), idea: tpl.item, step: 1, results: null, location: null });
    void runQuery(activeSession.id, tpl);
  }

  /** 템플릿 값으로 DB를 조회한다. 결과가 지도와 리포트의 대상이 된다 */
  async function runQuery(sessionId: string, tpl: Template) {
    const query = queryOf(tpl);
    if (query.length < 2) return;
    setQueryBusyId(sessionId);
    setQueryError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, k: 30, dataset }),
      });
      const body = (await res.json().catch(() => null)) as { hits?: SearchHit[]; addedPoints?: PatentPoint[]; error?: string } | null;
      if (!res.ok || !body?.hits) throw new Error(body?.error ?? `HTTP ${res.status}`);
      if (body.addedPoints?.length) handlePointsAdded(body.addedPoints);
      // 응답을 기다리는 사이 다른 세션으로 옮겨도 요청한 세션에 붙인다
      const scores = Object.fromEntries(body.hits.map((h) => [h.id, h.score] as const));
      updateSession(sessionId, { results: { ids: body.hits.map((h) => h.id), scores, query, at: Date.now() } });
      // 위치도 검색에 쓴 기술 설명 그대로 계산한다 (아이템 칸만 쓰지 않는다)
      if (query.length >= 5) void runLocate(sessionId, query);
    } catch (err) {
      setQueryError({ id: sessionId, message: err instanceof Error ? err.message : "조회하지 못했습니다." });
    } finally {
      setQueryBusyId((cur) => (cur === sessionId ? null : cur));
    }
  }

  const byId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);
  const counts = useMemo(() => {
    const c: Record<Decision, number> = { ACCEPTED: 0, REJECTED: 0, PENDING: 0, UNKNOWN: 0 };
    for (const p of points) c[p.decision]++;
    return c;
  }, [points]);
  const activeDecisions = DECISIONS.filter((d) => counts[d] > 0);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const kipris = status?.sources.find((s) => s.source === "kipris") ?? null;
  const empty = load === "ready" && points.length === 0;
  // 비교 입력도 검색·위치와 같은 기술 설명을 쓴다. 비교표는 같은 설명으로 만든 것만 보여준다
  const detailIdea = activeSession ? describeSession(activeSession) : "";
  const sessionComparisons = comparisonIdea === detailIdea ? comparisons : null;
  const liveSearch = dataset === "korea" && kipris?.configured === true;
  const aiReady = aiConfigured !== false;
  // 탐색 결과와 내 위치는 세션에 저장된 값에서 계산한다
  const results = activeSession?.results ?? null;
  const location = activeSession?.location ?? null;
  const queryBusy = activeSession !== null && queryBusyId === activeSession.id;
  const locating = activeSession !== null && locatingId === activeSession.id;
  const sessionQueryError = queryError && queryError.id === activeSession?.id ? queryError.message : null;
  const sessionLocateError = locateError && locateError.id === activeSession?.id ? locateError.message : null;
  const resultScores = useMemo(() => (results ? new Map(Object.entries(results.scores)) : null), [results]);
  const resultPoints = useMemo(() => {
    if (!results) return [];
    return results.ids.map((id) => byId.get(id)).filter((p): p is PatentPoint => Boolean(p));
  }, [results, byId]);

  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/patents?dataset=${dataset}`, { signal: ac.signal })
      .then(async (r) => {
        const body: unknown = await r.json().catch(() => null);
        if (ac.signal.aborted) return;
        if (!r.ok) throw new Error(readErrorMessage(body) ?? `HTTP ${r.status}`);
        const data = body as PatentMapResponse;
        setPoints(data.points);
        setBuiltAt(data.builtAt);
        setStatus(data.status);
        setAiConfigured(data.aiConfigured);
        setLoad("ready");
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        setLoadError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
        setLoad("error");
      });
    return () => ac.abort();
  }, [dataset, reloadNonce]);

  useEffect(() => () => compareAbortRef.current?.abort(), []);

  function resetForLoad() {
    setLoad("loading");
    setLoadError(null);
    setPoints([]);
    setBuiltAt(null);
    setStatus(null);
    setAiConfigured(null);
    setVisible(new Set(DECISIONS));
    setHighlights(null);
    setSelectedId(null);
    setFocus(null);
    startComparisons("");
  }

  function startComparisons(nextIdea: string) {
    compareAbortRef.current?.abort();
    compareAbortRef.current = null;
    requestedRef.current = new Set();
    setComparisonIdea(nextIdea);
    setComparisons(new Map());
  }

  function compare(id: string, forIdea: string) {
    if (requestedRef.current.has(id)) return;
    requestedRef.current.add(id);
    compareAbortRef.current ??= new AbortController();
    const { signal } = compareAbortRef.current;
    const update = (state: ComparisonState) => setComparisons((prev) => new Map(prev).set(id, state));
    update({ status: "loading" });
    fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: forIdea, id }),
      signal,
    })
      .then(async (r) => {
        const body: unknown = await r.json().catch(() => null);
        if (!r.ok || !isComparison(body)) throw new Error(readErrorMessage(body) ?? `HTTP ${r.status}`);
        if (!signal.aborted) update({ status: "ready", data: body });
      })
      .catch((err: unknown) => {
        if (signal.aborted) return;
        requestedRef.current.delete(id);
        update({
          status: "error",
          message:
            err instanceof TypeError
              ? "서버에 연결하지 못했습니다. 네트워크 연결을 확인하세요."
              : err instanceof Error
                ? err.message
                : "비교를 만들지 못했습니다.",
        });
      });
  }

  function retry() {
    resetForLoad();
    setReloadNonce((n) => n + 1);
  }

  function toggleDecision(d: Decision) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(d)) {
        next.delete(d);
        if (!activeDecisions.some((a) => next.has(a))) return prev;
      } else next.add(d);
      return next;
    });
  }

  function handlePointsAdded(incoming: PatentPoint[]) {
    setPoints((prev) => {
      const merged = new Map(prev.map((p) => [p.id, p]));
      for (const p of incoming) merged.set(p.id, p);
      return [...merged.values()];
    });
  }

  function pick(id: string) {
    setSelectedId(id);
    setFocus({ id, nonce: stampNonce() });
  }

  function select(id: string | null) {
    setSelectedId(id);
    if (id) leftRef.current?.scrollTo({ top: 0 });
  }

  // 홈 지도에서 특허를 고르면 상세 패널을 보여 준다. 폰은 지도 아래에 붙으므로 그 위치로 내린다
  useEffect(() => {
    if (activeId !== null || !selectedId) return;
    const panel = homeDetailRef.current;
    if (!panel) return;
    panel.scrollTo({ top: 0 });
    if (window.matchMedia("(max-width: 767px)").matches) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeId, selectedId]);

  async function runLocate(sessionId: string, text: string) {
    setLocatingId(sessionId);
    setLocateError(null);
    try {
      const pos = await locateIdea(text, dataset);
      updateSession(sessionId, { location: { x: pos.x, y: pos.y } });
    } catch (err) {
      setLocateError({ id: sessionId, message: err instanceof Error ? err.message : "위치를 계산하지 못했습니다." });
    } finally {
      setLocatingId((cur) => (cur === sessionId ? null : cur));
    }
  }

  const subtitle =
    load === "ready"
      ? `${DATASET_LABEL.title} ${points.length.toLocaleString()}건 · 색인 ${builtAt ? formatDate(builtAt) : "없음"}`
      : load === "loading"
        ? `${DATASET_LABEL.title} 불러오는 중…`
        : `${DATASET_LABEL.title} · 불러오기 실패`;

  const step = activeSession?.step ?? 0;
  const caseList = linkedCases(resultPoints, ACTIVE_CASES);
  const selectedDensity = selected && resultPoints.length > 0 ? countWithin(resultPoints, selected, spanOf(resultPoints) * 0.06) : null;

  // 지도 영역: 홈과 세션의 탐색·검증 단계에서 같은 지도를 쓴다
  const mapSection = (
    <section aria-label="기술 지도" className="relative min-h-[60vh] flex-1 overflow-hidden rounded-3xl bg-panel md:m-4 md:min-h-0">
      {load === "ready" && points.length > 0 && (
        <PatentMap
          points={activeSession ? resultPoints : points}
          insetTop={96}
          visible={visible}
          highlights={activeSession ? resultScores : highlights}
          selectedId={selectedId}
          focus={focus}
          onSelect={select}
          riskOn={riskOn || (activeSession !== null && step === 2)}
          edgesOn={edgesOn}
          marker={location ? { x: location.x, y: location.y } : null}
        />
      )}

      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col gap-2 md:inset-x-4 md:top-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-panel/90 px-3 py-1.5 text-sm font-bold shadow-sm backdrop-blur-sm">기술 지도</span>
          {!activeSession && (
            <button
              type="button"
              onClick={() => {
                const hit = pickRandom(points);
                if (hit) pick(hit.id);
              }}
              disabled={points.length === 0}
              className="pointer-events-auto min-h-9 rounded-full bg-foreground px-3 text-sm font-semibold text-panel shadow-sm disabled:opacity-40"
            >
              오늘의 랜덤 특허 뽑기
            </button>
          )}
          <span className="rounded-full bg-panel/90 px-3 py-1.5 text-[13px] text-muted shadow-sm backdrop-blur-sm">{subtitle}</span>
        </div>
        {activeDecisions.length > 0 && (
          <div role="group" aria-label="심사 결과 필터" className="pointer-events-auto flex flex-wrap gap-1.5">
            {activeDecisions.map((d) => {
              const on = visible.has(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDecision(d)}
                  className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold shadow-sm backdrop-blur-sm transition ${
                    on ? "bg-panel/95 text-foreground" : "bg-panel/60 text-muted line-through"
                  }`}
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: DECISION_COLORS[d], opacity: on ? 1 : 0.4 }} />
                  {DECISION_LABELS[d]} {counts[d].toLocaleString()}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={riskOn}
              onClick={() => setRiskOn((v) => !v)}
              className={`min-h-9 rounded-full px-3 text-[13px] font-semibold shadow-sm ${riskOn ? "bg-foreground text-panel" : "bg-panel/95 text-muted"}`}
            >
              위험도 배경
            </button>
            <button
              type="button"
              aria-pressed={edgesOn}
              onClick={() => setEdgesOn((v) => !v)}
              className={`min-h-9 rounded-full px-3 text-[13px] font-semibold shadow-sm ${edgesOn ? "bg-foreground text-panel" : "bg-panel/95 text-muted"}`}
            >
              관계선
            </button>
            {highlights && (
              <button type="button" onClick={() => setHighlights(null)} className="min-h-9 rounded-full bg-panel/95 px-3 text-[13px] font-semibold text-muted shadow-sm">
                하이라이트 해제 ({highlights.size})
              </button>
            )}
          </div>
        )}
      </div>

      {!activeSession && (
        <div className="absolute inset-x-3 bottom-3 z-10 md:inset-x-6 md:bottom-6">
          <NewChatBar onSubmit={createSession} />
        </div>
      )}

      {load === "loading" && <Center>특허 지도를 불러오는 중이에요</Center>}
      {load === "error" && (
        <Center>
          <p className="mb-2 text-[17px] font-bold">데이터를 불러오지 못했어요</p>
          {loadError && <p className="mb-3 text-sm text-muted">{loadError}</p>}
          <button type="button" onClick={retry} className={SECONDARY_BUTTON}>다시 시도</button>
        </Center>
      )}
      {empty && (
        <Center>
          <p className="mb-2 text-[17px] font-bold">한국 특허 색인이 아직 없어요</p>
          <p className="mb-3 text-sm text-ink-2">
            {liveSearch ? "탐색 단계에서 검색하면 KIPRIS를 실시간으로 조회해 지도를 채웁니다." : "시연은 pnpm dev:demo로 실행하세요."}
          </p>
          <button type="button" onClick={retry} className={SECONDARY_BUTTON}>다시 불러오기</button>
        </Center>
      )}
    </section>
  );

  return (
    <main className="flex min-h-full w-full flex-col md:h-full md:flex-row">
      <Dashboard sessions={sortSessions(sessions)} activeId={activeId} onNew={goHome} onOpen={openSession} />

      {!activeSession && (
        <div className="flex min-w-0 flex-1 flex-col p-3 md:h-full md:flex-row">
          {mapSection}
          {selected && (
            <div ref={homeDetailRef} className="w-full scroll-mt-3 p-1 pt-3 md:w-[420px] md:shrink-0 md:overflow-y-auto md:p-4">
              <PatentDetail
                key={selected.id}
                point={selected}
                dataset={dataset}
                onClose={() => setSelectedId(null)}
                canCompare={false}
                aiReady={aiReady}
                onCompare={() => {}}
                backLabel="지도로 돌아가기"
              />
            </div>
          )}
        </div>
      )}

      {activeSession && (
        <div className="flex min-w-0 flex-1 flex-col md:h-full">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-background bg-panel/80 px-4 py-3 backdrop-blur-md md:px-6">
            {/* 폰에서는 세션 목록(사이드바)이 숨겨지므로 홈으로 가는 길을 헤더에 둔다. 폰은 이 줄이 한 줄을 다 쓰고 단계 표시는 다음 줄로 내려간다 */}
            <div className="flex min-w-0 basis-full items-center gap-1 md:basis-auto">
              <button
                type="button"
                onClick={goHome}
                className="-ml-2 flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-[15px] font-semibold text-ink-2 hover:bg-background md:hidden"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.5 4.5L7 10l5.5 5.5" />
                </svg>
                홈
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-bold">{activeSession.name}</div>
                <div className="truncate text-[12px] text-muted">{subtitle}</div>
              </div>
            </div>
            <Stepper reached={activeSession.step} current={activeSession.step} onGo={goStep} />
          </header>

          {step === 0 && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <InputStep key={activeSession.id} session={activeSession} onConfirm={confirmTemplate} />
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
              <div ref={leftRef} className="w-full space-y-4 overflow-y-auto p-4 md:w-[440px] md:shrink-0 md:p-6">
                <div className="rounded-2xl bg-panel p-4 text-[13px]">
                  <div className="text-[12px] text-muted">조회 조건 (입력 단계의 템플릿)</div>
                  <div className="mt-1 font-semibold">{activeSession.tpl?.item ?? "-"}</div>
                  <div className="text-muted">핵심 기술: {activeSession.tpl?.tech || "-"} · 대상: {activeSession.tpl?.target || "-"} · 우려 분야: {activeSession.tpl?.risk || "-"}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={queryBusy || !activeSession.tpl}
                      onClick={() => activeSession.tpl && void runQuery(activeSession.id, activeSession.tpl)}
                      className="min-h-9 rounded-full bg-foreground px-3 font-semibold text-panel disabled:opacity-40"
                    >
                      {queryBusy ? "조회 중…" : results ? "다시 조회" : "조회 실행"}
                    </button>
                    {locating && <span className="text-muted">내 위치 계산 중…</span>}
                  </div>
                  {sessionQueryError && <p role="alert" className="mt-2 text-[#d22030]">{sessionQueryError}</p>}
                  {sessionLocateError && <p className="mt-2 text-muted">내 위치: {sessionLocateError}</p>}
                </div>
                {results && (
                  <ExploreReport
                    results={resultPoints}
                    scores={resultScores ?? new Map()}
                    location={location ? { x: location.x, y: location.y } : null}
                    onPick={pick}
                    onRegion={(r) => {
                      const nearest = [...resultPoints].sort((p, q) => Math.hypot(p.x - r.x, p.y - r.y) - Math.hypot(q.x - r.x, q.y - r.y))[0];
                      if (nearest) pick(nearest.id);
                    }}
                  />
                )}
                {selected && (
                  <PatentDetail
                    key={selected.id}
                    point={selected}
                    dataset={dataset}
                    score={resultScores?.get(selected.id)}
                    onClose={() => setSelectedId(null)}
                    comparison={sessionComparisons?.get(selected.id)}
                    canCompare={detailIdea.length >= 5 && aiReady}
                    aiReady={aiReady}
                    idea={detailIdea}
                    onCompare={() => {
                      if (detailIdea !== comparisonIdea) startComparisons(detailIdea);
                      compare(selected.id, detailIdea);
                    }}
                  />
                )}
                <div className="flex justify-end">
                  <button type="button" disabled={!results} onClick={() => goStep(2)} className="min-h-11 rounded-xl bg-foreground px-5 font-semibold text-panel disabled:opacity-40">검증으로 →</button>
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col">{mapSection}</div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
              <div className="w-full space-y-4 overflow-y-auto p-4 md:w-[420px] md:shrink-0 md:p-6">
                {!results ? (
                  <p className="rounded-2xl bg-panel p-4 text-[13px] text-muted">탐색 단계에서 조회를 먼저 실행하세요.</p>
                ) : (
                  <VerifyReport results={resultPoints} selectedDensity={selectedDensity} />
                )}
                <div className="flex justify-between">
                  <button type="button" onClick={() => goStep(1)} className="min-h-11 rounded-xl bg-background px-4 font-semibold">← 탐색</button>
                  <button type="button" onClick={() => goStep(3)} className="min-h-11 rounded-xl bg-foreground px-5 font-semibold text-panel">요약 만들기 →</button>
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col">{mapSection}</div>
            </div>
          )}

          {step === 3 && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <ReportPanel session={activeSession} hits={resultPoints} cases={caseList} location={location ? { x: location.x, y: location.y } : null} />
              <div className="mx-auto mt-4 flex max-w-2xl justify-start">
                <button type="button" onClick={() => goStep(2)} className="min-h-10 rounded-xl bg-background px-4 font-semibold">← 검증</button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function spanOf(points: readonly PatentPoint[]): number {
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

function isComparison(v: unknown): v is PatentComparison {
  if (typeof v !== "object" || v === null) return false;
  const c = v as { patentId?: unknown; rows?: unknown; proximity?: unknown };
  return typeof c.patentId === "string" && Array.isArray(c.rows) && typeof c.proximity === "object" && c.proximity !== null;
}

const SECONDARY_BUTTON = "min-h-10 rounded-xl bg-background px-4 text-sm font-semibold text-ink-2 hover:bg-border";

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 pt-28 text-center text-sm md:p-8">
      <div className="max-w-md rounded-3xl bg-panel/95 p-6 shadow-sm">{children}</div>
    </div>
  );
}
