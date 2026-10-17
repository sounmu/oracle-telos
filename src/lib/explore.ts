// 클라이언트·서버 공용. 탐색·검증 화면의 리포트 계산 (순수 함수).
import type { PatentPoint } from "./types";

/** 입력 문장을 템플릿 칸으로 나눈다. 칸은 사용자가 고칠 수 있고 빈 칸은 조회에서 무시한다 */
export interface TemplateDraft {
  item: string;
  tech: string;
  target: string;
  risk: string;
}

const STOP = new Set([
  "그리고", "위한", "위해", "하는", "있는", "있다", "통해", "대한", "및", "또는", "하여", "으로", "에서", "이런", "이미", "비슷한", "기존", "얼마나",
  "싶어요", "싶은데", "하려고", "해요", "있는지", "궁금해요", "확인하고", "알고", "만들고", "만드는", "하는데", "인데", "새로", "있어요", "방식인데",
  "the", "and", "for", "with", "of", "a", "an", "to", "in", "on", "by", "or",
]);

/**
 * 핵심 기술로 먼저 고를 용어. 앞에 있을수록 우선이고, 고른 3개는 문장에 나온 순서로 보인다.
 * 같은 뜻의 긴 용어를 짧은 용어보다 앞에 둔다 ("PLA 미세입자" → "미세입자")
 */
const TECH_TERMS = [
  "PDLLA 미세입자", "PLA 미세입자", "냉동 분사", "에틸렌 카보네이트", "PDLLA", "PLLA", "PCL", "생분해성 고분자", "미세입자", "필러",
  "분리막", "무기물 입자", "바인더", "세라믹 코팅", "열수축", "다공성 막", "폴리에틸렌", "전극 접착",
  "OLED", "화소 배열", "녹색 서브 화소", "서브 화소", "가상의 사각형", "해상도",
  "영양제 디스펜서", "카트리지", "토출 로터", "맞춤형 영양제",
];
const PARTICLE = /(으로|에서|을|를|은|는|이|가|의|에|로|과|와)$/;
/** "만드는", "쓰는", "하려고"처럼 꾸미거나 이어 주는 용언은 기술 용어가 아니다 */
const VERB_FORM = /(하는|드는|되는|있는|쓰는|는데|려고|고 싶|싶어요|해요)$/;

/** 대상 고객을 직접 말하는 표현 ("~에 납품", "~에서 쓰는", "~를 위한") */
const TARGET_PATTERNS = [
  /([\p{L}\p{N} ]{2,30}?)(?:에|에게)\s*(?:납품|공급|판매|제공)/u,
  /([\p{L}\p{N} ]{2,30}?)에서\s*(?:쓰는|사용하는|쓸)/u,
  /([\p{L}\p{N} ]{2,30}?)(?:을|를)\s*(?:위한|위해)/u,
];
const TARGET_WORDS = ["환자", "피부과", "의사", "병원", "고객", "사용자", "소비자", "학생", "운전자", "농가", "제조사", "기업"];

/** 우려하는 분쟁 분야. 구체적인 단서를 먼저 본다 */
const RISK_HINTS: [string, string][] = [
  ["화소 배열", "화소 배열 구조"],
  ["화소", "화소 배열 구조"],
  ["코팅", "코팅 소재·공정"],
  ["분리막", "코팅 소재·공정"],
  ["공법", "제조공법"],
  ["제조", "제조공법"],
  ["공정", "제조공법"],
  ["디스펜서", "장치 구조"],
  ["장치", "장치 구조"],
  ["알고리즘", "소프트웨어"],
  ["조성물", "조성물"],
  ["방법", "제조공법"],
];

/** 대상 표현에서 마지막 세 어절만 남긴다 ("우리는 전기차 배터리 회사" → "전기차 배터리 회사") */
function lastWords(phrase: string, n = 3): string {
  return phrase.trim().split(/\s+/).slice(-n).join(" ");
}

function findTarget(text: string): string {
  for (const re of TARGET_PATTERNS) {
    const m = re.exec(text);
    if (m) return lastWords(m[1]);
  }
  return TARGET_WORDS.find((w) => text.includes(w)) ?? "";
}

