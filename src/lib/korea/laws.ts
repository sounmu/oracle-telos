// 서버/수집 스크립트 전용. 국가법령정보 공동활용 OPEN API(시행일 법령, target=eflaw) 수집기.
// 목록: https://www.law.go.kr/DRF/lawSearch.do?target=eflaw
// 본문: https://www.law.go.kr/DRF/lawService.do?target=eflaw
// 가이드: https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=lsEfYdListGuide
//         https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=lsEfYdInfoGuide
import { strFromU8, unzipSync } from "fflate";
import type {
  CollectOptions,
  CollectionResult,
  LawDocument,
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

const SOURCE = "law";
const LIST_URL = "https://www.law.go.kr/DRF/lawSearch.do";
const SERVICE_URL = "https://www.law.go.kr/DRF/lawService.do";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const MAX_XML_BYTES = 10 * 1024 * 1024;

type LawState = LawDocument["law"]["state"];

interface LawListItem {
  readonly lawId: string;
  readonly mst: string;
  readonly name: string;
  readonly effectiveFrom: string;
  readonly promulgatedAt: string;
  readonly state: LawState | null;
}

interface ListPage {
  readonly items: LawListItem[];
  readonly total: number;
}

const compact = (value: string): string => value.replace(/\D/g, "");

/** HTML 태그 제거 + 엔티티 복원. 한글로 시작하는 `<개정 2020.1.1>` 표기는 보존한다. */
function plain(value: string): string {
  const stripTags = (input: string): string =>
    input.replace(/<\/?[A-Za-z][^>]*>/g, "");
  const withBreaks = value.replace(/<br\s*\/?>/gi, "\n");
  const decoded = stripTags(withBreaks)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&amp;/g, "&");
  return stripTags(decoded)
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stateFromCode(code: string): LawState | null {
  if (code.includes("예정")) return "scheduled";
  if (code.includes("연혁")) return "historical";
  if (code.includes("현행")) return "current";
  return null;
}

function stateFromDate(effectiveFrom: string, today: string): LawState {
  return effectiveFrom > today ? "scheduled" : "current";
}

async function readXml(response: Response): Promise<Record<string, unknown>> {
  if (Number(response.headers.get("content-length")) > MAX_XML_BYTES) {
    throw new SourceError(SOURCE, "XML 응답 크기 한도를 초과했습니다.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_XML_BYTES) throw new SourceError(SOURCE, "XML 응답 크기 한도를 초과했습니다.");
  let body: string;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    let entries = 0;
    let total = 0;
    const files = unzipSync(bytes, {
      filter: (file) => {
        entries += 1;
        total += file.originalSize;
        if (entries > 100 || file.originalSize > MAX_XML_BYTES || total > MAX_XML_BYTES) {
          throw new SourceError(SOURCE, "ZIP 압축 해제 크기 한도를 초과했습니다.");
        }
        return file.name.toLowerCase().endsWith(".xml");
      },
    });
    const name = Object.keys(files).find((entry) =>
      entry.toLowerCase().endsWith(".xml"),
    );
    const entry = name === undefined ? undefined : files[name];
    if (entry === undefined) {
      throw new SourceError(SOURCE, "ZIP 응답에 XML 파일이 없습니다.");
    }
    body = strFromU8(entry);
  } else {
    body = new TextDecoder("utf-8").decode(bytes);
  }
  try {
    return parseXml(body.replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error instanceof SourceError) {
      throw new SourceError(
        SOURCE,
        "XML이 아닌 응답입니다. OC 인증값·IP/도메인 등록 여부를 확인하세요.",
      );
    }
    throw error;
  }
}

/** 인증 실패 등 `<result>`/`<msg>`만 담긴 오류 응답을 SourceError로 올린다. */
function rejectErrorEnvelope(root: Record<string, unknown>): void {
  const message = text(root.result) || text(root.msg) || text(root.Message);
  if (message && !("LawSearch" in root) && !("법령" in root)) {
    throw new SourceError(SOURCE, plain(message));
  }
}

function parseList(
  root: Record<string, unknown>,
  warnings: string[],
): ListPage | null {
  rejectErrorEnvelope(root);
  const search = record(root.LawSearch);
  if (Object.keys(search).length === 0) {
    warnings.push(
      `지원하지 않는 법령 목록 스키마입니다(루트: ${Object.keys(root).join(",") || "없음"}).`,
    );
    return null;
  }
  const items: LawListItem[] = [];
  for (const raw of list(search.law)) {
    const row = record(raw);
    const mst = text(row["법령일련번호"]).trim();
    const lawId = text(row["법령ID"]).trim();
    const effectiveFrom = isoDate(text(row["시행일자"]));
    if (!mst || !lawId || !effectiveFrom) {
      warnings.push(
        `법령 목록 항목에 법령일련번호/법령ID/시행일자가 없어 건너뜁니다(${text(row["법령명한글"]) || "이름 없음"}).`,
      );
      continue;
    }
    items.push({
      lawId,
      mst,
      name: plain(text(row["법령명한글"])),
      effectiveFrom,
      promulgatedAt: isoDate(text(row["공포일자"])),
      state: stateFromCode(text(row["현행연혁코드"])),
    });
  }
  const total = Number.parseInt(text(search.totalCnt), 10);
  return { items, total: Number.isFinite(total) ? total : items.length };
}

function isDeleted(raw: Record<string, unknown>, body: string): boolean {
  if (text(raw["조문제개정유형"]).trim() === "삭제") return true;
  if (list(raw["항"]).length > 0) return false;
  const rest = body
    .replace(/^제\s*\d+\s*조(?:\s*의\s*\d+)?\s*/, "")
    .replace(/^[(（][^)）]*[)）]\s*/, "")
    .trim();
  return /^삭제(\s|<|$)/.test(rest) || (rest === "" && body.endsWith("삭제"));
}

function nested(
  rows: unknown[],
  depth: number,
  keys: { number: string; body: string; child?: [string, string, string] },
): string[] {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);
  for (const item of rows) {
    const row = record(item);
    const content = plain(text(row[keys.body]));
    const number = plain(text(row[keys.number]));
    if (content) {
      lines.push(`${indent}${content.startsWith(number) || !number ? "" : `${number} `}${content}`);
    }
    if (keys.child) {
      const [tag, childNumber, childBody] = keys.child;
      const grandKeys =
        tag === "호"
          ? { number: childNumber, body: childBody, child: ["목", "목번호", "목내용"] as [string, string, string] }
          : { number: childNumber, body: childBody };
      lines.push(...nested(list(row[tag]), depth + 1, grandKeys));
    }
  }
  return lines;
}

