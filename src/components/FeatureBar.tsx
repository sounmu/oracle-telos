"use client";

import { useState } from "react";
import { FEATURES, type FeatureDef } from "@/lib/features";
import { PHASES } from "@/lib/phaseFeatures";

interface Props {
  onPick: (feature: FeatureDef) => void;
  /** 입력창에 쓴 문장으로 새 대화(아이디어 위치 찾기)를 시작한다 */
  onSend: (text: string) => void;
}

/** 지도 아래의 명령 막대: 사업 단계별로 기능을 고른다. 고르면 새 대화가 열린다 */
export default function FeatureBar({ onPick, onSend }: Props) {
  const [text, setText] = useState("");
  return (
    <nav aria-label="기능 선택" className="pointer-events-auto grid gap-2 rounded-2xl bg-panel/95 p-3 text-[13px] shadow-sm backdrop-blur-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = text.trim();
          if (value.length < 5) return;
          onSend(value);
          setText("");
        }}
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="무엇을 찾아볼까요? 아이디어를 적고 Enter"
          aria-label="새 대화 입력"
          className="min-h-10 min-w-0 flex-1 rounded-xl bg-background px-3 text-foreground placeholder:text-muted"
        />
        <button type="submit" disabled={text.trim().length < 5} className="min-h-10 shrink-0 rounded-xl bg-foreground px-4 font-semibold text-panel disabled:opacity-40">
          시작
        </button>
      </form>
      <div className="grid gap-2 sm:grid-cols-3">
      {PHASES.map((p) => (
        <div key={p.id} className="min-w-0">
          <div className="px-1 text-xs font-semibold text-muted">{p.label}</div>
          <div className="mt-1 flex flex-col gap-1">
            {FEATURES.filter((f) => f.phase === p.id).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onPick(f)}
                title={f.summary}
                className="min-h-8 rounded-lg bg-background px-2 text-left font-semibold text-ink-2 hover:text-foreground"
              >
                {f.label}
                {f.deferred && <span className="ml-1 text-[11px] font-normal text-muted">초안</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
      </div>
    </nav>
  );
}
