// 서버/스크립트 전용. 클라이언트 컴포넌트에서 import 금지.
// 데이터 빌드 스크립트와 API 라우트가 반드시 같은 모델을 쓰도록 모델 이름은 여기 한 곳에만 둔다.
import path from "node:path";
import {
  env,
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";

export const EMBEDDING_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
export const EMBEDDING_DIM = 384;

// Vercel 함수는 /tmp 외에는 읽기 전용이라 콜드 스타트마다 모델(~135MB)을 /tmp 로 받는다.
env.cacheDir = process.env.VERCEL
  ? "/tmp/transformers"
  : path.join(process.cwd(), ".cache", "transformers");

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

export function getExtractor(): Promise<FeatureExtractionPipeline> {
  extractorPromise ??= pipeline("feature-extraction", EMBEDDING_MODEL, {
    dtype: "q8",
  });
  return extractorPromise;
}

/** 문장 임베딩 (mean pooling + L2 정규화). 코사인 유사도 = 내적. */
export async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  const rows = output.tolist() as number[][];
  return rows.map((row) => Float32Array.from(row));
}
