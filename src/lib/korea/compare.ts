// 서버 전용. 모델이 만든 기술 요소별 비교를 원문으로 검증해 화면에 보낼 비교표로 만든다.
import { truncate } from "../patents";
import { proximityOf } from "../proximity";
import type { ComparisonRelation, ComparisonRow, KoreanPatentDocument, PatentComparison } from "../types";

export const COMPARE_CLAIM_LIMIT = 5;
const CLAIM_CHARS = 1500;
const MIN_EVIDENCE_CHARS = 6;

export interface DraftComparison {
  readonly summary: string;
  readonly rows: readonly {
    readonly mine: string | null;
    readonly theirs: string | null;
    readonly relation: ComparisonRelation;
    readonly note: string;
    readonly evidence: string | null;
  }[];
}

/** 모델에 보내는 원문. 검증도 같은 범위로 하므로 보내지 않은 청구항을 근거로 인정하지 않는다. */
export function comparisonSource(document: KoreanPatentDocument): string {
  return [
    `발명의 명칭: ${document.title}`,
    `초록: ${truncate(document.patent.abstract, 3000)}`,
    ...document.patent.claims.slice(0, COMPARE_CLAIM_LIMIT).map((claim) => `청구항: ${truncate(claim, CLAIM_CHARS)}`),
  ].join("\n");
}

function comparable(value: string): string {
  return value.normalize("NFKC").replace(/[\s"'“”‘’「」『』…]+/g, "").toLowerCase();
}

/**
 * 인용이 원문에 그대로 있을 때만 common/different를 인정한다.
 * 근거가 없으면 '확인되지 않음'(theirs=null, unconfirmed)으로 내려 추측을 비교 결과로 보여주지 않는다.
 */
export function finalizeComparison(
  draft: DraftComparison,
  elements: readonly string[],
  document: KoreanPatentDocument,
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
  return {
    patentId: document.id,
    summary: draft.summary.trim(),
    rows,
    proximity: proximityOf(rows),
    claimsReviewed: Math.min(document.patent.claims.length, COMPARE_CLAIM_LIMIT),
    claimsTotal: document.patent.claims.length,
    sourceUrl: document.url,
  };
}
