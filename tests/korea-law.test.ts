// 합성(SYNTHETIC) fixture: 문서화된 eflaw 목록/본문 응답 형태를 흉내 낸 가짜 데이터이며 실제 법령이 아니다.
import assert from "node:assert/strict";
import test from "node:test";
import { zipSync, strToU8 } from "fflate";
import { collectLaws } from "../src/lib/korea/laws";
import { SourceError } from "../src/lib/korea/http";
import type { CollectOptions, LawDocument } from "../src/lib/types";

async function run(
  options: CollectOptions,
  key: string,
  fetcher: typeof fetch,
): Promise<{ documents: LawDocument[]; warnings: string[] }> {
  const result = await collectLaws(options, key, fetcher);
  return {
    warnings: result.warnings,
    documents: result.documents.filter((d): d is LawDocument => d.source === "law"),
  };
}

const KEY = "synthetic-oc";

function listXml(rows: string[], total = rows.length): string {
  return `<?xml version="1.0" encoding="UTF-8"?><LawSearch><target>eflaw</target><totalCnt>${total}</totalCnt><page>1</page>${rows.join("")}</LawSearch>`;
}

function listRow(id: number, lawId: string, mst: string, ef: string, code = "현행"): string {
  return `<law id="${id}"><법령일련번호>${mst}</법령일련번호><현행연혁코드>${code}</현행연혁코드><법령명한글><![CDATA[합성 데이터법]]></법령명한글><법령ID>${lawId}</법령ID><공포일자>20230110</공포일자><공포번호>19000</공포번호><시행일자>${ef}</시행일자></law>`;
}

const BODY = `<?xml version="1.0" encoding="UTF-8"?>
<법령 법령키="001">
  <기본정보><법령ID>000830</법령ID><공포일자>20230110</공포일자><법령명_한글>합성 데이터법</법령명_한글><시행일자>20240110</시행일자></기본정보>
  <조문>
    <조문단위 조문키="a"><조문번호>1</조문번호><조문여부>전문</조문여부><조문내용>제1장 총칙</조문내용></조문단위>
    <조문단위 조문키="b"><조문번호>2</조문번호><조문여부>조문</조문여부><조문제목>목적</조문제목><조문시행일자>20240110</조문시행일자>
      <조문내용><![CDATA[제2조(목적) 이 법은 <b>데이터</b> 보호를 위한다. &lt;개정 2023.1.10&gt;<script>alert(1)</script>]]></조문내용>
      <항><항번호>①</항번호><항내용>① 첫째 항 &amp; 설명</항내용>
        <호><호번호>1.</호번호><호내용>1. 첫째 호</호내용><목><목번호>가.</목번호><목내용>가. 첫째 목</목내용></목></호>
        <호><호번호>2.</호번호><호내용>2. 둘째 호</호내용></호>
      </항>
    </조문단위>
    <조문단위 조문키="c"><조문번호>3</조문번호><조문가지번호>2</조문가지번호><조문여부>조문</조문여부><조문제목>가지 조문</조문제목><조문시행일자>20250101</조문시행일자>
      <조문내용>제3조의2(가지 조문) 단일 문단 조문.</조문내용></조문단위>
    <조문단위 조문키="d"><조문번호>4</조문번호><조문여부>조문</조문여부><조문내용>제4조 삭제 &lt;2023.1.10&gt;</조문내용></조문단위>
  </조문>
  <부칙><부칙단위><부칙공포일자>20230110</부칙공포일자><부칙내용>제1조(시행일) 공포 후 1년이 지난 날부터 시행한다.</부칙내용></부칙단위></부칙>
</법령>`;

const options: CollectOptions = { query: "합성", limit: 20 };

interface Call {
  readonly url: URL;
}

function router(
  handlers: { list: (url: URL) => Response; body: (url: URL) => Response },
  calls: Call[] = [],
): typeof fetch {
  return async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push({ url });
    return url.pathname.endsWith("lawSearch.do") ? handlers.list(url) : handlers.body(url);
  };
}

const xml = (body: string): Response => new Response(body, { status: 200 });

