import assert from "node:assert/strict";
import { test } from "node:test";
import { DISPUTE_CASES } from "../src/lib/cases";
import { caseEmbeddingText } from "../src/lib/caseText";

test("사례 임베딩 텍스트는 기술 쟁점과 검색어만 담는다", () => {
  const item = DISPUTE_CASES[0];
  const text = caseEmbeddingText(item);
  assert.ok(text.includes(item.tech));
  for (const keyword of item.keywords) assert.ok(text.includes(keyword));
  // 법적 서사(원고·피고·판결 이유)는 임베딩 입력에 들어가지 않는다
  assert.ok(!text.includes(item.plaintiff));
  assert.ok(!text.includes(item.result));
});
