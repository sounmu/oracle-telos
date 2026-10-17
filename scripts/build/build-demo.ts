/**
 * 시연용 마스터 DB: 실제 자료와 더미를 같은 임베딩 공간에 놓는다.
 *
 *   pnpm gen:demo-dummy && pnpm build:demo
 *
 * 입력
 * - data/raw/demo/real-patents.json: 상세를 확인한 실제 특허
 * - data/raw/demo/citations.json: KIPRIS 인용·피인용 목록의 실제 특허(제목·날짜·IPC만)와 실제 인용 관계
 * - data/raw/demo/dummy-patents.json, dummy-generated.json: 더미 (가짜 인용 포함)
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

interface Citations {
  nodes: { id: string; number: string; title: string; date: string; ipc: string; dateKind: string }[];
  /** [인용한 특허 id, 인용된 특허 id] */
  links: [string, string][];
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(RAW, name), "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** 인용 목록에서만 확인한 실제 특허. 상세(초록·청구항)는 수집하지 않았다는 점을 요약에 밝힌다 */
function citationPatent(n: Citations["nodes"][number]): RawPatent {
  const cpc = n.ipc.replace(/\s+/g, "");
  return {
    id: n.id,
    publication: n.number,
    title: n.title,
    decision: "UNKNOWN",
    cpc,
    cpcLabels: [cpc],
    filed: n.date,
    abstract: `${n.title}. KIPRIS 인용 목록에서 확인한 실제 특허로, 제목·${n.dateKind}·IPC만 수집했습니다.`,
    firstClaim: "",
    source: "real",
  };
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

async function main() {
  const detailed = JSON.parse(await fs.readFile(path.join(RAW, "real-patents.json"), "utf8")) as RawPatent[];
  const citations = await readJson<Citations>("citations.json", { nodes: [], links: [] });
  const real = [...detailed, ...citations.nodes.map(citationPatent)];
  const dummy = [
    ...(JSON.parse(await fs.readFile(path.join(RAW, "dummy-patents.json"), "utf8")) as RawPatent[]),
    ...(await readJson<RawPatent[]>("dummy-generated.json", [])),
  ];
  const all = [...real, ...dummy];

  // 인용: 실제 관계(citations.links)와 더미의 가짜 인용(cites)을 합친다. 지도에 없는 대상은 버린다
  const ids = new Set(all.map((p) => p.id));
  const cites = new Map<string, Set<string>>();
  const addCite = (from: string, to: string) => {
    if (from === to || !ids.has(from) || !ids.has(to)) return;
    cites.set(from, (cites.get(from) ?? new Set()).add(to));
  };
  for (const [from, to] of citations.links) addCite(from, to);
  for (const p of all) for (const to of p.cites ?? []) addCite(p.id, to);

  // 인용 목록에서만 확인한 특허는 요약에 같은 안내 문구가 붙으므로, 그 문구끼리 뭉치지 않게 제목만 임베딩한다
  const citationOnly = new Set(citations.nodes.map((n) => n.id));
  const vectors = await embedTexts(all.map((p) => (citationOnly.has(p.id) ? p.title : `${p.title}\n${p.abstract}`)));
  const flat = new Float32Array(all.length * EMBEDDING_DIM);
  vectors.forEach((v, i) => flat.set(v, i * EMBEDDING_DIM));

  const umap = new UMAP({ nComponents: 2, nNeighbors: 15, minDist: 0.1, random: seededRandom(42) });
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
    cites: [...(cites.get(p.id) ?? [])],
  }));
  const linkCount = [...cites.values()].reduce((s, v) => s + v.size, 0);

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
        citations: linkCount,
        source: "data/raw/demo (실제 자료 + 더미)",
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(`시연 마스터 저장: 실제 ${real.length}건 + 더미 ${dummy.length}건, 인용 ${linkCount}건 → data/master/demo`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
