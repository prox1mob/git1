import { useRef, useState } from 'react';
import { SketchText, SketchView } from './SketchView';
import {
  addArc,
  addCircle,
  addLine,
  addPoint,
  addRect,
  analyse,
  arcPoints,
  CONSTRAINT_GLYPH,
  CONSTRAINT_LABEL,
  dragSolve,
  isDimension,
  measure,
  pointOf,
  removeEntity,
  sid,
  solve,
  type Constraint,
  type ConstraintType,
  type SLine,
  type Sketch,
  type SolveInfo,
} from '../../lib/cad/sketch';
import { fmt } from '../../lib/math';
import type { Vec2 } from '../../lib/types';
import { NumberField } from '../ui';

export type CadTool = 'select' | 'line' | 'rect' | 'circle' | 'arc';

interface Props {
  sketch: Sketch;
  onChange: (s: Sketch, commit: boolean) => void;
  tool: CadTool;
  selection: string[];
  onSelect: (ids: string[]) => void;
  info?: SolveInfo;
  extent?: number;
  center?: Vec2;
  snapMm?: number;
  showGlyphs?: boolean;
  autoConstrain?: boolean;
}

const COL = { under: '#4cc9f0', full: '#e8eef4', sel: '#f8961e', conflict: '#f85149' };

