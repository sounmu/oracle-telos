"use client";

import { useEffect, useRef, useState } from "react";
import { DECISION_LABELS, DECISION_TAG_STYLES } from "@/lib/colors";
import type { ComparisonState, PatentDataset, PatentFull, PatentPoint } from "@/lib/types";
import { CLAIM_STATUS_LABELS, PROXIMITY_LABELS } from "@/lib/proximity";
import ComparisonView, { AI_KEY_HINT, formatCoverage } from "./Comparison";
import DisputeCases, { matchCases } from "./DisputeCases";
import { formatDate, readErrorMessage, scoreLabel } from "./ResearchReferences";

interface Props {
  point: PatentPoint;
  dataset: PatentDataset;
  score?: number;
  onClose: () => void;
  comparison?: ComparisonState;
  canCompare: boolean;
  /** 서버에 OpenAI 키가 있는지 */
  aiReady?: boolean;
  onCompare: () => void;
  /** 관련 분쟁 사례를 고르고 상담용 요약을 만들 때 쓰는 내 기술 설명 */
  idea?: string;
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
  aiReady = true,
  onCompare,
  idea = "",
}: Props) {
  const [full, setFull] = useState<PatentFull | null>(null);
  const [initial, setInitial] = useState<RequestState>({ loading: true, error: null });
  const [refresh, setRefresh] = useState<RequestState & { at: string | null }>({
    loading: false,
    error: null,
    at: null,
  });
  const [showClaims, setShowClaims] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
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

  const tag = DECISION_TAG_STYLES[decision];
  const related = matchCases(
    [
      idea,
      title,
      abstract,
      ...(comparison?.status === "ready" ? comparison.data.rows.map((r) => r.element) : []),
    ],
    3,
  );

  async function copySummary() {
    const lines = [
      `[Telos 상담용 요약] ${new Date().toLocaleDateString("ko-KR")}`,
      `내 기술: ${idea || "(입력 없음)"}`,
      `비교 특허: ${title} (${point.id.startsWith("kipris:") ? `출원번호 ${point.id.slice(7)}` : `#${point.id}`}, ${DECISION_LABELS[decision]})`,
    ];
    if (comparison?.status === "ready") {
      const c = comparison.data;
      lines.push(`기술 근접도: ${PROXIMITY_LABELS[c.proximity.level].title} (청구항 1 구성 대응 ${formatCoverage(c.proximity)}) · ${c.proximity.reason}`);
      for (const r of c.claimChart) {
        lines.push(`- 청구항 1 "${r.element}" [${CLAIM_STATUS_LABELS[r.status]}]${r.mine ? ` 내 설명: "${r.mine}"` : ""}`);
      }
      for (const r of c.rows) {
        lines.push(
          `- ${r.element} [${r.relation === "common" ? "공통" : r.relation === "different" ? "차이" : "확인 필요"}] 내 기술: ${r.mine ?? "미기재"} / 특허: ${r.theirs ?? "확인되지 않음"}${r.evidence ? ` / 원문: "${r.evidence}"` : ""}`,
        );
      }
    }
    if (full?.sourceUrl) lines.push(`원문: ${full.sourceUrl}`);
    lines.push("※ 기술 요소 비교 자료이며 법률 자문이 아닙니다.");
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied("요약을 복사했어요");
    } catch {
      setCopied("복사하지 못했어요. 브라우저 권한을 확인해 주세요");
    }
  }

  return (
    <section aria-label="특허 상세" className="flex flex-col gap-3 pt-1">
      <button
        type="button"
        onClick={onClose}
        title="결과로 돌아가기 (Esc)"
        className="-ml-2 flex min-h-11 w-fit items-center gap-1 rounded-xl px-2 text-[15px] font-semibold text-ink-2 hover:bg-panel"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.5 4.5L7 10l5.5 5.5" />
        </svg>
        결과로 돌아가기
      </button>

      <header className="rounded-3xl bg-panel p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
          {point.source === "dummy" && (
            <span className="rounded-md bg-[#fff4d6] px-2 py-0.5 font-bold text-[#8a5a00]">더미 데이터 · 시연용</span>
          )}
          <span className="rounded-md px-2 py-0.5 font-bold" style={{ background: tag.bg, color: tag.ink }}>
            {DECISION_LABELS[decision]}
          </span>
          <span className="break-all">
            {point.id.startsWith("kipris:") ? `출원번호 ${point.id.slice(7)}` : `#${point.id}`}
          </span>
          {score !== undefined && <span>{scoreLabel(score)}</span>}
        </div>
        <h1 className="mt-2 break-words text-[22px] font-extrabold leading-snug tracking-tight md:text-2xl">{title}</h1>

        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">출원일</dt>
          <dd className="text-ink-2">{filed || "미상"}</dd>
          <dt className="text-muted">CPC</dt>
          <dd className="break-words text-ink-2">{full && full.cpcLabels.length ? full.cpcLabels.slice(0, 6).join(", ") : cpc || "CPC 없음"}</dd>
          {full?.applicants?.length ? (
            <>
              <dt className="text-muted">출원인</dt>
              <dd className="break-words text-ink-2">{full.applicants.join(", ")}</dd>
            </>
          ) : null}
          {full?.rawStatus && (
            <>
              <dt className="text-muted">원문 상태</dt>
              <dd className="break-words text-ink-2">{full.rawStatus}</dd>
            </>
          )}
          {full?.publication && (
            <>
              <dt className="text-muted">공개번호</dt>
              <dd className="break-words text-ink-2">{full.publication}</dd>
            </>
          )}
        </dl>

        <p className="mt-3 break-words text-[15px] leading-relaxed text-ink-2">{abstract}</p>
        {idea && <p className="mt-3 rounded-2xl bg-background px-4 py-3 text-sm text-ink-2">내 기술 · {idea}</p>}

        {initial.loading && <p className="mt-3 text-sm text-muted">상세 정보를 불러오는 중이에요</p>}
        {initial.error && (
          <p role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            상세 정보를 불러오지 못했어요: {initial.error}
          </p>
        )}
      </header>

      {korean && <ComparisonView
          state={comparison}
          canCompare={canCompare}
          onCompare={onCompare}
          disabledReason={aiReady ? undefined : AI_KEY_HINT}
        />}

      <section aria-label="청구항과 원문" className="rounded-3xl bg-panel p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight">청구항</h2>
          {korean && (
            <button
              type="button"
              disabled={refresh.loading || initial.loading}
              onClick={runRefresh}
              className="min-h-10 rounded-xl bg-background px-3.5 text-sm font-semibold text-ink-2 hover:bg-border disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refresh.loading ? "KIPRIS 조회 중…" : "KIPRIS 최신 정보"}
            </button>
          )}
        </div>
        <p aria-live="polite" className={`mt-1 text-[13px] ${refresh.error ? "text-red-700" : "text-muted"}`}>
          {refresh.error ? `갱신 실패: ${refresh.error}` : refresh.at ? `${refresh.at} 갱신됨` : ""}
        </p>
        {claims.length > 0 ? (
          <div className="mt-2">
            <button
              type="button"
              aria-expanded={showClaims}
              onClick={() => setShowClaims((v) => !v)}
              className="flex min-h-12 w-full items-center justify-between rounded-2xl bg-background px-4 text-[15px] font-semibold"
            >
              {showClaims ? `청구항 ${claims.length}건 접기` : `청구항 ${claims.length}건 보기`}
              <svg viewBox="0 0 20 20" className={`h-5 w-5 text-muted transition ${showClaims ? "rotate-180" : ""}`} aria-hidden="true">
                <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showClaims && (
              <ol className="mt-2 space-y-2 px-1 text-sm leading-relaxed text-ink-2">
                {claims.map((claim, i) => (
                  // 청구항 원문에 번호가 포함되어 있어 별도 번호를 붙이지 않는다
                  <li key={i} className="whitespace-pre-wrap break-words">
                    {claim}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : (
          !initial.loading && <p className="mt-2 text-sm text-muted">청구항 정보가 없어요</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          {full?.sourceUrl ? (
            <a href={full.sourceUrl} target="_blank" rel="noreferrer noopener" className="font-semibold text-accent-strong hover:underline">
              원문 보기{korean ? " (KIPRIS)" : ""}
            </a>
          ) : (
            !initial.loading && <span>원문 링크 없음</span>
          )}
          {full?.fetchedAt && <span>수집 {formatDate(full.fetchedAt)}</span>}
        </div>
      </section>

      <section aria-label="같은 기술로 다툰 분쟁" className="rounded-3xl bg-panel p-5 md:p-6">
        <h2 className="mb-1 text-lg font-bold tracking-tight">같은 기술로 다툰 분쟁</h2>
        <p className="mb-3 text-[13px] text-muted">이 특허와 내 기술의 키워드가 겹치는 분쟁 사례예요.</p>
        <DisputeCases matches={related} openFirst emptyText="이 기술 요소로 다툰 분쟁 사례가 아직 없어요." />
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={copySummary}
          className="min-h-14 flex-1 rounded-2xl bg-accent px-4 text-[17px] font-bold text-white hover:bg-accent-strong"
        >
          상담용 요약 복사
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-14 rounded-2xl bg-accent-soft px-5 text-base font-bold text-accent-strong hover:brightness-95"
        >
          다른 특허 보기
        </button>
      </div>
      <p aria-live="polite" className="min-h-5 text-center text-sm text-ink-2">
        {copied ?? ""}
      </p>
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
