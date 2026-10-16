"use client";

import { PROXIMITY_LABELS } from "@/lib/proximity";
import type { ComparisonState, PatentComparison, ProximityLevel, SearchHit } from "@/lib/types";
import { formatTemperature, PROXIMITY_STYLE, ProximityFace, temperatureOf } from "./Comparison";

const WORDS: Record<ProximityLevel, string> = {
  cool: "서늘해요",
  warm: "따뜻해요",
  hot: "뜨거워요",
  insufficient: "자료가 부족해요",
};

const ORDER: ProximityLevel[] = ["hot", "warm", "cool", "insufficient"];

interface Props {
  hits: SearchHit[];
  comparisons: ReadonlyMap<string, ComparisonState>;
  onPick: (id: string) => void;
}

/** 결과 맨 위 요약: 비교를 마친 특허 중 가장 가까운 특허 기준 근접도 온도 */
export default function ProximitySummary({ hits, comparisons, onPick }: Props) {
  const states = hits
    .map((hit) => ({ hit, state: comparisons.get(hit.id) }))
    .filter((x): x is { hit: SearchHit; state: ComparisonState } => x.state !== undefined);
  if (states.length === 0) return null;

  const ready = states.flatMap(({ hit, state }) =>
    state.status === "ready" ? [{ hit, data: state.data, t: temperatureOf(state.data) }] : [],
  );
  const loading = states.some(({ state }) => state.status === "loading");
  const failed = states.find(({ state }) => state.status === "error");

  let best: { hit: SearchHit; data: PatentComparison; t: number | null } | null = null;
  for (const item of ready) {
    if (!best || (item.t ?? -1) > (best.t ?? -1)) best = item;
  }

  return (
    <section aria-label="기술 근접도 온도" className="rounded-3xl bg-panel p-5 md:p-6">
      <p className="text-[15px] font-semibold text-ink-2">가장 가까운 특허와의 근접도는</p>
      {best ? (
        <Hero best={best} readyCount={ready.length} tally={tallyOf(ready.map((r) => r.data.proximity.level))} onPick={onPick} />
      ) : (
        <div className="mt-4 flex items-center gap-5">
          <ProximityFace level={loading ? "loading" : "idle"} size={120} />
          <div className="min-w-0">
            <div className="text-[52px] font-extrabold leading-none tracking-tight text-muted">--°</div>
            <div className="mt-1.5 text-xl font-bold">{loading ? "비교하는 중이에요" : "비교하지 못했어요"}</div>
            <p className="mt-1 text-[15px] text-muted">
              {loading
                ? "상위 특허를 원문과 대조하고 있어요"
                : failed?.state.status === "error"
                  ? failed.state.message
                  : "특허를 고르면 근접도를 계산해요"}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function tallyOf(levels: ProximityLevel[]): [ProximityLevel, number][] {
  return ORDER.map((level): [ProximityLevel, number] => [level, levels.filter((l) => l === level).length]).filter(
    ([, n]) => n > 0,
  );
}

function Hero({
  best,
  readyCount,
  tally,
  onPick,
}: {
  best: { hit: SearchHit; data: PatentComparison; t: number | null };
  readyCount: number;
  tally: [ProximityLevel, number][];
  onPick: (id: string) => void;
}) {
  const { level, reason, commonElements } = best.data.proximity;
  const s = PROXIMITY_STYLE[level];
  return (
    <>
      <div className="mt-4 flex items-center gap-5">
        <ProximityFace level={level} temperature={best.t} size={120} />
        <div className="min-w-0">
          <div className="text-[52px] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: s.ink }}>
            {formatTemperature(best.t)}
          </div>
          <div className="mt-1.5 text-xl font-bold">{WORDS[level]}</div>
          <p className="mt-1 line-clamp-2 text-[15px] text-muted">{best.hit.title}</p>
        </div>
      </div>

      <div className="mt-5" aria-hidden="true">
        <div className="h-2 rounded-full bg-gradient-to-r from-[#6ba7f5] via-[#ffb547] to-[#ff6b3d]" />
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>서늘해요</span>
          <span>따뜻해요</span>
          <span>뜨거워요</span>
        </div>
      </div>

      <details className="group mt-4 rounded-2xl bg-background px-4">
        <summary className="flex min-h-13 cursor-pointer items-center justify-between py-3 text-[15px] font-semibold">
          왜 이 온도인가요?
          <svg viewBox="0 0 20 20" className="h-5 w-5 text-muted transition group-open:rotate-180" aria-hidden="true">
            <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="space-y-3 pb-4">
          <p className="text-[15px] leading-relaxed">{reason}</p>
          {commonElements.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {commonElements.map((e) => (
                <span key={e} className="rounded-lg px-2.5 py-1 text-[13px] font-semibold" style={{ background: s.bg, color: s.ink }}>
                  {e}
                </span>
              ))}
            </div>
          )}
          <p className="text-[13px] text-muted">
            비교한 특허 {readyCount}건 · {tally.map(([l, n]) => `${PROXIMITY_LABELS[l].title} ${n}`).join(" · ")}
          </p>
          <p className="text-[13px] leading-relaxed text-muted">
            온도는 원문 인용으로 근거를 확인한 요소 중 겹치는 비율을 32~40°로 옮긴 값이에요. 검색 점수와 다르고, 법적
            위험도나 침해 확률이 아니에요.
          </p>
          <button
            type="button"
            onClick={() => onPick(best.hit.id)}
            className="min-h-10 rounded-xl bg-panel px-3.5 text-sm font-semibold hover:bg-white/70"
          >
            이 특허와 비교 보기
          </button>
        </div>
      </details>
    </>
  );
}
