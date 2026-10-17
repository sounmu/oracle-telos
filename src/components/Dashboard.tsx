"use client";

import { STEP_LABELS, type Session } from "@/lib/sessions";

interface Props {
  sessions: Session[];
  activeId: string | null;
  onNew: () => void;
  onOpen: (id: string) => void;
}

/** 왼쪽 목록: 새 대화와 사업 아이템별 세션 */
export default function Dashboard({ sessions, activeId, onNew, onOpen }: Props) {
  return (
    <aside aria-label="세션 목록" className="hidden w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-background px-3 py-4 md:flex">
      <div className="px-1 text-lg font-extrabold tracking-tight">PatenTrace</div>
      <button
        type="button"
        onClick={onNew}
        className={`min-h-10 rounded-xl px-3 text-left font-semibold ${activeId === null ? "bg-foreground text-panel" : "bg-panel hover:text-foreground"}`}
      >
        + 새 대화
      </button>
      {sessions.length === 0 && <p className="px-1 text-sm text-muted">아래에 사업 아이템을 적으면 대화가 여기에 쌓입니다.</p>}
      <ul className="space-y-1">
        {sessions.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              aria-current={activeId === s.id ? "true" : undefined}
              className={`w-full rounded-lg px-2 py-1.5 text-left text-[13px] ${activeId === s.id ? "bg-panel font-semibold" : "text-ink-2 hover:bg-panel"}`}
            >
              <span className="block truncate">{s.name}</span>
              <span className="block text-[11px] text-muted">{STEP_LABELS[s.step]} 단계</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
