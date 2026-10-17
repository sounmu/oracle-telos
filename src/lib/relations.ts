// 클라이언트·서버 공용. 점 사이의 관계선. 위치가 가까워서가 아니라 인용 관계나 같은 분류로 잇는다.
import type { PatentPoint } from "./types";

export interface CitationEdge {
  /** 인용한 특허의 인덱스 */
  from: number;
  /** 인용된 특허의 인덱스 */
  to: number;
  /** 양쪽 모두 실제 자료일 때만 true. 더미가 끼면 가짜 인용이다 */
  real: boolean;
}

/** 점 목록 안에서 인용 관계를 선으로 바꾼다. 목록에 없는 대상은 건너뛴다 */
export function citationEdges(points: readonly Pick<PatentPoint, "id" | "source" | "cites">[]): CitationEdge[] {
  const index = new Map(points.map((p, i) => [p.id, i]));
  const edges: CitationEdge[] = [];
  points.forEach((p, from) => {
    for (const id of p.cites ?? []) {
      const to = index.get(id);
      if (to === undefined || to === from) continue;
      edges.push({ from, to, real: p.source !== "dummy" && points[to].source !== "dummy" });
    }
  });
  return edges;
}

/**
 * 같은 CPC 하위 분류(예: A61B)를 공유하는 점끼리, 각 점마다 가까운 이웃 perNode개까지 잇는다.
 * 반환값은 points 배열의 인덱스 쌍. 중복 쌍은 한 번만 넣는다.
 */
export function sameCpcEdges(
  points: readonly Pick<PatentPoint, "cpc" | "x" | "y">[],
  perNode = 2,
): Array<[number, number]> {
  const groups = new Map<string, number[]>();
  points.forEach((p, i) => {
    const key = p.cpc.slice(0, 4);
    if (key.length < 4) return;
    const list = groups.get(key) ?? [];
    list.push(i);
    groups.set(key, list);
  });
  const seen = new Set<number>();
  const edges: Array<[number, number]> = [];
  for (const members of groups.values()) {
    for (const i of members) {
      const near = members
        .filter((j) => j !== i)
        .map((j) => ({ j, d: (points[i].x - points[j].x) ** 2 + (points[i].y - points[j].y) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, perNode);
      for (const { j } of near) {
        const key = Math.min(i, j) * points.length + Math.max(i, j);
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push([i, j]);
      }
    }
  }
  return edges;
}
