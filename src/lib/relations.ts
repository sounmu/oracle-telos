// 클라이언트·서버 공용. 점 사이의 관계선. 위치가 가까워서가 아니라 인용 관계나 같은 분류로 잇는다.
import type { Decision, PatentPoint } from "./types";

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

/** 인용 목록 날짜는 종류가 출원일일 때만 출원일로 쓴다. 공개·등록일 등은 빈 값(미상) */
export function citationFiled(n: { date: string; dateKind: string }): string {
  return n.dateKind === "출원일" ? n.date : "";
}

export interface CitationPass {
  real: boolean;
  /** 선택한 특허에 닿는 선 */
  selected: boolean;
  edges: CitationEdge[];
}

/**
 * 인용선을 그리는 순서대로 묶는다: 일반 가짜 → 일반 실제 → 선택 가짜 → 선택 실제.
 * 선택 강조에서도 실제/가짜(실선/점선) 구분을 유지하고, 양끝이 모두 보이는 선만 넣는다.
 */
export function citationPasses(
  edges: readonly CitationEdge[],
  points: readonly Pick<PatentPoint, "id" | "decision">[],
  visible: ReadonlySet<Decision>,
  selectedId: string | null,
): CitationPass[] {
  const passes: CitationPass[] = [
    { real: false, selected: false, edges: [] },
    { real: true, selected: false, edges: [] },
    { real: false, selected: true, edges: [] },
    { real: true, selected: true, edges: [] },
  ];
  for (const e of edges) {
    const a = points[e.from], b = points[e.to];
    if (!visible.has(a.decision) || !visible.has(b.decision)) continue;
    const selected = selectedId !== null && (a.id === selectedId || b.id === selectedId);
    passes[(selected ? 2 : 0) + (e.real ? 1 : 0)].edges.push(e);
  }
  return passes;
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
