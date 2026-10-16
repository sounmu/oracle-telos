export interface Scored {
  index: number;
  score: number;
}

/**
 * 정규화된 벡터끼리의 내적(=코사인 유사도)으로 top-k를 찾는다.
 * vectors는 N×dim 이 연속으로 담긴 Float32Array.
 */
export function topK(
  query: Float32Array,
  vectors: Float32Array,
  dim: number,
  k: number,
  accept?: (index: number) => boolean,
): Scored[] {
  const n = Math.floor(vectors.length / dim);
  const scored: Scored[] = [];
  for (let i = 0; i < n; i++) {
    if (accept && !accept(i)) continue;
    const base = i * dim;
    let dot = 0;
    for (let d = 0; d < dim; d++) dot += query[d] * vectors[base + d];
    scored.push({ index: i, score: dot });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
