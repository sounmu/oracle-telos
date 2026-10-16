"use client";

import { useEffect, useMemo, useState } from "react";
import PatentMap from "./PatentMap";
import SearchPanel from "./SearchPanel";
import PatentDetail from "./PatentDetail";
import { DECISION_COLORS, DECISION_LABELS } from "@/lib/colors";
import { DECISIONS, type Decision, type PatentPoint, type SearchHit } from "@/lib/types";

type LoadState = "loading" | "ready" | "missing" | "error";

export default function TelosApp() {
  const [points, setPoints] = useState<PatentPoint[]>([]);
  const [load, setLoad] = useState<LoadState>("loading");
  const [visible, setVisible] = useState<Set<Decision>>(() => new Set(DECISIONS));
  const [highlights, setHighlights] = useState<Map<string, number> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null);

  useEffect(() => {
    fetch("/data/patents.json")
      .then(async (r) => {
        if (r.status === 404) {
          setLoad("missing");
          return;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as PatentPoint[];
        setPoints(data);
        setLoad("ready");
      })
      .catch(() => setLoad("error"));
  }, []);

  const byId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);
  const counts = useMemo(() => {
    const c: Record<Decision, number> = { ACCEPTED: 0, REJECTED: 0, PENDING: 0 };
    for (const p of points) c[p.decision]++;
    return c;
  }, [points]);

  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  function toggleDecision(d: Decision) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(d)) {
        if (next.size === 1) return prev; // 최소 하나는 남김
        next.delete(d);
      } else next.add(d);
      return next;
    });
  }

  function handleMatches(hits: SearchHit[], replace: boolean) {
    setHighlights((prev) => {
      const next = replace || !prev ? new Map<string, number>() : new Map(prev);
      for (const h of hits) next.set(h.id, Math.max(next.get(h.id) ?? 0, h.score));
      return next;
    });
  }

  function pick(id: string) {
    setSelectedId(id);
    setFocus({ id, nonce: Date.now() });
  }

  return (
    <main className="flex h-full w-full">
      <section className="relative min-w-0 flex-1">
        {load === "ready" && (
          <PatentMap
            points={points}
            visible={visible}
            highlights={highlights}
            selectedId={selectedId}
            focus={focus}
            onSelect={setSelectedId}
          />
        )}

        {/* 헤더 + 범례 */}
        <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Telos <span className="text-sm font-normal text-muted">AI 특허 탐색기</span>
            </h1>
            <p className="text-xs text-muted">
              USPTO 2016.01 출원 샘플 {points.length.toLocaleString()}건 · 가까울수록 비슷한 기술
            </p>
          </div>
          <div className="pointer-events-auto flex gap-1.5">
            {DECISIONS.map((d) => {
              const on = visible.has(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDecision(d)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                    on ? "border-border bg-panel/90" : "border-transparent bg-panel/40 text-muted line-through"
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
                className="rounded-full border border-border bg-panel/90 px-2.5 py-1 text-xs text-muted hover:text-foreground"
              >
                하이라이트 해제 ({highlights.size})
              </button>
            )}
          </div>
        </div>

        {load === "loading" && (
          <Center>특허 지도를 불러오는 중…</Center>
        )}
        {load === "missing" && (
          <Center>
            <p className="mb-2 font-medium">특허 데이터가 아직 없습니다.</p>
            <p className="text-muted">
              터미널에서 <code className="rounded bg-white/10 px-1.5 py-0.5">pnpm build:data</code>{" "}
              를 실행한 뒤 새로고침하세요.
            </p>
          </Center>
        )}
        {load === "error" && <Center>데이터를 불러오지 못했습니다.</Center>}

        {selected && (
          <PatentDetail
            key={selected.id}
            point={selected}
            score={highlights?.get(selected.id)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </section>

      <aside className="flex w-[440px] shrink-0 flex-col border-l border-border bg-panel">
        <SearchPanel
          disabled={load !== "ready"}
          onMatches={handleMatches}
          onPick={pick}
          selectedId={selectedId}
        />
      </aside>
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm">
      <div>{children}</div>
    </div>
  );
}
