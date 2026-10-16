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
  | { type: "points_added"; points: PatentPoint[] }
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

/** KIPRIS 검색 목록 항목. 상세 조회 전에 제목·초록으로 후보를 고르는 데 쓴다. */
export interface SearchCandidate {
  readonly applicationNumber: string;
  readonly title: string;
  readonly abstract: string;
  readonly applicant: string;
  readonly rawStatus: string;
  readonly filingDate: string;
}

export interface DetailResult {
  readonly documents: KoreanPatentDocument[];
  readonly warnings: string[];
}

/** data/korea/queries.json: 정규화한 검색어 → KIPRIS 검색 목록 */
export interface QueryCacheEntry {
  readonly candidates: SearchCandidate[];
  readonly fetchedAt: string;
}

/** 기술 설명을 나눈 기술 요소와 KIPRIS 검색어 묶음 */
export interface SearchPlan {
  readonly elements: string[];
  readonly queries: string[];
}

/** description은 의미 정렬 기준, queries는 KIPRIS 검색어 묶음이다. */
export interface KoreanSearchRequest {
  readonly description: string;
  readonly queries: readonly string[];
}

/** common/different는 원문 인용이 확인된 경우에만 남는다. 그 외는 unconfirmed. */
export type ComparisonRelation = "common" | "different" | "unconfirmed";

export interface ComparisonRow {
  readonly element: string;
  /** 사용자 입력에서 확인한 내용. null이면 미기재 */
  readonly mine: string | null;
  /** 특허 원문에서 확인한 내용. null이면 확인되지 않음 */
  readonly theirs: string | null;
  readonly relation: ComparisonRelation;
  /** 공통점·차이 설명 또는 추가로 확인할 질문 */
  readonly note: string;
  /** 원문에 그대로 있는 것을 확인한 인용 */
  readonly evidence: string | null;
}

export type ProximityLevel = "cool" | "warm" | "hot" | "insufficient";

/** 기술 근접도. 비교표에서 계산하며 법적 위험도나 침해 확률이 아니다. */
export interface Proximity {
  readonly level: ProximityLevel;
  readonly reason: string;
  readonly commonElements: string[];
}

export interface PatentComparison {
  readonly patentId: string;
  /** 관련 이유 한 줄 */
  readonly summary: string;
  readonly rows: ComparisonRow[];
  readonly proximity: Proximity;
  readonly claimsReviewed: number;
  readonly claimsTotal: number;
  readonly sourceUrl: string;
}

export interface SearchCoverage {
  readonly queries: string[];
  /** 검색어 묶음으로 확보한 중복 없는 후보 수 */
  readonly candidates: number;
  /** 이번에 상세를 새로 받은 특허 수 */
  readonly detailed: number;
}

export type EmbedTexts = (texts: string[]) => Promise<Float32Array[]>;

/** 테스트에서 합성 출처·임베딩을 주입할 때만 채운다. 기본값은 환경변수와 실제 모델이다. */
export interface KoreanSearchOptions {
  readonly key?: string;
  readonly fetcher?: typeof fetch;
  readonly embed?: EmbedTexts;
  readonly model?: string;
  readonly dim?: number;
  readonly timeoutMs?: number;
  readonly now?: () => number;
  readonly signal?: AbortSignal;
}

export interface KoreanSearchResult {
  readonly hits: SearchHit[];
  /** 이번 검색으로 색인에 새로 들어오거나 좌표가 바뀐 지도 점 */
  readonly addedPoints: PatentPoint[];
  readonly warnings: string[];
  readonly coverage: SearchCoverage;
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
