"use client";

import { FEATURE_BY_ID } from "@/lib/features";
import { groupByPhase, type Session } from "@/lib/sessions";

interface Props {
  sessions: Session[];
  activeId: string | null;
  onNew: () => void;
  onOpen: (id: string) => void;
}

/** 왼쪽 대시보드: 새 대화와 단계별로 쌓인 세션 목록 */
export default function Dashboard({ sessions, activeId, onNew, onOpen }: Props) {
  const groups = groupByPhase(sessions);
  return (
    <aside aria-label="대시보드" className="hidden w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-background px-3 py-4 md:flex">
      <div className="px-1 text-lg font-extrabold tracking-tight">Telos</div>
      <button
        type="button"
        onClick={onNew}
        className={`min-h-10 rounded-xl px-3 text-left font-semibold ${activeId === null ? "bg-foreground text-panel" : "bg-panel hover:text-foreground"}`}
      >
        + 새 대화
      </button>
      {sessions.length === 0 && <p className="px-1 text-sm text-muted">아래 기능을 누르면 대화가 여기에 쌓입니다.</p>}
      {groups.map((g) =>
        g.items.length === 0 ? null : (
          <section key={g.phase} aria-label={`${g.label} 대화`}>
            <h2 className="px-1 text-xs font-semibold text-muted">{g.label} · {g.items.length}</h2>
            <ul className="mt-1 space-y-1">
              {g.items.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(s.id)}
                    aria-current={activeId === s.id ? "true" : undefined}
                    className={`w-full rounded-lg px-2 py-1.5 text-left text-[13px] ${activeId === s.id ? "bg-panel font-semibold" : "text-ink-2 hover:bg-panel"}`}
                  >
                    <span className="block truncate">{s.title}</span>
                    <span className="block truncate text-[11px] text-muted">{FEATURE_BY_ID[s.feature].target}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </aside>
  );
}
