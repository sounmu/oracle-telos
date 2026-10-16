export type Decision = "ACCEPTED" | "REJECTED" | "PENDING" | "UNKNOWN";

export const DECISIONS: Decision[] = ["ACCEPTED", "REJECTED", "PENDING", "UNKNOWN"];

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
  sourceUrl?: string;
  fetchedAt?: string;
  rawStatus?: string;
  applicants?: string[];
  claims?: string[];
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
  | { type: "references"; hits: ResearchHit[] }
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

export type PatentDataset = "korea" | "sample";
export type ResearchSource = "kipris" | "law" | "dart";

interface ResearchDocumentBase {
  readonly id: string;
  readonly sourceId: string;
  readonly version: string;
  readonly title: string;
  readonly text: string;
  readonly url: string;
  readonly publishedAt: string | null;
  readonly fetchedAt: string;
}

export interface KoreanPatentDocument extends ResearchDocumentBase {
  readonly source: "kipris";
  readonly patent: {
    readonly applicationNumber: string;
    readonly publicationNumber: string;
    readonly filingDate: string;
    readonly cpc: string[];
    readonly applicants: string[];
    readonly decision: Decision;
    readonly rawStatus: string;
    readonly abstract: string;
    readonly claims: string[];
  };
}

export interface LawDocument extends ResearchDocumentBase {
  readonly source: "law";
  readonly law: {
    readonly lawId: string;
    readonly mst: string;
    readonly articleNumber: string;
    readonly versionEffectiveFrom: string;
    readonly effectiveFrom: string;
    readonly effectiveTo: string | null;
    readonly promulgatedAt: string;
    readonly state: "current" | "scheduled" | "historical";
  };
}

export interface DisclosureDocument extends ResearchDocumentBase {
  readonly source: "dart";
  readonly disclosure: {
    readonly corpCode: string;
    readonly corpName: string;
    readonly receiptNo: string;
    readonly reportName: string;
    readonly reportDate: string;
    readonly section: string;
    readonly correction: boolean;
  };
}

export type ResearchDocument =
  | KoreanPatentDocument
  | LawDocument
  | DisclosureDocument;

export interface CollectOptions {
  readonly query: string;
  readonly limit: number;
  readonly since?: string;
  readonly until?: string;
  readonly corpCodes?: readonly string[];
  readonly signal?: AbortSignal;
}

export interface CollectionResult {
  readonly documents: ResearchDocument[];
  readonly warnings: string[];
}

export interface ResearchChunk {
  readonly id: string;
  readonly documentId: string;
  readonly text: string;
  readonly hash: string;
  readonly vector: number[];
}

export interface ResearchIndex {
  readonly schemaVersion: 1;
  readonly model: string;
  readonly dim: number;
  readonly builtAt: string;
  readonly documents: ResearchDocument[];
  readonly chunks: ResearchChunk[];
  readonly points: PatentPoint[];
}

export interface ResearchHit {
  readonly id: string;
  readonly source: ResearchSource;
  readonly title: string;
  readonly excerpt: string;
  readonly url: string;
  readonly publishedAt: string | null;
  readonly fetchedAt: string;
  readonly version: string;
  readonly score: number;
}

export interface ResearchStatus {
  readonly builtAt: string | null;
  readonly model: string;
  readonly sources: {
    readonly source: ResearchSource;
    readonly configured: boolean;
    readonly count: number;
  }[];
}

export interface PatentMapResponse {
  readonly dataset: PatentDataset;
  readonly points: PatentPoint[];
  readonly builtAt: string | null;
  readonly status: ResearchStatus;
}
