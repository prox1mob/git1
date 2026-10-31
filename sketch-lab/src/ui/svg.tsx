import { useRef, type KeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import type { Vec } from '../core/geometry';

/** Convert a pointer position into the user coordinates of an SVG element's parent group. */
export function toLocal(el: SVGGraphicsElement, clientX: number, clientY: number): Vec {
  const svg = el.ownerSVGElement ?? (el as unknown as SVGSVGElement);
  const m = el.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const p = pt.matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

export interface DragCallbacks {
  /** Called on press. Return false to cancel the drag. */
  onStart?: (p: Vec, e: RPointerEvent) => void | boolean;
  onMove?: (p: Vec, start: Vec, e: PointerEvent | RPointerEvent) => void;
  onEnd?: (p: Vec) => void;
}

/**
 * Pointer handlers for dragging any SVG element with mouse, finger or stylus.
 * Coordinates are reported in the space of the element's parent, captured at
 * the start of the drag so moving the element itself never skews the maths.
 */
export function useSvgDrag(cb: DragCallbacks) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  const state = useRef<{ parent: SVGGraphicsElement; start: Vec; id: number } | null>(null);

  const local = (clientX: number, clientY: number) => {
    const s = state.current;
    return s ? toLocal(s.parent, clientX, clientY) : { x: 0, y: 0 };
  };

  return {
    onPointerDown(e: RPointerEvent<SVGElement>) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const target = e.currentTarget as SVGGraphicsElement;
      const parent = (target.parentNode as SVGGraphicsElement) ?? target;
      const p = toLocal(parent, e.clientX, e.clientY);
      state.current = { parent, start: p, id: e.pointerId };
      if (cbRef.current.onStart?.(p, e) === false) {
        state.current = null;
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      target.setPointerCapture(e.pointerId);
    },
    onPointerMove(e: RPointerEvent<SVGElement>) {
      const s = state.current;
      if (!s || s.id !== e.pointerId) return;
      cbRef.current.onMove?.(local(e.clientX, e.clientY), s.start, e);
    },
    onPointerUp(e: RPointerEvent<SVGElement>) {
      const s = state.current;
      if (!s || s.id !== e.pointerId) return;
      state.current = null;
      cbRef.current.onEnd?.(local(e.clientX, e.clientY));
    },
    onPointerCancel(e: RPointerEvent<SVGElement>) {
      const s = state.current;
      if (!s || s.id !== e.pointerId) return;
      state.current = null;
      cbRef.current.onEnd?.(s.start);
    },
  };
}

interface HandleProps {
  x: number;
  y: number;
  onDrag: (p: Vec) => void;
  onStart?: () => void;
  onEnd?: () => void;
  color?: string;
  r?: number;
  label?: string;
  labelOffset?: Vec;
  /** keyboard step for arrow keys */
  step?: number;
  title?: string;
  shape?: 'circle' | 'square' | 'diamond';
  highlight?: boolean;
  children?: ReactNode;
}

/** A large, touch-friendly draggable point. Also movable with the arrow keys. */
export function Handle({
  x, y, onDrag, onStart, onEnd, color = '#ff7a45', r = 9, label, labelOffset = { x: 14, y: -14 },
  step = 1, title, shape = 'circle', highlight, children,
}: HandleProps) {
  const offset = useRef<Vec>({ x: 0, y: 0 });
  const drag = useSvgDrag({
    onStart: (p) => {
      offset.current = { x: x - p.x, y: y - p.y };
      onStart?.();
    },
    onMove: (p) => onDrag({ x: p.x + offset.current.x, y: p.y + offset.current.y }),
    onEnd: () => onEnd?.(),
  });
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    const k = e.key;
    const d = e.shiftKey ? step * 10 : step;
    const moves: Record<string, Vec> = {
      ArrowLeft: { x: -d, y: 0 }, ArrowRight: { x: d, y: 0 }, ArrowUp: { x: 0, y: -d }, ArrowDown: { x: 0, y: d },
    };
    if (moves[k]) {
      e.preventDefault();
      onStart?.();
      onDrag({ x: x + moves[k].x, y: y + moves[k].y });
      onEnd?.();
    }
  };
  return (
    <g
      className="handle"
      transform={`translate(${x} ${y})`}
      tabIndex={0}
      role="slider"
      aria-label={title ?? label ?? 'draggable point'}
      onKeyDown={onKey}
      {...drag}
    >
      {title && <title>{title}</title>}
      <circle r={Math.max(22, r + 12)} fill="transparent" />
      {highlight && <circle r={r + 7} fill="none" stroke="#e5484d" strokeWidth={3} strokeDasharray="4 3" />}
      {shape === 'circle' && <circle r={r} fill={color} stroke="#fff" strokeWidth={2.5} className="handle-dot" />}
      {shape === 'square' && (
        <rect x={-r} y={-r} width={2 * r} height={2 * r} rx={2} fill={color} stroke="#fff" strokeWidth={2.5} className="handle-dot" />
      )}
      {shape === 'diamond' && (
        <rect x={-r} y={-r} width={2 * r} height={2 * r} rx={2} fill={color} stroke="#fff" strokeWidth={2.5} transform="rotate(45)" className="handle-dot" />
      )}
      {label && (
        <text x={labelOffset.x} y={labelOffset.y} className="handle-label" textAnchor="middle">
          {label}
        </text>
      )}
      {children}
    </g>
  );
}

