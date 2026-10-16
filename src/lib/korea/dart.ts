// 서버/수집 스크립트 전용. OpenDART 정기공시(list.json + document.xml 원문 ZIP) 수집기.
// 공식 문서: https://opendart.fss.or.kr/guide/main.do?apiGrpCd=DS001
//  - 공시검색 list.json:   https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001
//  - 공시서류원본 document.xml: https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019003
// 임의 본문 검색이 아니라, 기간/기업코드로 한정한 정기보고서(pblntf_ty=A)의 경계 있는 수집이다.
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { unzipSync } from "fflate";
import type {
  CollectionResult,
  CollectOptions,
  DisclosureDocument,
} from "../types";
import { fetchSource, isoDate, list, parseXml, record, SourceError, text } from "./http";

const API_BASE = "https://opendart.fss.or.kr/api";
const VIEWER_URL = "https://dart.fss.or.kr/dsaf001/main.do";
const LIST_SOURCE = "DART list.json";
const DOCUMENT_SOURCE = "DART document.xml";

const PAGE_COUNT = 100;
const MAX_LIST_PAGES = 5;
const MAX_FILINGS = 25;
const DEFAULT_WINDOW_DAYS = 90;
const MAX_WINDOW_DAYS = 92; // corp_code 없이 조회할 때 OpenDART가 허용하는 3개월
const DAY_MS = 86_400_000;

const MAX_ZIP_BYTES = 30 * 1024 * 1024;
const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;
const MAX_ENTRIES = 200;
const MAX_SECTION_CHARS = 20_000;
const MAX_TABLE_ROWS = 40;
const NUMERIC_TABLE_RATIO = 0.4;

const PREAMBLE_TITLE = "서문";
const BODY_TITLE = "본문";

/** 키/한도/권한 문제는 이후 요청도 모두 실패하므로 수집 전체를 중단한다. */
const FATAL_STATUSES = new Set(["010", "011", "012", "020", "021", "800", "900", "901"]);

class DartStatusError extends SourceError {
  constructor(
    source: string,
    readonly status: string,
    message: string,
  ) {
    super(source, `status ${status}${message ? `: ${message}` : ""}`);
    this.name = "DartStatusError";
  }
}

interface Filing {
  readonly corpCode: string;
  readonly corpName: string;
  readonly receiptNo: string;
  readonly reportName: string;
  readonly receiptDate: string;
  readonly correction: boolean;
}

interface Section {
  title: string;
  readonly lines: string[];
}

export async function collectDisclosures(
  options: CollectOptions,
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<CollectionResult> {
  const warnings: string[] = [];
  const limit = Math.floor(options.limit);
  if (!(limit > 0)) return { documents: [], warnings };

  const corpCodes = [...new Set(options.corpCodes ?? [])];
  for (const code of corpCodes) {
    if (!/^\d{8}$/.test(code)) throw new SourceError("DART", "corp_code는 8자리 숫자여야 합니다.");
  }

  const window = resolveWindow(options, corpCodes.length > 0, warnings);
  if (corpCodes.length === 0) {
    warnings.push(
      "기업코드 없이 기간 내 정기보고서 목록을 제한적으로 수집했습니다. 임의 본문 검색이나 전체 스타트업 커버리지가 아닙니다.",
    );
  }

  const maxFilings = Math.min(limit, MAX_FILINGS);
  const filings = new Map<string, Filing>();
  for (const corpCode of corpCodes.length > 0 ? corpCodes : [undefined]) {
    for (const filing of await listFilings(key, window, corpCode, maxFilings, options.signal, fetcher)) {
      filings.set(filing.receiptNo, filing);
    }
  }

  // 접수일 내림차순. 정정 이력도 숨기지 않고(last_reprt_at=N) 플래그만 남긴다.
  const ordered = [...filings.values()].sort((a, b) =>
    a.receiptDate === b.receiptDate
      ? b.receiptNo.localeCompare(a.receiptNo)
      : b.receiptDate.localeCompare(a.receiptDate),
  );
  if (ordered.length > maxFilings) {
    warnings.push(`공시 ${ordered.length}건 중 ${maxFilings}건만 원문을 수집했습니다.`);
  }

  const fetchedAt = new Date().toISOString();
  const documents: DisclosureDocument[] = [];
  let skippedAttachments = 0;
  for (const filing of ordered.slice(0, maxFilings)) {
    if (documents.length >= limit) break;
    try {
      const bytes = await fetchDocumentZip(key, filing.receiptNo, options.signal, fetcher);
      const extracted = extractMainXml(bytes, filing.receiptNo);
      skippedAttachments += extracted.skipped;
      if (extracted.xml === null) {
        warnings.push(`${filing.receiptNo}: ZIP에 본문 XML(${filing.receiptNo}.xml)이 없어 건너뜁니다.`);
        continue;
      }
      const sections = extractSections(extracted.xml);
      sections.forEach((section, index) => {
        const body = section.lines.join("\n");
        if (!body) return;
        documents.push(toDocument(filing, section, index, body, fetchedAt));
      });
    } catch (error) {
      if (error instanceof DartStatusError && FATAL_STATUSES.has(error.status)) throw error;
      if (error instanceof SourceError) {
        warnings.push(`${filing.receiptNo}: ${error.message}`);
        continue;
      }
      throw error;
    }
  }
  if (skippedAttachments > 0) {
    warnings.push(`본문이 아닌 첨부 문서 ${skippedAttachments}개는 제외했습니다.`);
  }
  if (documents.length > limit) documents.length = limit;
  return { documents, warnings };
}

interface DateWindow {
  readonly begin: string; // YYYYMMDD
  readonly end: string;
}

function compactDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
}

