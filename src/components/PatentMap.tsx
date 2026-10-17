"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { quadtree, type Quadtree } from "d3-quadtree";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import { ACTIVE_CASES } from "@/lib/cases";
import { DECISION_COLORS, DECISION_LABELS } from "@/lib/colors";
import { caseHits, riskField } from "@/lib/riskField";
import { citationEdges, citationPasses } from "@/lib/relations";
import type { Decision, PatentPoint } from "@/lib/types";

interface Props {
  points: PatentPoint[];
  visible: Set<Decision>;
  /** id → 유사도. null이면 하이라이트 없음 */
  highlights: Map<string, number> | null;
  selectedId: string | null;
  /** 바뀔 때마다 해당 점으로 카메라 이동 */
  focus: { id: string; nonce: number } | null;
  onSelect: (id: string | null) => void;
  /** 지도 위를 덮는 헤더·범례 높이(px). 점을 그 아래 영역에 맞춘다 */
  insetTop?: number;
  /** 분쟁 위험도 배경(밀집도 × 사례 수) 표시 */
  riskOn?: boolean;
  /** 같은 CPC 하위 분류끼리 잇는 관계선 표시 */
  edgesOn?: boolean;
  /** 내 아이디어의 위치 (데이터 좌표). null이면 표시하지 않음 */
  marker?: { x: number; y: number } | null;
  /** 밀집 영역 강조: 영역에 속한 점 전체와 그 중심 점. null이면 표시하지 않음 */
  group?: { ids: ReadonlySet<string>; centerId: string } | null;
}

interface Node {
  p: PatentPoint;
  bx: number; // 기본(줌 전) 캔버스 좌표
  by: number;
}

const PAD = 48;

// 배경 격자: Figma·tldraw처럼 줌을 따라 움직이고, 화면상 간격이 일정 범위에 머물도록
// 2배 단위로 단계를 바꾼다. 단계가 바뀌는 순간 선이 튀지 않게 새로 생기는 선은 서서히 나타난다.
// 주선 교차점에는 작은 + 표식을 두고(Vercel·Linear 랜딩의 도면 느낌),
// 전체는 지도 중심에서 가장자리로 갈수록 옅어지는 타원 비네트로 감싼다.
const GRID_MIN_PX = 22; // 보조선 화면 간격 하한 (상한은 2배)
const GRID_MAJOR_EVERY = 8; // 보조선 8칸마다 주선
const GRID_MINOR = 0.06; // 선 불투명도
const GRID_MAJOR = 0.12;
const GRID_CROSS = 0.32; // 교차점 표식 불투명도
const GRID_CROSS_PX = 4; // 표식 팔 길이
const GRID_INK = "#191f28";

function drawGrid(
  ctx: CanvasRenderingContext2D,
  t: ZoomTransform,
  w: number,
  h: number,
  top: number,
) {
  const step = 2 ** Math.ceil(Math.log2(GRID_MIN_PX / t.k)); // 기본 좌표 단위
  const px = step * t.k; // [GRID_MIN_PX, 2·GRID_MIN_PX)
  const fade = (px - GRID_MIN_PX) / GRID_MIN_PX; // 0 → 1

  const alphaOf = (i: number) => {
    if (i % (GRID_MAJOR_EVERY * 2) === 0) return GRID_MAJOR;
    if (i % GRID_MAJOR_EVERY === 0) return GRID_MINOR + (GRID_MAJOR - GRID_MINOR) * fade;
    if (i % 2 === 0) return GRID_MINOR;
    return GRID_MINOR * fade;
  };
  /** 주선이면 0~1 강도(새로 주선이 되는 선은 fade), 아니면 0 */
  const majorOf = (i: number) =>
    i % (GRID_MAJOR_EVERY * 2) === 0 ? 1 : i % GRID_MAJOR_EVERY === 0 ? fade : 0;

  const axis = (from: number, to: number, apply: (v: number) => number) => {
    const out: { pos: number; alpha: number; major: number }[] = [];
    for (let i = Math.floor(from / step); i <= Math.ceil(to / step); i++) {
      const n = Math.abs(i);
      out.push({ pos: Math.round(apply(i * step)) + 0.5, alpha: alphaOf(n), major: majorOf(n) });
    }
    return out;
  };
  const xs = axis(t.invertX(0), t.invertX(w), (v) => t.applyX(v));
  const ys = axis(t.invertY(0), t.invertY(h), (v) => t.applyY(v));

  ctx.strokeStyle = GRID_INK;
  ctx.lineWidth = 1;
  for (const { pos, alpha } of xs) {
    if (alpha < 0.004) continue;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, h);
    ctx.stroke();
  }
  for (const { pos, alpha } of ys) {
    if (alpha < 0.004) continue;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(w, pos);
    ctx.stroke();
  }

  // 주선 교차점 + 표식
  for (const x of xs) {
    if (!x.major) continue;
    for (const y of ys) {
      if (!y.major) continue;
      ctx.globalAlpha = GRID_CROSS * Math.min(x.major, y.major);
      ctx.beginPath();
      ctx.moveTo(x.pos - GRID_CROSS_PX, y.pos);
      ctx.lineTo(x.pos + GRID_CROSS_PX, y.pos);
      ctx.moveTo(x.pos, y.pos - GRID_CROSS_PX);
      ctx.lineTo(x.pos, y.pos + GRID_CROSS_PX);
      ctx.stroke();
    }
  }

  // 가장자리 비네트: 지금까지 그린 격자만 남긴 채(빈 캔버스 위) 알파를 타원 그라데이션으로 깎는다.
  // 반드시 점보다 먼저 호출해야 점은 영향을 받지 않는다.
  const cy = (Math.min(top, h / 2) + h) / 2;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "destination-in";
  ctx.translate(w / 2, cy);
  ctx.scale(w / 2, (h - Math.min(top, h / 2)) / 2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.15);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.45, "rgba(0,0,0,0.9)");
  g.addColorStop(0.8, "rgba(0,0,0,0.3)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-1.5, -1.5, 3, 3);
  ctx.restore();
  ctx.globalAlpha = 1;
}

