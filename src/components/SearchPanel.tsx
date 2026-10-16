"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { DECISION_COLORS, DECISION_LABELS } from "@/lib/colors";
import type { AgentEvent, SearchHit } from "@/lib/types";

interface Props {
  disabled: boolean;
  onMatches: (hits: SearchHit[], replace: boolean) => void;
  onPick: (id: string) => void;
  selectedId: string | null;
}

type Phase = "idle" | "running" | "done" | "error";

const EXAMPLES = [
  "반려동물 사진을 찍으면 AI가 건강 상태를 분석해 맞춤 사료를 추천하는 앱",
  "스마트 거울이 사용자의 피부 상태를 매일 기록하고 화장품을 추천",
  "드론이 농지를 촬영해 병충해를 조기에 탐지하는 서비스",
];

export default function SearchPanel({ disabled, onMatches, onPick, selectedId }: Props) {
  const [idea, setIdea] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [toolLog, setToolLog] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hitsRef = useRef<SearchHit[]>([]);

  function reset() {
    setStatus("");
    setToolLog([]);
    setAnswer("");
    hitsRef.current = [];
    setHits([]);
    setError(null);
  }

  /** 여러 번의 검색 결과를 id 기준으로 합치고(높은 점수 유지) 부모에 알린다 */
  function mergeHits(incoming: SearchHit[]) {
    const map = new Map(hitsRef.current.map((h) => [h.id, h]));
    for (const h of incoming) {
      const old = map.get(h.id);
      if (!old || old.score < h.score) map.set(h.id, h);
    }
    const merged = [...map.values()].sort((a, b) => b.score - a.score);
    hitsRef.current = merged;
    setHits(merged);
    onMatches(merged, true);
  }

  async function runQuickSearch() {
    if (!idea.trim()) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    reset();
    setPhase("running");
    setStatus("임베딩 유사도로 찾는 중…");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: idea, k: 12 }),
        signal: ac.signal,
      });
      const data = (await res.json()) as { hits?: SearchHit[]; error?: string };
      if (!res.ok || !data.hits) throw new Error(data.error ?? `HTTP ${res.status}`);
      mergeHits(data.hits);
      setStatus("");
      setPhase("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message);
      setPhase("error");
    }
  }

  async function runAgent() {
    if (!idea.trim()) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    reset();
    setPhase("running");
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6)) as AgentEvent;
          finished = handleEvent(event) || finished;
        }
      }
      setPhase((p) => (p === "error" ? p : "done"));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message);
      setPhase("error");
    }
  }

  /** true를 돌려주면 스트림 종료 */
  function handleEvent(event: AgentEvent): boolean {
    switch (event.type) {
      case "status":
        setStatus(event.message);
        return false;
      case "tool":
        setStatus(
          event.name === "search_patents"
            ? `🔎 검색: ${String(event.input.query ?? "")}`
            : `📄 청구항 확인: ${String(event.input.id ?? "")}`,
        );
        setToolLog((log) => [
          ...log,
          event.name === "search_patents"
            ? `검색 “${String(event.input.query ?? "")}”`
            : `청구항 확인 #${String(event.input.id ?? "")}`,
        ]);
        return false;
      case "matches":
        mergeHits(event.hits);
        return false;
      case "text":
        setStatus("✍️ 분석 작성 중…");
        setAnswer((a) => a + event.delta);
        return false;
      case "done":
        setStatus("");
        return true;
      case "error":
        setError(event.message);
        setPhase("error");
        setStatus("");
        return true;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setPhase("idle");
    setStatus("");
  }

  const running = phase === "running";

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <label className="mb-2 block text-xs font-medium text-muted">
          구상 중인 아이디어를 적어 주세요
        </label>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runAgent();
          }}
          placeholder="예) AI가 반려동물 사진으로 건강 상태를 분석해 사료를 추천하는 앱"
          rows={4}
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted/60 focus:border-accent"
        />
        {!idea && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setIdea(ex)}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted hover:border-accent hover:text-foreground"
              >
                {ex.slice(0, 22)}…
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={disabled || running || !idea.trim()}
            onClick={runAgent}
            className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-background hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            AI 분석 ⌘↵
          </button>
          <button
            type="button"
            disabled={disabled || running || !idea.trim()}
            onClick={runQuickSearch}
            className="rounded-lg border border-border px-3 py-2 text-sm hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            유사 특허만 찾기
          </button>
          {running && (
            <button
              type="button"
              onClick={stop}
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
            >
              중지
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {(status || toolLog.length > 0) && (
          <div className="border-b border-border px-4 py-3 text-xs">
            {status && (
              <div className="flex items-center gap-2 text-accent">
                {running && (
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
                )}
                {status}
              </div>
            )}
            {toolLog.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-muted">
                {toolLog.map((t, i) => (
                  <li key={i}>· {t}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && (
          <div className="m-4 rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        {hits.length > 0 && (
          <div className="border-b border-border px-4 py-3">
            <div className="mb-2 text-xs font-medium text-muted">
              유사 특허 {hits.length}건 · 지도에 표시됨
            </div>
            <ul className="space-y-1">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => onPick(h.id)}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/5 ${
                      selectedId === h.id ? "bg-white/10" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: DECISION_COLORS[h.decision] }}
                      />
                      <span className="shrink-0 text-muted">
                        {DECISION_LABELS[h.decision]} · {(h.score * 100).toFixed(0)}%
                      </span>
                      <span className="truncate">{h.title}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {answer && (
          <div className="prose-telos px-4 py-4 text-sm">
            <ReactMarkdown>{answer}</ReactMarkdown>
          </div>
        )}

        {phase === "idle" && !answer && hits.length === 0 && (
          <div className="px-4 py-6 text-xs leading-relaxed text-muted">
            <p>
              <b className="text-foreground">AI 분석</b>: Claude 에이전트가 영어로 특허를 여러 번
              검색하고 청구항까지 읽은 뒤 유사점·차이점·거절 사례·방향을 정리합니다.
            </p>
            <p className="mt-2">
              <b className="text-foreground">유사 특허만 찾기</b>: 임베딩 유사도만으로 즉시
              찾습니다. API 키 없이 동작합니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
