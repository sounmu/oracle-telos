// 클라이언트·서버 공용. 분쟁 위험도 배경 그라데이션의 계산만 담는다 (그리기는 PatentMap).
import type { DisputeCase } from "./types";

// 한 단어만 겹치면 엉뚱한 특허가 많이 걸리므로 2개 이상 겹쳐야 사례와 연결한다 (caseMap과 같은 기준)
const MIN_SHARED = 2;

function matcher(keyword: string): (text: string) => boolean {
  if (/^[ -~]+$/.test(keyword)) {
    const re = new RegExp(`(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`);
    return (text) => re.test(text);
  }
  return (text) => text.includes(keyword);
}

/** 사례마다 키워드가 2개 이상 겹치는 점의 인덱스. 연결되지 않은 사례는 빈 배열 */
export function caseHits(
  points: readonly { title: string; abstract: string }[],
  cases: readonly DisputeCase[],
): number[][] {
  const texts = points.map((p) => `${p.title} ${p.abstract}`.toLowerCase());
  return cases.map((item) => {
    const keywords = [...new Set(item.keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 2))];
    if (keywords.length < MIN_SHARED) return [];
    const tests = keywords.map(matcher);
    const hits: number[] = [];
    texts.forEach((text, i) => {
      let shared = 0;
      for (const test of tests) if (test(text)) shared += 1;
      if (shared >= MIN_SHARED) hits.push(i);
    });
    return hits;
  });
}

export interface RiskCell {
  /** 셀 중심 (기본 캔버스 좌표) */
  x: number;
  y: number;
  /** 0~1. 밀집도 × 사례 도달도 */
  value: number;
}

/**
 * 격자 셀마다 두 값을 구해 곱한다.
 * - 밀집도: 반경 안에 비슷한 특허가 얼마나 몰려 있는지 (최대값으로 0~1 정규화)
 * - 사례 도달도: 반경 안에 키워드가 겹친 특허가 있는 분쟁 사례 수 / 전체 사례 수
 * 사례가 없으면 밀집도만 0.3배로 반영한다. 법적 위험도가 아니라 추정 지표다.
 */
export function riskField(
  nodes: readonly { bx: number; by: number }[],
  hits: readonly (readonly number[])[],
  cell = 24,
  radius = 48,
): RiskCell[] {
  if (!nodes.length) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.bx); maxX = Math.max(maxX, n.bx);
    minY = Math.min(minY, n.by); maxY = Math.max(maxY, n.by);
  }
  const cols = Math.ceil((maxX - minX + radius * 2) / cell);
  const rows = Math.ceil((maxY - minY + radius * 2) / cell);
  const r2 = radius * radius;
  const cells: { x: number; y: number; density: number; reach: number }[] = [];
  let maxDensity = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cx = minX - radius + (col + 0.5) * cell;
      const cy = minY - radius + (row + 0.5) * cell;
      let density = 0;
      for (const n of nodes) {
        const dx = n.bx - cx, dy = n.by - cy;
        if (dx * dx + dy * dy <= r2) density += 1;
      }
      if (density === 0) continue;
      let reach = 0;
      for (const caseHitIds of hits) {
        if (caseHitIds.some((i) => {
          const dx = nodes[i].bx - cx, dy = nodes[i].by - cy;
          return dx * dx + dy * dy <= r2;
        })) reach += 1;
      }
      maxDensity = Math.max(maxDensity, density);
      cells.push({ x: cx, y: cy, density, reach });
    }
  }
  const total = hits.length || 1;
  return cells
    .map((c) => ({
      x: c.x,
      y: c.y,
      value: (c.density / maxDensity) * (hits.length ? 0.3 + 0.7 * (c.reach / total) : 0.3),
    }))
    .filter((c) => c.value >= 0.05);
}