export default function PatentMap({
  points,
  visible,
  highlights,
  selectedId,
  focus,
  onSelect,
  insetTop = PAD,
  riskOn = false,
  edgesOn = false,
  marker = null,
  group = null,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const zoomRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<{ p: PatentPoint; x: number; y: number } | null>(null);

  // 데이터 좌표 → 기본 캔버스 좌표 변환 (크기에 맞춰 fit). 점과 마커가 같은 변환을 쓴다
  const frame = useMemo(() => {
    if (!points.length || !size.w || !size.h) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const top = Math.max(PAD, insetTop);
    const usableH = Math.max(1, size.h - top - PAD);
    const scale = Math.min((size.w - PAD * 2) / spanX, usableH / spanY);
    const offX = (size.w - spanX * scale) / 2;
    const offY = top + (usableH - spanY * scale) / 2;
    return {
      toBase: (x: number, y: number): [number, number] => [offX + (x - minX) * scale, offY + (maxY - y) * scale],
    };
  }, [points, size, insetTop]);

  const nodes = useMemo<Node[]>(() => {
    if (!frame) return [];
    return points.map((p) => {
      const [bx, by] = frame.toBase(p.x, p.y);
      return { p, bx, by };
    });
  }, [points, frame]);

  const markerBase = useMemo(() => (marker && frame ? frame.toBase(marker.x, marker.y) : null), [marker, frame]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.p.id, n])), [nodes]);

  // 분쟁 사례와 연결된 점, 그 위에 깔 위험도 격자, 관계선 쌍 (모두 점 목록에서만 계산)
  const risk = useMemo(() => {
    if (!riskOn || !nodes.length) return [];
    return riskField(nodes, caseHits(points, ACTIVE_CASES));
  }, [riskOn, nodes, points]);

  const edges = useMemo(() => (edgesOn ? citationEdges(points) : []), [edgesOn, points]);

  const tree = useMemo<Quadtree<Node> | null>(() => {
    if (!nodes.length) return null;
    return quadtree<Node>()
      .x((n) => n.bx)
      .y((n) => n.by)
      .addAll(nodes.filter((n) => visible.has(n.p.decision)));
  }, [nodes, visible]);

  // 리사이즈 관찰
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w || !size.h) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size.w * dpr || canvas.height !== size.h * dpr) {
      canvas.width = size.w * dpr;
      canvas.height = size.h * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const t = transformRef.current;
    const k = t.k;
    const baseR = 2.2 * Math.min(2.2, Math.sqrt(k));
    const dim = highlights !== null || group !== null;

    // 0) 분쟁 위험도 배경: 셀마다 밀집도 × 사례 수에 따라 옅은 색을 물들인다
    if (riskOn) {
      // 셀마다 부드러운 방사형 그라데이션을 겹쳐 물감이 번진 모양으로 그린다
      const reach = 36 * k;
      for (const c of risk) {
        const x = t.applyX(c.x);
        const y = t.applyY(c.y);
        if (x + reach < 0 || y + reach < 0 || x - reach > size.w || y - reach > size.h) continue;
        const g = ctx.createRadialGradient(x, y, 0, x, y, reach);
        g.addColorStop(0, `rgba(240, 68, 82, ${0.32 * c.value})`);
        g.addColorStop(1, "rgba(240, 68, 82, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - reach, y - reach, reach * 2, reach * 2);
      }
      ctx.globalAlpha = 1;
    }

    // 0-1) 인용선: 실제 인용은 실선, 더미가 낀 가짜 인용은 점선. 선택한 특허의 인용은 진하게
    if (edgesOn && nodes.length === points.length) {
      // 선택 강조도 실제/가짜에 따라 실선/점선을 유지하고, 숨긴 상태의 점에 닿는 선은 그리지 않는다
      for (const pass of citationPasses(edges, points, visible, selectedId)) {
        if (!pass.edges.length) continue;
        ctx.setLineDash(pass.real ? [] : pass.selected ? [4, 3] : [3, 3]);
        ctx.lineWidth = pass.selected ? 1.6 : pass.real ? 0.9 : 0.6;
        ctx.strokeStyle = pass.selected ? "#3182f6" : "#3d4a5c";
        ctx.globalAlpha = pass.selected ? (pass.real ? 0.85 : 0.6) : pass.real ? 0.42 : 0.16;
        ctx.beginPath();
        for (const e of pass.edges) {
          const a = nodes[e.from], b = nodes[e.to];
          ctx.moveTo(t.applyX(a.bx), t.applyY(a.by));
          ctx.lineTo(t.applyX(b.bx), t.applyY(b.by));
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // 1) 일반 점
    for (const n of nodes) {
      if (!visible.has(n.p.decision)) continue;
      // 영역 강조 중에는 영역 점만, 아니면 하이라이트 점만 위에 따로 그린다
      const isHi = group ? group.ids.has(n.p.id) : highlights?.has(n.p.id) ?? false;
      if (isHi) continue;
      const x = t.applyX(n.bx);
      const y = t.applyY(n.by);
      if (x < -10 || y < -10 || x > size.w + 10 || y > size.h + 10) continue;
      // 더미 점은 흐리게 그려서 실제 자료와 시각적으로 구분한다
      ctx.globalAlpha = dim ? 0.12 : n.p.source === "dummy" ? 0.4 : 0.75;
      ctx.fillStyle = DECISION_COLORS[n.p.decision];
      ctx.beginPath();
      ctx.arc(x, y, baseR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2) 하이라이트 점 (유사도 높을수록 큼)
    if (highlights && !group) {
      for (const [id, score] of highlights) {
        const n = byId.get(id);
        if (!n || !visible.has(n.p.decision)) continue;
        const x = t.applyX(n.bx);
        const y = t.applyY(n.by);
        const r = baseR * (1.8 + Math.max(0, score - 0.3) * 3);
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = DECISION_COLORS[n.p.decision];
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2-1) 밀집 영역: 주변 점(작은 링) → 중심 점(큰 점 + 이중 링 + 이름표)
    if (group) {
      const members: { n: Node; x: number; y: number }[] = [];
      for (const id of group.ids) {
        const n = byId.get(id);
        if (!n || !visible.has(n.p.decision)) continue;
        members.push({ n, x: t.applyX(n.bx), y: t.applyY(n.by) });
      }
      const center = members.find((m) => m.n.p.id === group.centerId);
      for (const m of members) {
        if (m === center) continue;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = DECISION_COLORS[m.n.p.decision];
        ctx.beginPath();
        ctx.arc(m.x, m.y, baseR * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = "#3182f6";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(m.x, m.y, baseR * 1.6 + 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (center) {
        const r = baseR * 2.6;
        ctx.globalAlpha = 1;
        ctx.fillStyle = DECISION_COLORS[center.n.p.decision];
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = "#3182f6";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(center.x, center.y, r + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = "700 11px system-ui, sans-serif";
        const label = "영역 중심";
        const lw = ctx.measureText(label).width + 12;
        const lx = center.x - lw / 2;
        const ly = center.y - r - 26;
        ctx.fillStyle = "#3182f6";
        ctx.beginPath();
        ctx.roundRect(lx, ly, lw, 18, 9);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, lx + 6, ly + 13);
      }
    }

    // 3-1) 내 아이디어 위치
    if (markerBase) {
      const x = t.applyX(markerBase[0]);
      const y = t.applyY(markerBase[1]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#191f28";
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#191f28";
      ctx.font = "600 12px system-ui, sans-serif";
      ctx.fillText("내 아이디어", x + 10, y + 4);
    }

    // 3) 선택 링
    if (selectedId && selectedId !== group?.centerId) {
      const n = byId.get(selectedId);
      if (n) {
        const x = t.applyX(n.bx);
        const y = t.applyY(n.by);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#3182f6";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, baseR * 2.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }, [nodes, byId, size, visible, highlights, selectedId, riskOn, risk, edgesOn, edges, points, markerBase, group]);

  useEffect(() => {
    const raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  // d3-zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const z = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.6, 60])
      .duration(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 250)
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        requestAnimationFrame(draw);
      });
    zoomRef.current = z;
    select(canvas).call(z);
    return () => {
      select(canvas).on(".zoom", null);
    };
  }, [draw]);

  // focus 변경 시 카메라 이동
  useEffect(() => {
    const canvas = canvasRef.current;
    const z = zoomRef.current;
    if (!focus || !canvas || !z) return;
    const n = byId.get(focus.id);
    if (!n) return;
    const top = Math.min(insetTop, size.h / 2);
    let k = Math.max(transformRef.current.k, 4);
    let [cx, cy] = [n.bx, n.by];
    // 영역 중심으로 이동할 때는 영역 점 전체가 화면에 들어오게 맞춘다
    const members = group?.ids.has(focus.id) ? [...group.ids].map((id) => byId.get(id)).filter((m): m is Node => Boolean(m)) : [];
    if (members.length > 1) {
      cx = members.reduce((s, m) => s + m.bx, 0) / members.length;
      cy = members.reduce((s, m) => s + m.by, 0) / members.length;
      const reach = Math.max(...members.map((m) => Math.hypot(m.bx - cx, m.by - cy))) || 1;
      k = Math.min(60, Math.max(0.6, (Math.min(size.w, size.h - top) * 0.42) / reach));
    }
    const target = zoomIdentity
      .translate(size.w / 2, (top + size.h) / 2)
      .scale(k)
      .translate(-cx, -cy);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    select(canvas).transition().duration(reduce ? 0 : 650).call(z.transform, target);
    // group은 focus와 함께 바뀌므로 focus가 바뀔 때만 이동한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, byId, size, insetTop]);

  const findAt = useCallback(
    (clientX: number, clientY: number): Node | null => {
      const canvas = canvasRef.current;
      if (!canvas || !tree) return null;
      const rect = canvas.getBoundingClientRect();
      const t = transformRef.current;
      const [bx, by] = t.invert([clientX - rect.left, clientY - rect.top]);
      const radius = 10 / t.k;
      return tree.find(bx, by, radius) ?? null;
    },
    [tree],
  );

  return (
    <div ref={wrapRef} className="relative h-full w-full select-none">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="특허 임베딩 지도. 가까울수록 비슷한 기술이며 검색 결과 목록에서 같은 특허를 선택할 수 있습니다."
        style={{ width: size.w, height: size.h }}
        className={hover ? "cursor-pointer" : "cursor-grab"}
        // 터치에서는 미리보기 카드가 툴팁 역할을 하므로 마우스일 때만 띄운다
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const n = findAt(e.clientX, e.clientY);
          const rect = wrapRef.current?.getBoundingClientRect();
          setHover(
            n && rect ? { p: n.p, x: e.clientX - rect.left, y: e.clientY - rect.top } : null,
          );
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const n = findAt(e.clientX, e.clientY);
          onSelect(n ? n.p.id : null);
        }}
      />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-xl border border-border bg-panel/95 px-3 py-2 text-[13px] shadow-lg backdrop-blur"
          style={{
            left: Math.min(hover.x + 14, size.w - 300),
            top: Math.min(hover.y + 14, size.h - 80),
          }}
        >
          <div className="mb-1 flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: DECISION_COLORS[hover.p.decision] }}
            />
            <span className="text-muted">
              {DECISION_LABELS[hover.p.decision]} · {hover.p.cpc || "CPC 없음"} · {hover.p.filed}
            </span>
          </div>
          {hover.p.source === "dummy" && <div className="mb-1 text-[11px] font-bold text-[#8a5a00]">더미 데이터 · 시연용</div>}
          <div className="line-clamp-3 font-medium leading-snug">{hover.p.title}</div>
        </div>
      )}
    </div>
  );
}
