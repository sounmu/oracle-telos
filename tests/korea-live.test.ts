import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  buildResearchIndex,
  readResearchIndex,
  upsertLivePatents,
  writeResearchIndex,
} from "../src/lib/korea/index";
import { searchKoreanPatents } from "../src/lib/korea/search";
import type { EmbedTexts, KoreanPatentDocument } from "../src/lib/types";
import { KEY, cpcXml, detailXml, fakeFetch, searchXml, xml } from "./kipris-fixtures";

async function useResearchDir(t: TestContext, directory?: string): Promise<string> {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "telos-live-"));
  const previous = process.env.TELOS_RESEARCH_DIR;
  process.env.TELOS_RESEARCH_DIR = directory ?? base;
  t.after(async () => {
    if (previous === undefined) delete process.env.TELOS_RESEARCH_DIR;
    else process.env.TELOS_RESEARCH_DIR = previous;
    await fs.rm(base, { recursive: true, force: true });
  });
  return base;
}

function patent(number: string, title: string): KoreanPatentDocument {
  return {
    id: `kipris:${number}`,
    source: "kipris",
    sourceId: number,
    version: "공개",
    title,
    text: `${title}\n합성 요약`,
    url: `https://doi.org/10.8080/${number}`,
    publishedAt: "2024-01-01",
    fetchedAt: "2026-10-16T00:00:00.000Z",
    patent: {
      applicationNumber: number,
      publicationNumber: "",
      filingDate: "2023-01-01",
      cpc: [],
      applicants: [],
      decision: "UNKNOWN",
      rawStatus: "공개",
      abstract: "합성 요약",
      claims: [],
    },
  };
}

const constantEmbed: EmbedTexts = async (texts) => texts.map(() => Float32Array.from([1, 0]));

test("a live patent lands near its most similar existing points and only new chunks are embedded", async (t) => {
  await useResearchDir(t);
  const vectors: Record<string, number[]> = {
    알파: [1, 0, 0], 베타: [0, 1, 0], 감마: [0, 0, 1], 델타: [-1, 0, 0], 엡실론: [0, -1, 0], 신규: [0.9, 0.3, 0],
  };
  const embedded: string[] = [];
  const embed: EmbedTexts = async (texts) => {
    embedded.push(...texts);
    return texts.map((text) => Float32Array.from(vectors[text.split("\n")[0]] ?? [0, 0, 0]));
  };
  const seeds = Object.keys(vectors).slice(0, 5).map((title, position) => patent(`102024000000${position}`, title));
  const layout: Record<string, [number, number]> = {
    알파: [10, 10], 베타: [20, 30], 감마: [-40, 5], 델타: [-50, -50], 엡실론: [60, -60],
  };
  const built = await buildResearchIndex(seeds, null, embed, "synthetic", 3);
  await writeResearchIndex({
    ...built,
    points: built.points.map((point) => ({ ...point, x: layout[point.title][0], y: layout[point.title][1] })),
  });
  const seedVectors = new Map(built.chunks.map((chunk) => [chunk.id, chunk.vector]));
  embedded.length = 0;

  const added = await upsertLivePatents([patent("1020240000009", "신규")], embed, "synthetic", 3);

  assert.deepEqual(embedded, ["신규\n신규\n합성 요약"]);
  assert.equal(added.length, 1);
  const [point] = added;
  assert.equal(point.id, "kipris:1020240000009");
  assert.ok(point.x >= 10 && point.x <= 20 && point.y >= 10 && point.y <= 30, `${point.x},${point.y}`);
  const distance = (title: string) => Math.hypot(point.x - layout[title][0], point.y - layout[title][1]);
  assert.ok(distance("알파") < distance("베타"));

  const stored = await readResearchIndex();
  assert.ok(stored);
  assert.equal(stored.points.length, 6);
  for (const seed of stored.points.filter((p) => p.id !== point.id)) {
    assert.deepEqual([seed.x, seed.y], layout[seed.title]);
  }
  for (const chunk of stored.chunks) {
    if (seedVectors.has(chunk.id)) assert.deepEqual(chunk.vector, seedVectors.get(chunk.id));
  }
});

