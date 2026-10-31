import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  add, centroid, dist, fitCircle, fmt, headingDeg, interiorAngles, perimeter, polar, polygonArea, sideLengths, sub, type Vec,
} from '../../../core/geometry';
import { useHistory } from '../../../core/history';
import { detectShape, loopCorners, resample, squareUp, triangleType, type ShapeKind } from '../../../core/shapeDetect';
import { useSettings } from '../../../core/store';
import { DesignLink, Note, NumberTable, Segmented, Slider, Steps, T, ToolBar } from '../../../ui/kit';
import { Workbench } from '../../../ui/lesson';
import { href } from '../../../ui/router';
import { GridLines, Handle } from '../../../ui/svg';
import { SketchLayer, type Stroke } from '../tools/SketchLayer';

const W = 800;
const H = 520;
const SQ = 40;

interface Shape {
  id: number;
  kind: ShapeKind;
  pts: Vec[];
  r?: number;
  reason: string;
  src: Vec[];
}

type Units = 'squares' | 'screen' | 'scale';

const KIND_LABEL: Record<ShapeKind, string> = {
  line: 'Line', triangle: 'Triangle', rectangle: 'Rectangle', quadrilateral: 'Quadrilateral', polygon: 'Polygon', circle: 'Circle', freeform: 'Free shape',
};

function regularize(pts: Vec[]): Vec[] {
  const c = centroid(pts);
  const r = pts.reduce((s, p) => s + dist(p, c), 0) / pts.length;
  const a0 = headingDeg(c, pts[0]);
  const ccw = polygonArea(pts) && (pts[1].x - pts[0].x) * (pts[2].y - pts[0].y) - (pts[1].y - pts[0].y) * (pts[2].x - pts[0].x) < 0;
  return pts.map((_, i) => polar(c, r, a0 + (ccw ? 1 : -1) * (360 * i) / pts.length));
}

function convert(s: Shape, kind: ShapeKind): Shape {
  const src = s.src;
  if (kind === 'circle') {
    const f = fitCircle(src.length > 2 ? src : s.pts);
    return { ...s, kind, pts: [f.c], r: f.r, reason: 'Changed by you: best-fitting circle.' };
  }
  if (kind === 'line') return { ...s, kind, pts: [src[0], src[src.length - 1]], r: undefined, reason: 'Changed by you: straight line between the stroke ends.' };
  if (kind === 'freeform') return { ...s, kind, pts: src, r: undefined, reason: 'Changed by you: kept as drawn.' };
  const want = kind === 'triangle' ? 3 : kind === 'rectangle' || kind === 'quadrilateral' ? 4 : 0;
  let v = loopCorners(src);
  for (let eps = 0.06; want && v.length > want && eps < 0.4; eps += 0.03) v = loopCorners(src, eps);
  if (want && v.length < want) {
    const c = centroid(src);
    v = Array.from({ length: want }, (_, i) => src[Math.floor((i * src.length) / want)] ?? polar(c, 40, i * 90));
  }
  if (kind === 'rectangle' && v.length === 4) v = squareUp(v);
  return { ...s, kind, pts: v, r: undefined, reason: `Changed by you: ${KIND_LABEL[kind].toLowerCase()} with ${v.length} corners.` };
}

