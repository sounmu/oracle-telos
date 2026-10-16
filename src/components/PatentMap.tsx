"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { quadtree, type Quadtree } from "d3-quadtree";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import { DECISION_COLORS, DECISION_LABELS } from "@/lib/colors";
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
}

interface Node {
  p: PatentPoint;
  bx: number; // 기본(줌 전) 캔버스 좌표
  by: number;
}

const PAD = 48;

export default function PatentMap({
  points,
  visible,
  highlights,
  selectedId,
  focus,
  onSelect,
  insetTop = PAD,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const zoomRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<{ p: PatentPoint; x: number; y: number } | null>(null);

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
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
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
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, baseR * 2.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }, [nodes, byId, size, visible, highlights, selectedId]);

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
        onMouseMove={(e) => {
          const n = findAt(e.clientX, e.clientY);
          const rect = wrapRef.current?.getBoundingClientRect();
          setHover(
            n && rect ? { p: n.p, x: e.clientX - rect.left, y: e.clientY - rect.top } : null,
          );
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const n = findAt(e.clientX, e.clientY);
          onSelect(n ? n.p.id : null);
        }}
      />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-md border border-border bg-panel/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
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
          <div className="line-clamp-3 font-medium leading-snug">{hover.p.title}</div>
        </div>
      )}
    </div>
  );
}
