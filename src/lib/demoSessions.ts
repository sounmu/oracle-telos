// 클라이언트 전용. 발표 시연용 세션 3개. 페이지에 들어올 때마다 입력 단계 상태로 다시 심는다.
import type { Session, Template } from "./sessions";

interface DemoItem {
  id: string;
  name: string;
  idea: string;
  /** '템플릿으로 바꾸기'를 눌렀을 때 채워질 값. 규칙 기반 추출 대신 미리 정한 값을 쓴다 */
  tech: string;
  target: string;
  risk: string;
}

const DEMO_ITEMS: readonly DemoItem[] = [
  {
    id: "demo-filler",
    name: "세션 1 · 의료용 필러",
    idea: "피부과에서 쓰는 성형용 필러를 PDLLA 미세입자로 만들고 싶어요. 고분자를 에틸렌 카보네이트에 녹인 뒤 차가운 용액에 분사해 얼리는 냉동 분사 공법으로 입자를 만들 계획인데, 이미 비슷한 제조 방법 특허가 있는지 궁금해요.",
    tech: "PDLLA 미세입자, 에틸렌 카보네이트, 냉동 분사",
    target: "피부과",
    risk: "제조공법",
  },
  {
    id: "demo-separator",
    name: "세션 2 · 이차전지 분리막",
    idea: "전기차 배터리 회사에 납품할 분리막을 개발하려고 해요. 폴리에틸렌 다공성 막 위에 세라믹 무기물 입자와 바인더를 섞어 코팅해서 고온에서도 열수축이 적고 전극과 잘 붙게 만드는 방식인데, 이런 코팅 분리막에서 특허 분쟁 위험이 어디에 있는지 알고 싶어요.",
    tech: "분리막, 무기물 입자, 바인더",
    target: "전기차 배터리 회사",
    risk: "코팅 소재·공정",
  },
  {
    id: "demo-oled",
    name: "세션 3 · OLED 화소 배열",
    idea: "스마트폰 제조사에 공급할 OLED 패널, 그러니까 유기 발광 표시 장치의 화소 배열을 새로 설계하고 있어요. 녹색 서브 화소를 가상의 사각형 중심에 두고 빨강과 파랑 서브 화소를 꼭짓점에 배치해서 해상도를 높이는 구조인데, 기존 화소 배열 특허와 얼마나 겹치는지 확인하고 싶어요.",
    tech: "OLED, 화소 배열, 녹색 서브 화소",
    target: "스마트폰 제조사",
    risk: "화소 배열 구조",
  },
];

const DEMO_IDS = new Set(DEMO_ITEMS.map((d) => d.id));

/** 시연 세션은 항상 입력 단계에서 시작한다. 템플릿은 아이템 칸만 채워 두고 나머지는 버튼으로 채운다 */
export function demoSessions(): Session[] {
  // createdAt은 목록 순서(세션 1이 맨 위)만 정한다. 새로 만든 세션은 Date.now()이므로 늘 시연 세션 위에 온다
  return DEMO_ITEMS.map((d, i) => ({
    id: d.id,
    name: d.name,
    idea: d.idea,
    tpl: { item: d.idea, tech: "", target: "", risk: "" },
    step: 0,
    createdAt: DEMO_ITEMS.length - i,
    results: null,
    location: null,
  }));
}

/** 저장된 목록에서 시연 세션을 빼고 처음 상태의 시연 세션을 다시 넣는다. 사용자가 만든 세션은 그대로 둔다 */
export function seedDemoSessions(stored: readonly Session[]): Session[] {
  return [...stored.filter((s) => !DEMO_IDS.has(s.id)), ...demoSessions()];
}

/** 입력 문장이 시연 문장과 같으면 미리 정한 템플릿을 돌려준다. 아니면 null */
export function demoTemplate(text: string): Template | null {
  const key = normalize(text);
  const hit = DEMO_ITEMS.find((d) => normalize(d.idea) === key);
  return hit ? { item: hit.idea, tech: hit.tech, target: hit.target, risk: hit.risk } : null;
}

function normalize(s: string): string {
  return s.normalize("NFKC").replace(/\s+/g, " ").trim();
}
