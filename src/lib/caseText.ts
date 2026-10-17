import type { DisputeCase } from "./types";

/**
 * 분쟁 사례를 임베딩할 텍스트. 특허(제목 + 초록)와 같은 기술 언어 공간에 놓이도록
 * 기술 쟁점 한 줄과 검색어만 쓴다. 원고·절차·판결 같은 법적 서사는 넣지 않는다.
 */
export function caseEmbeddingText(item: DisputeCase): string {
  return `${item.tech}\n${item.keywords.join(", ")}`;
}
