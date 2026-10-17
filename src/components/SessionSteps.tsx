"use client";

import { useState } from "react";
import { ACTIVE_CASES } from "@/lib/cases";
import { countWithin, estimatePosition, linkedCases, type Neighbor } from "@/lib/phaseFeatures";
import { STEP_LABELS, type Session, type StepIndex, type Template } from "@/lib/sessions";
import type { PatentDataset, PatentPoint } from "@/lib/types";

/** 4단계 스텝퍼. 지금까지 도달한 단계만 눌러서 갈 수 있다 */
export function Stepper({ reached, current, onGo }: { reached: StepIndex; current: StepIndex; onGo: (i: StepIndex) => void }) {
  return (
    <nav aria-label="진행 단계" className="flex flex-wrap items-center gap-1.5">
      {STEP_LABELS.map((label, i) => {
        const idx = i as StepIndex;
        const on = idx === current;
        const enabled = idx <= reached;
        return (
          <button
            key={label}
            type="button"
            disabled={!enabled}
            aria-current={on ? "step" : undefined}
            onClick={() => onGo(idx)}
            className={`flex min-h-9 items-center gap-2 rounded-full px-3 text-[13px] font-semibold transition ${
              on ? "bg-foreground text-panel" : enabled ? "bg-panel text-ink-2 hover:text-foreground" : "bg-panel/60 text-muted opacity-50"
            }`}
          >
            <span className="tabular-nums">{i + 1}</span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

/** 홈 하단의 새 대화 입력. 보내면 세션이 열리고 입력 단계로 간다 */
export function NewChatBar({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const value = text.trim();
        if (value.length < 5) return;
        onSubmit(value);
        setText("");
      }}
      className="pointer-events-auto flex gap-2 rounded-2xl bg-panel/95 p-2 shadow-sm backdrop-blur-sm"
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="사업 아이템을 적고 시작하세요 (5자 이상)"
        aria-label="새 대화 입력"
        className="min-h-10 min-w-0 flex-1 rounded-xl bg-background px-3 text-[15px] text-foreground placeholder:text-muted"
      />
      <button type="submit" disabled={text.trim().length < 5} className="min-h-10 shrink-0 rounded-xl bg-foreground px-4 font-semibold text-panel disabled:opacity-40">
        시작
      </button>
    </form>
  );
}

/** ① 입력: 문장을 템플릿 칸으로 나눈다. 확정한 템플릿이 탐색의 검색 조건이 된다 */
export function InputStep({ session, onConfirm }: { session: Session; onConfirm: (tpl: Template) => void }) {
  const [draft, setDraft] = useState<Template>(session.tpl ?? { item: "", tech: "", target: "", risk: "" });
  const set = (k: keyof Template) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));
  const ready = draft.item.trim().length >= 2;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-2xl bg-panel p-5">
        <label className="block text-[13px] font-semibold text-muted" htmlFor="tpl-item">아이템</label>
        <textarea id="tpl-item" value={draft.item} onChange={set("item")} rows={3} className="mt-1 w-full rounded-xl bg-background p-3 text-[15px]" />
        <Field id="tpl-tech" label="핵심 기술" value={draft.tech} onChange={set("tech")} placeholder="예: 미세입자 제조공법, 망상구조" />
        <Field id="tpl-target" label="대상 고객" value={draft.target} onChange={set("target")} placeholder="예: 성형외과, 피부과" />
        <Field id="tpl-risk" label="우려하는 분쟁 분야" value={draft.risk} onChange={set("risk")} placeholder="예: 제조공법 특허" />
        <p className="mt-3 text-[12px] text-muted">템플릿 칸은 다음 단계 검색 조건이 됩니다. 빈 칸은 무시합니다.</p>
      </div>
      <div className="flex justify-end">
        <button type="button" disabled={!ready} onClick={() => onConfirm({ ...draft, item: draft.item.trim() })} className="min-h-11 rounded-xl bg-foreground px-5 font-semibold text-panel disabled:opacity-40">
          탐색으로 →
        </button>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string }) {
  return (
    <div className="mt-3">
      <label className="block text-[13px] font-semibold text-muted" htmlFor={id}>{label}</label>
      <input id={id} value={value} onChange={onChange} placeholder={placeholder} className="mt-1 w-full rounded-xl bg-background p-3 text-[15px]" />
    </div>
  );
}

/** 내 아이템의 지도 위치를 임베딩 이웃으로 추정한다 (샘플 데이터셋에서만 동작) */
export async function locateIdea(idea: string, dataset: PatentDataset): Promise<{ x: number; y: number; neighbors: Neighbor[] }> {
  const res = await fetch("/api/locate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea, k: 8, dataset }),
  });
  const body = (await res.json().catch(() => null)) as { neighbors?: Neighbor[]; error?: string } | null;
  if (!res.ok || !body?.neighbors) throw new Error(body?.error ?? `HTTP ${res.status}`);
  const pos = estimatePosition(body.neighbors);
  if (!pos) throw new Error("가까운 특허를 찾지 못해 위치를 계산할 수 없습니다.");
  return { ...pos, neighbors: body.neighbors };
}

