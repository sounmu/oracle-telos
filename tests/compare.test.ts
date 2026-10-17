import assert from "node:assert/strict";
import test from "node:test";
import { POST as compare } from "../src/app/api/compare/route";
import { comparisonSource, finalizeComparison, FIRST_CLAIM_CHARS, uncoveredClaimText, type DraftComparison } from "../src/lib/korea/compare";
import { coverageOf, dedupeClaimRows, proximityOf } from "../src/lib/proximity";
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

const ELECTRODE = "고주파 에너지를 출력하는 전극부";
const CONTROLLER = "상기 전극부의 출력을 피부 온도에 따라 조절하는 제어부";
const PRESSURE = "상기 전극부에 가해지는 압력을 측정하는 압력 센서";

function withFirstClaim(first: string): KoreanPatentDocument {
  return { ...document, patent: { ...document.patent, claims: [first, ...document.patent.claims.slice(1)] } };
}

function chartDraft(claimElements: DraftComparison["claimElements"]): DraftComparison {
  return { summary: "", rows: [], claimElements };
}

const electrodeRow = { element: ELECTRODE, status: "present", mine: "RF 전극", note: "같은 전극" } as const;
const controllerRow = { element: CONTROLLER, status: "present", mine: "피부 온도에 따라 출력을 조절", note: "같은 제어" } as const;

test("claim 1 is sent whole past the dependent-claim cut, so a late element is verifiable", () => {
  // 1,500자 뒤에 압력 센서를 둔 1,800자 안팎의 청구항 1
  const padding = "상기 전극부는 복수의 전극 핀으로 이루어지고 ".repeat(60);
  const first = `1. ${ELECTRODE}; ${CONTROLLER}; ${padding}및 ${PRESSURE}를 포함하는 기기.`;
  assert.ok(first.length > 1500 && first.length < FIRST_CLAIM_CHARS);
  const doc = withFirstClaim(first);
  assert.ok(comparisonSource(doc).includes(PRESSURE));

  // 모델이 압력 센서를 빼고 앞의 두 구성만 돌려주면 전체 대응으로 보지 않는다.
  const partial = finalizeComparison(chartDraft([electrodeRow, controllerRow]), elements, doc, idea);
  assert.equal(partial.claimChart.length, 2);
  assert.equal(partial.proximity.completeness.truncated, false);
  // 담기지 않은 문구는 긴 구간의 앞 80자만 보여 준다.
  assert.equal(partial.proximity.completeness.uncovered.length, 1);
  assert.match(partial.proximity.completeness.uncovered[0], /^상기 전극부는 복수의 전극 핀으로/);
  assert.ok(partial.proximity.completeness.uncovered[0].length <= 80);
  assert.equal(partial.proximity.level, "insufficient");
  assert.match(partial.proximity.reason, /대비표에 담기지 않은 문구/);
  assert.equal(coverageOf(partial.proximity), null);

  // 압력 센서를 '설명에 없음'으로 넣으면 원문에서 확인되어 서늘이 된다.
  const complete = finalizeComparison(
    chartDraft([electrodeRow, controllerRow, { element: PRESSURE, status: "absent", mine: null, note: "압력 센서 없음" }]),
    elements, doc, idea,
  );
  assert.equal(complete.proximity.level, "cool");
  assert.equal(complete.proximity.counts.total, 3);
});

test("a claim 1 longer than the limit is marked truncated and never reaches hot or warm", () => {
  const padding = "상기 전극부는 복수의 전극 핀으로 이루어지고 ".repeat(260);
  const first = `1. ${ELECTRODE}; ${CONTROLLER}; ${padding}및 ${PRESSURE}를 포함하는 기기.`;
  assert.ok(first.length > FIRST_CLAIM_CHARS);
  const doc = withFirstClaim(first);
  assert.ok(!comparisonSource(doc).includes(PRESSURE));

  const result = finalizeComparison(chartDraft([electrodeRow, controllerRow]), elements, doc, idea);
  assert.equal(result.proximity.completeness.truncated, true);
  assert.equal(result.proximity.level, "insufficient");
  assert.match(result.proximity.reason, /앞부분만 확인/);
  assert.equal(coverageOf(result.proximity), null);

  // 잘렸어도 설명에 없는 구성이 확인되면 서늘이다(완비 원칙은 구성 하나로 충분).
  const absent = finalizeComparison(
    chartDraft([electrodeRow, { ...controllerRow, status: "absent", mine: null }]), elements, doc, idea,
  );
  assert.equal(absent.proximity.level, "cool");
});

