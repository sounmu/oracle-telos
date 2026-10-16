"use client";

import { useEffect, useRef, useState } from "react";
import { DECISION_COLORS, DECISION_LABELS } from "@/lib/colors";
import type { ComparisonState, PatentDataset, PatentFull, PatentPoint } from "@/lib/types";
import ComparisonView from "./Comparison";
import { formatDate, readErrorMessage, scoreLabel } from "./ResearchReferences";

interface Props {
  point: PatentPoint;
  dataset: PatentDataset;
  score?: number;
  onClose: () => void;
  comparison?: ComparisonState;
  canCompare: boolean;
  onCompare: () => void;
}

interface RequestState {
  loading: boolean;
  error: string | null;
}

export default function PatentDetail({
  point,
  dataset,
  score,
  onClose,
  comparison,
  canCompare,
  onCompare,
}: Props) {
  const [full, setFull] = useState<PatentFull | null>(null);
  const [initial, setInitial] = useState<RequestState>({ loading: true, error: null });
  const [refresh, setRefresh] = useState<RequestState & { at: string | null }>({
    loading: false,
    error: null,
    at: null,
  });
  const [showClaims, setShowClaims] = useState(false);
  const refreshRef = useRef<AbortController | null>(null);

  // point.id가 바뀌면 부모가 key로 새로 마운트하므로 여기서 상태를 리셋하지 않는다
  useEffect(() => {
    const ac = new AbortController();
    fetchPatent(point.id, false, ac.signal)
      .then((data) => {
        if (ac.signal.aborted) return;
        setFull(data);
        setInitial({ loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        setInitial({
          loading: false,
          error: err instanceof Error ? err.message : "상세를 불러오지 못했습니다.",
        });
      });
    return () => ac.abort();
  }, [point.id]);

  useEffect(() => () => {
    refreshRef.current?.abort();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // 입력 중인 필드(기준일·아이디어)의 Esc는 그 필드에 맡긴다
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function runRefresh() {
    refreshRef.current?.abort();
    const ac = new AbortController();
    refreshRef.current = ac;
    setRefresh({ loading: true, error: null, at: null });
    try {
      const data = await fetchPatent(point.id, true, ac.signal);
      if (ac.signal.aborted) return;
      setFull(data);
      setRefresh({
        loading: false,
        error: null,
        at: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (err) {
      if (ac.signal.aborted) return;
      setRefresh({
        loading: false,
        error: err instanceof Error ? err.message : "KIPRIS 조회에 실패했습니다.",
        at: null,
      });
    }
  }

  // 갱신 뒤에는 지도 점(point)의 오래된 메타가 아니라 서버가 돌려준 전체 레코드를 보여준다
  const decision = full?.decision ?? point.decision;
  const title = full?.title ?? point.title;
  const cpc = full?.cpc ?? point.cpc;
  const filed = full?.filed ?? point.filed;
  const abstract = full?.abstract ?? point.abstract;
  const claims = full?.claims?.length ? full.claims : full?.firstClaim ? [full.firstClaim] : [];
  const korean = dataset === "korea";
  const hasMeta = Boolean(full?.rawStatus || full?.applicants?.length || full?.publication);

  return (
    <section
      aria-label="특허 상세"
      className="fixed inset-x-2 bottom-2 z-20 max-h-[60dvh] overflow-y-auto rounded-xl border border-border bg-panel p-4 text-sm shadow-2xl backdrop-blur md:absolute md:bg-panel/95 md:inset-x-auto md:bottom-4 md:left-4 md:max-h-[calc(100%-2rem)] md:w-[420px] md:max-w-[calc(100%-2rem)]"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
          <span
            className="rounded-full px-2 py-0.5 font-semibold text-background"
            style={{ background: DECISION_COLORS[decision] }}
          >
            {DECISION_LABELS[decision]}
          </span>
          <span className="break-all text-muted">
            {point.id.startsWith("kipris:") ? `출원번호 ${point.id.slice(7)}` : `#${point.id}`}
          </span>
          <span className="text-muted">{cpc || "CPC 없음"}</span>
          <span className="text-muted">출원 {filed || "미상"}</span>
          {score !== undefined && <span className="text-muted">{scoreLabel(score)}</span>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          title="닫기 (Esc)"
          className="-mr-3 -mt-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-white/10 hover:text-foreground"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      <h3 className="mb-2 break-words font-semibold leading-snug">{title}</h3>

      {hasMeta && (
        <dl className="mb-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px] text-muted">
          {full?.rawStatus && (
            <div className="contents">
              <dt>원문 상태</dt>
              <dd className="break-words text-foreground/80">{full.rawStatus}</dd>
            </div>
          )}
          {full?.applicants?.length ? (
            <div className="contents">
              <dt>출원인</dt>
              <dd className="break-words text-foreground/80">{full.applicants.join(", ")}</dd>
            </div>
          ) : null}
          {full?.publication && (
            <div className="contents">
              <dt>공개번호</dt>
              <dd className="break-words text-foreground/80">{full.publication}</dd>
            </div>
          )}
        </dl>
      )}

      <p className="break-words text-xs leading-relaxed text-foreground/80">
        {abstract}
      </p>

      {korean && <ComparisonView state={comparison} canCompare={canCompare} onCompare={onCompare} />}

      {initial.loading && <p className="mt-2 text-[11px] text-muted">상세 정보를 불러오는 중…</p>}
      {initial.error && (
        <p role="alert" className="mt-2 text-[11px] text-red-200">
          상세 정보를 불러오지 못했습니다: {initial.error}
        </p>
      )}

      {claims.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            aria-expanded={showClaims}
            onClick={() => setShowClaims((v) => !v)}
            className="text-xs text-accent hover:underline"
          >
            {showClaims ? `청구항 ${claims.length}건 접기` : `청구항 ${claims.length}건 보기`}
          </button>
          {showClaims && (
            <ol className="mt-1 space-y-1.5 rounded-md bg-background/60 p-2 text-[11px] leading-relaxed text-foreground/75">
              {claims.map((claim, i) => (
                // 청구항 원문에 번호가 포함되어 있어 별도 번호를 붙이지 않는다
                <li key={i} className="whitespace-pre-wrap break-words">
                  {claim}
                </li>
              ))}
            </ol>
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

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-3 text-[11px] text-muted">
        {full?.sourceUrl ? (
          <a
            href={full.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent hover:underline"
          >
            원문 보기{korean ? " (KIPRIS)" : ""}
          </a>
        ) : (
          !initial.loading && <span>원문 링크 없음</span>
        )}
        {full?.fetchedAt && <span>수집 {formatDate(full.fetchedAt)}</span>}
        {korean && (
          <button
            type="button"
            disabled={refresh.loading || initial.loading}
            onClick={runRefresh}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refresh.loading ? "KIPRIS 조회 중…" : "KIPRIS 최신 정보 가져오기"}
          </button>
        )}
        <span aria-live="polite" className={refresh.error ? "text-red-200" : "text-accent"}>
          {refresh.error ? `갱신 실패: ${refresh.error}` : refresh.at ? `${refresh.at} 갱신됨` : ""}
        </span>
      </div>
    </section>
  );
}

async function fetchPatent(id: string, refresh: boolean, signal: AbortSignal): Promise<PatentFull> {
  const res = await fetch(`/api/patent/${encodeURIComponent(id)}${refresh ? "?refresh=1" : ""}`, {
    signal,
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(readErrorMessage(body) ?? `HTTP ${res.status}`);
  if (!isPatentFull(body)) throw new Error("특허 상세 응답 형식이 올바르지 않습니다.");
  return body;
}

function isPatentFull(v: unknown): v is PatentFull {
  if (typeof v !== "object" || v === null) return false;
  const p = v as { id?: unknown; title?: unknown; cpcLabels?: unknown };
  return typeof p.id === "string" && typeof p.title === "string" && Array.isArray(p.cpcLabels);
}
