export type Decision = "ACCEPTED" | "REJECTED" | "PENDING";

export const DECISIONS: Decision[] = ["ACCEPTED", "REJECTED", "PENDING"];

/** 서버 전용 전체 레코드 (data/patents.full.json) */
export interface PatentFull {
  id: string; // application_number
  publication: string;
  title: string;
  decision: Decision;
  cpc: string; // main_cpc_label
  cpcLabels: string[];
  filed: string; // YYYY-MM-DD
  abstract: string; // 전체 요약
  firstClaim: string; // 첫 번째 청구항 (1,500자 제한)
  x: number;
  y: number;
}

/** 클라이언트가 받는 가벼운 점 (public/data/patents.json) */
export type PatentPoint = Pick<
  PatentFull,
  "id" | "title" | "decision" | "cpc" | "filed" | "x" | "y"
> & { abstract: string /* 300자 내외 */ };

export interface SearchHit {
  id: string;
  title: string;
  decision: Decision;
  cpc: string;
  filed: string;
  score: number; // 코사인 유사도 0..1
  abstract: string; // 400자 내외
}

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "tool"; name: string; input: Record<string, unknown> }
  | { type: "matches"; query: string; hits: SearchHit[] }
  | { type: "text"; delta: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface DatasetMeta {
  model: string;
  dim: number;
  count: number;
  builtAt: string;
  source: string;
}
