"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PatentMap, { type MapMarker } from "./PatentMap";
import SearchPanel from "./SearchPanel";
import PatentDetail from "./PatentDetail";
import CasePanel from "./CasePanel";
import { ProximityBadge } from "./Comparison";
import { formatDate, readErrorMessage } from "./ResearchReferences";
import { DISPUTE_CASES } from "@/lib/cases";
import { locateCases } from "@/lib/caseMap";
import { DECISION_COLORS, DECISION_LABELS, DECISION_TAG_STYLES } from "@/lib/colors";
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
/** 폰(md 미만)에서 왼쪽 열과 지도 중 무엇을 보여 줄지. md 이상에서는 둘 다 보인다 */
type MobileView = "list" | "map";

// MVP는 국내 데이터만 보여 준다. 미국 USPTO 샘플(sample)은 화면에서만 뺐고 API·데이터 파이프라인은 그대로 둔다.
// 다시 보이려면 여기에 "sample"을 더하면 데이터셋 토글이 돌아온다
const DATASETS: PatentDataset[] = ["korea"];

// 지도 위 제목·범례(하이라이트 해제 포함) 오버레이의 최대 높이. 점이 그 아래에 놓이게 한다
const MAP_OVERLAY_INSET = 104;

// 미국 샘플을 한국 데이터처럼 보이게 하는 라벨은 금지한다
const DATASET_LABELS: Record<PatentDataset, { tab: string; title: string; note: string }> = {
  korea: { tab: "한국 KIPRIS", title: "KIPRIS 한국 특허", note: "검색할 때 KIPRIS를 조회해 색인에 더합니다" },
  sample: {
    tab: "미국 USPTO 샘플",
    title: "USPTO 2016.01 출원 샘플",
    note: "미국 특허 · 영어 원문 · 실시간 조회 없음",
  },
};