function findTech(text: string, exclude: string[]): string {
  const lower = text.toLowerCase();
  const found = TECH_TERMS
    .map((term) => ({ term, at: lower.indexOf(term.toLowerCase()) }))
    .filter((t) => t.at >= 0);
  const picked: { term: string; at: number }[] = [];
  for (const t of found) {
    if (picked.length >= 3) break;
    // 이미 고른 더 긴 용어에 포함된 용어, 대상·분야와 같은 용어는 건너뛴다
    if (picked.some((p) => p.term.includes(t.term)) || exclude.some((e) => e && e.includes(t.term))) continue;
    picked.push(t);
  }
  if (picked.length < 3) {
    // 사전에 없는 문장: 자주 나온 낱말로 채운다
    const words = text
      .normalize("NFKC")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => !VERB_FORM.test(w))
      .map((w) => (w.length >= 3 ? w.replace(PARTICLE, "") : w))
      .filter((w) => w.length >= 2 && !STOP.has(w));
    const freq = new Map<string, number>();
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
    for (const [w] of [...freq].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)) {
      if (picked.length >= 3) break;
      if (picked.some((p) => p.term.toLowerCase().includes(w) || w.includes(p.term.toLowerCase()))) continue;
      if (exclude.some((e) => e && e.toLowerCase().includes(w))) continue;
      picked.push({ term: w, at: lower.indexOf(w) });
    }
  }
  return picked.sort((a, b) => a.at - b.at).map((p) => p.term).join(", ");
}

/** 입력 문장을 템플릿 초안으로 바꾼다 (규칙 기반). 자동으로 고른 값은 사용자가 확인한다 */
export function toTemplate(text: string): TemplateDraft {
  const item = text.trim();
  const target = findTarget(item);
  const risk = RISK_HINTS.find(([k]) => item.includes(k))?.[1] ?? "";
  const tech = findTech(item, [target]);
  return { item, tech, target, risk };
}

/** 조회에 쓸 검색어: 아이템, 핵심 기술, 대상, 우려 분야를 이어 붙인다 (비어 있는 칸은 건너뛴다) */
export function queryOf(tpl: TemplateDraft): string {
  return [tpl.item, tpl.tech, tpl.target, tpl.risk].map((s) => s.trim()).filter(Boolean).join(" ");
}

/** 출원 연도별 개수 (추세) */
export function yearTrend(points: readonly Pick<PatentPoint, "filed">[]): { year: number; count: number }[] {
  const m = new Map<number, number>();
  for (const p of points) {
    const y = Number(p.filed.slice(0, 4));
    if (Number.isFinite(y) && y > 1900) m.set(y, (m.get(y) ?? 0) + 1);
  }
  return [...m].map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year);
}

export interface DenseRegion {
  count: number;
  /** 이 영역에서 가장 많은 분야(하위 분류) */
  topCpc: string;
  /** 영역의 대표 특허 제목 */
  example: string;
  x: number;
  y: number;
}

/** 점이 많이 모인 격자 칸 n개 (2건 이상인 칸만) */
export function denseRegions(points: readonly Pick<PatentPoint, "id" | "title" | "cpc" | "x" | "y">[], n = 3, divisions = 6): DenseRegion[] {
  if (points.length < 2) return [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const cell = Math.max(maxX - minX, maxY - minY) / divisions || 1;
  const cells = new Map<string, typeof points[number][]>();
  for (const p of points) {
    const key = `${Math.floor((p.x - minX) / cell)}:${Math.floor((p.y - minY) / cell)}`;
    cells.set(key, [...(cells.get(key) ?? []), p]);
  }
  return [...cells.values()]
    .filter((g) => g.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, n)
    .map((g) => {
      const cpcCount = new Map<string, number>();
      for (const p of g) cpcCount.set(p.cpc.slice(0, 4), (cpcCount.get(p.cpc.slice(0, 4)) ?? 0) + 1);
      const topCpc = [...cpcCount].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      const cx = g.reduce((s, p) => s + p.x, 0) / g.length;
      const cy = g.reduce((s, p) => s + p.y, 0) / g.length;
      return { count: g.length, topCpc, example: g[0].title, x: cx, y: cy };
    });
}

/** 유사도 점수를 퍼센트 문구로 */
export function similarityText(score: number): string {
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
}
