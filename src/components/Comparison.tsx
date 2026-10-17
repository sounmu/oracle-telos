"use client";

import { useState } from "react";
import {
  CLAIM_STATUS_LABELS,
  coverageOf,
  PROXIMITY_LABELS,
  PROXIMITY_RULES,
  PROXIMITY_SOURCES,
} from "@/lib/proximity";
import type {
  ClaimElementRow,
  ClaimElementStatus,
  ComparisonRow,
  ComparisonState,
  PatentComparison,
  Proximity,
  ProximityLevel,
} from "@/lib/types";

const INK = "#191f28";

/** 밝은 바탕용 근접도 색. 특허 상태 색(초록·빨강·회색)과 겹치지 않게 파랑·노랑·주황·보라를 쓴다 */
export const PROXIMITY_STYLE: Record<ProximityLevel, { fill: string; ink: string; bg: string }> = {
  cool: { fill: "#6ba7f5", ink: "#1b64da", bg: "#e8f3ff" },
  warm: { fill: "#ffb547", ink: "#8a5300", bg: "#fff4db" },
  hot: { fill: "#ff6b3d", ink: "#c2410c", bg: "#ffede5" },
  insufficient: { fill: "#b9aef5", ink: "#5b4bb7", bg: "#f1eeff" },
};

/** 화면 숫자 "대응 구성 / 전체 구성". 판단하지 않았으면 "--" */
export function formatCoverage(proximity: Proximity): string {
  const c = coverageOf(proximity);
  return c ? `${c.matched}/${c.total}` : "--";
}

/** 근접도 캐릭터. 빠진 구성 있음=웃음, 다른 수단 포함=무덤덤, 모두 대응=걱정, 자료 부족=갸웃. 표정은 단계만 나타낸다 */
export function ProximityFace({
  level,
  size = 28,
}: {
  level: ProximityLevel | "loading" | "idle";
  size?: number;
}) {
  const style = level === "loading" || level === "idle" ? null : PROXIMITY_STYLE[level];
  const fill = style ? style.fill : "#d1d6db";
  const mouth =
    level === "cool"
      ? "M25 40q7 6 14 0"
      : level === "hot"
        ? "M25 43q7 -6 14 0"
        : "M25 41h14";
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      className={level === "loading" ? "shrink-0 animate-pulse" : "shrink-0"}
    >
      <circle cx="32" cy="34" r="26" fill={fill} stroke={INK} strokeWidth="4" />
      <circle cx="24" cy="30" r="3.5" fill={INK} />
      <circle cx="40" cy="30" r="3.5" fill={INK} />
      <path d={mouth} fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="17" cy="38" r="3.6" fill="#ffb4a2" />
      <circle cx="47" cy="38" r="3.6" fill="#ffb4a2" />
      {level === "insufficient" && (
        <text x="50" y="18" fontSize="20" fontWeight="800" fill={INK}>?</text>
      )}
    </svg>
  );
}

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
            청구항 구성과 기술 요소별로 원문을 비교하는 중이에요
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
  const { proximity } = comparison;
  const { level, reason } = proximity;
  const s = PROXIMITY_STYLE[level];
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
          <p className="text-[22px] font-extrabold leading-snug tracking-tight" style={{ color: s.ink }}>
            {PROXIMITY_LABELS[level].message}
          </p>
          <p className="mt-1.5 text-sm text-muted">{reason}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ProximityFace level={level} size={60} />
          <div>
            <div className="text-[28px] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: s.ink }}>
              {formatCoverage(proximity)}
            </div>
            <div className="mt-1 text-sm font-semibold">{PROXIMITY_LABELS[level].title}</div>
          </div>
        </div>
      </div>

      {comparison.summary && <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{comparison.summary}</p>}

      <h3 className="mt-5 text-[17px] font-bold">청구항 1 구성 대비</h3>
      <p className="mt-0.5 text-sm text-muted">근접도 단계는 이 표로만 정해요.</p>
      <ClaimChart proximity={proximity} chart={comparison.claimChart} />

      <details className="group mt-3 rounded-2xl bg-background px-4">
        <summary className="flex min-h-12 cursor-pointer items-center justify-between py-3 text-[15px] font-semibold">
          왜 이 단계인가요?
          <Chevron />
        </summary>
        <ProximityBasis level={level} />
      </details>

      <h3 className="mt-6 text-[17px] font-bold">내 기술 요소별 비교</h3>
      <p className="mt-0.5 text-sm text-muted">
        {confirmed.length > 0
          ? `근거를 확인한 ${confirmed.length}개 요소 중 ${common}개가 같고 ${different}개가 달라요. 참고용이며 근접도 단계에는 쓰지 않아요.`
          : "원문에서 근거를 확인한 요소가 없어요."}
      </p>

      <div role="group" aria-label="비교 필터" className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-background p-1 sm:grid-cols-4">
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
        청구항 {comparison.claimsTotal}개 중 처음 {comparison.claimsReviewed}개와 초록만 비교했고, 근접도는 청구항 1만 봤어요. 다른
        독립항은 따로 확인해야 해요. 원문 인용이 확인된 내용만 표시해요. 근접도는 기술적으로 가까운 정도이며 법적 위험도·침해
        확률·등록 가능성이 아니에요.{" "}
        <a href={comparison.sourceUrl} target="_blank" rel="noreferrer noopener" className="font-semibold text-accent-strong hover:underline">
          원문 보기
        </a>
      </p>
    </div>
  );
}

