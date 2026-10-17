import assert from "node:assert/strict";
import test from "node:test";
import { POST as compare } from "../src/app/api/compare/route";
import { finalizeComparison, type DraftComparison } from "../src/lib/korea/compare";
import { coverageOf, proximityOf } from "../src/lib/proximity";
import type { ClaimElementRow, KoreanPatentDocument } from "../src/lib/types";

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
const idea = "RF 전극으로 진피를 가열하고 피부 온도에 따라 출력을 조절하는 탄력 기기";

function claim(status: ClaimElementRow["status"], element = "구성"): ClaimElementRow {
  return { element, status, mine: status === "present" || status === "modified" ? "내 설명" : null, note: "" };
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
    claimElements: [],
  };

  const result = finalizeComparison(draft, elements, document, idea);

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
  // 근접도는 청구항 대비표로만 정하므로 기술 요소 행이 공통이어도 대비표가 비면 자료 부족이다.
  assert.equal(result.proximity.level, "insufficient");
});

test("claim chart keeps only claim-1 quotes and my-description quotes found verbatim", () => {
  const draft: DraftComparison = {
    summary: "",
    rows: [],
    claimElements: [
      { element: "고주파 에너지를 출력하는 전극부", status: "present", mine: "RF 전극", note: "같은 전극" },
      { element: "상기 전극부의 출력을 피부 온도에 따라 조절하는 제어부", status: "present", mine: "피부 온도에 따라 출력을 조절", note: "같은 제어" },
      // 청구항 6 문구는 청구항 1이 아니므로 구성으로 인정하지 않는다.
      { element: "스마트폰 앱과 블루투스로 연결되는 통신부", status: "absent", mine: null, note: "앱 없음" },
    ],
  };
  const result = finalizeComparison(draft, elements, document, idea);
  assert.deepEqual(result.claimChart.map((r) => r.status), ["present", "present"]);
  assert.equal(result.proximity.counts.total, 3);
  assert.equal(result.proximity.counts.unconfirmed, 1);
  assert.equal(result.proximity.level, "insufficient");

  const paraphrased = finalizeComparison(
    { ...draft, claimElements: [draft.claimElements[0], { ...draft.claimElements[1], mine: "온도 기반 자동 출력 제어" }] },
    elements, document, idea,
  );
  assert.deepEqual(paraphrased.claimChart.map((r) => [r.status, r.mine]), [["present", "RF 전극"], ["unconfirmed", null]]);

  const grounded = finalizeComparison({ ...draft, claimElements: draft.claimElements.slice(0, 2) }, elements, document, idea);
  assert.equal(grounded.proximity.level, "hot");
  assert.equal(grounded.proximity.commonElements.length, 2);
});

test("missing model rows become unconfirmed rows for every planned element", () => {
  const result = finalizeComparison({ summary: "", rows: [], claimElements: [] }, elements, document, idea);
  assert.equal(result.rows.length, elements.length);
  assert.ok(result.rows.every((r) => r.relation === "unconfirmed" && r.theirs === null && r.note !== ""));
  assert.equal(result.proximity.level, "insufficient");
});

test("proximity follows the all-elements rule in order: absent, unconfirmed, modified, all present", () => {
  assert.equal(proximityOf([claim("present")]).level, "insufficient");
  assert.equal(proximityOf([claim("present"), claim("present"), claim("absent")]).level, "cool");
  // 없는 구성이 하나라도 확인되면 나머지가 불확실해도 서늘이다.
  assert.equal(proximityOf([claim("absent"), claim("unconfirmed"), claim("unconfirmed")]).level, "cool");
  assert.equal(proximityOf([claim("present"), claim("modified"), claim("unconfirmed")]).level, "insufficient");
  assert.equal(proximityOf([claim("present"), claim("present")], 1).level, "insufficient");
  assert.equal(proximityOf([claim("present"), claim("modified")]).level, "warm");
  assert.equal(proximityOf([claim("present"), claim("present")]).level, "hot");
  assert.match(proximityOf([claim("present"), claim("present"), claim("absent")]).reason, /구성 3개 중 1개가 내 설명에 없어요/);
  assert.deepEqual(coverageOf(proximityOf([claim("present"), claim("modified")])), { matched: 2, total: 2 });
  assert.equal(coverageOf(proximityOf([claim("present"), claim("unconfirmed")])), null);
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
