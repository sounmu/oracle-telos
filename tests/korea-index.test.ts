// 합성 데이터만 사용한다. 실제 특허·법령·공시나 모델 다운로드에 의존하지 않는다.
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildResearchIndex,
  documentsAsOf,
  mergeDocuments,
  rankResearch,
} from "../src/lib/korea/index";
import { researchIndexSchema } from "../src/lib/korea/schema";
import type { DisclosureDocument, KoreanPatentDocument, LawDocument, ResearchIndex } from "../src/lib/types";

const fetchedAt = "2026-10-16T00:00:00.000Z";
const patent: KoreanPatentDocument = {
  id: "kipris:1020200000001",
  source: "kipris",
  sourceId: "1020200000001",
  version: "registered",
  title: "합성 반려동물 급식 특허",
  text: "반려동물 체중으로 급식량을 추천하는 합성 문서",
  url: "https://example.com/patent",
  publishedAt: "2021-01-01",
  fetchedAt,
  patent: {
    applicationNumber: "1020200000001",
    publicationNumber: "1020210000001",
    filingDate: "2020-01-01",
    cpc: ["A01K"],
    applicants: ["합성 회사"],
    decision: "REJECTED",
    rawStatus: "거절",
    abstract: "반려동물 급식량 추천",
    claims: ["1. 합성 급식량 추천 장치."],
  },
};

function law(mst: string, date: string, article = "제1조", effective = date): LawDocument {
  return {
    id: `law:1:${mst}:${article}`,
    source: "law",
    sourceId: `1/${mst}`,
    version: mst,
    title: `합성법 ${article}`,
    text: "합성 조문 내용",
    url: "https://example.com/law",
    publishedAt: "2020-01-01",
    fetchedAt,
    law: {
      lawId: "1",
      mst,
      articleNumber: article,
      versionEffectiveFrom: date,
      effectiveFrom: effective,
      effectiveTo: null,
      promulgatedAt: "2020-01-01",
      state: "current",
    },
  };
}

function disclosure(receipt: string, date: string, correction: boolean): DisclosureDocument {
  return {
    id: `dart:${receipt}:1`,
    source: "dart",
    sourceId: receipt,
    version: receipt,
    title: "합성 회사 사업 내용",
    text: "반려동물 제품 관련 합성 공시",
    url: "https://example.com/disclosure",
    publishedAt: date,
    fetchedAt,
    disclosure: {
      corpCode: "00123456",
      corpName: "합성 회사",
      receiptNo: receipt,
      reportName: `${correction ? "[기재정정]" : ""}사업보고서 (2025.12)`,
      reportDate: date,
      section: "사업의 내용",
      correction,
    },
  };
}

const empty: ResearchIndex = {
  schemaVersion: 1, model: "synthetic", dim: 2, builtAt: fetchedAt, documents: [], chunks: [], points: [],
};

test("unchanged text reuses vectors while changed text is embedded again", async () => {
  let textsEmbedded = 0;
  const embed = async (texts: string[]) => {
    textsEmbedded += texts.length;
    return texts.map(() => Float32Array.from([1, 0]));
  };
  const first = await buildResearchIndex([patent], null, embed, "synthetic", 2);
  assert.equal(textsEmbedded, 1);
  const second = await buildResearchIndex([{ ...patent, fetchedAt: "2026-10-17T00:00:00.000Z" }], first, embed, "synthetic", 2);
  assert.equal(textsEmbedded, 1);
  assert.equal(second.documents[0].fetchedAt, "2026-10-17T00:00:00.000Z");
  const third = await buildResearchIndex([{ ...patent, text: "변경된 합성 기술 내용" }], second, embed, "synthetic", 2);
  assert.equal(textsEmbedded, 2);
  assert.notEqual(third.chunks[0].hash, first.chunks[0].hash);
  assert.equal(third.points[0].decision, "REJECTED");
});