test("uncovered claim text ignores preamble, connectives and the closing subject but keeps skipped limitations", () => {
  const title = document.title;
  assert.deepEqual(uncoveredClaimText(`1. ${ELECTRODE}; 및 ${CONTROLLER}를 포함하는 기기.`, [ELECTRODE, CONTROLLER], title), []);
  assert.deepEqual(
    uncoveredClaimText(`1. 고주파 피부 탄력 기기에 있어서, ${ELECTRODE}; 및 ${CONTROLLER}를 포함하는 것을 특징으로 하는 고주파 피부 탄력 기기.`, [ELECTRODE, CONTROLLER], title),
    [],
  );
  // 공백·인용부호만 다른 구성 문구도 원문에서 지워진다.
  assert.deepEqual(
    uncoveredClaimText(`1. “고주파 에너지를  출력하는 전극부”; 및 ${CONTROLLER}를 포함하는 휴대용 피부 관리 장치.`, ["고주파에너지를출력하는전극부", CONTROLLER], title),
    [],
  );
  assert.deepEqual(
    uncoveredClaimText(`1. ${ELECTRODE}; ${PRESSURE}; 및 ${CONTROLLER}를 포함하는 기기.`, [ELECTRODE, CONTROLLER], title),
    [PRESSURE],
  );
  // 첫 구성 앞은 전제 문구만 지우므로, 맨 앞 구성을 빠뜨려도 잡힌다.
  assert.deepEqual(
    uncoveredClaimText(`1. ${PRESSURE}; ${ELECTRODE}; 및 ${CONTROLLER}를 포함하는 기기.`, [ELECTRODE, CONTROLLER], title),
    [PRESSURE],
  );
  assert.deepEqual(
    uncoveredClaimText(`1. 피부 미용 장치에 있어서, ${PRESSURE}; ${ELECTRODE}; 및 ${CONTROLLER}를 포함하는 피부 미용 장치.`, [ELECTRODE, CONTROLLER], title),
    [PRESSURE],
  );
  // 제목과 다른 전제부, "~로서," 전제부는 구성으로 세지 않는다.
  assert.deepEqual(
    uncoveredClaimText(`1. 피부 미용 장치에 있어서, ${ELECTRODE}; 및 ${CONTROLLER}를 포함하는 피부 미용 장치.`, [ELECTRODE, CONTROLLER], title),
    [],
  );
  assert.deepEqual(
    uncoveredClaimText(`1. 피부 미용을 위한 고주파 장치로서, ${ELECTRODE}; 및 ${CONTROLLER}를 포함하는 고주파 장치.`, [ELECTRODE, CONTROLLER], title),
    [],
  );
  // "배터리"처럼 짧은 구성도 빠지면 잡히고, 수량 표현·도면 부호는 구성으로 세지 않는다.
  assert.deepEqual(uncoveredClaimText(`1. 배터리; ${ELECTRODE}; 및 ${CONTROLLER}를 포함하는 기기.`, [ELECTRODE, CONTROLLER], title), ["배터리"]);
  assert.deepEqual(
    uncoveredClaimText(`1. ${ELECTRODE}; 상기 전극부에 전원을 공급하는 배터리; 및 ${CONTROLLER}를 포함하는 기기.`, [ELECTRODE, CONTROLLER, "상기 전극부에 전원을 공급하는"], title),
    ["배터리"],
  );
  assert.deepEqual(
    uncoveredClaimText(`1. 복수의 ${ELECTRODE}; 각각의 상기 전극부(110)에 연결된 펌프; 및 제 1 ${CONTROLLER}를 포함하는 기기.`, [ELECTRODE, CONTROLLER], title),
    ["각각의 상기 전극부(110)에 연결된 펌프"],
  );
  assert.deepEqual(uncoveredClaimText(`1. 복수의 ${ELECTRODE}; 및 제 1 ${CONTROLLER}를 포함하는 기기.`, [ELECTRODE, CONTROLLER], title), []);
  // 단위가 붙은 수치·범위는 짧아도 미검토 조건으로 남긴다. 순번과 도면 부호는 수치 조건이 아니다.
  const power = "전압을 상기 전극부에 공급하는 전원부";
  assert.deepEqual(uncoveredClaimText(`1. ${ELECTRODE}; 5V의 ${power}; 및 ${CONTROLLER}를 포함하는 기기.`, [ELECTRODE, power, CONTROLLER], title), ["5V의"]);
  assert.deepEqual(uncoveredClaimText(`1. ${ELECTRODE}; 5V의 ${power}; 및 ${CONTROLLER}를 포함하는 기기.`, [ELECTRODE, `5V의 ${power}`, CONTROLLER], title), []);
  assert.deepEqual(uncoveredClaimText(`1. 1~5mm 두께의 전극 패드; 및 ${CONTROLLER}를 포함하는 기기.`, ["두께의 전극 패드", CONTROLLER], title), ["1~5mm"]);
  assert.deepEqual(uncoveredClaimText(`1. 40℃ 이상에서 출력을 멈추는 제어부; 및 ${ELECTRODE}를 포함하는 기기.`, ["출력을 멈추는 제어부", ELECTRODE], title), ["40°C 이상에서"]);
  assert.deepEqual(uncoveredClaimText(`1. 10% 이상의 농도로 약물을 담는 저장부; 및 ${ELECTRODE}를 포함하는 기기.`, ["농도로 약물을 담는 저장부", ELECTRODE], title), ["10% 이상의"]);
  assert.deepEqual(uncoveredClaimText(`1. 2개의 ${ELECTRODE}; 및 ${CONTROLLER}를 포함하는 기기.`, [ELECTRODE, CONTROLLER], title), ["2개의"]);
  assert.deepEqual(
    uncoveredClaimText(`1. 복수의 ${ELECTRODE}; 각각의 상기 전극부(110)에 연결된 펌프(120); 및 제 1 ${CONTROLLER}를 포함하는 기기.`, [ELECTRODE, "상기 전극부(110)에 연결된 펌프(120)", CONTROLLER], title),
    [],
  );
  assert.deepEqual(uncoveredClaimText(`1. 제1 ${ELECTRODE}; 제 2 전극부; 및 ${CONTROLLER}를 포함하는 기기.`, [ELECTRODE, "제 2 전극부", CONTROLLER], title), []);
  // "포함하되, 상기 …" 뒤의 한정은 종결 주어가 아니라 구성이다.
  const wherein = uncoveredClaimText(
    `1. ${ELECTRODE}; 및 ${CONTROLLER}를 포함하되, 상기 제어부는 피부 온도가 40도를 넘으면 출력을 차단하는 피부 미용 장치.`,
    [ELECTRODE, CONTROLLER], title,
  );
  assert.equal(wherein.length, 1);
  assert.match(wherein[0], /40도를 넘으면 출력을 차단/);
});

