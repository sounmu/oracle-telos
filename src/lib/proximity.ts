// 클라이언트/서버 공용. 기술 근접도 단계 규칙과 표시 문구·색을 여기 한 곳에서 정의한다.
// 임베딩 점수가 아니라 원문 근거가 확인된 비교표 행만으로 계산한다.
import type { ComparisonRow, Proximity, ProximityLevel } from "./types";

const MIN_CONFIRMED = 2;

export function proximityOf(rows: readonly ComparisonRow[]): Proximity {
  const confirmed = rows.filter((row) => row.relation !== "unconfirmed");
  const common = confirmed.filter((row) => row.relation === "common").map((row) => row.element);
  if (confirmed.length < MIN_CONFIRMED) {
    return {
      level: "insufficient",
      reason: `원문에서 근거를 확인한 기술 요소가 ${confirmed.length}개뿐이라 비교하기 어려워요.`,
      commonElements: common,
    };
  }
  const ratio = common.length / confirmed.length;
  const level: ProximityLevel = ratio >= 2 / 3 ? "hot" : ratio >= 1 / 3 ? "warm" : "cool";
  return {
    level,
    reason: common.length > 0
      ? `근거를 확인한 ${confirmed.length}개 요소 중 ${common.length}개가 겹쳐요: ${common.join(", ")}`
      : `근거를 확인한 ${confirmed.length}개 요소가 모두 달라요.`,
    commonElements: common,
  };
}

export const PROXIMITY_LABELS: Record<ProximityLevel, { title: string; message: string }> = {
  cool: { title: "서늘", message: "다른 점이 많아요" },
  warm: { title: "따뜻", message: "겹치는 기술 요소가 있어요" },
  hot: { title: "뜨거움", message: "가까운 요소가 많아요. 자세히 비교해 봐요" },
  insufficient: { title: "자료 부족", message: "비교할 근거가 부족해요" },
};

// 특허 상태 색(초록·빨강·회색)과 겹치지 않도록 파랑·노랑·주황·보라 계열을 쓴다.
export const PROXIMITY_COLORS: Record<ProximityLevel, string> = {
  cool: "#7dd3fc",
  warm: "#fcd34d",
  hot: "#fb923c",
  insufficient: "#c4b5fd",
};
