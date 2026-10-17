import assert from "node:assert/strict";
import { test } from "node:test";
import { makeSession, parseSessions, sortSessions, STEP_LABELS } from "../src/lib/sessions";

test("네 단계이고 입력 문장은 아이템 칸으로 들어간다", () => {
  assert.deepEqual([...STEP_LABELS], ["입력", "탐색", "검증", "요약"]);
  const s = makeSession("  PLA 미세입자 필러  ", 1, "a");
  assert.equal(s.idea, "PLA 미세입자 필러");
  assert.equal(s.tpl?.item, "PLA 미세입자 필러");
  assert.equal(s.step, 0);
  assert.equal(makeSession("", 1, "b").tpl, null);
});

test("세션 목록은 최신순으로 정렬된다", () => {
  const a = makeSession("가", 1, "a");
  const b = makeSession("나", 5, "b");
  assert.deepEqual(sortSessions([a, b]).map((s) => s.id), ["b", "a"]);
});

test("저장된 값은 검증해서 읽고 깨진 항목은 버린다", () => {
  const good = makeSession("아이템", 1, "ok");
  const raw = JSON.stringify([good, { id: "bad", step: 9 }, "x"]);
  assert.deepEqual(parseSessions(raw).map((s) => s.id), ["ok"]);
  assert.deepEqual(parseSessions("not json"), []);
});
