import assert from "node:assert/strict";
import { test } from "node:test";
import { demoSessions, demoTemplate, seedDemoSessions } from "../src/lib/demoSessions";
import { makeSession, parseSessions, sortSessions } from "../src/lib/sessions";

test("시연 세션 3개는 입력 단계에서 시작하고 세션 1이 맨 위다", () => {
  const demos = demoSessions();
  assert.equal(demos.length, 3);
  assert.deepEqual(sortSessions(demos).map((s) => s.name), ["세션 1 · 의료용 필러", "세션 2 · 이차전지 분리막", "세션 3 · OLED 화소 배열"]);
  for (const s of demos) {
    assert.equal(s.step, 0);
    assert.equal(s.tpl?.item, s.idea);
    assert.equal(s.tpl?.tech, "");
    assert.equal(s.results, null);
  }
  // 저장 형식 검증을 통과한다
  assert.equal(parseSessions(JSON.stringify(demos)).length, 3);
});

test("저장된 시연 세션은 처음 상태로 되돌리고 사용자 세션은 남긴다", () => {
  const mine = makeSession("내 아이템", Date.now(), "mine");
  const progressed = { ...demoSessions()[0], step: 3 as const, results: { ids: ["p"], scores: { p: 1 }, query: "q", at: 1 } };
  const seeded = seedDemoSessions([mine, progressed]);
  assert.equal(seeded.length, 4);
  assert.equal(seeded.filter((s) => s.id === progressed.id).length, 1);
  assert.equal(seeded.find((s) => s.id === progressed.id)?.step, 0);
  // 새로 만든 세션이 시연 세션보다 위에 온다
  assert.equal(sortSessions(seeded)[0].id, "mine");
});

test("시연 문장은 미리 정한 템플릿으로 바뀌고 다른 문장은 null이다", () => {
  const [filler] = demoSessions();
  const tpl = demoTemplate(`  ${filler.idea}  `);
  assert.deepEqual(tpl, { item: filler.idea, tech: "PDLLA 미세입자, 에틸렌 카보네이트, 냉동 분사", target: "피부과", risk: "제조공법" });
  assert.equal(demoTemplate("다른 아이템 문장입니다"), null);
});
