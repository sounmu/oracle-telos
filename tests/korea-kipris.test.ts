// 모든 XML 픽스처는 KIPRIS Plus 공식 문서(getAdvancedSearch / getBibliographyDetailInfoSearch /
// patentCpcInfo)의 응답 구조를 따라 만든 합성(synthetic) 데이터다. 실제 API는 호출하지 않는다.
import assert from "node:assert/strict";
import test from "node:test";
import type { KoreanPatentDocument, ResearchDocument } from "../src/lib/types";
import { SourceError } from "../src/lib/korea/http";
import {
  collectKipris,
  getKiprisPatent,
  normalizeKiprisDecision,
} from "../src/lib/korea/kipris";

const KEY = "synthetic-test-key";

const OK_HEADER =
  "<header><successYN>Y</successYN><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>";

function xml(body: string, status = 200): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    status,
    headers: { "content-type": "application/xml" },
  });
}

function searchXml(numbers: string[], totalCount: number): Response {
  const items = numbers
    .map(
      (number, index) =>
        `<item><applicationNumber>${number}</applicationNumber><indexNo>${index + 1}</indexNo><registerStatus>공개</registerStatus></item>`,
    )
    .join("");
  return xml(
    `<response>${OK_HEADER}<body><items>${items}</items><count><numOfRows>${numbers.length}</numOfRows><pageNo>1</pageNo><totalCount>${totalCount}</totalCount></count></body></response>`,
  );
}

interface DetailFixture {
  status?: string;
  applicationNumber?: string;
  claims?: string[];
  applicants?: string[];
  title?: string;
}

function dotted(number: string): string {
  return `${number.slice(0, 2)}-${number.slice(2, 6)}-${number.slice(6)}`;
}

function detailXml(number: string, fixture: DetailFixture = {}): Response {
  const claims = fixture.claims ?? [
    "1. 센서를 구비한 장치.",
    "2. 제1 항에 있어서 &lt;P INDENT=14&gt;상기 센서&lt;/P&gt;는 온도 센서인 장치 &amp; 방법.",
    "3. 삭제",
  ];
  const applicants = fixture.applicants ?? ["합성 주식회사"];
  const claimXml = claims
    .map((claim) => `<claimInfo><claim>${claim}</claim></claimInfo>`)
    .join("");
  const applicantXml = applicants
    .map((name) => `<applicantInfo><name>${name}</name></applicantInfo>`)
    .join("");
  return xml(
    `<response>${OK_HEADER}<body><item>` +
      `<biblioSummaryInfoArray><biblioSummaryInfo>` +
      `<applicationDate>2020.03.05</applicationDate>` +
      `<applicationNumber>${fixture.applicationNumber ?? dotted(number)}</applicationNumber>` +
      `<inventionTitle>${fixture.title ?? "합성 센서 장치(Synthetic Sensor Device)"}</inventionTitle>` +
      `<openDate>2021.09.10</openDate><openNumber>10-2021-0116000</openNumber>` +
      `<publicationDate> </publicationDate><registerDate> </registerDate>` +
      `<registerStatus>${fixture.status ?? "공개"}</registerStatus>` +
      `</biblioSummaryInfo></biblioSummaryInfoArray>` +
      `<ipcInfoArray><ipcInfo><ipcNumber>H04Q 9/00</ipcNumber></ipcInfo></ipcInfoArray>` +
      `<abstractInfoArray><abstractInfo><astrtCont> 본 발명은 합성 센서 장치에 관한 것이다. </astrtCont></abstractInfo></abstractInfoArray>` +
      `<claimInfoArray>${claimXml}</claimInfoArray>` +
      `<applicantInfoArray>${applicantXml}</applicantInfoArray>` +
      `</item></body></response>`,
  );
}

function cpcXml(codes: string[]): Response {
  const items = codes
    .map(
      (code) =>
        `<patentCpcInfo><CooperativepatentclassificationNumber>${code}</CooperativepatentclassificationNumber><CooperativepatentclassificationDate>(2013.01)</CooperativepatentclassificationDate></patentCpcInfo>`,
    )
    .join("");
  return xml(
    `<response><header><resultCode/><resultMsg/></header><body><items>${items}</items></body></response>`,
  );
}

type Handler = (operation: string, url: URL) => Response;

function fakeFetch(handler: Handler, log: URL[] = []): typeof fetch {
  return async (input) => {
    const url =
      input instanceof URL
        ? input
        : new URL(typeof input === "string" ? input : input.url);
    log.push(url);
    const operation = url.pathname.split("/").at(-1) ?? "";
    return handler(operation, url);
  };
}