function articleLabel(no: string, branch: string): string {
  const base = `제${Number.parseInt(no, 10)}조`;
  const sub = Number.parseInt(branch, 10);
  return sub > 0 ? `${base}의${sub}` : base;
}

function toDocuments(
  root: Record<string, unknown>,
  item: LawListItem,
  today: string,
  fetchedAt: string,
  warnings: string[],
  budget: number,
): LawDocument[] {
  rejectErrorEnvelope(root);
  const law = record(root["법령"]);
  if (Object.keys(law).length === 0) {
    warnings.push(
      `지원하지 않는 법령 본문 스키마입니다(MST ${item.mst}, 루트: ${Object.keys(root).join(",") || "없음"}).`,
    );
    return [];
  }
  const basic = record(law["기본정보"]);
  const bodyLawId = text(basic["법령ID"]).trim();
  if (bodyLawId && bodyLawId !== item.lawId) {
    warnings.push(
      `목록의 법령ID(${item.lawId})와 본문의 법령ID(${bodyLawId})가 달라 MST ${item.mst}를 건너뜁니다.`,
    );
    return [];
  }
  const lawName = plain(text(basic["법령명_한글"])) || item.name;
  const promulgatedAt = isoDate(text(basic["공포일자"])) || item.promulgatedAt;
  const lawEffective = isoDate(text(basic["시행일자"])) || item.effectiveFrom;
  let state = item.state;
  if (state === null) {
    warnings.push(
      `MST ${item.mst}의 현행연혁코드를 해석할 수 없어 시행일 기준으로 상태를 추정했습니다.`,
    );
    state = stateFromDate(lawEffective, today);
  }
  const compactEf = compact(item.effectiveFrom);
  const baseId = `law:${item.lawId}:${item.mst}:${compactEf}`;
  const url = `https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=${encodeURIComponent(item.mst)}&efYd=${compactEf}`;
  const documents: LawDocument[] = [];
  const seen = new Set<string>();

  const push = (
    key: string,
    articleNumber: string,
    title: string,
    body: string,
    effectiveFrom: string,
    publishedAt: string,
  ): void => {
    if (documents.length >= budget || !body) return;
    let id = `${baseId}:${key}`;
    for (let n = 2; seen.has(id); n++) id = `${baseId}:${key}#${n}`;
    seen.add(id);
    documents.push({
      id,
      source: "law",
      sourceId: `${item.lawId}/${item.mst}`,
      version: `${item.mst}@${compactEf}`,
      title,
      text: body,
      url,
      publishedAt: publishedAt || null,
      fetchedAt,
      law: {
        lawId: item.lawId,
        mst: item.mst,
        articleNumber,
        versionEffectiveFrom: item.effectiveFrom,
        effectiveFrom,
        effectiveTo: null,
        promulgatedAt,
        state,
      },
    });
  };

  const articles = record(law["조문"]);
  const units = list(articles["조문단위"]);
  if (units.length === 0 && list(law["부칙"]).length === 0) {
    warnings.push(`MST ${item.mst}에 조문단위/부칙이 없어 문서를 만들지 못했습니다.`);
  }
  for (const raw of units) {
    const unit = record(raw);
    if (text(unit["조문여부"]).trim() === "전문") continue;
    const no = text(unit["조문번호"]).trim();
    if (!no) {
      warnings.push(`MST ${item.mst}: 조문번호가 없는 조문을 건너뜁니다.`);
      continue;
    }
    const branch = text(unit["조문가지번호"]).trim();
    const label = articleLabel(no, branch);
    const heading = plain(text(unit["조문제목"]));
    const content = plain(text(unit["조문내용"]));
    if (isDeleted(unit, content)) continue;
    const lines: string[] = [content || `${label}${heading ? `(${heading})` : ""}`];
    lines.push(
      ...nested(list(unit["항"]), 0, {
        number: "항번호",
        body: "항내용",
        child: ["호", "호번호", "호내용"],
      }),
    );
    const reference = plain(text(unit["조문참고자료"]));
    if (reference) lines.push(`[참고] ${reference}`);
    const articleEffective = isoDate(text(unit["조문시행일자"])) || lawEffective;
    push(
      `${Number.parseInt(no, 10)}-${Number.parseInt(branch, 10) || 0}`,
      label,
      `${lawName} ${label}${heading ? `(${heading})` : ""}`,
      lines.join("\n"),
      articleEffective,
      promulgatedAt,
    );
  }

  list(record(law["부칙"])["부칙단위"]).forEach((raw, index) => {
    const unit = record(raw);
    const body = list(unit["부칙내용"]).map((part) => plain(text(part))).filter(Boolean).join("\n");
    const published = isoDate(text(unit["부칙공포일자"])) || promulgatedAt;
    push(
      `addenda-${index + 1}`,
      `부칙${index + 1}`,
      `${lawName} 부칙`,
      body,
      lawEffective,
      published,
    );
  });
  return documents;
}

