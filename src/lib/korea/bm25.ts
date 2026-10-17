import type { ResearchChunk } from "../types";

export const LEXICAL_CONFIG = { tokenizer: "ko-word-ngram-v1", k1: 1.2, b: 0.75 } as const;
const segmenter = new Intl.Segmenter("ko", { granularity: "word" });
const tokenCache = new WeakMap<object, { readonly length: number; readonly frequencies: ReadonlyMap<string, number> }>();

export function tokenizeSearch(text: string): string[] {
  const tokens: string[] = [];
  for (const part of segmenter.segment(text.normalize("NFKC").toLowerCase())) {
    if (!part.isWordLike) continue;
    const word = part.segment;
    const terms = new Set([word]);
    for (const match of word.matchAll(/[가-힣]+/g)) {
      for (const size of [2, 3]) {
        for (let start = 0; start + size <= match[0].length; start += 1) terms.add(match[0].slice(start, start + size));
      }
    }
    tokens.push(...terms);
  }
  return tokens;
}

/** 청크는 id와 text만 쓴다. 같은 객체를 다시 넘기면 토큰화 결과를 재사용한다 */
export function scoreBm25(chunks: readonly Pick<ResearchChunk, "id" | "text">[], query: string): ReadonlyMap<string, number> {
  const terms = [...new Set(tokenizeSearch(query))];
  if (chunks.length === 0 || terms.length === 0) return new Map();
  const documents = chunks.map((chunk) => {
    let document = tokenCache.get(chunk);
    if (!document) {
      const tokens = tokenizeSearch(chunk.text);
      const frequencies = new Map<string, number>();
      for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
      document = { length: tokens.length, frequencies };
      tokenCache.set(chunk, document);
    }
    return { id: chunk.id, ...document };
  });
  const averageLength = documents.reduce((sum, document) => sum + document.length, 0) / documents.length;
  if (averageLength === 0) return new Map();
  const inverseFrequency = new Map(terms.map((term) => {
    const count = documents.filter((document) => document.frequencies.has(term)).length;
    return [term, Math.log1p((documents.length - count + 0.5) / (count + 0.5))];
  }));
  const scores = new Map<string, number>();
  const { k1, b } = LEXICAL_CONFIG;
  for (const document of documents) {
    let score = 0;
    for (const term of terms) {
      const frequency = document.frequencies.get(term) ?? 0;
      if (frequency === 0) continue;
      score += (inverseFrequency.get(term) ?? 0) * frequency * (k1 + 1) /
        (frequency + k1 * (1 - b + b * document.length / averageLength));
    }
    if (score > 0) scores.set(document.id, score);
  }
  return scores;
}
