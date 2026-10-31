import { useState, type ReactNode } from 'react';
import { clamp, fmt, pick, radToDeg, randInt, snap, type Vec } from '../../../core/geometry';
import { useHistory } from '../../../core/history';
import { useSettings, type Difficulty } from '../../../core/store';
import { Challenge, ChoiceQuiz, NumberQuiz, type CheckResult } from '../../../ui/feedback';
import { DesignLink, Formula, Note, NumberTable, Segmented, Slider, Steps, T, Toggle, ToolBar } from '../../../ui/kit';
import { Lesson, Workbench, type StageKey } from '../../../ui/lesson';
import { Handle, toLocal } from '../../../ui/svg';

const W = 800;
const H = 560;
const U = 36;
const OX = 400;
const OY = 280;
const XMAX = 10;
const YMAX = 7;
export const sx = (x: number) => OX + x * U;
export const sy = (y: number) => OY - y * U;
const toXY = (p: Vec) => ({ x: (p.x - OX) / U, y: (OY - p.y) / U });

export function Axes({ children, onTap }: { children?: ReactNode; onTap?: (p: Vec) => void }) {
  const lines: ReactNode[] = [];
  for (let x = -XMAX; x <= XMAX; x++) {
    lines.push(<line key={`x${x}`} x1={sx(x)} y1={sy(-YMAX)} x2={sx(x)} y2={sy(YMAX)} stroke={x === 0 ? '#1f2a44' : '#e3e8f2'} strokeWidth={x === 0 ? 2 : 1} />);
    if (x !== 0) lines.push(<text key={`tx${x}`} x={sx(x)} y={OY + 16} fontSize={11} textAnchor="middle" fill="#868e96">{x}</text>);
  }
  for (let y = -YMAX; y <= YMAX; y++) {
    lines.push(<line key={`y${y}`} x1={sx(-XMAX)} y1={sy(y)} x2={sx(XMAX)} y2={sy(y)} stroke={y === 0 ? '#1f2a44' : '#e3e8f2'} strokeWidth={y === 0 ? 2 : 1} />);
    if (y !== 0) lines.push(<text key={`ty${y}`} x={OX - 8} y={sy(y) + 4} fontSize={11} textAnchor="end" fill="#868e96">{y}</text>);
  }
  return (
    <svg
      className="tool"
      viewBox={`0 0 ${W} ${H}`}
      onPointerDown={onTap ? (e) => {
        if ((e.target as Element).closest('.handle')) return;
        onTap(toXY(toLocal(e.currentTarget as unknown as SVGGraphicsElement, e.clientX, e.clientY)));
      } : undefined}
    >
      <rect x={0} y={0} width={W} height={H} fill="#fff" />
      {lines}
      <text x={sx(XMAX) - 4} y={OY - 8} fontSize={14} fontWeight={800} textAnchor="end" fill="#1f2a44">x</text>
      <text x={OX + 8} y={sy(YMAX) + 14} fontSize={14} fontWeight={800} fill="#1f2a44">y</text>
      <text x={OX - 8} y={OY + 16} fontSize={11} textAnchor="end" fill="#868e96">0</text>
      {children}
    </svg>
  );
}

function clampXY(p: Vec, step: number): Vec {
  return { x: clamp(snap(p.x, step), -XMAX, XMAX), y: clamp(snap(p.y, step), -YMAX, YMAX) };
}

const coord = (p: Vec, dp = 1) => `(${fmt(p.x, dp)}, ${fmt(p.y, dp)})`;

/* ================================================================== */
/* The X–Y grid                                                        */
/* ================================================================== */

