/* eslint-disable */
/*
 * 목업 응답. 백엔드(oracle-telos) API와 같은 모양이다.
 * - file:// 로 열었거나 주소에 ?mock=1 을 붙이면 이 데이터를 쓴다.
 * - 특허 제목·출원인·번호는 모두 예시값이다. 실제 특허가 아니다.
 * 타입 기준: src/lib/types.ts (SearchResponse, PatentComparison, PatentFull, PatentMapResponse, AgentEvent)
 */
(function () {
  // 지도 점: 결정론적 난수로 세 덩어리를 만든다.
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const clusters = [
    { cx: -2.2, cy: 1.4, cpc: "A61K 9/16", n: 70 },
    { cx: 2.0, cy: 1.8, cpc: "A61K 38/26", n: 55 },
    { cx: 0.6, cy: -2.0, cpc: "A61L 27/18", n: 60 },
  ];
  const decisions = ["ACCEPTED", "ACCEPTED", "ACCEPTED", "PENDING", "REJECTED", "UNKNOWN"];
  const points = [];
  let serial = 1000;
  clusters.forEach((c) => {
    for (let i = 0; i < c.n; i += 1) {
      serial += 1;
      points.push({
        id: "kipris:10202300" + String(serial).padStart(5, "0"),
        title: "[예시] 주변 특허 " + serial,
        decision: decisions[Math.floor(rand() * decisions.length)],
        cpc: c.cpc,
        filed: "2023-0" + (1 + Math.floor(rand() * 9)) + "-1" + Math.floor(rand() * 9),
        x: c.cx + (rand() - 0.5) * 2.4,
        y: c.cy + (rand() - 0.5) * 2.0,
        abstract: "예시 지도 점이에요.",
      });
    }
  });

  const hits = [
    { id: "kipris:1020210000001", title: "GLP-1 유사체를 포함하는 서방형 미립구 약학 조성물", decision: "ACCEPTED", cpc: "A61K 9/16", filed: "2021-02-15", score: 0.86, applicant: "[예시 출원인 A]", abstract: "생분해성 고분자 미립구에 GLP-1 유사체를 담아 서서히 방출하는 주사용 조성물에 관한 예시 초록이에요.", x: -1.6, y: 1.2 },
    { id: "kipris:1020200000002", title: "생분해성 고분자 미립구의 제조방법 및 이를 포함하는 주사제", decision: "ACCEPTED", cpc: "A61K 9/16", filed: "2020-07-03", score: 0.81, applicant: "[예시 출원인 B]", abstract: "이중 유화와 용매 증발로 고분자 미립구를 만드는 방법에 관한 예시 초록이에요.", x: -2.4, y: 0.9 },
    { id: "kipris:1020220000003", title: "펩타이드 약물의 초기 과다 방출을 줄인 미립구 조성물", decision: "PENDING", cpc: "A61K 38/26", filed: "2022-11-21", score: 0.77, applicant: "[예시 출원인 C]", abstract: "미립구 표면 처리로 투여 직후 약물이 한꺼번에 나오는 현상을 줄이는 예시 초록이에요.", x: 1.4, y: 1.5 },
    { id: "kipris:1020190000004", title: "미립구 크기 분포를 균일하게 하는 미세유체 제조 장치", decision: "ACCEPTED", cpc: "B01J 13/04", filed: "2019-05-30", score: 0.64, applicant: "[예시 출원인 E]", abstract: "미세유체 칩으로 입자 크기를 고르게 만드는 장치에 관한 예시 초록이에요.", x: 0.2, y: -1.1 },
    { id: "kipris:1020230000005", title: "3개월 이상 방출하는 서방형 주사제 조성물", decision: "ACCEPTED", cpc: "A61K 9/16", filed: "2023-03-08", score: 0.61, applicant: "[예시 출원인 F]", abstract: "방출 기간을 늘린 서방형 주사제에 관한 예시 초록이에요.", x: -1.0, y: 2.3 },
    { id: "kipris:1020210000006", title: "고분자 미립구의 표면 개질 방법", decision: "REJECTED", cpc: "A61K 9/50", filed: "2021-09-14", score: 0.58, applicant: "[예시 출원인 D]", abstract: "미립구 표면에 친수성 층을 입히는 방법에 관한 예시 초록이에요.", x: 2.6, y: 0.6 },
    { id: "kipris:1020240000007", title: "콜라겐 생성 유도용 고분자 미세입자 필러", decision: "PENDING", cpc: "A61L 27/18", filed: "2024-01-19", score: 0.55, applicant: "[예시 출원인 H]", abstract: "피부에 주입해 콜라겐 생성을 돕는 고분자 미세입자에 관한 예시 초록이에요.", x: 0.9, y: -2.4 },
  ];

  const rows = {
    "kipris:1020210000001": [
      { element: "고분자 기재", mine: "PLGA (50:50)", theirs: "생분해성 고분자", relation: "common", note: "청구항이 생분해성 고분자 전체로 넓게 적혀 있어 내 기재가 포함돼요.", evidence: "생분해성 고분자로 이루어진 미립구" },
      { element: "담는 약물", mine: "세마글루타이드", theirs: "GLP-1 유사체 또는 그 염", relation: "common", note: "세마글루타이드는 GLP-1 유사체에 속해요.", evidence: "GLP-1 유사체 또는 이의 약학적으로 허용가능한 염" },
      { element: "입자 크기", mine: "30~50 µm", theirs: "10~100 µm", relation: "common", note: "내 범위가 청구항 범위 안에 있어요.", evidence: "평균 입경이 10 내지 100 ㎛" },
      { element: "첨가제", mine: "아연 이온 없음", theirs: "아연 이온 포함", relation: "different", note: "청구항 구성 하나가 내 기술에 없어요.", evidence: "아연 이온을 더 포함하는" },
      { element: "제조 공정", mine: "미세유체 칩 단일 유화", theirs: null, relation: "unconfirmed", note: "조성물 청구항이라 제조 방법은 원문에서 확인되지 않았어요.", evidence: null },
    ],
    "kipris:1020200000002": [
      { element: "고분자 기재", mine: "PLGA (50:50)", theirs: "PLGA", relation: "common", note: "같은 고분자를 써요.", evidence: "폴리(락타이드-코-글리콜라이드)" },
      { element: "제조 공정", mine: "미세유체 칩 단일 유화", theirs: "이중 유화 후 용매 증발", relation: "different", note: "유화 방식이 달라요.", evidence: "W/O/W 이중 유화" },
      { element: "담는 약물", mine: "세마글루타이드", theirs: "펩타이드 약물", relation: "common", note: "펩타이드 약물 범위에 들어가요.", evidence: "펩타이드 약물을 봉입한" },
      { element: "방출 기간", mine: "4주", theirs: null, relation: "unconfirmed", note: "원문에서 방출 기간을 찾지 못했어요.", evidence: null },
    ],
    "kipris:1020220000003": [
      { element: "담는 약물", mine: "세마글루타이드", theirs: "펩타이드 약물", relation: "common", note: "펩타이드 약물 범위에 들어가요.", evidence: "펩타이드 약물" },
      { element: "초기 방출 제어", mine: null, theirs: "표면 코팅층으로 초기 방출 억제", relation: "unconfirmed", note: "내 설명에 초기 방출 제어 방법이 없어요. 추가로 확인해 보세요.", evidence: "초기 과다 방출을 억제하는 코팅층" },
      { element: "고분자 기재", mine: "PLGA (50:50)", theirs: "PLA", relation: "different", note: "고분자 종류가 달라요.", evidence: "폴리락타이드" },
    ],
  };
  function proximityOf(r) {
    const confirmed = r.filter((x) => x.relation !== "unconfirmed");
    const common = confirmed.filter((x) => x.relation === "common").map((x) => x.element);
    if (confirmed.length < 2) return { level: "insufficient", reason: "원문에서 근거를 확인한 기술 요소가 " + confirmed.length + "개뿐이라 비교하기 어려워요.", commonElements: common };
    const ratio = common.length / confirmed.length;
    const level = ratio >= 2 / 3 ? "hot" : ratio >= 1 / 3 ? "warm" : "cool";
    return { level, reason: common.length ? "근거를 확인한 " + confirmed.length + "개 요소 중 " + common.length + "개가 겹쳐요: " + common.join(", ") : "근거를 확인한 " + confirmed.length + "개 요소가 모두 달라요.", commonElements: common };
  }
  const summaries = {
    "kipris:1020210000001": "같은 약물을 같은 종류의 고분자 미립구에 담는 조성물 특허예요.",
    "kipris:1020200000002": "같은 고분자로 미립구를 만드는 제조방법 특허예요.",
    "kipris:1020220000003": "펩타이드 미립구의 초기 방출을 줄이는 특허예요.",
  };
  function comparisonFor(id) {
    const r = rows[id] || [
      { element: "고분자 기재", mine: "PLGA (50:50)", theirs: "생분해성 고분자", relation: "common", note: "고분자 계열이 같아요.", evidence: "생분해성 고분자" },
      { element: "적용 분야", mine: "GLP-1 서방형 주사제", theirs: "다른 용도", relation: "different", note: "적용 분야가 달라요.", evidence: "용도" },
      { element: "제조 공정", mine: "미세유체 칩 단일 유화", theirs: "다른 공정", relation: "different", note: "공정이 달라요.", evidence: "공정" },
    ];
    return {
      patentId: id,
      summary: summaries[id] || "인접 기술 영역의 특허예요.",
      rows: r,
      proximity: proximityOf(r),
      claimsReviewed: 5,
      claimsTotal: 12,
      sourceUrl: "https://www.kipris.or.kr",
    };
  }
  function patentFull(id) {
    const h = hits.find((x) => x.id === id) || points.find((x) => x.id === id) || hits[0];
    return {
      id: h.id,
      title: h.title,
      publication: "10-20XX-XXXXXXX",
      decision: h.decision,
      cpc: h.cpc,
      cpcLabels: [h.cpc],
      filed: h.filed,
      abstract: h.abstract,
      firstClaim: "[예시] 청구항 1. 생분해성 고분자로 이루어진 미립구 및 상기 미립구에 담긴 GLP-1 유사체 또는 이의 약학적으로 허용가능한 염을 포함하는 서방형 약학 조성물.",
      claims: [
        "[예시] 청구항 1. 생분해성 고분자로 이루어진 미립구 및 상기 미립구에 담긴 GLP-1 유사체 또는 이의 약학적으로 허용가능한 염을 포함하는 서방형 약학 조성물.",
        "[예시] 청구항 2. 제1항에 있어서, 상기 미립구의 평균 입경이 10 내지 100 ㎛인 조성물.",
        "[예시] 청구항 3. 제1항에 있어서, 아연 이온을 더 포함하는 조성물.",
      ],
      x: h.x || 0,
      y: h.y || 0,
      sourceUrl: "https://www.kipris.or.kr",
      fetchedAt: "2026-10-16T13:00:00Z",
      rawStatus: h.decision === "ACCEPTED" ? "등록" : h.decision === "REJECTED" ? "거절" : h.decision === "PENDING" ? "공개" : "",
      applicants: [h.applicant || "[예시 출원인]"],
    };
  }

  window.TELOS_MOCK = {
    patents: {
      dataset: "korea",
      points,
      builtAt: "2026-10-16T13:00:00Z",
      status: {
        builtAt: "2026-10-16T13:00:00Z",
        model: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
        sources: [
          { source: "kipris", configured: true, count: points.length },
          { source: "law", configured: false, count: 0 },
          { source: "dart", configured: false, count: 0 },
        ],
      },
    },
    search: {
      hits: hits.map(({ x, y, ...rest }) => rest),
      addedPoints: hits.map(({ id, title, decision, cpc, filed, x, y, abstract }) => ({ id, title, decision, cpc, filed, x, y, abstract })),
      warnings: [],
      coverage: { queries: ["생분해성 미립구 서방형", "GLP-1 유사체 주사제", "미립구 제조방법"], candidates: 57, detailed: 12 },
      elements: ["고분자 기재", "담는 약물", "입자 크기", "방출 기간", "첨가제", "제조 공정"],
    },
    compare: comparisonFor,
    patent: patentFull,
    agentText:
      "한 줄 요약\n같은 약물을 같은 계열 고분자 미립구에 담는 등록 특허가 있어요. 첨가제와 제조 공정에서 차이가 확인돼요.\n\n" +
      "유사 특허\n- 출원번호 1020210000001 (등록): 고분자 기재, 약물, 입자 크기가 겹쳐요. 아연 이온 포함 여부가 달라요.\n" +
      "- 출원번호 1020200000002 (등록): 같은 고분자를 쓰지만 유화 방식이 달라요.\n\n" +
      "아이템 방향 제안\n- 첨가제 구성 차이를 설계 문서에 분명히 남기세요.\n- 미세유체 단일 유화 공정을 별도 특허로 검토해 보세요.\n\n" +
      "[예시 응답] 검색 점수는 등록 가능성이나 침해 확률이 아니에요.",
  };
})();
