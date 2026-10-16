// 클라이언트·서버 공용. 기능 카탈로그: 사업 단계(4) × 판단 대상(5) 체계의 기능 6개.
import type { Phase } from "./phaseFeatures";

export type Target = "지형" | "아이디어" | "개별 특허" | "사례" | "지표";

export type FeatureId = "overview" | "locate" | "compare" | "cases" | "density" | "empty";

export interface FeatureDef {
  id: FeatureId;
  label: string;
  phase: Phase;
  target: Target;
  /** 한 줄 설명 (명령 막대와 대시보드에 보인다) */
  summary: string;
  /** 해커톤 이후로 미룬 기능이면 설명을 남긴다 */
  deferred?: string;
}

export const FEATURES: FeatureDef[] = [
  { id: "overview", label: "지형 보기", phase: "explore", target: "지형", summary: "분야와 상태, 출원 추이를 한눈에 본다" },
  { id: "locate", label: "아이디어 위치 찾기", phase: "explore", target: "아이디어", summary: "아이디어가 지도 어디에 놓이는지 보고 가까운 특허를 찾는다" },
  { id: "compare", label: "요소 비교", phase: "verify", target: "개별 특허", summary: "고른 특허와 내 아이디어의 공통 용어와 차이를 본다" },
  { id: "cases", label: "연결 사례", phase: "risk", target: "사례", summary: "검색 결과와 관련된 분쟁 사례를 찾는다" },
  { id: "density", label: "주변 밀집도", phase: "risk", target: "지표", summary: "주변 특허 수와 사례 수를 따로 본다 (합산 점수는 보류)" },
  { id: "empty", label: "빈 자리 찾기", phase: "explore", target: "지형", summary: "특허가 없고 주변에는 있는 영역을 찾는다", deferred: "기회 판단은 실험 전까지 참고용" },
];

export const FEATURE_BY_ID: Record<FeatureId, FeatureDef> = Object.fromEntries(
  FEATURES.map((f) => [f.id, f]),
) as Record<FeatureId, FeatureDef>;

/** 기능이 보여 주는 화면: 아이디어 입력 패널이 필요한지 */
export function needsIdeaPanel(id: FeatureId): boolean {
  return id === "locate";
}
