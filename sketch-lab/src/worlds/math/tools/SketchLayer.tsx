import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Vec } from '../../../core/geometry';
import { toLocal } from '../../../ui/svg';

export interface Stroke {
  pts: Vec[];
  w: number[];
  color: string;
}

/** Turn a pressure-sensitive stroke into a filled outline path (variable width). */
export function strokePath(s: Stroke): string {
  const p = s.pts;
  if (p.length === 1) {
    const r = s.w[0] / 2;
    return `M${p[0].x - r} ${p[0].y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
  }
  const left: Vec[] = [];
  const right: Vec[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[Math.max(0, i - 1)];
    const b = p[Math.min(p.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const hw = s.w[i] / 2;
    left.push({ x: p[i].x - (dy / L) * hw, y: p[i].y + (dx / L) * hw });
    right.push({ x: p[i].x + (dy / L) * hw, y: p[i].y - (dx / L) * hw });
  }
  const pts = [...left, ...right.reverse()];
  return pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ') + ' Z';
}

/**
 * A freehand pen layer that sits on top of any SVG tool. Uses stylus pressure
 * when available (Android tablets with a pen), otherwise a steady width.
 * Ignores touches while a pen is in use, so a resting palm does not draw.
 */
export function SketchLayer({ active, strokes, onStrokes, width, height, color = '#1f2a44', size = 3, copies = [], onStrokeEnd }: {
  active: boolean; strokes: Stroke[]; onStrokes: (s: Stroke[]) => void; width: number; height: number; color?: string; size?: number;
  /** extra SVG transforms: every stroke is also drawn once per transform (mirror / radial symmetry) */
  copies?: string[];
  onStrokeEnd?: (s: Stroke) => void;
}) {
  const [live, setLive] = useState<Stroke | null>(null);
  const penSeen = useRef(false);
  const ref = useRef<SVGRectElement>(null);
  const pointer = useRef<number | null>(null);

  const widthFor = (e: RPointerEvent) => {
    if (e.pointerType === 'pen') return size * (0.35 + 1.3 * (e.pressure || 0.5));
    return size;
  };

  return (
    <g>
      {strokes.map((s, i) => (
        <path key={i} d={strokePath(s)} fill={s.color} pointerEvents="none" />
      ))}
      {live && <path d={strokePath(live)} fill={live.color} pointerEvents="none" />}
      {copies.map((t, k) => (
        <g key={k} transform={t} pointerEvents="none" opacity={0.85}>
          {strokes.map((s, i) => <path key={i} d={strokePath(s)} fill={s.color} />)}
          {live && <path d={strokePath(live)} fill={live.color} />}
        </g>
      ))}
      {active && (
        <rect
          ref={ref}
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          style={{ cursor: 'crosshair' }}
          onPointerDown={(e) => {
            if (e.pointerType === 'pen') penSeen.current = true;
            if (penSeen.current && e.pointerType === 'touch') return; // palm rejection
            e.currentTarget.setPointerCapture(e.pointerId);
            pointer.current = e.pointerId;
            const p = toLocal(e.currentTarget, e.clientX, e.clientY);
            setLive({ pts: [p], w: [widthFor(e)], color });
          }}
          onPointerMove={(e) => {
            if (pointer.current !== e.pointerId || !live) return;
            const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
            const pts = [...live.pts];
            const w = [...live.w];
            for (const ev of events) {
              const p = toLocal(e.currentTarget, ev.clientX, ev.clientY);
              const last = pts[pts.length - 1];
              if (Math.hypot(p.x - last.x, p.y - last.y) < 1.2) continue;
              pts.push(p);
              w.push(ev.pointerType === 'pen' ? size * (0.35 + 1.3 * (ev.pressure || 0.5)) : size);
            }
            setLive({ ...live, pts, w });
          }}
          onPointerUp={(e) => {
            if (pointer.current !== e.pointerId) return;
            pointer.current = null;
            if (live) {
              onStrokes([...strokes, live]);
              onStrokeEnd?.(live);
            }
            setLive(null);
          }}
          onPointerCancel={() => {
            pointer.current = null;
            setLive(null);
          }}
        />
      )}
    </g>
  );
}
