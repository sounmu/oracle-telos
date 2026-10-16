import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { collectDisclosures } from "../src/lib/korea/dart";
import { SourceError } from "../src/lib/korea/http";
import type { DisclosureDocument } from "../src/lib/types";

// 모든 픽스처는 OpenDART 문서 형식을 따른 합성(synthetic) 데이터다.
const KEY = "synthetic-test-key";
const CORP = "00126380";
const RCEPT_A = "20250311000123";
const RCEPT_B = "20250228000456";
const BASE_OPTIONS = { query: "ai", limit: 50, since: "2025-01-01", until: "2025-03-31" };

const FAKE_IMAGE = "A".repeat(400);

const MAIN_XML = `<?xml version="1.0" encoding="utf-8"?>
<DOCUMENT>
  <DOCUMENT-NAME ACODE="11011">사업보고서</DOCUMENT-NAME>
  <BODY>
    <SECTION-1 ACODE="D00100">
      <TITLE ATOC="Y">I. 회사의 개요</TITLE>
      <P>첫 번째 문단 &amp; 인공지능 특허 전략.</P>
      <IMG SRC="logo.png">${FAKE_IMAGE}</IMG>
      <TABLE>
        <TR><TD>매출액</TD><TD>1,234,567</TD><TD>(23.5)</TD></TR>
        <TR><TD>영업이익</TD><TD>987,654</TD><TD>12</TD></TR>
      </TABLE>
      <TABLE>
        <TR><TH>사업부문</TH><TH>주요 제품</TH></TR>
        <TR><TD>소프트웨어</TD><TD>반려동물 식단 추천 서비스</TD></TR>
      </TABLE>
      <SECTION-2>
        <TITLE>1. 연혁</TITLE>
        <P>두 번째 문단 <SPAN>인라인 이어짐</SPAN>.</P>
      </SECTION-2>
    </SECTION-1>
    <SECTION-1 ACODE="D00200">
      <TITLE>II. 사업의 내용</TITLE>
      <P>세 번째 문단.</P>
    </SECTION-1>
  </BODY>
</DOCUMENT>`;

const ATTACHMENT_XML = `<?xml version="1.0" encoding="utf-8"?>
<DOCUMENT><BODY><SECTION-1><TITLE>감사보고서</TITLE><P>첨부 감사의견은 제외 대상.</P></SECTION-1></BODY></DOCUMENT>`;

function zipFor(receiptNo: string, mainXml = MAIN_XML): Uint8Array {
  return zipSync({
    [`${receiptNo}.xml`]: strToU8(mainXml),
    [`${receiptNo}_00760.xml`]: strToU8(ATTACHMENT_XML),
  });
}

function listBody(items: unknown, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    status: "000",
    message: "정상",
    page_no: 1,
    page_count: 100,
    total_count: 1,
    total_page: 1,
    list: items,
    ...extra,
  });
}

function item(rceptNo: string, reportName: string, date: string, corpCode = CORP) {
  return {
    corp_code: corpCode,
    corp_name: "합성테크",
    stock_code: "000000",
    corp_cls: "K",
    report_nm: reportName,
    rcept_no: rceptNo,
    flr_nm: "합성테크",
    rcept_dt: date,
    rm: "",
  };
}

function errorXml(status: string, message: string): Uint8Array {
  return strToU8(`<?xml version="1.0" encoding="UTF-8"?><result><status>${status}</status><message>${message}</message></result>`);
}

type Route = (url: URL) => Response;

function makeFetcher(route: Route): { fetcher: typeof fetch; requests: URL[] } {
  const requests: URL[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = input instanceof URL ? input : new URL(String(input));
    requests.push(url);
    return route(url);
  };
  return { fetcher, requests };
}

function bytesResponse(bytes: Uint8Array): Response {
  return new Response(new Blob([bytes as BlobPart]));
}

function dartOf(documents: readonly unknown[]): DisclosureDocument[] {
  return documents.map((doc) => {
    assert.ok(typeof doc === "object" && doc !== null && "disclosure" in doc);
    return doc as DisclosureDocument;
  });
}

