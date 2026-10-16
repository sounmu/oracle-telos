import assert from "node:assert/strict";
import test from "node:test";
import { locateCases } from "../src/lib/caseMap";
import type { DisputeCase, PatentPoint } from "../src/lib/types";

function point(id: string, title: string, x: number, y: number): PatentPoint {
  return { id, title, decision: "ACCEPTED", cpc: "", filed: "", x, y, abstract: "" };
}

function disputeCase(id: string, keywords: string[]): DisputeCase {
  return {
    id, kind: "tech", title: id, plaintiff: "A", defendant: "B", domain: "", tech: "", keywords,
    relation: "", procedures: [], period: { start: "", end: "" }, steps: [], result: "", reason: "",
    techImpact: "", bizImpact: "", ids: { patents: [], cases: [] }, sources: [],
  };
}

test("keeps only points sharing two or more keywords when such points exist and anchors on a real point", () => {
  const points = [
    point("a", "GLP-1 서방형 미립구 조성물", 0, 0),
    point("b", "서방형 미립구 제조방법", 1, 0),
    point("c", "GLP-1 측정 키트", 50, 50),
    point("d", "드론 촬영 장치", 9, 9),
  ];
  const [loc] = locateCases(points, [disputeCase("glp", ["미립구", "서방형", "GLP-1"])]);
  assert.deepEqual([...loc.matches.keys()].sort(), ["a", "b"]);
  assert.equal(loc.matches.get("a"), 3);
  assert.ok(["a", "b"].includes(loc.anchorId));
});

test("drops cases sharing fewer than two keywords and matches English keywords as whole words", () => {
  const points = [
    point("a", "microsphere sustained release injection", 0, 0),
    point("b", "Gear housing with gelled grease", 5, 5),
    point("c", "드론", 9, 9),
  ];
  const locs = locateCases(points, [
    disputeCase("en", ["microsphere", "sustained release", "gel"]),
    disputeCase("one", ["드론", "스마트 거울"]),
  ]);
  assert.equal(locs.length, 1);
  assert.equal(locs[0].caseId, "en");
  assert.deepEqual([...locs[0].matches.keys()], ["a"]);
});
