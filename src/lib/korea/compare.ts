// 서버 전용. 모델이 만든 기술 요소별 비교를 원문으로 검증해 화면에 보낼 비교표로 만든다.
import { truncate } from "../patents";
import { dedupeClaimRows, normalizeQuote, proximityOf } from "../proximity";
import type {
  ClaimCompleteness,
  ClaimElementRow,
  ClaimElementStatus,
  ComparisonRelation,
  ComparisonRow,
  KoreanPatentDocument,
  PatentComparison,
} from "../types";

export const COMPARE_CLAIM_LIMIT = 5;
/** 종속항은 참고용이라 짧게 자른다 */
const CLAIM_CHARS = 1500;
/** 청구항 1은 구성요소 대비의 기준이므로 통째로 보낸다. 이 길이를 넘으면 잘렸다고 표시하고 전체 대응을 판정하지 않는다 */
export const FIRST_CLAIM_CHARS = 6000;
const MIN_EVIDENCE_CHARS = 6;
/** 연결 문구·수량 표현을 뺀 뒤 이 길이 이상 남은 청구항 1 문구는 대비표에 빠진 구성으로 본다("펌프"처럼 짧은 구성도 잡는다) */
const MIN_UNCOVERED_CHARS = 2;
const MAX_UNCOVERED = 3;
/** 내 설명 인용은 "PLGA"처럼 짧을 수 있다 */
const MIN_MINE_CHARS = 2;

export interface DraftComparison {
  readonly summary: string;
  readonly rows: readonly {
    readonly mine: string | null;
    readonly theirs: string | null;
    readonly relation: ComparisonRelation;
    readonly note: string;
    readonly evidence: string | null;
  }[];
  readonly claimElements: readonly {
    readonly element: string;
    readonly status: ClaimElementStatus;
    readonly mine: string | null;
    readonly note: string;
  }[];
}

/** 모델에 보내는 청구항 1 원문. 대비표 검증도 이 문자열을 기준으로 한다 */
export function firstClaimSent(document: KoreanPatentDocument): string {
  return truncate(document.patent.claims[0] ?? "", FIRST_CLAIM_CHARS);
}

/** 모델에 보내는 원문. 검증도 같은 범위로 하므로 보내지 않은 청구항을 근거로 인정하지 않는다. */
export function comparisonSource(document: KoreanPatentDocument): string {
  return [
    `발명의 명칭: ${document.title}`,
    `초록: ${truncate(document.patent.abstract, 3000)}`,
    ...document.patent.claims
      .slice(0, COMPARE_CLAIM_LIMIT)
      .map((claim, position) => `청구항 ${position + 1}: ${position === 0 ? truncate(claim, FIRST_CLAIM_CHARS) : truncate(claim, CLAIM_CHARS)}`),
  ].join("\n");
}

const comparable = normalizeQuote;

function quoted(quote: string | null, source: string, min: number): boolean {
  return quote !== null && comparable(quote).length >= min && source.includes(comparable(quote));
}

