import { documentsAsOf, rankResearch } from "../../src/lib/korea/index";
import { scoreBm25 } from "../../src/lib/korea/bm25";
import type { PatentComparison, ResearchIndex, SearchExperimentRank, SearchExperimentQuery, SearchExperimentMetrics } from "../../src/lib/types";

export function rankBaselines(index: ResearchIndex, input: { readonly description: Float32Array; readonly keywords: string; readonly top: number; readonly asOf: string }) {
  const documents = new Map(documentsAsOf(index, input.asOf).filter((d) => d.source === "kipris").map((d) => [d.id, d]));
  const terms = [...new Set(input.keywords.normalize("NFKC").toLowerCase().split(/\s+/).filter(Boolean))].slice(0, 24);
  const sorted = (scores: Map<string, number>): SearchExperimentRank[] => [...scores]
    .map(([id, score]) => ({ id, title: documents.get(id)?.title ?? id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, input.top);
  const start = performance.now();
  const semantic = new Map<string, number>();
  for (const chunk of index.chunks) {
    if (!documents.has(chunk.documentId)) continue;
    const dot = chunk.vector.reduce((sum, value, position) => sum + value * input.description[position], 0);
    semantic.set(chunk.documentId, Math.max(semantic.get(chunk.documentId) ?? -Infinity, dot));
  }
  const embedding = sorted(semantic);
  const semanticEnd = performance.now();
  const lexical = new Map<string, number>();
  for (const chunk of index.chunks) {
    if (!documents.has(chunk.documentId)) continue;
    const content = chunk.text.normalize("NFKC").toLowerCase();
    const matches = terms.filter((term) => content.includes(term)).length;
    if (matches > 0) lexical.set(chunk.documentId, Math.max(lexical.get(chunk.documentId) ?? 0, matches));
  }
  const keyword = sorted(lexical);
  const lexicalEnd = performance.now();
  const chunks = index.chunks.filter((chunk) => documents.has(chunk.documentId));
  const bm25Scores = scoreBm25(chunks, input.keywords);
  const bm25Documents = new Map<string, number>();
  for (const chunk of chunks) {
    const score = bm25Scores.get(chunk.id);
    if (score !== undefined) bm25Documents.set(chunk.documentId, Math.max(bm25Documents.get(chunk.documentId) ?? 0, score));
  }
  const bm25 = sorted(bm25Documents);
  const bm25End = performance.now();
  const hybrid = rankResearch(index, input.keywords, input.description, ["kipris"], input.top, input.asOf)
    .map(({ id, title, score }) => ({ id, title, score }));
  return { embedding, keyword, bm25, hybrid, elapsedMs: { embedding: semanticEnd - start, keyword: lexicalEnd - semanticEnd, bm25: bm25End - lexicalEnd, hybrid: performance.now() - bm25End } };
}

export function rerankElements(ranking: readonly SearchExperimentRank[], comparisons: readonly PatentComparison[]): SearchExperimentRank[] {
  const byId = new Map(comparisons.map((comparison) => [comparison.patentId, comparison]));
  const eligible = ranking.flatMap((hit) => {
    const comparison = byId.get(hit.id);
    if (!comparison || comparison.rows.filter((row) => row.relation !== "unconfirmed").length < 2) return [];
    const common = comparison.rows.filter((row) => row.relation === "common").length;
    return [{ ...hit, elementScore: common / comparison.rows.length }];
  });
  const ids = new Set(eligible.map((hit) => hit.id));
  eligible.sort((a, b) => b.elementScore - a.elementScore);
  let position = 0;
  return ranking.map((hit) => ids.has(hit.id) ? (eligible[position++] ?? hit) : hit);
}

export function evaluateRanking(ranking: readonly SearchExperimentRank[], query: SearchExperimentQuery): SearchExperimentMetrics | null {
  if (!query.judgments) return null;
  const labels = query.judgments.relevance;
  const top = ranking.slice(0, 3);
  if (top.some((hit) => labels[hit.id] === undefined)) return null;
  const dcg = (grades: readonly number[]) => grades.reduce((sum, grade, i) => sum + (2 ** grade - 1) / Math.log2(i + 2), 0);
  const ideal = dcg(Object.values(labels).sort((a, b) => b - a).slice(0, 3));
  if (ideal === 0) return null;
  const grades = top.map((hit) => labels[hit.id]);
  return { ndcgAt3: dcg(grades) / ideal, precisionAt3: grades.filter((grade) => grade > 0).length / 3, judgedAt3: top.length / 3 };
}
