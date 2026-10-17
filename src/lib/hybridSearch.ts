// 서버 전용. 시연 마스터 검색: 임베딩 순위와 BM25 순위를 RRF로 합치고, 어휘가 거의 안 겹치는 결과는 버린다.
import { scoreBm25 } from "./korea/bm25";
import type { PatentIndex } from "./patents";

/** BM25 최고점 대비 이 비율 이상인 결과만 남긴다 (임베딩만으로는 다른 분야가 섞여서 둔 기준) */
export const LEXICAL_CUTOFF = 0.25;
/** 어휘가 덜 겹쳐도 임베딩 상위 이만큼은 남긴다 (용어가 다른 같은 기술) */
export const SEMANTIC_KEEP = 10;

const chunkCache = new WeakMap<PatentIndex, { id: string; text: string }[]>();

export interface HybridHit {
  index: number;
  /** 임베딩 코사인 유사도. 화면의 "유사도"는 이 값이다 (RRF 점수는 순서에만 쓴다) */
  score: number;
}

export function hybridTopK(
  index: PatentIndex,
  query: string,
  vector: Float32Array,
  k: number,
  accept: (i: number) => boolean = () => true,
): HybridHit[] {
  let chunks = chunkCache.get(index);
  if (!chunks) {
    chunks = index.patents.map((p) => ({ id: p.id, text: `${p.title}\n${p.abstract}` }));
    chunkCache.set(index, chunks);
  }
  const lexical = scoreBm25(chunks, query);
  const dim = index.meta.dim;
  const candidates = index.patents.flatMap((p, i) => {
    if (!accept(i)) return [];
    let semantic = 0;
    for (let d = 0; d < dim; d += 1) semantic += vector[d] * index.vectors[i * dim + d];
    return [{ i, semantic, lexical: lexical.get(p.id) ?? 0 }];
  });
  const bySemantic = [...candidates].sort((a, b) => b.semantic - a.semantic);
  const byLexical = candidates.filter((c) => c.lexical > 0).sort((a, b) => b.lexical - a.lexical);
  const rrf = new Map<number, number>();
  for (const list of [bySemantic, byLexical]) list.forEach((c, pos) => rrf.set(c.i, (rrf.get(c.i) ?? 0) + 1 / (61 + pos)));

  const maxLexical = byLexical[0]?.lexical ?? 0;
  const semanticTop = new Set(bySemantic.slice(0, SEMANTIC_KEEP).map((c) => c.i));
  return candidates
    .filter((c) => semanticTop.has(c.i) || (maxLexical > 0 && c.lexical >= LEXICAL_CUTOFF * maxLexical))
    .sort((a, b) => (rrf.get(b.i) ?? 0) - (rrf.get(a.i) ?? 0))
    .slice(0, k)
    .map((c) => ({ index: c.i, score: c.semantic }));
}
