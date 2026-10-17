// 서버 전용. 모델이 만든 기술 요소별 비교를 원문으로 검증해 화면에 보낼 비교표로 만든다.
import { truncate } from "../patents";
import { proximityOf } from "../proximity";
import type {
  ClaimElementRow,
  ClaimElementStatus,
  ComparisonRelation,
  ComparisonRow,
  KoreanPatentDocument,
  PatentComparison,
} from "../types";

export const COMPARE_CLAIM_LIMIT = 5;
const CLAIM_CHARS = 1500;
const MIN_EVIDENCE_CHARS = 6;
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

/** 모델에 보내는 원문. 검증도 같은 범위로 하므로 보내지 않은 청구항을 근거로 인정하지 않는다. */
export function comparisonSource(document: KoreanPatentDocument): string {
  return [
    `발명의 명칭: ${document.title}`,
    `초록: ${truncate(document.patent.abstract, 3000)}`,
    ...document.patent.claims.slice(0, COMPARE_CLAIM_LIMIT).map((claim, position) => `청구항 ${position + 1}: ${truncate(claim, CLAIM_CHARS)}`),
  ].join("\n");
}

function comparable(value: string): string {
  return value.normalize("NFKC").replace(/[\s"'“”‘’「」『』…]+/g, "").toLowerCase();
}

function quoted(quote: string | null, source: string, min: number): boolean {
  return quote !== null && comparable(quote).length >= min && source.includes(comparable(quote));
}

/**
 * 청구항 1 구성요소 대비표. 구성 문구는 청구항 1 원문에, 대응 문구는 내 설명에 그대로 있어야 인정한다.
 * 구성 문구가 원문에 없으면 표에서 빼고 개수만 남긴다(근접도에서 '확인 필요'로 센다).
 * 대응 문구가 내 설명에 없으면 present·modified를 unconfirmed로 내린다.
 */
export function finalizeClaimChart(
  draft: DraftComparison["claimElements"],
  document: KoreanPatentDocument,
  idea: string,
): { chart: ClaimElementRow[]; unverified: number } {
  const first = document.patent.claims[0];
  if (!first) return { chart: [], unverified: 0 };
  const claim = comparable(truncate(first, CLAIM_CHARS));
  const mineSource = comparable(idea);
  const chart: ClaimElementRow[] = [];
  let unverified = 0;
  for (const row of draft) {
    const element = row.element.trim();
    if (!quoted(element, claim, MIN_EVIDENCE_CHARS)) {
      unverified += 1;
      continue;
    }
    const mine = row.mine?.trim() || null;
    const matched = row.status === "present" || row.status === "modified";
    const grounded = matched && quoted(mine, mineSource, MIN_MINE_CHARS);
    chart.push({
      element,
      status: matched && !grounded ? "unconfirmed" : row.status,
      mine: grounded ? mine : null,
      note: row.note.trim() || "내 설명과 대응되는지 확인하지 못했어요.",
    });
  }
  return { chart, unverified };
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
  const { chart, unverified } = finalizeClaimChart(draft.claimElements, document, idea);
  return {
    patentId: document.id,
    summary: draft.summary.trim(),
    rows,
    claimChart: chart,
    proximity: proximityOf(chart, unverified),
    claimsReviewed: Math.min(document.patent.claims.length, COMPARE_CLAIM_LIMIT),
    claimsTotal: document.patent.claims.length,
    sourceUrl: document.url,
  };
}
