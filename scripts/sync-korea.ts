import { loadEnvConfig } from "@next/env";
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { collectKipris } from "../src/lib/korea/kipris";
import { collectLaws } from "../src/lib/korea/laws";
import { collectDisclosures } from "../src/lib/korea/dart";
import { requireKey, SourceError } from "../src/lib/korea/http";
import {
  buildResearchIndex,
  mergeDocuments,
  readResearchIndex,
  researchPath,
  writeResearchIndex,
} from "../src/lib/korea/index";
import { researchDocumentSchema } from "../src/lib/korea/schema";
import type { CollectOptions, CollectionResult, ResearchDocument, ResearchSource } from "../src/lib/types";

loadEnvConfig(process.cwd());

const flags = z.object({
  source: z.enum(["kipris", "law", "dart", "all"]).default("kipris"),
  query: z.string().trim().min(1).default("반려동물"),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  since: z.iso.date().optional(),
  until: z.iso.date().optional(),
  "corp-code": z.array(z.string().regex(/^\d{8}$/)).optional(),
  reindex: z.boolean().default(false),
  remove: z.array(z.string()).optional(),
  help: z.boolean().default(false),
});

async function main(): Promise<void> {
  const parsed = parseArgs({
    options: {
      source: { type: "string" },
      query: { type: "string" },
      limit: { type: "string" },
      since: { type: "string" },
      until: { type: "string" },
      "corp-code": { type: "string", multiple: true },
      reindex: { type: "boolean" },
      remove: { type: "string", multiple: true },
      help: { type: "boolean", short: "h" },
    },
  });
  const options = flags.parse(parsed.values);
  if (options.help) {
    console.log(`한국 데이터 수집·색인 (기존 미국 샘플은 변경하지 않음)
  pnpm sync:korea --source kipris --query "반려동물" --limit 20
  pnpm sync:korea --source law --query "동물보호법" --limit 200
  pnpm sync:korea --source dart --corp-code <DART 8자리 고유번호> --since YYYY-MM-DD --until YYYY-MM-DD --limit 30
  pnpm sync:korea --reindex
  pnpm sync:korea --remove <문서ID> [--remove <문서ID>]

키: KIPRIS_API_KEY / LAW_OC / DART_API_KEY (.env)
--limit: 수집할 특허/법령 조문/공시 절의 최대 개수 (기본 20)
--since/--until: KIPRIS 출원일, 법령 시행일, DART 접수일 범위
한국 색인은 data/korea/index.json에 비공개 저장합니다.
동일 명령을 다시 실행하면 문서를 병합하고 변경된 본문만 임베딩합니다.`);
    return;
  }
  if (options.since && options.until && options.since > options.until) {
    throw new SourceError("수집", "since는 until보다 늦을 수 없습니다.");
  }
  const directory = path.dirname(researchPath());
  await fs.mkdir(directory, { recursive: true });
  const lockPath = path.join(directory, ".sync.lock");
  let lock;
  try {
    lock = await fs.open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new SourceError("수집", "다른 수집 작업이 실행 중입니다. 종료 여부를 확인하세요.");
    }
    throw error;
  }
  try {
    const previous = await readResearchIndex();
    let documents: ResearchDocument[] = previous?.documents ?? [];
    const remove = new Set(options.remove ?? []);
    if (remove.size > 0) {
      const removed = documents.filter((document) => remove.has(document.id)).length;
      documents = documents.filter((document) => !remove.has(document.id));
      console.log(`문서 ${removed}건과 파생 색인을 제거합니다.`);
    } else if (!options.reindex) {
      const sources: ResearchSource[] = options.source === "all" ? ["kipris", "law", "dart"] : [options.source];
      const collectOptions: CollectOptions = {
        query: options.query,
        limit: options.limit,
        since: options.since,
        until: options.until,
        corpCodes: options["corp-code"],
      };
      let succeeded = 0;
      for (const source of sources) {
        try {
          let result: CollectionResult;
          switch (source) {
            case "kipris":
              result = await collectKipris(collectOptions, requireKey("KIPRIS_API_KEY"));
              break;
            case "law":
              result = await collectLaws(collectOptions, requireKey("LAW_OC"));
              break;
            case "dart":
              result = await collectDisclosures(collectOptions, requireKey("DART_API_KEY"));
              break;
          }
          const incoming = z.array(researchDocumentSchema).parse(result.documents);
          for (const warning of result.warnings) console.warn(`[${source}] ${warning}`);
          console.log(`[${source}] ${incoming.length}건 수집`);
          if (incoming.length > 0) {
            documents = mergeDocuments(documents, incoming);
            succeeded += 1;
          }
        } catch (error) {
          if (sources.length === 1) throw error;
          process.exitCode = 1;
          console.error(error instanceof SourceError ? error.message : `[${source}] 수집 실패. 설정과 원문 응답을 확인하세요.`);
        }
      }
      if (succeeded === 0) {
        console.log("새 문서가 없어 기존 색인을 유지합니다.");
        return;
      }
    }
    if (!previous && documents.length === 0) {
      throw new SourceError("색인", "먼저 --source 옵션으로 데이터를 수집하세요.");
    }
    const index = await buildResearchIndex(documents, options.reindex ? null : previous);
    await writeResearchIndex(index);
    console.log(`색인 저장: 특허 ${index.points.length}건 · 전체 문서 ${index.documents.length}건 · 청크 ${index.chunks.length}개`);
    console.log(`모델: ${index.model} / ${index.dim}차원 · 갱신: ${index.builtAt}`);
  } finally {
    await lock.close();
    await fs.rm(lockPath, { force: true });
  }
}

main().catch((error: unknown) => {
  if (error instanceof SourceError) console.error(error.message);
  else if (error instanceof z.ZodError) console.error("입력 또는 출처 응답 형식 오류:", error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  else console.error("수집·색인에 실패했습니다. 네트워크, 명령 인자, 데이터 파일을 확인하세요.");
  process.exitCode = 1;
});
