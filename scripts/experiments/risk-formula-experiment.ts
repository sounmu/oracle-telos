/**
 * 분쟁 위험도 계산식 비교 실험 (30조건). 외부 호출 없음.
 *
 *   pnpm exec tsx scripts/experiments/risk-formula-experiment.ts
 *
 * 입력: public/data/sample/embedding.json(좌표·제목·초록), src/lib/cases.ts(분쟁 사례 24건)
 * 출력: docs/research/risk-experiment-report.html (정적 보고서, 한 파일)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { DISPUTE_CASES } from "../../src/lib/cases";

const ROOT = process.cwd();
const W = 640;
const H = 520;
const PAD = 40;
const MAIN_GRID = 24;
const SENS_GRIDS = [12, 24, 48];
const RADII = [24, 48, 96];
const KS = [2, 3];
const FORMULAS = ["F1", "F2", "F3", "F4", "F5"] as const;
type Formula = (typeof FORMULAS)[number];
const FORMULA_LABEL: Record<Formula, string> = {
  F1: "밀집도만",
  F2: "사례 도달도만",
  F3: "현재 식 (밀집도 × (0.3+0.7·도달도))",
  F4: "곱, 가중 0.5+0.5·도달도",
  F5: "가중합 (0.5·밀집도 + 0.5·도달도)",
};
const FORMULA_COLOR: Record<Formula, string> = {
  F1: "#7F77DD", F2: "#1D9E75", F3: "#D85A30", F4: "#378ADD", F5: "#BA7517",
};
const BOOT_B = 20;
const TOP_SHARE = 0.1;
const COVER_LEVEL = 0.2;
const COVER_RANGE: [number, number] = [0.05, 0.4];

interface PointRow { title: string; abstract: string; x: number; y: number }
interface Condition { formula: Formula; radius: number; k: number; grid: number }
interface Result extends Condition {
  loco: number;
  stability: number;
  coverage: number;
  valid: boolean;
  avgRank?: number;
}

function formulaValue(f: Formula, dn: number, rn: number): number {
  switch (f) {
    case "F1": return dn;
    case "F2": return rn;
    case "F3": return dn * (0.3 + 0.7 * rn);
    case "F4": return dn * (0.5 + 0.5 * rn);
    case "F5": return 0.5 * dn + 0.5 * rn;
  }
}

// riskField.ts와 같은 키워드 규칙 (영문 단어 경계, 한글 부분 문자열)
function matcher(keyword: string): (text: string) => boolean {
  if (/^[ -~]+$/.test(keyword)) {
    const re = new RegExp(`(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`);
    return (text) => re.test(text);
  }
  return (text) => text.includes(keyword);
}

function linkedPoints(texts: string[], k: number): number[][] {
  return DISPUTE_CASES.map((item) => {
    const keys = [...new Set(item.keywords.map((kw) => kw.trim().toLowerCase()).filter((kw) => kw.length >= 2))];
    if (keys.length < k) return [];
    const tests = keys.map(matcher);
    const hits: number[] = [];
    texts.forEach((text, i) => {
      let shared = 0;
      for (const test of tests) if (test(text)) shared += 1;
      if (shared >= k) hits.push(i);
    });
    return hits;
  });
}

function project(points: PointRow[]): { bx: Float64Array; by: Float64Array } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;
  const bx = new Float64Array(points.length);
  const by = new Float64Array(points.length);
  points.forEach((p, i) => {
    bx[i] = offX + (p.x - minX) * scale;
    by[i] = offY + (maxY - p.y) * scale;
  });
  return { bx, by };
}

// 실험 한 세트 (격자 크기 하나에 대해 30조건 전부)
function runGrid(grid: number, points: PointRow[], texts: string[], geo: { bx: Float64Array; by: Float64Array }) {
  const cols = Math.ceil(W / grid);
  const rows = Math.ceil(H / grid);
  const C = cols * rows;
  const cx = new Float64Array(C);
  const cy = new Float64Array(C);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    cx[r * cols + c] = (c + 0.5) * grid;
    cy[r * cols + c] = (r + 0.5) * grid;
  }
  const N = points.length;
  const cellOf = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const c = Math.min(cols - 1, Math.max(0, Math.floor(geo.bx[i] / grid)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor(geo.by[i] / grid)));
    cellOf[i] = r * cols + c;
  }

  const out: Result[] = [];
  for (const k of KS) {
    const hits = linkedPoints(texts, k);
    const linked = hits.map((h, j) => ({ j, pts: h })).filter((x) => x.pts.length > 0);
    const J = linked.length || 1;
    for (const radius of RADII) {
      // 셀마다 반경 안의 점
      const nb: number[][] = Array.from({ length: C }, () => []);
      const r2 = radius * radius;
      for (let c = 0; c < C; c++) for (let i = 0; i < N; i++) {
        const dx = geo.bx[i] - cx[c], dy = geo.by[i] - cy[c];
        if (dx * dx + dy * dy <= r2) nb[c].push(i);
      }
      // 셀 x 사례 도달 여부
      const reachFor = (mask: Uint8Array | null, maskHits: (number[] | null)[]) => {
        const reach: Uint8Array[] = [];
        for (let c = 0; c < C; c++) {
          const row = new Uint8Array(hits.length);
          for (let j = 0; j < hits.length; j++) {
            const h = maskHits[j];
            if (!h || h.length === 0) continue;
            const set = new Set(h);
            for (const p of nb[c]) {
              if (set.has(p) && (!mask || mask[p])) { row[j] = 1; break; }
            }
          }
          reach.push(row);
        }
        return reach;
      };
      const fullReach = reachFor(null, hits);
      const dens = nb.map((l) => l.length);
      const reachCnt = fullReach.map((row) => row.reduce((a, b) => a + b, 0));

      const valuesOf = (f: Formula, d: number[], rc: number[]) => {
        const maxd = Math.max(1, ...d);
        return Float64Array.from(d.map((dv, c) => formulaValue(f, dv / maxd, rc[c] / J)));
      };
      const midPercentile = (vals: Float64Array, s: number) => {
        let less = 0, eq = 0;
        for (const v of vals) { if (v < s) less++; else if (v === s) eq++; }
        return (less + 0.5 * eq) / vals.length;
      };
      const topSet = (vals: Float64Array) => {
        const idx = Array.from(vals.keys()).sort((a, b) => vals[b] - vals[a] || a - b);
        return new Set(idx.slice(0, Math.ceil(TOP_SHARE * C)));
      };

      // 부트스트랩 마스크 (고정 시드)
      let seed = 42;
      const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const masks: Uint8Array[] = Array.from({ length: BOOT_B }, () => {
        const m = new Uint8Array(N);
        for (let i = 0; i < N; i++) m[i] = rand() < 0.8 ? 1 : 0;
        return m;
      });

      for (const f of FORMULAS) {
        const full = valuesOf(f, dens, reachCnt);
        const fullTop = topSet(full);

        // 예측 타당성: 사례 하나를 빼고, 그 사례의 점이 놓인 셀의 백분위 평균
        const perCase: number[] = [];
        for (const { j, pts } of linked) {
          const rcMinus = reachCnt.map((rc, c) => rc - fullReach[c][j]);
          const vals = valuesOf(f, dens, rcMinus);
          const scores = pts.map((p) => midPercentile(vals, vals[cellOf[p]]));
          perCase.push(scores.reduce((a, b) => a + b, 0) / scores.length);
        }
        const loco = perCase.length ? perCase.reduce((a, b) => a + b, 0) / perCase.length : NaN;

        // 안정성: 특허 80%씩 뽑아 상위 10% 셀의 Jaccard 평균
        let jacc = 0;
        for (const m of masks) {
          const d = nb.map((l) => l.reduce((a, p) => a + m[p], 0));
          const maskedHits = hits.map((h) => (h.length ? h.filter((p) => m[p]) : null));
          const rc = reachFor(m, maskedHits).map((row) => row.reduce((a, b) => a + b, 0));
          const top = topSet(valuesOf(f, d, rc));
          let inter = 0;
          for (const c of top) if (fullTop.has(c)) inter++;
          jacc += inter / (top.size + fullTop.size - inter);
        }
        const stability = jacc / BOOT_B;

        // 표시 범위: 값이 COVER_LEVEL 이상인 셀의 비율
        const coverage = full.filter((v) => v >= COVER_LEVEL).length / C;
        const valid = coverage >= COVER_RANGE[0] && coverage <= COVER_RANGE[1];
        out.push({ formula: f, radius, k, grid, loco, stability, coverage, valid });
      }
    }
  }
  return { out, cols, rows, C };
}

function rankValid(results: Result[]): Result[] {
  const valid = results.filter((r) => r.valid);
  const byLoco = [...valid].sort((a, b) => b.loco - a.loco);
  const byStab = [...valid].sort((a, b) => b.stability - a.stability);
  for (const r of valid) {
    const rl = byLoco.indexOf(r) + 1;
    const rs = byStab.indexOf(r) + 1;
    r.avgRank = (rl + rs) / 2;
  }
  return results;
}

function renderMap(
  values: Float64Array, cols: number, rows: number, grid: number, size: number,
): string {
  const rects: string[] = [];
  values.forEach((v, c) => {
    if (v < 0.02) return;
    const x = (c % cols) * grid, y = Math.floor(c / cols) * grid;
    rects.push(`<rect x="${x}" y="${y}" width="${grid}" height="${grid}" fill="#f04452" fill-opacity="${(0.85 * v).toFixed(3)}"/>`);
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="${size}" role="img"><rect width="${W}" height="${H}" fill="#f7f8fa"/>${rects.join("")}</svg>`;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3) : "–";
}

function scatterSvg(results: Result[]): string {
  const pad = 60, w = 620, h = 380;
  const xs = results.map((r) => r.loco), ys = results.map((r) => r.stability);
  const x0 = Math.min(...xs) - 0.02, x1 = Math.max(...xs) + 0.02;
  const y0 = Math.min(...ys) - 0.02, y1 = Math.max(...ys) + 0.02;
  const sx = (v: number) => pad + ((v - x0) / (x1 - x0)) * (w - pad * 2);
  const sy = (v: number) => h - pad - ((v - y0) / (y1 - y0)) * (h - pad * 2);
  const dots = results.map((r) => {
    const label = `${r.formula}·R${r.radius}·K${r.k}`;
    return `<circle cx="${sx(r.loco).toFixed(1)}" cy="${sy(r.stability).toFixed(1)}" r="${r.valid ? 6 : 4}" fill="${FORMULA_COLOR[r.formula]}" fill-opacity="${r.valid ? 0.9 : 0.25}"><title>${label} 예측 ${fmt(r.loco)} 안정 ${fmt(r.stability)} 범위 ${fmt(r.coverage)}</title></circle>`;
  }).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="예측 타당성과 안정성의 산점도"><title>예측 타당성 대 안정성</title><line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#888"/><line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h - pad}" stroke="#888"/><text x="${w / 2}" y="${h - 14}" text-anchor="middle" font-size="13">예측 타당성 (높을수록 좋음)</text><text x="16" y="${h / 2}" font-size="13" transform="rotate(-90 16 ${h / 2})" text-anchor="middle">안정성 (높을수록 좋음)</text>${dots}</svg>`;
}

async function main() {
  const points = JSON.parse(await fs.readFile(path.join(ROOT, "public/data/sample/embedding.json"), "utf8")) as PointRow[];
  const texts = points.map((p) => `${p.title} ${p.abstract}`.toLowerCase());
  const geo = project(points);

  const main = runGrid(MAIN_GRID, points, texts, geo);
  const mainResults = rankValid(main.out);
  const sorted = [...mainResults].sort((a, b) => {
    if (a.valid !== b.valid) return a.valid ? -1 : 1;
    return (a.avgRank ?? Infinity) - (b.avgRank ?? Infinity);
  });

  // 민감도: 현재 식(F3), 반경 48, K=2에서 격자 크기만 바꿈
  const sensitivity: Result[] = [];
  for (const grid of SENS_GRIDS) {
    const g = grid === MAIN_GRID ? main : runGrid(grid, points, texts, geo);
    const row = g.out.find((r) => r.formula === "F3" && r.radius === 48 && r.k === 2);
    if (row) sensitivity.push(row);
  }

  const linkedCount = (k: number) => linkedPoints(texts, k).filter((h) => h.length > 0).length;
  const summary = {
    points: points.length,
    cases: DISPUTE_CASES.length,
    linkedK2: linkedCount(2),
    linkedK3: linkedCount(3),
    grid: MAIN_GRID,
    cells: main.C,
  };

  const inconclusive = !Number.isFinite(mainResults[0]?.loco) || summary.linkedK2 === 0;
  // 지도 비교: K=2, 세 반경 × 다섯 계산식
  const dims = { cols: main.cols, rows: main.rows, grid: MAIN_GRID };
  const maps: string[] = [];
  for (const radius of RADII) {
    for (const f of FORMULAS) {
      const r = mainResults.find((x) => x.formula === f && x.radius === radius && x.k === 2);
      // 셀 값 재계산 (보고서용)
      const nb = Array.from({ length: main.C }, () => [] as number[]);
      const cx = (c: number) => ((c % dims.cols) + 0.5) * MAIN_GRID;
      const cy = (c: number) => (Math.floor(c / dims.cols) + 0.5) * MAIN_GRID;
      for (let c = 0; c < main.C; c++) for (let i = 0; i < points.length; i++) {
        const dx = geo.bx[i] - cx(c), dy = geo.by[i] - cy(c);
        if (dx * dx + dy * dy <= radius * radius) nb[c].push(i);
      }
      const d = nb.map((l) => l.length);
      const maxd = Math.max(1, ...d);
      const hitsK2 = linkedPoints(texts, 2);
      const J = hitsK2.filter((h) => h.length > 0).length || 1;
      const rc = nb.map((l) => {
        let n = 0;
        hitsK2.forEach((h) => { if (h.length && h.some((p) => l.includes(p))) n++; });
        return n;
      });
      const vals = Float64Array.from(d.map((dv, c) => formulaValue(f, dv / maxd, rc[c] / J)));
      maps.push(`<figure><figcaption>${f} · R${radius}${r ? ` · 순위 ${sorted.indexOf(r) + 1}` : ""}</figcaption>${renderMap(vals, dims.cols, dims.rows, MAIN_GRID, 200)}</figure>`);
    }
  }

  const rowsHtml = sorted.map((r, i) => `<tr class="${r.valid ? "" : "muted"}"><td>${r.valid ? i + 1 : "–"}</td><td><span class="dot" style="background:${FORMULA_COLOR[r.formula]}"></span>${r.formula} ${FORMULA_LABEL[r.formula]}</td><td>${r.radius}</td><td>${r.k}</td><td>${fmt(r.loco)}</td><td>${fmt(r.stability)}</td><td>${fmt(r.coverage)}</td><td>${inconclusive ? "판단 보류" : r.valid ? (r.avgRank ?? "–").toString() : "제외 (표시 범위)"}</td></tr>`).join("");
  const sensHtml = sensitivity.map((r) => `<tr><td>${r.grid}px</td><td>${fmt(r.loco)}</td><td>${fmt(r.stability)}</td><td>${fmt(r.coverage)}</td></tr>`).join("");

  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>분쟁 위험도 계산식 실험</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#191f28;--muted:#6b7684;--line:#e5e8eb;--panel:#f7f8fa}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#17191c;--fg:#e8eaed;--muted:#9aa0a6;--line:#2c2f33;--panel:#202327}}
:root[data-theme="dark"]{--bg:#17191c;--fg:#e8eaed;--muted:#9aa0a6;--line:#2c2f33;--panel:#202327}
body{margin:0;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;line-height:1.6}
main{max-width:980px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:24px;margin:0 0 8px} h2{font-size:18px;margin:32px 0 8px} p,li{font-size:15px}
.muted{color:var(--muted)} table{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0}
th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
th{color:var(--muted);font-weight:500} tr.muted td{color:var(--muted)}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
figure{margin:0;background:var(--panel);border-radius:12px;padding:8px} figcaption{font-size:13px;color:var(--muted);margin-bottom:6px}
.box{background:var(--panel);border-radius:12px;padding:12px 16px}
</style></head>
<body><main>
<h1>분쟁 위험도 계산식 실험</h1>
<p class="muted">외부 호출 없이 로컬 데이터로 계산. 생성: ${new Date().toISOString().slice(0, 10)}</p>

${inconclusive ? `<div class="box" style="border:1px solid #d22030"><b>판단 보류.</b> 분쟁 사례 ${summary.cases}건 중 샘플 특허와 키워드가 연결된 사례가 없어서, 예측 타당성을 계산할 수 없습니다. 아래 순위와 예측 타당성 값은 의미가 없습니다. 사례가 연결되는 데이터(한국 색인 또는 전체 HUPD 명세)로 다시 돌려야 합니다.</div>` : ""}
<h2>요약</h2>
<div class="box"><ul>
<li>데이터: 미국 샘플 특허 ${summary.points.toLocaleString()}건, 분쟁 사례 ${summary.cases}건</li>
<li>사례와 연결된 특허가 있는 사례: 키워드 2개 이상 기준 ${summary.linkedK2}건, 3개 이상 기준 ${summary.linkedK3}건</li>
<li>격자 ${summary.grid}px, 셀 ${summary.cells.toLocaleString()}개. 조건 30개(계산식 5 × 반경 3 × 키워드 기준 2)</li>
<li>선택 규칙: 표시 범위 5~40% 조건만 남기고, 예측 타당성과 안정성 순위 평균이 가장 좋은 조건을 고름</li>
</ul></div>

<h2>지표 정의</h2>
<ul>
<li><b>예측 타당성</b>: 사례 하나를 빼고 계산한 위험도에서, 그 사례와 연결된 특허 위치의 백분위 평균. 0.5가 무작위 수준이고 1에 가까울수록 주변 정보로 사례를 잘 맞힌다는 뜻.</li>
<li><b>안정성</b>: 특허를 80%씩 ${BOOT_B}회 뽑아 상위 10% 셀을 다시 구하고, 전체 데이터의 상위 10%와 비교한 Jaccard 평균.</li>
<li><b>표시 범위</b>: 위험도 값이 ${COVER_LEVEL} 이상인 셀의 비율. 상위 10%처럼 고정 비율로 정하면 항상 같아서 값의 절대 수준으로 정의함.</li>
</ul>

<h2>조건별 결과</h2>
<table><thead><tr><th>순위</th><th>계산식</th><th>반경(px)</th><th>키워드 기준</th><th>예측 타당성</th><th>안정성</th><th>표시 범위</th><th>순위 평균</th></tr></thead>
<tbody>${rowsHtml}</tbody></table>

<h2>예측 타당성 대 안정성</h2>
<div class="box">${scatterSvg(mainResults)}</div>
<p class="muted">흐린 점은 표시 범위 기준에서 제외된 조건.</p>

<h2>지도 비교 (키워드 2개 이상)</h2>
<p class="muted">붉은 농도가 높을수록 위험도 값이 높은 셀. 반경이 커질수록 주변 영향이 넓게 퍼진다.</p>
<div class="grid">${maps.join("")}</div>

<h2>민감도: 격자 크기 (현재 식 F3, 반경 48, 키워드 2개)</h2>
<table><thead><tr><th>격자</th><th>예측 타당성</th><th>안정성</th><th>표시 범위</th></tr></thead><tbody>${sensHtml}</tbody></table>

<h2>전문가 일치 (아직 실행하지 않음)</h2>
<div class="box"><p>영역 20곳을 두 명이 블라인드로 평가해야 합니다. 이 실험 결과 파일에는 포함되어 있지 않습니다. 평가 결과가 있으면 계산 순위와 Spearman 상관으로 이 표에 추가합니다.</p></div>

<h2>한계</h2>
<ul>
<li>분쟁 사례 ${summary.cases}건은 바이오·의료 분야이고, 샘플 특허는 2016년 미국 무작위 표본이라 분야가 맞지 않습니다.</li>
<li>사례 연결 키워드를 위험도 계산과 평가에 같이 씁니다. 순환이 생기므로, 키워드를 바꾼 버전으로 한 번 더 확인해야 합니다.</li>
<li>예측 타당성은 사례 24건을 근거로 하므로 표본이 작아 순위 차이가 우연일 수 있습니다.</li>
</ul>
</main></body></html>`;

  const outPath = path.join(ROOT, "docs/research/risk-experiment-report.html");
  await fs.writeFile(outPath, html);
  console.log(`보고서 저장: ${path.relative(ROOT, outPath)} (조건 ${mainResults.length}개, 유효 ${mainResults.filter((r) => r.valid).length}개)`);
  const top = sorted.filter((r) => r.valid).slice(0, 3);
  for (const r of top) console.log(`  ${r.formula} R${r.radius} K${r.k}: 예측 ${fmt(r.loco)}, 안정 ${fmt(r.stability)}, 범위 ${fmt(r.coverage)}, 순위평균 ${r.avgRank}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
