"use client";

import { DECISION_LABELS, DECISION_TAG_STYLES } from "@/lib/colors";
import type { DisputeCase, PatentPoint } from "@/lib/types";
import { CaseCard } from "./DisputeCases";

interface Props {
  item: DisputeCase;
  /** 사례 키워드가 겹친 지도 점과 겹친 키워드 수. 많이 겹친 순 */
  matches: readonly { point: PatentPoint; shared: number }[];
  onBack: () => void;
  onPick: (id: string) => void;
}

/** 지도에서 고른 분쟁 사례. 사례 내용과 지도에서 키워드가 겹친 특허를 함께 보여 준다 */
export default function CasePanel({ item, matches, onBack, onPick }: Props) {
  return (
    <section aria-label="분쟁 사례" className="flex flex-col gap-3 pt-1">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 flex min-h-11 w-fit items-center gap-1 rounded-xl px-2 text-[15px] font-semibold text-ink-2 hover:bg-panel"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.5 4.5L7 10l5.5 5.5" />
        </svg>
        결과로 돌아가기
      </button>

      <div className="rounded-3xl bg-panel p-5 md:p-6">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f0edff] px-2 py-0.5 text-[13px] font-bold text-[#5b3df5]">
          <span className="inline-block h-2 w-2 rounded-full bg-[#7c5cff]" />
          분쟁 사례
        </span>
        <p className="mt-2 text-[15px] font-semibold leading-relaxed text-ink-2">{item.title}</p>
        <div className="mt-3">
          <CaseCard item={item} matched={[]} open />
        </div>
      </div>

      <section aria-label="지도에서 겹친 특허" className="rounded-3xl bg-panel p-5 md:p-6">
        <h2 className="text-lg font-bold tracking-tight">지도에서 키워드가 겹친 특허 {matches.length}건</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          사례 키워드가 2개 이상 제목·초록에 들어간 특허예요. 보라색 핀은 이 묶음 한가운데 놓여요. 사례에 나온 특허 자체는 아니에요.
        </p>
        <ul className="mt-2 divide-y divide-background">
          {matches.map(({ point, shared }) => {
            const tag = DECISION_TAG_STYLES[point.decision];
            return (
              <li key={point.id}>
                <button
                  type="button"
                  onClick={() => onPick(point.id)}
                  className="group flex w-full items-start justify-between gap-3 py-3.5 text-left"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                      <span className="rounded-md px-2 py-0.5 font-bold" style={{ background: tag.bg, color: tag.ink }}>
                        {DECISION_LABELS[point.decision]}
                      </span>
                      {point.filed && <span>{point.filed}</span>}
                    </span>
                    <span className="mt-1 block text-[15px] font-semibold leading-snug group-hover:text-accent-strong">
                      {point.title}
                    </span>
                  </span>
                  <span className="shrink-0 pt-0.5 text-[13px] text-muted">키워드 {shared}개</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}
