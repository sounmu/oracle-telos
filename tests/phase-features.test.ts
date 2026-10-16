import assert from "node:assert/strict";
import { test } from "node:test";
import { compareTerms, countWithin, emptyRegions, estimatePosition, linkedCases, mapOverview, terms } from "../src/lib/phaseFeatures";

test("지형 요약은 상태별 개수, 상위 분야, 연도별 개수를 낸다", () => {
  const o = mapOverview([
    { decision: "ACCEPTED", cpc: "A61B100", filed: "2016-01-03" },
    { decision: "REJECTED", cpc: "A61B200", filed: "2016-01-05" },
    { decision: "ACCEPTED", cpc: "G06F100", filed: "2015-12-31" },
  ]);
  assert.equal(o.total, 3);
  assert.equal(o.byDecision.ACCEPTED, 2);
  assert.deepEqual(o.topCpc[0], { key: "A61B", count: 2 });
  assert.deepEqual(o.years, [{ year: 2015, count: 1 }, { year: 2016, count: 2 }]);
});

test("내 위치는 유사도가 높은 이웃에 가까이 놓인다", () => {
  const pos = estimatePosition([
    { id: "a", title: "", x: 0, y: 0, score: 0.9 },
    { id: "b", title: "", x: 10, y: 10, score: 0.1 },
  ]);
  assert.ok(pos && pos.x < 1 && pos.y < 1);
  assert.equal(estimatePosition([{ id: "c", title: "", x: 1, y: 1, score: 0 }]), null);
});

test("용어 비교는 공통 용어와 확인되지 않은 용어를 나눈다", () => {
  assert.deepEqual(terms("The microsphere, 서방형 주사제"), ["microsphere", "서방형", "주사제"]);
  const r = compareTerms("서방형 미립구 주사제", "생분해성 고분자 미립구를 담은 서방형 주사제");
  assert.deepEqual(r.shared, ["서방형", "미립구", "주사제"]);
  assert.equal(r.coverage, 1);
});

test("사례 연결은 키워드 2개 이상 겹친 사례만 센다", () => {
  const cases = [{ id: "c1", title: "T1", keywords: ["미립구", "서방형"] }, { id: "c2", title: "T2", keywords: ["로봇"] }] as never;
  const r = linkedCases([{ title: "서방형 미립구", abstract: "" }], cases);
  assert.deepEqual(r, [{ id: "c1", title: "T1", count: 1 }]);
});

test("밀집도는 반경 안의 특허 수로 센다", () => {
  assert.equal(countWithin([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 30, y: 0 }], { x: 0, y: 0 }, 5), 2);
});

test("빈 영역은 특허가 없는 칸이고 주변에는 특허가 있다", () => {
  const pts = [
    { id: "a", title: "A", x: 0, y: 0 },
    { id: "b", title: "B", x: 0, y: 1 },
    { id: "c", title: "C", x: 10, y: 10 },
  ];
  const regions = emptyRegions(pts, null, 3, 10);
  assert.ok(regions.length > 0);
  for (const r of regions) {
    assert.ok(r.around.length > 0);
    assert.ok(r.around.every((a) => a.distance > 0));
  }
});
