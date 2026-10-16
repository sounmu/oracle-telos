"use client";

import { useState } from "react";
import { PROXIMITY_LABELS } from "@/lib/proximity";
import type { ComparisonRow, ComparisonState, PatentComparison, ProximityLevel } from "@/lib/types";

const INK = "#191f28";

/** 밝은 바탕용 근접도 색. 특허 상태 색(초록·빨강·회색)과 겹치지 않게 파랑·노랑·주황·보라를 쓴다 */
export const PROXIMITY_STYLE: Record<ProximityLevel, { fill: string; ink: string; bg: string }> = {
  cool: { fill: "#6ba7f5", ink: "#1b64da", bg: "#e8f3ff" },
  warm: { fill: "#ffb547", ink: "#8a5300", bg: "#fff4db" },
  hot: { fill: "#ff6b3d", ink: "#c2410c", bg: "#ffede5" },
  insufficient: { fill: "#b9aef5", ink: "#5b4bb7", bg: "#f1eeff" },
};

/**
 * 화면 표시용 온도. 근거가 확인된 행 중 공통 비율을 32~40도로 옮긴다(단계 경계 1/3·2/3 = 34.7°·37.3°).
 * 단계(proximity.level)는 서버 규칙(src/lib/proximity.ts)을 그대로 쓰고, 자료 부족이면 null이다.
 */
export function temperatureOf(comparison: PatentComparison): number | null {
  if (comparison.proximity.level === "insufficient") return null;
  const confirmed = comparison.rows.filter((row) => row.relation !== "unconfirmed");
  if (confirmed.length === 0) return null;
  const common = confirmed.filter((row) => row.relation === "common").length;
  return 32 + (common / confirmed.length) * 8;
}

export function formatTemperature(t: number | null): string {
  return t === null ? "--°" : `${t.toFixed(1)}°`;
}

/** 근접도 온도계 캐릭터. 서늘=웃음, 따뜻=무덤덤, 뜨거움=걱정, 자료 부족=갸웃 */
export function ProximityFace({
  level,
  size = 28,
  temperature = null,
}: {
  level: ProximityLevel | "loading" | "idle";
  size?: number;
  temperature?: number | null;
}) {
  const style = level === "loading" || level === "idle" ? null : PROXIMITY_STYLE[level];
  const fill = style ? style.fill : "#d1d6db";
  const ratio = temperature === null ? (level === "hot" ? 0.8 : level === "warm" ? 0.55 : level === "cool" ? 0.25 : 0.1) : Math.max(0, Math.min(1, (temperature - 30) / 12));
  const h = Math.round(14 + ratio * 80);
  const mouth =
    level === "cool"
      ? "M41 125q7 6 14 0"
      : level === "hot"
        ? "M41 128q7 -6 14 0"
        : "M41 126h14";
  return (
    <svg
      viewBox="0 0 96 150"
      width={Math.round(size * 0.64)}
      height={size}
      aria-hidden="true"
      className={level === "loading" ? "shrink-0 animate-pulse" : "shrink-0"}
    >
      <rect x="33" y="8" width="30" height="100" rx="15" fill="#fff" stroke={INK} strokeWidth="4" />
      <rect x="42" y={104 - h} width="12" height={h} rx="6" fill={fill} />
      <circle cx="48" cy="118" r="24" fill={fill} stroke={INK} strokeWidth="4" />
      <circle cx="40" cy="115" r="3.5" fill={INK} />
      <circle cx="56" cy="115" r="3.5" fill={INK} />
      <path d={mouth} fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="33" cy="123" r="3.6" fill="#ffb4a2" />
      <circle cx="63" cy="123" r="3.6" fill="#ffb4a2" />
      {level === "insufficient" && (
        <text x="70" y="40" fontSize="30" fontWeight="800" fill={INK}>?</text>
      )}
    </svg>
  );
}

/** 결과 목록용 작은 근접도 표시. 상태 색 점과 구분되도록 캐릭터·이름·온도를 함께 쓴다 */
export function ProximityBadge({ state }: { state: ComparisonState | undefined }) {
  if (!state) return null;
  if (state.status === "loading") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[13px] font-semibold text-muted">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-border border-t-accent" />
        비교 중
      </span>
    );
  }
  if (state.status === "error") {
    return <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-[13px] font-semibold text-red-600">비교 실패</span>;
  }
  const { level } = state.data.proximity;
  const s = PROXIMITY_STYLE[level];
  const t = temperatureOf(state.data);
  return (
    <span className="inline-flex shrink-0 items-center gap-2" title={state.data.proximity.reason}>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold"
        style={{ background: s.bg, color: s.ink }}
      >
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.fill }} />
        {PROXIMITY_LABELS[level].title}
      </span>
      {t !== null && <span className="text-[13px] font-bold tabular-nums text-foreground">{formatTemperature(t)}</span>}
    </span>
  );
}

/** 서버에 OPENAI_API_KEY가 없을 때 비교 자리에 보여 주는 안내 */
export const AI_KEY_HINT = "OpenAI 키가 없어서 기술 요소 비교를 쓸 수 없어요. .env에 OPENAI_API_KEY를 넣으면 켜져요.";

interface ViewProps {
  state: ComparisonState | undefined;
  canCompare: boolean;
  onCompare: () => void;
  /** canCompare가 false일 때 보여 줄 안내. 없으면 입력 길이 안내 */
  disabledReason?: string;
}