/** ③ 검증 패널: 연결 사례와 밀집도를 따로 보여 준다. 합산 점수는 보이지 않는다 */
export function VerifyPanel({
  points,
  hitIds,
  selected,
}: {
  points: PatentPoint[];
  hitIds: string[];
  selected: PatentPoint | null;
}) {
  const byId = new Map(points.map((p) => [p.id, p]));
  const hits = hitIds.map((id) => byId.get(id)).filter((p): p is PatentPoint => Boolean(p));
  const cases = linkedCases(hits, ACTIVE_CASES);
  const radius = radiusOf(points);
  const density = selected ? countWithin(points, selected, radius) : null;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-background p-3">
          <div className="text-[12px] text-muted">연결된 분쟁 사례</div>
          <div className="text-xl font-bold tabular-nums">{cases.length}건</div>
          <div className="text-[11px] text-muted">검색 결과와 키워드 2개 이상 겹침</div>
        </div>
        <div className="rounded-xl bg-background p-3">
          <div className="text-[12px] text-muted">선택한 특허 주변 밀집도</div>
          <div className="text-xl font-bold tabular-nums">{density === null ? "–" : `${density}건`}</div>
          <div className="text-[11px] text-muted">{selected ? "반경 안 특허 수" : "특허를 고르면 표시"}</div>
        </div>
      </div>
      {hitIds.length === 0 && (
        <p className="rounded-xl bg-background p-3 text-[13px] text-muted">탐색 단계에서 검색하면 검색 결과를 기준으로 연결 사례와 밀집도를 봅니다.</p>
      )}
      {cases.map((c) => (
        <div key={c.id} className="rounded-xl bg-background p-3 text-[13px]">
          <div className="font-semibold">{c.title}</div>
          <div className="text-muted">겹친 검색 결과 특허 {c.count}건</div>
        </div>
      ))}
      <p className="text-[12px] text-muted">밀집도와 사례 수는 따로 봅니다. 합산 위험 점수는 계산식을 검증한 뒤에 보입니다.</p>
    </div>
  );
}

function radiusOf(points: PatentPoint[]): number {
  if (points.length === 0) return 0;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.06;
}

/** ④ 요약: ①~③ 내용을 리포트 형식으로 정리한다 */
export function ReportPanel({
  session,
  hits,
  cases,
  location,
}: {
  session: Session;
  hits: PatentPoint[];
  cases: { id: string; title: string; count: number }[];
  location: { x: number; y: number } | null;
}) {
  const tpl = session.tpl;
  const real = hits.filter((p) => p.source !== "dummy").length;
  const dummy = hits.length - real;
  return (
    <article className="report mx-auto max-w-2xl space-y-4 rounded-2xl bg-panel p-6 text-[14px] leading-relaxed">
      <div className="flex items-center justify-between gap-3 noprint">
        <h2 className="text-[17px] font-bold">사업 아이템 리포트</h2>
        <button type="button" onClick={() => window.print()} className="min-h-9 rounded-xl bg-background px-3 font-semibold">인쇄 / PDF 저장</button>
      </div>
      <section>
        <h3 className="font-bold">① 입력</h3>
        <p>아이템: {tpl?.item || "-"}</p>
        <p className="text-muted">핵심 기술: {tpl?.tech || "-"} · 대상: {tpl?.target || "-"} · 우려 분야: {tpl?.risk || "-"}</p>
      </section>
      <section>
        <h3 className="font-bold">② 탐색</h3>
        <p>검색 결과 {hits.length}건 (실제 자료 {real}건, 더미 {dummy}건)</p>
        {location && <p className="text-muted">지도 위 내 아이템 위치(추정)를 계산해 표시했습니다.</p>}
        <ol className="list-decimal pl-5">
          {hits.slice(0, 5).map((p) => (
            <li key={p.id}>{p.title.slice(0, 80)} ({p.filed}){p.source === "dummy" ? " · 더미" : ""}</li>
          ))}
        </ol>
      </section>
      <section>
        <h3 className="font-bold">③ 검증</h3>
        {cases.length === 0 ? <p>연결된 분쟁 사례 없음</p> : (
          <ul className="list-disc pl-5">
            {cases.map((c) => <li key={c.id}>{c.title} · 겹친 특허 {c.count}건</li>)}
          </ul>
        )}
      </section>
      <section className="text-muted">
        <h3 className="font-bold text-foreground">확인 필요</h3>
        <p>이 리포트는 시연 데이터(실제 자료와 더미 포함)로 만든 결과입니다. 법적 판단과 특허 동일성 판단은 전문가 검토가 필요합니다.</p>
      </section>
    </article>
  );
}
