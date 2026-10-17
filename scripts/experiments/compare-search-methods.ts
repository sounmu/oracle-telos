import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { loadEnvConfig } from "@next/env";
import { z } from "zod";
import type { PatentComparison, SearchExperimentReport, SearchExperimentResult } from "../../src/lib/types";
import { evaluateRanking, rankBaselines, rerankElements } from "./search-comparison-core";
import { renderSearchComparison } from "./search-comparison-report";
import { LEXICAL_CONFIG } from "../../src/lib/korea/bm25";

const querySchema = z.array(z.object({
  id: z.string().min(1), idea: z.string().trim().min(10).max(4000),
  judgments: z.object({ source: z.string().min(1), relevance: z.record(z.string(), z.number().int().min(0).max(3)) }).optional(),
})).min(1).refine((queries) => new Set(queries.map((query) => query.id)).size === queries.length, "질의 ID가 중복됩니다.");

async function main() {
  const { values } = parseArgs({ options: {
    queries: { type: "string", default: "scripts/experiments/search-comparison.queries.json" },
    index: { type: "string" }, out: { type: "string" }, top: { type: "string", default: "5" },
    limit: { type: "string" }, "dry-run": { type: "boolean", default: false }, help: { type: "boolean", default: false },
  } });
  if (values.help) {
    console.log("pnpm experiment:search [--queries FILE] [--index FILE] [--top 5] [--limit 3] [--out .cache/experiments/NAME] [--dry-run]\n기본: 로컬 한국 색인 고정, KIPRIS 호출 없음, 실제 OpenAI 검색 계획·기술 비교 호출. 출력 디렉터리는 새 경로여야 합니다.");
    return;
  }
  loadEnvConfig(process.cwd());
  const top = z.coerce.number().int().min(3).max(20).parse(values.top);
  const allQueries = querySchema.parse(JSON.parse(await fs.readFile(values.queries, "utf8")));
  const limit = z.coerce.number().int().positive().parse(values.limit ?? allQueries.length);
  const queries = allQueries.slice(0, limit);
  const { researchIndexSchema } = await import("../../src/lib/korea/schema");
  const { researchPath, documentsAsOf } = await import("../../src/lib/korea/index");
  const indexText = await fs.readFile(values.index ?? researchPath(), "utf8");
  const index = researchIndexSchema.parse(JSON.parse(indexText));
  const { EMBEDDING_MODEL, EMBEDDING_DIM, embedTexts } = await import("../../src/lib/embeddings");
  if (index.model !== EMBEDDING_MODEL || index.dim !== EMBEDDING_DIM) throw new Error("색인의 임베딩 모델/차원이 다릅니다. pnpm sync:korea --reindex가 필요합니다.");
  const createdAt = new Date().toISOString();
  const asOf = createdAt.slice(0, 10);
  const documents = new Map(documentsAsOf(index, asOf).filter((d) => d.source === "kipris").map((d) => [d.id, d]));
  if (documents.size < 3) throw new Error("평가할 한국 특허가 3건 이상 필요합니다. pnpm sync:korea로 먼저 수집하세요.");
  for (const query of queries) {
    const missing = Object.keys(query.judgments?.relevance ?? {}).filter((id) => !documents.has(id));
    if (missing.length) throw new Error(`${query.id}: 정답 특허가 고정 후보에 없습니다: ${missing.join(", ")}`);
  }
  console.log(`한국 특허 ${documents.size}건 / 질의 ${queries.length}개 / 후보 상위 ${top}건 / OpenAI 논리 호출 최대 ${queries.length * (top + 1)}회 (SDK 재시도 별도), KIPRIS 0회`);
  if (values["dry-run"]) return;
  if (!process.env.OPENAI_API_KEY) throw new Error("네 번째 방식 실행에 OPENAI_API_KEY가 필요합니다. --dry-run으로 입력만 확인할 수 있습니다.");
  const out = path.resolve(values.out ?? `.cache/experiments/search-comparison-${createdAt.replace(/[:.]/g, "-")}`);
  const privateRoot = path.resolve(".cache/experiments") + path.sep;
  if (!out.startsWith(privateRoot)) throw new Error("한국 특허 결과는 비공개 .cache/experiments/ 아래에 저장해야 합니다.");
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.mkdir(out, { mode: 0o700 });
  const { AGENT_MODEL, planPatentSearch, comparePatent } = await import("../../src/lib/agent");
  const results: SearchExperimentResult[] = [];
  const report: SearchExperimentReport = {
    lexical: LEXICAL_CONFIG,
    createdAt, indexSha256: createHash("sha256").update(indexText).digest("hex"),
    embeddingModel: EMBEDDING_MODEL, agentModel: AGENT_MODEL, corpusSize: documents.size, top, queryCount: queries.length, results,
  };
  const save = async () => {
    await fs.writeFile(path.join(out, "results.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
    await fs.writeFile(path.join(out, "report.md"), renderSearchComparison(report), { mode: 0o600 });
  };
  await fs.writeFile(path.join(out, "index.snapshot.json"), indexText, { mode: 0o600 });
  await fs.writeFile(path.join(out, "queries.json"), JSON.stringify(queries, null, 2), { mode: 0o600 });
  await save();
  for (const query of queries) {
    console.log(`[${query.id}] 검색 계획·임베딩 준비`);
    const started = performance.now();
    const plan = await planPatentSearch(query.idea);
    const [vector] = await embedTexts([query.idea]);
    if (!vector) throw new Error("질의 임베딩을 생성하지 못했습니다.");
    const setupMs = performance.now() - started;
    const baseline = rankBaselines(index, { description: vector, keywords: plan.queries.join(" "), top, asOf });
    const compareStart = performance.now();
    const comparisons: PatentComparison[] = [];
    const errors: string[] = [];
    for (const hit of baseline.hybrid) {
      const document = documents.get(hit.id);
      if (!document) throw new Error(`고정 후보에서 특허를 찾을 수 없습니다: ${hit.id}`);
      console.log(`[${query.id}] 기술 비교 ${comparisons.length + errors.length + 1}/${baseline.hybrid.length}: ${hit.id}`);
      try {
        comparisons.push(await comparePatent(query.idea, document));
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        errors.push(`${hit.id}: ${error.message}`);
        process.exitCode = 1;
      }
    }
    const elements = rerankElements(baseline.hybrid, comparisons);
    const methods = (["embedding", "keyword", "bm25", "hybrid"] as const).map((method) => ({
      method, elapsedMs: baseline.elapsedMs[method], ranking: baseline[method], metrics: evaluateRanking(baseline[method], query),
    }));
    results.push({ query, plan, setupMs, comparisons, errors, methods: [...methods, {
      method: "elements", elapsedMs: baseline.elapsedMs.hybrid + performance.now() - compareStart,
      ranking: elements, metrics: evaluateRanking(elements, query),
    }] });
    await save();
  }
  console.log(`결과: ${path.join(out, "report.md")}\n독립 정답 없는 질의는 순위·근거 관찰이며 정확도 검증이 아닙니다.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