export default function SketchToMath() {
  const { pxPerMm } = useSettings();
  const h = useHistory<{ strokes: Stroke[]; shapes: Shape[] }>({ strokes: [], shapes: [] });
  const [sel, setSel] = useState<number | null>(null);
  const [units, setUnits] = useState<Units>('squares');
  const [scaleMm, setScaleMm] = useState(10);
  const [showInk, setShowInk] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const [cssPerUnit, setCssPerUnit] = useState(1);
  const nextId = useRef(1);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCssPerUnit(el.getBoundingClientRect().width / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const k = units === 'squares' ? 1 / SQ : units === 'scale' ? scaleMm / SQ : (cssPerUnit / (pxPerMm ?? 96 / 25.4));
  const unit = units === 'squares' ? 'squares' : 'mm';
  const len = (u: number) => `${fmt(u * k, units === 'squares' ? 2 : 1)} ${unit}`;
  const area = (u2: number) => `${fmt(u2 * k * k, units === 'squares' ? 2 : 0)} ${unit === 'squares' ? 'sq. units' : 'mm²'}`;
  const calibrated = units === 'scale' || (units === 'screen' && pxPerMm !== null);

  const shapes = h.value.shapes;
  const cur = shapes.find((s) => s.id === sel) ?? null;

  const onStroke = (stroke: Stroke) => {
    const det = detectShape(stroke.pts);
    const id = nextId.current++;
    const shape: Shape = { id, kind: det.kind, pts: det.pts, r: det.r, reason: det.reason, src: resample(stroke.pts, 96) };
    h.commit((s) => ({ strokes: [...s.strokes, stroke], shapes: [...s.shapes, shape] }));
    setSel(id);
  };
  const update = (id: number, f: (s: Shape) => Shape) => h.set((st) => ({ ...st, shapes: st.shapes.map((s) => (s.id === id ? f(s) : s)) }));

  const labelsFor = (s: Shape): ReactNode => {
    if (s.kind === 'circle' && s.r) {
      const c = s.pts[0];
      return (
        <g pointerEvents="none">
          <line x1={c.x} y1={c.y} x2={c.x + s.r} y2={c.y} stroke="#1c7ed6" strokeWidth={2} />
          <text x={c.x + s.r / 2} y={c.y - 8} textAnchor="middle" className="svg-label small" fill="#1c7ed6">r ≈ {len(s.r)}</text>
        </g>
      );
    }
    if (s.kind === 'line') {
      const m = { x: (s.pts[0].x + s.pts[1].x) / 2, y: (s.pts[0].y + s.pts[1].y) / 2 };
      return <text x={m.x} y={m.y - 12} textAnchor="middle" className="svg-label small" fill="#1c7ed6" pointerEvents="none">≈ {len(dist(s.pts[0], s.pts[1]))}</text>;
    }
    if (s.kind === 'freeform') return null;
    const c = centroid(s.pts);
    const sides = sideLengths(s.pts);
    const ang = interiorAngles(s.pts);
    return (
      <g pointerEvents="none">
        {s.pts.map((p, i) => {
          const q = s.pts[(i + 1) % s.pts.length];
          const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
          const o = sub(m, c);
          const L = Math.hypot(o.x, o.y) || 1;
          const inner = add(p, { x: ((c.x - p.x) / (dist(c, p) || 1)) * 30, y: ((c.y - p.y) / (dist(c, p) || 1)) * 30 });
          return (
            <g key={i}>
              <text x={m.x + (o.x / L) * 18} y={m.y + (o.y / L) * 18} textAnchor="middle" dominantBaseline="middle" className="svg-label small" fill="#1c7ed6">{len(sides[i])}</text>
              <text x={inner.x} y={inner.y} textAnchor="middle" dominantBaseline="middle" className="svg-label small" fill="#e8590c">{fmt(ang[i], 0)}°</text>
            </g>
          );
        })}
      </g>
    );
  };

  const tool = (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} className="tool" viewBox={`0 0 ${W} ${H}`}>
        <rect width={W} height={H} fill="#fff" />
        <GridLines x0={0} y0={0} w={W} h={H} step={SQ} color="#eef1f6" />
        {showInk && <g opacity={0.35}>{h.value.strokes.map((s, i) => <path key={i} d={s.pts.map((p, j) => `${j ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} fill="none" stroke="#495057" strokeWidth={3} strokeLinecap="round" />)}</g>}
        {shapes.map((s) => {
          const active = s.id === sel;
          const color = active ? '#1971c2' : '#868e96';
          const common = { fill: active ? '#d0ebff55' : 'none', stroke: color, strokeWidth: active ? 3 : 2, style: { cursor: 'pointer' } as const, onPointerDown: () => setSel(s.id) };
          if (s.kind === 'circle' && s.r) return <circle key={s.id} cx={s.pts[0].x} cy={s.pts[0].y} r={s.r} {...common} />;
          if (s.kind === 'line') return <line key={s.id} x1={s.pts[0].x} y1={s.pts[0].y} x2={s.pts[1].x} y2={s.pts[1].y} {...common} strokeWidth={active ? 4 : 3} />;
          if (s.kind === 'freeform') return <path key={s.id} d={s.pts.map((p, j) => `${j ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} {...common} fill="none" />;
          return <path key={s.id} d={s.pts.map((p, j) => `${j ? 'L' : 'M'}${p.x} ${p.y}`).join(' ') + ' Z'} {...common} strokeLinejoin="round" />;
        })}
        <SketchLayer active strokes={[]} onStrokes={() => undefined} onStrokeEnd={onStroke} width={W} height={H} color="#1f2a44" size={3} />
        {cur && labelsFor(cur)}
        {cur && cur.kind === 'circle' && cur.r && (
          <>
            <Handle x={cur.pts[0].x} y={cur.pts[0].y} r={7} color="#495057" title="move the circle" onStart={h.checkpoint} onDrag={(p) => update(cur.id, (s) => ({ ...s, pts: [p] }))} />
            <Handle x={cur.pts[0].x + cur.r} y={cur.pts[0].y} r={8} color="#1c7ed6" title="radius" onStart={h.checkpoint} onDrag={(p) => update(cur.id, (s) => ({ ...s, r: Math.max(5, dist(s.pts[0], p)) }))} />
          </>
        )}
        {cur && cur.kind !== 'circle' && cur.kind !== 'freeform' && cur.pts.map((p, i) => (
          <Handle key={i} x={p.x} y={p.y} r={8} title={`corner ${i + 1}`} onStart={h.checkpoint} onDrag={(q) => update(cur.id, (s) => ({ ...s, pts: s.pts.map((o, j) => (j === i ? q : o)) }))} />
        ))}
      </svg>
      <div className="overlay-badge">✍️ Draw a shape with your finger, mouse or stylus</div>
      <div className="overlay-badge right" style={{ background: calibrated ? '#ebfbee' : '#fff8e6' }}>
        {units === 'squares' ? '⚠ No real scale — measured in grid squares' : units === 'screen' ? (pxPerMm ? '📏 Real size on this screen (calibrated)' : '⚠ Screen not calibrated — sizes are a guess') : `📐 Drawing scale: 1 square = ${scaleMm} mm`}
      </div>
    </div>
  );

  let table: [ReactNode, ReactNode][] = [];
  let extra: ReactNode = null;
  if (cur) {
    if (cur.kind === 'circle' && cur.r) {
      const r = cur.r;
      table = [['radius r', len(r)], ['diameter d = 2r', len(2 * r)], ['circumference C = π × d', len(2 * Math.PI * r)], ['area A = π × r²', area(Math.PI * r * r)]];
    } else if (cur.kind === 'line') {
      const [a, b] = cur.pts;
      table = [['length', len(dist(a, b))], ['angle from horizontal', `${fmt(((headingDeg(a, b) + 180) % 180), 1)}°`]];
    } else if (cur.kind === 'freeform') {
      const closed = dist(cur.pts[0], cur.pts[cur.pts.length - 1]) < 30;
      table = [['length of the line', len(perimeter(cur.pts, false))], ...(closed ? ([['enclosed area', area(polygonArea(cur.pts))]] as [ReactNode, ReactNode][]) : [])];
    } else {
      const sides = sideLengths(cur.pts);
      const ang = interiorAngles(cur.pts);
      table = [
        ...sides.map((s, i) => [`side ${i + 1}`, len(s)] as [ReactNode, ReactNode]),
        ['angles', `${ang.map((a) => `${fmt(a, 0)}°`).join(' + ')} = ${fmt(ang.reduce((x, y) => x + y, 0), 0)}°`],
        ['perimeter', len(perimeter(cur.pts))],
        ['area', area(polygonArea(cur.pts))],
      ];
      if (cur.kind === 'triangle') extra = <p>This looks like a <b>{triangleType(cur.pts)}</b> <T k="triangle" />.</p>;
      if (cur.kind === 'rectangle') {
        const w = (sides[0] + sides[2]) / 2;
        const hh = (sides[1] + sides[3]) / 2;
        extra = <Steps steps={[`width ≈ ${len(w)}, height ≈ ${len(hh)}`, `area ≈ ${len(w)} × ${len(hh)} = ${area(w * hh)}`, `perimeter ≈ 2 × (${len(w)} + ${len(hh)}) = ${len(2 * (w + hh))}`]} />;
      }
    }
  }

  const panel = (
    <div>
      <h3 style={{ marginTop: 0 }}>Sketch-to-Math</h3>
      <p className="muted small">Draw a triangle, rectangle, circle, line or polygon. The lab recognises it and measures it. Drag the corners to correct it.</p>
      <Note kind="approx"><b>Approximate.</b> Measurements come from a hand drawing, so they are estimates — {calibrated ? 'and the scale is set.' : 'and no real-world scale is set yet.'}</Note>
      <div style={{ margin: '8px 0' }}>
        <div className="muted small" style={{ fontWeight: 700 }}>Measure in</div>
        <Segmented small value={units} onChange={setUnits} options={[{ value: 'squares', label: 'grid squares' }, { value: 'scale', label: 'drawing scale' }, { value: 'screen', label: 'real screen mm' }]} />
        {units === 'scale' && <Slider label="1 grid square =" value={scaleMm} min={1} max={100} unit="mm" onChange={setScaleMm} />}
        {units === 'screen' && !pxPerMm && <Note kind="safety">Calibrate your screen first in <a href={href('math', 'level', 5, 'l5-ruler')}>Level 5 → Virtual ruler</a> (Calculate stage). Until then a standard 96 dpi screen is assumed.</Note>}
      </div>
      {shapes.length > 0 && (
        <ul className="shape-list">
          {shapes.map((s, i) => (
            <li key={s.id}>
              <button className={`shape-item${s.id === sel ? ' active' : ''}`} onClick={() => setSel(s.id)}>
                {i + 1}. <b>{KIND_LABEL[s.kind]}</b>
              </button>
            </li>
          ))}
        </ul>
      )}
      {cur && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="toolbar" style={{ justifyContent: 'space-between' }}>
            <b>Detected: {KIND_LABEL[cur.kind]}</b>
            <select className="btn small" value={cur.kind} onChange={(e) => { h.checkpoint(); update(cur.id, (s) => convert(s, e.target.value as ShapeKind)); }} aria-label="correct the shape type">
              {(Object.keys(KIND_LABEL) as ShapeKind[]).map((k2) => <option key={k2} value={k2}>{KIND_LABEL[k2]}</option>)}
            </select>
          </div>
          <p className="muted small">Why: {cur.reason}</p>
          {extra}
          <NumberTable rows={table} />
          <div className="toolbar" style={{ marginTop: 8 }}>
            {(cur.kind === 'rectangle' || cur.kind === 'quadrilateral') && cur.pts.length === 4 && <button className="btn small" onClick={() => { h.checkpoint(); update(cur.id, (s) => ({ ...s, kind: 'rectangle', pts: squareUp(s.pts), reason: 'Squared up: exact right angles.' })); }}>⊾ Square it up</button>}
            {(cur.kind === 'triangle' || cur.kind === 'polygon') && <button className="btn small" onClick={() => { h.checkpoint(); update(cur.id, (s) => ({ ...s, pts: regularize(s.pts), reason: 'Made regular: equal sides and angles.' })); }}>⬡ Make it regular</button>}
            <button className="btn small" onClick={() => { h.commit((st) => ({ strokes: st.strokes, shapes: st.shapes.filter((s) => s.id !== cur.id) })); setSel(null); }}>🗑 Delete shape</button>
          </div>
        </div>
      )}
      {!shapes.length && <Note>Try a rectangle about 6 squares wide and 4 tall — then check: does the lab say about 24 square units?</Note>}
      <DesignLink>Designers sketch first, then measure. A quick sketch that is “about 60 × 40 mm” becomes an exact CAD rectangle in the same way you just corrected the corners.</DesignLink>
    </div>
  );
  const controls = (
    <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => { h.reset({ strokes: [], shapes: [] }); setSel(null); }}>
      <button className={`btn${showInk ? ' active' : ''}`} onClick={() => setShowInk((v) => !v)}>{showInk ? 'Hide' : 'Show'} my ink</button>
    </ToolBar>
  );
  return (
    <div className="level-page">
      <header className="level-head">
        <span className="level-head-icon">✍️</span>
        <div>
          <div className="level-num">Special mode</div>
          <h1>Sketch-to-Math</h1>
        </div>
      </header>
      <Workbench title="Draw, recognise, measure, correct" tool={tool} controls={controls} panel={panel} />
    </div>
  );
}
