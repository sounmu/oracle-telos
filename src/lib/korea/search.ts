// 서버 전용. 한국 특허 하이브리드 검색:
// 검색어 묶음 → KIPRIS 후보(질의 캐시) → 중복 제거 → 제목·초록 의미 선별 → 상위만 상세 → 색인 캐시 → 재정렬.
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { EMBEDDING_DIM, EMBEDDING_MODEL, embedTexts } from "../embeddings";
import { toHit } from "../patents";
import type {
  Decision,
  EmbedTexts,
  KoreanSearchOptions,
  KoreanSearchRequest,
  KoreanSearchResult,
  PatentPoint,
  QueryCacheEntry,
  SearchCandidate,
} from "../types";
import { SourceError } from "./http";
import {
  patentFromDocument,
  rankResearch,
  readResearchIndex,
  researchPath,
  upsertLivePatents,
  writePrivateJson,
} from "./index";
import { fetchKiprisDetails, LIVE_DETAIL_LIMIT, searchKiprisCandidates } from "./kipris";

const LIVE_TIMEOUT_MS = 20_000;
const QUERY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_QUERIES = 4;

const queryCacheSchema = z.record(
  z.string(),
  z.object({
    candidates: z.array(z.object({
      applicationNumber: z.string(),
      title: z.string(),
      abstract: z.string(),
      applicant: z.string(),
      rawStatus: z.string(),
      filingDate: z.string(),
    })),
    fetchedAt: z.iso.datetime(),
  }),
);

// 파일은 프로세스당 한 번만 읽고 이후에는 메모리 맵을 기준으로 덮어쓴다. 쓸 수 없으면 메모리에만 남는다.
let queryCache: { path: string; entries: Map<string, QueryCacheEntry> } | null = null;
let queryWrites: Promise<unknown> = Promise.resolve();

function queryCachePath(): string {
  return path.join(path.dirname(researchPath()), "queries.json");
}

function normalizeQuery(query: string): string {
  return query.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

async function loadQueryCache(): Promise<Map<string, QueryCacheEntry>> {
  const file = queryCachePath();
  if (queryCache?.path === file) return queryCache.entries;
  let entries = new Map<string, QueryCacheEntry>();
  try {
    entries = new Map(Object.entries(queryCacheSchema.parse(JSON.parse(await fs.readFile(file, "utf8")))));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      console.warn(`[검색 캐시] ${file}을 읽지 못해 빈 캐시로 시작합니다.`);
    }
  }
  if (queryCache?.path === file) return queryCache.entries;
  queryCache = { path: file, entries };
  return entries;
}

function saveQueryCache(entries: Map<string, QueryCacheEntry>): Promise<unknown> {
  const file = queryCachePath();
  queryWrites = queryWrites.then(() =>
    writePrivateJson(file, Object.fromEntries(entries)).catch((error: unknown) => {
      console.warn(`[검색 캐시] 파일에 저장하지 못해 메모리에만 유지합니다: ${error instanceof Error ? error.message : String(error)}`);
    }),
  );
  return queryWrites;
}

/** 사용자가 조치할 수 있도록 KIPRIS 실패를 인증·한도·네트워크·시간 초과로 나눠 설명한다. */
export function describeKiprisFailure(error: unknown, timedOut: boolean, timeoutMs: number): string {
  if (timedOut) return `시간 초과(${timeoutMs / 1000}초). 잠시 뒤 다시 시도하세요`;
  const message = error instanceof Error ? error.message : String(error);
  if (/SERVICE_KEY|KEY_IS_NOT|ACCESS_DENIED|UNAUTHORIZED|HTTP 40[13]|인증/i.test(message)) {
    return `인증 실패. KIPRIS_API_KEY와 상품 신청·허용 IP를 확인하세요 (${message})`;
  }
  if (/LIMIT|EXCEED|HTTP 429|한도/i.test(message)) {
    return `호출 한도 초과. 이용 한도를 확인하거나 잠시 뒤 다시 시도하세요 (${message})`;
  }
  if (/연결하지 못했|시간이 초과/.test(message)) return `네트워크 오류. 연결 상태를 확인하세요 (${message})`;
  return message;
}

function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let position = 0; position < a.length; position += 1) sum += a[position] * b[position];
  return sum;
}

