// 클라이언트 전용. 세션 = 사업 아이템 하나. 입력 → 탐색 → 검증 → 요약 4단계로 진행한다.
import { queryOf } from "./explore";

export const SESSION_KEY = "telos.sessions.v2";
export const STEP_LABELS = ["입력", "탐색", "검증", "요약"] as const;
export type StepIndex = 0 | 1 | 2 | 3;

/** 입력을 나눈 템플릿. 탐색의 검색 조건이 된다 */
export interface Template {
  item: string;
  tech: string;
  target: string;
  risk: string;
}

export interface Session {
  id: string;
  name: string;
  /** 처음 입력한 아이디어 원문 */
  idea: string;
  /** 템플릿은 입력 단계에서 확정된다. 없으면 아직 입력 전 */
  tpl: Template | null;
  step: StepIndex;
  createdAt: number;
  /** 탐색 조회 결과. 템플릿을 다시 확정하면 비운다. 저장해야 하므로 Map 대신 Record */
  results: SessionResults | null;
  /** 지도 위 내 아이템 추정 위치 */
  location: { x: number; y: number } | null;
}

export interface SessionResults {
  ids: string[];
  scores: Record<string, number>;
  query: string;
  at: number;
}

/** 입력 문장으로 새 세션을 만든다. 템플릿은 문장을 아이템 칸에 넣은 상태로 시작한다 */
export function makeSession(text: string, now: number, id: string): Session {
  const idea = text.trim();
  return {
    id,
    name: idea ? idea.slice(0, 18) : "새 아이템",
    idea,
    tpl: idea ? { item: idea, tech: "", target: "", risk: "" } : null,
    step: 0,
    createdAt: now,
    results: null,
    location: null,
  };
}

/** 조회·위치 계산·비교에 똑같이 쓰는 기술 설명. 템플릿이 확정됐으면 네 칸을 합치고, 아니면 입력 원문 */
export function describeSession(session: Pick<Session, "idea" | "tpl">): string {
  return session.tpl ? queryOf(session.tpl) : session.idea.trim();
}

/** 최신 세션이 위로 오게 정렬 */
export function sortSessions(sessions: readonly Session[]): Session[] {
  return [...sessions].sort((a, b) => b.createdAt - a.createdAt);
}

/** 저장된 값을 검증해서 읽는다. 깨진 항목은 버린다 */
export function parseSessions(raw: string | null): Session[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    // results·location이 없던 예전 데이터는 null로 채워 읽는다
    return data
      .map((v: unknown) => (typeof v === "object" && v !== null ? { results: null, location: null, ...v } : v))
      .filter(isSession);
  } catch {
    return [];
  }
}

function isSession(v: unknown): v is Session {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    typeof s.idea === "string" &&
    typeof s.step === "number" &&
    s.step >= 0 &&
    s.step <= 3 &&
    typeof s.createdAt === "number" &&
    (s.tpl === null || isTemplate(s.tpl)) &&
    (s.results === null || isResults(s.results)) &&
    (s.location === null || isXY(s.location))
  );
}

function isResults(v: unknown): v is SessionResults {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    Array.isArray(r.ids) &&
    r.ids.every((id) => typeof id === "string") &&
    typeof r.scores === "object" &&
    r.scores !== null &&
    Object.values(r.scores).every((n) => typeof n === "number") &&
    typeof r.query === "string" &&
    typeof r.at === "number"
  );
}

function isXY(v: unknown): v is { x: number; y: number } {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return typeof p.x === "number" && typeof p.y === "number";
}

function isTemplate(v: unknown): v is Template {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  return typeof t.item === "string" && typeof t.tech === "string" && typeof t.target === "string" && typeof t.risk === "string";
}

/** 저장소를 쓸 수 없는 환경에서도 화면은 동작해야 하므로 실패는 조용히 넘긴다 */
export function loadSessions(): Session[] {
  try {
    return parseSessions(window.localStorage.getItem(SESSION_KEY));
  } catch {
    return [];
  }
}

export function saveSessions(sessions: readonly Session[]): void {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
  } catch {
    // 저장 실패는 세션 목록을 유지하지 못할 뿐 화면 동작에는 영향이 없다
  }
}
