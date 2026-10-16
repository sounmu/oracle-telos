// 서버/수집 스크립트 전용. KIPRIS Plus "특허·실용 공개·등록공보" REST API 커넥터.
// 공식 문서: https://plus.kipris.or.kr/portal/data/service/DBII_000000000000001/view.do
//   - getAdvancedSearch               (전체검색, ServiceKey)
//   - getBibliographyDetailInfoSearch (서지상세: 서지·초록·청구항·출원인, ServiceKey)
//   - patentCpcInfo                   (CPC정보, openapi/rest 경로, accessKey)
import type {
  CollectOptions,
  CollectionResult,
  Decision,
  KoreanPatentDocument,
} from "../types";
import {
  SourceError,
  fetchSource,
  isoDate,
  list,
  parseXml,
  record,
  text,
} from "./http";

const SOURCE = "KIPRIS";
const REST_BASE =
  "https://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/";
const OPENAPI_BASE =
  "https://plus.kipris.or.kr/openapi/rest/patUtiModInfoSearchSevice/";
const MAX_PAGE_SIZE = 500; // getAdvancedSearch numOfRows 최대값
const DETAIL_CONCURRENCY = 4;
const APPLICATION_NUMBER = /^\d{10,13}$/;

/** 공개 여부만으로 심사 진행 여부를 단정하지 않는다. */
export function normalizeKiprisDecision(rawStatus: string): Decision {
  switch (rawStatus.trim()) {
    case "등록":
      return "ACCEPTED";
    case "거절":
      return "REJECTED";
    case "심사중":
      return "PENDING";
    default:
      return "UNKNOWN";
  }
}

/** 출원번호는 문헌 식별자일 뿐 패밀리 식별자가 아니다. 하이픈 등을 제거한 숫자만 쓴다. */
function digits(value: unknown): string {
  return text(value).replace(/\D/g, "");
}

