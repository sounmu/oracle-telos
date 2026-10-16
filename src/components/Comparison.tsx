"use client";

import { PROXIMITY_COLORS, PROXIMITY_LABELS } from "@/lib/proximity";
import type { ComparisonRow, ComparisonState, PatentComparison, ProximityLevel } from "@/lib/types";

const INK = "#1e293b";

/** 기술 근접도 캐릭터. 서늘=차분, 따뜻=관심, 뜨거움=놀람, 자료 부족=갸웃 */
export function ProximityFace({ level, size = 28 }: { level: ProximityLevel | "loading"; size?: number }) {
  const fill = level === "loading" ? "#475569" : PROXIMITY_COLORS[level];
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      className={level === "loading" ? "shrink-0 animate-pulse" : "shrink-0"}
    >
      <path d="M16 3.5c7.4 0 12.5 5.3 12.5 12.3S23.2 28.5 16 28.5 3.5 22.8 3.5 15.8 8.6 3.5 16 3.5z" fill={fill} />
      <circle cx="9" cy="19.5" r="2" fill="#fff" opacity="0.35" />
      <circle cx="23" cy="19.5" r="2" fill="#fff" opacity="0.35" />
      {level === "cool" && (
        <g fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round">
          <path d="M9.5 15.5q1.8-1.6 3.6 0M18.9 15.5q1.8-1.6 3.6 0" />
          <path d="M13.8 21q2.2 1.3 4.4 0" />
        </g>
      )}
      {level === "warm" && (
        <g>
          <circle cx="11.3" cy="15" r="1.8" fill={INK} />
          <circle cx="20.7" cy="15" r="1.8" fill={INK} />
          <circle cx="11.9" cy="14.4" r="0.6" fill="#fff" />
          <circle cx="21.3" cy="14.4" r="0.6" fill="#fff" />
          <path d="M12.5 20q3.5 3.4 7 0" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      )}
      {level === "hot" && (
        <g>
          <circle cx="11.2" cy="14.6" r="2.7" fill="#fff" stroke={INK} strokeWidth="1.2" />
          <circle cx="20.8" cy="14.6" r="2.7" fill="#fff" stroke={INK} strokeWidth="1.2" />
          <circle cx="11.2" cy="14.8" r="1.2" fill={INK} />
          <circle cx="20.8" cy="14.8" r="1.2" fill={INK} />
          <ellipse cx="16" cy="21.6" rx="1.8" ry="2.2" fill={INK} />
          <path d="M26.2 6.5q1.6 2.4 0 3.6q-1.6-1.2 0-3.6z" fill="#7dd3fc" />
        </g>
      )}
      {level === "insufficient" && (
        <g>
          <circle cx="11.3" cy="15.2" r="1.4" fill={INK} />
          <circle cx="20.7" cy="15.2" r="1.4" fill={INK} />
          <path d="M13.2 21h5.6" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          <text x="23.5" y="9" fontSize="8" fontWeight="700" fill={INK}>?</text>
        </g>
      )}
      {level === "loading" && (
        <path d="M9.5 15h3.6M18.9 15h3.6M14 21h4" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** 결과 목록용 작은 근접도 표시. 상태 색 점과 구분되도록 캐릭터와 이름을 함께 쓴다. */
export function ProximityBadge({ state }: { state: ComparisonState | undefined }) {
  if (!state) return null;
  if (state.status === "loading") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
        <ProximityFace level="loading" size={18} />
        비교 중
      </span>
    );
  }
  if (state.status === "error") return <span className="shrink-0 text-[11px] text-red-200">비교 실패</span>;
  const { level } = state.data.proximity;
  return (
    <span className="flex shrink-0 items-center gap-1 text-[11px]" title={state.data.proximity.reason}>
      <ProximityFace level={level} size={18} />
      <span style={{ color: PROXIMITY_COLORS[level] }}>{PROXIMITY_LABELS[level].title}</span>
    </span>
  );
}

interface ViewProps {
  state: ComparisonState | undefined;
  canCompare: boolean;
  onCompare: () => void;
}

export default function ComparisonView({ state, canCompare, onCompare }: ViewProps) {
  return (
    <section aria-label="내 기술과 비교" className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold">내 기술과 얼마나 가까울까요?</h4>
        {(!state || state.status === "error") && (
          <button
            type="button"
            disabled={!canCompare}
            onClick={onCompare}
            className="rounded-md border border-border px-2 py-1 text-[11px] hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state ? "다시 비교" : "기술 요소별 비교"}
          </button>
        )}
      </div>
      {!state && !canCompare && (
        <p className="text-[11px] text-muted">오른쪽에 내 기술 설명을 5자 이상 입력하면 비교할 수 있어요.</p>
      )}
      {state?.status === "loading" && (
        <p className="flex items-center gap-2 text-[11px] text-muted" aria-live="polite">
          <ProximityFace level="loading" size={22} />
          기술 요소별로 원문을 비교하는 중…
        </p>
      )}
      {state?.status === "error" && (
        <p role="alert" className="text-[11px] text-red-200">{state.message}</p>
      )}
      {state?.status === "ready" && <ComparisonTable comparison={state.data} />}
    </section>
  );
}

function ComparisonTable({ comparison }: { comparison: PatentComparison }) {
  const { level, reason } = comparison.proximity;
  return (
    <div>
      <div className="mb-2 flex items-start gap-2 rounded-lg bg-background/60 p-2">
        <ProximityFace level={level} size={40} />
        <div className="min-w-0 text-[11px] leading-relaxed">
          <div className="text-xs font-semibold" style={{ color: PROXIMITY_COLORS[level] }}>
            기술 근접도 · {PROXIMITY_LABELS[level].title}
          </div>
          <div className="text-foreground/90">{PROXIMITY_LABELS[level].message}</div>
          <div className="text-muted">{reason}</div>
        </div>
      </div>
      {comparison.summary && <p className="mb-2 text-[11px] text-foreground/85">{comparison.summary}</p>}
      <ul className="space-y-1.5" aria-label="기술 요소별 비교">
        {comparison.rows.map((row) => (
          <ComparisonItem key={row.element} row={row} />
        ))}
      </ul>
      <p className="mt-2 text-[10px] leading-relaxed text-muted/80">
        청구항 {comparison.claimsTotal}개 중 처음 {comparison.claimsReviewed}개와 초록만 비교했습니다. 기술 근접도는
        기술적으로 가까운 정도이며 법적 위험도·침해 확률·등록 가능성이 아닙니다.{" "}
        <a href={comparison.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">
          원문 보기
        </a>
      </p>
    </div>
  );
}

const RELATION_LABELS: Record<ComparisonRow["relation"], string> = {
  common: "공통",
  different: "차이",
  unconfirmed: "확인 필요",
};

function ComparisonItem({ row }: { row: ComparisonRow }) {
  return (
    <li className="rounded-md border border-border/70 bg-background/40 p-2 text-[11px] leading-relaxed">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium">{row.element}</span>
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${
            row.relation === "common"
              ? "bg-accent/20 text-accent"
              : row.relation === "different"
                ? "bg-white/10 text-foreground/80"
                : "bg-white/5 text-muted"
          }`}
        >
          {RELATION_LABELS[row.relation]}
        </span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <dt className="text-muted">내 기술</dt>
        <dd className={row.mine ? "text-foreground/85" : "text-muted"}>{row.mine ?? "미기재"}</dd>
        <dt className="text-muted">찾은 특허</dt>
        <dd className={row.theirs ? "text-foreground/85" : "text-muted"}>{row.theirs ?? "확인되지 않음"}</dd>
        <dt className="text-muted">{row.relation === "unconfirmed" ? "확인할 점" : "비교"}</dt>
        <dd className="text-foreground/85">{row.note}</dd>
      </dl>
      {row.evidence && (
        <blockquote className="mt-1 border-l-2 border-accent/50 pl-2 text-[10px] text-foreground/70">
          원문: “{row.evidence}”
        </blockquote>
      )}
    </li>
  );
}
