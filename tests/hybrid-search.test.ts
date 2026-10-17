import assert from "node:assert/strict";
import { test } from "node:test";
import { hybridTopK } from "../src/lib/hybridSearch";
import type { PatentIndex } from "../src/lib/patents";
import type { PatentFull } from "../src/lib/types";

function patent(id: string, title: string, abstract: string): PatentFull {
  return { id, publication: "", title, decision: "ACCEPTED", cpc: "A01B", cpcLabels: [], filed: "2020-01-01", abstract, firstClaim: "", x: 0, y: 0 };
}

// 2차원 벡터로 임베딩을 흉내 낸다. 분리막 문서와 화소 문서는 질의 벡터와 비슷한 정도로 일부러 맞췄다
function index(): PatentIndex {
  const patents = [
    patent("sep-1", "세라믹 코팅 분리막", "무기물 입자와 바인더로 코팅한 분리막"),
    patent("sep-2", "분리막 제조 방법", "다공성 분리막에 무기물 입자를 코팅"),
    patent("pix-1", "화소 배열 구조", "녹색 서브 화소를 가운데 두는 배열"),
    patent("pix-2", "표시 장치", "화소 정의막과 스페이서"),
  ];
  const vectors = new Float32Array([0.9, 0.1, 0.8, 0.2, 0.85, 0.15, 0.7, 0.3]);
  return {
    meta: { model: "test", dim: 2, count: patents.length, builtAt: "", source: "" },
    patents,
    byId: new Map(patents.map((p) => [p.id, p])),
    indexById: new Map(patents.map((p, i) => [p.id, i])),
    vectors,
  };
}

test("어휘가 겹치는 같은 분야가 임베딩만 비슷한 다른 분야보다 먼저 온다", () => {
  const idx = index();
  const hits = hybridTopK(idx, "무기물 입자 분리막 코팅", new Float32Array([1, 0]), 10);
  const ids = hits.map((h) => idx.patents[h.index].id);
  assert.deepEqual(ids.slice(0, 2).sort(), ["sep-1", "sep-2"]);
  // 4건뿐이라 모두 임베딩 상위 10 안에 들어 남는다. 순서는 어휘가 겹치는 분리막이 먼저다
  assert.ok(ids.indexOf("sep-1") < ids.indexOf("pix-1"));
});

test("점수는 임베딩 코사인 그대로 돌려준다", () => {
  const idx = index();
  const [first] = hybridTopK(idx, "분리막", new Float32Array([1, 0]), 1);
  assert.equal(first.score, idx.vectors[first.index * 2]);
});

test("k와 accept를 지킨다", () => {
  const idx = index();
  const hits = hybridTopK(idx, "화소 배열", new Float32Array([1, 0]), 2, (i) => idx.patents[i].id.startsWith("pix"));
  assert.ok(hits.length <= 2);
  assert.ok(hits.every((h) => idx.patents[h.index].id.startsWith("pix")));
});

test("어휘가 안 겹치고 임베딩 상위 10에도 못 든 결과는 버린다", () => {
  const pix = Array.from({ length: 12 }, (_, i) => patent(`pix-${i}`, "화소 배열 구조", "서브 화소 배치"));
  const sep = [patent("sep-a", "세라믹 코팅 분리막", "무기물 입자 코팅"), patent("sep-b", "분리막", "다공성 분리막")];
  const patents = [...pix, ...sep];
  // 화소 문서가 임베딩으로는 모두 분리막 문서보다 질의에 가깝다
  const vectors = new Float32Array(patents.flatMap((p, i) => (p.id.startsWith("pix") ? [0.99 - i * 0.001, 0.01] : [0.5, 0.5])));
  const idx: PatentIndex = {
    meta: { model: "test", dim: 2, count: patents.length, builtAt: "", source: "" },
    patents,
    byId: new Map(patents.map((p) => [p.id, p])),
    indexById: new Map(patents.map((p, i) => [p.id, i])),
    vectors,
  };
  const ids = hybridTopK(idx, "분리막 코팅", new Float32Array([1, 0]), 50).map((h) => idx.patents[h.index].id);
  assert.ok(ids.includes("sep-a") && ids.includes("sep-b"));
  assert.equal(ids.filter((id) => id.startsWith("pix")).length, 10);
});