test("목록과 본문을 정규화하고 ID/날짜/조문 구조를 보존한다", async () => {
  const calls: Call[] = [];
  const fetcher = router(
    { list: () => xml(listXml([listRow(1, "000830", "166520", "20240110")])), body: () => xml(BODY) },
    calls,
  );
  const result = await run(options, KEY, fetcher);

  const listCall = calls[0]?.url;
  assert.equal(listCall?.searchParams.get("target"), "eflaw");
  assert.equal(listCall?.searchParams.get("nw"), "3");
  assert.equal(listCall?.searchParams.get("OC"), KEY);
  const bodyCall = calls[1]?.url;
  assert.equal(bodyCall?.pathname, "/DRF/lawService.do");
  assert.equal(bodyCall?.searchParams.get("MST"), "166520");
  assert.equal(bodyCall?.searchParams.get("efYd"), "20240110");

  assert.deepEqual(
    result.documents.map((d) => d.id),
    [
      "law:000830:166520:20240110:2-0",
      "law:000830:166520:20240110:3-2",
      "law:000830:166520:20240110:addenda-1",
    ],
  );
  const [article, branch, addenda] = result.documents;
  assert.ok(article && branch && addenda);
  assert.equal(article.law.articleNumber, "제2조");
  assert.equal(article.law.lawId, "000830");
  assert.equal(article.law.mst, "166520");
  assert.equal(article.law.state, "current");
  assert.equal(article.law.effectiveFrom, "2024-01-10");
  assert.equal(article.law.promulgatedAt, "2023-01-10");
  assert.equal(article.law.effectiveTo, null);
  assert.equal(branch.law.articleNumber, "제3조의2");
  assert.equal(branch.law.effectiveFrom, "2025-01-01");
  assert.equal(addenda.law.effectiveFrom, "2024-01-10");
  assert.ok(!article.url.includes(KEY));

  assert.ok(!/<\/?(b|script)/i.test(article.text));
  assert.ok(article.text.includes("<개정 2023.1.10>"));
  assert.ok(article.text.includes("첫째 항 & 설명"));
  const lines = article.text.split("\n");
  const paragraph = lines.findIndex((l) => l.includes("첫째 항"));
  assert.ok(paragraph > 0);
  assert.equal(lines[paragraph + 1], "  1. 첫째 호");
  assert.equal(lines[paragraph + 2], "    가. 첫째 목");
  assert.equal(lines[paragraph + 3], "  2. 둘째 호");
  assert.ok(!result.documents.some((d) => d.law.articleNumber === "제4조"));
  assert.ok(!result.documents.some((d) => d.text.includes("제1장")));
  assert.deepEqual(result.warnings, []);
});

test("같은 법령의 서로 다른 시행일 버전은 별도 ID와 날짜를 가진다", async () => {
  const bodies: Record<string, string> = {
    "20230101": BODY.replace("<시행일자>20240110</시행일자>", "<시행일자>20230101</시행일자>").replace("<조문시행일자>20240110</조문시행일자>", "<조문시행일자>20230101</조문시행일자>"),
    "20240110": BODY,
  };
  const fetcher = router({
    list: () =>
      xml(
        listXml([
          listRow(1, "000830", "100", "20230101", "연혁"),
          listRow(2, "000830", "166520", "20240110", "현행"),
        ]),
      ),
    body: (url) => xml(bodies[url.searchParams.get("efYd") ?? ""] ?? ""),
  });
  const result = await run(options, KEY, fetcher);
  const first = result.documents.find((d) => d.law.mst === "100" && d.law.articleNumber === "제2조");
  const second = result.documents.find((d) => d.law.mst === "166520" && d.law.articleNumber === "제2조");
  assert.ok(first && second);
  assert.notEqual(first.id, second.id);
  assert.equal(first.law.state, "historical");
  assert.equal(first.law.effectiveFrom, "2023-01-01");
  assert.equal(second.law.state, "current");
  assert.equal(second.law.effectiveFrom, "2024-01-10");
  assert.equal(new Set(result.documents.map((d) => d.id)).size, result.documents.length);
});

test("목록의 단일 law 항목(singleton)과 조문/부칙 단일 노드를 처리한다", async () => {
  const single = `<?xml version="1.0"?><법령><기본정보><법령ID>000830</법령ID><법령명_한글>단일법</법령명_한글><시행일자>20240110</시행일자></기본정보><조문><조문단위><조문번호>7</조문번호><조문여부>조문</조문여부><조문내용>제7조 단일 조문.</조문내용><항><항번호>①</항번호><항내용>① 하나뿐인 항</항내용></항></조문단위></조문></법령>`;
  const fetcher = router({
    list: () => xml(listXml([listRow(1, "000830", "5", "20240110", "시행예정")])),
    body: () => xml(single),
  });
  const result = await run(options, KEY, fetcher);
  assert.equal(result.documents.length, 1);
  assert.equal(result.documents[0]?.law.state, "scheduled");
  assert.equal(result.documents[0]?.law.promulgatedAt, "2023-01-10");
  assert.ok(result.documents[0]?.text.includes("하나뿐인 항"));
});

