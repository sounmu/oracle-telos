// 서버 전용. TELOS_MOCK_API=1로 띄운 개발 서버에서만 쓰인다.
// KIPRIS·OpenAI·외부 임베딩 호출 없이 로컬 샘플 데이터로 가짜 응답을 만들어 UI만 확인할 수 있게 한다.
import { getPatentIndex, toHit } from "./patents";
import type { AgentEvent, Decision, PatentComparison, SearchHit } from "./types";

export const MOCK_NOTICE = "목업 모드: 실제 KIPRIS·OpenAI 호출 없이 가짜 결과를 표시합니다.";

export function mockEnabled(): boolean {
  return process.env.TELOS_MOCK_API === "1";
}

/** 로컬 샘플 특허에서 앞쪽 k건을 가짜 유사도와 함께 돌려준다 */
export async function mockSearchHits(k: number, decision?: Decision): Promise<SearchHit[]> {
  const index = await getPatentIndex();
  if (!index) return [];
  return index.patents
    .filter((patent) => (decision ? patent.decision === decision : true))
    .slice(0, k)
    .map((patent, i) => toHit(patent, Math.max(0.3, 0.9 - i * 0.05)));
}

/** 에이전트 SSE 이벤트 순서를 흉내 낸다. 텍스트는 고정 문장을 조각내 보낸다 */
export async function mockAgentEvents(): Promise<AgentEvent[]> {
  const hits = await mockSearchHits(3);
  const text = "목업 응답입니다. 아이디어를 기술 요소로 나눠 가짜 검색을 했고, 상위 특허 세 건을 가져왔다고 가정합니다. 실제 비교 판단은 OpenAI 키를 넣은 실서버에서 확인하세요.";
  const deltas: AgentEvent[] = [];
  for (let i = 0; i < text.length; i += 18) deltas.push({ type: "text", delta: text.slice(i, i + 18) });
  return [
    { type: "status", message: MOCK_NOTICE },
    { type: "tool", name: "search_patents", input: { query: "목업 키워드" } },
    { type: "matches", query: "목업 키워드", hits, warnings: [MOCK_NOTICE] },
    ...deltas,
    { type: "done" },
  ];
}

/** 기술 요소별 비교 목업. 행 세 개와 근접도 하나를 고정으로 돌려준다 */
export function mockComparison(patentId: string): PatentComparison {
  return {
    patentId,
    summary: `${MOCK_NOTICE} 관련 이유 예시입니다.`,
    rows: [
      { element: "목업 요소 A", mine: "입력 설명의 가짜 내용", theirs: "특허 원문의 가짜 내용", relation: "common", note: "공통점 예시", evidence: "가짜 인용 문장" },
      { element: "목업 요소 B", mine: null, theirs: "특허 원문의 가짜 내용", relation: "unconfirmed", note: "입력에 없어 추가 확인 필요", evidence: null },
      { element: "목업 요소 C", mine: "입력 설명의 가짜 내용", theirs: "다른 가짜 내용", relation: "different", note: "차이점 예시", evidence: "가짜 인용 문장" },
    ],
    proximity: { level: "warm", reason: "목업 근접도 예시", commonElements: ["목업 요소 A"] },
    claimsReviewed: 1,
    claimsTotal: 1,
    sourceUrl: "https://example.invalid/mock",
  };
}
