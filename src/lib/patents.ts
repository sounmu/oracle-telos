// 서버 전용. data/ 산출물을 프로세스당 1회 메모리에 올린다.
import fs from "node:fs/promises";
import path from "node:path";
import type { DatasetMeta, PatentFull, SearchHit } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

export interface PatentIndex {
  meta: DatasetMeta;
  patents: PatentFull[];
  byId: Map<string, PatentFull>;
  indexById: Map<string, number>;
  vectors: Float32Array; // N×dim
}

let cached: Promise<PatentIndex | null> | null = null;

/** 산출물이 없으면 null (앱은 크래시 대신 안내를 보여준다). */
export function getPatentIndex(): Promise<PatentIndex | null> {
  cached ??= load().catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}

async function load(): Promise<PatentIndex | null> {
  try {
    const [metaRaw, fullRaw, vecBuf] = await Promise.all([
      fs.readFile(path.join(DATA_DIR, "meta.json"), "utf8"),
      fs.readFile(path.join(DATA_DIR, "patents.full.json"), "utf8"),
      fs.readFile(path.join(DATA_DIR, "embeddings.f32")),
    ]);
    const meta = JSON.parse(metaRaw) as DatasetMeta;
    const patents = JSON.parse(fullRaw) as PatentFull[];
    const vectors = new Float32Array(
      vecBuf.buffer,
      vecBuf.byteOffset,
      vecBuf.byteLength / 4,
    );
    if (vectors.length !== patents.length * meta.dim) {
      throw new Error(
        `embeddings.f32 크기 불일치: ${vectors.length} != ${patents.length} × ${meta.dim}`,
      );
    }
    const byId = new Map<string, PatentFull>();
    const indexById = new Map<string, number>();
    patents.forEach((p, i) => {
      byId.set(p.id, p);
      indexById.set(p.id, i);
    });
    return { meta, patents, byId, indexById, vectors };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export function toHit(p: PatentFull, score: number): SearchHit {
  return {
    id: p.id,
    title: p.title,
    decision: p.decision,
    cpc: p.cpc,
    filed: p.filed,
    score,
    abstract: truncate(p.abstract, 400),
    ...(p.applicants?.length ? { applicant: p.applicants[0] } : {}),
  };
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

export const MISSING_DATA_MESSAGE =
  "특허 데이터가 아직 없습니다. 터미널에서 `pnpm build:data`를 실행하세요.";
