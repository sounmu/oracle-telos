import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { POST as search } from "../src/app/api/search/route";
import { POST as referenceSearch } from "../src/app/api/research/search/route";
import { POST as agent } from "../src/app/api/agent/route";
import { GET as map } from "../src/app/api/patents/route";
import { GET as document } from "../src/app/api/research/document/[id]/route";
import { writeResearchIndex } from "../src/lib/korea/index";
import type { LawDocument } from "../src/lib/types";

function request(body: unknown): Request {
  return new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("API boundaries reject invalid search scopes and dates before retrieval", async () => {
  assert.equal((await search(request({ query: "아이디어", dataset: "unknown" }))).status, 400);
  assert.equal((await search(request({ query: "아이디어", k: -1 }))).status, 400);
  assert.equal((await referenceSearch(request({ query: "아이디어", asOf: "2026-99-01" }))).status, 400);
  assert.equal((await referenceSearch(request({ query: "아이디어", sources: ["kipris"] }))).status, 400);
  assert.equal((await agent(request({ idea: "아이디어", includeContext: "yes" }))).status, 400);
  assert.equal((await agent(request({ idea: "아이디어", asOf: "2026-99-01" }))).status, 400);
  assert.equal((await map(new Request("http://localhost/api/patents?dataset=unknown"))).status, 400);
});

test("missing Korean corpus returns usable empty metadata and explicit search guidance", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "telos-api-empty-"));
  const previous = process.env.TELOS_RESEARCH_DIR;
  process.env.TELOS_RESEARCH_DIR = directory;
  t.after(async () => {
    if (previous === undefined) delete process.env.TELOS_RESEARCH_DIR;
    else process.env.TELOS_RESEARCH_DIR = previous;
    await fs.rm(directory, { recursive: true });
  });
  const mapResponse = await map(new Request("http://localhost/api/patents?dataset=korea"));
  assert.equal(mapResponse.status, 200);
  const payload = await mapResponse.json();
  assert.equal(payload.dataset, "korea");
  assert.deepEqual(payload.points, []);
  assert.equal(payload.status.sources.length, 3);
  assert.equal((await search(request({ query: "반려동물", dataset: "korea" }))).status, 503);
  const references = await referenceSearch(request({ query: "반려동물" }));
  assert.equal(references.status, 200);
  assert.deepEqual((await references.json()).hits, []);
  assert.equal((await document(new Request("http://localhost"), { params: Promise.resolve({ id: "missing" }) })).status, 404);
  const stream = await agent(request({ idea: "반려동물 급식 추천", dataset: "korea" }));
  assert.equal(stream.headers.get("Content-Type"), "text/event-stream; charset=utf-8");
  const event = JSON.parse((await stream.text()).trim().replace(/^data: /, ""));
  assert.equal(event.type, "error");
});

test("document detail preserves source identifiers and effective version from the stored corpus", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "telos-api-doc-"));
  const previous = process.env.TELOS_RESEARCH_DIR;
  process.env.TELOS_RESEARCH_DIR = directory;
  t.after(async () => {
    if (previous === undefined) delete process.env.TELOS_RESEARCH_DIR;
    else process.env.TELOS_RESEARCH_DIR = previous;
    await fs.rm(directory, { recursive: true });
  });
  const synthetic: LawDocument = {
    id: "law:synthetic:1", source: "law", sourceId: "synthetic", version: "1",
    title: "합성 테스트 조문", text: "실제 법령이 아닌 테스트 문서",
    url: "https://example.com/synthetic", publishedAt: "2026-01-01", fetchedAt: "2026-10-16T00:00:00.000Z",
    law: { lawId: "synthetic", mst: "1", articleNumber: "제1조", versionEffectiveFrom: "2026-02-01", effectiveFrom: "2026-02-01", effectiveTo: null, promulgatedAt: "2026-01-01", state: "current" },
  };
  await writeResearchIndex({
    schemaVersion: 1, model: "synthetic", dim: 2, builtAt: synthetic.fetchedAt,
    documents: [synthetic], chunks: [], points: [],
  });
  const response = await document(new Request("http://localhost"), { params: Promise.resolve({ id: synthetic.id }) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.id, synthetic.id);
  assert.equal(result.law.effectiveFrom, "2026-02-01");
  assert.equal(result.url, synthetic.url);
});
