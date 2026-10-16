// 서버/수집 스크립트 전용. 외부 응답은 여기서 HTTP/XML 경계를 통과한다.
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";

export class SourceError extends Error {
  constructor(
    readonly source: string,
    message: string,
  ) {
    super(`${source}: ${message}`);
    this.name = "SourceError";
  }
}

export function requireKey(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new SourceError(name, "설정되지 않았습니다. .env에 값을 추가한 뒤 다시 실행하세요.");
  return value;
}

export async function fetchSource(
  source: string,
  url: URL,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const timeout = AbortSignal.timeout(30_000);
  let response: Response;
  try {
    response = await fetcher(url, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      cache: "no-store",
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new SourceError(source, timeout.aborted ? "요청 시간이 초과되었습니다." : "외부 서버에 연결하지 못했습니다.");
  }
  if (!response.ok) throw new SourceError(source, `HTTP ${response.status}`);
  return response;
}

export function parseXml(text: string): Record<string, unknown> {
  if (XMLValidator.validate(text) !== true) {
    throw new SourceError("XML", "올바른 XML 응답이 아닙니다.");
  }
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: true,
    processEntities: false,
    htmlEntities: false,
  });
  const parsed: unknown = parser.parse(text);
  return z.record(z.string(), z.unknown()).parse(parsed);
}

export function record(value: unknown): Record<string, unknown> {
  const result = z.record(z.string(), z.unknown()).safeParse(value);
  return result.success ? result.data : {};
}

export function list(value: unknown): unknown[] {
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

export function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value !== "object" || value === null) return "";
  return text(record(value)["#text"]);
}

export function isoDate(value: string): string {
  const compact = value.replace(/\D/g, "");
  if (compact.length !== 8) return "";
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}