function parseCompact(value: string, label: string): number {
  const compact = value.replace(/\D/g, "");
  const iso = isoDate(compact);
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (!iso || Number.isNaN(ms) || compactDate(ms) !== compact) {
    throw new SourceError("DART", `${label} 날짜 형식이 올바르지 않습니다.`);
  }
  return ms;
}

function resolveWindow(options: CollectOptions, hasCorp: boolean, warnings: string[]): DateWindow {
  const endMs = options.until ? parseCompact(options.until, "until") : Date.now();
  let beginMs = options.since
    ? parseCompact(options.since, "since")
    : endMs - DEFAULT_WINDOW_DAYS * DAY_MS;
  if (beginMs > endMs) throw new SourceError("DART", "since가 until보다 늦습니다.");
  if (!hasCorp && endMs - beginMs > MAX_WINDOW_DAYS * DAY_MS) {
    beginMs = endMs - MAX_WINDOW_DAYS * DAY_MS;
    warnings.push("기업코드 없는 조회는 3개월 이내만 가능해 시작일을 조정했습니다.");
  }
  return { begin: compactDate(beginMs), end: compactDate(endMs) };
}

async function request(
  source: string,
  url: URL,
  signal: AbortSignal | undefined,
  fetcher: typeof fetch,
): Promise<Response> {
  try {
    return await fetchSource(source, url, signal, fetcher);
  } catch (error) {
    if (error instanceof SourceError || signal?.aborted) throw error;
    // 네트워크 오류 메시지에 URL(인증키)이 섞일 수 있어 원인 문구를 버린다.
    throw new SourceError(source, "요청에 실패했습니다.");
  }
}

async function listFilings(
  key: string,
  window: DateWindow,
  corpCode: string | undefined,
  maxFilings: number,
  signal: AbortSignal | undefined,
  fetcher: typeof fetch,
): Promise<Filing[]> {
  const filings: Filing[] = [];
  for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
    const url = new URL(`${API_BASE}/list.json`);
    url.searchParams.set("crtfc_key", key);
    if (corpCode) url.searchParams.set("corp_code", corpCode);
    url.searchParams.set("bgn_de", window.begin);
    url.searchParams.set("end_de", window.end);
    url.searchParams.set("last_reprt_at", "N"); // 정정 전 이력까지 포함
    url.searchParams.set("pblntf_ty", "A"); // 정기공시
    url.searchParams.set("sort", "date");
    url.searchParams.set("sort_mth", "desc");
    url.searchParams.set("page_no", String(page));
    url.searchParams.set("page_count", String(PAGE_COUNT));

    const response = await request(LIST_SOURCE, url, signal, fetcher);
    let json: unknown;
    try {
      json = JSON.parse(await response.text());
    } catch {
      throw new SourceError(LIST_SOURCE, "JSON 응답이 아닙니다.");
    }
    const body = record(json);
    const status = text(body.status);
    if (status === "013") break; // 조회된 데이터 없음
    if (status !== "000") throw new DartStatusError(LIST_SOURCE, status, text(body.message));

    for (const item of list(body.list)) {
      const row = record(item);
      const receiptNo = text(row.rcept_no).trim();
      const rowCorp = text(row.corp_code).trim();
      if (!/^\d{14}$/.test(receiptNo)) continue;
      const reportName = text(row.report_nm).trim();
      filings.push({
        corpCode: rowCorp || corpCode || "",
        corpName: text(row.corp_name).trim(),
        receiptNo,
        reportName,
        receiptDate: isoDate(text(row.rcept_dt)),
        correction: /^\s*\[[^\]]*정정[^\]]*\]/.test(reportName),
      });
    }
    const totalPage = Number(text(body.total_page));
    if (!(page < totalPage) || filings.length >= maxFilings) break;
  }
  return filings;
}