test("a claim element quoted without its numeric limit is not counted as fully present", () => {
  const power = "전압을 상기 전극부에 공급하는 전원부";
  const doc = withFirstClaim(`1. ${ELECTRODE}; 5V의 ${power}; 및 ${CONTROLLER}를 포함하는 기기.`);
  const twelveVolt = `${idea}. 12V 전원부가 전극부에 전압을 공급한다`;
  // 모델이 "5V의"를 빼고 인용하고 내 설명의 12V 전원부를 '같음'으로 돌려준 경우
  const dropped = finalizeComparison(
    chartDraft([electrodeRow, { element: power, status: "present", mine: "12V 전원부", note: "전원부 있음" }, controllerRow]),
    elements, doc, twelveVolt,
  );
  assert.deepEqual(dropped.claimChart.map((r) => r.status), ["present", "present", "present"]);
  assert.deepEqual(dropped.proximity.completeness.uncovered, ["5V의"]);
  assert.equal(dropped.proximity.level, "insufficient");
  assert.match(dropped.proximity.reason, /5V/);
  assert.equal(coverageOf(dropped.proximity), null);

  // 수치까지 인용하고 다른 수단으로 판정하면 따뜻이다.
  const kept = finalizeComparison(
    chartDraft([electrodeRow, { element: `5V의 ${power}`, status: "modified", mine: "12V 전원부", note: "전압이 달라요" }, controllerRow]),
    elements, doc, twelveVolt,
  );
  assert.equal(kept.proximity.level, "warm");
});

