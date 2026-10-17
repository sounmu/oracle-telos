import assert from "node:assert/strict";
import { test } from "node:test";
import { applyView, DEFAULT_VIEW } from "../src/lib/view";

const points = [
  { id: "a", decision: "ACCEPTED", cpc: "A61B100", filed: "2016-01-03" },
  { id: "b", decision: "REJECTED", cpc: "A61B200", filed: "2016-01-09" },
  { id: "c", decision: "ACCEPTED", cpc: "G06F100", filed: "2015-12-30" },
] as const;

test("기본 조회는 전체를 최신 출원순으로 보여 준다", () => {
  assert.deepEqual(applyView(points, DEFAULT_VIEW).map((p) => p.id), ["b", "a", "c"]);
});

test("상태와 분야로 거르고 개수를 제한한다", () => {
  const view = { ...DEFAULT_VIEW, decisions: ["ACCEPTED"] as const, cpc: "A61B", limit: 1 };
  assert.deepEqual(applyView(points, { ...view, decisions: [...view.decisions] }).map((p) => p.id), ["a"]);
});

test("유사도 정렬은 점수가 있을 때만 쓰고, 없으면 최신순으로 바뀐다", () => {
  const scores = new Map([["c", 0.9], ["a", 0.5]]);
  const byScore = applyView(points, { ...DEFAULT_VIEW, sort: "similarity" }, scores);
  assert.deepEqual(byScore.map((p) => p.id), ["c", "a"]);
  const fallback = applyView(points, { ...DEFAULT_VIEW, sort: "similarity" });
  assert.deepEqual(fallback.map((p) => p.id), ["b", "a", "c"]);
});
