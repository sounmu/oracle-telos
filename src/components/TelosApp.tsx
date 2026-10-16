"use client";

import { useEffect, useMemo, useState } from "react";
import PatentMap from "./PatentMap";
import SearchPanel from "./SearchPanel";
import PatentDetail from "./PatentDetail";
import { formatDate, readErrorMessage } from "./ResearchReferences";
import { DECISION_COLORS, DECISION_LABELS } from "@/lib/colors";
import {
  DECISIONS,
  type Decision,
  type PatentDataset,
  type PatentMapResponse,
  type PatentPoint,
  type ResearchStatus,
  type SearchHit,
} from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

const DATASETS: PatentDataset[] = ["korea", "sample"];

// 지도 위 헤더·데이터셋 선택·범례(하이라이트 해제 포함) 오버레이의 최대 높이. 점이 그 아래에 놓이게 한다
const MAP_OVERLAY_INSET = 184;

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
  const [load, setLoad] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [idea, setIdea] = useState("");
  const [visible, setVisible] = useState<Set<Decision>>(() => new Set(DECISIONS));
  const [highlights, setHighlights] = useState<Map<string, number> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null);

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
  // 키가 있으면 빈 색인에서도 검색이 실시간 결과로 지도를 채운다.
  const liveSearch = dataset === "korea" && kipris?.configured === true;

  // 진행 중 요청은 effect cleanup이, SearchPanel의 요청은 key={dataset} 재마운트가 중단한다
  function resetForLoad() {
    setLoad("loading");
    setLoadError(null);
    setPoints([]);
    setBuiltAt(null);
    setStatus(null);
    setVisible(new Set(DECISIONS));
    setHighlights(null);
    setSelectedId(null);
    setFocus(null);
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

  function pick(id: string) {
    setSelectedId(id);
    setFocus({ id, nonce: Date.now() });
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
      <section className="relative h-[44dvh] min-h-60 w-full min-w-0 shrink-0 md:h-auto md:min-h-0 md:flex-1">
        {load === "ready" && points.length > 0 && (
          <PatentMap
            points={points}
            insetTop={MAP_OVERLAY_INSET}
            visible={visible}
            highlights={highlights}
            selectedId={selectedId}
            focus={focus}
            onSelect={setSelectedId}
          />
        )}

        <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col gap-2 md:left-4 md:top-4 md:gap-3">
          {/* 지도 점이 제목 아래로 지나가도 글자가 읽히도록 반투명 배경을 둔다 */}
          <div className="rounded-md bg-background/70 backdrop-blur-sm">
            <h1 className="text-lg font-bold tracking-tight md:text-xl">
              Telos <span className="text-sm font-normal text-muted">AI 특허 탐색기</span>
            </h1>
            <p className="text-xs text-muted">{subtitle}</p>
            <p className="text-[11px] text-muted/80">{note}</p>
          </div>

          <div
            role="group"
            aria-label="특허 데이터셋 선택"
            className="pointer-events-auto inline-flex w-fit rounded-full border border-border bg-panel/90 p-0.5 text-xs backdrop-blur-sm"
          >
            {DATASETS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={dataset === d}
                onClick={() => selectDataset(d)}
                className={`rounded-full px-2.5 py-1 transition ${
                  dataset === d
                    ? "bg-accent font-semibold text-background"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {DATASET_LABELS[d].tab}
              </button>
            ))}
          </div>

          {activeDecisions.length > 0 && (
            <div
              role="group"
              aria-label="심사 결과 필터"
              className="pointer-events-auto flex flex-wrap gap-1.5"
            >
              {activeDecisions.map((d) => {
                const on = visible.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDecision(d)}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                      on
                        ? "border-border bg-panel/90 backdrop-blur-sm hover:border-accent/60"
                        : "border-transparent bg-panel/40 text-muted line-through backdrop-blur-sm hover:text-foreground"
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
              {highlights && (
                <button
                  type="button"
                  onClick={() => setHighlights(null)}
                  className="rounded-full border border-border bg-panel/90 px-2.5 py-1 text-xs text-muted backdrop-blur-sm hover:text-foreground"
                >
                  하이라이트 해제 ({highlights.size})
                </button>
              )}
            </div>
          )}
        </div>

        {load === "loading" && <Center>특허 지도를 불러오는 중…</Center>}

        {load === "error" && (
          <Center>
            <p className="mb-2 font-medium">데이터를 불러오지 못했습니다.</p>
            {loadError && <p className="mb-3 text-xs text-muted">{loadError}</p>}
            <button type="button" onClick={retry} className={SECONDARY_BUTTON}>
              다시 시도
            </button>
          </Center>
        )}

        {empty && dataset === "korea" && (
          <Center>
            <p className="mb-2 font-medium">한국 특허 색인이 아직 없습니다.</p>
            {liveSearch && (
              <p className="mb-3 text-xs text-muted">
                오른쪽에서 검색하면 KIPRIS를 실시간으로 조회해 지도를 채웁니다. 기본 지도를 미리
                만들려면 아래 순서를 따르세요.
              </p>
            )}
            <ol className="mx-auto mb-3 max-w-sm list-decimal space-y-1 pl-5 text-left text-xs text-muted">
              <li>
                <Code>.env</Code>에 <Code>KIPRIS_API_KEY</Code>를 설정합니다 (현재{" "}
                {kipris?.configured ? "설정됨" : "미설정"}).
              </li>
              <li>
                <Code>pnpm sync:korea --source kipris --query &quot;반려동물&quot;</Code>을
                실행합니다.
              </li>
              <li>아래 버튼으로 다시 불러옵니다.</li>
            </ol>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={retry} className={SECONDARY_BUTTON}>
                다시 불러오기
              </button>
              <button
                type="button"
                onClick={() => selectDataset("sample")}
                className={SECONDARY_BUTTON}
              >
                미국 USPTO 샘플로 보기
              </button>
            </div>
          </Center>
        )}

        {empty && dataset === "sample" && (
          <Center>
            <p className="mb-2 font-medium">미국 샘플 데이터가 아직 없습니다.</p>
            <p className="text-muted">
              터미널에서 <Code>pnpm build:data</Code> 를 실행한 뒤 새로고침하세요.
            </p>
          </Center>
        )}

        {selected && (
          <PatentDetail
            key={selected.id}
            point={selected}
            dataset={dataset}
            score={highlights?.get(selected.id)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </section>

      <aside className="flex w-full flex-1 flex-col border-t border-border bg-panel md:min-h-0 md:w-[380px] md:flex-none md:border-l md:border-t-0 lg:w-[440px]">
        <SearchPanel
          key={dataset}
          dataset={dataset}
          status={status}
          disabled={load !== "ready" || (points.length === 0 && !liveSearch)}
          idea={idea}
          onIdeaChange={setIdea}
          onMatches={handleMatches}
          onPointsAdded={handlePointsAdded}
          onPick={pick}
          selectedId={selectedId}
        />
      </aside>
    </main>
  );
}

const SECONDARY_BUTTON =
  "rounded-lg border border-border bg-panel/90 px-3 py-1.5 text-xs hover:border-accent";

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">{children}</code>;
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 pt-28 text-center text-sm md:p-8">
      <div>{children}</div>
    </div>
  );
}
