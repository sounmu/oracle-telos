"use client";

import { useEffect, useState } from "react";
import { DECISION_COLORS, DECISION_LABELS } from "@/lib/colors";
import type { PatentFull, PatentPoint } from "@/lib/types";

interface Props {
  point: PatentPoint;
  score?: number;
  onClose: () => void;
}

export default function PatentDetail({ point, score, onClose }: Props) {
  const [full, setFull] = useState<PatentFull | null>(null);
  const [showClaim, setShowClaim] = useState(false);

  // point.id가 바뀌면 부모가 key로 새로 마운트하므로 여기서 상태를 리셋하지 않는다
  useEffect(() => {
    let alive = true;
    fetch(`/api/patent/${point.id}`)
      .then((r) => (r.ok ? (r.json() as Promise<PatentFull>) : null))
      .then((data) => {
        if (alive && data) setFull(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [point.id]);

  const abstract = full?.abstract ?? point.abstract;

  return (
    <div className="absolute bottom-4 left-4 z-20 w-[420px] max-w-[calc(100%-2rem)] rounded-xl border border-border bg-panel/95 p-4 text-sm shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className="rounded-full px-2 py-0.5 font-semibold text-background"
            style={{ background: DECISION_COLORS[point.decision] }}
          >
            {DECISION_LABELS[point.decision]}
          </span>
          <span className="text-muted">#{point.id}</span>
          <span className="text-muted">{point.cpc || "CPC 없음"}</span>
          <span className="text-muted">출원 {point.filed}</span>
          {score !== undefined && (
            <span className="text-accent">유사도 {(score * 100).toFixed(0)}%</span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="rounded px-1.5 text-muted hover:bg-white/10 hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <h3 className="mb-2 font-semibold leading-snug">{point.title}</h3>
      <p className="max-h-40 overflow-y-auto text-xs leading-relaxed text-foreground/80">
        {abstract}
      </p>
      {full?.firstClaim && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowClaim((v) => !v)}
            className="text-xs text-accent hover:underline"
          >
            {showClaim ? "청구항 1 접기" : "청구항 1 보기"}
          </button>
          {showClaim && (
            <p className="mt-1 max-h-40 overflow-y-auto rounded-md bg-background/60 p-2 text-[11px] leading-relaxed text-foreground/75">
              {full.firstClaim}
            </p>
          )}
        </div>
      )}
      {full && full.cpcLabels.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {full.cpcLabels.slice(0, 8).map((c) => (
            <span key={c} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-muted">
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
