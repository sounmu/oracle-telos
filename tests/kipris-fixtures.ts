// 모든 XML 픽스처는 KIPRIS Plus 공식 문서(getAdvancedSearch / getBibliographyDetailInfoSearch /
// patentCpcInfo)의 응답 구조를 따라 만든 합성(synthetic) 데이터다. 실제 API는 호출하지 않는다.
import assert from "node:assert/strict";
import type { KoreanPatentDocument, ResearchDocument } from "../src/lib/types";

export const KEY = "synthetic-test-key";

const OK_HEADER =
  "<header><successYN>Y</successYN><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>";

export function xml(body: string, status = 200): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    status,
    headers: { "content-type": "application/xml" },
  });
}

export function okXml(body: string): Response {
  return xml(`<response>${OK_HEADER}${body}</response>`);
}

export function searchXml(numbers: string[], totalCount: number): Response {
  const items = numbers
    .map(
      (number, index) =>
        `<item><applicationNumber>${number}</applicationNumber><indexNo>${index + 1}</indexNo><registerStatus>공개</registerStatus></item>`,
    )
    .join("");
  return okXml(
    `<body><items>${items}</items><count><numOfRows>${numbers.length}</numOfRows><pageNo>1</pageNo><totalCount>${totalCount}</totalCount></count></body>`,
  );
}

export interface DetailFixture {
  status?: string;
  applicationNumber?: string;
  claims?: string[];
  applicants?: string[];
  title?: string;
}

function dotted(number: string): string {
  return `${number.slice(0, 2)}-${number.slice(2, 6)}-${number.slice(6)}`;
}

export function detailXml(number: string, fixture: DetailFixture = {}): Response {
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
  return okXml(
    `<body><item>` +
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
      `</item></body>`,
  );
}

export function cpcXml(codes: string[]): Response {
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

type Handler = (operation: string, url: URL) => Response | Promise<Response>;

export function fakeFetch(handler: Handler, log: URL[] = []): typeof fetch {
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

export function patentOf(document: ResearchDocument | undefined): KoreanPatentDocument {
  assert.ok(document, "document missing");
  assert.equal(document.source, "kipris");
  if (document.source !== "kipris") throw new Error("unreachable");
  return document;
}
