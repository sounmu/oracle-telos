/**
 * 데이터 파이프라인: HUPD 샘플 스트리밍 다운로드 → N건 추출 → 임베딩 → UMAP 2D → 산출물 저장
 *
 *   pnpm build:data                 # 기본 3,000건
 *   PATENT_COUNT=1000 pnpm build:data
 *
 * 산출물
 *   public/data/patents.json   클라이언트용 점 목록
 *   data/patents.full.json     서버용 전체 레코드 (첫 청구항 포함)
 *   data/embeddings.f32        N×384 float32 (L2 정규화)
 *   data/meta.json
 *
 * 중간 캐시: .cache/hupd-compact.jsonl (다운로드 재사용)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { Parser, type ReadEntry } from "tar";
import { UMAP } from "umap-js";
import { EMBEDDING_DIM, EMBEDDING_MODEL, embedTexts } from "../src/lib/embeddings";
import type { Decision, DatasetMeta, PatentFull, PatentPoint } from "../src/lib/types";

const SOURCE_URL =
  "https://huggingface.co/datasets/HUPD/hupd/resolve/main/data/sample-jan-2016.tar.gz";
const COUNT = Number(process.env.PATENT_COUNT ?? 3000);
const ROOT = process.cwd();
const CACHE_FILE = path.join(ROOT, ".cache", "hupd-compact.jsonl");
const EMBED_BATCH = 32;

/** HUPD 원본에서 우리가 쓰는 필드만 */
interface HupdRecord {
  application_number: string;
  publication_number: string;
  title: string;
  decision: string;
  main_cpc_label: string;
  cpc_labels: string[];
  filing_date: string;
  abstract: string;
  claims: string;
}

type Compact = Omit<PatentFull, "x" | "y">;

function normalizeDecision(raw: string): Decision | null {
  const d = raw.toUpperCase();
  if (d.endsWith("ACCEPTED")) return "ACCEPTED";
  if (d.endsWith("REJECTED")) return "REJECTED";
  if (d === "PENDING") return "PENDING";
  return null;
}

function firstClaim(claims: string): string {
  const text = (claims ?? "").replace(/\s+/g, " ").trim();
  // "1. ... 2. ..." 형태에서 두 번째 청구항 앞까지
  const cut = text.search(/\s2\.\s/);
  const first = cut > 0 ? text.slice(0, cut) : text;
  return first.length > 1500 ? first.slice(0, 1499).trimEnd() + "…" : first;
}

function toCompact(rec: HupdRecord): Compact | null {
  const decision = normalizeDecision(rec.decision ?? "");
  const title = (rec.title ?? "").replace(/\s+/g, " ").trim();
  const abstract = (rec.abstract ?? "").replace(/\s+/g, " ").trim();
  if (!decision || !title || abstract.length < 40) return null;
  const f = rec.filing_date ?? "";
  const filed =
    f.length === 8 ? `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}` : f;
  return {
    id: String(rec.application_number),
    publication: rec.publication_number ?? "",
    title,
    decision,
    cpc: rec.main_cpc_label ?? "",
    cpcLabels: Array.isArray(rec.cpc_labels) ? rec.cpc_labels : [],
    filed,
    abstract,
    firstClaim: firstClaim(rec.claims),
  };
}

