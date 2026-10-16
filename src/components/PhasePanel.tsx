"use client";

import { useMemo, useState } from "react";
import { DISPUTE_CASES } from "@/lib/cases";
import { DECISION_COLORS, DECISION_LABELS } from "@/lib/colors";
import {
  compareTerms,
  countWithin,
  emptyRegions,
  estimatePosition,
  linkedCases,
  mapOverview,
  PHASES,
  type Neighbor,
  type Phase,
} from "@/lib/phaseFeatures";
import type { PatentDataset, PatentPoint } from "@/lib/types";

export interface Location {
  x: number;
  y: number;
  neighbors: Neighbor[];
}

interface Props {
  phase: Phase;
  onPhase: (phase: Phase) => void;
  points: PatentPoint[];
  idea: string;
  dataset: PatentDataset;
  /** 검색 결과로 하이라이트된 특허 id */
  hitIds: string[];
  selectedId: string | null;
  location: Location | null;
  onLocated: (location: Location | null) => void;
  onFocusPoint: (id: string) => void;
  onPickTopic: (key: string) => void;
}

/** 지도 폭의 약 6%를 밀집도 반경으로 쓴다 */
function radiusOf(points: PatentPoint[]): number {
  if (points.length === 0) return 0;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.06;
}

export default function PhasePanel(props: Props) {
  const { phase, onPhase, points, idea, dataset, hitIds, selectedId, location, onLocated, onFocusPoint, onPickTopic } = props;
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const byId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const hits = hitIds.map((id) => byId.get(id)).filter((p): p is PatentPoint => Boolean(p));

  async function locate() {
    const text = idea.trim();
    if (text.length < 5) {
      setError("아이디어를 5자 이상 입력한 뒤 위치를 계산하세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/locate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: text, k: 8, dataset }),
      });
      const body = (await res.json().catch(() => null)) as { neighbors?: Neighbor[]; error?: string } | null;
      if (!res.ok || !body?.neighbors) throw new Error(body?.error ?? `HTTP ${res.status}`);
      const pos = estimatePosition(body.neighbors);
      if (!pos) throw new Error("가까운 특허를 찾지 못해 위치를 계산할 수 없습니다.");
      onLocated({ x: pos.x, y: pos.y, neighbors: body.neighbors });
    } catch (err) {
      setError(err instanceof Error ? err.message : "위치를 계산하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="사업 단계 기능" className="pointer-events-auto rounded-2xl bg-panel/95 p-3 text-[13px] shadow-sm backdrop-blur-sm md:max-w-md">
      <div role="tablist" aria-label="사업 단계" className="grid grid-cols-3 gap-1 rounded-xl bg-background p-1">
        {PHASES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={phase === p.id}
            onClick={() => onPhase(p.id)}
            className={`min-h-8 rounded-lg px-2 font-semibold ${phase === p.id ? "bg-panel text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-muted">{PHASES.find((p) => p.id === phase)?.question}</p>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-full bg-background px-2.5 py-0.5 text-muted hover:text-foreground"
        >
          {open ? "접기" : "펼치기"}
        </button>
      </div>

      <div className={open ? "max-h-[40vh] overflow-y-auto pr-1" : "hidden"}>

      {phase === "explore" && (
        <div className="mt-2 space-y-2">
          <Overview points={points} onPickTopic={onPickTopic} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={locate} disabled={busy} className="min-h-8 rounded-full bg-foreground px-3 font-semibold text-panel disabled:opacity-50">
              {busy ? "위치 계산 중…" : "내 아이디어 위치 계산"}
            </button>
            {location && (
              <button type="button" onClick={() => onLocated(null)} className="min-h-8 rounded-full bg-background px-3 text-muted">
                위치 지우기
              </button>
            )}
          </div>
          {location && (
            <ol className="space-y-1">
              <li className="text-muted">지도에 표시한 위치 주변의 가까운 특허</li>
              {location.neighbors.slice(0, 5).map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => onFocusPoint(n.id)} className="w-full text-left hover:underline">
                    {n.title.slice(0, 60)} <span className="text-muted">· 유사도 {n.score.toFixed(2)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {phase === "explore" && (
        <div className="mt-2 space-y-2">
          <p className="text-muted">
            {location ? "내 위치에서 가까운 빈 자리" : "주변에 특허가 있는 빈 자리 (위치를 계산하면 내 근처로 좁힙니다)"}
          </p>
          <ol className="space-y-2">
            {emptyRegions(points, location ? { x: location.x, y: location.y } : null, 5).map((r, i) => (
              <li key={`${r.x}-${r.y}`}>
                <button type="button" onClick={() => onFocusPoint(r.around[0].id)} className="w-full rounded-lg bg-background p-2 text-left hover:underline">
                  빈 자리 {i + 1} · 주변: {r.around.map((a) => a.title.slice(0, 28)).join(" / ")}
                </button>
              </li>
            ))}
          </ol>
          <p className="text-muted">빈 자리는 기회의 후보일 뿐이며, 실제 사업성은 따로 확인해야 합니다.</p>
        </div>
      )}

      {phase === "verify" && (
        <div className="mt-2 space-y-2">
          {!selected && <p className="text-muted">지도나 목록에서 특허 한 건을 고르면, 내 아이디어와 용어를 비교합니다.</p>}
          {selected && <VerifyBlock idea={idea} patent={selected} />}
        </div>
      )}

      {phase === "risk" && (
        <RiskBlock
          hits={hits}
          selected={selected}
          location={location}
          points={points}
        />
      )}

      {error && <p role="alert" className="mt-2 text-[#d22030]">{error}</p>}
      </div>
    </section>
  );
}

function Overview({ points, onPickTopic }: { points: PatentPoint[]; onPickTopic: (key: string) => void }) {
  const o = mapOverview(points);
  const maxYear = Math.max(1, ...o.years.map((y) => y.count));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <span className="font-semibold">총 {o.total.toLocaleString()}건</span>
        {(Object.keys(o.byDecision) as (keyof typeof o.byDecision)[]).map((d) => (
          <span key={d} className="text-muted">
            <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: DECISION_COLORS[d] }} />
            {DECISION_LABELS[d]} {o.byDecision[d].toLocaleString()}
          </span>
        ))}
      </div>
      <div>
        <div className="text-muted">많은 분야 (누르면 주제 세션)</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {o.topCpc.map((c) => (
            <button key={c.key} type="button" onClick={() => onPickTopic(c.key)} className="rounded-full bg-background px-2 py-0.5 hover:text-foreground">
              {c.key} · {c.count}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-muted">출원 연도별 추이</div>
        <ul className="mt-1 space-y-0.5">
          {o.years.map((y) => (
            <li key={y.year} className="flex items-center gap-2">
              <span className="w-10 tabular-nums text-muted">{y.year}</span>
              <span className="h-2 rounded bg-foreground" style={{ width: `${(y.count / maxYear) * 100}%`, minWidth: 2 }} />
              <span className="tabular-nums text-muted">{y.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function VerifyBlock({ idea, patent }: { idea: string; patent: PatentPoint }) {
  const cmp = compareTerms(idea, `${patent.title} ${patent.abstract}`);
  return (
    <div className="space-y-2">
      <div className="font-semibold">{patent.title.slice(0, 80)}</div>
      <div className="text-muted">
        {DECISION_LABELS[patent.decision]} · {patent.cpc || "CPC 없음"} · {patent.filed}
      </div>
      {idea.trim().length === 0 ? (
        <p className="text-muted">아이디어를 입력하면 용어를 비교합니다.</p>
      ) : (
        <>
          <div>
            <span className="text-muted">공통 용어 ({cmp.shared.length})</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {cmp.shared.map((t) => <span key={t} className="rounded-full bg-background px-2 py-0.5">{t}</span>)}
              {cmp.shared.length === 0 && <span className="text-muted">없음</span>}
            </div>
          </div>
          <div>
            <span className="text-muted">내 아이디어에만 있고 특허에서 확인되지 않은 용어 ({cmp.notFound.length})</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {cmp.notFound.map((t) => <span key={t} className="rounded-full bg-background px-2 py-0.5 text-muted">{t}</span>)}
              {cmp.notFound.length === 0 && <span className="text-muted">없음</span>}
            </div>
          </div>
          <p className="text-muted">용어 비교는 단어 기준입니다. 권리 범위나 기술의 동일성을 판단하지 않습니다.</p>
        </>
      )}
    </div>
  );
}

function RiskBlock({
  hits,
  selected,
  location,
  points,
}: {
  hits: PatentPoint[];
  selected: PatentPoint | null;
  location: Location | null;
  points: PatentPoint[];
}) {
  const cases = linkedCases(hits, DISPUTE_CASES);
  const origin = location ?? (selected ? { x: selected.x, y: selected.y } : null);
  const density = origin ? countWithin(points, origin, radiusOf(points)) : null;
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg bg-background px-3 py-2">
          <div className="text-muted">주변 특허 밀집</div>
          <div className="text-lg font-semibold tabular-nums">{density === null ? "–" : `${density}건`}</div>
          <div className="text-[11px] text-muted">{origin ? "위치나 선택한 특허 주변" : "위치를 계산하거나 특허를 고르세요"}</div>
        </div>
        <div className="rounded-lg bg-background px-3 py-2">
          <div className="text-muted">연결된 분쟁 사례</div>
          <div className="text-lg font-semibold tabular-nums">{cases.length}건</div>
          <div className="text-[11px] text-muted">검색 결과 특허와 키워드 2개 이상 겹침</div>
        </div>
      </div>
      {cases.length > 0 && (
        <ul className="space-y-1">
          {cases.slice(0, 5).map((c) => (
            <li key={c.id}>{c.title} <span className="text-muted">· 겹친 특허 {c.count}건</span></li>
          ))}
        </ul>
      )}
      <p className="text-muted">밀집도와 사례 수는 따로 보여 줍니다. 두 값을 합친 위험 점수는 계산식을 검증한 뒤에 보여 줍니다.</p>
    </div>
  );
}