/** 상세 조회 전에 검색 목록의 제목·초록으로 사용자 기술과 가까운 후보부터 고른다. */
async function preselect(
  candidates: readonly SearchCandidate[],
  description: Float32Array,
  embed: EmbedTexts,
): Promise<SearchCandidate[]> {
  if (candidates.length < 2) return [...candidates];
  const vectors = await embed(candidates.map((candidate) => `${candidate.title}\n${candidate.abstract}`));
  return candidates
    .map((candidate, position) => ({ candidate, similarity: dot(vectors[position], description) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, LIVE_DETAIL_LIMIT)
    .map(({ candidate }) => candidate);
}

export async function searchKoreanPatents(
  { description, queries }: KoreanSearchRequest,
  k: number,
  decision?: Decision,
  {
    key = process.env.KIPRIS_API_KEY?.trim(),
    fetcher = fetch,
    embed = embedTexts,
    model = EMBEDDING_MODEL,
    dim = EMBEDDING_DIM,
    timeoutMs = LIVE_TIMEOUT_MS,
    now = Date.now,
    signal,
  }: KoreanSearchOptions = {},
): Promise<KoreanSearchResult> {
  const bundle: string[] = [];
  const seenQueries = new Set<string>();
  for (const query of queries.length > 0 ? queries : [description]) {
    const compact = query.trim().replace(/\s+/g, " ");
    if (compact === "" || seenQueries.has(normalizeQuery(compact))) continue;
    seenQueries.add(normalizeQuery(compact));
    bundle.push(compact);
  }
  bundle.splice(MAX_QUERIES);
  let descriptionVector: Promise<Float32Array> | undefined;
  const vectorOf = () => (descriptionVector ??= embed([description]).then(([vector]) => vector));
  const warnings: string[] = [];
  let addedPoints: PatentPoint[] = [];
  let candidateCount = 0;
  let detailed = 0;

  if (!key) {
    warnings.push("KIPRIS_API_KEY가 없어 실시간 조회 없이 로컬 색인만 검색했습니다.");
  } else {
    const timeout = AbortSignal.timeout(timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const cache = await loadQueryCache();
      let missed = false;
      const settled = await Promise.allSettled(bundle.map(async (query) => {
        const cacheKey = normalizeQuery(query);
        const hit = cache.get(cacheKey);
        if (hit && now() - Date.parse(hit.fetchedAt) < QUERY_CACHE_TTL_MS) return hit.candidates;
        const candidates = await searchKiprisCandidates(query, key, combined, fetcher);
        cache.set(cacheKey, { candidates, fetchedAt: new Date(now()).toISOString() });
        missed = true;
        return candidates;
      }));
      if (missed) await saveQueryCache(cache);
      const candidates = new Map<string, SearchCandidate>();
      settled.forEach((result, position) => {
        if (result.status === "fulfilled") {
          for (const candidate of result.value) {
            if (!candidates.has(candidate.applicationNumber)) candidates.set(candidate.applicationNumber, candidate);
          }
          return;
        }
        if (signal?.aborted) throw result.reason;
        warnings.push(`KIPRIS 검색 "${bundle[position]}" 실패: ${describeKiprisFailure(result.reason, timeout.aborted, timeoutMs)}.`);
      });
      candidateCount = candidates.size;
      const index = await readResearchIndex();
      const known = new Set(index?.documents.flatMap((document) =>
        document.source === "kipris" ? [document.patent.applicationNumber] : []) ?? []);
      const unseen = [...candidates.values()].filter((candidate) => !known.has(candidate.applicationNumber));
      const selected = await preselect(unseen, await vectorOf(), embed);
      const details = await fetchKiprisDetails(
        selected.map((candidate) => candidate.applicationNumber),
        key,
        combined,
        fetcher,
      );
      warnings.push(...details.warnings);
      detailed = details.documents.length;
      addedPoints = await upsertLivePatents(details.documents, embed, model, dim);
    } catch (error) {
      if (signal?.aborted) throw error;
      warnings.push(`KIPRIS 실시간 조회에 실패해 로컬 색인만 검색했습니다: ${describeKiprisFailure(error, timeout.aborted, timeoutMs)}.`);
    }
  }

  const coverage = { queries: bundle, candidates: candidateCount, detailed };
  const index = await readResearchIndex();
  if (!index?.points.length) {
    if (!key) {
      throw new SourceError(
        "한국 특허",
        "색인이 없고 KIPRIS_API_KEY도 설정되지 않았습니다. .env에 KIPRIS_API_KEY를 넣으면 검색할 때 실시간으로 조회합니다.",
      );
    }
    return { hits: [], addedPoints, warnings: [...warnings, "로컬 색인에 한국 특허가 아직 없습니다."], coverage };
  }
  if (index.model !== model || index.dim !== dim) {
    throw new SourceError("검색", "모델이 변경되었습니다. pnpm sync:korea --reindex를 실행하세요.");
  }
  const documents = new Map(index.documents.map((document) => [document.id, document]));
  // 의미 순위는 사용자 기술 설명, 키워드 순위는 검색어 묶음으로 매긴다.
  const hits = rankResearch(
    index, bundle.join(" "), await vectorOf(), ["kipris"], k, new Date(now()).toISOString().slice(0, 10), decision,
  ).flatMap((hit) => {
    const document = documents.get(hit.id);
    return document?.source === "kipris" ? [toHit(patentFromDocument(document, index), hit.score)] : [];
  });
  return { hits, addedPoints, warnings, coverage };
}