export default function TelosApp() {
  const [dataset, setDataset] = useState<PatentDataset>("korea");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [points, setPoints] = useState<PatentPoint[]>([]);
  const [builtAt, setBuiltAt] = useState<string | null>(null);
  const [status, setStatus] = useState<ResearchStatus | null>(null);
  // null은 아직 모름. 키가 없다고 확인된 경우에만 AI 기능을 끈다
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [load, setLoad] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [idea, setIdea] = useState("");
  const [visible, setVisible] = useState<Set<Decision>>(() => new Set(DECISIONS));
  const [highlights, setHighlights] = useState<Map<string, number> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [showCases, setShowCases] = useState(true);
  // 비교는 마지막으로 검색한 기술 설명 기준이다. 새 검색·데이터셋 전환 시 진행 중 요청과 함께 버린다.
  const [comparisonIdea, setComparisonIdea] = useState("");
  const [comparisons, setComparisons] = useState<Map<string, ComparisonState>>(() => new Map());
  const compareAbortRef = useRef<AbortController | null>(null);
  const requestedRef = useRef(new Set<string>());
  const leftRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => compareAbortRef.current?.abort(), []);

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

  const byId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);
  const counts = useMemo(() => {
    const c: Record<Decision, number> = { ACCEPTED: 0, REJECTED: 0, PENDING: 0, UNKNOWN: 0 };
    for (const p of points) c[p.decision]++;
    return c;
  }, [points]);
  const activeDecisions = DECISIONS.filter((d) => counts[d] > 0);

  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const kipris = status?.sources.find((s) => s.source === "kipris") ?? null;
  const label = DATASET_LABELS[dataset];
  const empty = load === "ready" && points.length === 0;
  const detailIdea = comparisonIdea || idea.trim();
  // 키가 있으면 빈 색인에서도 검색이 실시간 결과로 지도를 채운다.
  const liveSearch = dataset === "korea" && kipris?.configured === true;
  const aiReady = aiConfigured !== false;

  // 분쟁 사례 핀: 사례 키워드가 2개 이상 겹친 지도 점 묶음의 한가운데 (src/lib/caseMap.ts)
  const caseById = useMemo(() => new Map(DISPUTE_CASES.map((c) => [c.id, c])), []);
  const caseLocations = useMemo(() => locateCases(points, DISPUTE_CASES), [points]);
  const locatedCaseIds = useMemo(() => new Set(caseLocations.map((l) => l.caseId)), [caseLocations]);
  const markers = useMemo<MapMarker[]>(
    () =>
      caseLocations.flatMap((l) => {
        const c = caseById.get(l.caseId);
        return c ? [{ id: c.id, anchorId: l.anchorId, label: `${c.plaintiff} vs ${c.defendant}`, detail: c.tech }] : [];
      }),
    [caseLocations, caseById],
  );
  const activeLocation = activeCaseId ? caseLocations.find((l) => l.caseId === activeCaseId) ?? null : null;
  const activeCase = activeLocation ? caseById.get(activeLocation.caseId) ?? null : null;
  // 사례를 고르면 검색 하이라이트 대신 겹친 특허를 강조한다. 지도는 값이 클수록 점을 크게 그린다
  const caseHighlights = useMemo(
    () => (activeLocation ? new Map([...activeLocation.matches].map(([id, n]) => [id, 0.4 + 0.1 * n])) : null),
    [activeLocation],
  );
  const caseMatches = activeLocation
    ? [...activeLocation.matches].flatMap(([id, shared]) => {
        const point = byId.get(id);
        return point ? [{ point, shared }] : [];
      })
    : [];

  // 진행 중 요청은 effect cleanup이, SearchPanel의 요청은 key={dataset} 재마운트가 중단한다
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
    setActiveCaseId(null);
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
    const update = (state: ComparisonState) =>
      setComparisons((prev) => new Map(prev).set(id, state));
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

  function selectDataset(next: PatentDataset) {
    if (next === dataset) return;
    setDataset(next);
    resetForLoad();
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

  function handleMatches(hits: SearchHit[], replace: boolean) {
    setHighlights((prev) => {
      const next = replace || !prev ? new Map<string, number>() : new Map(prev);
      for (const h of hits) next.set(h.id, Math.max(next.get(h.id) ?? 0, h.score));
      return next.size > 0 ? next : null;
    });
  }

  function handlePointsAdded(incoming: PatentPoint[]) {
    setPoints((prev) => {
      const merged = new Map(prev.map((p) => [p.id, p]));
      for (const p of incoming) merged.set(p.id, p);
      return [...merged.values()];
    });
  }

  // 상세는 왼쪽 열에 열리므로 열(폰은 문서)의 맨 위로 올린다
  function scrollToTop() {
    leftRef.current?.scrollTo({ top: 0 });
    if (window.matchMedia("(max-width: 767px)").matches) window.scrollTo({ top: 0 });
  }

  function pick(id: string) {
    setSelectedId(id);
    setFocus({ id, nonce: Date.now() });
    scrollToTop();
  }

  function select(id: string | null) {
    setSelectedId(id);
    if (id) scrollToTop();
  }

  // 폰 지도 화면의 미리보기 카드에서 상세(비교)로 넘어간다
  function openSelected() {
    setMobileView("list");
    scrollToTop();
  }

  // 사례 카드의 '지도에서 보기': 핀으로 카메라를 옮기고 왼쪽 열에 사례를 연다. 폰은 지도 화면으로 넘어간다
  function locateCase(caseId: string) {
    const loc = caseLocations.find((l) => l.caseId === caseId);
    if (!loc) return;
    setActiveCaseId(caseId);
    setSelectedId(null);
    setShowCases(true);
    setFocus({ id: loc.anchorId, nonce: Date.now() });
    setMobileView("map");
    scrollToTop();
  }

  // 지도에서 핀을 누름
  function selectCase(caseId: string) {
    setActiveCaseId(caseId);
    setSelectedId(null);
    scrollToTop();
  }

  const subtitle =
    load === "ready"
      ? `${label.title} ${points.length.toLocaleString()}건 · 색인 ${
          builtAt ? formatDate(builtAt) : "없음"
        } · 가까울수록 비슷한 기술`
      : load === "loading"
        ? `${label.title} 불러오는 중…`
        : `${label.title} · 불러오기 실패`;
  const note =
    dataset === "korea"
      ? `${label.note} · 실시간 조회 ${kipris ? (kipris.configured ? "가능" : "꺼짐 (API 키 없음)") : "확인 중"}`
      : label.note;

  return (
    <main className="flex min-h-full w-full flex-col md:h-full md:flex-row">
      {/* 왼쪽 열: 입력 → 결과 → 비교. md 이상에서는 이 열만 스크롤한다 */}
      <div
        ref={leftRef}
        className={`${mobileView === "map" ? "hidden" : "flex"} w-full flex-col md:flex md:h-full md:w-[520px] md:shrink-0 md:overflow-y-auto lg:w-[640px] xl:w-[720px] 2xl:w-[800px]`}
      >
        <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-1 pt-3 md:px-6">
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setActiveCaseId(null);
              }}
              className="min-h-10 text-xl font-extrabold tracking-tight"
            >
              Telos
            </button>
            <span className="hidden text-sm text-muted sm:inline">AI 특허 탐색기</span>
            {DATASETS.length > 1 && (
              <div
                role="group"
                aria-label="특허 데이터셋 선택"
                className="ml-auto inline-flex rounded-xl bg-panel p-1"
              >
                {DATASETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={dataset === d}
                    onClick={() => selectDataset(d)}
                    className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition ${
                      dataset === d ? "bg-foreground text-white" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {DATASET_LABELS[d].tab}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="px-4 pb-2 text-[13px] leading-relaxed text-muted md:px-6">
            {subtitle} · {note}
          </p>
        </header>

        <div className="flex-1 px-4 pb-28 md:px-6 md:pb-8">
          {/* 상세를 여는 동안에도 검색 상태(결과·답변·진행 중 요청)를 유지하려고 숨기기만 한다 */}
          <div className={selected || activeCase ? "hidden" : ""}>
            <SearchPanel
              key={dataset}
              dataset={dataset}
              status={status}
              disabled={load !== "ready" || (points.length === 0 && !liveSearch)}
              aiReady={aiReady}
              idea={idea}
              onIdeaChange={setIdea}
              onMatches={handleMatches}
              onPointsAdded={handlePointsAdded}
              comparisons={comparisons}
              onSearchStart={startComparisons}
              onCompare={compare}
              onPick={pick}
              selectedId={selectedId}
              locatableCases={locatedCaseIds}
              onLocateCase={locateCase}
            />
          </div>
          {!selected && activeCase && (
            <CasePanel item={activeCase} matches={caseMatches} onBack={() => setActiveCaseId(null)} onPick={pick} />
          )}
          {selected && (
            <PatentDetail
              key={selected.id}
              point={selected}
              dataset={dataset}
              score={highlights?.get(selected.id)}
              onClose={() => setSelectedId(null)}
              comparison={comparisons.get(selected.id)}
              canCompare={detailIdea.length >= 5 && aiReady}
              aiReady={aiReady}
              idea={detailIdea}
              locatableCases={locatedCaseIds}
              onLocateCase={locateCase}
              onCompare={() => {
                if (detailIdea !== comparisonIdea) startComparisons(detailIdea);
                compare(selected.id, detailIdea);
              }}
            />
          )}
        </div>
      </div>

      {/* 오른쪽: 기술 지도 (폰에서는 아래 버튼으로 전환하는 전체 화면) */}
      <section
        aria-label="기술 지도"
        className={`${mobileView === "map" ? "fixed inset-0 z-30" : "hidden"} overflow-hidden bg-panel md:relative md:inset-auto md:z-auto md:my-4 md:ml-0 md:mr-4 md:block md:flex-1 md:rounded-3xl`}
      >
        {load === "ready" && points.length > 0 && (
          <PatentMap
            points={points}
            insetTop={MAP_OVERLAY_INSET}
            visible={visible}
            highlights={caseHighlights ?? highlights}
            selectedId={selectedId}
            focus={focus}
            onSelect={select}
            markers={showCases ? markers : undefined}
            activeMarkerId={activeCaseId}
            onMarkerSelect={selectCase}
          />
        )}

        <div className="pointer-events-none absolute inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 flex flex-col gap-2 md:inset-x-4 md:top-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-panel/90 px-3 py-1.5 text-sm font-bold shadow-sm backdrop-blur-sm">기술 지도</span>
            <span className="rounded-full bg-panel/90 px-3 py-1.5 text-[13px] text-muted shadow-sm backdrop-blur-sm">
              가까울수록 비슷한 기술 · 점을 누르면 비교
            </span>
          </div>

          {activeDecisions.length > 0 && (
            <div
              role="group"
              aria-label="심사 결과 필터"
              className="scroll-row pointer-events-auto -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-2 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0"
            >
              {activeDecisions.map((d) => {
                const on = visible.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDecision(d)}
                    className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold shadow-sm backdrop-blur-sm transition ${
                      on ? "bg-panel/95 text-foreground hover:bg-panel" : "bg-panel/60 text-muted line-through hover:text-foreground"
                    }`}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: DECISION_COLORS[d], opacity: on ? 1 : 0.4 }}
                    />
                    {DECISION_LABELS[d]} {counts[d].toLocaleString()}
                  </button>
                );
              })}
              {markers.length > 0 && (
                <button
                  type="button"
                  aria-pressed={showCases}
                  onClick={() => setShowCases((v) => !v)}
                  className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold shadow-sm backdrop-blur-sm transition ${
                    showCases ? "bg-panel/95 text-foreground hover:bg-panel" : "bg-panel/60 text-muted line-through hover:text-foreground"
                  }`}
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#7c5cff]" style={{ opacity: showCases ? 1 : 0.4 }} />
                  분쟁 사례 {markers.length}
                </button>
              )}
              {activeCase ? (
                <button
                  type="button"
                  onClick={() => setActiveCaseId(null)}
                  className="min-h-9 shrink-0 rounded-full bg-panel/95 px-3 text-[13px] font-semibold text-muted shadow-sm backdrop-blur-sm hover:text-foreground"
                >
                  사례 강조 해제 ({activeLocation?.matches.size ?? 0})
                </button>
              ) : (
                highlights && (
                  <button
                    type="button"
                    onClick={() => setHighlights(null)}
                    className="min-h-9 shrink-0 rounded-full bg-panel/95 px-3 text-[13px] font-semibold text-muted shadow-sm backdrop-blur-sm hover:text-foreground"
                  >
                    하이라이트 해제 ({highlights.size})
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {load === "loading" && <Center>특허 지도를 불러오는 중이에요</Center>}

        {load === "error" && (
          <Center>
            <p className="mb-2 text-[17px] font-bold">데이터를 불러오지 못했어요</p>
            {loadError && <p className="mb-3 text-sm text-muted">{loadError}</p>}
            <button type="button" onClick={retry} className={SECONDARY_BUTTON}>
              다시 시도
            </button>
          </Center>
        )}

        {empty && dataset === "korea" && (
          <Center>
            <p className="mb-2 text-[17px] font-bold">한국 특허 색인이 아직 없어요</p>
            {liveSearch && (
              <p className="mb-3 text-sm text-ink-2">
                왼쪽에서 찾으면 KIPRIS를 실시간으로 조회해 지도를 채워요. 기본 지도를 미리 만들려면 아래 순서를 따르세요.
              </p>
            )}
            <ol className="mx-auto mb-4 max-w-sm list-decimal space-y-1 pl-5 text-left text-sm text-ink-2">
              <li>
                <Code>.env</Code>에 <Code>KIPRIS_API_KEY</Code>를 설정합니다 (현재 {kipris?.configured ? "설정됨" : "미설정"}).
              </li>
              <li>
                <Code>pnpm sync:korea --source kipris --query &quot;반려동물&quot;</Code>을 실행합니다.
              </li>
              <li>아래 버튼으로 다시 불러옵니다.</li>
            </ol>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={retry} className={SECONDARY_BUTTON}>
                다시 불러오기
              </button>
            </div>
          </Center>
        )}
      </section>

      {/* 폰 전용: 지도에서 고른 특허 미리보기 */}
      {mobileView === "map" && selected && (
        <div className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 rounded-3xl bg-panel p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)] md:hidden">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span
              className="rounded-md px-2 py-0.5 font-bold"
              style={{ background: DECISION_TAG_STYLES[selected.decision].bg, color: DECISION_TAG_STYLES[selected.decision].ink }}
            >
              {DECISION_LABELS[selected.decision]}
            </span>
            {selected.filed && <span>{selected.filed}</span>}
            <span className="ml-auto">
              <ProximityBadge state={comparisons.get(selected.id)} />
            </span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-[17px] font-bold leading-snug">{selected.title}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={openSelected}
              className="min-h-12 flex-1 rounded-2xl bg-accent px-4 text-[15px] font-bold text-white hover:bg-accent-strong"
            >
              {dataset === "korea" ? "내 기술과 비교 보기" : "자세히 보기"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="min-h-12 rounded-2xl bg-background px-4 text-[15px] font-semibold text-ink-2 hover:bg-border"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 폰 전용: 지도에서 고른 분쟁 사례 미리보기 */}
      {mobileView === "map" && !selected && activeCase && (
        <div className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 rounded-3xl bg-panel p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)] md:hidden">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f0edff] px-2 py-0.5 font-bold text-[#5b3df5]">
              <span className="inline-block h-2 w-2 rounded-full bg-[#7c5cff]" />
              분쟁 사례
            </span>
            <span>
              {activeCase.period.start}~{activeCase.period.end}
            </span>
            <span className="ml-auto">키워드 겹친 특허 {activeLocation?.matches.size ?? 0}건</span>
          </div>
          <p className="mt-1.5 text-[17px] font-bold leading-snug">
            {activeCase.plaintiff} vs {activeCase.defendant}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-muted">{activeCase.tech}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={openSelected}
              className="min-h-12 flex-1 rounded-2xl bg-[#5b3df5] px-4 text-[15px] font-bold text-white hover:brightness-110"
            >
              사례 자세히 보기
            </button>
            <button
              type="button"
              onClick={() => setActiveCaseId(null)}
              className="min-h-12 rounded-2xl bg-background px-4 text-[15px] font-semibold text-ink-2 hover:bg-border"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 폰 전용: 목록 ↔ 지도 전환. 지도에서 미리보기 카드가 떠 있으면 카드 버튼을 쓴다 */}
      {load === "ready" && points.length > 0 && !(mobileView === "map" && (selected || activeCase)) && (
        <button
          type="button"
          onClick={() => (mobileView === "map" ? openSelected() : setMobileView("map"))}
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex min-h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-5 text-[15px] font-bold text-white shadow-[0_8px_24px_rgba(0,0,0,0.2)] md:hidden"
        >
          {mobileView === "map" ? (
            <>
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 5.5h12M4 10h12M4 14.5h12" />
              </svg>
              목록 보기
            </>
          ) : (
            <>
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                <path d="M2.5 5l5-2 5 2 5-2v12l-5 2-5-2-5 2z M7.5 3v12 M12.5 5v12" />
              </svg>
              {selected || activeCase
                ? "지도에서 위치 보기"
                : highlights
                  ? `지도에서 ${highlights.size}건 보기`
                  : "지도 보기"}
            </>
          )}
        </button>
      )}
    </main>
  );
}

function isComparison(v: unknown): v is PatentComparison {
  if (typeof v !== "object" || v === null) return false;
  const c = v as { patentId?: unknown; rows?: unknown; proximity?: unknown };
  return typeof c.patentId === "string" && Array.isArray(c.rows) && typeof c.proximity === "object" && c.proximity !== null;
}

const SECONDARY_BUTTON =
  "min-h-10 rounded-xl bg-background px-4 text-sm font-semibold text-ink-2 hover:bg-border";

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-background px-1.5 py-0.5 text-[13px]">{children}</code>;
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 pt-28 text-center text-sm md:p-8">
      <div className="max-w-md rounded-3xl bg-panel/95 p-6 shadow-sm">{children}</div>
    </div>
  );
}
