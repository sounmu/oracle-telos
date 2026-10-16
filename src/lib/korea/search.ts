// 서버 전용. 한국 특허 하이브리드 검색: KIPRIS 실시간 조회 → 로컬 색인 캐시 병합 → 임베딩+키워드 재정렬.
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { EMBEDDING_DIM, EMBEDDING_MODEL, embedTexts } from "../embeddings";
import { toHit } from "../patents";
import type {
  Decision,
  KoreanSearchOptions,
  KoreanSearchResult,
  PatentPoint,
  QueryCacheEntry,
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
import { searchKiprisLive } from "./kipris";

// 상세 최대 20건(호출 40회)을 동시 4건씩 받는 시간. 초과하면 받은 만큼만 캐시한다.
const LIVE_TIMEOUT_MS = 20_000;
const QUERY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const queryCacheSchema = z.record(
  z.string(),
  z.object({ numbers: z.array(z.string()), fetchedAt: z.iso.datetime() }),
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

export async function searchKoreanPatents(
  query: string,
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
  const warnings: string[] = [];
  let addedPoints: PatentPoint[] = [];
  if (!key) {
    warnings.push("KIPRIS_API_KEY가 없어 실시간 조회 없이 로컬 색인만 검색했습니다.");
  } else {
    const timeout = AbortSignal.timeout(timeoutMs);
    try {
      const before = await readResearchIndex();
      const knownIds = new Set(before?.documents.flatMap((document) =>
        document.source === "kipris" ? [document.patent.applicationNumber] : []) ?? []);
      const cache = await loadQueryCache();
      const cacheKey = normalizeQuery(query);
      const hit = cache.get(cacheKey);
      const fresh = hit && now() - Date.parse(hit.fetchedAt) < QUERY_CACHE_TTL_MS ? hit : undefined;
      const live = await searchKiprisLive(
        {
          query,
          knownIds,
          numbers: fresh?.numbers,
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        },
        key,
        fetcher,
      );
      if (!fresh) {
        cache.set(cacheKey, { numbers: live.numbers, fetchedAt: new Date(now()).toISOString() });
        await saveQueryCache(cache);
      }
      warnings.push(...live.warnings);
      addedPoints = await upsertLivePatents(live.documents, embed, model, dim);
    } catch (error) {
      if (signal?.aborted) throw error;
      const reason = timeout.aborted
        ? `${timeoutMs / 1000}초 시간 초과`
        : error instanceof Error ? error.message : String(error);
      warnings.push(`KIPRIS 실시간 조회에 실패해 로컬 색인만 검색했습니다 (${reason}).`);
    }
  }

  const index = await readResearchIndex();
  if (!index?.points.length) {
    if (!key) {
      throw new SourceError(
        "한국 특허",
        "색인이 없고 KIPRIS_API_KEY도 설정되지 않았습니다. .env에 KIPRIS_API_KEY를 넣으면 검색할 때 실시간으로 조회합니다.",
      );
    }
    return { hits: [], addedPoints, warnings: [...warnings, "로컬 색인에 한국 특허가 아직 없습니다."] };
  }
  if (index.model !== model || index.dim !== dim) {
    throw new SourceError("검색", "모델이 변경되었습니다. pnpm sync:korea --reindex를 실행하세요.");
  }
  const [vector] = await embed([query]);
  const documents = new Map(index.documents.map((document) => [document.id, document]));
  const hits = rankResearch(index, query, vector, ["kipris"], k, new Date().toISOString().slice(0, 10), decision)
    .flatMap((hit) => {
      const document = documents.get(hit.id);
      return document?.source === "kipris" ? [toHit(patentFromDocument(document, index), hit.score)] : [];
    });
  return { hits, addedPoints, warnings };
}