test("a cold start builds the index from live results and a repeated query calls KIPRIS zero times", async (t) => {
  await useResearchDir(t);
  const log: URL[] = [];
  const fetcher = fakeFetch((operation, url) => {
    if (operation === "getAdvancedSearch") return searchXml(["1020240000001", "1020240000002"], 2);
    if (operation === "patentCpcInfo") return cpcXml(["B64U 50/39"]);
    return detailXml(url.searchParams.get("applicationNumber") ?? "", { title: "드론 배터리 교체 장치" });
  }, log);
  const options = { key: KEY, fetcher, embed: constantEmbed, model: "synthetic", dim: 2 };
  const details = () => log.filter((url) => url.pathname.endsWith("/getBibliographyDetailInfoSearch")).length;

  const first = await searchKoreanPatents("드론 배터리 교체", 10, undefined, options);
  assert.equal(details(), 2);
  assert.deepEqual(first.warnings, []);
  assert.deepEqual(first.addedPoints.map((point) => point.id).sort(), ["kipris:1020240000001", "kipris:1020240000002"]);
  assert.equal(first.hits.length, 2);

  const callsAfterFirst = log.length;
  const second = await searchKoreanPatents(" 드론  배터리 교체", 10, undefined, options);
  assert.equal(log.length, callsAfterFirst);
  assert.deepEqual(second.addedPoints, []);
  assert.deepEqual(second.hits.map((hit) => hit.id).sort(), first.hits.map((hit) => hit.id).sort());

  const stored = JSON.parse(await fs.readFile(path.join(process.env.TELOS_RESEARCH_DIR ?? "", "queries.json"), "utf8"));
  assert.deepEqual(stored["드론 배터리 교체"].numbers, ["1020240000001", "1020240000002"]);

  const searches = () => log.filter((url) => url.pathname.endsWith("/getAdvancedSearch")).length;
  const eightDaysLater = Date.now() + 8 * 24 * 60 * 60 * 1000;
  await searchKoreanPatents("드론 배터리 교체", 10, undefined, { ...options, now: () => eightDaysLater });
  assert.equal(searches(), 2);
  assert.equal(details(), 2);
});

test("KIPRIS failure or timeout still returns local results with a warning", async (t) => {
  await useResearchDir(t);
  await writeResearchIndex(await buildResearchIndex(
    [patent("1020240000001", "반려동물 급식기")], null, constantEmbed, "synthetic", 2,
  ));
  const base = { key: KEY, embed: constantEmbed, model: "synthetic", dim: 2 };

  const failed = await searchKoreanPatents("반려동물 급식", 5, undefined, {
    ...base, fetcher: fakeFetch(() => xml("", 503)),
  });
  assert.deepEqual(failed.hits.map((hit) => hit.id), ["kipris:1020240000001"]);
  assert.match(failed.warnings.join("\n"), /실패.*503/);

  const hanging: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  });
  const timedOut = await searchKoreanPatents("반려동물 급식", 5, undefined, {
    ...base, fetcher: hanging, timeoutMs: 20,
  });
  assert.deepEqual(timedOut.hits.map((hit) => hit.id), ["kipris:1020240000001"]);
  assert.match(timedOut.warnings.join("\n"), /시간 초과/);

  const keyless = await searchKoreanPatents("반려동물 급식", 5, undefined, { ...base, key: "" });
  assert.equal(keyless.hits.length, 1);
  assert.match(keyless.warnings.join("\n"), /KIPRIS_API_KEY/);
});

test("concurrent upserts keep both documents and an unwritable index falls back to memory", async (t) => {
  const base = await useResearchDir(t);
  await Promise.all([
    upsertLivePatents([patent("1020240000001", "가")], constantEmbed, "synthetic", 2),
    upsertLivePatents([patent("1020240000002", "나")], constantEmbed, "synthetic", 2),
  ]);
  assert.equal((await readResearchIndex())?.documents.length, 2);

  const readOnly = path.join(base, "read-only");
  await fs.mkdir(readOnly, { mode: 0o500 });
  process.env.TELOS_RESEARCH_DIR = readOnly;
  const added = await upsertLivePatents([patent("1020240000003", "다")], constantEmbed, "synthetic", 2);
  assert.equal(added.length, 1);
  assert.deepEqual((await readResearchIndex())?.points.map((point) => point.id), ["kipris:1020240000003"]);
});
