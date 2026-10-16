import assert from "node:assert/strict";
import { test } from "node:test";
import { caseHits, riskField } from "../src/lib/riskField";
import { sameCpcEdges } from "../src/lib/relations";
import type { DisputeCase } from "../src/lib/types";

const caseOf = (id: string, keywords: string[]) => ({ id, keywords }) as unknown as DisputeCase;

test("사례 연결은 키워드 2개 이상이 제목·초록에 함께 있을 때만 된다", () => {
  const points = [
    { title: "Botulinum toxin formulation", abstract: "stable toxin strain" },
    { title: "Botulinum only", abstract: "nothing else" },
    { title: "Unrelated", abstract: "unrelated" },
  ];
  const hits = caseHits(points, [caseOf("a", ["botulinum", "toxin", "strain"]), caseOf("b", ["botulinum"])]);
  assert.deepEqual(hits[0], [0]);
  assert.deepEqual(hits[1], []);
});

test("위험도 격자는 밀집된 영역과 사례가 닿는 영역에서 더 높다", () => {
  const dense = Array.from({ length: 20 }, (_, i) => ({ bx: 100 + (i % 5) * 3, by: 100 + Math.floor(i / 5) * 3 }));
  const sparse = [{ bx: 500, by: 500 }];
  const nodes = [...dense, ...sparse];
  const withCase = riskField(nodes, [[0, 1, 2]]);
  const noCase = riskField(nodes, [[]]);
  const at = (cells: { x: number; y: number; value: number }[], x: number, y: number) =>
    cells.reduce((best, c) => (Math.hypot(c.x - x, c.y - y) < Math.hypot(best.x - x, best.y - y) ? c : best)).value;
  assert.ok(at(withCase, 110, 110) > at(withCase, 500, 500));
  assert.ok(at(withCase, 110, 110) >= at(noCase, 110, 110));
});

test("관계선은 같은 CPC 하위 분류끼리만 잇는다", () => {
  const points = [
    { cpc: "A61B100", x: 0, y: 0 },
    { cpc: "A61B200", x: 1, y: 0 },
    { cpc: "C07K300", x: 2, y: 0 },
  ];
  const edges = sameCpcEdges(points);
  assert.deepEqual(edges, [[0, 1]]);
});