function patentOf(document: ResearchDocument | undefined): KoreanPatentDocument {
  assert.ok(document, "document missing");
  assert.equal(document.source, "kipris");
  if (document.source !== "kipris") throw new Error("unreachable");
  return document;
}

test("collects a singleton search hit with full bibliography, claims, CPC and official link", async () => {
  const log: URL[] = [];
  const fetcher = fakeFetch((operation, url) => {
    if (operation === "getAdvancedSearch") return searchXml(["1020200021234"], 1);
    if (operation === "patentCpcInfo") return cpcXml(["H04Q 9/00"]);
    assert.equal(url.searchParams.get("applicationNumber"), "1020200021234");
    return detailXml("1020200021234", { status: "등록" });
  }, log);

  const result = await collectKipris(
    { query: "센서 장치", limit: 10, since: "2020-01-01", until: "2020-12-31" },
    KEY,
    fetcher,
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(result.documents.length, 1);
  const doc = patentOf(result.documents[0]);
  assert.equal(doc.id, "kipris:1020200021234");
  assert.equal(doc.sourceId, "1020200021234");
  assert.equal(doc.url, "https://doi.org/10.8080/1020200021234");
  assert.equal(doc.publishedAt, "2021-09-10");
  assert.equal(doc.patent.applicationNumber, "1020200021234");
  assert.equal(doc.patent.publicationNumber, "1020210116000");
  assert.equal(doc.patent.filingDate, "2020-03-05");
  assert.equal(doc.patent.decision, "ACCEPTED");
  assert.equal(doc.patent.rawStatus, "등록");
  assert.deepEqual(doc.patent.cpc, ["H04Q 9/00"]);
  assert.deepEqual(doc.patent.applicants, ["합성 주식회사"]);
  assert.deepEqual(doc.patent.claims, [
    "1. 센서를 구비한 장치.",
    "2. 제1 항에 있어서 상기 센서 는 온도 센서인 장치 & 방법.",
    "3. 삭제",
  ]);
  assert.match(doc.text, /합성 센서 장치/);

  const search = log.find((url) => url.pathname.endsWith("/getAdvancedSearch"));
  assert.ok(search);
  assert.equal(search.searchParams.get("ServiceKey"), KEY);
  assert.equal(search.searchParams.get("word"), "센서 장치");
  assert.equal(search.searchParams.get("applicationDate"), "20200101~20201231");
  assert.equal(search.searchParams.get("patent"), "true");
  assert.equal(search.searchParams.get("numOfRows"), "10");
  assert.equal(search.searchParams.get("sortSpec"), "AD");
  assert.equal(search.searchParams.get("descSort"), "true");
  const cpc = log.find((url) => url.pathname.endsWith("/patentCpcInfo"));
  assert.ok(cpc);
  assert.equal(cpc.searchParams.get("accessKey"), KEY);
});

test("handles array search hits, singleton claim and unnumbered claims", async () => {
  const fetcher = fakeFetch((operation, url) => {
    if (operation === "getAdvancedSearch") {
      return searchXml(["1020200000001", "1020200000002"], 2);
    }
    if (operation === "patentCpcInfo") return cpcXml(["G06N 3/08", "G06N 3/08", "G06F 16/00"]);
    const number = url.searchParams.get("applicationNumber") ?? "";
    return detailXml(number, {
      claims: ["번호 없는 단일 청구항"],
      applicants: ["갑 주식회사", "을 연구소"],
    });
  });

  const result = await collectKipris({ query: "q", limit: 5 }, KEY, fetcher);
  assert.equal(result.documents.length, 2);
  const [first, second] = result.documents.map(patentOf);
  assert.equal(first.sourceId, "1020200000001");
  assert.equal(second.sourceId, "1020200000002");
  assert.deepEqual(first.patent.claims, ["1. 번호 없는 단일 청구항"]);
  assert.deepEqual(first.patent.applicants, ["갑 주식회사", "을 연구소"]);
  assert.deepEqual(first.patent.cpc, ["G06N 3/08", "G06F 16/00"]);
});

test("normalizes only established statuses and preserves the raw status", async () => {
  const cases: [string, string][] = [
    ["등록", "ACCEPTED"],
    ["거절", "REJECTED"],
    ["공개", "UNKNOWN"],
    ["심사중", "PENDING"],
    ["소멸", "UNKNOWN"],
    ["취하", "UNKNOWN"],
    ["무효", "UNKNOWN"],
    ["포기", "UNKNOWN"],
    ["심사중(합성)", "UNKNOWN"],
    ["", "UNKNOWN"],
  ];
  for (const [raw, expected] of cases) {
    assert.equal(normalizeKiprisDecision(raw), expected);
    const fetcher = fakeFetch((operation) =>
      operation === "patentCpcInfo"
        ? cpcXml([])
        : detailXml("1020200021234", { status: raw }),
    );
    const doc = await getKiprisPatent("10-2020-0021234", KEY, undefined, fetcher);
    assert.equal(doc.patent.rawStatus, raw);
    assert.equal(doc.patent.decision, expected);
    assert.equal(doc.patent.applicationNumber, "1020200021234");
    assert.deepEqual(doc.patent.cpc, []);
  }
});

test("surfaces API, HTTP, gateway and XML failures as SourceError", async () => {
  const isSourceError = (error: unknown) => error instanceof SourceError;
  const failing = (response: () => Response) => fakeFetch(() => response());

  await assert.rejects(
    collectKipris(
      { query: "q", limit: 1 },
      KEY,
      failing(() =>
        xml(
          "<response><header><successYN>N</successYN><resultCode>10</resultCode><resultMsg>INVALID_REQUEST_PARAMETER_ERROR</resultMsg></header></response>",
        ),
      ),
    ),
    (error: unknown) => isSourceError(error) && /10/.test(String(error)),
  );
  await assert.rejects(
    collectKipris({ query: "q", limit: 1 }, KEY, failing(() => xml("", 503))),
    (error: unknown) => isSourceError(error) && /503/.test(String(error)),
  );
  await assert.rejects(
    collectKipris(
      { query: "q", limit: 1 },
      KEY,
      failing(() =>
        xml(
          "<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>",
        ),
      ),
    ),
    isSourceError,
  );
  await assert.rejects(
    collectKipris({ query: "q", limit: 1 }, KEY, failing(() => xml("<response><header>"))),
    isSourceError,
  );
  await assert.rejects(
    getKiprisPatent("not-a-number", KEY, undefined, failing(() => cpcXml([]))),
    isSourceError,
  );
  await assert.rejects(
    collectKipris({ query: "q", limit: 1, since: "2020/1" }, KEY, failing(() => cpcXml([]))),
    isSourceError,
  );
  await assert.rejects(
    getKiprisPatent(
      "1020200021234",
      KEY,
      undefined,
      fakeFetch((operation) =>
        operation === "patentCpcInfo"
          ? cpcXml([])
          : xml(`<response>${OK_HEADER}<body><item/></body></response>`),
      ),
    ),
    isSourceError,
  );
});

test("keeps good documents and warns when one detail request fails", async () => {
  const fetcher = fakeFetch((operation, url) => {
    if (operation === "getAdvancedSearch") {
      return searchXml(["1020200000001", "1020200000002"], 2);
    }
    const number = url.searchParams.get("applicationNumber") ?? "";
    if (number === "1020200000002") return xml("", 500);
    if (operation === "patentCpcInfo") return cpcXml(["H04Q 9/00"]);
    return detailXml(number);
  });

  const result = await collectKipris({ query: "q", limit: 5 }, KEY, fetcher);
  assert.equal(result.documents.length, 1);
  assert.equal(patentOf(result.documents[0]).sourceId, "1020200000001");
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0] ?? "", /1020200000002/);
});

