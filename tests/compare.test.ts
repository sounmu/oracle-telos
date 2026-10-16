import assert from "node:assert/strict";
import test from "node:test";
import { POST as compare } from "../src/app/api/compare/route";
import { finalizeComparison, type DraftComparison } from "../src/lib/korea/compare";
import { proximityOf } from "../src/lib/proximity";
import type { ComparisonRow, KoreanPatentDocument } from "../src/lib/types";

const document: KoreanPatentDocument = {
  id: "kipris:1020240000001",
  source: "kipris",
  sourceId: "1020240000001",
  version: "공개",
  title: "고주파 피부 탄력 기기",
  text: "",
  url: "https://doi.org/10.8080/1020240000001",
  publishedAt: "2024-06-01",
  fetchedAt: "2026-10-16T00:00:00.000Z",
  patent: {
    applicationNumber: "1020240000001",
    publicationNumber: "",
    filingDate: "2024-01-05",
    cpc: ["A61N 1/40"],
    applicants: ["합성 주식회사"],
    decision: "UNKNOWN",
    rawStatus: "공개",
    abstract: "본 발명은 피부에 고주파 에너지를 전달하는 전극부와 피부 온도를 측정하는 온도 센서를 포함한다.",
    claims: [
      "1. 고주파 에너지를 출력하는 전극부; 및 상기 전극부의 출력을 피부 온도에 따라 조절하는 제어부를 포함하는 기기.",
      "2. 제1항에 있어서, 사용 기록을 저장하는 메모리를 더 포함하는 기기.",
      "3. 청구항 3", "4. 청구항 4", "5. 청구항 5",
      "6. 제1항에 있어서, 스마트폰 앱과 블루투스로 연결되는 통신부를 포함하는 기기.",
    ],
  },
};

const elements = ["고주파 전극", "온도 기반 출력 제어", "앱 연동", "AI 피부 분석"];

function row(relation: ComparisonRow["relation"], element = "요소"): ComparisonRow {
  return { element, mine: "내 기술", theirs: relation === "unconfirmed" ? null : "특허", relation, note: "", evidence: null };
}

test("only quotes found verbatim in the text sent to the model confirm a comparison row", () => {
  const draft: DraftComparison = {
    summary: " 고주파 전극과 온도 제어가 겹칩니다. ",
    rows: [
      { mine: "RF 전극으로 진피 가열", theirs: "고주파 전극부", relation: "common", note: "같은 에너지원", evidence: "피부에 고주파 에너지를  전달하는 전극부" },
      { mine: "온도에 따라 출력 조절", theirs: "피부 온도에 따른 제어부", relation: "common", note: "같은 제어", evidence: "“상기 전극부의 출력을 피부 온도에 따라 조절하는 제어부”" },
      // 6번 청구항은 모델에 보내지 않았으므로 근거로 인정하지 않는다.
      { mine: "앱으로 강도 조절", theirs: "블루투스 앱 연결", relation: "common", note: "앱 연동", evidence: "스마트폰 앱과 블루투스로 연결되는 통신부" },
      { mine: null, theirs: "AI 분석", relation: "different", note: "추측", evidence: "AI가 피부를 분석" },
    ],
  };

  const result = finalizeComparison(draft, elements, document);

  assert.deepEqual(result.rows.map((r) => [r.element, r.relation]), [
    ["고주파 전극", "common"],
    ["온도 기반 출력 제어", "common"],
    ["앱 연동", "unconfirmed"],
    ["AI 피부 분석", "unconfirmed"],
  ]);
  assert.equal(result.rows[2].theirs, null);
  assert.equal(result.rows[2].evidence, null);
  assert.equal(result.rows[3].mine, null);
  assert.equal(result.summary, "고주파 전극과 온도 제어가 겹칩니다.");
  assert.equal(result.claimsReviewed, 5);
  assert.equal(result.claimsTotal, 6);
  assert.equal(result.proximity.level, "hot");
  assert.deepEqual(result.proximity.commonElements, ["고주파 전극", "온도 기반 출력 제어"]);
});

test("missing model rows become unconfirmed rows for every planned element", () => {
  const result = finalizeComparison({ summary: "", rows: [] }, elements, document);
  assert.equal(result.rows.length, elements.length);
  assert.ok(result.rows.every((r) => r.relation === "unconfirmed" && r.theirs === null && r.note !== ""));
  assert.equal(result.proximity.level, "insufficient");
});

test("proximity levels follow the share of grounded common elements and need two confirmed rows", () => {
  assert.equal(proximityOf([row("common"), row("unconfirmed"), row("unconfirmed")]).level, "insufficient");
  assert.equal(proximityOf([row("different"), row("different"), row("different")]).level, "cool");
  assert.equal(proximityOf([row("common"), row("different"), row("different")]).level, "warm");
  assert.equal(proximityOf([row("common"), row("common"), row("different")]).level, "hot");
  assert.equal(proximityOf([row("common"), row("common")]).level, "hot");
  assert.match(proximityOf([row("common", "전극"), row("different")]).reason, /2개 요소 중 1개가 겹쳐요: 전극/);
});

test("compare API validates input and explains a missing OpenAI key", async (t) => {
  const previous = process.env.OPENAI_API_KEY;
  t.after(() => {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  });
  delete process.env.OPENAI_API_KEY;
  const request = (body: unknown) => new Request("http://localhost/api/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal((await compare(request({ idea: "고주파 피부 기기", id: "../etc" }))).status, 400);
  const missingKey = await compare(request({ idea: "고주파 피부 탄력 기기", id: "kipris:1020240000001" }));
  assert.equal(missingKey.status, 503);
  assert.match((await missingKey.json()).error, /OPENAI_API_KEY/);
});