async function readCache(): Promise<Compact[]> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Compact);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/** tar.gz를 받으면서 파싱하고, 필요한 건수가 모이면 연결을 끊는다. */
async function downloadRecords(n: number): Promise<Compact[]> {
  console.log(`⬇️  HUPD 샘플 스트리밍 (${n}건 필요)…`);
  const ac = new AbortController();
  const res = await fetch(SOURCE_URL, { signal: ac.signal });
  if (!res.ok || !res.body) {
    throw new Error(`다운로드 실패: HTTP ${res.status}`);
  }

  const records: Compact[] = [];
  const parser = new Parser({
    onReadEntry: (entry: ReadEntry) => {
      if (entry.type !== "File" || !entry.path.endsWith(".json")) {
        entry.resume();
        return;
      }
      const chunks: Buffer[] = [];
      entry.on("data", (c: Buffer) => chunks.push(c));
      entry.on("end", () => {
        if (records.length >= n) return;
        try {
          const rec = JSON.parse(Buffer.concat(chunks).toString("utf8")) as HupdRecord;
          const compact = toCompact(rec);
          if (compact) records.push(compact);
        } catch {
          // 손상된 레코드는 건너뜀
        }
        if (records.length % 100 === 0 && records.length > 0) {
          console.log(`   ${records.length}/${n}`);
        }
        if (records.length >= n) ac.abort();
      });
    },
  });

  try {
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      if (!parser.write(Buffer.from(chunk))) await once(parser, "drain");
      if (ac.signal.aborted) break;
    }
    parser.end();
  } catch (err) {
    if (!ac.signal.aborted) throw err;
  }

  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fs.writeFile(
    CACHE_FILE,
    records.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );
  return records;
}

function seededRandom(seed: number): () => number {
  // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  let records = await readCache();
  if (records.length >= COUNT) {
    console.log(`📦 캐시 사용: ${CACHE_FILE} (${records.length}건)`);
    records = records.slice(0, COUNT);
  } else {
    records = await downloadRecords(COUNT);
    console.log(`✅ ${records.length}건 확보`);
  }
  if (records.length === 0) throw new Error("레코드가 없습니다.");

  console.log(`🧠 임베딩 (${EMBEDDING_MODEL})…`);
  const vectors = new Float32Array(records.length * EMBEDDING_DIM);
  for (let i = 0; i < records.length; i += EMBED_BATCH) {
    const batch = records.slice(i, i + EMBED_BATCH);
    const embs = await embedTexts(batch.map((r) => `${r.title}\n${r.abstract}`));
    embs.forEach((v, j) => vectors.set(v, (i + j) * EMBEDDING_DIM));
    const done = Math.min(i + EMBED_BATCH, records.length);
    if (done % (EMBED_BATCH * 10) === 0 || done === records.length) {
      console.log(`   ${done}/${records.length}`);
    }
  }

  console.log("🗺️  UMAP 2D 투영…");
  const rows: number[][] = records.map((_, i) =>
    Array.from(vectors.subarray(i * EMBEDDING_DIM, (i + 1) * EMBEDDING_DIM)),
  );
  const umap = new UMAP({
    nComponents: 2,
    nNeighbors: 15,
    minDist: 0.1,
    random: seededRandom(42),
  });
  const coords = umap.fit(rows);

  const full: PatentFull[] = records.map((r, i) => ({
    ...r,
    x: round(coords[i][0]),
    y: round(coords[i][1]),
  }));
  const points: PatentPoint[] = full.map((p) => ({
    id: p.id,
    title: p.title,
    decision: p.decision,
    cpc: p.cpc,
    filed: p.filed,
    x: p.x,
    y: p.y,
    abstract: p.abstract.length > 300 ? p.abstract.slice(0, 299).trimEnd() + "…" : p.abstract,
  }));
  const meta: DatasetMeta = {
    model: EMBEDDING_MODEL,
    dim: EMBEDDING_DIM,
    count: full.length,
    builtAt: new Date().toISOString(),
    source: SOURCE_URL,
  };

  await fs.mkdir(path.join(ROOT, "public", "data"), { recursive: true });
  await fs.mkdir(path.join(ROOT, "data"), { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(ROOT, "public", "data", "patents.json"), JSON.stringify(points)),
    fs.writeFile(path.join(ROOT, "data", "patents.full.json"), JSON.stringify(full)),
    fs.writeFile(path.join(ROOT, "data", "embeddings.f32"), Buffer.from(vectors.buffer)),
    fs.writeFile(path.join(ROOT, "data", "meta.json"), JSON.stringify(meta, null, 2)),
  ]);

  const counts = full.reduce<Record<string, number>>((acc, p) => {
    acc[p.decision] = (acc[p.decision] ?? 0) + 1;
    return acc;
  }, {});
  console.log("🎉 완료", counts);
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
