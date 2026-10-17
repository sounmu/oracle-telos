import assert from "node:assert/strict";
import { test } from "node:test";
import { denseRegions, queryOf, similarityText, toTemplate, yearTrend } from "../src/lib/explore";

test("입력 문장은 아이템과 핵심 기술, 대상, 분야 칸으로 나뉜다", () => {
  const t = toTemplate("환자를 위해 PLA 미세입자를 냉동 분사로 만드는 제조 방법");
  assert.equal(t.item, "환자를 위해 PLA 미세입자를 냉동 분사로 만드는 제조 방법");
  assert.equal(t.target, "환자");
  assert.equal(t.risk, "제조공법");
  assert.ok(t.tech.length > 0);
});

test("시연 문장 세 개는 네 칸이 모두 자연스럽게 채워진다", () => {
  const cases: [string, string, string, string][] = [
    [
      "피부과에서 쓰는 성형용 필러를 PDLLA 미세입자로 만들고 싶어요. 고분자를 에틸렌 카보네이트에 녹인 뒤 차가운 용액에 분사해 얼리는 냉동 분사 공법으로 입자를 만들 계획인데, 이미 비슷한 제조 방법 특허가 있는지 궁금해요.",
      "PDLLA 미세입자, 에틸렌 카보네이트, 냉동 분사", "피부과", "제조공법",
    ],
    [
      "전기차 배터리 회사에 납품할 분리막을 개발하려고 해요. 폴리에틸렌 다공성 막 위에 세라믹 무기물 입자와 바인더를 섞어 코팅해서 고온에서도 열수축이 적고 전극과 잘 붙게 만드는 방식인데, 이런 코팅 분리막에서 특허 분쟁 위험이 어디에 있는지 알고 싶어요.",
      "분리막, 무기물 입자, 바인더", "전기차 배터리 회사", "코팅 소재·공정",
    ],
    [
      "스마트폰 제조사에 공급할 OLED 패널, 그러니까 유기 발광 표시 장치의 화소 배열을 새로 설계하고 있어요. 녹색 서브 화소를 가상의 사각형 중심에 두고 빨강과 파랑 서브 화소를 꼭짓점에 배치해서 해상도를 높이는 구조인데, 기존 화소 배열 특허와 얼마나 겹치는지 확인하고 싶어요.",
      "OLED, 화소 배열, 녹색 서브 화소", "스마트폰 제조사", "화소 배열 구조",
    ],
  ];
  for (const [text, tech, target, risk] of cases) {
    const t = toTemplate(text);
    assert.equal(t.item, text);
    assert.equal(t.tech, tech);
    assert.equal(t.target, target);
    assert.equal(t.risk, risk);
  }
});

test("사전에 없는 문장도 조사·용언을 뺀 낱말로 핵심 기술을 채운다", () => {
  const t = toTemplate("학생을 위한 수학 풀이 피드백 앱을 만드는 방법");
  assert.equal(t.target, "학생");
  assert.ok(!t.tech.includes("만드"));
  assert.ok(!t.tech.split(", ").includes("학생"));
  assert.equal(t.tech.split(", ").length, 3);
});

test("조회 검색어는 네 칸을 모두 쓰고 빈 칸은 건너뛴다", () => {
  assert.equal(queryOf({ item: "PLA 필러", tech: "냉동 분사", target: "환자", risk: "제조공법" }), "PLA 필러 냉동 분사 환자 제조공법");
  assert.equal(queryOf({ item: "미세입자", tech: "  ", target: "", risk: "제조공법" }), "미세입자 제조공법");
});

test("추세는 출원 연도별로 센다", () => {
  assert.deepEqual(yearTrend([{ filed: "2016-01-03" }, { filed: "2015-05-01" }, { filed: "2016-02-02" }]), [
    { year: 2015, count: 1 },
    { year: 2016, count: 2 },
  ]);
});

test("밀집 영역은 점이 2건 이상 모인 칸만 센다", () => {
  const pts = [
    { id: "a", title: "A", cpc: "A61B100", x: 0, y: 0 },
    { id: "b", title: "B", cpc: "A61B200", x: 0.1, y: 0.1 },
    { id: "c", title: "C", cpc: "G06F100", x: 10, y: 10 },
  ];
  const regions = denseRegions(pts, 3, 4);
  assert.equal(regions.length, 1);
  assert.equal(regions[0].count, 2);
  assert.equal(regions[0].topCpc, "A61B");
});

test("유사도는 퍼센트로 보인다", () => {
  assert.equal(similarityText(0.734), "73%");
  assert.equal(similarityText(2), "100%");
});
