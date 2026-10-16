"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { quadtree, type Quadtree } from "d3-quadtree";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import { DECISION_COLORS, DECISION_LABELS } from "@/lib/colors";
import type { Decision, PatentPoint } from "@/lib/types";

/** 지도 점(anchorId) 옆에 꽂는 핀. 분쟁 사례 표시에 쓴다 */
export interface MapMarker {
  readonly id: string;
  readonly anchorId: string;
  /** 핀 옆 이름표와 툴팁 첫 줄 */
  readonly label: string;
  /** 툴팁 둘째 줄 */
  readonly detail: string;
}

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
  markers?: readonly MapMarker[];
  activeMarkerId?: string | null;
  onMarkerSelect?: (id: string) => void;
}

interface Node {
  p: PatentPoint;
  bx: number; // 기본(줌 전) 캔버스 좌표
  by: number;
}

const PAD = 48;
const NO_MARKERS: readonly MapMarker[] = [];
// 핀 머리 중심이 기준 점보다 위로 올라가는 거리(px), 같은 점에 핀이 여럿일 때 옆으로 벌리는 간격
const PIN_LIFT = 18;
const PIN_SPREAD = 18;
const PIN_COLOR = "#7c5cff";
const PIN_ACTIVE = "#5b3df5";

type Hover =
  | { kind: "point"; p: PatentPoint; x: number; y: number }
  | { kind: "marker"; m: MapMarker; x: number; y: number };

export default function PatentMap({
  points,
  visible,
  highlights,
  selectedId,
  focus,
  onSelect,
  insetTop = PAD,
  markers = NO_MARKERS,
  activeMarkerId = null,
  onMarkerSelect,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const zoomRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<Hover | null>(null);

  // 데이터 → 기본 캔버스 좌표 (크기에 맞춰 fit)
  const nodes = useMemo<Node[]>(() => {
    if (!points.length || !size.w || !size.h) return [];
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
    return points.map((p) => ({
      p,
      bx: offX + (p.x - minX) * scale,
      by: offY + (maxY - p.y) * scale,
    }));
  }, [points, size, insetTop]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.p.id, n])), [nodes]);

  // 핀 → 기준 점. 같은 점에 꽂힌 핀은 옆으로 벌린다
  const pins = useMemo(() => {
    const perAnchor = new Map<string, number>();
    return markers.flatMap((m) => {
      const n = byId.get(m.anchorId);
      if (!n) return [];
      const i = perAnchor.get(m.anchorId) ?? 0;
      perAnchor.set(m.anchorId, i + 1);
      return [{ m, n, dx: i * PIN_SPREAD }];
    });
  }, [markers, byId]);

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
    const dim = highlights !== null;

    // 1) 일반 점
    for (const n of nodes) {
      if (!visible.has(n.p.decision)) continue;
      const isHi = dim && highlights.has(n.p.id);
      if (isHi) continue; // 하이라이트는 위에 따로
      const x = t.applyX(n.bx);
      const y = t.applyY(n.by);
      if (x < -10 || y < -10 || x > size.w + 10 || y > size.h + 10) continue;
      ctx.globalAlpha = dim ? 0.12 : 0.75;
      ctx.fillStyle = DECISION_COLORS[n.p.decision];
      ctx.beginPath();
      ctx.arc(x, y, baseR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2) 하이라이트 점 (유사도 높을수록 큼)
    if (dim) {
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
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = "#191f28";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // 3) 선택 링
    if (selectedId) {
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

    // 4) 분쟁 사례 핀. 고른 핀은 맨 위에 이름표와 함께 그린다
    const ordered = [...pins].sort((a, b) => Number(a.m.id === activeMarkerId) - Number(b.m.id === activeMarkerId));
    for (const { m, n, dx } of ordered) {
      const active = m.id === activeMarkerId;
      const tipX = t.applyX(n.bx);
      const tipY = t.applyY(n.by);
      const x = tipX + dx;
      const y = tipY - PIN_LIFT;
      if (x < -40 || y < -40 || x > size.w + 40 || y > size.h + 40) continue;
      const r = active ? 10 : 7.5;
      ctx.fillStyle = active ? PIN_ACTIVE : PIN_COLOR;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI * 0.75, Math.PI * 0.25);
      ctx.lineTo(tipX + dx * 0.5, tipY - 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
      if (active) {
        ctx.font = "700 12px Pretendard, system-ui, sans-serif";
        const w = ctx.measureText(m.label).width + 16;
        const lx = Math.max(8, Math.min(x + r + 6, size.w - w - 8));
        const ly = y - 12;
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.strokeStyle = PIN_ACTIVE;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(lx, ly, w, 24, 12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#191f28";
        ctx.textBaseline = "middle";
        ctx.fillText(m.label, lx + 8, ly + 12.5);
      }
    }
  }, [nodes, byId, size, visible, highlights, selectedId, pins, activeMarkerId]);

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
    const k = Math.max(transformRef.current.k, 4);
    const target = zoomIdentity
      .translate(size.w / 2, (Math.min(insetTop, size.h / 2) + size.h) / 2)
      .scale(k)
      .translate(-n.bx, -n.by);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    select(canvas).transition().duration(reduce ? 0 : 650).call(z.transform, target);
  }, [focus, byId, size, insetTop]);

  const findPinAt = useCallback(
    (clientX: number, clientY: number): MapMarker | null => {
      const canvas = canvasRef.current;
      if (!canvas || pins.length === 0) return null;
      const rect = canvas.getBoundingClientRect();
      const t = transformRef.current;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      let best: MapMarker | null = null;
      let bestD = 14;
      for (const { m, n, dx } of pins) {
        const d = Math.hypot(t.applyX(n.bx) + dx - px, t.applyY(n.by) - PIN_LIFT - py);
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }
      return best;
    },
    [pins],
  );

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
          const rect = wrapRef.current?.getBoundingClientRect();
          if (!rect) return setHover(null);
          const at = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          const m = findPinAt(e.clientX, e.clientY);
          if (m) return setHover({ kind: "marker", m, ...at });
          const n = findAt(e.clientX, e.clientY);
          setHover(n ? { kind: "point", p: n.p, ...at } : null);
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const m = findPinAt(e.clientX, e.clientY);
          if (m && onMarkerSelect) return onMarkerSelect(m.id);
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
          {hover.kind === "marker" ? (
            <>
              <div className="mb-1 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: PIN_COLOR }} />
                <span className="text-muted">분쟁 사례 · 누르면 자세히</span>
              </div>
              <div className="font-semibold leading-snug">{hover.m.label}</div>
              <div className="mt-0.5 line-clamp-2 leading-snug text-muted">{hover.m.detail}</div>
            </>
          ) : (
            <>
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: DECISION_COLORS[hover.p.decision] }}
                />
                <span className="text-muted">
                  {DECISION_LABELS[hover.p.decision]} · {hover.p.cpc || "CPC 없음"} · {hover.p.filed}
                </span>
              </div>
              <div className="line-clamp-3 font-medium leading-snug">{hover.p.title}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