function GridLesson() {
  const { difficulty } = useSettings();
  const h = useHistory<Vec>({ x: 3, y: 2 });
  const P = h.value;
  const [snapOn, setSnapOn] = useState(true);
  const [game, setGame] = useState(false);
  const [target, setTarget] = useState<Vec>({ x: -4, y: 3 });
  const [score, setScore] = useState(0);
  const step = snapOn ? (difficulty === 'hard' ? 0.5 : 1) : 0.1;
  const quadrant = P.x === 0 || P.y === 0 ? 'on an axis' : P.x > 0 ? (P.y > 0 ? 'quadrant I (+, +)' : 'quadrant IV (+, −)') : P.y > 0 ? 'quadrant II (−, +)' : 'quadrant III (−, −)';
  const hit = game && Math.abs(P.x - target.x) < 0.01 && Math.abs(P.y - target.y) < 0.01;
  const swapped = game && !hit && Math.abs(P.x - target.y) < 0.01 && Math.abs(P.y - target.x) < 0.01;
  const signFlip = game && !hit && !swapped && Math.abs(Math.abs(P.x) - Math.abs(target.x)) < 0.01 && Math.abs(Math.abs(P.y) - Math.abs(target.y)) < 0.01;
  const newTarget = () => {
    const r = difficulty === 'easy' ? () => randInt(1, 6) : () => randInt(-6, 6);
    setTarget({ x: r(), y: difficulty === 'easy' ? randInt(1, 5) : randInt(-5, 5) });
  };
  const tool = (
    <div style={{ position: 'relative' }}>
      <Axes>
        <line x1={sx(P.x)} y1={sy(P.y)} x2={sx(P.x)} y2={OY} stroke="#1c7ed6" strokeWidth={2} strokeDasharray="6 4" />
        <line x1={sx(P.x)} y1={sy(P.y)} x2={OX} y2={sy(P.y)} stroke="#c2255c" strokeWidth={2} strokeDasharray="6 4" />
        <text x={sx(P.x)} y={OY + (P.y >= 0 ? 32 : -22)} textAnchor="middle" className="svg-label" fill="#1c7ed6">x = {fmt(P.x, 1)}</text>
        <text x={OX + (P.x >= 0 ? -12 : 12)} y={sy(P.y) - 6} textAnchor={P.x >= 0 ? 'end' : 'start'} className="svg-label" fill="#c2255c">y = {fmt(P.y, 1)}</text>
        {game && <circle cx={sx(target.x)} cy={sy(target.y)} r={hit ? 16 : 0} fill="none" stroke="#2b8a3e" strokeWidth={3} />}
        <Handle x={sx(P.x)} y={sy(P.y)} r={10} color="#e8590c" label={coord(P)} labelOffset={{ x: 0, y: -20 }} onStart={h.checkpoint} step={U * step}
          onDrag={(p) => h.set(clampXY(toXY(p), step))} />
      </Axes>
      <div className="overlay-badge">P = {coord(P)} · {quadrant}</div>
      {game && <div className="overlay-badge right" style={{ fontSize: 16 }}>Go to <b>{coord(target, 1)}</b> · score {score}</div>}
    </div>
  );
  const controls = (
    <>
      <Toggle label="Snap to grid" checked={snapOn} onChange={setSnapOn} />
      <Toggle label="🎯 Target game" checked={game} onChange={(v) => { setGame(v); if (v) newTarget(); }} />
      {game && hit && <button className="btn primary" onClick={() => { setScore((s) => s + 1); newTarget(); }}>✔ Got it! Next target</button>}
      {swapped && <Note kind="safety">You are at {coord(P)} — x and y are swapped. x goes across first, then y goes up.</Note>}
      {signFlip && <Note kind="safety">Right numbers, wrong direction: negative x is left of 0, negative y is below 0.</Note>}
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>Two number lines cross at 0: the <b>x</b> <T k="axis" /> across and the <b>y</b> axis up. Every point has an address: its <T k="coordinates" /> (x, y).</p>,
    touch: <p>Drag the orange point P. The dashed lines drop down to x and across to y.</p>,
    experiment: (
      <ul>
        <li>Put P at (0, 0) — the <T k="origin" />.</li>
        <li>Move P left of the y axis. What sign does x get?</li>
        <li>Turn on <b>🎯 Target game</b> and hit five targets.</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz question="P is at (−3, 2). Where is it?" options={[{ label: '3 left, 2 up', correct: true, why: 'x comes first: −3 means 3 steps left. Then y: +2 means 2 up.' }, { label: '2 left, 3 up', why: 'That would be (−2, 3) — x and y swapped.' }, { label: '3 right, 2 down', why: 'Both signs are flipped. Negative x means left.' }]} />
    ),
    understand: (
      <>
        <p>Read coordinates like walking: first <b>across</b> (x), then <b>up or down</b> (y). “Along the corridor, then up the stairs.”</p>
        <p>Right and up are positive; left and down are negative. The axes cut the plane into 4 quadrants.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={['P = (', { s: 'x', means: 'how far across from 0 (right +, left −)', color: '#1c7ed6' }, ', ', { s: 'y', means: 'how far up from 0 (up +, down −)', color: '#c2255c' }, ')']} />
        <NumberQuiz question="A point moves from (2, 5) by 4 steps left. What is its new x?" answer={-2} hint="Left means subtract from x." solution={<Steps steps={['x: 2 − 4 = −2', 'y stays 5', 'new point (−2, 5)']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Every drawing app, CAD program and laser cutter stores shapes as lists of (x, y) points.</li>
          <li>Engineering drawings place holes by coordinates measured from a corner (a <i>datum</i>).</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[['x (across)', fmt(P.x, 2)], ['y (up)', fmt(P.y, 2)], ['Coordinates', coord(P, 2)], ['Where', quadrant], ['Distance from origin', `√(${fmt(P.x, 1)}² + ${fmt(P.y, 1)}²) = ${fmt(Math.hypot(P.x, P.y), 2)}`]]} />
  );
  return <Lesson id="l7-grid" title="The X–Y grid" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Distance & midpoint                                                 */
/* ================================================================== */

function DistanceLesson() {
  const h = useHistory({ A: { x: -5, y: -2 }, B: { x: 3, y: 4 } });
  const { A, B } = h.value;
  const [squares, setSquares] = useState(false);
  const [snapOn, setSnapOn] = useState(true);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const d = Math.hypot(dx, dy);
  const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const C = { x: B.x, y: A.y };
  const step = snapOn ? 1 : 0.1;
  const sq = (p: Vec, q: Vec, color: string) => {
    // square built outward on segment p→q (screen coords)
    const a = { x: sx(p.x), y: sy(p.y) };
    const b = { x: sx(q.x), y: sy(q.y) };
    const n = { x: -(b.y - a.y), y: b.x - a.x };
    return <path d={`M${a.x} ${a.y} L${b.x} ${b.y} L${b.x + n.x} ${b.y + n.y} L${a.x + n.x} ${a.y + n.y} Z`} fill={`${color}22`} stroke={color} strokeDasharray="4 3" />;
  };
  const tool = (
    <div style={{ position: 'relative' }}>
      <Axes>
        {squares && (
          <>
            {sq(A, C, '#1c7ed6')}
            {sq(C, B, '#c2255c')}
            {sq(B, A, '#2b8a3e')}
          </>
        )}
        <line x1={sx(A.x)} y1={sy(A.y)} x2={sx(C.x)} y2={sy(C.y)} stroke="#1c7ed6" strokeWidth={3} />
        <line x1={sx(C.x)} y1={sy(C.y)} x2={sx(B.x)} y2={sy(B.y)} stroke="#c2255c" strokeWidth={3} />
        <line x1={sx(A.x)} y1={sy(A.y)} x2={sx(B.x)} y2={sy(B.y)} stroke="#2b8a3e" strokeWidth={4} />
        <text x={(sx(A.x) + sx(C.x)) / 2} y={sy(A.y) + (dy >= 0 ? 20 : -10)} textAnchor="middle" className="svg-label" fill="#1c7ed6">across {fmt(Math.abs(dx), 1)}</text>
        <text x={sx(C.x) + (dx >= 0 ? 10 : -10)} y={(sy(A.y) + sy(B.y)) / 2} textAnchor={dx >= 0 ? 'start' : 'end'} className="svg-label" fill="#c2255c">up {fmt(Math.abs(dy), 1)}</text>
        <rect x={sx(M.x) - 8} y={sy(M.y) - 8} width={16} height={16} transform={`rotate(45 ${sx(M.x)} ${sy(M.y)})`} fill="#7048e8" />
        <text x={sx(M.x) - 14} y={sy(M.y) - 12} textAnchor="end" className="svg-label" fill="#7048e8">M {coord(M)}</text>
        <Handle x={sx(A.x)} y={sy(A.y)} color="#e8590c" label={`A ${coord(A)}`} labelOffset={{ x: 0, y: 26 }} onStart={h.checkpoint} onDrag={(p) => h.set((s) => ({ ...s, A: clampXY(toXY(p), step) }))} />
        <Handle x={sx(B.x)} y={sy(B.y)} color="#e8590c" label={`B ${coord(B)}`} onStart={h.checkpoint} onDrag={(p) => h.set((s) => ({ ...s, B: clampXY(toXY(p), step) }))} />
      </Axes>
      <div className="overlay-badge">distance AB = {fmt(d, 3)} · midpoint {coord(M, 2)}</div>
    </div>
  );
  const controls = (
    <>
      <Toggle label="Show the squares (Pythagoras)" checked={squares} onChange={setSquares} />
      <Toggle label="Snap to grid" checked={snapOn} onChange={setSnapOn} />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>Two points A and B. The green line is the straight <T k="distance" /> between them. The blue and pink lines are how far <b>across</b> and how far <b>up</b>. The purple diamond is the <T k="midpoint" />.</p>,
    touch: <p>Drag A and B. Watch the triangle and the midpoint.</p>,
    experiment: (
      <ul>
        <li>Make across = 3 and up = 4. How long is the green line?</li>
        <li>Turn on the squares. Count: the two small squares together equal the big one.</li>
        <li>Where is M when A is (0, 0) and B is (8, 6)?</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz
        question="Across 3, up 4. The squares have areas 9 and 16. What is the area of the green square?"
        options={[{ label: '25 — so the distance is 5', correct: true, why: '9 + 16 = 25, and the side of a 25-square is 5. This is Pythagoras’ rule.' }, { label: '7 — so the distance is 7', why: 'Walking around (3 + 4) is longer than going straight. The squares add, not the sides.' }]}
      />
    ),
    understand: (
      <>
        <p>The across and up lines make a <T k="right" /> triangle. The squares on the two short sides add up to the square on the long side (<T k="hypotenuse" />).</p>
        <p>The midpoint is halfway in both directions: the <b>average</b> of the x's and the average of the y's.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'd', means: 'distance between the points', color: '#2b8a3e' }, ' = √( ', { s: 'Δx', means: 'how far across (x₂ − x₁)', color: '#1c7ed6' }, '² + ', { s: 'Δy', means: 'how far up (y₂ − y₁)', color: '#c2255c' }, '² )']} caption="√ means 'square root': the number that, times itself, gives what is inside." />
        <Formula parts={[{ s: 'M', means: 'midpoint', color: '#7048e8' }, ' = ( (x₁ + x₂) ÷ 2 , (y₁ + y₂) ÷ 2 )']} />
        <NumberQuiz question="Two screw holes are at (10, 20) and (40, 60) mm. How far apart are their centres?" answer={50} unit="mm" hint="Across 30, up 40."
          diagnose={(x) => (x === 70 ? 'That is across + up. The straight line is shorter.' : null)}
          solution={<Steps steps={['Δx = 40 − 10 = 30, Δy = 60 − 20 = 40', '30² + 40² = 900 + 1600 = 2500', '√2500 = 50 mm']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Hole-to-hole distances, cable lengths and diagonal braces all use this rule.</li>
          <li>A screen's “size” is its diagonal: a 16 × 9 cm screen is √(256 + 81) ≈ 18.4 cm.</li>
          <li>Midpoints place a handle or a logo exactly in the centre.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['A, B', `${coord(A)}, ${coord(B)}`],
      ['Δx (across)', `${fmt(B.x, 1)} − ${fmt(A.x, 1)} = ${fmt(dx, 1)}`],
      ['Δy (up)', `${fmt(B.y, 1)} − ${fmt(A.y, 1)} = ${fmt(dy, 1)}`],
      ['Squares', `${fmt(dx * dx, 2)} + ${fmt(dy * dy, 2)} = ${fmt(dx * dx + dy * dy, 2)}`],
      ['Distance', `√${fmt(dx * dx + dy * dy, 2)} = ${fmt(d, 3)}`],
      ['Midpoint', `((${fmt(A.x, 1)} + ${fmt(B.x, 1)}) ÷ 2, (${fmt(A.y, 1)} + ${fmt(B.y, 1)}) ÷ 2) = ${coord(M, 2)}`],
    ]} />
  );
  return <Lesson id="l7-distance" title="Distance & midpoint" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Slope & straight lines + interactive graphs                         */
/* ================================================================== */

type GraphMode = 'points' | 'linear' | 'quadratic' | 'sine';

function curvePath(f: (x: number) => number): string {
  let d = '';
  let pen = false;
  for (let i = 0; i <= 400; i++) {
    const x = -XMAX + (2 * XMAX * i) / 400;
    const y = f(x);
    if (!Number.isFinite(y) || Math.abs(y) > YMAX + 3) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)} `;
    pen = true;
  }
  return d;
}

function SlopeLesson() {
  const [mode, setMode] = useState<GraphMode>('points');
  const h = useHistory({ A: { x: -4, y: -2 }, B: { x: 2, y: 2 }, m: 0.5, c: 1, a: 0.25, k: 1 });
  const { A, B, m, c, a, k } = h.value;
  const run = B.x - A.x;
  const rise = B.y - A.y;
  const slope = run === 0 ? Infinity : rise / run;
  const intercept = A.y - slope * A.x;
  const f: (x: number) => number =
    mode === 'points' ? (x) => slope * x + intercept : mode === 'linear' ? (x) => m * x + c : mode === 'quadratic' ? (x) => a * x * x + c : (x) => 4 * a * Math.sin(k * x) + c;
  const angle = mode === 'points' ? radToDeg(Math.atan(slope)) : radToDeg(Math.atan(m));
  const kind = (s: number) => (!Number.isFinite(s) ? 'vertical (slope undefined)' : Math.abs(s) < 1e-9 ? 'flat (zero slope)' : s > 0 ? 'uphill (positive)' : 'downhill (negative)');
  const tool = (
    <div style={{ position: 'relative' }}>
      <Axes>
        {mode === 'points' && run !== 0 && <path d={curvePath(f)} stroke="#adb5bd" strokeWidth={2} fill="none" strokeDasharray="6 5" />}
        {mode === 'points' && (
          <>
            <line x1={sx(A.x)} y1={sy(A.y)} x2={sx(B.x)} y2={sy(A.y)} stroke="#1c7ed6" strokeWidth={4} />
            <line x1={sx(B.x)} y1={sy(A.y)} x2={sx(B.x)} y2={sy(B.y)} stroke="#c2255c" strokeWidth={4} />
            <line x1={sx(A.x)} y1={sy(A.y)} x2={sx(B.x)} y2={sy(B.y)} stroke="#2b8a3e" strokeWidth={4} />
            <text x={(sx(A.x) + sx(B.x)) / 2} y={sy(A.y) + (rise >= 0 ? 20 : -10)} textAnchor="middle" className="svg-label" fill="#1c7ed6">run {fmt(run, 1)}</text>
            <text x={sx(B.x) + 10} y={(sy(A.y) + sy(B.y)) / 2} className="svg-label" fill="#c2255c">rise {fmt(rise, 1)}</text>
            <Handle x={sx(A.x)} y={sy(A.y)} label="A" onStart={h.checkpoint} onDrag={(p) => h.set((s) => ({ ...s, A: clampXY(toXY(p), 1) }))} />
            <Handle x={sx(B.x)} y={sy(B.y)} label="B" onStart={h.checkpoint} onDrag={(p) => h.set((s) => ({ ...s, B: clampXY(toXY(p), 1) }))} />
          </>
        )}
        {mode !== 'points' && <path d={curvePath(f)} stroke="#e8590c" strokeWidth={3.5} fill="none" />}
        {mode === 'linear' && (
          <>
            <circle cx={sx(0)} cy={sy(c)} r={7} fill="#7048e8" />
            <text x={sx(0) + 10} y={sy(c) - 8} className="svg-label" fill="#7048e8">c = {fmt(c, 1)}</text>
            <line x1={sx(0)} y1={sy(c)} x2={sx(1)} y2={sy(c)} stroke="#1c7ed6" strokeWidth={3} />
            <line x1={sx(1)} y1={sy(c)} x2={sx(1)} y2={sy(c + m)} stroke="#c2255c" strokeWidth={3} />
            <text x={sx(1) + 8} y={(sy(c) + sy(c + m)) / 2} className="svg-label small" fill="#c2255c">m = {fmt(m, 2)}</text>
          </>
        )}
      </Axes>
      <div className="overlay-badge">
        {mode === 'points' && <>slope = rise ÷ run = {fmt(rise, 1)} ÷ {fmt(run, 1)} = {Number.isFinite(slope) ? fmt(slope, 3) : 'undefined'} · {kind(slope)}</>}
        {mode === 'linear' && <>y = {fmt(m, 2)}x {c >= 0 ? '+' : '−'} {fmt(Math.abs(c), 1)} · {kind(m)} · {fmt(angle, 1)}°</>}
        {mode === 'quadratic' && <>y = {fmt(a, 2)}x² {c >= 0 ? '+' : '−'} {fmt(Math.abs(c), 1)}</>}
        {mode === 'sine' && <>y = {fmt(4 * a, 2)} · sin({fmt(k, 2)}x) {c >= 0 ? '+' : '−'} {fmt(Math.abs(c), 1)}</>}
      </div>
    </div>
  );
  const controls = (
    <>
      <Segmented value={mode} onChange={setMode} options={[{ value: 'points', label: '📍 Two points' }, { value: 'linear', label: 'y = mx + c' }, { value: 'quadratic', label: 'y = ax² + c' }, { value: 'sine', label: 'y = a·sin(kx)' }]} />
      {mode === 'linear' && <Slider label="m (slope)" value={m} min={-4} max={4} step={0.05} onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, m: x }))} color="#c2255c" />}
      {mode === 'quadratic' && <Slider label="a (bend)" value={a} min={-1} max={1} step={0.01} onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, a: x }))} color="#c2255c" />}
      {mode === 'sine' && (
        <>
          <Slider label="a (height of the wave)" value={4 * a} min={-5} max={5} step={0.1} onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, a: x / 4 }))} color="#c2255c" />
          <Slider label="k (how squeezed)" value={k} min={0.2} max={3} step={0.05} onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, k: x }))} color="#1c7ed6" />
        </>
      )}
      {mode !== 'points' && <Slider label="c (shift up/down)" value={c} min={-5} max={5} step={0.1} onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, c: x }))} color="#7048e8" />}
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
      {mode !== 'points' && (
        <table className="numtable">
          <tbody>
            <tr><th>x</th>{[-3, -2, -1, 0, 1, 2, 3].map((x) => <td key={x}>{x}</td>)}</tr>
            <tr><th>y</th>{[-3, -2, -1, 0, 1, 2, 3].map((x) => <td key={x}>{fmt(f(x), 2)}</td>)}</tr>
          </tbody>
        </table>
      )}
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A line through A and B. To get from A to B you go <b>across</b> (run, blue) and <b>up</b> (rise, pink). How steep it is: the <T k="slope" />.</p>,
    touch: <p>Drag A and B. Then try the other buttons: y = mx + c and the curves.</p>,
    experiment: (
      <ul>
        <li>Make the line flat. Then make it go downhill. Watch the sign of the slope.</li>
        <li>Make it steeper and steeper. Can you make it vertical?</li>
        <li>In <b>y = mx + c</b>, move m, then c. Which one turns the line, which one slides it?</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz question="In y = mx + c, what does c do?" options={[{ label: 'Slides the line up and down', correct: true, why: 'c is where the line crosses the y axis (when x = 0, y = c).' }, { label: 'Changes the steepness', why: 'That is m: it is the rise for every 1 step of run.' }]} />
    ),
    understand: (
      <>
        <p><b>Slope = rise ÷ run</b>: how much you go up for every 1 step across. Negative slope = downhill. Zero = flat.</p>
        <p>A straight line is a <b>linear relationship</b>: every step across adds the same amount up — just like the socket board in Level 6.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'm', means: 'slope = rise ÷ run', color: '#c2255c' }, ' = (', { s: 'y₂ − y₁', means: 'rise', color: '#c2255c' }, ') ÷ (', { s: 'x₂ − x₁', means: 'run', color: '#1c7ed6' }, ')']} />
        <Formula parts={[{ s: 'y', means: 'height of the line', color: '#e8590c' }, ' = ', { s: 'm', means: 'slope', color: '#c2255c' }, { s: 'x', means: 'position across', color: '#1c7ed6' }, ' + ', { s: 'c', means: 'where it crosses the y axis', color: '#7048e8' }]} />
        <NumberQuiz question="A wheelchair ramp rises 0.5 m over a run of 6 m. What is its slope? (decimal)" answer={0.0833} tolerance={0.002} hint="rise ÷ run = 0.5 ÷ 6."
          diagnose={(x) => (Math.abs(x - 12) < 0.1 ? 'You divided run by rise. Slope is rise ÷ run.' : null)}
          solution={<Steps steps={['0.5 ÷ 6 ≈ 0.083', 'as a ratio ≈ 1 : 12', `angle ≈ ${fmt(radToDeg(Math.atan(0.5 / 6)), 1)}°`]} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Ramps, roof pitches, drafting tables and keyboard tilt are all specified by slope (or angle).</li>
          <li>Curves like y = ax² describe reflectors and arches; sine waves describe springs and vibrations.</li>
          <li>Graphs show how a design responds: change one input, watch the output line.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = mode === 'points' ? (
    <NumberTable rows={[['A, B', `${coord(A)}, ${coord(B)}`], ['run', `${fmt(B.x, 1)} − ${fmt(A.x, 1)} = ${fmt(run, 1)}`], ['rise', `${fmt(B.y, 1)} − ${fmt(A.y, 1)} = ${fmt(rise, 1)}`], ['slope m', Number.isFinite(slope) ? `${fmt(rise, 1)} ÷ ${fmt(run, 1)} = ${fmt(slope, 4)}` : 'undefined (vertical)'], ['crosses y axis at c', Number.isFinite(slope) ? fmt(intercept, 3) : '—'], ['angle', Number.isFinite(slope) ? `${fmt(radToDeg(Math.atan(slope)), 1)}°` : '90°']]} />
  ) : (
    <NumberTable rows={[-3, -2, -1, 0, 1, 2, 3].map((x) => [`x = ${x}`, `y = ${fmt(f(x), 3)}`] as [ReactNode, ReactNode])} />
  );
  return <Lesson id="l7-slope" title="Slope & straight lines" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Challenge: plot the product                                         */
/* ================================================================== */

const SHAPES: Record<Difficulty, { name: string; pts: Vec[] }[]> = {
  easy: [
    { name: 'a desk lamp base', pts: [{ x: 1, y: 1 }, { x: 7, y: 1 }, { x: 6, y: 3 }, { x: 2, y: 3 }] },
    { name: 'a phone stand side', pts: [{ x: 1, y: 1 }, { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 3, y: 6 }, { x: 1, y: 6 }] },
    { name: 'a speaker box', pts: [{ x: 2, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 6 }, { x: 2, y: 6 }] },
  ],
  normal: [
    { name: 'a house-shaped bird box', pts: [{ x: -4, y: -3 }, { x: 4, y: -3 }, { x: 4, y: 2 }, { x: 0, y: 5 }, { x: -4, y: 2 }] },
    { name: 'a T-shaped bracket', pts: [{ x: -5, y: 3 }, { x: 5, y: 3 }, { x: 5, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -5 }, { x: -1, y: -5 }, { x: -1, y: 1 }, { x: -5, y: 1 }] },
    { name: 'a cable clip', pts: [{ x: -6, y: -2 }, { x: -2, y: -2 }, { x: -2, y: 3 }, { x: 2, y: 3 }, { x: 2, y: -2 }, { x: 6, y: -2 }, { x: 6, y: -4 }, { x: -6, y: -4 }] },
  ],
  hard: [
    { name: 'a rocket-shaped USB stick', pts: [{ x: -1.5, y: -5 }, { x: 1.5, y: -5 }, { x: 1.5, y: 2.5 }, { x: 0, y: 5.5 }, { x: -1.5, y: 2.5 }] },
    { name: 'a hex key profile', pts: [{ x: -6, y: 4.5 }, { x: -4.5, y: 4.5 }, { x: -4.5, y: -3 }, { x: 5.5, y: -3 }, { x: 5.5, y: -4.5 }, { x: -6, y: -4.5 }] },
    { name: 'a door wedge', pts: [{ x: -7.5, y: -2.5 }, { x: 6.5, y: -2.5 }, { x: 6.5, y: 0.5 }, { x: -7.5, y: -1.5 }] },
  ],
};

function PlotChallenge() {
  const { difficulty } = useSettings();
  const [shape, setShape] = useState(() => pick(SHAPES[difficulty]));
  const h = useHistory<Vec[]>([]);
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const [ghost, setGhost] = useState(false);
  const step = difficulty === 'hard' ? 0.5 : 1;
  const pts = h.value;
  const tool = (
    <Axes onTap={(p) => { if (pts.length < 12) h.commit((s) => [...s, clampXY(p, step)]); }}>
      {ghost && <path d={shape.pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)} ${sy(p.y)}`).join(' ') + ' Z'} fill="#b2f2bb55" stroke="#2b8a3e" strokeWidth={2} strokeDasharray="6 4" />}
      {pts.length > 1 && <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)} ${sy(p.y)}`).join(' ') + (pts.length === shape.pts.length ? ' Z' : '')} fill="#d0ebff88" stroke="#1971c2" strokeWidth={3} />}
      {pts.map((p, i) => (
        <g key={i} pointerEvents="none">
          <circle cx={sx(p.x)} cy={sy(p.y)} r={wrongIdx === i ? 14 : 7} fill={wrongIdx === i ? 'none' : '#1971c2'} stroke={wrongIdx === i ? '#e5484d' : 'none'} strokeWidth={3} />
          {wrongIdx === i && <circle cx={sx(p.x)} cy={sy(p.y)} r={6} fill="#e5484d" />}
          <text x={sx(p.x) + 10} y={sy(p.y) - 10} className="svg-label small" fill="#1971c2">{i + 1}</text>
        </g>
      ))}
    </Axes>
  );
  const check = (): CheckResult => {
    for (let i = 0; i < shape.pts.length; i++) {
      const want = shape.pts[i];
      const got = pts[i];
      if (!got) {
        setWrongIdx(null);
        return { ok: false, happened: `You placed ${pts.length} of ${shape.pts.length} points.`, why: `Point ${i + 1} should go at ${coord(want)}.` };
      }
      if (Math.abs(got.x - want.x) > 1e-6 || Math.abs(got.y - want.y) > 1e-6) {
        setWrongIdx(i);
        const swapped = Math.abs(got.x - want.y) < 1e-6 && Math.abs(got.y - want.x) < 1e-6;
        const sign = Math.abs(Math.abs(got.x) - Math.abs(want.x)) < 1e-6 && Math.abs(Math.abs(got.y) - Math.abs(want.y)) < 1e-6;
        return {
          ok: false,
          happened: <>Point {i + 1} (circled red) is at <b>{coord(got)}</b>, but the list says <b>{coord(want)}</b>.</>,
          why: swapped ? 'x and y are swapped. Go across first (x), then up (y).' : sign ? 'The numbers are right but a direction is flipped: negative means left (x) or down (y).' : 'Count from the origin (0, 0): across first, then up or down.',
        };
      }
    }
    setWrongIdx(null);
    if (pts.length > shape.pts.length) return { ok: false, happened: `You placed ${pts.length - shape.pts.length} extra point(s).`, why: 'Undo the extra points.' };
    return { ok: true, happened: `${shape.name} — every vertex is exact.`, why: 'This is exactly how a laser cutter or CAD file stores a part.' };
  };
  const panel = (
    <Challenge
      id="l7-challenge"
      title="Plot the product"
      brief={
        <>
          <p>Draw <b>{shape.name}</b>. Tap the grid to place the points in this order:</p>
          <ol>{shape.pts.map((p, i) => <li key={i} style={{ color: pts[i] ? '#1971c2' : undefined, fontWeight: pts[i] ? 700 : undefined }}>{coord(p)}{pts[i] ? ' · placed' : ''}</li>)}</ol>
          <p className="muted small">The shape closes itself after the last point. Undo removes the last point.</p>
        </>
      }
      check={check}
      onResult={(r) => { if (!r) setWrongIdx(null); }}
      onNewTarget={() => { setShape(pick(SHAPES[difficulty])); h.reset([]); setGhost(false); setWrongIdx(null); }}
      hint="For each point: start at 0, move across by x (right if positive), then up by y (down if negative)."
      solution={<><p>The finished outline is shown in green.</p><button className="btn small" onClick={() => setGhost(true)}>Show the outline</button></>}
    />
  );
  return <Workbench title="Challenge: plot the product" tool={tool} controls={<ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset([])} />} panel={panel} />;
}

export default {
  'l7-grid': GridLesson,
  'l7-distance': DistanceLesson,
  'l7-slope': SlopeLesson,
  'l7-challenge': PlotChallenge,
};