test("singleton list item and ZIP are normalized into ordered section documents", async () => {
  const { fetcher, requests } = makeFetcher((url) => {
    if (url.pathname.endsWith("/list.json")) {
      return new Response(listBody(item(RCEPT_A, "사업보고서 (2024.12)", "20250311")));
    }
    return bytesResponse(zipFor(RCEPT_A));
  });

  const result = await collectDisclosures({ ...BASE_OPTIONS, corpCodes: [CORP] }, KEY, fetcher);
  const docs = dartOf(result.documents);

  assert.equal(docs.length, 3);
  assert.deepEqual(
    docs.map((doc) => doc.disclosure.section),
    ["서문", "I. 회사의 개요", "II. 사업의 내용"],
  );
  const first = docs[1];
  assert.equal(first.source, "dart");
  assert.equal(first.sourceId, RCEPT_A);
  assert.equal(first.publishedAt, "2025-03-11");
  assert.equal(first.disclosure.reportDate, "2025-03-11");
  assert.equal(first.disclosure.corpCode, CORP);
  assert.equal(first.disclosure.receiptNo, RCEPT_A);
  assert.equal(first.disclosure.correction, false);
  assert.equal(new URL(first.url).searchParams.get("rcpNo"), RCEPT_A);
  assert.equal(new Set(docs.map((doc) => doc.id)).size, docs.length);

  const order = ["I. 회사의 개요", "첫 번째 문단 & 인공지능", "사업부문 | 주요 제품", "1. 연혁", "두 번째 문단 인라인 이어짐 ."];
  let cursor = -1;
  for (const needle of order) {
    const at = first.text.indexOf(needle, cursor + 1);
    assert.ok(at > cursor, `missing or out of order: ${needle}`);
    cursor = at;
  }
  assert.ok(!first.text.includes("1,234,567"));
  assert.ok(!first.text.includes(FAKE_IMAGE.slice(0, 50)));
  assert.ok(!docs.some((doc) => doc.text.includes("첨부 감사의견")));
  assert.ok(result.warnings.length >= 1);

  const listRequest = requests.find((url) => url.pathname.endsWith("/list.json"));
  assert.ok(listRequest);
  assert.equal(listRequest.searchParams.get("corp_code"), CORP);
  assert.equal(listRequest.searchParams.get("bgn_de"), "20250101");
  assert.equal(listRequest.searchParams.get("end_de"), "20250331");
  assert.equal(listRequest.searchParams.get("last_reprt_at"), "N");
  assert.equal(listRequest.searchParams.get("pblntf_ty"), "A");
  assert.ok(!JSON.stringify(result).includes(KEY));
});

test("array list across pages keeps corrected filings and flags them", async () => {
  const pages = new Map<string, string>([
    [
      "1",
      listBody(
        [item(RCEPT_A, "[기재정정]사업보고서 (2024.12)", "20250320"), item(RCEPT_B, "사업보고서 (2024.12)", "20250228")],
        { page_no: 1, total_count: 3, total_page: 2 },
      ),
    ],
    ["2", listBody([item("20250110000789", "분기보고서 (2024.09)", "20250110")], { page_no: 2, total_count: 3, total_page: 2 })],
  ]);
  const { fetcher, requests } = makeFetcher((url) => {
    if (url.pathname.endsWith("/list.json")) return new Response(pages.get(url.searchParams.get("page_no") ?? "") ?? listBody([]));
    const rcept = url.searchParams.get("rcept_no") ?? "";
    return bytesResponse(zipFor(rcept));
  });

  const result = await collectDisclosures({ ...BASE_OPTIONS, corpCodes: [CORP], limit: 100 }, KEY, fetcher);
  const docs = dartOf(result.documents);
  const byReceipt = new Map(docs.map((doc) => [doc.disclosure.receiptNo, doc.disclosure]));

  assert.deepEqual([...byReceipt.keys()], [RCEPT_A, RCEPT_B, "20250110000789"]);
  assert.equal(byReceipt.get(RCEPT_A)?.correction, true);
  assert.equal(byReceipt.get(RCEPT_B)?.correction, false);
  assert.equal(requests.filter((url) => url.pathname.endsWith("/list.json")).length, 2);
});

test("without corp codes the window defaults to at most three months and coverage is flagged", async () => {
  const { fetcher, requests } = makeFetcher((url) => {
    if (url.pathname.endsWith("/list.json")) return new Response(listBody([item(RCEPT_A, "사업보고서", "20250311")]));
    return bytesResponse(zipFor(RCEPT_A));
  });

  const defaults = await collectDisclosures({ query: "ai", limit: 5 }, KEY, fetcher);
  const first = requests.find((url) => url.pathname.endsWith("/list.json"));
  assert.ok(first);
  assert.equal(first.searchParams.get("corp_code"), null);
  const span = (Date.parse(`${isoOf(first.searchParams.get("end_de"))}`) - Date.parse(`${isoOf(first.searchParams.get("bgn_de"))}`)) / 86_400_000;
  assert.ok(span > 0 && span <= 92);
  assert.ok(defaults.warnings.length >= 1);

  requests.length = 0;
  await collectDisclosures({ query: "ai", limit: 5, since: "2020-01-01", until: "2025-03-31" }, KEY, fetcher);
  const clamped = requests.find((url) => url.pathname.endsWith("/list.json"));
  assert.ok(clamped);
  assert.equal(clamped.searchParams.get("end_de"), "20250331");
  const clampedSpan = (Date.parse(isoOf("20250331")) - Date.parse(isoOf(clamped.searchParams.get("bgn_de")))) / 86_400_000;
  assert.ok(clampedSpan <= 92);

  requests.length = 0;
  await collectDisclosures({ ...BASE_OPTIONS, since: "2020-01-01", corpCodes: [CORP] }, KEY, fetcher);
  assert.equal(requests[0].searchParams.get("bgn_de"), "20200101");
});

