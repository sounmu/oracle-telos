// 클라이언트·서버 공용. 세션 = 마스터 DB를 보는 조회 조건 (필터, 정렬, 개수).
import type { Decision, PatentPoint } from "./types";

export type SortKey = "filed_desc" | "filed_asc" | "similarity";

export interface SessionView {
  /** 보여 줄 심사 상태. 전부 고르면 상태 조건 없음 */
  decisions: Decision[];
  /** 하위 분류 4자리(예: A61B). null이면 전체 */
  cpc: string | null;
  /** 가져올 최대 건수. 0이면 제한 없음 */
  limit: number;
  sort: SortKey;
}

export const ALL_DECISIONS: Decision[] = ["ACCEPTED", "REJECTED", "PENDING", "UNKNOWN"];

/** 기본 조회: 전체 상태, 전체 분야, 최신 출원 200건 */
export const DEFAULT_VIEW: SessionView = {
  decisions: ALL_DECISIONS,
  cpc: null,
  limit: 200,
  sort: "filed_desc",
};

export const LIMIT_OPTIONS = [50, 200, 0] as const;

/**
 * 조회 조건을 적용한다. similarity 정렬은 검색 점수(scores)가 있을 때만 의미가 있고, 없으면 최신순으로 대체한다.
 */
export function applyView<T extends Pick<PatentPoint, "id" | "decision" | "cpc" | "filed">>(
  points: readonly T[],
  view: SessionView,
  scores?: ReadonlyMap<string, number>,
): T[] {
  let rows = points.filter(
    (p) =>
      view.decisions.includes(p.decision) && (view.cpc === null || p.cpc.startsWith(view.cpc)),
  );
  const useScores = view.sort === "similarity" && scores !== undefined && scores.size > 0;
  if (useScores) {
    rows = rows
      .filter((p) => scores.has(p.id))
      .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
  } else if (view.sort === "filed_asc") {
    rows = [...rows].sort((a, b) => a.filed.localeCompare(b.filed));
  } else {
    rows = [...rows].sort((a, b) => b.filed.localeCompare(a.filed));
  }
  return view.limit > 0 ? rows.slice(0, view.limit) : rows;
}
