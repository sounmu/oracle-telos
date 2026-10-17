import assert from "node:assert/strict";
import test from "node:test";
import { rankBaselines, rerankElements, evaluateRanking } from "../scripts/experiments/search-comparison-core";
import { rankResearch } from "../src/lib/korea/index";
import { proximityOf } from "../src/lib/proximity";
import type { PatentComparison, ResearchIndex, SearchExperimentRank } from "../src/lib/types";

const ranking: SearchExperimentRank[] = ["a", "b", "c", "d"].map((id, i) => ({ id, title: id, score: 1 - i / 10 }));
function comparison(id: string, relations: readonly ("common" | "different" | "unconfirmed")[]): PatentComparison {
  return {
    patentId: id, summary: "", claimsReviewed: 1, claimsTotal: 1, sourceUrl: "",
    claimChart: [], proximity: proximityOf([]),
    rows: relations.map((relation) => ({ element: "요소", mine: "기술", theirs: "원문", relation, note: "", evidence: "원문 인용" })),
  };
}

test("reranking keeps unsupported slots and uses all elements as denominator", () => {
  const given = [comparison("a", ["common", "different", "unconfirmed", "unconfirmed"]),
    comparison("b", ["common", "unconfirmed", "unconfirmed", "unconfirmed"]),
    comparison("c", ["common", "common", "different", "different"])];
  const result = rerankElements(ranking, given);
  assert.deepEqual(result.map((hit) => hit.id), ["c", "b", "a", "d"]);
  assert.equal(result[0].elementScore, 0.5);
  assert.deepEqual(ranking.map((hit) => hit.id), ["a", "b", "c", "d"]);
});

test("element ties preserve hybrid order", () => {
  const given = [comparison("a", ["common", "different"]), comparison("c", ["common", "different"])];
  const result = rerankElements(ranking, given);
  assert.deepEqual(result.map((hit) => hit.id), ["a", "b", "c", "d"]);
});

test("metrics use independent graded judgments and rank discount", () => {
  const given = { id: "q", idea: "test", judgments: { source: "synthetic test", relevance: { a: 0, b: 1, c: 3 } } };
  const result = evaluateRanking(ranking, given);
  assert.ok(result);
  assert.equal(result.precisionAt3, 2 / 3);
  assert.ok(Math.abs(result.ndcgAt3 - ((1 / Math.log2(3) + 7 / 2) / (7 + 1 / Math.log2(3)))) < 1e-12);
});

test("missing judgments do not produce accuracy numbers", () => {
  const result = evaluateRanking(ranking, { id: "q", idea: "test", judgments: { source: "partial", relevance: { a: 3 } } });
  assert.equal(result, null);
});

test("baselines share eligible documents and reuse production hybrid", () => {
  const index: ResearchIndex = {
    schemaVersion: 1, model: "fixture", dim: 2, builtAt: "2026-01-01T00:00:00.000Z", points: [],
    documents: ["a", "b", "c"].map((id) => ({
      id, source: "kipris", sourceId: id, version: "1", title: id, text: "", url: "",
      publishedAt: id === "c" ? "2099-01-01" : "2025-01-01", fetchedAt: "2026-01-01T00:00:00.000Z",
      patent: { applicationNumber: id, publicationNumber: "", filingDate: "", cpc: [], applicants: [], decision: "UNKNOWN", rawStatus: "", abstract: "", claims: [] },
    })),
    chunks: [
      { id: "a1", documentId: "a", text: "혈당 센서", hash: "a1", vector: [0, 1] },
      { id: "a2", documentId: "a", text: "혈당", hash: "a2", vector: [0, 1] },
      { id: "b1", documentId: "b", text: "다른 기술", hash: "b1", vector: [1, 0] },
      { id: "c1", documentId: "c", text: "혈당 센서", hash: "c1", vector: [1, 0] },
    ],
  };
  const input = { description: new Float32Array([1, 0]), keywords: "혈당 센서", top: 3, asOf: "2026-01-01" };
  const result = rankBaselines(index, input);
  assert.deepEqual(result.embedding.map((hit) => hit.id), ["b", "a"]);
  assert.deepEqual(result.keyword.map((hit) => hit.id), ["a"]);
  assert.deepEqual(result.bm25.map((hit) => hit.id), ["a"]);
  assert.deepEqual(result.hybrid, rankResearch(index, input.keywords, input.description, ["kipris"], 3, input.asOf).map(({ id, title, score }) => ({ id, title, score })));
});
