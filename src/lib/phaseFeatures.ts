// 클라이언트·서버 공용. 사업 단계별 기능의 순수 계산 (화면과 API가 함께 쓴다).
import { caseHits } from "./riskField";
import type { DisputeCase, Decision, PatentPoint } from "./types";

export type Phase = "explore" | "verify" | "risk";

export const PHASES: { id: Phase; label: string; question: string }[] = [
  { id: "explore", label: "탐색", question: "내 아이디어는 지형의 어디에 있고, 빈 자리는 어디인가" },
  { id: "verify", label: "검증", question: "가까운 특허와 나는 무엇이 같고 다른가" },
  { id: "risk", label: "리스크", question: "같은 분야에 어떤 분쟁이 있었나" },
];

// ── 탐색: 지형 요약 ────────────────────────────────────────────────

export interface MapOverview {
  total: number;
  byDecision: Record<Decision, number>;
  topCpc: { key: string; count: number }[];
  years: { year: number; count: number }[];
}

/** 점 목록의 상태별 개수, 상위 분야(하위 분류 4자리), 출원 연도별 개수 */
export function mapOverview(points: readonly Pick<PatentPoint, "decision" | "cpc" | "filed">[], topN = 5): MapOverview {
  const byDecision: Record<Decision, number> = { ACCEPTED: 0, REJECTED: 0, PENDING: 0, UNKNOWN: 0 };
  const cpc = new Map<string, number>();
  const years = new Map<number, number>();
  for (const p of points) {
    byDecision[p.decision] += 1;
    if (p.cpc.length >= 4) cpc.set(p.cpc.slice(0, 4), (cpc.get(p.cpc.slice(0, 4)) ?? 0) + 1);
    const year = Number(p.filed.slice(0, 4));
    if (Number.isFinite(year) && year > 1900) years.set(year, (years.get(year) ?? 0) + 1);
  }
  return {
    total: points.length,
    byDecision,
    topCpc: [...cpc].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).slice(0, topN),
    years: [...years].map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year),
  };
}

// ── 탐색: 내 위치 추정 ─────────────────────────────────────────────

export interface Neighbor {
  id: string;
  title: string;
  x: number;
  y: number;
  score: number;
}

/** 가까운 특허 k건의 좌표를 유사도 제곱으로 가중 평균해 내 위치로 본다. 근거가 없으면 null */
export function estimatePosition(neighbors: readonly Neighbor[], k = 5): { x: number; y: number } | null {
  const top = [...neighbors].filter((n) => n.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
  if (top.length === 0) return null;
  let wx = 0, wy = 0, wsum = 0;
  for (const n of top) {
    const w = n.score * n.score;
    wx += n.x * w;
    wy += n.y * w;
    wsum += w;
  }
  return { x: wx / wsum, y: wy / wsum };
}

// ── 검증: 용어 비교 ────────────────────────────────────────────────

const STOP = new Set(["그리고", "위한", "하는", "있는", "있다", "통해", "대한", "및", "또는", "the", "and", "for", "with", "from", "of", "a", "an", "to", "in", "on", "by", "or"]);

/** 텍스트에서 비교에 쓸 용어를 뽑는다 (소문자, 2자 이상, 불용어 제외, 중복 제거) */
export function terms(text: string): string[] {
  const words = text.normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u);
  return [...new Set(words.filter((w) => w.length >= 2 && !STOP.has(w)))];
}

export interface TermComparison {
  /** 아이디어와 특허 원문 모두에 있는 용어 */
  shared: string[];
  /** 아이디어에만 있고 특허에서 확인되지 않은 용어 */
  notFound: string[];
  /** 공통 용어 비율 (아이디어 용어 기준) */
  coverage: number;
}

/** 아이디어 용어가 특허 텍스트에 부분 문자열로 있는지 본다 (한국어 조사 때문에 부분 일치) */
export function compareTerms(idea: string, patentText: string): TermComparison {
  const mine = terms(idea);
  const theirs = patentText.normalize("NFKC").toLowerCase();
  const shared = mine.filter((t) => theirs.includes(t));
  const notFound = mine.filter((t) => !theirs.includes(t));
  return { shared, notFound, coverage: mine.length ? shared.length / mine.length : 0 };
}

// ── 리스크: 사례와 밀집도 (두 값을 나눠 보인다) ───────────────────

/** 주어진 특허들과 키워드가 2개 이상 겹치는 사례 목록 */
export function linkedCases(
  patents: readonly { title: string; abstract: string }[],
  cases: readonly DisputeCase[],
): { id: string; title: string; count: number }[] {
  const hits = caseHits(patents, cases);
  return cases
    .map((c, i) => ({ id: c.id, title: c.title, count: hits[i].length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** 기준점에서 반경 안의 특허 수 */
export function countWithin(points: readonly Pick<PatentPoint, "x" | "y">[], origin: { x: number; y: number }, radius: number): number {
  let n = 0;
  for (const p of points) if (Math.hypot(p.x - origin.x, p.y - origin.y) <= radius) n += 1;
  return n;
}

// ── 포지셔닝: 빈 영역 ──────────────────────────────────────────────

export interface EmptyRegion {
  x: number;
  y: number;
  /** 가까운 특허 3건 (빈 자리 주변이 무엇인지 보여 준다) */
  around: { id: string; title: string; distance: number }[];
}

/**
 * 특허가 없는 격자 칸 중, 주변 칸에는 특허가 있는 곳을 고른다.
 * 기준점이 있으면 가까운 순, 없으면 주변에 특허가 많은 순으로 정렬한다.
 */
export function emptyRegions(
  points: readonly Pick<PatentPoint, "id" | "title" | "x" | "y">[],
  origin: { x: number; y: number } | null,
  k = 5,
  divisions = 20,
): EmptyRegion[] {
  if (points.length === 0) return [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const cell = Math.max(maxX - minX, maxY - minY) / divisions || 1;
  const cols = Math.ceil((maxX - minX) / cell) + 1;
  const rows = Math.ceil((maxY - minY) / cell) + 1;
  const count = new Map<number, number>();
  const key = (c: number, r: number) => r * cols + c;
  for (const p of points) {
    const c = Math.floor((p.x - minX) / cell);
    const r = Math.floor((p.y - minY) / cell);
    count.set(key(c, r), (count.get(key(c, r)) ?? 0) + 1);
  }
  const candidates: { c: number; r: number; populated: number }[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (count.get(key(c, r))) continue;
      let populated = 0;
      for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
        if ((dr || dc) && count.get(key(c + dc, r + dr))) populated += 1;
      }
      if (populated > 0) candidates.push({ c, r, populated });
    }
  }
  const center = (c: number, r: number) => ({ x: minX + (c + 0.5) * cell, y: minY + (r + 0.5) * cell });
  const ranked = candidates
    .map((cand) => ({ ...cand, at: center(cand.c, cand.r) }))
    .sort((a, b) => {
      if (origin) return Math.hypot(a.at.x - origin.x, a.at.y - origin.y) - Math.hypot(b.at.x - origin.x, b.at.y - origin.y);
      return b.populated - a.populated;
    })
    .slice(0, k);
  return ranked.map(({ at }) => ({
    x: at.x,
    y: at.y,
    around: points
      .map((p) => ({ id: p.id, title: p.title, distance: Math.hypot(p.x - at.x, p.y - at.y) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3),
  }));
}
