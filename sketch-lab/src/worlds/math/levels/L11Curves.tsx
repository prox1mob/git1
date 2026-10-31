import { useMemo, useState, type ReactNode } from 'react';
import { casteljau, curvature, deriv, jointContinuity, meanDistance, pathD, point, sample, segments, smoothNode, type BNode, type Continuity } from '../../../core/bezier';
import { add, angleAt, arcPath, circleFrom3, clamp, dist, fmt, headingDeg, norm, scale, sub, type Vec } from '../../../core/geometry';
import { useHistory } from '../../../core/history';
import { useSettings, type Difficulty } from '../../../core/store';
import { Challenge, ChoiceQuiz, NumberQuiz, type CheckResult } from '../../../ui/feedback';
import { DesignLink, Formula, Note, NumberTable, Segmented, Slider, Steps, T, Toggle, ToolBar } from '../../../ui/kit';
import { Lesson, Workbench, type StageKey } from '../../../ui/lesson';
import { GridLines, Handle } from '../../../ui/svg';

const W = 800;
const H = 460;

/* ================================================================== */
/* Arcs, tangents & fillets                                            */
/* ================================================================== */

function ArcsLesson() {
  const [mode, setMode] = useState<'arc' | 'fillet'>('arc');
  const h = useHistory({ A: { x: 180, y: 360 }, M: { x: 380, y: 170 }, B: { x: 620, y: 330 }, V: { x: 420, y: 380 }, P1: { x: 140, y: 380 }, P2: { x: 520, y: 110 }, r: 80 });
  const s = h.value;
  const circ = circleFrom3(s.A, s.M, s.B);
  let body: ReactNode;
  let rows: [ReactNode, ReactNode][] = [];
  if (mode === 'arc') {
    let arcD = '';
    if (circ) {
      const ha = headingDeg(circ.c, s.A);
      const hm = headingDeg(circ.c, s.M);
      const hb = headingDeg(circ.c, s.B);
      const ccw = (x: number) => (x - ha + 360) % 360;
      const goesCcw = ccw(hm) < ccw(hb);
      const sweep = goesCcw ? ccw(hb) : -(360 - ccw(hb));
      arcD = arcPath(circ.c, circ.r, ha, sweep);
    }
    const tan = (p: Vec) => {
      if (!circ) return null;
      const r = sub(p, circ.c);
      const t = norm({ x: -r.y, y: r.x });
      return [add(p, scale(t, -110)), add(p, scale(t, 110))];
    };
    body = (
      <g>
        {circ && circ.r < 3000 && <circle cx={circ.c.x} cy={circ.c.y} r={circ.r} fill="none" stroke="#dee2e6" strokeDasharray="5 6" />}
        {circ && circ.r < 3000 && (
          <>
            <circle cx={circ.c.x} cy={circ.c.y} r={5} fill="#495057" />
            <line x1={circ.c.x} y1={circ.c.y} x2={s.A.x} y2={s.A.y} stroke="#adb5bd" />
            <line x1={circ.c.x} y1={circ.c.y} x2={s.B.x} y2={s.B.y} stroke="#adb5bd" />
          </>
        )}
        {arcD && <path d={arcD} fill="none" stroke="#099268" strokeWidth={5} strokeLinecap="round" />}
        {!circ && <line x1={s.A.x} y1={s.A.y} x2={s.B.x} y2={s.B.y} stroke="#099268" strokeWidth={5} />}
        {[s.A, s.B].map((p, i) => {
          const t = tan(p);
          return t && <line key={i} x1={t[0].x} y1={t[0].y} x2={t[1].x} y2={t[1].y} stroke="#7048e8" strokeWidth={2} />;
        })}
        <Handle x={s.A.x} y={s.A.y} label="A" onStart={h.checkpoint} onDrag={(p) => h.set((st) => ({ ...st, A: p }))} />
        <Handle x={s.M.x} y={s.M.y} label="M" color="#099268" onStart={h.checkpoint} onDrag={(p) => h.set((st) => ({ ...st, M: p }))} />
        <Handle x={s.B.x} y={s.B.y} label="B" onStart={h.checkpoint} onDrag={(p) => h.set((st) => ({ ...st, B: p }))} />
      </g>
    );
    rows = circ ? [['radius r', `${fmt(circ.r / 10, 2)} mm`], ['curvature κ = 1 ÷ r', `${fmt(10 / circ.r, 4)} per mm`], ['centre', `(${fmt(circ.c.x / 10, 1)}, ${fmt(circ.c.y / 10, 1)}) mm`]] : [['radius', '∞ — the three points are in a straight line'], ['curvature', '0']];
  } else {
    const u1 = norm(sub(s.P1, s.V));
    const u2 = norm(sub(s.P2, s.V));
    const theta = angleAt(s.P1, s.V, s.P2);
    const half = (theta * Math.PI) / 360;
    const tlen = s.r / Math.tan(half);
    const maxT = Math.min(dist(s.V, s.P1), dist(s.V, s.P2));
    const ok = tlen < maxT;
    const t1 = add(s.V, scale(u1, tlen));
    const t2 = add(s.V, scale(u2, tlen));
    const bis = norm(add(u1, u2));
    const C = add(s.V, scale(bis, s.r / Math.sin(half)));
    const cross = u1.x * u2.y - u1.y * u2.x;
    body = (
      <g>
        <path d={`M${s.P1.x} ${s.P1.y} L${s.V.x} ${s.V.y} L${s.P2.x} ${s.P2.y}`} fill="none" stroke="#ced4da" strokeWidth={3} strokeDasharray="6 5" />
        {ok && (
          <>
            <path d={`M${s.P1.x} ${s.P1.y} L${t1.x} ${t1.y} A${s.r} ${s.r} 0 0 ${cross > 0 ? 1 : 0} ${t2.x} ${t2.y} L${s.P2.x} ${s.P2.y}`} fill="none" stroke="#099268" strokeWidth={5} strokeLinejoin="round" />
            <circle cx={C.x} cy={C.y} r={s.r} fill="none" stroke="#dee2e6" strokeDasharray="4 5" />
            <line x1={C.x} y1={C.y} x2={t1.x} y2={t1.y} stroke="#adb5bd" />
            <line x1={C.x} y1={C.y} x2={t2.x} y2={t2.y} stroke="#adb5bd" />
            <circle cx={t1.x} cy={t1.y} r={6} fill="#7048e8" />
            <circle cx={t2.x} cy={t2.y} r={6} fill="#7048e8" />
            <text x={C.x + 8} y={C.y} className="svg-label small" fill="#495057">R{fmt(s.r / 10, 1)}</text>
          </>
        )}
        {!ok && <text x={s.V.x} y={s.V.y + 30} textAnchor="middle" className="svg-label" fill="#e5484d">Radius too big for these edges!</text>}
        <Handle x={s.V.x} y={s.V.y} label="corner" onStart={h.checkpoint} onDrag={(p) => h.set((st) => ({ ...st, V: p }))} />
        <Handle x={s.P1.x} y={s.P1.y} color="#868e96" onStart={h.checkpoint} onDrag={(p) => h.set((st) => ({ ...st, P1: p }))} />
        <Handle x={s.P2.x} y={s.P2.y} color="#868e96" onStart={h.checkpoint} onDrag={(p) => h.set((st) => ({ ...st, P2: p }))} />
      </g>
    );
    rows = [['corner angle', `${fmt(theta, 1)}°`], ['fillet radius', `${fmt(s.r / 10, 1)} mm`], ['corner to tangent point', `r ÷ tan(θ/2) = ${fmt(s.r / 10, 1)} ÷ ${fmt(Math.tan(half), 3)} = ${fmt(tlen / 10, 2)} mm`], ['fits?', ok ? 'yes' : 'no — reduce the radius']];
  }
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} ${H}`}>
      <GridLines x0={0} y0={0} w={W} h={H} step={40} color="#f4f5f7" />
      {body}
    </svg>
  );
  const controls = (
    <>
      <Segmented value={mode} onChange={setMode} options={[{ value: 'arc', label: '◠ Arc through 3 points' }, { value: 'fillet', label: '⌒ Round a corner (fillet)' }]} />
      {mode === 'fillet' && <Slider label="Fillet radius" value={s.r} min={10} max={200} unit="px" onStart={h.checkpoint} onChange={(x) => h.set((st) => ({ ...st, r: x }))} format={(v) => `${fmt(v / 10, 1)} mm`} />}
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>An <T k="arc" /> is a piece of a circle. Any three points (not in a line) sit on exactly one circle. The purple lines are <T k="tangentLine" plural />: they just touch the arc.</p>,
    touch: <p>Drag A, M and B. Then switch to <b>Round a corner</b>.</p>,
    experiment: (
      <ul>
        <li>Pull M close to the line AB. What happens to the radius?</li>
        <li>Look at the tangent at A: what angle does it make with the grey radius line?</li>
        <li>In fillet mode, make the radius as big as possible.</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz question="The tangent line and the radius at the same point always meet at…" options={[{ label: '90° (a right angle)', correct: true, why: 'The tangent is perpendicular to the radius — that is how CAD finds tangents.' }, { label: '45°', why: 'Look at A: the purple line and grey radius make a square corner.' }, { label: 'It changes', why: 'Drag the points: the angle stays 90°.' }]} />
    ),
    understand: (
      <>
        <p>Small radius → tight bend → big <T k="curvature" />. Big radius → gentle bend → small curvature. A straight line is a circle with infinite radius (curvature 0).</p>
        <p>A <b>fillet</b> replaces a sharp corner with an arc that is tangent to both edges, so there is no kink.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'κ', means: 'curvature (kappa): how sharply it bends', color: '#099268' }, ' = 1 ÷ ', { s: 'r', means: 'radius of the bend', color: '#1c7ed6' }]} />
        <Formula parts={[{ s: 't', means: 'distance from the corner to where the fillet starts', color: '#7048e8' }, ' = ', { s: 'r', means: 'fillet radius', color: '#1c7ed6' }, ' ÷ tan(', { s: 'θ', means: 'corner angle', color: '#e8590c' }, ' ÷ 2)']} />
        <NumberQuiz question="A 90° box corner gets a 5 mm fillet. How far from the corner does the curve start? (mm)" answer={5} unit="mm" hint="tan(45°) = 1." solution={<Steps steps={['θ ÷ 2 = 45°', 't = 5 ÷ tan 45° = 5 ÷ 1 = 5 mm']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Phones, remotes and mice use fillets so they feel good in the hand and are safe to touch.</li>
          <li>Moulded plastic needs rounded inner corners so the material flows and does not crack.</li>
          <li>In sketches, draw the tangent lines first, then fit the arc into them.</li>
        </ul>
      </DesignLink>
    ),
  };
  return <Lesson id="l11-arcs" title="Arcs, tangents & fillets" tool={tool} controls={controls} stages={stages} numbers={<NumberTable rows={rows} />} />;
}

/* ================================================================== */
/* Bézier editor (shared by the lesson, challenge and puzzle)          */
/* ================================================================== */

export type NodeMode = 'corner' | 'smooth' | 'symmetric';

const CONT_COLOR: Record<Continuity, string> = { G0: '#e5484d', G1: '#f08c00', C1: '#1c7ed6', G2: '#2b8a3e' };
const CONT_TEXT: Record<Continuity, string> = { G0: 'G0 — connected, but a kink', G1: 'G1 — same direction (tangent)', C1: 'C1 — same direction and speed', G2: 'G2 — same curvature too' };

export function BezierEditor({ nodes, modes, onChange, onStart, showComb = false, castT = null, castSeg = 0, mirrorX, color = '#099268', fixedEnds = false, deviation }: {
  nodes: BNode[]; modes: NodeMode[]; onChange: (n: BNode[]) => void; onStart: () => void; showComb?: boolean; castT?: number | null; castSeg?: number;
  mirrorX?: number; color?: string; fixedEnds?: boolean; deviation?: { p: Vec; q: Vec }[];
}) {
  const segs = segments(nodes);
  const set = (i: number, n: BNode) => onChange(nodes.map((x, j) => (j === i ? n : x)));
  const moveHandle = (i: number, which: 'hin' | 'hout', p: Vec) => {
    let n = { ...nodes[i], [which]: p };
    if (modes[i] !== 'corner' && i > 0 && i < nodes.length - 1) n = smoothNode(n, which, modes[i] === 'symmetric');
    set(i, n);
  };
  const comb: ReactNode[] = [];
  if (showComb) {
    segs.forEach((c, si) => {
      const tips: Vec[] = [];
      for (let k = 0; k <= 30; k++) {
        const t = k / 30;
        const p = point(c, t);
        const d = norm(deriv(c, t));
        const kap = curvature(c, t);
        const tip = add(p, scale({ x: -d.y, y: d.x }, -kap * 2500));
        tips.push(tip);
        comb.push(<line key={`${si}-${k}`} x1={p.x} y1={p.y} x2={tip.x} y2={tip.y} stroke="#e599f7" strokeWidth={1} />);
      }
      comb.push(<path key={`env${si}`} d={tips.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} fill="none" stroke="#ae3ec9" strokeWidth={1.5} />);
    });
  }
  let cast: ReactNode = null;
  if (castT !== null && segs[castSeg]) {
    const lv = casteljau(segs[castSeg], castT);
    const cols = ['#adb5bd', '#4dabf7', '#f08c00', '#e5484d'];
    cast = (
      <g pointerEvents="none">
        {lv.slice(0, 3).map((pts, li) => (
          <g key={li}>
            {pts.slice(1).map((p, i) => <line key={i} x1={pts[i].x} y1={pts[i].y} x2={p.x} y2={p.y} stroke={cols[li]} strokeWidth={li ? 2 : 1} />)}
            {li > 0 && pts.map((p, i) => <circle key={`c${i}`} cx={p.x} cy={p.y} r={4} fill={cols[li]} />)}
          </g>
        ))}
        <circle cx={lv[3][0].x} cy={lv[3][0].y} r={8} fill="#e5484d" stroke="#fff" strokeWidth={2} />
      </g>
    );
  }
  const d = pathD(nodes);
  return (
    <g>
      {mirrorX !== undefined && <path d={d} transform={`matrix(-1 0 0 1 ${2 * mirrorX} 0)`} fill="none" stroke={color} strokeWidth={4} opacity={0.35} />}
      {comb}
      <path d={d} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" />
      {deviation?.map((dv, i) => <line key={i} x1={dv.p.x} y1={dv.p.y} x2={dv.q.x} y2={dv.q.y} stroke="#e5484d" strokeWidth={2} />)}
      {cast}
      {nodes.map((n, i) => (
        <g key={i}>
          {i > 0 && <line x1={n.p.x} y1={n.p.y} x2={n.hin.x} y2={n.hin.y} stroke="#868e96" strokeDasharray="3 3" />}
          {i < nodes.length - 1 && <line x1={n.p.x} y1={n.p.y} x2={n.hout.x} y2={n.hout.y} stroke="#868e96" strokeDasharray="3 3" />}
        </g>
      ))}
      {nodes.map((n, i) => (
        <g key={`h${i}`}>
          {i > 0 && <Handle x={n.hin.x} y={n.hin.y} r={7} color="#4dabf7" onStart={onStart} onDrag={(p) => moveHandle(i, 'hin', p)} title={`handle in ${i + 1}`} />}
          {i < nodes.length - 1 && <Handle x={n.hout.x} y={n.hout.y} r={7} color="#4dabf7" onStart={onStart} onDrag={(p) => moveHandle(i, 'hout', p)} title={`handle out ${i + 1}`} />}
          {!(fixedEnds && (i === 0 || i === nodes.length - 1)) ? (
            <Handle x={n.p.x} y={n.p.y} r={9} shape="square" color={i > 0 && i < nodes.length - 1 ? CONT_COLOR[jointContinuity(nodes, i).level] : '#1f2a44'} onStart={onStart} title={`point ${i + 1}`}
              onDrag={(p) => { const dlt = sub(p, n.p); set(i, { p, hin: add(n.hin, dlt), hout: add(n.hout, dlt) }); }} />
          ) : (
            <rect x={n.p.x - 6} y={n.p.y - 6} width={12} height={12} fill="#1f2a44" />
          )}
        </g>
      ))}
    </g>
  );
}

const START_NODES: BNode[] = [
  { p: { x: 110, y: 360 }, hin: { x: 60, y: 360 }, hout: { x: 170, y: 160 } },
  { p: { x: 380, y: 220 }, hin: { x: 300, y: 300 }, hout: { x: 470, y: 180 } },
  { p: { x: 680, y: 320 }, hin: { x: 620, y: 140 }, hout: { x: 740, y: 340 } },
];

function BezierLesson() {
  const h = useHistory<{ nodes: BNode[]; modes: NodeMode[] }>({ nodes: START_NODES, modes: ['corner', 'corner', 'corner'] });
  const { nodes, modes } = h.value;
  const [comb, setComb] = useState(false);
  const [cast, setCast] = useState(false);
  const [t, setT] = useState(0.5);
  const [seg, setSeg] = useState(0);
  const joints = nodes.slice(1, -1).map((_, k) => jointContinuity(nodes, k + 1));
  const setMode = (i: number, m: NodeMode) =>
    h.commit((s) => {
      const ns = s.nodes.slice();
      if (m !== 'corner') ns[i] = smoothNode(ns[i], 'hout', m === 'symmetric');
      return { nodes: ns, modes: s.modes.map((x, j) => (j === i ? m : x)) };
    });
  const addNode = () =>
    h.commit((s) => {
      const last = s.nodes[s.nodes.length - 1];
      const p = { x: Math.min(760, last.p.x + 40), y: clamp(last.p.y - 80, 40, 420) };
      const ns = s.nodes.slice(0, -1).concat([{ ...last, hout: add(last.p, sub(last.p, last.hin)) }, { p, hin: add(p, { x: -40, y: 40 }), hout: add(p, { x: 40, y: -40 }) }]);
      return { nodes: ns, modes: [...s.modes, 'corner'] };
    });
  const removeNode = () => h.commit((s) => (s.nodes.length > 2 ? { nodes: s.nodes.slice(0, -1), modes: s.modes.slice(0, -1) } : s));
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} ${H}`}>
      <GridLines x0={0} y0={0} w={W} h={H} step={40} color="#f4f5f7" />
      <BezierEditor nodes={nodes} modes={modes} onChange={(n) => h.set((s) => ({ ...s, nodes: n }))} onStart={h.checkpoint} showComb={comb} castT={cast ? t : null} castSeg={seg} />
    </svg>
  );
  const controls = (
    <>
      <div className="row">
        {joints.map((j, k) => (
          <span key={k} className="toolbar" style={{ border: `2px solid ${CONT_COLOR[j.level]}`, borderRadius: 10, padding: '4px 8px' }}>
            <b style={{ color: CONT_COLOR[j.level] }}>Joint {k + 2}: {j.level}</b>
            <Segmented small value={modes[k + 1]} onChange={(m) => setMode(k + 1, m)} options={[{ value: 'corner', label: 'corner' }, { value: 'smooth', label: 'smooth' }, { value: 'symmetric', label: 'symmetric' }]} />
          </span>
        ))}
      </div>
      <div className="row">
        <Toggle label="Curvature comb" checked={comb} onChange={setComb} />
        <Toggle label="Show how it is built (de Casteljau)" checked={cast} onChange={setCast} />
        {cast && <Slider label="t" value={t} min={0} max={1} step={0.01} onChange={setT} />}
        {cast && nodes.length > 2 && <Segmented small value={seg} onChange={setSeg} options={segments(nodes).map((_, i) => ({ value: i, label: `segment ${i + 1}` }))} />}
      </div>
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()}>
        <button className="btn" onClick={addNode} disabled={nodes.length >= 6}>＋ point</button>
        <button className="btn" onClick={removeNode} disabled={nodes.length <= 2}>− point</button>
      </ToolBar>
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A smooth <T k="curve" /> made of Bézier pieces. Squares are points the curve passes through. Blue dots are <b>handles</b>: they pull the curve without touching it.</p>,
    touch: <p>Drag squares and blue handles. The coloured square in the middle shows how smooth the join is.</p>,
    experiment: (
      <ul>
        <li>Make a sharp kink at joint 2. Then set it to <b>smooth</b>.</li>
        <li>Turn on <b>Curvature comb</b>: tall bristles = tight bend. Does the comb jump at the joint?</li>
        <li>Turn on <b>Show how it is built</b> and slide t from 0 to 1.</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz question="When is the join between two pieces free of a visible kink?" options={[{ label: 'When the two handles at the joint are in one straight line', correct: true, why: 'Then the curve leaves the joint in the same direction it arrived: tangent continuity (G1).' }, { label: 'Whenever the pieces touch', why: 'Touching (G0) still allows a sharp corner — try "corner" mode.' }]} />
    ),
    understand: (
      <>
        <p>A cubic Bézier piece is built by repeated <b>in-between points</b>: go a fraction t along each control line, then along the lines between those points… until one point is left. That point traces the curve.</p>
        <ul>
          <li><b style={{ color: CONT_COLOR.G0 }}>G0</b>: pieces touch.</li>
          <li><b style={{ color: CONT_COLOR.G1 }}>G1</b>: same direction — no kink.</li>
          <li><b style={{ color: CONT_COLOR.G2 }}>G2</b>: same curvature too — reflections flow smoothly (premium products).</li>
        </ul>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'B(t)', means: 'the point on the curve at fraction t (0 = start, 1 = end)', color: '#099268' }, ' = (1−t)³P₀ + 3(1−t)²t P₁ + 3(1−t)t² P₂ + t³P₃']} caption="P₀ and P₃ are the end squares; P₁ and P₂ are the handles. Each term is a weight — the weights always add up to 1." />
        <NumberQuiz question="At t = 0.5, what weight does P₀ get? (1−t)³ = ?" answer={0.125} tolerance={0.001} hint="(1 − 0.5)³ = 0.5 × 0.5 × 0.5." solution={<Steps steps={['1 − 0.5 = 0.5', '0.5³ = 0.125']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Every font, logo and CAD surface is made of Bézier curves (or their big cousins, NURBS).</li>
          <li>Car and phone designers check the curvature comb: a smooth comb means a smooth reflection.</li>
          <li>Sketch tip: draw long, light, confident strokes — your arm naturally makes smooth (G2-like) curves.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={joints.map((j, k) => [`joint ${k + 2}`, `${CONT_TEXT[j.level]} · kink ${fmt(j.kinkDeg, 1)}° · curvature ${fmt(j.curvA * 1000, 2)} vs ${fmt(j.curvB * 1000, 2)} (×10⁻³)`] as [ReactNode, ReactNode])} />
  );
  return <Lesson id="l11-bezier" title="Bézier curve editor" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Curve Master (challenge + puzzle)                                   */
/* ================================================================== */

interface Target {
  id: string;
  name: string;
  nodes: BNode[];
  base?: [Vec, Vec];
  mirrorX?: number;
}

const N = (px: number, py: number, ix: number, iy: number, ox: number, oy: number): BNode => ({ p: { x: px, y: py }, hin: { x: ix, y: iy }, hout: { x: ox, y: oy } });

export const TARGETS: Target[] = [
  { id: 'mouse', name: '🖱️ Computer mouse', base: [{ x: 170, y: 380 }, { x: 650, y: 380 }], nodes: [N(170, 380, 150, 380, 140, 280), N(300, 195, 210, 205, 400, 183), N(650, 370, 560, 215, 660, 380)] },
  { id: 'sneaker', name: '👟 Sneaker', base: [{ x: 150, y: 380 }, { x: 680, y: 380 }], nodes: [N(150, 380, 150, 390, 130, 300), N(205, 205, 175, 240, 235, 170), N(360, 215, 300, 240, 420, 190), N(680, 370, 650, 250, 690, 385)] },
  { id: 'bottle', name: '🍶 Bottle (half profile, mirrored)', mirrorX: 400, base: [{ x: 270, y: 420 }, { x: 530, y: 420 }], nodes: [N(530, 420, 530, 430, 545, 380), N(545, 300, 548, 350, 542, 240), N(455, 150, 520, 175, 440, 135), N(450, 70, 450, 100, 450, 60)] },
];

function startFor(t: Target): BNode[] {
  const a = t.nodes[0].p;
  const b = t.nodes[t.nodes.length - 1].p;
  const n = t.nodes.length;
  return t.nodes.map((_, i) => {
    const k = i / (n - 1);
    const p = i === 0 ? a : i === n - 1 ? b : { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - 60 };
    const dir = norm(sub(b, a));
    const l = dist(a, b) / (3 * (n - 1));
    return { p, hin: sub(p, scale(dir, l)), hout: add(p, scale(dir, l)) };
  });
}

export function CurveMaster({ id, title }: { id: string; title: string }) {
  const { difficulty } = useSettings();
  const pickTarget = (d: Difficulty) => TARGETS[d === 'easy' ? 0 : d === 'normal' ? 1 : 2];
  const [target, setTarget] = useState<Target>(() => pickTarget(difficulty));
  const h = useHistory<{ nodes: BNode[]; modes: NodeMode[] }>(() => ({ nodes: startFor(target), modes: target.nodes.map(() => 'smooth' as NodeMode) }));
  const [dev, setDev] = useState<{ p: Vec; q: Vec }[] | undefined>();
  const [ghost, setGhost] = useState(false);
  const tol = difficulty === 'easy' ? 7 : difficulty === 'normal' ? 5 : 3.5;
  const userPts = useMemo(() => sample(h.value.nodes, 50), [h.value.nodes]);
  const tgtPts = useMemo(() => sample(target.nodes, 50), [target]);
  const a = meanDistance(userPts, tgtPts);
  const b = meanDistance(tgtPts, userPts);
  const score = (a.mean + b.mean) / 2;
  const match = clamp(100 - score * 4, 0, 100);
  const kinks = h.value.nodes.slice(1, -1).map((_, k) => jointContinuity(h.value.nodes, k + 1)).filter((j) => j.level === 'G0').length;
  const choose = (t: Target) => {
    setTarget(t);
    h.reset({ nodes: startFor(t), modes: t.nodes.map(() => 'smooth') });
    setDev(undefined);
    setGhost(false);
  };
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} ${H}`}>
      <GridLines x0={0} y0={0} w={W} h={H} step={40} color="#f4f5f7" />
      {target.base && <line x1={target.base[0].x} y1={target.base[0].y} x2={target.base[1].x} y2={target.base[1].y} stroke="#495057" strokeWidth={4} />}
      <path d={pathD(target.nodes)} fill="none" stroke={ghost ? '#2b8a3e' : '#adb5bd'} strokeWidth={ghost ? 3 : 12} opacity={difficulty === 'hard' && !ghost ? 0.35 : 0.6} strokeLinecap="round" />
      {target.mirrorX !== undefined && <path d={pathD(target.nodes)} transform={`matrix(-1 0 0 1 ${2 * target.mirrorX} 0)`} fill="none" stroke="#adb5bd" strokeWidth={12} opacity={0.3} />}
      <BezierEditor nodes={h.value.nodes} modes={h.value.modes} onChange={(n) => { h.set((s) => ({ ...s, nodes: n })); setDev(undefined); }} onStart={h.checkpoint} fixedEnds mirrorX={target.mirrorX} color="#1971c2" deviation={dev} />
      <text x={16} y={28} className="svg-label" fill={match > 85 ? '#2b8a3e' : '#495057'}>Match {fmt(match, 0)}% · average gap {fmt(score, 1)} px</text>
    </svg>
  );
  const check = (): CheckResult => {
    if (kinks && difficulty !== 'easy') return { ok: false, happened: `${kinks} joint${kinks > 1 ? 's have' : ' has'} a kink (red square).`, why: 'A product surface should flow without sharp breaks. Set the joint to smooth.' };
    if (score <= tol) return { ok: true, happened: `Average gap ${fmt(score, 1)} px — a ${fmt(match, 0)}% match.`, why: 'You shaped a real product silhouette with a handful of control points.' };
    const lines = userPts.filter((_, i) => i % 3 === 0).map((p) => {
      let best = tgtPts[0];
      for (const q of tgtPts) if (dist(p, q) < dist(p, best)) best = q;
      return { p, q: best };
    }).filter((l) => dist(l.p, l.q) > tol * 1.5);
    setDev(lines);
    const worst = userPts[a.at];
    const where = worst.x < 300 ? 'near the back (left)' : worst.x > 500 ? 'near the front (right)' : 'in the middle';
    return { ok: false, happened: <>Average gap {fmt(score, 1)} px (needs ≤ {tol}). The biggest gap is {where} — red lines show where.</>, why: 'Move the square points onto the grey outline first, then use the handles to set the direction the curve leaves each point.' };
  };
  const panel = (
    <Challenge
      id={id}
      title={title}
      brief={
        <>
          <p>Bend the blue curve to match the grey <b>{target.name}</b> silhouette.</p>
          <div className="toolbar">{TARGETS.map((t) => <button key={t.id} className={`btn small${t.id === target.id ? ' active' : ''}`} onClick={() => choose(t)}>{t.name}</button>)}</div>
          <p className="muted small">Tolerance {tol} px{difficulty !== 'easy' ? ', and no kinks' : ''}. End points are fixed.</p>
        </>
      }
      check={check}
      onResult={(r) => { if (!r || r.ok) setDev(undefined); }}
      hint="Put each square exactly on the outline, at the highest point or where the curve changes direction. Handles lie along the direction of the outline."
      solution={<><p>The exact outline is drawn thin and green. Place squares on its turning points; point the handles along it.</p><button className="btn small" onClick={() => setGhost(true)}>Show the exact outline</button></>}
    >
      {kinks > 0 && <Note>Red square = a kink (G0). Use the Bézier editor lesson to see why.</Note>}
    </Challenge>
  );
  return <Workbench title={title} tool={tool} controls={<ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />} panel={panel} />;
}

function CurveChallenge() {
  return <CurveMaster id="l11-challenge" title="Challenge: mouse & sneaker profiles" />;
}

export default {
  'l11-arcs': ArcsLesson,
  'l11-bezier': BezierLesson,
  'l11-challenge': CurveChallenge,
};

