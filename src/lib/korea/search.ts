// 서버 전용. 한국 특허 하이브리드 검색: KIPRIS 실시간 조회 → 로컬 색인 캐시 병합 → 임베딩+키워드 재정렬.
import { EMBEDDING_DIM, EMBEDDING_MODEL, embedTexts } from "../embeddings";
import { toHit } from "../patents";
import type {
  Decision,
  KoreanSearchOptions,
  KoreanSearchResult,
  PatentPoint,
} from "../types";
import { SourceError } from "./http";
import { patentFromDocument, rankResearch, readResearchIndex, upsertLivePatents } from "./index";
import { searchKiprisLive } from "./kipris";

const LIVE_TIMEOUT_MS = 8000;

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
      const live = await searchKiprisLive(
        { query, knownIds, signal: signal ? AbortSignal.any([signal, timeout]) : timeout },
        key,
        fetcher,
      );
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