export function CadSketch({ sketch, onChange, tool, selection, onSelect, info, extent = 70, center = [30, 20], snapMm = 1, showGlyphs = true, autoConstrain = true }: Props) {
  const px = useRef(4);
  const [drag, setDrag] = useState<string | null>(null);
  const [chain, setChain] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ a: Vec2; b: Vec2 } | null>(null);
  const [arcPts, setArcPts] = useState<Vec2[]>([]);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const tolMm = () => 14 / px.current;
  const sn = (p: Vec2): Vec2 => (snapMm ? [Math.round(p[0] / snapMm) * snapMm, Math.round(p[1] / snapMm) * snapMm] : p);
  const conflict = info?.status === 'conflict';

  const nearestPoint = (p: Vec2) => {
    let best: string | null = null;
    let bd = tolMm();
    for (const q of sketch.points) {
      const d = Math.hypot(q.x - p[0], q.y - p[1]);
      if (d < bd) {
        bd = d;
        best = q.id;
      }
    }
    return best;
  };

  const lineColor = (ids: string[], entId: string) => {
    if (selection.includes(entId)) return COL.sel;
    if (conflict) return COL.conflict;
    return ids.every((id) => info?.determinedPoints.has(id)) ? COL.full : COL.under;
  };

  const down = (pt: Vec2) => {
    const p = sn(pt);
    if (tool === 'line') {
      const hit = nearestPoint(pt);
      let s = sketch;
      let pid = hit;
      if (!pid) {
        [s, pid] = addPoint(s, p[0], p[1]);
      }
      if (chain && chain !== pid) {
        let lid: string;
        [s, lid] = addLine(s, chain, pid);
        if (autoConstrain) {
          const a = pointOf(s, chain),
            b = pointOf(s, pid);
          const ang = Math.abs(Math.atan2(b[1] - a[1], b[0] - a[0])) * (180 / Math.PI);
          if (ang < 3 || ang > 177) s = { ...s, constraints: [...s.constraints, { id: sid('c'), type: 'horizontal', refs: [lid] }] };
          else if (Math.abs(ang - 90) < 3) s = { ...s, constraints: [...s.constraints, { id: sid('c'), type: 'vertical', refs: [lid] }] };
          s = solve(s);
        }
      }
      onChange(s, true);
      setChain(hit && chain ? null : pid); // tapping an existing point ends the chain (closing a loop)
      return;
    }
    if (tool === 'rect' || tool === 'circle') {
      setDraft({ a: p, b: p });
      return;
    }
    if (tool === 'arc') {
      const next = [...arcPts, p];
      if (next.length === 3) {
        onChange(addArc(sketch, next[0], next[1], next[2]), true);
        setArcPts([]);
      } else setArcPts(next);
      return;
    }
    // select: points first, then entities
    const hp = nearestPoint(pt);
    if (hp) {
      setDrag(hp);
      onSelect(selection.includes(hp) ? selection : [...selection.filter((x) => sketch.points.some((q) => q.id === x) || sketch.entities.some((e) => e.id === x)), hp].slice(-3));
      return;
    }
    const he = hitEntity(pt);
    if (he) onSelect(selection.includes(he) ? selection.filter((x) => x !== he) : [...selection, he].slice(-3));
    else onSelect([]);
  };

  const hitEntity = (p: Vec2) => {
    const tol = tolMm();
    let best: string | null = null;
    let bd = tol;
    for (const e of sketch.entities) {
      let d = Infinity;
      if (e.kind === 'line') d = segDist(p, pointOf(sketch, e.a), pointOf(sketch, e.b));
      else if (e.kind === 'circle') d = Math.abs(Math.hypot(p[0] - pointOf(sketch, e.c)[0], p[1] - pointOf(sketch, e.c)[1]) - e.r);
      else {
        const pts = arcPoints(sketch, e, 16);
        for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, segDist(p, pts[i], pts[i + 1]));
      }
      if (d < bd) {
        bd = d;
        best = e.id;
      }
    }
    return best;
  };

  const move = (pt: Vec2) => {
    setCursor(sn(pt));
    if (drag) {
      onChange(dragSolve(sketch, drag, sn(pt)), false);
      return;
    }
    if (draft) setDraft({ ...draft, b: sn(pt) });
  };
  const up = () => {
    if (drag) {
      onChange(sketch, true);
      setDrag(null);
      return;
    }
    if (draft && tool === 'rect') {
      const { a, b } = draft;
      if (Math.abs(a[0] - b[0]) > 1 && Math.abs(a[1] - b[1]) > 1) onChange(solve(addRect(sketch, a[0], a[1], b[0], b[1])), true);
    }
    if (draft && tool === 'circle') {
      const r = Math.hypot(draft.b[0] - draft.a[0], draft.b[1] - draft.a[1]);
      if (r > 0.5) onChange(addCircle(sketch, draft.a[0], draft.a[1], r)[0], true);
    }
    setDraft(null);
  };

  const glyphs: { at: Vec2; text: string; color: string }[] = [];
  if (showGlyphs)
    for (const c of sketch.constraints) {
      const e0 = sketch.entities.find((e) => e.id === c.refs[0]);
      let at: Vec2 | null = null;
      if (e0?.kind === 'line') {
        const a = pointOf(sketch, e0.a),
          b = pointOf(sketch, e0.b);
        at = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      } else if (e0 && (e0.kind === 'circle' || e0.kind === 'arc')) {
        const cc = pointOf(sketch, e0.c);
        at = [cc[0] + (e0.kind === 'circle' ? e0.r : 0) * 0.7, cc[1] + (e0.kind === 'circle' ? e0.r : 0) * 0.7];
      } else if (sketch.points.some((p) => p.id === c.refs[0])) {
        const p0 = pointOf(sketch, c.refs[0]);
        at = c.refs[1] && sketch.points.some((p) => p.id === c.refs[1]) ? [(p0[0] + pointOf(sketch, c.refs[1])[0]) / 2, (p0[1] + pointOf(sketch, c.refs[1])[1]) / 2] : p0;
      }
      if (!at) continue;
      const text = isDimension(c.type) ? `${c.type === 'radius' ? 'Ø' : ''}${fmt(c.type === 'radius' ? (c.value ?? 0) * 2 : Math.abs(c.value ?? 0), 1)}` : CONSTRAINT_GLYPH[c.type];
      glyphs.push({ at, text, color: isDimension(c.type) ? '#ffd166' : '#b9a7ff' });
    }

  return (
    <SketchView
      extent={extent}
      center={center}
      onScale={(k) => (px.current = k)}
      onDown={({ pt }) => down(pt)}
      onMove={({ pt }) => move(pt)}
      onUp={up}
    >
      {sketch.entities.map((e) => {
        if (e.kind === 'line') {
          const a = pointOf(sketch, e.a),
            b = pointOf(sketch, e.b);
          return <line key={e.id} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={lineColor([e.a, e.b], e.id)} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />;
        }
        if (e.kind === 'circle') {
          const c = pointOf(sketch, e.c);
          const col = selection.includes(e.id) ? COL.sel : conflict ? COL.conflict : info?.determinedPoints.has(e.c) && info.determinedCircles.has(e.id) ? COL.full : COL.under;
          return <circle key={e.id} cx={c[0]} cy={c[1]} r={e.r} fill="none" stroke={col} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />;
        }
        const pts = arcPoints(sketch, e);
        return <polyline key={e.id} points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={lineColor([e.c, e.a, e.b], e.id)} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />;
      })}
      {sketch.points.map((p) => {
        const sel = selection.includes(p.id);
        const det = info?.determinedPoints.has(p.id);
        return <circle key={p.id} cx={p.x} cy={p.y} r={(sel ? 6 : 4) / px.current} fill={sel ? COL.sel : conflict ? COL.conflict : det ? COL.full : COL.under} stroke="#0e141b" strokeWidth={1.5 / px.current} />;
      })}
      {glyphs.map((g, i) => (
        <SketchText key={i} x={g.at[0] + 3 / px.current} y={g.at[1] + 9 / px.current} color={g.color} size={11}>
          {g.text}
        </SketchText>
      ))}
      {draft && tool === 'rect' && (
        <rect x={Math.min(draft.a[0], draft.b[0])} y={Math.min(draft.a[1], draft.b[1])} width={Math.abs(draft.b[0] - draft.a[0])} height={Math.abs(draft.b[1] - draft.a[1])} fill="none" stroke={COL.sel} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      )}
      {draft && tool === 'circle' && <circle cx={draft.a[0]} cy={draft.a[1]} r={Math.hypot(draft.b[0] - draft.a[0], draft.b[1] - draft.a[1])} fill="none" stroke={COL.sel} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
      {tool === 'line' && chain && cursor && <line x1={pointOf(sketch, chain)[0]} y1={pointOf(sketch, chain)[1]} x2={cursor[0]} y2={cursor[1]} stroke={COL.sel} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
      {tool === 'arc' && arcPts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={4 / px.current} fill={COL.sel} />)}
      {tool === 'arc' && arcPts.length > 0 && (
        <SketchText x={arcPts[0][0]} y={arcPts[0][1] - 8 / px.current} color={COL.sel}>
          {arcPts.length === 1 ? 'tap the start point' : 'tap the end (counter-clockwise)'}
        </SketchText>
      )}
    </SketchView>
  );
}

