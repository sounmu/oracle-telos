import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePatentNumber } from "../src/lib/patentLookup";

test("특허번호 형식만 번호로 인식하고, 회사명이나 문장은 그대로 둔다", () => {
  assert.equal(parsePatentNumber("15009086"), "15009086");
  assert.equal(parsePatentNumber("US 15009086"), "15009086");
  assert.equal(parsePatentNumber("10-2024-0081789"), "1020240081789");
  assert.equal(parsePatentNumber("KR1020240081789"), "1020240081789");
  assert.equal(parsePatentNumber("메디톡스"), null);
  assert.equal(parsePatentNumber("보툴리눔 톡신 균주"), null);
  assert.equal(parsePatentNumber("1234"), null);
});
