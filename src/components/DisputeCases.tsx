"use client";

import { DISPUTE_CASES } from "@/lib/cases";
import type { DisputeCase } from "@/lib/types";

export interface CaseMatch {
  readonly item: DisputeCase;
  /** 맞춰 본 글에 들어 있던 사례 키워드 */
  readonly matched: string[];
}

/** 기술 설명·기술 요소·특허 제목에 사례 키워드가 몇 개 들어 있는지로 고른다. 분쟁 사례 API가 생기면 그 응답으로 바꾼다 */
export function matchCases(texts: readonly string[], limit = 5): CaseMatch[] {
  const hay = texts.filter(Boolean).join(" ").toLowerCase();
  if (!hay.trim()) return [];
  return DISPUTE_CASES.map((item) => ({
    item,
    matched: item.keywords.filter((k) => k && hay.includes(k.toLowerCase())),
  }))
    .filter((m) => m.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length)
    .slice(0, limit);
}

interface Props {
  matches: CaseMatch[];
  /** 첫 사례를 펼친 채로 보여 준다 */
  openFirst?: boolean;
  emptyText?: string;
  /** 지도에 핀이 있는 사례 id. 여기에 든 사례만 '지도에서 보기'를 보인다 */
  locatable?: ReadonlySet<string>;
  onLocate?: (caseId: string) => void;
}

export default function DisputeCases({ matches, openFirst = false, emptyText, locatable, onLocate }: Props) {
  if (matches.length === 0) {
    return (
      <p className="py-6 text-center text-[15px] leading-relaxed text-muted">
        {emptyText ?? "같은 키워드로 묶인 분쟁 사례가 아직 없어요."}
      </p>
    );
  }
  return (
    <ul className="space-y-2" aria-label="분쟁 사례">
      {matches.map(({ item, matched }, i) => (
        <li key={item.id}>
          <CaseCard
            item={item}
            matched={matched}
            open={openFirst && i === 0}
            onLocate={onLocate && locatable?.has(item.id) ? () => onLocate(item.id) : undefined}
          />
        </li>
      ))}
    </ul>
  );
}

export function CaseCard({
  item,
  matched,
  open,
  onLocate,
}: {
  item: DisputeCase;
  matched: string[];
  open: boolean;
  onLocate?: () => void;
}) {
  const facts: [string, string][] = (
    [
      ["결과", item.result],
      ["판단 이유", item.reason],
      ["기술적 영향", item.techImpact],
      ["사업 영향", item.bizImpact],
    ] as [string, string][]
  ).filter(([, v]) => v);
  const ids = [...item.ids.patents, ...item.ids.cases];
  return (
    <details className="group rounded-2xl border border-border bg-panel px-4" open={open}>
      <summary className="flex cursor-pointer items-start justify-between gap-3 py-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {item.procedures.slice(0, 3).map((p) => (
              <span key={p} className="rounded-md bg-background px-2 py-0.5 text-[13px] font-semibold text-ink-2">
                {p}
              </span>
            ))}
            <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[13px] font-semibold text-accent-strong">
              {item.relation}
            </span>
          </div>
          <div className="text-[17px] font-bold leading-snug">
            {item.plaintiff} vs {item.defendant}
          </div>
          <div className="text-sm leading-relaxed text-muted">
            {item.tech} · {item.period.start}~{item.period.end}
          </div>
          {matched.length > 0 && <div className="text-[13px] text-muted">겹친 키워드 · {matched.join(", ")}</div>}
        </div>
        <svg viewBox="0 0 20 20" className="mt-1 h-5 w-5 shrink-0 text-muted transition group-open:rotate-180" aria-hidden="true">
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="space-y-4 pb-5">
        {onLocate && (
          <button
            type="button"
            onClick={onLocate}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#f0edff] text-[15px] font-bold text-[#5b3df5] hover:brightness-95"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
              <path d="M10 18s5.5-5 5.5-9.5a5.5 5.5 0 10-11 0C4.5 13 10 18 10 18z" />
              <circle cx="10" cy="8.5" r="1.8" />
            </svg>
            지도에서 보기
          </button>
        )}
        {item.steps.length > 0 && (
          <ol className="space-y-2" aria-label="분쟁 과정">
            {item.steps.map((step, i) => (
              <li key={`${step.date}-${i}`} className="flex items-center gap-3 rounded-2xl bg-background px-4 py-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white ${
                    i === item.steps.length - 1 ? "bg-[#0b8a5a]" : "bg-foreground"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] text-muted">{step.date}</div>
                  <div className="text-[15px] font-semibold leading-snug">{step.text}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
        <dl className="space-y-3">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-sm font-semibold text-muted">{k}</dt>
              <dd className="mt-0.5 text-[15px] leading-relaxed">{v}</dd>
            </div>
          ))}
        </dl>
        {ids.length > 0 && <p className="break-all text-[13px] text-muted">식별 정보 · {ids.join(", ")}</p>}
        {item.sources.length > 0 && (
          <p className="text-[13px] text-muted">
            출처 ·{" "}
            {item.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <a href={s.url} target="_blank" rel="noreferrer noopener" className="font-semibold text-accent-strong hover:underline">
                  {s.label}
                </a>
              </span>
            ))}
          </p>
        )}
      </div>
    </details>
  );
}
