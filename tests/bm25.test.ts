import assert from "node:assert/strict";
import test from "node:test";
import { scoreBm25, tokenizeSearch } from "../src/lib/korea/bm25";
import { rankResearch } from "../src/lib/korea/index";
import type { ResearchChunk, ResearchIndex } from "../src/lib/types";

const chunk = (id: string, text: string): ResearchChunk => ({ id, documentId: id, text, hash: id, vector: [] });

test("Korean terms match particles and compounds without claiming morphological analysis", () => {
  const documents = [chunk("match", "혈당을 측정하는 혈당센서"), chunk("other", "온도 센서")];
  const scores = scoreBm25(documents, "혈당");
  assert.ok((scores.get("match") ?? 0) > 0);
  assert.equal(scores.has("other"), false);
});

test("tokenizer normalizes Unicode and case and excludes punctuation", () => {
  const result = tokenizeSearch("ＡＩ RF, 혈당! 혈당?");
  assert.deepEqual(result, ["ai", "rf", "혈당", "혈당"]);
});

test("BM25 uses rarity and the documented length-normalized formula", () => {
  const documents = [chunk("rare", "rare common"), chunk("common", "common common"), chunk("short", "common")];
  const result = scoreBm25(documents, "rare common");
  const denominator = 1 + 1.2 * (1 - 0.75 + 0.75 * 2 / (5 / 3));
  const expected = (Math.log1p(2.5 / 1.5) + Math.log1p(0.5 / 3.5)) * 2.2 / denominator;
  assert.ok(Math.abs((result.get("rare") ?? 0) - expected) < 1e-12);
  assert.ok((result.get("rare") ?? 0) > (result.get("common") ?? 0));
});

test("BM25 rewards term frequency with diminishing returns at equal lengths", () => {
  const documents = [1, 2, 3].map((count) => chunk(String(count), [...Array<string>(count).fill("sensor"), ...Array<string>(6 - count).fill("other")].join(" ")));
  const result = scoreBm25(documents, "sensor");
  const first = result.get("1") ?? 0;
  const second = result.get("2") ?? 0;
  const third = result.get("3") ?? 0;
  assert.ok(third > second && second > first);
  assert.ok(third - second < second - first);
});

test("BM25 compensates for long chunks and ignores repeated query terms", () => {
  const documents = [chunk("short", "sensor"), chunk("long", "sensor other other other other")];
  const result = scoreBm25(documents, "sensor sensor");
  assert.ok((result.get("short") ?? 0) > (result.get("long") ?? 0));
  assert.deepEqual(result, scoreBm25(documents, "sensor"));
});

test("empty corpora queries and nonmatching tokens produce no lexical hits", () => {
  assert.equal(scoreBm25([], "sensor").size, 0);
  assert.equal(scoreBm25([chunk("empty", "")], "sensor").size, 0);
  assert.equal(scoreBm25([chunk("one", "sensor")], "!? ").size, 0);
  assert.equal(scoreBm25([chunk("one", "sensor")], "motor").size, 0);
});

test("cached tokenization does not retain statistics across different candidate sets", () => {
  const target = chunk("target", "sensor");
  const other = chunk("other", "motor");
  const before = scoreBm25([target, other], "sensor").get("target") ?? 0;
  const after = scoreBm25([target], "sensor").get("target") ?? 0;
  assert.ok(before > after);
  const updated = chunk("target", "motor");
  assert.equal(scoreBm25([updated], "sensor").size, 0);
});

test("production hybrid ranks a Korean token match above a semantic tie", () => {
  const index: ResearchIndex = {
    schemaVersion: 1, model: "fixture", dim: 1, builtAt: "2026-01-01T00:00:00.000Z", points: [],
    documents: ["other", "match"].map((id) => ({
      id, source: "kipris", sourceId: id, version: "1", title: id, text: "", url: "", publishedAt: null,
      fetchedAt: "2026-01-01T00:00:00.000Z",
      patent: { applicationNumber: id, publicationNumber: "", filingDate: "", cpc: [], applicants: [], decision: "UNKNOWN", rawStatus: "", abstract: "", claims: [] },
    })),
    chunks: [
      { ...chunk("other", "온도 센서"), vector: [0] },
      { ...chunk("match", "혈당 센서"), vector: [0] },
    ],
  };
  const result = rankResearch(index, "혈당을", new Float32Array([0]), ["kipris"], 2, "2026-01-01");
  assert.deepEqual(result.map((hit) => hit.id), ["match", "other"]);
  assert.ok(result[0].score > result[1].score);
});
