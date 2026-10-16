"use client";

import { useEffect, useRef, useState } from "react";
import type { ResearchDocument, ResearchHit, ResearchSource, ResearchStatus } from "@/lib/types";

// 표시용 헬퍼는 src/lib이 아니라 여기 둔다: src/lib에는 서버 전용 모듈이 섞여 있어 컴포넌트에서 import하지 않는다 (AGENTS.md §7.3)
export function readErrorMessage(body: unknown): string | null {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return null;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "일자 미상";
  const m = /^\d{4}-\d{2}-\d{2}/.exec(iso);
  return m ? m[0] : iso;
}

/** 검색 점수는 순위용 정규화 값이지 확률이 아니므로 퍼센트로 표기하지 않는다 */
export function scoreLabel(score: number): string {
  return `검색 점수 ${score.toFixed(2)}`;
}

export interface ReferencesState {
  requested: boolean;
  loading: boolean;
  hits: ResearchHit[];
  error: string | null;
}

export const IDLE_REFERENCES: ReferencesState = {
  requested: false,
  loading: false,
  hits: [],
  error: null,
};

const SOURCE_LABELS: Record<ResearchSource, string> = {
  kipris: "특허",
  law: "법령",
  dart: "공시",
};

// 환경변수 이름만 안내한다. 값(비밀 키)은 절대 화면에 올리지 않는다
const SOURCE_ENV: Record<ResearchSource, string> = {
  kipris: "KIPRIS_API_KEY",
  law: "LAW_OC",
  dart: "DART_API_KEY",
};

const SOURCE_SYNC: Record<ResearchSource, string> = {
  kipris: 'pnpm sync:korea --source kipris --query "반려동물"',
  law: 'pnpm sync:korea --source law --query "검색어"',
  dart: "pnpm sync:korea --source dart --corp-code <DART 고유번호> --since YYYY-MM-DD --until YYYY-MM-DD",
};

const LAW_STATE: Record<"current" | "scheduled" | "historical", string> = {
  current: "현행",
  scheduled: "시행 예정",
  historical: "과거 버전",
};

interface Props {
  state: ReferencesState;
  status: ResearchStatus | null;
}