async function fetchDocumentZip(
  key: string,
  receiptNo: string,
  signal: AbortSignal | undefined,
  fetcher: typeof fetch,
): Promise<Uint8Array> {
  const url = new URL(`${API_BASE}/document.xml`);
  url.searchParams.set("crtfc_key", key);
  url.searchParams.set("rcept_no", receiptNo);
  const response = await request(DOCUMENT_SOURCE, url, signal, fetcher);
  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_ZIP_BYTES) throw new SourceError(DOCUMENT_SOURCE, "ZIP 크기 한도를 초과했습니다.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_ZIP_BYTES) throw new SourceError(DOCUMENT_SOURCE, "ZIP 크기 한도를 초과했습니다.");

  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip) {
    // 오류는 HTTP 200 + <result><status/><message/></result> XML로 온다.
    const parsed = record(record(parseXml(decodeBytes(bytes))).result);
    const status = text(parsed.status);
    throw new DartStatusError(DOCUMENT_SOURCE, status || "unknown", text(parsed.message));
  }
  return bytes;
}

/** 공식 ZIP 구조: 본문은 `<rcept_no>.xml`, 감사보고서 등 첨부는 `<rcept_no>_<번호>.xml`. */
function extractMainXml(bytes: Uint8Array, receiptNo: string): { xml: string | null; skipped: number } {
  const wanted = `${receiptNo}.xml`.toLowerCase();
  let entries = 0;
  let total = 0;
  let skipped = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (file) => {
        entries += 1;
        total += file.originalSize;
        if (entries > MAX_ENTRIES) throw new SourceError(DOCUMENT_SOURCE, "ZIP 엔트리 수 한도를 초과했습니다.");
        if (file.originalSize > MAX_ENTRY_BYTES || total > MAX_TOTAL_BYTES) {
          throw new SourceError(DOCUMENT_SOURCE, "ZIP 압축 해제 크기 한도를 초과했습니다.");
        }
        const base = (file.name.split("/").pop() ?? "").toLowerCase();
        const isMain = base === wanted;
        if (!isMain && base.endsWith(".xml")) skipped += 1;
        return isMain;
      },
    });
  } catch (error) {
    if (error instanceof SourceError) throw error;
    throw new SourceError(DOCUMENT_SOURCE, "ZIP을 해석할 수 없습니다.");
  }
  for (const data of Object.values(files)) {
    if (data.byteLength > MAX_ENTRY_BYTES) throw new SourceError(DOCUMENT_SOURCE, "ZIP 압축 해제 크기 한도를 초과했습니다.");
    return { xml: decodeBytes(data), skipped };
  }
  return { xml: null, skipped };
}

function decodeBytes(bytes: Uint8Array): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 200));
  const label = /encoding\s*=\s*["']([\w-]+)["']/i.exec(head)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

const SKIPPED_TAGS = new Set(["IMG", "IMAGE", "PGBRK"]);
const INLINE_TAGS = new Set(["SPAN", "A", "USERMARK", "B", "I", "U", "EM", "STRONG", "SUB", "SUP"]);
const CELL_TAGS = new Set(["TD", "TH", "TE", "TU"]);

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(value: string): string {
  return value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (match, dec?: string, hex?: string, name?: string) => {
    if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? match;
    const code = dec ? Number.parseInt(dec, 10) : Number.parseInt(hex ?? "", 16);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  });
}

function clean(value: string): string {
  // 인라인 base64 덩어리는 임베딩 가치가 없어 제거한다.
  return decodeEntities(value).replace(/[A-Za-z0-9+/=]{200,}/g, "").replace(/\s+/g, " ").trim();
}

function tagsOf(node: unknown): [string, unknown][] {
  return Object.entries(record(node)).filter(([tag]) => tag !== ":@" && !/^[?!]/.test(tag));
}

function plain(nodes: unknown): string {
  const parts: string[] = [];
  for (const node of list(nodes)) {
    for (const [tag, children] of tagsOf(node)) {
      if (tag === "#text") parts.push(text(children));
      else if (!SKIPPED_TAGS.has(tag.toUpperCase())) parts.push(plain(children));
    }
  }
  return parts.join(" ");
}

