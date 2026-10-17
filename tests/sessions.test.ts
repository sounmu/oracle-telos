import assert from "node:assert/strict";
import { test } from "node:test";
import { describeSession, makeSession, parseSessions, sortSessions, STEP_LABELS } from "../src/lib/sessions";

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

test("탐색 결과와 위치는 저장했다가 다시 읽어도 그대로다", () => {
  const s = {
    ...makeSession("아이템", 1, "r"),
    results: { ids: ["p1", "p2"], scores: { p1: 0.7, p2: 0.4 }, query: "아이템 기술", at: 9 },
    location: { x: 1.5, y: -2 },
  };
  assert.deepEqual(parseSessions(JSON.stringify([s])), [s]);
});

test("results·location이 없던 예전 데이터는 null로 읽힌다", () => {
  const old: Record<string, unknown> = { ...makeSession("예전 아이템", 1, "old") };
  delete old.results;
  delete old.location;
  const [read] = parseSessions(JSON.stringify([old]));
  assert.equal(read.id, "old");
  assert.equal(read.results, null);
  assert.equal(read.location, null);
});

test("조회·위치·비교에 쓰는 기술 설명은 템플릿 네 칸을 합친 것이다", () => {
  const s = makeSession("PLA 필러", 1, "d");
  assert.equal(describeSession(s), "PLA 필러");
  s.tpl = { item: "PLA 필러", tech: "망상구조 미세입자 제조", target: "환자", risk: "" };
  assert.equal(describeSession(s), "PLA 필러 망상구조 미세입자 제조 환자");
  assert.equal(describeSession({ idea: "  원문  ", tpl: null }), "원문");
});
