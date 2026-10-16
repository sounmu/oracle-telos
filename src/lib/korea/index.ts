// 서버/수집 스크립트 전용. 한국 데이터는 공개 디렉터리나 Git에 저장하지 않는다.
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { UMAP } from "umap-js";
import { EMBEDDING_DIM, EMBEDDING_MODEL, embedTexts } from "../embeddings";
import type {
  KoreanPatentDocument,
  Decision,
  PatentFull,
  ResearchChunk,
  ResearchDocument,
  ResearchHit,
  ResearchIndex,
  ResearchSource,
  ResearchStatus,
} from "../types";
import { SourceError } from "./http";
import { researchIndexSchema } from "./schema";

export function researchPath(): string {
  return path.join(process.env.TELOS_RESEARCH_DIR ?? path.join(process.cwd(), "data", "korea"), "index.json");
}

let cached: { path: string; mtime: number; index: ResearchIndex } | null = null;

export async function readResearchIndex(): Promise<ResearchIndex | null> {
  const file = researchPath();
  try {
    const stat = await fs.stat(file);
    if (cached?.path === file && cached.mtime === stat.mtimeMs) return cached.index;
    const raw: unknown = JSON.parse(await fs.readFile(file, "utf8"));
    const index = researchIndexSchema.parse(raw);
    cached = { path: file, mtime: stat.mtimeMs, index };
    return index;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

export async function writeResearchIndex(index: ResearchIndex): Promise<void> {
  const file = researchPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(index), { mode: 0o600 });
    await fs.rename(temporary, file);
    cached = null;
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

/** 새 법령 버전의 시행 시점에 이전 버전 전체를 닫아 삭제된 조문도 남지 않게 한다. */
export function mergeDocuments(
  previous: readonly ResearchDocument[],
  incoming: readonly ResearchDocument[],
): ResearchDocument[] {
  const documents = new Map(previous.map((document) => [document.id, document]));
  for (const document of incoming) documents.set(document.id, document);
  const versions = new Map<string, Set<string>>();
  for (const document of documents.values()) {
    if (document.source !== "law") continue;
    const dates = versions.get(document.law.lawId) ?? new Set<string>();
    dates.add(document.law.versionEffectiveFrom);
    versions.set(document.law.lawId, dates);
  }
  return [...documents.values()].map((document) => {
    if (document.source !== "law") return document;
    const next = [...(versions.get(document.law.lawId) ?? [])]
      .sort()
      .find((date) => date > document.law.versionEffectiveFrom);
    if (!next) return document;
    const successor = [...documents.values()].find((candidate) =>
      candidate.source === "law" &&
      candidate.law.lawId === document.law.lawId &&
      candidate.law.versionEffectiveFrom === next &&
      candidate.law.articleNumber === document.law.articleNumber,
    );
    const effectiveTo = successor?.source === "law" && successor.law.effectiveFrom > next
      ? successor.law.effectiveFrom
      : next;
    return {
      ...document,
      law: {
        ...document.law,
        effectiveTo,
        state: "historical",
      },
    };
  });
}

export function splitDocument(document: ResearchDocument): string[] {
  const parts: string[] = [];
  // 검색 단위만 분할하며 원문·청구항·조문은 documents에서 그대로 보존한다.
  const content = document.text.replace(/\r/g, "").trim();
  for (let start = 0; start < content.length; start += 180) {
    parts.push(`${document.title.slice(0, 80)}\n${content.slice(start, start + 240)}`);
  }
  return parts.length ? parts : [document.title];
}

export async function buildResearchIndex(
  documents: ResearchDocument[],
  previous: ResearchIndex | null,
  embed: (texts: string[]) => Promise<Float32Array[]> = embedTexts,
  model = EMBEDDING_MODEL,
  dim = EMBEDDING_DIM,
): Promise<ResearchIndex> {
  const reusable = new Map<string, number[]>();
  if (previous?.model === model && previous.dim === dim) {
    for (const chunk of previous.chunks) reusable.set(chunk.hash, chunk.vector);
  }
  const drafts = documents.flatMap((document) =>
    splitDocument(document).map((text, position) => ({
      id: `${document.id}#${position}`,
      documentId: document.id,
      text,
      hash: createHash("sha256").update(text).digest("hex"),
    })),
  );
  const missing = [...new Map(
    drafts.filter((chunk) => !reusable.has(chunk.hash)).map((chunk) => [chunk.hash, chunk]),
  ).values()];
  for (let start = 0; start < missing.length; start += 32) {
    const batch = missing.slice(start, start + 32);
    const vectors = await embed(batch.map((chunk) => chunk.text));
    if (vectors.length !== batch.length) throw new SourceError("임베딩", "결과 개수가 일치하지 않습니다.");
    batch.forEach((chunk, position) => {
      const vector = vectors[position];
      if (!vector || vector.length !== dim || !vector.every(Number.isFinite)) {
        throw new SourceError("임베딩", "벡터 차원이 일치하지 않습니다.");
      }
      reusable.set(chunk.hash, Array.from(vector));
    });
  }
  const chunks: ResearchChunk[] = drafts.map((draft) => {
    const vector = reusable.get(draft.hash);
    if (!vector) throw new SourceError("색인", "문서 벡터가 없습니다.");
    return { ...draft, vector };
  });
  const patents = documents.filter((document): document is KoreanPatentDocument => document.source === "kipris");
  const firstVectors = new Map<string, number[]>();
  for (const chunk of chunks) {
    if (!firstVectors.has(chunk.documentId)) firstVectors.set(chunk.documentId, chunk.vector);
  }
  const vectors = patents.map((document) => {
    const vector = firstVectors.get(document.id);
    if (!vector) throw new SourceError("지도", "특허 벡터가 없습니다.");
    return vector;
  });
  let coordinates: number[][];
  if (vectors.length > 3) {
    let seed = 42;
    const umap = new UMAP({
      nComponents: 2,
      nNeighbors: Math.min(15, vectors.length - 1),
      minDist: 0.1,
      random: () => {
        seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
        return seed / 4294967296;
      },
    });
    coordinates = umap.fit(vectors);
  } else {
    // 1~3건은 UMAP 이웃 그래프를 구성할 수 없어 벡터 두 축으로 표시한다.
    coordinates = vectors.map((vector) => [vector[0] ?? 0, vector[1] ?? 0]);
  }
  return {
    schemaVersion: 1,
    model,
    dim,
    builtAt: new Date().toISOString(),
    documents,
    chunks,
    points: patents.map((document, position) => ({
      id: document.id,
      title: document.title,
      decision: document.patent.decision,
      cpc: document.patent.cpc[0] ?? "",
      filed: document.patent.filingDate,
      x: coordinates[position][0],
      y: coordinates[position][1],
      abstract: document.patent.abstract.slice(0, 300),
    })),
  };
}

export function patentFromDocument(document: KoreanPatentDocument, index: ResearchIndex): PatentFull {
  const point = index.points.find((point) => point.id === document.id);
  return {
    id: document.id,
    title: document.title,
    publication: document.patent.publicationNumber,
    decision: document.patent.decision,
    cpc: document.patent.cpc[0] ?? "",
    cpcLabels: document.patent.cpc,
    filed: document.patent.filingDate,
    abstract: document.patent.abstract,
    firstClaim: document.patent.claims[0] ?? "",
    claims: document.patent.claims,
    x: point?.x ?? 0,
    y: point?.y ?? 0,
    sourceUrl: document.url,
    fetchedAt: document.fetchedAt,
    rawStatus: document.patent.rawStatus,
    applicants: document.patent.applicants,
  };
}

/** 같은 보고서의 정정본은 최신본을 선택하되 과거 기준일 검색에서는 과거본을 보존한다. */
export function documentsAsOf(index: ResearchIndex, asOf: string): ResearchDocument[] {
  const eligible = index.documents.filter((document) => {
    if (document.publishedAt && document.publishedAt > asOf) return false;
    switch (document.source) {
      case "law":
        return document.law.versionEffectiveFrom <= asOf && document.law.effectiveFrom <= asOf &&
          (!document.law.effectiveTo || asOf < document.law.effectiveTo);
      case "dart":
      case "kipris":
        return true;
    }
  });
  const latest = new Map<string, string>();
  for (const document of eligible) {
    if (document.source !== "dart") continue;
    const key = `${document.disclosure.corpCode}:${document.disclosure.reportName.replace(/\[[^\]]*정정[^\]]*\]/g, "").trim()}`;
    const receipt = latest.get(key);
    if (!receipt || receipt < document.disclosure.receiptNo) latest.set(key, document.disclosure.receiptNo);
  }
  return eligible.filter((document) => {
    if (document.source !== "dart") return true;
    const key = `${document.disclosure.corpCode}:${document.disclosure.reportName.replace(/\[[^\]]*정정[^\]]*\]/g, "").trim()}`;
    return latest.get(key) === document.disclosure.receiptNo;
  });
}

export function rankResearch(
  index: ResearchIndex,
  query: string,
  vector: Float32Array,
  sources: readonly ResearchSource[],
  k: number,
  asOf: string,
  decision?: Decision,
): ResearchHit[] {
  if (vector.length !== index.dim) throw new SourceError("검색", "질의와 문서의 임베딩 차원이 다릅니다.");
  const documents = new Map(documentsAsOf(index, asOf)
    .filter((document) => sources.includes(document.source))
    .filter((document) => !decision || (document.source === "kipris" && document.patent.decision === decision))
    .map((document) => [document.id, document]));
  const terms = [...new Set(query.normalize("NFKC").toLowerCase().split(/\s+/).filter(Boolean))].slice(0, 24);
  const candidates = index.chunks.filter((chunk) => documents.has(chunk.documentId)).map((chunk) => {
    const content = chunk.text.normalize("NFKC").toLowerCase();
    return {
      chunk,
      semantic: chunk.vector.reduce((sum, value, position) => sum + value * vector[position], 0),
      lexical: terms.reduce((sum, term) => sum + (content.includes(term) ? 1 : 0), 0),
    };
  });
  const scores = new Map<string, number>();
  const ranked = [
    [...candidates].sort((a, b) => b.semantic - a.semantic),
    candidates.filter((candidate) => candidate.lexical > 0).sort((a, b) => b.lexical - a.lexical),
  ];
  for (const ranking of ranked) {
    ranking.slice(0, Math.max(k * 8, 80)).forEach((candidate, position) => {
      // 두 순위 목록의 RRF(k=60)를 0~1로 정규화한다. 1은 두 목록 모두 1위라는 뜻이며 확률이 아니다.
      scores.set(candidate.chunk.id, (scores.get(candidate.chunk.id) ?? 0) + 30.5 / (61 + position));
    });
  }
  const hits = new Map<string, ResearchHit>();
  for (const { chunk } of candidates) {
    const score = scores.get(chunk.id);
    const document = documents.get(chunk.documentId);
    if (score === undefined || !document) continue;
    const previous = hits.get(document.id);
    if (previous && previous.score >= score) continue;
    hits.set(document.id, {
      id: document.id,
      source: document.source,
      title: document.title,
      excerpt: chunk.text.slice(chunk.text.indexOf("\n") + 1),
      url: document.url,
      publishedAt: document.publishedAt,
      fetchedAt: document.fetchedAt,
      version: document.version,
      score,
    });
  }
  return [...hits.values()].sort((a, b) => b.score - a.score).slice(0, k);
}

export async function searchResearch(
  query: string,
  sources: readonly ResearchSource[],
  k: number,
  asOf = new Date().toISOString().slice(0, 10),
  decision?: Decision,
): Promise<ResearchHit[]> {
  const index = await readResearchIndex();
  if (!index) return [];
  if (index.model !== EMBEDDING_MODEL || index.dim !== EMBEDDING_DIM) {
    throw new SourceError("검색", "모델이 변경되었습니다. pnpm sync:korea --reindex를 실행하세요.");
  }
  const [vector] = await embedTexts([query]);
  return rankResearch(index, query, vector, sources, k, asOf, decision);
}

export async function researchStatus(): Promise<ResearchStatus> {
  const index = await readResearchIndex();
  return {
    builtAt: index?.builtAt ?? null,
    model: index?.model ?? EMBEDDING_MODEL,
    sources: [
      { source: "kipris", configured: Boolean(process.env.KIPRIS_API_KEY), count: index?.documents.filter((d) => d.source === "kipris").length ?? 0 },
      { source: "law", configured: Boolean(process.env.LAW_OC), count: index?.documents.filter((d) => d.source === "law").length ?? 0 },
      { source: "dart", configured: Boolean(process.env.DART_API_KEY), count: index?.documents.filter((d) => d.source === "dart").length ?? 0 },
    ],
  };
}