function collectRows(nodes: unknown, rows: string[][]): void {
  for (const node of list(nodes)) {
    for (const [tag, children] of tagsOf(node)) {
      if (tag === "#text") continue;
      if (tag.toUpperCase() === "TR") {
        const cells: string[] = [];
        for (const cell of list(children)) {
          for (const [cellTag, cellChildren] of tagsOf(cell)) {
            if (CELL_TAGS.has(cellTag.toUpperCase())) cells.push(clean(plain(cellChildren)));
          }
        }
        rows.push(cells);
      } else {
        collectRows(children, rows);
      }
    }
  }
}

/** 숫자 위주 재무표는 버리고, 서술형 표만 행 단위로 남긴다. */
function tableLines(children: unknown): string[] {
  const rows: string[][] = [];
  collectRows(children, rows);
  const cells = rows.flat().filter((cell) => cell !== "");
  if (cells.length === 0) return [];
  const numeric = cells.filter((cell) => /\d/.test(cell) && /^[\d,.\-+()%△▲\s]+$/.test(cell)).length;
  if (numeric / cells.length >= NUMERIC_TABLE_RATIO) return [];
  return rows
    .slice(0, MAX_TABLE_ROWS)
    .map((row) => row.filter((cell) => cell !== "").join(" | "))
    .filter((line) => line !== "");
}

/** DART 본문 XML을 문서 순서대로 걸어 최상위 SECTION-1 단위의 문단 목록으로 만든다. */
function extractSections(xml: string): Section[] {
  if (XMLValidator.validate(xml) !== true) {
    throw new SourceError(DOCUMENT_SOURCE, "본문 XML 형식이 올바르지 않습니다.");
  }
  const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: true,
    processEntities: false,
    htmlEntities: false,
  });
  const tree: unknown = parser.parse(xml);

  const sections: Section[] = [];
  let current: Section | null = null;
  let buffer: string[] = [];

  const ensure = (): Section => {
    if (current === null) {
      current = { title: PREAMBLE_TITLE, lines: [] };
      sections.push(current);
    }
    return current;
  };
  const flush = (): void => {
    const line = clean(buffer.join(" "));
    buffer = [];
    if (line) ensure().lines.push(line);
  };

  const visit = (nodes: unknown): void => {
    for (const node of list(nodes)) {
      for (const [rawTag, children] of tagsOf(node)) {
        const tag = rawTag.toUpperCase();
        if (tag === "#TEXT") {
          buffer.push(text(children));
        } else if (SKIPPED_TAGS.has(tag)) {
          continue;
        } else if (tag === "BR") {
          flush();
        } else if (tag === "TABLE") {
          flush();
          for (const line of tableLines(children)) ensure().lines.push(line);
        } else if (tag === "TITLE") {
          flush();
          const title = clean(plain(children));
          if (!title) continue;
          const section = ensure();
          if (section.title === "") section.title = title;
          section.lines.push(title);
        } else if (tag === "SECTION-1") {
          flush();
          current = { title: "", lines: [] };
          sections.push(current);
          visit(children);
          flush();
          if (current.title === "") current.title = BODY_TITLE;
          current = null;
        } else if (INLINE_TAGS.has(tag)) {
          visit(children);
        } else {
          flush();
          visit(children);
          flush();
        }
      }
    }
  };
  visit(tree);
  flush();
  return sections;
}

function toDocument(
  filing: Filing,
  section: Section,
  index: number,
  body: string,
  fetchedAt: string,
): DisclosureDocument {
  const clipped = body.length > MAX_SECTION_CHARS ? `${body.slice(0, MAX_SECTION_CHARS)}…` : body;
  const url = new URL(VIEWER_URL);
  url.searchParams.set("rcpNo", filing.receiptNo);
  return {
    id: `dart:${filing.receiptNo}:${index + 1}`,
    source: "dart",
    sourceId: filing.receiptNo,
    version: filing.receiptNo,
    title: `${filing.corpName} ${filing.reportName} - ${section.title}`.trim(),
    text: clipped,
    url: url.toString(),
    publishedAt: filing.receiptDate || null,
    fetchedAt,
    disclosure: {
      corpCode: filing.corpCode,
      corpName: filing.corpName,
      receiptNo: filing.receiptNo,
      reportName: filing.reportName,
      reportDate: filing.receiptDate,
      section: section.title,
      correction: filing.correction,
    },
  };
}
