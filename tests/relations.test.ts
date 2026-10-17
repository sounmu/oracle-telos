import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { citationEdges, citationFiled, citationPasses } from "../src/lib/relations";
import type { Decision, PatentPoint } from "../src/lib/types";

type P = Pick<PatentPoint, "id" | "source" | "cites" | "decision">;
const points: P[] = [
  { id: "real", source: "real", decision: "ACCEPTED", cites: ["dummy", "real2"] },
  { id: "dummy", source: "dummy", decision: "REJECTED", cites: [] },
  { id: "real2", source: "real", decision: "ACCEPTED", cites: [] },
];
const edges = citationEdges(points);
const ALL = new Set<Decision>(["ACCEPTED", "REJECTED", "PENDING", "UNKNOWN"]);
const summary = (visible: Set<Decision>, selected: string | null) =>
  citationPasses(edges, points, visible, selected)
    .filter((p) => p.edges.length)
    .map((p) => `${p.selected ? "sel" : "base"}:${p.real ? "real" : "fake"}:${p.edges.length}`);

test("선택 강조에서도 가짜 인용은 실제 인용과 다른 패스(점선)로 남는다", () => {
  assert.deepEqual(summary(ALL, null), ["base:fake:1", "base:real:1"]);
  assert.deepEqual(summary(ALL, "real"), ["sel:fake:1", "sel:real:1"]);
  assert.deepEqual(summary(ALL, "real2"), ["base:fake:1", "sel:real:1"]);
});

test("상태 필터로 숨긴 점에 닿는 인용선은 선택 강조에서도 그리지 않는다", () => {
  const accepted = new Set<Decision>(["ACCEPTED"]);
  assert.deepEqual(summary(accepted, null), ["base:real:1"]);
  assert.deepEqual(summary(accepted, "real"), ["sel:real:1"]);
});

test("인용 목록 날짜는 출원일일 때만 filed가 되고 공개·등록일은 미상이다", () => {
  assert.equal(citationFiled({ date: "2015-01-30", dateKind: "출원일" }), "2015-01-30");
  assert.equal(citationFiled({ date: "2007-07-24", dateKind: "공개·등록일" }), "");
});

test("시연 마스터는 공개·등록일을 출원일로 저장하지 않는다", () => {
  const raw = JSON.parse(readFileSync("data/raw/demo/citations.json", "utf8")) as {
    nodes: { id: string; date: string; dateKind: string }[];
  };
  const master = JSON.parse(readFileSync("data/master/demo/embedding.json", "utf8")) as { id: string; filed: string }[];
  const filed = new Map(master.map((p) => [p.id, p.filed]));
  for (const n of raw.nodes) {
    if (!filed.has(n.id)) continue;
    assert.equal(filed.get(n.id), citationFiled(n), n.id);
  }
});