export default function ResearchReferences({ state, status }: Props) {
  const supplementary = status?.sources.filter((s) => s.source !== "kipris") ?? [];
  const emptySources = supplementary.filter((s) => s.count === 0);
  const showEmpty = !state.loading && !state.error && state.hits.length === 0;

  return (
    <section aria-label="법령·공시 참고 자료" className="border-b border-border px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="font-medium text-muted">참고 자료 (법령·공시)</span>
        <span className="text-[11px] text-muted/80">보조 근거 · 특허 결과와 별개</span>
        {state.loading && (
          <span className="flex items-center gap-1.5 text-accent" aria-live="polite">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
            찾는 중…
          </span>
        )}
      </div>

      {supplementary.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5 text-[11px] text-muted" aria-label="출처 상태">
          {supplementary.map((s) => (
            <li key={s.source} className="rounded-full border border-border px-2 py-0.5">
              {SOURCE_LABELS[s.source]} · API 키 {s.configured ? "설정됨" : "없음"} · 색인{" "}
              {s.count.toLocaleString()}건
            </li>
          ))}
        </ul>
      )}

      {state.error && (
        <div
          role="alert"
          className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          참고 자료 검색 실패: {state.error}
          {state.hits.length > 0 && " (이미 받은 결과는 아래에 유지합니다)"}
        </div>
      )}

      {showEmpty && (
        <div className="text-xs text-muted">
          <p>검색된 참고 자료가 없습니다.</p>
          {emptySources.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-[11px]">
              {emptySources.map((s) => (
                <li key={s.source}>
                  {SOURCE_LABELS[s.source]} 색인이 비어 있습니다. <code>.env</code>에{" "}
                  <code>{SOURCE_ENV[s.source]}</code>를 설정한 뒤{" "}
                  <code className="break-words">{SOURCE_SYNC[s.source]}</code>로 수집하세요.
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state.hits.length > 0 && (
        <ul className="space-y-2" aria-label="참고 자료 목록">
          {state.hits.map((hit) => (
            <ReferenceItem key={hit.id} hit={hit} />
          ))}
        </ul>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-muted/80">
        참고 자료가 없다고 해서 적용되는 법령이나 경쟁사가 없다는 뜻은 아닙니다. 자동 검색 결과이며
        법률 자문이 아닙니다.
      </p>
    </section>
  );
}

function ReferenceItem({ hit }: { hit: ResearchHit }) {
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState<ResearchDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (doc || loading) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/research/document/${encodeURIComponent(hit.id)}`, {
        signal: ac.signal,
      });
      const body: unknown = await res.json().catch(() => null);
      if (ac.signal.aborted) return;
      if (!res.ok || !isResearchDocument(body)) {
        throw new Error(readErrorMessage(body) ?? `HTTP ${res.status}`);
      }
      setDoc(body);
      setLoading(false);
    } catch (err) {
      if (ac.signal.aborted) return;
      setError(err instanceof Error ? err.message : "상세를 불러오지 못했습니다.");
      setLoading(false);
    }
  }

  return (
    <li className="rounded-md border border-border/70 bg-background/40 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
        <span className="rounded-full border border-border px-1.5 py-0.5 font-medium text-foreground">
          {SOURCE_LABELS[hit.source]}
        </span>
        <span>{formatDate(hit.publishedAt)}</span>
        <span>버전 {hit.version || "미상"}</span>
        <span>수집 {formatDate(hit.fetchedAt)}</span>
        <span className="text-muted">{scoreLabel(hit.score)}</span>
      </div>
      <div className="mt-1 break-words font-medium leading-snug">{hit.title}</div>
      <p className="mt-1 line-clamp-3 break-words text-[11px] leading-relaxed text-foreground/75">
        {hit.excerpt}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <a
          href={hit.url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent hover:underline"
        >
          원문 열기
        </a>
        <button
          type="button"
          aria-expanded={open}
          onClick={toggle}
          className="text-accent hover:underline"
        >
          {open ? "상세 접기" : "상세 보기"}
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-md bg-background/60 p-2">
          {loading && <p className="text-[11px] text-muted">상세를 불러오는 중…</p>}
          {error && (
            <p role="alert" className="text-[11px] text-red-700">
              상세를 불러오지 못했습니다: {error}
            </p>
          )}
          {doc && <DocumentDetails doc={doc} />}
        </div>
      )}
    </li>
  );
}

function DocumentDetails({ doc }: { doc: ResearchDocument }) {
  const rows = detailRows(doc);
  return (
    <div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="break-words text-foreground/80">{value}</dd>
          </div>
        ))}
      </dl>
      {doc.text && (
        <p className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-foreground/75">
          {doc.text}
        </p>
      )}
      <a
        href={doc.url}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-2 inline-block text-[11px] text-accent hover:underline"
      >
        원문 열기
      </a>
    </div>
  );
}

function detailRows(doc: ResearchDocument): [string, string][] {
  switch (doc.source) {
    case "law":
      return [
        ["법령 ID", doc.law.lawId],
        ["조문", doc.law.articleNumber || "전체"],
        ["시행", `${doc.law.effectiveFrom} ~ ${doc.law.effectiveTo ?? "현재"}`],
        ["공포", doc.law.promulgatedAt],
        ["상태", LAW_STATE[doc.law.state]],
        ["버전", doc.version],
        ["수집", formatDate(doc.fetchedAt)],
      ];
    case "dart":
      return [
        ["회사", doc.disclosure.corpName],
        ["보고서", doc.disclosure.reportName],
        ["접수번호", doc.disclosure.receiptNo],
        ["보고일", doc.disclosure.reportDate],
        ["항목", doc.disclosure.section || "본문"],
        ["정정", doc.disclosure.correction ? "정정 공시" : "원본"],
        ["버전", doc.version],
        ["수집", formatDate(doc.fetchedAt)],
      ];
    case "kipris":
      return [
        ["출원번호", doc.patent.applicationNumber],
        ["원문 상태", doc.patent.rawStatus],
        ["버전", doc.version],
        ["수집", formatDate(doc.fetchedAt)],
      ];
  }
}

function isResearchDocument(v: unknown): v is ResearchDocument {
  if (typeof v !== "object" || v === null) return false;
  const d = v as { id?: unknown; source?: unknown };
  return typeof d.id === "string" && (d.source === "law" || d.source === "dart" || d.source === "kipris");
}