/** 정규화 기준으로 같은 문구를 원문(공백·인용부호 포함)에서 찾는 정규식 */
function tolerantPattern(quote: string): RegExp | null {
  const key = comparable(quote);
  if (key.length === 0) return null;
  const chars = Array.from(key).map((ch) => ch.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"));
  return new RegExp(chars.join("[\\s\"'“”‘’「」『』…]*"), "gi");
}

/** 구성이 아닌 연결 문구·수량 표현·조사·문장부호. 정규화된(공백 없는) 문구에서 제거한다 */
const CONNECTIVES = [
  "것을특징으로하는", "특징으로하는", "에있어서", "으로이루어지는", "로이루어지는", "로이루어진", "포함하여구성되는", "포함하여이루어지는",
  "포함하는", "포함하고", "포함하며", "포함하되", "포함한다", "구성되는", "구성된", "구비하는", "구비하고", "구비한", "이루어지는", "이루어진",
  "적어도하나", "하나이상", "그리고", "각각", "복수", "다수", "소정", "일정", "서로", "또는", "상기", "로서", "로써", "으로", "에서", "에게", "부터", "까지",
  "및", "와", "과", "를", "을", "는", "은", "이", "가", "에", "의", "로", "도", "제",
];
const CONNECTIVE_PATTERN = new RegExp(`${CONNECTIVES.join("|")}|[\\p{P}\\p{S}\\p{N}]`, "gu");
/** 청구항 번호와 "…에 있어서," / "…로서," 꼴 전제 문구. 첫 구성 앞에서만 지우고, 남는 문구는 다른 구간과 같이 검사한다 */
const PREAMBLE = /^\s*(?:\d+\s*\.\s*)?(?:[^;,]*?(?:에\s*있어서|에\s*관한\s*것으로|으로서|로서|로써)\s*,?)?\s*/u;
/** "…를 포함하는 X."처럼 마지막 구성 뒤에 붙는 종결 주어. 쉼표·세미콜론으로 이어지는 추가 한정이 없을 때만 */
const CLOSING_SUBJECT = /^(?:[을를이가은는]|으로|로)?\s*(?:것을\s*)?(?:특징으로\s*하는|포함하는|포함하여\s*(?:구성되는|이루어지는|된)|구비하는|구성되는|이루어지는|이루어진)\s*[^;,]*$/u;

function substantive(segment: string): string {
  return comparable(segment).replace(CONNECTIVE_PATTERN, "");
}

/** 화면용: 앞뒤의 문장부호와 "및·또는"을 떼어 낸다 */
function tidy(segment: string): string {
  return segment.replace(/^(?:\s*(?:및|또는|[;,.:·]))*\s*/u, "").replace(/(?:\s*(?:및|또는|제\s*\d+|[;,.:·]))*\s*$/u, "");
}

/**
 * 청구항 1 원문에서 대비표의 구성 문구와 발명의 명칭을 지운 뒤 남는 문구.
 * 첫 구성 앞에서는 청구항 번호와 "…에 있어서," 꼴 전제 문구만 지우고(그 뒤에 남는 구성은 누락으로 본다),
 * "…를 포함하는 X." 꼴의 종결 주어는 구성으로 세지 않는다.
 * 연결 문구를 빼고도 MIN_UNCOVERED_CHARS 이상 남으면 모델이 빠뜨린 구성일 수 있어 돌려준다(전체 대응 판정을 막는 데 쓴다).
 */
export function uncoveredClaimText(claim: string, elements: readonly string[], title: string): string[] {
  const MARK = "\u0000";
  let text = claim.normalize("NFKC");
  for (const element of elements) {
    const pattern = tolerantPattern(element);
    if (pattern) text = text.replace(pattern, MARK);
  }
  const titlePattern = tolerantPattern(title);
  if (titlePattern) text = text.replace(titlePattern, "");
  const segments = text.split(MARK).map((segment) => segment.trim());
  if (segments.length < 2) return [];
  segments[0] = segments[0].replace(PREAMBLE, "");
  const last = segments[segments.length - 1].replace(/[.。]\s*$/u, "").trim();
  if (CLOSING_SUBJECT.test(last)) segments.pop();
  return segments
    .filter((segment) => substantive(segment).length >= MIN_UNCOVERED_CHARS)
    .slice(0, MAX_UNCOVERED)
    .map((segment) => truncate(tidy(segment), 80));
}

export interface FinalizedClaimChart {
  readonly chart: ClaimElementRow[];
  /** 모델이 냈지만 청구항 1 원문에서 찾지 못한 구성 수(중복 제거 뒤) */
  readonly unverified: number;
  readonly completeness: ClaimCompleteness;
}

/**
 * 청구항 1 구성요소 대비표. 구성 문구는 청구항 1 원문에, 대응 문구는 내 설명에 그대로 있어야 인정한다.
 * 구성 문구가 원문에 없으면 표에서 빼고 개수만 남긴다(근접도에서 '확인 필요'로 센다).
 * 대응 문구가 내 설명에 없으면 present·modified를 unconfirmed로 내린다.
 * 같은 구성이 여러 행이면 하나로 합치고(dedupeClaimRows), 모델에 보낸 청구항 1이 잘렸는지와
 * 대비표에 담기지 않은 원문이 남는지를 completeness로 함께 돌려준다.
 */
export function finalizeClaimChart(
  draft: DraftComparison["claimElements"],
  document: KoreanPatentDocument,
  idea: string,
): FinalizedClaimChart {
  const first = document.patent.claims[0];
  if (!first) return { chart: [], unverified: 0, completeness: { truncated: false, uncovered: [] } };
  const sent = firstClaimSent(document);
  const claim = comparable(sent);
  const mineSource = comparable(idea);
  const rows: ClaimElementRow[] = [];
  const unverifiedKeys = new Set<string>();
  for (const row of draft) {
    const element = row.element.trim();
    if (!quoted(element, claim, MIN_EVIDENCE_CHARS)) {
      unverifiedKeys.add(comparable(element));
      continue;
    }
    const mine = row.mine?.trim() || null;
    const matched = row.status === "present" || row.status === "modified";
    const grounded = matched && quoted(mine, mineSource, MIN_MINE_CHARS);
    rows.push({
      element,
      status: matched && !grounded ? "unconfirmed" : row.status,
      mine: grounded ? mine : null,
      note: row.note.trim() || "내 설명과 대응되는지 확인하지 못했어요.",
    });
  }
  const chart = dedupeClaimRows(rows);
  return {
    chart,
    unverified: unverifiedKeys.size,
    completeness: {
      truncated: first.length > FIRST_CLAIM_CHARS,
      uncovered: uncoveredClaimText(sent, chart.map((row) => row.element), document.title),
    },
  };
}

/**
 * 인용이 원문에 그대로 있을 때만 common/different를 인정한다.
 * 근거가 없으면 '확인되지 않음'(theirs=null, unconfirmed)으로 내려 추측을 비교 결과로 보여주지 않는다.
 */
export function finalizeComparison(
  draft: DraftComparison,
  elements: readonly string[],
  document: KoreanPatentDocument,
  idea: string,
): PatentComparison {
  const source = comparable(comparisonSource(document));
  const rows: ComparisonRow[] = elements.map((element, position) => {
    const row = draft.rows[position];
    const mine = row?.mine?.trim() || null;
    const theirs = row?.theirs?.trim() || null;
    const relation = row?.relation ?? "unconfirmed";
    const evidence = row?.evidence?.trim() || null;
    const grounded = evidence !== null &&
      comparable(evidence).length >= MIN_EVIDENCE_CHARS &&
      source.includes(comparable(evidence));
    const confirmed = grounded && mine !== null && theirs !== null && relation !== "unconfirmed";
    return {
      element,
      mine,
      theirs: confirmed ? theirs : null,
      relation: confirmed ? relation : "unconfirmed",
      note: row?.note?.trim() || "원문에서 이 요소를 확인하지 못했습니다. 전체 명세서를 확인하세요.",
      evidence: confirmed ? evidence : null,
    };
  });
  const { chart, unverified, completeness } = finalizeClaimChart(draft.claimElements, document, idea);
  return {
    patentId: document.id,
    summary: draft.summary.trim(),
    rows,
    claimChart: chart,
    proximity: proximityOf(chart, { unverified, completeness }),
    claimsReviewed: Math.min(document.patent.claims.length, COMPARE_CLAIM_LIMIT),
    claimsTotal: document.patent.claims.length,
    sourceUrl: document.url,
  };
}
