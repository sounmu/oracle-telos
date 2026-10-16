import assert from "node:assert/strict";
import test from "node:test";
import { SourceError } from "../src/lib/korea/http";
import {
  collectKipris,
  getKiprisPatent,
  LIVE_DETAIL_LIMIT,
  normalizeKiprisDecision,
  searchKiprisLive,
} from "../src/lib/korea/kipris";
import {
  KEY,
  cpcXml,
  detailXml,
  fakeFetch,
  okXml,
  patentOf,
  searchXml,
  xml,
} from "./kipris-fixtures";

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
          : okXml("<body><item/></body>"),
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

test("live search skips known application numbers and caps new detail lookups per query", async () => {
  const number = (index: number) => `10202400${String(index).padStart(5, "0")}`;
  const numbers = (count: number) => Array.from({ length: count }, (_, index) => number(index));
  const log: URL[] = [];
  const fetcher = fakeFetch((operation, url) => {
    if (operation === "getAdvancedSearch") {
      const rows = Number(url.searchParams.get("numOfRows"));
      return searchXml(numbers(rows), rows);
    }
    if (operation === "patentCpcInfo") return cpcXml([]);
    return detailXml(url.searchParams.get("applicationNumber") ?? "");
  }, log);

  const result = await searchKiprisLive(
    { query: "드론 배터리 교체", limit: LIVE_DETAIL_LIMIT + 8, knownIds: new Set([number(0), number(1)]) },
    KEY,
    fetcher,
  );

  const details = log.filter((url) => url.pathname.endsWith("/getBibliographyDetailInfoSearch"));
  assert.equal(details.length, LIVE_DETAIL_LIMIT);
  assert.equal(log.filter((url) => url.pathname.endsWith("/patentCpcInfo")).length, LIVE_DETAIL_LIMIT);
  assert.deepEqual(
    result.documents.map((document) => patentOf(document).sourceId),
    numbers(LIVE_DETAIL_LIMIT + 2).slice(2),
  );
  assert.match(result.warnings.join("\n"), new RegExp(`${LIVE_DETAIL_LIMIT + 6}건 중 ${LIVE_DETAIL_LIMIT}건`));
  const search = log.find((url) => url.pathname.endsWith("/getAdvancedSearch"));
  assert.equal(search?.searchParams.get("word"), "드론 배터리 교체");

  const repeatLog: URL[] = [];
  const repeat = await searchKiprisLive(
    { query: "드론 배터리 교체", knownIds: new Set(numbers(20)) },
    KEY,
    fakeFetch((operation, url) => {
      assert.equal(operation, "getAdvancedSearch");
      assert.equal(url.searchParams.get("numOfRows"), "20");
      return searchXml(numbers(20), 20);
    }, repeatLog),
  );
  assert.equal(repeatLog.length, 1);
  assert.deepEqual(repeat, { documents: [], warnings: [] });
});

test("live search keeps details fetched before the time limit", async () => {
  const number = (index: number) => `10202400${String(index).padStart(5, "0")}`;
  const controller = new AbortController();
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof URL ? input : typeof input === "string" ? input : input.url);
    const operation = url.pathname.split("/").at(-1) ?? "";
    if (operation === "getAdvancedSearch") return searchXml(Array.from({ length: 8 }, (_, index) => number(index)), 8);
    const applicationNumber = url.searchParams.get("applicationNumber") ?? "";
    if (applicationNumber >= number(4)) {
      // 두 번째 배치에서 제한 시간이 끝난 상황을 만든다.
      controller.abort();
      return new Promise<Response>((_resolve, reject) => {
        if (init?.signal?.aborted) reject(init.signal.reason);
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    }
    return operation === "patentCpcInfo" ? cpcXml([]) : detailXml(applicationNumber);
  };

  const result = await searchKiprisLive(
    { query: "드론 배터리", knownIds: new Set(), signal: controller.signal },
    KEY,
    fetcher,
  );

  assert.deepEqual(
    result.documents.map((document) => patentOf(document).sourceId),
    [0, 1, 2, 3].map(number),
  );
  assert.match(result.warnings.join("\n"), /8건 중 4건/);
});
