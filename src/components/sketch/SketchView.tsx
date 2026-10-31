import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Vec2 } from '../../lib/types';

export interface SketchPointer {
  pt: Vec2; // millimetres, y up
  raw: React.PointerEvent<SVGSVGElement>;
}

interface Props {
  extent?: number; // visible half-width in mm
  center?: Vec2;
  grid?: number;
  children?: ReactNode;
  onDown?: (p: SketchPointer) => void;
  onMove?: (p: SketchPointer) => void;
  onUp?: (p: SketchPointer) => void;
  showAxes?: boolean;
  /** Pixels-per-mm is reported so callers can size hit targets in screen space. */
  onScale?: (pxPerMm: number) => void;
}

/**
 * An SVG drawing surface in millimetres (Y up). One finger / pen / mouse draws;
 * two fingers pan and pinch-zoom; the mouse wheel zooms.
 */
export function SketchView({ extent = 80, center = [0, 0], grid = 10, children, onDown, onMove, onUp, showAxes = true, onScale }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ cx: center[0], cy: center[1], hw: extent });
  const [size, setSize] = useState({ w: 600, h: 400 });
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ d: number; mid: { x: number; y: number }; view: typeof view } | null>(null);
  const drawingPointer = useRef<number | null>(null);

  useEffect(() => {
    const el = svg.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const aspect = size.h / size.w;
  const hh = view.hw * aspect;
  const pxPerMm = size.w / (view.hw * 2);
  useEffect(() => {
    onScale?.(pxPerMm);
  }, [pxPerMm, onScale]);

  const toMm = (clientX: number, clientY: number): Vec2 => {
    const r = svg.current!.getBoundingClientRect();
    const x = view.cx - view.hw + ((clientX - r.left) / r.width) * view.hw * 2;
    const y = view.cy + hh - ((clientY - r.top) / r.height) * hh * 2;
    return [x, y];
  };

  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (e.pointerType === 'touch') touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.current.size === 2) {
      const [a, b] = [...touches.current.values()];
      gesture.current = { d: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view };
      if (drawingPointer.current != null) {
        onUp?.({ pt: toMm(e.clientX, e.clientY), raw: e });
        drawingPointer.current = null;
      }
      return;
    }
    if (e.button === 1 || e.button === 2) {
      gesture.current = { d: 0, mid: { x: e.clientX, y: e.clientY }, view };
      return;
    }
    drawingPointer.current = e.pointerId;
    onDown?.({ pt: toMm(e.clientX, e.clientY), raw: e });
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g) {
      const r = svg.current!.getBoundingClientRect();
      const k = (g.view.hw * 2) / r.width;
      if (touches.current.size === 2) {
        const [a, b] = [...touches.current.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const hw = Math.min(2000, Math.max(5, (g.view.hw * g.d) / Math.max(d, 1)));
        setView({ hw, cx: g.view.cx - (mid.x - g.mid.x) * k, cy: g.view.cy + (mid.y - g.mid.y) * k });
      } else if (e.buttons & 6) {
        setView({ ...g.view, cx: g.view.cx - (e.clientX - g.mid.x) * k, cy: g.view.cy + (e.clientY - g.mid.y) * k });
      }
      return;
    }
    if (drawingPointer.current === e.pointerId || drawingPointer.current == null) onMove?.({ pt: toMm(e.clientX, e.clientY), raw: e });
  };
  const up = (e: React.PointerEvent<SVGSVGElement>) => {
    touches.current.delete(e.pointerId);
    if (gesture.current) {
      if (touches.current.size < 2 && !(e.buttons & 6)) gesture.current = null;
      return;
    }
    if (drawingPointer.current === e.pointerId || drawingPointer.current == null) {
      drawingPointer.current = null;
      onUp?.({ pt: toMm(e.clientX, e.clientY), raw: e });
    }
  };
  const wheel = (e: React.WheelEvent) => {
    const f = Math.exp(e.deltaY * 0.0012);
    const [mx, my] = toMm(e.clientX, e.clientY);
    const hw = Math.min(2000, Math.max(5, view.hw * f));
    setView({ hw, cx: mx + (view.cx - mx) * (hw / view.hw), cy: my + (view.cy - my) * (hw / view.hw) });
  };

  const x0 = view.cx - view.hw,
    x1 = view.cx + view.hw,
    y0 = view.cy - hh,
    y1 = view.cy + hh;
  const g = view.hw > 300 ? grid * 10 : view.hw > 120 ? grid * 2 : grid;
  const lines: ReactNode[] = [];
  for (let x = Math.ceil(x0 / g) * g; x <= x1; x += g) lines.push(<line key={`x${x}`} x1={x} y1={y0} x2={x} y2={y1} className={Math.round(x / g) % 5 === 0 ? 'gridL' : 'gridl'} vectorEffect="non-scaling-stroke" />);
  for (let y = Math.ceil(y0 / g) * g; y <= y1; y += g) lines.push(<line key={`y${y}`} x1={x0} y1={y} x2={x1} y2={y} className={Math.round(y / g) % 5 === 0 ? 'gridL' : 'gridl'} vectorEffect="non-scaling-stroke" />);

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0 }}>
      <svg
        ref={svg}
        className="sketch"
        viewBox={`${x0} ${-y1} ${view.hw * 2} ${hh * 2}`}
        preserveAspectRatio="none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={wheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ position: 'absolute', inset: 0 }}
      >
        <g transform="scale(1,-1)">
          {lines}
          {showAxes && (
            <>
              <line x1={x0} y1={0} x2={x1} y2={0} stroke="#ff5f5f" strokeOpacity={0.55} vectorEffect="non-scaling-stroke" />
              <line x1={0} y1={y0} x2={0} y2={y1} stroke="#5bd75b" strokeOpacity={0.55} vectorEffect="non-scaling-stroke" />
            </>
          )}
          <SketchScale.Provider value={pxPerMm}>{children}</SketchScale.Provider>
        </g>
      </svg>
      <div className="overlay-br">
        <div className="seg">
          <button className="btn small icon" onClick={() => setView({ ...view, hw: view.hw / 1.3 })} aria-label="Zoom in">
            ＋
          </button>
          <button className="btn small icon" onClick={() => setView({ ...view, hw: view.hw * 1.3 })} aria-label="Zoom out">
            －
          </button>
          <button className="btn small" onClick={() => setView({ cx: center[0], cy: center[1], hw: extent })}>
            Fit
          </button>
        </div>
      </div>
      <div className="overlay-bl">
        <div className="hud mono" style={{ fontSize: 11 }}>
          grid {g} mm · 2 fingers: pan / zoom
        </div>
      </div>
    </div>
  );
}

export const SketchScale = createContext(4);
/** Size in mm that corresponds to `px` screen pixels at the current zoom. */
export function usePx(px: number) {
  return px / useContext(SketchScale);
}

/** Text that reads upright inside the flipped (Y-up) sketch group. */
export function SketchText({ x, y, children, color = '#e8eef4', size = 12, anchor = 'middle' }: { x: number; y: number; children: ReactNode; color?: string; size?: number; anchor?: 'start' | 'middle' | 'end' }) {
  const k = useContext(SketchScale);
  return (
    <text x={x} y={-y} transform="scale(1,-1)" fill={color} fontSize={size / k} textAnchor={anchor} dominantBaseline="middle" style={{ pointerEvents: 'none', fontFamily: 'var(--mono)' }} paintOrder="stroke" stroke="#0e141b" strokeWidth={3 / k}>
      {children}
    </text>
  );
}
