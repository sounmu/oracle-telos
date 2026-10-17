// 서버 전용. 검색창에 특허번호나 회사명을 넣었을 때의 조회.
import { getPatentIndex, toHit } from "./patents";
import { patentFromDocument, readResearchIndex } from "./korea/index";
import { topK } from "./similarity";
import type { PatentDataset, SearchHit } from "./types";

export interface LookupResult {
  hits: SearchHit[];
  warnings: string[];
}

/** 특허번호처럼 생긴 입력이면 숫자만 남긴 번호를 돌려준다. 미국 샘플 8자리, 한국 출원번호 10~13자리 */
export function parsePatentNumber(input: string): string | null {
  const compact = input.trim().replace(/[\s-]/g, "").replace(/^(US|KR)/i, "");
  return /^\d{8}$|^\d{10,13}$/.test(compact) ? compact : null;
}

const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

/** 특허번호로 한 건을 찾고, 샘플이면 그 특허와 가까운 특허 k건을 함께 돌려준다 */
export async function lookupByNumber(number: string, dataset: PatentDataset, k: number): Promise<LookupResult> {
  if (dataset === "sample") {
    const index = await getPatentIndex();
    if (!index) return { hits: [], warnings: ["샘플 색인이 없습니다."] };
    const i = index.indexById.get(number);
    if (i === undefined) return { hits: [], warnings: [`샘플 데이터에 ${number} 특허가 없습니다.`] };
    const dim = index.meta.dim;
    const self = toHit(index.patents[i], 1);
    const neighbors = topK(index.vectors.subarray(i * dim, (i + 1) * dim), index.vectors, dim, k + 1, (j) => j !== i)
      .slice(0, k)
      .map((s) => toHit(index.patents[s.index], s.score));
    return { hits: [self, ...neighbors], warnings: [] };
  }
  const index = await readResearchIndex();
  const document = index?.documents.find(
    (d) => d.source === "kipris" && d.patent.applicationNumber === number,
  );
  if (!index || !document || document.source !== "kipris") {
    return {
      hits: [],
      warnings: [`한국 색인에 ${number} 특허가 없습니다. 기술 설명으로 KIPRIS를 검색하면 색인에 추가됩니다.`],
    };
  }
  return { hits: [toHit(patentFromDocument(document, index), 1)], warnings: [] };
}

/** 회사명(출원인)으로 찾는다. 출원인 정보는 한국 색인에만 있다 */
export async function lookupByCompany(name: string, dataset: PatentDataset, k: number): Promise<LookupResult> {
  if (dataset === "sample") {
    return { hits: [], warnings: ["샘플 특허에는 출원인 정보가 없어 회사명으로 찾을 수 없습니다. 한국 데이터로 바꿔 검색하세요."] };
  }
  const index = await readResearchIndex();
  if (!index) return { hits: [], warnings: ["한국 색인이 없습니다."] };
  const target = normalize(name);
  if (!target) return { hits: [], warnings: [] };
  const matched = index.documents.filter(
    (d) => d.source === "kipris" && d.patent.applicants.some((a) => normalize(a).includes(target)),
  );
  if (matched.length === 0) return { hits: [], warnings: [`"${name}"이 출원인인 한국 특허가 색인에 없습니다.`] };
  const hits = matched.slice(0, k).map((d, i) => toHit(patentFromDocument(d as Parameters<typeof patentFromDocument>[0], index), 1 - i * 0.01));
  return { hits, warnings: matched.length > k ? [`${matched.length}건 중 ${k}건만 보여 줍니다.`] : [] };
}