const CLAIM_STATUS_STYLE: Record<ClaimElementStatus, string> = {
  present: "bg-[#ffede5] text-[#c2410c]",
  modified: "bg-[#fff4db] text-[#8a5300]",
  absent: "bg-accent-soft text-accent-strong",
  unconfirmed: "bg-background text-ink-2",
};

function ClaimChart({ chart, proximity }: { chart: readonly ClaimElementRow[]; proximity: Proximity }) {
  const unverified = proximity.counts.total - chart.length;
  if (chart.length === 0) {
    return <p className="mt-2 rounded-2xl bg-background px-4 py-3 text-sm text-muted">청구항 1을 원문 그대로 나누지 못했어요.</p>;
  }
  return (
    <>
      <ul className="mt-2 divide-y divide-background" aria-label="청구항 1 구성 대비">
        {chart.map((row) => (
          <li key={row.element} className="py-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[15px] font-semibold leading-snug">“{row.element}”</span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold ${CLAIM_STATUS_STYLE[row.status]}`}>
                {CLAIM_STATUS_LABELS[row.status]}
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">
              {row.mine && <span className="font-semibold text-foreground">내 설명 “{row.mine}” · </span>}
              {row.note}
            </p>
          </li>
        ))}
      </ul>
      {unverified > 0 && (
        <p className="text-[13px] text-muted">모델이 낸 구성 {unverified}개는 청구항 1 원문에서 찾지 못해 &lsquo;확인 필요&rsquo;로 셌어요.</p>
      )}
      {proximity.completeness.truncated && (
        <p className="text-[13px] text-muted">청구항 1이 길어 앞부분만 확인했어요. 뒤쪽 구성은 이 표에 없을 수 있어요.</p>
      )}
      {proximity.completeness.uncovered.length > 0 && (
        <p className="text-[13px] text-muted">
          청구항 1 원문 중 이 표에 담기지 않은 문구: {proximity.completeness.uncovered.map((text) => `“${text}”`).join(", ")}
        </p>
      )}
    </>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 text-muted transition group-open:rotate-180" aria-hidden="true">
      <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 단계 판정 규칙과 그 근거(판례). 현재 단계를 강조한다 */
export function ProximityBasis({ level }: { level: ProximityLevel }) {
  return (
    <div className="space-y-3 pb-4 text-[14px] leading-relaxed">
      <p>
        특허 청구항 1을 구성요소로 나누고, 각 구성이 내 설명에 있는지 위에서부터 차례로 따져 단계를 정해요. 비율 구간이나 점수
        가중치는 쓰지 않아요.
      </p>
      <ol className="space-y-1.5">
        {PROXIMITY_RULES.map((r, i) => {
          const st = PROXIMITY_STYLE[r.level];
          const current = r.level === level;
          return (
            <li
              key={r.level}
              className={`flex gap-2 rounded-xl px-3 py-2 ${current ? "font-semibold" : "text-muted"}`}
              style={current ? { background: st.bg, color: st.ink } : undefined}
            >
              <span className="shrink-0 tabular-nums">{i + 1}.</span>
              <span>
                <span className="font-bold">{PROXIMITY_LABELS[r.level].title}</span> · {r.rule}
              </span>
            </li>
          );
        })}
      </ol>
      <div>
        <div className="text-[13px] font-semibold text-muted">규칙의 근거</div>
        <ul className="mt-1 space-y-1.5">
          {PROXIMITY_SOURCES.map((src) => (
            <li key={src.title}>
              <a href={src.url} target="_blank" rel="noreferrer noopener" className="font-semibold text-accent-strong hover:underline">
                {src.title}
              </a>
              <span className="text-ink-2"> — {src.point}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[13px] text-muted">
        판례의 판단 틀을 기술 비교에 빌려 쓴 것이에요. 실제 권리범위·침해 판단은 청구항 해석과 균등·공지기술 항변까지 따져야
        하므로 변리사 검토가 필요해요. &lsquo;설명에 없음&rsquo;은 내가 적은 설명 기준이에요.
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