function segDist(p: Vec2, a: Vec2, b: Vec2) {
  const d: Vec2 = [b[0] - a[0], b[1] - a[1]];
  const L2 = d[0] * d[0] + d[1] * d[1] || 1e-9;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / L2));
  return Math.hypot(p[0] - (a[0] + t * d[0]), p[1] - (a[1] + t * d[1]));
}

/* ------------------------- constraint tools ------------------------- */

export function availableConstraints(sk: Sketch, sel: string[]): { type: ConstraintType; refs: string[]; label: string }[] {
  const pts = sel.filter((id) => sk.points.some((p) => p.id === id));
  const ents = sel.map((id) => sk.entities.find((e) => e.id === id)).filter(Boolean) as Sketch['entities'];
  const lines = ents.filter((e) => e.kind === 'line') as SLine[];
  const circ = ents.filter((e) => e.kind !== 'line');
  const out: { type: ConstraintType; refs: string[]; label: string }[] = [];
  if (sel.length === 1 && lines.length === 1) {
    out.push({ type: 'horizontal', refs: [lines[0].id], label: 'Horizontal' }, { type: 'vertical', refs: [lines[0].id], label: 'Vertical' }, { type: 'distance', refs: [lines[0].a, lines[0].b], label: '↔ Length' });
  }
  if (sel.length === 2 && lines.length === 2) {
    out.push({ type: 'parallel', refs: [lines[0].id, lines[1].id], label: 'Parallel ∥' }, { type: 'perpendicular', refs: [lines[0].id, lines[1].id], label: 'Perpendicular ⊥' }, { type: 'equal', refs: [lines[0].id, lines[1].id], label: 'Equal length =' });
  }
  if (sel.length === 1 && circ.length === 1) out.push({ type: 'radius', refs: [circ[0].id], label: 'Ø Diameter' });
  if (sel.length === 2 && circ.length === 2) out.push({ type: 'concentric', refs: [circ[0].id, circ[1].id], label: 'Concentric ◎' }, { type: 'equal', refs: [circ[0].id, circ[1].id], label: 'Equal radius =' });
  if (sel.length === 2 && lines.length === 1 && circ.length === 1) out.push({ type: 'tangent', refs: [lines[0].id, circ[0].id], label: 'Tangent' });
  if (sel.length === 1 && pts.length === 1) out.push({ type: 'fix', refs: [pts[0]], label: '⚓ Fix in place' });
  if (sel.length === 2 && pts.length === 2)
    out.push(
      { type: 'coincident', refs: [pts[0], pts[1]], label: 'Coincident ●' },
      { type: 'distance', refs: [pts[0], pts[1]], label: '↔ Distance' },
      { type: 'hdist', refs: [pts[0], pts[1]], label: '↔ Horizontal dist.' },
      { type: 'vdist', refs: [pts[0], pts[1]], label: '↕ Vertical dist.' },
    );
  if (sel.length === 2 && pts.length === 1 && lines.length === 1) out.push({ type: 'pointLine', refs: [pts[0], lines[0].id], label: '↔ Point–line distance' });
  return out;
}

export function addConstraint(sk: Sketch, type: ConstraintType, refs: string[]): Sketch {
  const c: Constraint = { id: sid('k'), type, refs };
  if (type === 'fix') {
    const p = pointOf(sk, refs[0]);
    c.x = Math.round(p[0]);
    c.y = Math.round(p[1]);
  }
  if (isDimension(type)) c.value = Math.round(measure(sk, type, refs) * 10) / 10;
  return solve({ ...sk, constraints: [...sk.constraints, c] });
}