test("ZIP으로 감싼 XML 응답도 읽는다", async () => {
  const zipped = zipSync({ "law.xml": strToU8(BODY) });
  const fetcher = router({
    list: () => xml(listXml([listRow(1, "000830", "166520", "20240110")])),
    body: () => new Response(zipped, { status: 200 }),
  });
  const result = await run(options, KEY, fetcher);
  assert.equal(result.documents.length, 3);
});

test("ZIP의 압축 해제 크기가 한도를 넘으면 문서를 만들지 않는다", async () => {
  const zipped = zipSync({ "law.xml": new Uint8Array(10 * 1024 * 1024 + 1) });
  const fetcher = router({
    list: () => xml(listXml([listRow(1, "000830", "166520", "20240110")])),
    body: () => new Response(zipped, { status: 200 }),
  });
  const result = await run(options, KEY, fetcher);
  assert.equal(result.documents.length, 0);
  assert.equal(result.warnings.length, 1);
});

test("limit은 문서 수를 제한하고 efYd 범위를 전달한다", async () => {
  const calls: Call[] = [];
  const fetcher = router(
    { list: () => xml(listXml([listRow(1, "000830", "166520", "20240110")])), body: () => xml(BODY) },
    calls,
  );
  const result = await run({ ...options, limit: 1, since: "2024-01-01", until: "2024-12-31" }, KEY, fetcher);
  assert.equal(result.documents.length, 1);
  assert.equal(calls[0]?.url.searchParams.get("efYd"), "20240101~20241231");
});

test("법령명 검색 결과가 없으면 본문 검색으로 대체하고 경고한다", async () => {
  const searches: (string | null)[] = [];
  const fetcher = router({
    list: (url) => {
      searches.push(url.searchParams.get("search"));
      return xml(url.searchParams.get("search") === "2" ? listXml([listRow(1, "000830", "166520", "20240110")]) : listXml([], 0));
    },
    body: () => xml(BODY),
  });
  const result = await run(options, KEY, fetcher);
  assert.deepEqual(searches, ["1", "2"]);
  assert.equal(result.documents.length, 3);
  assert.equal(result.warnings.length, 1);
});

test("지원하지 않는 스키마는 경고하고 문서를 만들지 않는다", async () => {
  const badList = await run(options, KEY, router({ list: () => xml("<Unexpected><a>1</a></Unexpected>"), body: () => xml(BODY) }));
  assert.equal(badList.documents.length, 0);
  assert.ok(badList.warnings.some((w) => w.includes("Unexpected")));

  const badBody = await run(
    options,
    KEY,
    router({ list: () => xml(listXml([listRow(1, "000830", "166520", "20240110")])), body: () => xml("<Other><x>1</x></Other>") }),
  );
  assert.equal(badBody.documents.length, 0);
  assert.ok(badBody.warnings.some((w) => w.includes("166520")));
});

test("본문의 법령ID가 목록과 다르면 건너뛰고 경고한다", async () => {
  const mismatch = BODY.replace("<법령ID>000830</법령ID>", "<법령ID>999999</법령ID>");
  const result = await run(
    options,
    KEY,
    router({ list: () => xml(listXml([listRow(1, "000830", "166520", "20240110")])), body: () => xml(mismatch) }),
  );
  assert.equal(result.documents.length, 0);
  assert.equal(result.warnings.length, 1);
});

test("HTTP 오류·인증 실패·비XML·빈 키는 의미 있는 SourceError가 된다", async () => {
  await assert.rejects(
    run(options, KEY, router({ list: () => new Response("x", { status: 500 }), body: () => xml(BODY) })),
    (error: unknown) => error instanceof SourceError && error.source === "law" && error.message.includes("500"),
  );
  await assert.rejects(
    run(options, KEY, router({ list: () => xml("<result>사용자 정보 검증에 실패하였습니다.</result>"), body: () => xml(BODY) })),
    (error: unknown) => error instanceof SourceError && error.source === "law",
  );
  await assert.rejects(
    run(options, KEY, router({ list: () => xml("<html><body>login</body></html"), body: () => xml(BODY) })),
    (error: unknown) => error instanceof SourceError && error.source === "law",
  );
  await assert.rejects(run(options, "  ", router({ list: () => xml(""), body: () => xml("") })), SourceError);
});

test("본문 한 건의 HTTP 실패는 경고로 남고 나머지 법령은 수집된다", async () => {
  const fetcher = router({
    list: () => xml(listXml([listRow(1, "000830", "1", "20230101"), listRow(2, "000830", "2", "20240110")])),
    body: (url) => (url.searchParams.get("MST") === "1" ? new Response("x", { status: 503 }) : xml(BODY)),
  });
  const result = await run(options, KEY, fetcher);
  assert.equal(result.documents.length, 3);
  assert.ok(result.documents.every((d) => d.law.mst === "2"));
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0]?.includes("503"));
});
