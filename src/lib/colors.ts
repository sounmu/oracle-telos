// 클라이언트/서버 공용. 지도·범례·배지 색은 여기 한 곳에서만 정의한다.
import type { Decision } from "./types";

export const DECISION_COLORS: Record<Decision, string> = {
  ACCEPTED: "#34d399", // emerald-400
  REJECTED: "#f87171", // red-400
  PENDING: "#9ca3af", // gray-400
  UNKNOWN: "#64748b",
};

export const DECISION_LABELS: Record<Decision, string> = {
  ACCEPTED: "승인",
  REJECTED: "거절",
  PENDING: "심사중",
  UNKNOWN: "상태 미확인",
};
