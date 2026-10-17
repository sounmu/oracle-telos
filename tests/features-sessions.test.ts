import assert from "node:assert/strict";
import { test } from "node:test";
import { FEATURES } from "../src/lib/features";
import { groupByPhase, makeSession, parseSessions } from "../src/lib/sessions";

test("기능 6개가 네 단계에 각각 속하고 이름이 겹치지 않는다", () => {
  assert.equal(FEATURES.length, 6);
  assert.equal(new Set(FEATURES.map((f) => f.label)).size, 6);
  for (const phase of ["explore", "verify", "risk"]) {
    assert.ok(FEATURES.some((f) => f.phase === phase), phase);
  }
});

test("세션은 기능의 단계를 따르고, 아이디어가 없으면 기능 이름을 제목으로 쓴다", () => {
  const s = makeSession("cases", "  미립구 주사제  ", 1, "a");
  assert.equal(s.phase, "risk");
  assert.equal(s.idea, "미립구 주사제");
  assert.equal(makeSession("overview", "", 1, "b").title, "지형 보기");
});

test("대시보드는 단계별로 묶고 최신 세션을 위에 둔다", () => {
  const a = makeSession("overview", "", 1, "a");
  const b = makeSession("overview", "", 5, "b");
  const c = makeSession("empty", "", 3, "c");
  const groups = groupByPhase([a, b, c]);
  assert.deepEqual(groups[0].items.map((s) => s.id), ["b", "c", "a"]);
  assert.equal(groups.length, 3);
});

test("저장된 값은 검증해서 읽고, 깨진 항목은 버린다", () => {
  const good = makeSession("locate", "아이디어", 1, "ok");
  const raw = JSON.stringify([good, { id: "bad", feature: "unknown" }, "x"]);
  assert.deepEqual(parseSessions(raw).map((s) => s.id), ["ok"]);
  assert.deepEqual(parseSessions("not json"), []);
  assert.deepEqual(parseSessions(null), []);
});