test("a new embedding model never reuses old model vectors", async () => {
  const first = await buildResearchIndex([patent], null, async () => [Float32Array.from([1, 0])], "old", 2);
  let called = false;
  const second = await buildResearchIndex([patent], first, async () => {
    called = true;
    return [Float32Array.from([0, 1])];
  }, "new", 2);
  assert.equal(called, true);
  assert.deepEqual(second.chunks[0].vector, [0, 1]);
});

test("article-specific dates in one law version do not expire neighboring articles", () => {
  const documents = mergeDocuments([], [law("1", "2024-01-01"), law("1", "2024-01-01", "제2조", "2025-01-01")]);
  const found = documentsAsOf({ ...empty, documents }, "2026-01-01");
  assert.equal(found.length, 2);
  assert.ok(found.every((document) => document.source === "law" && document.law.effectiveTo === null));
});

test("a later law version retires removed articles and preserves history", () => {
  const old = [law("1", "2024-01-01"), law("1", "2024-01-01", "제2조")];
  const documents = mergeDocuments(old, [law("2", "2025-01-01")]);
  const index = { ...empty, documents };
  assert.equal(documentsAsOf(index, "2024-12-31").length, 2);
  assert.deepEqual(documentsAsOf(index, "2025-01-01").map((document) => document.id), ["law:1:2:제1조"]);
});

test("a delayed replacement article leaves the old article effective until replacement", () => {
  const documents = mergeDocuments([law("1", "2024-01-01")], [law("2", "2025-01-01", "제1조", "2025-07-01")]);
  const index = { ...empty, documents };
  assert.deepEqual(documentsAsOf(index, "2025-03-01").map((document) => document.id), ["law:1:1:제1조"]);
  assert.deepEqual(documentsAsOf(index, "2025-07-01").map((document) => document.id), ["law:1:2:제1조"]);
});

test("current disclosure search prefers corrections without losing past-date history", () => {
  const original = disclosure("20260301000001", "2026-03-01", false);
  const correction = disclosure("20260401000001", "2026-04-01", true);
  const index = { ...empty, documents: [original, correction] };
  assert.deepEqual(documentsAsOf(index, "2026-03-15").map((document) => document.id), [original.id]);
  assert.deepEqual(documentsAsOf(index, "2026-05-01").map((document) => document.id), [correction.id]);
});

test("hybrid search respects source and decision scope and returns one hit per document", async () => {
  const index = await buildResearchIndex(
    [{ ...patent, text: "급식 ".repeat(160) }, law("1", "2024-01-01")],
    null,
    async (texts) => texts.map(() => Float32Array.from([1, 0])),
    "synthetic",
    2,
  );
  const found = rankResearch(index, "급식", Float32Array.from([1, 0]), ["kipris"], 10, "2026-01-01", "REJECTED");
  assert.equal(found.length, 1);
  assert.equal(found[0].id, patent.id);
  assert.equal(rankResearch(index, "급식", Float32Array.from([1, 0]), ["kipris"], 10, "2026-01-01", "ACCEPTED").length, 0);
  assert.equal(rankResearch(index, "급식", Float32Array.from([1, 0]), ["law"], 10, "2026-01-01")[0].source, "law");
});

test("removing a document also removes its chunks and map point", async () => {
  const first = await buildResearchIndex([patent], null, async () => [Float32Array.from([1, 0])], "synthetic", 2);
  const second = await buildResearchIndex([], first, async () => [], "synthetic", 2);
  assert.equal(second.documents.length, 0);
  assert.equal(second.chunks.length, 0);
  assert.equal(second.points.length, 0);
});

test("stored index validation rejects a vector with the wrong dimension", () => {
  assert.equal(researchIndexSchema.safeParse({
    ...empty,
    documents: [patent],
    chunks: [{ id: "one", documentId: patent.id, text: "합성", hash: "hash", vector: [1] }],
  }).success, false);
});
