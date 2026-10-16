"use client";

import { ALL_DECISIONS, LIMIT_OPTIONS, type SessionView, type SortKey } from "@/lib/view";
import { DECISION_LABELS, DECISION_COLORS } from "@/lib/colors";
import type { Decision } from "@/lib/types";

interface Props {
  view: SessionView;
  hasScores: boolean;
  onChange: (next: SessionView) => void;
}

const SORT_LABEL: Record<SortKey, string> = {
  filed_desc: "출원 최신순",
  filed_asc: "출원 오래된순",
  similarity: "유사도순",
};

/** 세션의 조회 조건을 바꾼다. 노션 데이터베이스 보기의 필터·정렬·개수와 같은 역할 */
export default function ViewControls({ view, hasScores, onChange }: Props) {
  const toggle = (d: Decision) => {
    const on = view.decisions.includes(d);
    const next = on ? view.decisions.filter((x) => x !== d) : [...view.decisions, d];
    // 상태를 하나도 고르지 않으면 아무 것도 안 나오므로 전체로 되돌린다
    onChange({ ...view, decisions: next.length ? next : ALL_DECISIONS });
  };
  return (
    <div className="space-y-2 rounded-xl bg-background p-3 text-[13px]">
      <div className="flex flex-wrap gap-1.5">
        {ALL_DECISIONS.map((d) => {
          const on = view.decisions.includes(d);
          return (
            <button key={d} type="button" aria-pressed={on} onClick={() => toggle(d)} className={`min-h-8 rounded-full px-2.5 font-semibold ${on ? "bg-panel" : "text-muted line-through"}`}>
              <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: DECISION_COLORS[d], opacity: on ? 1 : 0.4 }} />
              {DECISION_LABELS[d]}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-muted">
          정렬
          <select value={view.sort} onChange={(e) => onChange({ ...view, sort: e.target.value as SortKey })} className="rounded-lg bg-panel px-2 py-1 text-foreground">
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k} disabled={k === "similarity" && !hasScores}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-muted">
          개수
          <select value={view.limit} onChange={(e) => onChange({ ...view, limit: Number(e.target.value) })} className="rounded-lg bg-panel px-2 py-1 text-foreground">
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n === 0 ? "전체" : `${n}건`}</option>
            ))}
          </select>
        </label>
        {view.cpc && (
          <button type="button" onClick={() => onChange({ ...view, cpc: null })} className="rounded-full bg-panel px-2.5 py-1 font-semibold">
            분야 {view.cpc} ✕
          </button>
        )}
      </div>
    </div>
  );
}
