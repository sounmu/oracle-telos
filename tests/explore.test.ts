import assert from "node:assert/strict";
import { test } from "node:test";
import { denseRegions, queryOf, similarityText, toTemplate, yearTrend } from "../src/lib/explore";

test("입력 문장은 아이템과 핵심 기술, 대상, 분야 칸으로 나뉜다", () => {
  const t = toTemplate("환자를 위해 PLA 미세입자를 냉동 분사로 만드는 제조 방법");
  assert.equal(t.item, "환자를 위해 PLA 미세입자를 냉동 분사로 만드는 제조 방법");
  assert.equal(t.target, "환자");
  assert.equal(t.risk, "제조공법");
  assert.ok(t.tech.length > 0);
});

test("조회 검색어는 빈 칸을 건너뛴다", () => {
  assert.equal(queryOf({ item: "미세입자", tech: "", target: "", risk: "" }), "미세입자");
});

test("추세는 출원 연도별로 센다", () => {
  assert.deepEqual(yearTrend([{ filed: "2016-01-03" }, { filed: "2015-05-01" }, { filed: "2016-02-02" }]), [
    { year: 2015, count: 1 },
    { year: 2016, count: 2 },
  ]);
});

test("밀집 영역은 점이 2건 이상 모인 칸만 센다", () => {
  const pts = [
    { id: "a", title: "A", cpc: "A61B100", x: 0, y: 0 },
    { id: "b", title: "B", cpc: "A61B200", x: 0.1, y: 0.1 },
    { id: "c", title: "C", cpc: "G06F100", x: 10, y: 10 },
  ];
  const regions = denseRegions(pts, 3, 4);
  assert.equal(regions.length, 1);
  assert.equal(regions[0].count, 2);
  assert.equal(regions[0].topCpc, "A61B");
});

test("유사도는 퍼센트로 보인다", () => {
  assert.equal(similarityText(0.734), "73%");
  assert.equal(similarityText(2), "100%");
});