test("duplicate claim rows collapse to one element and the cautious status wins", () => {
  const doc = withFirstClaim(`1. ${ELECTRODE}; 및 ${PRESSURE}를 포함하는 기기.`);
  // 같은 행을 두 번 넣어도 고유 구성은 하나라 뜨거움·2/2가 되지 않는다.
  const twice = finalizeComparison(chartDraft([electrodeRow, electrodeRow]), elements, doc, idea);
  assert.equal(twice.claimChart.length, 1);
  assert.equal(twice.proximity.counts.total, 1);
  assert.equal(twice.proximity.level, "insufficient");

  // 공백·인용부호만 다른 중복도 하나로 합친다.
  const spaced = finalizeComparison(
    chartDraft([electrodeRow, { ...electrodeRow, element: "“고주파 에너지를  출력하는 전극부”" }]), elements, doc, idea,
  );
  assert.equal(spaced.claimChart.length, 1);

  // 같은 구성에 '있음'과 '없음'이 함께 오면 어느 쪽도 확정하지 않고 '확인 필요'로 남긴다.
  const conflicting = finalizeComparison(
    chartDraft([
      electrodeRow,
      { element: ELECTRODE, status: "absent", mine: null, note: "전극 없음" },
      { element: PRESSURE, status: "present", mine: "RF 전극", note: "" },
    ]), elements, doc, idea,
  );
  assert.deepEqual(conflicting.claimChart.map((r) => [r.element, r.status, r.mine]), [[ELECTRODE, "unconfirmed", null], [PRESSURE, "present", "RF 전극"]]);
  assert.match(conflicting.claimChart[0].note, /판정이 서로 달라/);
  assert.equal(conflicting.proximity.level, "insufficient");
  assert.equal(conflicting.proximity.counts.total, 2);

  assert.deepEqual(
    dedupeClaimRows([claim("present", "A"), claim("unconfirmed", "a "), claim("modified", "B"), claim("present", "B"), claim("absent", "C"), claim("absent", "C")]).map((r) => [r.element, r.status]),
    [["A", "unconfirmed"], ["B", "unconfirmed"], ["C", "absent"]],
  );
  // 원문에서 찾지 못한 구성도 중복은 한 번만 센다.
  const unverifiedTwice = finalizeComparison(
    chartDraft([electrodeRow, { element: "스마트폰 앱과 블루투스로 연결되는 통신부", status: "absent", mine: null, note: "" }, { element: "스마트폰 앱과 블루투스로 연결되는 통신부", status: "absent", mine: null, note: "" }]),
    elements, doc, idea,
  );
  assert.equal(unverifiedTwice.proximity.counts.unconfirmed, 1);
});

test("missing model rows become unconfirmed rows for every planned element", () => {
  const result = finalizeComparison({ summary: "", rows: [], claimElements: [] }, elements, document, idea);
  assert.equal(result.rows.length, elements.length);
  assert.ok(result.rows.every((r) => r.relation === "unconfirmed" && r.theirs === null && r.note !== ""));
  assert.equal(result.proximity.level, "insufficient");
});

test("proximity follows the all-elements rule in order: absent, insufficient evidence, modified, all present", () => {
  assert.equal(proximityOf([claim("present")]).level, "insufficient");
  // 설명에 없는 구성은 화면 규칙 순서대로 최소 구성 수보다 먼저 본다.
  assert.equal(proximityOf([claim("absent")]).level, "cool");
  assert.equal(proximityOf([claim("present"), claim("present", "A"), claim("absent", "B")]).level, "cool");
  // 없는 구성이 하나라도 확인되면 나머지가 불확실해도 서늘이다.
  assert.equal(proximityOf([claim("absent"), claim("unconfirmed", "A"), claim("unconfirmed", "B")]).level, "cool");
  assert.equal(proximityOf([claim("present"), claim("modified", "A"), claim("unconfirmed", "B")]).level, "insufficient");
  assert.equal(proximityOf([claim("present"), claim("present", "A")], { unverified: 1 }).level, "insufficient");
  assert.equal(proximityOf([claim("present"), claim("present", "A")], { completeness: { truncated: true, uncovered: [] } }).level, "insufficient");
  assert.equal(proximityOf([claim("present"), claim("modified", "A")], { completeness: { truncated: false, uncovered: ["압력 센서"] } }).level, "insufficient");
  assert.equal(proximityOf([claim("present"), claim("modified", "A")]).level, "warm");
  assert.equal(proximityOf([claim("present"), claim("present", "A")]).level, "hot");
  // 같은 구성 문구는 하나로 센다.
  assert.equal(proximityOf([claim("present"), claim("present")]).level, "insufficient");
  assert.equal(proximityOf([claim("present"), claim("present")]).counts.total, 1);
  assert.match(proximityOf([claim("present"), claim("present", "A"), claim("absent", "B")]).reason, /구성 3개 중 1개가 내 설명에 없어요/);
  assert.deepEqual(coverageOf(proximityOf([claim("present"), claim("modified", "A")])), { matched: 2, total: 2 });
  assert.equal(coverageOf(proximityOf([claim("present"), claim("unconfirmed", "A")])), null);
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
