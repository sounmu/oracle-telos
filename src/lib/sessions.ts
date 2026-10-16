// 클라이언트 전용. 대화 세션(대시보드에 쌓이는 기능 사용 기록)의 모델과 저장.
import { FEATURE_BY_ID, type FeatureId } from "./features";
import { PHASES, type Phase } from "./phaseFeatures";
import { DEFAULT_VIEW, type SessionView } from "./view";

export interface Session {
  id: string;
  feature: FeatureId;
  phase: Phase;
  /** 세션을 열 때 입력한 아이디어 (없을 수 있다) */
  idea: string;
  title: string;
  createdAt: number;
  /** 이 세션이 마스터 DB를 보는 조건 (필터·정렬·개수) */
  view: SessionView;
}

export const SESSION_KEY = "telos.sessions.v1";

export function makeSession(
  feature: FeatureId,
  idea: string,
  now: number,
  id: string,
  view: SessionView = DEFAULT_VIEW,
): Session {
  const def = FEATURE_BY_ID[feature];
  const trimmed = idea.trim();
  return {
    id,
    feature,
    phase: def.phase,
    idea: trimmed,
    title: trimmed ? `${def.label} · ${trimmed.slice(0, 24)}` : def.label,
    createdAt: now,
    view,
  };
}

/** 단계별로 묶고, 각 묶음은 최신 세션이 위로 오게 정렬한다 */
export function groupByPhase(sessions: readonly Session[]): { phase: Phase; label: string; items: Session[] }[] {
  return PHASES.map((p) => ({
    phase: p.id,
    label: p.label,
    items: sessions.filter((s) => s.phase === p.id).sort((a, b) => b.createdAt - a.createdAt),
  }));
}

/** 저장된 값을 검증해서 읽는다. 깨진 값은 버린다 */
export function parseSessions(raw: string | null): Session[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    // 조회 조건이 없던 예전 세션은 기본 조회로 채운다
    return data.filter(isSession).map((s) => ({ ...s, phase: FEATURE_BY_ID[s.feature].phase, view: s.view ?? DEFAULT_VIEW }));
  } catch {
    return [];
  }
}

function isSession(v: unknown): v is Session {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.feature === "string" &&
    s.feature in FEATURE_BY_ID &&
    typeof s.phase === "string" &&
    typeof s.idea === "string" &&
    typeof s.title === "string" &&
    typeof s.createdAt === "number"
  );
}

/** 저장소를 쓸 수 없는 환경(비공개 창 등)에서도 화면은 동작해야 하므로 실패는 조용히 넘긴다 */
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