/** Square grid lines for an SVG area. */
export function GridLines({
  x0, y0, w, h, step, major = 0, color = '#e3e8f2', majorColor = '#c8d2e6',
}: { x0: number; y0: number; w: number; h: number; step: number; major?: number; color?: string; majorColor?: string }) {
  const lines: ReactNode[] = [];
  let i = 0;
  for (let x = x0; x <= x0 + w + 0.01; x += step, i++) {
    const isMajor = major > 0 && i % major === 0;
    lines.push(<line key={`v${i}`} x1={x} y1={y0} x2={x} y2={y0 + h} stroke={isMajor ? majorColor : color} strokeWidth={isMajor ? 1.2 : 1} />);
  }
  i = 0;
  for (let y = y0; y <= y0 + h + 0.01; y += step, i++) {
    const isMajor = major > 0 && i % major === 0;
    lines.push(<line key={`h${i}`} x1={x0} y1={y} x2={x0 + w} y2={y} stroke={isMajor ? majorColor : color} strokeWidth={isMajor ? 1.2 : 1} />);
  }
  return <g pointerEvents="none">{lines}</g>;
}

/** Small filled arrowhead at `tip`, pointing along from→tip. */
export function ArrowHead({ from, tip, color, size = 8 }: { from: Vec; tip: Vec; color: string; size?: number }) {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const b = { x: tip.x - ux * size, y: tip.y - uy * size };
  const w = size * 0.55;
  return (
    <path
      d={`M${tip.x} ${tip.y} L${b.x - uy * w} ${b.y + ux * w} L${b.x + uy * w} ${b.y - ux * w} Z`}
      fill={color}
      pointerEvents="none"
    />
  );
}

/** A straight arrow from a to b. */
export function Arrow({ a, b, color = '#333', width = 2, dash }: { a: Vec; b: Vec; color?: string; width?: number; dash?: string }) {
  return (
    <g pointerEvents="none">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={width} strokeDasharray={dash} />
      <ArrowHead from={a} tip={b} color={color} size={6 + width * 2} />
    </g>
  );
}

/** A technical-drawing style dimension line with arrows and a centred label. */
export function DimLine({
  a, b, offset = 18, label, color = '#3b5bdb', error = false,
}: { a: Vec; b: Vec; offset?: number; label: string; color?: string; error?: boolean }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const p1 = { x: a.x + nx * offset, y: a.y + ny * offset };
  const p2 = { x: b.x + nx * offset, y: b.y + ny * offset };
  const c = error ? '#e5484d' : color;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const flip = ang > 90 || ang < -90;
  const side = offset >= 0 ? 1 : -1;
  const m = { x: (p1.x + p2.x) / 2 + nx * 11 * side, y: (p1.y + p2.y) / 2 + ny * 11 * side };
  return (
    <g pointerEvents="none" className="dimline">
      <line x1={a.x} y1={a.y} x2={p1.x + nx * 4 * side} y2={p1.y + ny * 4 * side} stroke={c} strokeWidth={1} opacity={0.6} />
      <line x1={b.x} y1={b.y} x2={p2.x + nx * 4 * side} y2={p2.y + ny * 4 * side} stroke={c} strokeWidth={1} opacity={0.6} />
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={c} strokeWidth={error ? 2.2 : 1.4} />
      {L > 16 && <ArrowHead from={p2} tip={p1} color={c} size={7} />}
      {L > 16 && <ArrowHead from={p1} tip={p2} color={c} size={7} />}
      <text
        x={m.x}
        y={m.y}
        fill={c}
        fontSize={13}
        fontWeight={600}
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(${flip ? ang + 180 : ang} ${m.x} ${m.y})`}
        className="dim-text"
      >
        {label}
      </text>
    </g>
  );
}

/** Shared <defs> (hatch pattern for "mistake" areas). Put once inside an <svg>. */
export function SvgDefs() {
  return (
    <defs>
      <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#e5484d" strokeWidth="3" opacity="0.5" />
      </pattern>
      <pattern id="hatchBlue" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#3b5bdb" strokeWidth="3" opacity="0.35" />
      </pattern>
    </defs>
  );
}