test("stops on a short page and paginates when the limit exceeds one page", async () => {
  const shortLog: URL[] = [];
  await collectKipris(
    { query: "q", limit: 5 },
    KEY,
    fakeFetch((operation, url) => {
      if (operation === "getAdvancedSearch") return searchXml(["1020200000001"], 1);
      if (operation === "patentCpcInfo") return cpcXml([]);
      return detailXml(url.searchParams.get("applicationNumber") ?? "");
    }, shortLog),
  );
  assert.equal(
    shortLog.filter((url) => url.pathname.endsWith("/getAdvancedSearch")).length,
    1,
  );

  const number = (index: number) => `10202000${String(index).padStart(5, "0")}`;
  const pages: string[] = [];
  const result = await collectKipris(
    { query: "q", limit: 501 },
    KEY,
    fakeFetch((operation, url) => {
      if (operation === "getAdvancedSearch") {
        const pageNo = Number(url.searchParams.get("pageNo"));
        pages.push(`${pageNo}:${url.searchParams.get("numOfRows")}`);
        const numbers =
          pageNo === 1
            ? Array.from({ length: 500 }, (_, index) => number(index))
            : [number(500)];
        return searchXml(numbers, 501);
      }
      if (operation === "patentCpcInfo") return cpcXml([]);
      return detailXml(url.searchParams.get("applicationNumber") ?? "");
    }),
  );
  assert.deepEqual(pages, ["1:500", "2:500"]);
  assert.equal(result.documents.length, 501);
  assert.equal(new Set(result.documents.map((doc) => doc.id)).size, 501);
});