export default function ComparisonView({ state, canCompare, onCompare, disabledReason }: ViewProps) {
  return (
    <section aria-label="내 기술과 비교" className="rounded-3xl bg-panel p-5 md:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">내 기술과 얼마나 가까울까요?</h2>
        {(!state || state.status === "error") && (
          <button
            type="button"
            disabled={!canCompare}
            onClick={onCompare}
            className="min-h-10 shrink-0 rounded-xl bg-accent-soft px-3.5 text-sm font-semibold text-accent-strong hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state ? "다시 비교" : "기술 요소별 비교"}
          </button>
        )}
      </div>
      {!state && !canCompare && (
        <p className="text-sm text-muted">{disabledReason ?? "내 기술 설명을 5자 이상 입력하면 비교할 수 있어요."}</p>
      )}
      {state?.status === "loading" && (
        <div aria-live="polite">
          <p className="mb-3 flex items-center gap-3 text-sm text-ink-2">
            <ProximityFace level="loading" size={44} />
            기술 요소별로 원문을 비교하는 중이에요
          </p>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        </div>
      )}
      {state?.status === "error" && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}
      {state?.status === "ready" && <ComparisonTable comparison={state.data} />}
    </section>
  );
}

type RelationFilter = "all" | ComparisonRow["relation"];

const RELATION_LABELS: Record<ComparisonRow["relation"], string> = {
  common: "공통",
  different: "차이",
  unconfirmed: "확인 필요",
};

const RELATION_STYLE: Record<ComparisonRow["relation"], string> = {
  common: "bg-[#ffede5] text-[#c2410c]",
  different: "bg-accent-soft text-accent-strong",
  unconfirmed: "bg-background text-ink-2",
};

function ComparisonTable({ comparison }: { comparison: PatentComparison }) {
  const [filter, setFilter] = useState<RelationFilter>("all");
  const { level, reason } = comparison.proximity;
  const s = PROXIMITY_STYLE[level];
  const t = temperatureOf(comparison);
  const confirmed = comparison.rows.filter((r) => r.relation !== "unconfirmed");
  const common = confirmed.filter((r) => r.relation === "common").length;
  const different = confirmed.length - common;
  const counts: Record<RelationFilter, number> = {
    all: comparison.rows.length,
    common,
    different,
    unconfirmed: comparison.rows.length - confirmed.length,
  };
  const rows = comparison.rows.filter((r) => filter === "all" || r.relation === filter);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[22px] font-extrabold leading-snug tracking-tight">
            {confirmed.length > 0 ? (
              <>
                근거를 확인한 {confirmed.length}개 요소 중
                <br />
                <span style={{ color: s.ink }}>{common}개가 같고</span> {different}개가 달라요
              </>
            ) : (
              "원문에서 근거를 확인한 요소가 없어요"
            )}
          </p>
          <p className="mt-1.5 text-sm text-muted">{reason}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ProximityFace level={level} temperature={t} size={60} />
          <div>
            <div className="text-[28px] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: s.ink }}>
              {formatTemperature(t)}
            </div>
            <div className="mt-1 text-sm font-semibold">{PROXIMITY_LABELS[level].title}</div>
          </div>
        </div>
      </div>

      {comparison.summary && <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{comparison.summary}</p>}

      <div role="group" aria-label="비교 필터" className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-background p-1 sm:grid-cols-4">
        {(["all", "common", "different", "unconfirmed"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`min-h-10 rounded-xl px-2 text-sm font-semibold transition ${
              filter === key ? "bg-panel text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {key === "all" ? "전체" : RELATION_LABELS[key]} {counts[key]}
          </button>
        ))}
      </div>

      <ul className="mt-2 divide-y divide-background" aria-label="기술 요소별 비교">
        {rows.map((row) => (
          <ComparisonItem key={row.element} row={row} />
        ))}
        {rows.length === 0 && <li className="py-6 text-center text-sm text-muted">이 조건에 맞는 요소가 없어요</li>}
      </ul>

      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        청구항 {comparison.claimsTotal}개 중 처음 {comparison.claimsReviewed}개와 초록만 비교했어요. 원문 인용이 확인된 내용만
        공통·차이로 표시해요. 근접도와 온도는 기술적으로 가까운 정도이며 법적 위험도·침해 확률·등록 가능성이 아니에요.{" "}
        <a href={comparison.sourceUrl} target="_blank" rel="noreferrer noopener" className="font-semibold text-accent-strong hover:underline">
          원문 보기
        </a>
      </p>
    </div>
  );
}

function ComparisonItem({ row }: { row: ComparisonRow }) {
  return (
    <li className="py-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[17px] font-bold">{row.element}</span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold ${RELATION_STYLE[row.relation]}`}>
          {RELATION_LABELS[row.relation]}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="min-w-0 rounded-2xl bg-background px-4 py-3">
          <div className="text-[13px] font-semibold text-muted">내 기술</div>
          <div className={`mt-0.5 text-[15px] font-semibold ${row.mine ? "" : "font-normal text-muted"}`}>
            {row.mine ?? "설명에 없어요"}
          </div>
        </div>
        <div className="min-w-0 rounded-2xl bg-background px-4 py-3">
          <div className="text-[13px] font-semibold text-muted">찾은 특허</div>
          <div className={`mt-0.5 text-[15px] font-semibold ${row.theirs ? "" : "font-normal text-muted"}`}>
            {row.theirs ?? "확인되지 않았어요"}
          </div>
        </div>
      </div>
      <p className="mt-2.5 text-[15px] leading-relaxed text-ink-2">
        {row.relation === "unconfirmed" && <span className="font-semibold text-foreground">확인할 점 · </span>}
        {row.note}
      </p>
      {row.evidence && (
        <blockquote className="mt-2 rounded-xl bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-ink-2">
          <span className="font-semibold text-muted">원문 인용 · </span>“{row.evidence}”
        </blockquote>
      )}
    </li>
  );
}
