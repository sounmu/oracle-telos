// 클라이언트·서버 공용. 탐색·검증 화면의 리포트 계산 (순수 함수).
import type { PatentPoint } from "./types";

/** 입력 문장을 템플릿 칸으로 나눈다. 칸은 사용자가 고칠 수 있고 빈 칸은 조회에서 무시한다 */
export interface TemplateDraft {
  item: string;
  tech: string;
  target: string;
  risk: string;
}

const STOP = new Set(["그리고", "위한", "하는", "있는", "있다", "통해", "대한", "및", "또는", "하여", "으로", "에서", "the", "and", "for", "with", "of", "a", "an", "to", "in", "on", "by", "or"]);
const TARGET_WORDS = ["환자", "의사", "병원", "고객", "사용자", "소비자", "학생", "운전자", "농가", "기업"];
const RISK_HINTS: [string, string][] = [
  ["제조", "제조공법"],
  ["공정", "제조공법"],
  ["방법", "제조공법"],
  ["장치", "장치 구조"],
  ["알고리즘", "소프트웨어"],
  ["조성물", "조성물"],
];

/** 입력 문장을 템플릿 초안으로 바꾼다 (규칙 기반). 자동으로 고른 값은 사용자가 확인한다 */
export function toTemplate(text: string): TemplateDraft {
  const item = text.trim();
  const words = item.normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !STOP.has(w));
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const tech = [...freq].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 3).map(([w]) => w).join(" ");
  const target = TARGET_WORDS.find((w) => item.includes(w)) ?? "";
  const risk = RISK_HINTS.find(([k]) => item.includes(k))?.[1] ?? "";
  return { item, tech, target, risk };
}

/** 조회에 쓸 검색어: 아이템, 핵심 기술, 대상, 우려 분야를 이어 붙인다 (비어 있는 칸은 건너뛴다) */
export function queryOf(tpl: TemplateDraft): string {
  return [tpl.item, tpl.tech, tpl.target, tpl.risk].map((s) => s.trim()).filter(Boolean).join(" ");
}

/** 출원 연도별 개수 (추세) */
export function yearTrend(points: readonly Pick<PatentPoint, "filed">[]): { year: number; count: number }[] {
  const m = new Map<number, number>();
  for (const p of points) {
    const y = Number(p.filed.slice(0, 4));
    if (Number.isFinite(y) && y > 1900) m.set(y, (m.get(y) ?? 0) + 1);
  }
  return [...m].map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year);
}

export interface DenseRegion {
  count: number;
  /** 이 영역에서 가장 많은 분야(하위 분류) */
  topCpc: string;
  /** 영역의 대표 특허 제목 */
  example: string;
  /** 영역에 속한 특허 id 전체 */
  ids: string[];
  /** 영역 무게중심에 가장 가까운 특허 id (지도에서 '중심'으로 표시) */
  centerId: string;
  x: number;
  y: number;
}

/** 점이 많이 모인 격자 칸 n개 (2건 이상인 칸만) */
export function denseRegions(points: readonly Pick<PatentPoint, "id" | "title" | "cpc" | "x" | "y">[], n = 3, divisions = 6): DenseRegion[] {
  if (points.length < 2) return [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const cell = Math.max(maxX - minX, maxY - minY) / divisions || 1;
  const cells = new Map<string, typeof points[number][]>();
  for (const p of points) {
    const key = `${Math.floor((p.x - minX) / cell)}:${Math.floor((p.y - minY) / cell)}`;
    cells.set(key, [...(cells.get(key) ?? []), p]);
  }
  return [...cells.values()]
    .filter((g) => g.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, n)
    .map((g) => {
      const cpcCount = new Map<string, number>();
      for (const p of g) cpcCount.set(p.cpc.slice(0, 4), (cpcCount.get(p.cpc.slice(0, 4)) ?? 0) + 1);
      const topCpc = [...cpcCount].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      const cx = g.reduce((s, p) => s + p.x, 0) / g.length;
      const cy = g.reduce((s, p) => s + p.y, 0) / g.length;
      const center = g.reduce((best, p) => (Math.hypot(p.x - cx, p.y - cy) < Math.hypot(best.x - cx, best.y - cy) ? p : best));
      return { count: g.length, topCpc, example: center.title, ids: g.map((p) => p.id), centerId: center.id, x: cx, y: cy };
    });
}

/** 유사도 점수를 퍼센트 문구로 */
export function similarityText(score: number): string {
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
}
