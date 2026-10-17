/**
 * 시연용 마스터 DB: 실제 자료 4건 + 더미 36건을 같은 임베딩 공간에 놓는다.
 *
 *   pnpm build:demo
 *
 * 입력: data/raw/demo/real-patents.json (실제 자료), data/raw/demo/dummy-patents.json (더미)
 * 출력: data/master/demo/{manifest.json, embedding.json, vectors.f32}
 * 더미는 source="dummy"로 표시되며, 화면에서 실제 자료와 구분해 보인다.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { UMAP } from "umap-js";
import { EMBEDDING_DIM, EMBEDDING_MODEL, embedTexts } from "../../src/lib/embeddings";
import type { PatentFull } from "../../src/lib/types";

const ROOT = process.cwd();
const RAW = path.join(ROOT, "data", "raw", "demo");
const OUT = path.join(ROOT, "data", "master", "demo");

interface RawPatent extends Omit<PatentFull, "x" | "y" | "source"> {
  source: "real" | "dummy";
  applicant?: string;
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

async function main() {
  const real = JSON.parse(await fs.readFile(path.join(RAW, "real-patents.json"), "utf8")) as RawPatent[];
  const dummy = JSON.parse(await fs.readFile(path.join(RAW, "dummy-patents.json"), "utf8")) as RawPatent[];
  const all = [...real, ...dummy];

  const vectors = await embedTexts(all.map((p) => `${p.title}\n${p.abstract}`));
  const flat = new Float32Array(all.length * EMBEDDING_DIM);
  vectors.forEach((v, i) => flat.set(v, i * EMBEDDING_DIM));

  const umap = new UMAP({ nComponents: 2, nNeighbors: 8, minDist: 0.1, random: seededRandom(42) });
  const coords = umap.fit(vectors.map((v) => Array.from(v)));

  const points: PatentFull[] = all.map((p, i) => ({
    id: p.id,
    publication: p.publication,
    title: p.title,
    decision: p.decision,
    cpc: p.cpc,
    cpcLabels: p.cpcLabels,
    filed: p.filed,
    abstract: p.abstract,
    firstClaim: p.firstClaim,
    x: coords[i][0],
    y: coords[i][1],
    source: p.source,
    applicants: p.applicant ? [p.applicant] : [],
  }));

  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, "embedding.json"), JSON.stringify(points, null, 2));
  await fs.writeFile(path.join(OUT, "vectors.f32"), Buffer.from(flat.buffer));
  await fs.writeFile(
    path.join(OUT, "manifest.json"),
    JSON.stringify(
      {
        model: EMBEDDING_MODEL,
        dim: EMBEDDING_DIM,
        count: all.length,
        real: real.length,
        dummy: dummy.length,
        source: "data/raw/demo (실제 자료 + 더미)",
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(`시연 마스터 저장: 실제 ${real.length}건 + 더미 ${dummy.length}건 → data/master/demo`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