export function ConstraintPanel({ sketch, selection, onChange, onSelect, dimsOnly = false, allowGeometric = true }: { sketch: Sketch; selection: string[]; onChange: (s: Sketch, commit: boolean) => void; onSelect: (s: string[]) => void; dimsOnly?: boolean; allowGeometric?: boolean }) {
  const avail = availableConstraints(sketch, selection).filter((a) => (dimsOnly ? isDimension(a.type) : allowGeometric || isDimension(a.type)));
  const info = analyse(sketch);
  const statusText = { under: `Under-constrained · ${info.dof} degree${info.dof === 1 ? '' : 's'} of freedom left`, full: 'Fully constrained ✓', redundant: 'Over-constrained (redundant constraint)', conflict: 'Conflicting constraints ✗' }[info.status];
  const statusColor = { under: 'var(--accent)', full: 'var(--good)', redundant: 'var(--warn)', conflict: 'var(--bad)' }[info.status];
  const delEntity = selection.find((id) => sketch.entities.some((e) => e.id === id));
  return (
    <div>
      <div className="hud" style={{ borderColor: statusColor, color: statusColor, marginBottom: 6 }}>
        {statusText}
      </div>
      <div className="lbl">{selection.length ? `${selection.length} selected` : 'Tap lines, circles or points to select (up to 3)'}</div>
      <div className="btnrow" style={{ margin: '6px 0' }}>
        {avail.map((a) => (
          <button key={a.type + a.label} className="btn small" onClick={() => onChange(addConstraint(sketch, a.type, a.refs), true)}>
            {a.label}
          </button>
        ))}
        {delEntity && (
          <button
            className="btn small danger"
            onClick={() => {
              onChange(removeEntity(sketch, delEntity), true);
              onSelect([]);
            }}
          >
            🗑 Delete shape
          </button>
        )}
      </div>
      {sketch.constraints.length > 0 && (
        <details open>
          <summary className="lbl" style={{ cursor: 'pointer' }}>
            Constraints & dimensions ({sketch.constraints.length})
          </summary>
          {sketch.constraints.map((c) => (
            <div key={c.id} className="numrow" style={{ fontSize: 13, minHeight: 34 }}>
              <span style={{ width: 22, textAlign: 'center', color: isDimension(c.type) ? '#ffd166' : '#b9a7ff' }}>{CONSTRAINT_GLYPH[c.type]}</span>
              <span style={{ flex: 1 }}>{CONSTRAINT_LABEL[c.type]}</span>
              {c.type === 'fix' && (
                <span style={{ display: 'flex', gap: 4, width: 150 }}>
                  <NumberField axis="x" value={c.x ?? 0} digits={1} onChange={(v) => onChange(solve({ ...sketch, constraints: sketch.constraints.map((q) => (q.id === c.id ? { ...q, x: v } : q)) }), true)} />
                  <NumberField axis="y" value={c.y ?? 0} digits={1} onChange={(v) => onChange(solve({ ...sketch, constraints: sketch.constraints.map((q) => (q.id === c.id ? { ...q, y: v } : q)) }), true)} />
                </span>
              )}
              {isDimension(c.type) && (
                <span style={{ width: 110 }}>
                  <NumberField
                    value={c.type === 'radius' ? (c.value ?? 0) * 2 : c.value ?? 0}
                    digits={2}
                    onChange={(v) => onChange(solve({ ...sketch, constraints: sketch.constraints.map((q) => (q.id === c.id ? { ...q, value: c.type === 'radius' ? v / 2 : v } : q)) }), true)}
                  />
                </span>
              )}
              <button className="btn small icon ghost" title="Remove constraint" onClick={() => onChange(solve({ ...sketch, constraints: sketch.constraints.filter((q) => q.id !== c.id) }), true)}>
                ✕
              </button>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

export function useSketchHistory(initial: Sketch) {
  const [sk, setSk] = useState(initial);
  const [past, setPast] = useState<Sketch[]>([]);
  const [future, setFuture] = useState<Sketch[]>([]);
  const last = useRef(initial);
  const change = (s: Sketch, commit: boolean) => {
    if (commit) {
      setPast((p) => [...p.slice(-60), last.current]);
      setFuture([]);
      last.current = s;
    }
    setSk(s);
  };
  return {
    sk,
    change,
    reset: (s: Sketch) => {
      setPast((p) => [...p, last.current]);
      last.current = s;
      setSk(s);
    },
    undo: () => {
      if (!past.length) return;
      const prev = past[past.length - 1];
      setFuture((f) => [last.current, ...f]);
      setPast(past.slice(0, -1));
      last.current = prev;
      setSk(prev);
    },
    redo: () => {
      if (!future.length) return;
      const nx = future[0];
      setPast((p) => [...p, last.current]);
      setFuture(future.slice(1));
      last.current = nx;
      setSk(nx);
    },
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
