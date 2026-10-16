// 분쟁 사례를 지도 위에 놓는다. 사례의 특허번호는 대부분 미국·유럽 번호라 지도 점(출원번호)과 바로 이어지지 않아서,
// 사례 키워드가 2개 이상 제목·초록에 들어 있는 특허를 모아 그 묶음의 중심 특허 옆에 표시한다. 정확한 특허 위치가 아니다.
import type { DisputeCase, PatentPoint } from "./types";

export interface CaseLocation {
  readonly caseId: string;
  /** 표시 기준이 되는 지도 점. 겹친 특허 가운데 다른 특허와 가장 가까운 점 */
  readonly anchorId: string;
  /** 키워드가 겹친 지도 점 id → 겹친 키워드 수 */
  readonly matches: ReadonlyMap<string, number>;
}

const MAX_MATCHES = 12;
// 한 단어만 겹치면 엉뚱한 특허가 많이 걸려서(예: 'gel'이 든 기계 특허) 2개부터 인정한다
const MIN_SHARED = 2;

// 영문 키워드는 단어 경계로, 한글 키워드는 부분 문자열로 찾는다
function matcher(keyword: string): (text: string) => boolean {
  if (/^[ -~]+$/.test(keyword)) {
    const re = new RegExp(`(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`);
    return (text) => re.test(text);
  }
  return (text) => text.includes(keyword);
}

/** 사례마다 키워드가 겹치는 지도 점을 찾는다. 겹치는 점이 없는 사례는 빠진다 */
export function locateCases(points: readonly PatentPoint[], cases: readonly DisputeCase[]): CaseLocation[] {
  if (points.length === 0) return [];
  const texts = points.map((p) => `${p.title} ${p.abstract}`.toLowerCase());
  const out: CaseLocation[] = [];
  for (const c of cases) {
    const keywords = [...new Set(c.keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 2))];
    if (keywords.length < MIN_SHARED) continue;
    const tests = keywords.map(matcher);
    const scored: { p: PatentPoint; score: number }[] = [];
    points.forEach((p, i) => {
      const score = tests.filter((t) => t(texts[i])).length;
      if (score >= MIN_SHARED) scored.push({ p, score });
    });
    if (scored.length === 0) continue;
    scored.sort((a, b) => b.score - a.score);
    const picked = scored.slice(0, MAX_MATCHES);
    out.push({
      caseId: c.id,
      anchorId: medoid(picked),
      matches: new Map(picked.map((s) => [s.p.id, s.score])),
    });
  }
  return out;
}

// 가중 거리 합이 가장 작은 점. 묶음이 여러 군집에 흩어져도 빈 공간이 아닌 실제 점 위에 놓인다
function medoid(items: readonly { p: PatentPoint; score: number }[]): string {
  let best = items[0];
  let bestCost = Infinity;
  for (const a of items) {
    let cost = 0;
    for (const b of items) cost += Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) * b.score;
    if (cost < bestCost) {
      bestCost = cost;
      best = a;
    }
  }
  return best.p.id;
}
