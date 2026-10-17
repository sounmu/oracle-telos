/**
 * 분쟁 사례를 특허와 같은 임베딩 공간(EMBEDDING_MODEL)에 넣는다.
 *
 *   pnpm embed:cases
 *
 * 입력: src/lib/cases.ts (정적 사례), data/master/sample/manifest.json (특허 마스터의 모델·차원)
 * 출력: data/master/cases/vectors.f32 (N×dim float32, L2 정규화), data/master/cases/manifest.json
 * 확인: 사례마다 같은 공간의 미국 특허 상위 5건을 출력한다 (의미 검증용, 판단 근거 아님)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { DISPUTE_CASES } from "../../src/lib/cases";
import { caseEmbeddingText } from "../../src/lib/caseText";
import { EMBEDDING_DIM, EMBEDDING_MODEL, embedTexts } from "../../src/lib/embeddings";
import type { DatasetMeta, PatentFull } from "../../src/lib/types";

const ROOT = process.cwd();
const SAMPLE = path.join(ROOT, "data", "master", "sample");
const CASES = path.join(ROOT, "data", "master", "cases");
const TOP_K = 5;

async function main(): Promise<void> {
  const meta = JSON.parse(await fs.readFile(path.join(SAMPLE, "manifest.json"), "utf8")) as DatasetMeta;
  // 특허 마스터 DB와 다른 모델로 만든 벡터는 같은 공간이 아니므로 거부한다
  if (meta.model !== EMBEDDING_MODEL || meta.dim !== EMBEDDING_DIM) {
    throw new Error(`모델 불일치: 마스터 DB ${meta.model}/${meta.dim} != 현재 ${EMBEDDING_MODEL}/${EMBEDDING_DIM}`);
  }

  const texts = DISPUTE_CASES.map(caseEmbeddingText);
  const vectors = await embedTexts(texts);
  const flat = new Float32Array(vectors.length * EMBEDDING_DIM);
  vectors.forEach((vector, i) => {
    if (vector.length !== EMBEDDING_DIM) throw new Error(`차원 오류: ${DISPUTE_CASES[i].id}`);
    flat.set(vector, i * EMBEDDING_DIM);
  });

  await fs.mkdir(CASES, { recursive: true });
  await fs.writeFile(path.join(CASES, "vectors.f32"), Buffer.from(flat.buffer));
  await fs.writeFile(
    path.join(CASES, "manifest.json"),
    JSON.stringify(
      {
        model: EMBEDDING_MODEL,
        dim: EMBEDDING_DIM,
        count: DISPUTE_CASES.length,
        ids: DISPUTE_CASES.map((item) => item.id),
        textSource: "tech + keywords (caseEmbeddingText)",
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  // 같은 공간 검증: 사례 벡터와 특허 벡터의 내적(정규화되어 코사인 유사도) 상위 K건
  const patents = JSON.parse(await fs.readFile(path.join(SAMPLE, "embedding.json"), "utf8")) as PatentFull[];
  const patentBuf = await fs.readFile(path.join(SAMPLE, "vectors.f32"));
  const patentVectors = new Float32Array(patentBuf.buffer, patentBuf.byteOffset, patentBuf.byteLength / 4);

  DISPUTE_CASES.forEach((item, i) => {
    const caseVector = flat.subarray(i * EMBEDDING_DIM, (i + 1) * EMBEDDING_DIM);
    const scored = patents.map((patent, j) => {
      let sum = 0;
      for (let d = 0; d < EMBEDDING_DIM; d += 1) sum += caseVector[d] * patentVectors[j * EMBEDDING_DIM + d];
      return { patent, sum };
    });
    scored.sort((a, b) => b.sum - a.sum);
    console.log(`\n[${item.id}] ${item.tech.slice(0, 40)}…`);
    for (const { patent, sum } of scored.slice(0, TOP_K)) {
      console.log(`  ${sum.toFixed(3)}  ${patent.id}  ${patent.title.slice(0, 70)}`);
    }
  });
  console.log(`\n사례 ${DISPUTE_CASES.length}건 임베딩 완료 → data/master/cases/vectors.f32 (${EMBEDDING_MODEL}, ${EMBEDDING_DIM}차원)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