function isoOf(compact: string | null): string {
  const digits = compact ?? "";
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

test("list.json status and HTTP failures surface as SourceError with status", async () => {
  const badKey = makeFetcher(() => new Response(JSON.stringify({ status: "010", message: "등록되지 않은 키입니다." })));
  await assert.rejects(
    collectDisclosures({ ...BASE_OPTIONS, corpCodes: [CORP] }, KEY, badKey.fetcher),
    (error: unknown) => error instanceof SourceError && error.message.includes("010") && !error.message.includes(KEY),
  );

  const http = makeFetcher(() => new Response("oops", { status: 500 }));
  await assert.rejects(
    collectDisclosures({ ...BASE_OPTIONS, corpCodes: [CORP] }, KEY, http.fetcher),
    (error: unknown) => error instanceof SourceError && error.message.includes("500"),
  );

  const notJson = makeFetcher(() => new Response("<html></html>"));
  await assert.rejects(collectDisclosures({ ...BASE_OPTIONS, corpCodes: [CORP] }, KEY, notJson.fetcher), SourceError);

  const empty = makeFetcher(() => new Response(JSON.stringify({ status: "013", message: "조회된 데이터가 없습니다." })));
  const none = await collectDisclosures({ ...BASE_OPTIONS, corpCodes: [CORP] }, KEY, empty.fetcher);
  assert.deepEqual(none.documents, []);

  await assert.rejects(collectDisclosures({ ...BASE_OPTIONS, corpCodes: ["123"] }, KEY, empty.fetcher), SourceError);
});

test("document.xml error XML: per-filing no-data warns, rate limit aborts", async () => {
  const listing = listBody([item(RCEPT_A, "사업보고서", "20250311"), item(RCEPT_B, "사업보고서", "20250228")]);
  const partial = makeFetcher((url) => {
    if (url.pathname.endsWith("/list.json")) return new Response(listing);
    return url.searchParams.get("rcept_no") === RCEPT_A
      ? bytesResponse(errorXml("013", "조회된 데이터가 없습니다."))
      : bytesResponse(zipFor(RCEPT_B));
  });
  const result = await collectDisclosures({ ...BASE_OPTIONS, corpCodes: [CORP] }, KEY, partial.fetcher);
  assert.deepEqual(new Set(dartOf(result.documents).map((doc) => doc.disclosure.receiptNo)), new Set([RCEPT_B]));
  assert.ok(result.warnings.some((warning) => warning.includes(RCEPT_A)));

  const limited = makeFetcher((url) =>
    url.pathname.endsWith("/list.json") ? new Response(listing) : bytesResponse(errorXml("020", "요청 제한을 초과하였습니다.")),
  );
  await assert.rejects(
    collectDisclosures({ ...BASE_OPTIONS, corpCodes: [CORP] }, KEY, limited.fetcher),
    (error: unknown) => error instanceof SourceError && error.message.includes("020"),
  );
});

test("ZIP bounds: oversized entries and missing main XML are skipped with warnings", async () => {
  const huge = zipSync({ [`${RCEPT_A}.xml`]: new Uint8Array(21 * 1024 * 1024) });
  const attachmentsOnly = zipSync({ [`${RCEPT_B}_00760.xml`]: strToU8(ATTACHMENT_XML) });
  const { fetcher } = makeFetcher((url) => {
    if (url.pathname.endsWith("/list.json")) {
      return new Response(listBody([item(RCEPT_A, "사업보고서", "20250311"), item(RCEPT_B, "사업보고서", "20250228")]));
    }
    return bytesResponse(url.searchParams.get("rcept_no") === RCEPT_A ? huge : attachmentsOnly);
  });

  const result = await collectDisclosures({ ...BASE_OPTIONS, corpCodes: [CORP] }, KEY, fetcher);
  assert.deepEqual(result.documents, []);
  assert.ok(result.warnings.some((warning) => warning.includes(RCEPT_A)));
  assert.ok(result.warnings.some((warning) => warning.includes(RCEPT_B)));
});

test("limit bounds the number of returned documents", async () => {
  const { fetcher } = makeFetcher((url) =>
    url.pathname.endsWith("/list.json")
      ? new Response(listBody([item(RCEPT_A, "사업보고서", "20250311")]))
      : bytesResponse(zipFor(RCEPT_A)),
  );
  const result = await collectDisclosures({ ...BASE_OPTIONS, corpCodes: [CORP], limit: 1 }, KEY, fetcher);
  assert.equal(result.documents.length, 1);
});