function clean(value: unknown): string {
  return text(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function compactDate(value: string, label: string): string {
  const compact = value.replace(/\D/g, "");
  if (compact.length !== 8) {
    throw new SourceError(SOURCE, `${label}는 YYYY-MM-DD 형식이어야 합니다.`);
  }
  return compact;
}

async function fetchXml(
  url: URL,
  signal: AbortSignal | undefined,
  fetcher: typeof fetch,
): Promise<Record<string, unknown>> {
  const response = await fetchSource(SOURCE, url, signal, fetcher);
  const parsed = parseXml(await response.text());
  const body = record(parsed.response);
  if (Object.keys(body).length === 0) {
    const gateway = record(
      record(parsed.OpenAPI_ServiceResponse).cmmMsgHeader,
    );
    const reason = clean(gateway.errMsg) || clean(gateway.returnAuthMsg);
    throw new SourceError(
      SOURCE,
      reason ? `게이트웨이 오류: ${reason}` : "response 요소가 없는 응답입니다.",
    );
  }
  const header = record(body.header);
  const code = clean(header.resultCode);
  if (text(header.successYN).trim() === "N" || (code !== "" && code !== "00")) {
    throw new SourceError(
      SOURCE,
      `API 오류 ${code || "?"} ${clean(header.resultMsg)}`.trim(),
    );
  }
  return body;
}

function restUrl(operation: string, params: Record<string, string>, key: string) {
  const url = new URL(operation, REST_BASE);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  url.searchParams.set("ServiceKey", key);
  return url;
}

async function searchApplicationNumbers(
  options: CollectOptions,
  key: string,
  fetcher: typeof fetch,
): Promise<string[]> {
  const found: string[] = [];
  const seen = new Set<string>();
  const dateRange =
    options.since || options.until
      ? `${options.since ? compactDate(options.since, "since") : "19000101"}~${
          options.until ? compactDate(options.until, "until") : "99991231"
        }`
      : "";
  const pageSize = Math.min(options.limit, MAX_PAGE_SIZE);
  for (let pageNo = 1; found.length < options.limit; pageNo += 1) {
    const params: Record<string, string> = {
      word: options.query,
      patent: "true",
      utility: "false",
      pageNo: String(pageNo),
      numOfRows: String(pageSize),
    };
    if (dateRange) params.applicationDate = dateRange;
    const body = record(
      await fetchXml(
        restUrl("getAdvancedSearch", params, key),
        options.signal,
        fetcher,
      ),
    );
    const payload = record(body.body);
    const items = list(record(payload.items).item);
    for (const item of items) {
      const applicationNumber = digits(record(item).applicationNumber);
      if (applicationNumber && !seen.has(applicationNumber)) {
        seen.add(applicationNumber);
        found.push(applicationNumber);
      }
    }
    const total = Number(text(record(payload.count).totalCount));
    const exhausted = Number.isFinite(total) && pageNo * pageSize >= total;
    if (items.length < pageSize || exhausted) break;
  }
  return found.slice(0, options.limit);
}

async function fetchCpc(
  applicationNumber: string,
  key: string,
  signal: AbortSignal | undefined,
  fetcher: typeof fetch,
): Promise<string[]> {
  const url = new URL("patentCpcInfo", OPENAPI_BASE);
  url.searchParams.set("applicationNumber", applicationNumber);
  url.searchParams.set("accessKey", key);
  const body = record((await fetchXml(url, signal, fetcher)).body);
  const codes = list(record(body.items).patentCpcInfo)
    .map((item) => clean(record(item).CooperativepatentclassificationNumber))
    .filter((code) => code !== "");
  return [...new Set(codes)];
}

function numberClaim(claim: string, index: number): string {
  return /^\d+\s*\./.test(claim) ? claim : `${index + 1}. ${claim}`;
}

async function fetchDetail(
  applicationNumber: string,
  key: string,
  signal: AbortSignal | undefined,
  fetcher: typeof fetch,
): Promise<KoreanPatentDocument> {
  const [detail, cpc] = await Promise.all([
    fetchXml(
      restUrl("getBibliographyDetailInfoSearch", { applicationNumber }, key),
      signal,
      fetcher,
    ),
    fetchCpc(applicationNumber, key, signal, fetcher),
  ]);
  const item = record(record(detail.body).item);
  const summary = record(
    list(record(item.biblioSummaryInfoArray).biblioSummaryInfo)[0],
  );
  const title = clean(summary.inventionTitle);
  if (!title) {
    throw new SourceError(
      SOURCE,
      `출원번호 ${applicationNumber}의 서지정보가 없습니다.`,
    );
  }
  const abstract = list(record(item.abstractInfoArray).abstractInfo)
    .map((entry) => clean(record(entry).astrtCont))
    .filter((value) => value !== "")
    .join("\n");
  const claims = list(record(item.claimInfoArray).claimInfo)
    .map((entry) => clean(record(entry).claim))
    .filter((value) => value !== "")
    .map(numberClaim);
  const applicants = list(record(item.applicantInfoArray).applicantInfo)
    .map((entry) => clean(record(entry).name))
    .filter((value) => value !== "");
  const rawStatus = clean(summary.registerStatus);
  const openDate = isoDate(text(summary.openDate));
  const publicationDate = isoDate(text(summary.publicationDate));
  const registerDate = isoDate(text(summary.registerDate));
  const number = digits(summary.applicationNumber) || applicationNumber;
  if (number !== applicationNumber) {
    throw new SourceError(SOURCE, "요청한 출원번호와 응답의 출원번호가 다릅니다.");
  }
  return {
    id: `kipris:${number}`,
    source: "kipris",
    sourceId: number,
    version: [rawStatus, openDate, publicationDate, registerDate].join("|"),
    title,
    text: [title, abstract, ...claims].filter((part) => part !== "").join("\n"),
    // 한국특허정보원(KIPRIS) DOI: https://doi.org/10.8080/<출원번호>
    url: `https://doi.org/10.8080/${number}`,
    publishedAt: openDate || publicationDate || registerDate || null,
    fetchedAt: new Date().toISOString(),
    patent: {
      applicationNumber: number,
      publicationNumber: digits(summary.openNumber),
      filingDate: isoDate(text(summary.applicationDate)),
      cpc,
      applicants,
      decision: normalizeKiprisDecision(rawStatus),
      rawStatus,
      abstract,
      claims,
    },
  };
}

export async function getKiprisPatent(
  applicationNumber: string,
  key: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<KoreanPatentDocument> {
  const number = applicationNumber.replace(/\D/g, "");
  if (!APPLICATION_NUMBER.test(number)) {
    throw new SourceError(SOURCE, "출원번호 형식이 올바르지 않습니다.");
  }
  return fetchDetail(number, key, signal, fetcher);
}

export async function collectKipris(
  options: CollectOptions,
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<CollectionResult> {
  if (!options.query.trim() || options.limit < 1) {
    return { documents: [], warnings: [] };
  }
  const numbers = await searchApplicationNumbers(options, key, fetcher);
  const documents: KoreanPatentDocument[] = [];
  const warnings: string[] = [];
  for (let start = 0; start < numbers.length; start += DETAIL_CONCURRENCY) {
    const batch = numbers.slice(start, start + DETAIL_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((number) =>
        fetchDetail(number, key, options.signal, fetcher),
      ),
    );
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        documents.push(result.value);
        return;
      }
      if (options.signal?.aborted) throw result.reason;
      const reason: unknown = result.reason;
      warnings.push(
        `${batch[index]}: ${reason instanceof Error ? reason.message : String(reason)}`,
      );
    });
  }
  return { documents, warnings };
}
