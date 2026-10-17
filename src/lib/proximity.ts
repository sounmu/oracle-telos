// 클라이언트/서버 공용. 기술 근접도 단계 규칙과 표시 문구·색, 규칙의 근거를 여기 한 곳에서 정의한다.
// 임베딩 점수나 비율 구간이 아니라, 특허 청구항 1의 구성요소가 내 기술 설명에 모두 있는지(구성요소 완비 원칙)로 정한다.
import type { ClaimCompleteness, ClaimElementRow, ClaimElementStatus, Proximity, ProximityLevel } from "./types";

/** 구성이 하나뿐이면 청구항을 나눈 것으로 보기 어렵다 */
const MIN_ELEMENTS = 2;

/** 인용 비교용 정규화: NFKC, 공백·인용부호 제거, 소문자. 원문 대조와 중복 판정이 같은 기준을 쓴다 */
export function normalizeQuote(value: string): string {
  return value.normalize("NFKC").replace(/[\s"'“”‘’「」『』…]+/g, "").toLowerCase();
}

const CONFLICT_NOTE = "같은 구성에 대한 판정이 서로 달라 확인이 필요해요.";

/**
 * 정규화한 구성 문구가 같은 행을 하나로 합친다(공백·인용부호만 다른 중복 포함).
 * 상태가 서로 다르면 어느 쪽도 믿지 않고 '확인 필요'로 남긴다. 중복으로 구성 수나 대응 수가 늘지 않는다.
 */
export function dedupeClaimRows(chart: readonly ClaimElementRow[]): ClaimElementRow[] {
  const byKey = new Map<string, ClaimElementRow>();
  for (const row of chart) {
    const key = normalizeQuote(row.element);
    const kept = byKey.get(key);
    if (!kept) byKey.set(key, row);
    else if (kept.status !== row.status) byKey.set(key, { element: kept.element, status: "unconfirmed", mine: null, note: CONFLICT_NOTE });
  }
  return [...byKey.values()];
}

export interface ProximityInput {
  /** 모델이 냈지만 청구항 1 원문에서 찾지 못한 구성 수 */
  readonly unverified?: number;
  readonly completeness?: ClaimCompleteness;
}

const COMPLETE: ClaimCompleteness = { truncated: false, uncovered: [] };

/**
 * 판정 순서는 법리 순서를 따른다. 화면의 PROXIMITY_RULES와 같은 순서여야 한다.
 * 1. 내 설명에 없는 구성이 하나라도 있으면 서늘 — 구성요소 완비 원칙(98후836): 구성이 모두 있어야 권리범위에 속한다.
 *    원문에서 확인한 구성이 하나뿐이어도 그 구성이 없으면 서늘이다.
 * 2. 판단 근거가 부족하면 자료 부족 — 구성이 2개 미만, 청구항 1이 잘림, 대비표에 담기지 않은 원문이 남음, 대응 미확인 구성.
 *    1번을 배제할 수 없으므로 단정하지 않는다.
 * 3. 다른 수단으로 바뀐 구성이 있으면 따뜻 — 균등 여부를 따로 따져야 하는 경우(2017후424).
 * 4. 모든 구성이 같으면 뜨거움.
 * 수치 구간·가중치는 쓰지 않는다.
 */
export function proximityOf(chart: readonly ClaimElementRow[], input: ProximityInput = {}): Proximity {
  const rows = dedupeClaimRows(chart);
  const unverified = input.unverified ?? 0;
  const completeness = input.completeness ?? COMPLETE;
  const counts = {
    present: 0,
    modified: 0,
    absent: 0,
    unconfirmed: unverified,
    total: rows.length + unverified,
  } satisfies Record<ClaimElementStatus, number> & { total: number };
  for (const row of rows) counts[row.status] += 1;
  const commonElements = rows.filter((row) => row.status === "present").map((row) => row.element);
  const base = { counts, commonElements, completeness };
  const verified = rows.length;

  if (counts.absent > 0) {
    return {
      ...base,
      level: "cool",
      reason: `청구항 1의 구성 ${counts.total}개 중 ${counts.absent}개가 내 설명에 없어요. 구성이 하나라도 없으면 그 청구항과 같은 구성으로 보지 않아요.`,
    };
  }
  if (verified < MIN_ELEMENTS) {
    return {
      ...base,
      level: "insufficient",
      reason: `청구항 1을 원문 그대로 나눈 구성이 ${verified}개뿐이라 판단하지 않았어요.`,
    };
  }
  if (completeness.truncated) {
    return {
      ...base,
      level: "insufficient",
      reason: "청구항 1이 길어 앞부분만 확인했어요. 뒤쪽 구성이 내 설명에 있는지는 보지 못했어요.",
    };
  }
  if (counts.unconfirmed > 0) {
    return {
      ...base,
      level: "insufficient",
      reason: `청구항 1의 구성 ${counts.total}개 중 ${counts.unconfirmed}개는 내 설명과 대응되는지 확인하지 못했어요.`,
    };
  }
  if (completeness.uncovered.length > 0) {
    return {
      ...base,
      level: "insufficient",
      reason: `청구항 1 원문 중 대비표에 담기지 않은 문구가 있어요: “${completeness.uncovered[0]}”. 전체 구성을 확인하지 못했어요.`,
    };
  }
  if (counts.modified > 0) {
    return {
      ...base,
      level: "warm",
      reason: `청구항 1의 구성 ${counts.total}개가 모두 내 설명에 대응되지만 ${counts.modified}개는 다른 수단이에요. 바뀐 구성은 균등 여부를 따로 따져야 해요.`,
    };
  }
  return {
    ...base,
    level: "hot",
    reason: `청구항 1의 구성 ${counts.total}개가 모두 내 설명에 있어요.`,
  };
}

/** 화면 숫자: 청구항 1 구성 중 내 설명에 대응되는(같거나 다른 수단) 구성 수. 판단하지 않은 경우 null */
export function coverageOf(proximity: Proximity): { matched: number; total: number } | null {
  if (proximity.level === "insufficient" || proximity.counts.total === 0) return null;
  return { matched: proximity.counts.present + proximity.counts.modified, total: proximity.counts.total };
}

export const PROXIMITY_LABELS: Record<ProximityLevel, { title: string; message: string }> = {
  cool: { title: "서늘", message: "청구항 구성 중 내 설명에 없는 것이 있어요" },
  warm: { title: "따뜻", message: "구성은 모두 대응되지만 다른 수단이 섞여 있어요" },
  hot: { title: "뜨거움", message: "청구항 구성이 모두 내 설명에 있어요. 자세히 비교해 봐요" },
  insufficient: { title: "자료 부족", message: "판단할 근거가 부족해요" },
};

export const CLAIM_STATUS_LABELS: Record<ClaimElementStatus, string> = {
  present: "같음",
  modified: "다른 수단",
  absent: "설명에 없음",
  unconfirmed: "확인 필요",
};

/** 단계별 판정 규칙. 화면의 "왜 이 단계인가요?"에 그대로 보여 준다 */
export const PROXIMITY_RULES: readonly { level: ProximityLevel; rule: string }[] = [
  { level: "cool", rule: "청구항 1의 구성 중 하나라도 내 설명에 없어요." },
  { level: "insufficient", rule: "청구항을 원문 그대로 2개 이상으로 나누지 못했거나, 청구항 1이 잘렸거나 대비표에 담기지 않은 원문이 남았거나, 대응을 확인하지 못한 구성이 있어요." },
  { level: "warm", rule: "모든 구성이 대응되지만 하나 이상이 다른 수단으로 바뀌어 있어요." },
  { level: "hot", rule: "모든 구성이 내 설명에 같은 형태로 있어요." },
];

/** 규칙의 근거. 판결 요지는 공개 판례이며, 화면에는 출처와 요지만 짧게 보여 준다 */
export const PROXIMITY_SOURCES: readonly { title: string; point: string; url: string }[] = [
  {
    title: "대법원 2001. 6. 15. 선고 98후836 판결",
    point: "특허발명의 각 구성요소와 그 유기적 결합관계가 대상 발명에 그대로 포함돼야 권리범위에 속한다(구성요소 완비 원칙).",
    url: "https://casenote.kr/대법원/98후836",
  },
  {
    title: "대법원 2019. 1. 31. 선고 2017후424 판결",
    point: "구성이 바뀐 경우에는 과제 해결원리의 동일성, 실질적으로 같은 작용효과, 변경의 용이성으로 균등 여부를 따진다.",
    url: "https://casenote.kr/대법원/2017후424",
  },
];

// 특허 상태 색(초록·빨강·회색)과 겹치지 않도록 파랑·노랑·주황·보라 계열을 쓴다.
export const PROXIMITY_COLORS: Record<ProximityLevel, string> = {
  cool: "#7dd3fc",
  warm: "#fcd34d",
  hot: "#fb923c",
  insufficient: "#c4b5fd",
};
