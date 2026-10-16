// 클라이언트/서버 공용. 지도·범례·배지 색은 여기 한 곳에서만 정의한다.
import type { Decision } from "./types";

/** 지도 점·범례 점 색. 밝은 바탕(#f2f4f6·#ffffff)에서 구분되도록 한 단계 진하게 둔다 */
export const DECISION_COLORS: Record<Decision, string> = {
  ACCEPTED: "#12b886", // 초록
  REJECTED: "#f04452", // 빨강
  PENDING: "#adb5bd", // 회색
  UNKNOWN: "#868e96",
};

/** 목록·상세의 상태 배지(옅은 바탕 + 진한 글자) */
export const DECISION_TAG_STYLES: Record<Decision, { bg: string; ink: string }> = {
  ACCEPTED: { bg: "#e5f8ef", ink: "#0b8a5a" },
  REJECTED: { bg: "#ffeeee", ink: "#d22030" },
  PENDING: { bg: "#f2f4f6", ink: "#4e5968" },
  UNKNOWN: { bg: "#f2f4f6", ink: "#6b7684" },
};

export const DECISION_LABELS: Record<Decision, string> = {
  ACCEPTED: "승인",
  REJECTED: "거절",
  PENDING: "심사중",
  UNKNOWN: "상태 미확인",
};