function effectiveRange(options: CollectOptions): string | null {
  const since = options.since ? compact(options.since) : "";
  const until = options.until ? compact(options.until) : "";
  if (!since && !until) return null;
  return `${since || "19000101"}~${until || "99991231"}`;
}

async function listPage(
  key: string,
  options: CollectOptions,
  page: number,
  search: 1 | 2,
  fetcher: typeof fetch,
  warnings: string[],
): Promise<ListPage | null> {
  const url = new URL(LIST_URL);
  url.searchParams.set("OC", key);
  url.searchParams.set("target", "eflaw");
  url.searchParams.set("type", "XML");
  url.searchParams.set("nw", "3");
  url.searchParams.set("display", String(PAGE_SIZE));
  url.searchParams.set("page", String(page));
  if (options.query.trim()) {
    url.searchParams.set("query", options.query.trim());
    url.searchParams.set("search", String(search));
  }
  const range = effectiveRange(options);
  if (range) url.searchParams.set("efYd", range);
  const response = await fetchSource(SOURCE, url, options.signal, fetcher);
  return parseList(await readXml(response), warnings);
}

async function collectItems(
  key: string,
  options: CollectOptions,
  search: 1 | 2,
  fetcher: typeof fetch,
  warnings: string[],
): Promise<LawListItem[]> {
  const found: LawListItem[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await listPage(key, options, page, search, fetcher, warnings);
    if (result === null) break;
    found.push(...result.items);
    if (found.length >= options.limit || page * PAGE_SIZE >= result.total || result.items.length === 0) break;
  }
  return found;
}

export async function collectLaws(
  options: CollectOptions,
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<CollectionResult> {
  if (!key.trim()) throw new SourceError(SOURCE, "법령 API OC 인증값이 비어 있습니다.");
  const warnings: string[] = [];
  if (options.limit <= 0) return { documents: [], warnings };

  let items = await collectItems(key, options, 1, fetcher, warnings);
  if (items.length === 0 && options.query.trim()) {
    items = await collectItems(key, options, 2, fetcher, warnings);
    if (items.length > 0) {
      warnings.push("법령명 검색 결과가 없어 본문 검색(search=2)으로 대체했습니다.");
    }
  }
  if (items.length === 0) {
    warnings.push("조건에 맞는 현행 법령이 없습니다.");
    return { documents: [], warnings };
  }

  const fetchedAt = new Date().toISOString();
  const today = fetchedAt.slice(0, 10);
  const documents: LawDocument[] = [];
  const visited = new Set<string>();
  for (const item of items) {
    if (documents.length >= options.limit) break;
    const identity = `${item.mst}@${item.effectiveFrom}`;
    if (visited.has(identity)) continue;
    visited.add(identity);
    const url = new URL(SERVICE_URL);
    url.searchParams.set("OC", key);
    url.searchParams.set("target", "eflaw");
    url.searchParams.set("type", "XML");
    url.searchParams.set("MST", item.mst);
    url.searchParams.set("efYd", compact(item.effectiveFrom));
    try {
      const response = await fetchSource(SOURCE, url, options.signal, fetcher);
      const root = await readXml(response);
      documents.push(
        ...toDocuments(root, item, today, fetchedAt, warnings, options.limit - documents.length),
      );
    } catch (error) {
      if (options.signal?.aborted) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      warnings.push(`MST ${item.mst} 본문 수집 실패: ${reason}`);
    }
  }
  return { documents, warnings };
}
