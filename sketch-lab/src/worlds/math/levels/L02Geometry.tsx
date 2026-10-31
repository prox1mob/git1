import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  add, arcPath, centroid, clamp, dist, fmt, interiorAngles, isSelfIntersecting, lineAngle, lineIntersection, lerp,
  pathFrom, perimeter, pick, polar, polygonArea, randInt, rotate, sideLengths, snap, snapV, sub, type Vec,
} from '../../../core/geometry';
import { useHistory } from '../../../core/history';
import { useSettings, type Difficulty } from '../../../core/store';
import { Challenge, ChoiceQuiz, NumberQuiz, type CheckResult } from '../../../ui/feedback';
import { DesignLink, Formula, Note, NumberTable, Segmented, Slider, Stat, Stats, Stepper, Steps, T, Toggle, ToolBar } from '../../../ui/kit';
import { Lesson, Workbench, type StageKey } from '../../../ui/lesson';
import { DimLine, GridLines, Handle, SvgDefs, useSvgDrag } from '../../../ui/svg';
import { SketchLayer, type Stroke } from '../tools/SketchLayer';

const W = 800;
const H = 500;
const U = 40; // pixels per centimetre on the squared paper
const GX = 40;
const GY = 40;
const COLS = 18;
const ROWS = 10;

/* ================================================================== */
/* Rectangle tool (used by the lesson and the challenge)               */
/* ================================================================== */

export interface RectState {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function RectTool({ r, onChange, onStart, step, countSquares, walk, mistake }: {
  r: RectState; onChange: (r: RectState) => void; onStart: () => void; step: number; countSquares: boolean; walk: number | null; mistake?: boolean;
}) {
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  const px = (x: number) => GX + x * U;
  const py = (y: number) => GY + y * U;
  const toUnit = (p: Vec) => ({ x: (p.x - GX) / U, y: (p.y - GY) / U });
  const startRect = useRef(r);
  const body = useSvgDrag({
    onStart: () => {
      startRect.current = r;
      onStart();
    },
    onMove: (p, s) => {
      const d = { x: snap((p.x - s.x) / U, step), y: snap((p.y - s.y) / U, step) };
      const o = startRect.current;
      const dx = clamp(d.x, -o.x0, COLS - o.x1);
      const dy = clamp(d.y, -o.y0, ROWS - o.y1);
      onChange({ x0: o.x0 + dx, x1: o.x1 + dx, y0: o.y0 + dy, y1: o.y1 + dy });
    },
  });
  const corner = (cx: 'x0' | 'x1', cy: 'y0' | 'y1') => (p: Vec) => {
    const u = toUnit(p);
    let x = snap(u.x, step);
    let y = snap(u.y, step);
    x = cx === 'x0' ? clamp(x, 0, r.x1 - step) : clamp(x, r.x0 + step, COLS);
    y = cy === 'y0' ? clamp(y, 0, r.y1 - step) : clamp(y, r.y0 + step, ROWS);
    onChange({ ...r, [cx]: x, [cy]: y });
  };

  // unit squares inside (whole and partial)
  const cells: ReactNode[] = [];
  let n = 0;
  for (let j = 0; j < Math.ceil(h - 1e-9); j++) {
    for (let i = 0; i < Math.ceil(w - 1e-9); i++) {
      const cw = Math.min(1, w - i);
      const ch = Math.min(1, h - j);
      const full = cw > 0.999 && ch > 0.999;
      if (full) n++;
      cells.push(
        <g key={`${i}-${j}`}>
          <rect x={px(r.x0 + i) + 2} y={py(r.y0 + j) + 2} width={cw * U - 4} height={ch * U - 4} rx={4} fill={full ? ((i + j) % 2 ? '#74c0fc' : '#a5d8ff') : '#d0bfff'} />
          {countSquares && full && w * h <= 80 && (
            <text x={px(r.x0 + i + 0.5)} y={py(r.y0 + j + 0.5)} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={700} fill="#1864ab">{n}</text>
          )}
          {countSquares && !full && (
            <text x={px(r.x0 + i + cw / 2)} y={py(r.y0 + j + ch / 2)} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={700} fill="#5f3dc4">{fmt(cw * ch, 2)}</text>
          )}
        </g>,
      );
    }
  }

  // perimeter walk
  const P = 2 * (w + h);
  let walker: Vec | null = null;
  if (walk !== null) {
    let d = walk * P;
    const pts = [{ x: r.x0, y: r.y1 }, { x: r.x1, y: r.y1 }, { x: r.x1, y: r.y0 }, { x: r.x0, y: r.y0 }, { x: r.x0, y: r.y1 }];
    for (let i = 0; i < 4; i++) {
      const L = dist(pts[i], pts[i + 1]);
      if (d <= L || i === 3) {
        const t = L ? Math.min(1, d / L) : 0;
        walker = { x: px(lerp(pts[i].x, pts[i + 1].x, t)), y: py(lerp(pts[i].y, pts[i + 1].y, t)) };
        break;
      }
      d -= L;
    }
  }

  return (
    <g>
      <GridLines x0={GX} y0={GY} w={COLS * U} h={ROWS * U} step={U / (step < 1 ? 2 : 1)} major={step < 1 ? 2 : 1} />
      <rect x={px(r.x0)} y={py(r.y0)} width={w * U} height={h * U} fill="#e7f5ff" className="draggable" {...body} />
      <g pointerEvents="none">{cells}</g>
      <rect x={px(r.x0)} y={py(r.y0)} width={w * U} height={h * U} fill={mistake ? 'url(#hatch)' : 'none'} stroke={mistake ? '#e5484d' : '#f08c00'} strokeWidth={4} pointerEvents="none" />
      <DimLine a={{ x: px(r.x0), y: py(r.y0) }} b={{ x: px(r.x1), y: py(r.y0) }} offset={-18} label={`width ${fmt(w, 1)} cm`} color="#1c7ed6" />
      <DimLine a={{ x: px(r.x0), y: py(r.y1) }} b={{ x: px(r.x0), y: py(r.y0) }} offset={-18} label={`height ${fmt(h, 1)} cm`} color="#c2255c" />
      {walker && (
        <g pointerEvents="none">
          <circle cx={walker.x} cy={walker.y} r={10} fill="#f08c00" stroke="#fff" strokeWidth={3} />
          <text x={walker.x + 14} y={walker.y - 14} className="svg-label" fill="#f08c00">{fmt((walk ?? 0) * P, 1)} cm walked</text>
        </g>
      )}
      <Handle x={px(r.x0)} y={py(r.y0)} onStart={onStart} onDrag={corner('x0', 'y0')} title="top-left corner" step={U * step} />
      <Handle x={px(r.x1)} y={py(r.y0)} onStart={onStart} onDrag={corner('x1', 'y0')} title="top-right corner" step={U * step} />
      <Handle x={px(r.x0)} y={py(r.y1)} onStart={onStart} onDrag={corner('x0', 'y1')} title="bottom-left corner" step={U * step} />
      <Handle x={px(r.x1)} y={py(r.y1)} onStart={onStart} onDrag={corner('x1', 'y1')} title="bottom-right corner" step={U * step} />
    </g>
  );
}

function useWalk(): [number | null, () => void] {
  const [walk, setWalk] = useState<number | null>(null);
  const run = () => {
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 3500);
      setWalk(k);
      if (k < 1) requestAnimationFrame(tick);
      else setTimeout(() => setWalk(null), 1500);
    };
    requestAnimationFrame(tick);
  };
  return [walk, run];
}

const RECT0: RectState = { x0: 3, y0: 2, x1: 8, y1: 5 };

function RectangleLesson() {
  const h = useHistory<RectState>(RECT0);
  const r = h.value;
  const [count, setCount] = useState(true);
  const [walk, runWalk] = useWalk();
  const w = r.x1 - r.x0;
  const ht = r.y1 - r.y0;
  const A = w * ht;
  const P = 2 * (w + ht);
  const tool = (
    <div style={{ position: 'relative' }}>
      <svg className="tool" viewBox={`0 0 ${W} ${H}`}>
        <SvgDefs />
        <RectTool r={r} onChange={h.set} onStart={h.checkpoint} step={1} countSquares={count} walk={walk} />
      </svg>
      <div className="overlay-badge right">1 small square = 1 cm × 1 cm</div>
    </div>
  );
  const controls = (
    <>
      <Stats>
        <Stat label={<T k="width" />} value={`${fmt(w)} cm`} color="#1c7ed6" />
        <Stat label={<T k="height" />} value={`${fmt(ht)} cm`} color="#c2255c" />
        <Stat label={<T k="area" />} value={`${fmt(A)} cm²`} color="#1971c2" sub={`${fmt(w)} × ${fmt(ht)}`} />
        <Stat label={<T k="perimeter" />} value={`${fmt(P)} cm`} color="#f08c00" sub={`${fmt(w)} + ${fmt(ht)} + ${fmt(w)} + ${fmt(ht)}`} />
      </Stats>
      <div className="row">
        <Toggle label="Number the squares" checked={count} onChange={setCount} />
        <button className="btn" onClick={runWalk} disabled={walk !== null}>🐜 Walk the perimeter</button>
        <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
      </div>
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: (
      <>
        <p>A <T k="rectangle" /> on squared paper. Each small square is 1 cm wide and 1 cm tall.</p>
        <p>The squares <b>inside</b> show the <T k="area" />. The orange border <b>around</b> it is the <T k="perimeter" />.</p>
      </>
    ),
    touch: <p>Drag any orange corner. Drag the middle to slide the whole rectangle. Watch the numbers under the picture.</p>,
    experiment: (
      <ul>
        <li>Make a rectangle 3 wide and 4 tall. Then 4 wide and 3 tall.</li>
        <li>Make a long thin one, 12 × 1.</li>
        <li>Press <b>🐜 Walk the perimeter</b> and count along with the ant.</li>
      </ul>
    ),
    discover: (
      <>
        <ChoiceQuiz
          question="A 6 × 2 rectangle and a 4 × 3 rectangle both cover 12 squares. Do they have the same perimeter?"
          options={[
            { label: 'Yes — same area means same perimeter', why: 'Build both: 6 × 2 has perimeter 16 cm, 4 × 3 has 14 cm. Same inside, different border.' },
            { label: 'No — the perimeters are different', correct: true, why: 'Area is the inside, perimeter is the border. Long thin shapes have more border for the same area.' },
          ]}
          hint="Build each one and read the perimeter box."
        />
        <ChoiceQuiz
          question="All of these cover 16 squares. Which needs the shortest border?"
          options={[
            { label: '1 × 16', why: 'Perimeter = 1 + 16 + 1 + 16 = 34 cm. Very long border!' },
            { label: '2 × 8', why: 'Perimeter = 2 + 8 + 2 + 8 = 20 cm. Better, but not the best.' },
            { label: '4 × 4 (a square)', correct: true, why: 'Perimeter = 16 cm. The closer to a square, the less border for the same area.' },
          ]}
        />
      </>
    ),
    understand: (
      <>
        <p><b>Area</b> = how many squares cover the inside. Squares sit in rows, so count <i>rows × squares in each row</i> — that is <T k="multiplication" />.</p>
        <p><b>Perimeter</b> = walk all four sides and add them up.</p>
        <p>Area is measured in <b>square</b> centimetres (cm²). Perimeter is a length, in plain centimetres (cm).</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'A', means: 'area: squares inside (cm²)', color: '#1971c2' }, ' = ', { s: 'w', means: 'width (cm)', color: '#1c7ed6' }, ' × ', { s: 'h', means: 'height (cm)', color: '#c2255c' }]} />
        <Formula parts={[{ s: 'P', means: 'perimeter: distance around (cm)', color: '#f08c00' }, ' = 2 × (', { s: 'w', means: 'width', color: '#1c7ed6' }, ' + ', { s: 'h', means: 'height', color: '#c2255c' }, ')']} caption="2 × (w + h) is a shortcut for w + h + w + h." />
        <NumberQuiz
          question="A sticker label is 7 cm wide and 5 cm tall. What is its area?"
          answer={35}
          unit="cm²"
          hint="Rows × squares per row: 5 rows of 7."
          diagnose={(x) => (x === 24 ? 'You found the perimeter (7 + 5 + 7 + 5). Area counts the squares inside.' : x === 12 ? 'You added width and height. Area multiplies them.' : null)}
          solution={<Steps steps={['A = w × h', 'A = 7 × 5', 'A = 35 cm²']} />}
        />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li><b>Area</b> tells you how much sheet material, paint or screen you need.</li>
          <li><b>Perimeter</b> tells you the length of edge trim, a rubber seal, stitching or a weld.</li>
          <li>Near-square boxes use less edge material for the same space.</li>
        </ul>
        <p className="try">Design a rectangular coaster with 36 cm² area and the shortest possible edge trim.</p>
      </DesignLink>
    ),
  };
  const numbers = (
    <>
      <NumberTable rows={[
        ['Width w', `${fmt(w)} cm`],
        ['Height h', `${fmt(ht)} cm`],
        ['Rows of squares', `${fmt(ht)} rows of ${fmt(w)}`],
        ['Area A = w × h', `${fmt(w)} × ${fmt(ht)} = ${fmt(A)} cm²`],
        ['Perimeter (add sides)', `${fmt(w)} + ${fmt(ht)} + ${fmt(w)} + ${fmt(ht)} = ${fmt(P)} cm`],
        ['Perimeter (shortcut)', `2 × (${fmt(w)} + ${fmt(ht)}) = ${fmt(P)} cm`],
        ['Diagonal (corner to corner)', `√(${fmt(w)}² + ${fmt(ht)}²) = ${fmt(Math.hypot(w, ht), 2)} cm`],
      ]} />
      {w === ht && <Note>Width = height, so this rectangle is a <T k="square" />.</Note>}
    </>
  );
  return <Lesson id="l2-rectangle" title="Rectangle: area & perimeter" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ---------------- challenge: rectangle with a set area ---------------- */

interface RectTarget {
  area: number;
  perim?: number;
  w: number;
  h: number;
}

function rectTarget(d: Difficulty): RectTarget {
  if (d === 'easy') {
    const [w, h] = pick([[3, 4], [2, 5], [3, 5], [4, 5], [2, 9], [3, 6], [4, 4]]);
    return { area: w * h, w, h };
  }
  if (d === 'normal') {
    let w = randInt(2, 9);
    let h = randInt(2, 8);
    while (w === h) h = randInt(2, 8);
    return { area: w * h, perim: 2 * (w + h), w, h };
  }
  const w = randInt(2, 7) + 0.5;
  const h = randInt(2, 8);
  return { area: w * h, perim: 2 * (w + h), w, h };
}

function CompareBar({ have, want }: { have: number; want: number }) {
  const max = Math.max(have, want);
  const cell = Math.min(18, 560 / Math.max(1, Math.ceil(max)));
  const row = (n: number, y: number, color: string, other: number) =>
    Array.from({ length: Math.ceil(n) }, (_, i) => {
      const frac = Math.min(1, n - i);
      const extra = i >= other;
      return <rect key={i} x={70 + i * cell} y={y} width={cell * frac - 2} height={cell - 2} fill={extra ? 'url(#hatch)' : color} stroke={extra ? '#e5484d' : 'none'} />;
    });
  return (
    <svg viewBox={`0 0 ${80 + Math.ceil(max) * cell} ${cell * 2 + 14}`} style={{ width: '100%', maxHeight: 80 }}>
      <SvgDefs />
      <text x={0} y={cell - 4} fontSize={12} fontWeight={700}>target</text>
      {row(want, 2, '#2b8a3e', Infinity)}
      <text x={0} y={2 * cell + 6} fontSize={12} fontWeight={700}>yours</text>
      {row(have, cell + 10, '#1c7ed6', want)}
    </svg>
  );
}

function RectangleChallenge() {
  const { difficulty } = useSettings();
  const [target, setTarget] = useState(() => rectTarget(difficulty));
  const h = useHistory<RectState>(RECT0);
  const [mistake, setMistake] = useState(false);
  const [lastArea, setLastArea] = useState<number | null>(null);
  const step = difficulty === 'hard' ? 0.5 : 1;
  const r = h.value;
  const w = r.x1 - r.x0;
  const ht = r.y1 - r.y0;
  const A = w * ht;
  const P = 2 * (w + ht);
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} ${H}`}>
      <SvgDefs />
      <RectTool r={r} onChange={h.set} onStart={h.checkpoint} step={step} countSquares walk={null} mistake={mistake} />
    </svg>
  );
  const check = (): CheckResult => {
    const areaOk = Math.abs(A - target.area) < 1e-6;
    const perimOk = target.perim === undefined || Math.abs(P - target.perim) < 1e-6;
    setLastArea(A);
    if (areaOk && perimOk) return { ok: true, happened: `${fmt(w)} cm × ${fmt(ht)} cm = ${fmt(A)} cm²${target.perim ? `, perimeter ${fmt(P)} cm` : ''}.` };
    if (!areaOk) {
      const diff = A - target.area;
      return {
        ok: false,
        happened: (
          <>
            <div>Your rectangle covers <b>{fmt(A)} cm²</b> — {fmt(Math.abs(diff))} {diff > 0 ? 'too many' : 'too few'} squares.</div>
            <CompareBar have={A} want={target.area} />
          </>
        ),
        why: Math.abs(P - target.area) < 1e-6
          ? `Your perimeter is ${fmt(P)} — you matched the border, but area is about the squares inside.`
          : 'Area = width × height. Changing either side changes how many squares fit inside.',
      };
    }
    return {
      ok: false,
      happened: <>Area is right ({fmt(A)} cm²) 👍 but the perimeter is <b>{fmt(P)} cm</b>, not {target.perim} cm.</>,
      why: 'Different rectangles can have the same area but different borders. You need the one pair of sides that gives both.',
    };
  };
  const panel = (
    <Challenge
      id="l2-challenge"
      title="Construct a rectangle with a set area"
      brief={
        <>
          <p>A product label must cover exactly <span className="target">{fmt(target.area)} cm²</span>{target.perim !== undefined && <> and have an edge of <span className="target">{fmt(target.perim)} cm</span> (perimeter)</>}.</p>
          <p className="muted small">Drag the corners. {step < 1 ? 'Corners snap to half centimetres.' : 'Corners snap to whole centimetres.'}</p>
        </>
      }
      check={check}
      onResult={(res) => setMistake(!!res && !res.ok)}
      onNewTarget={() => setTarget(rectTarget(difficulty))}
      hint={difficulty === 'easy'
        ? `Think of two numbers that multiply to make ${fmt(target.area)}.`
        : difficulty === 'normal'
          ? `List the pairs that multiply to ${fmt(target.area)}. For each pair, add the sides twice and compare with ${target.perim}.`
          : `Half of the perimeter is width + height = ${fmt((target.perim ?? 0) / 2)}. Try widths that end in .5.`}
      solution={<Steps steps={[`width ${fmt(target.w)} cm, height ${fmt(target.h)} cm (or turned around)`, `area: ${fmt(target.w)} × ${fmt(target.h)} = ${fmt(target.area)} cm²`, ...(target.perim ? [`perimeter: 2 × (${fmt(target.w)} + ${fmt(target.h)}) = ${target.perim} cm`] : [])]} />}
    >
      <Stats>
        <Stat label="your area" value={`${fmt(A)} cm²`} color="#1971c2" />
        <Stat label="your perimeter" value={`${fmt(P)} cm`} color="#f08c00" />
      </Stats>
      {lastArea !== null && <div className="muted small">Last check: {fmt(lastArea)} cm²</div>}
    </Challenge>
  );
  return <Workbench title="Challenge: rectangle of a set area" tool={tool} controls={<ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />} panel={panel} />;
}

/* ================================================================== */
/* Points, lines, parallel & perpendicular                             */
/* ================================================================== */

function LinesLesson() {
  const h = useHistory({ a1: { x: 160, y: 380 }, a2: { x: 560, y: 260 }, b1: { x: 200, y: 140 }, b2: { x: 520, y: 220 } });
  const [snapOn, setSnapOn] = useState(true);
  const { a1, a2, b1, b2 } = h.value;
  const ang = lineAngle(a1, a2, b1, b2);
  const parallel = ang < 0.5;
  const perp = Math.abs(ang - 90) < 0.5;
  const X = lineIntersection(a1, a2, b1, b2);
  const ext = (p: Vec, q: Vec) => {
    const d = sub(q, p);
    const L = Math.hypot(d.x, d.y) || 1;
    return { s: add(p, { x: (-d.x / L) * 1200, y: (-d.y / L) * 1200 }), e: add(p, { x: (d.x / L) * 1200, y: (d.y / L) * 1200 }) };
  };
  const ea = ext(a1, a2);
  const eb = ext(b1, b2);
  const status = parallel ? 'parallel' : perp ? 'perpendicular' : 'crossing';
  const color = parallel ? '#2b8a3e' : perp ? '#7048e8' : '#495057';
  const sn = (p: Vec) => (snapOn ? snapV(p, U) : p);
  const setP = (k: 'a1' | 'a2' | 'b1' | 'b2') => (p: Vec) => h.set((s) => ({ ...s, [k]: sn({ x: clamp(p.x, 10, W - 10), y: clamp(p.y, 10, H - 10) }) }));
  const gap = parallel ? Math.abs((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / dist(a1, a2) / U : 0;
  const tool = (
    <div style={{ position: 'relative' }}>
      <svg className="tool" viewBox={`0 0 ${W} ${H}`}>
        <GridLines x0={0} y0={0} w={W} h={H} step={U} />
        <line x1={ea.s.x} y1={ea.s.y} x2={ea.e.x} y2={ea.e.y} stroke="#1c7ed6" strokeWidth={1.5} strokeDasharray="6 6" opacity={0.6} />
        <line x1={eb.s.x} y1={eb.s.y} x2={eb.e.x} y2={eb.e.y} stroke="#e8590c" strokeWidth={1.5} strokeDasharray="6 6" opacity={0.6} />
        <line x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y} stroke="#1c7ed6" strokeWidth={5} strokeLinecap="round" />
        <line x1={b1.x} y1={b1.y} x2={b2.x} y2={b2.y} stroke="#e8590c" strokeWidth={5} strokeLinecap="round" />
        {X && X.x > -50 && X.x < W + 50 && X.y > -50 && X.y < H + 50 && (
          <g pointerEvents="none">
            {perp ? (
              (() => {
                const u = sub(a2, a1);
                const v2 = sub(b2, b1);
                const nu = { x: (u.x / Math.hypot(u.x, u.y)) * 18, y: (u.y / Math.hypot(u.x, u.y)) * 18 };
                const nv = { x: (v2.x / Math.hypot(v2.x, v2.y)) * 18, y: (v2.y / Math.hypot(v2.x, v2.y)) * 18 };
                return <path d={`M${X.x + nu.x} ${X.y + nu.y} L${X.x + nu.x + nv.x} ${X.y + nu.y + nv.y} L${X.x + nv.x} ${X.y + nv.y}`} fill="none" stroke="#7048e8" strokeWidth={2.5} />;
              })()
            ) : null}
            <circle cx={X.x} cy={X.y} r={6} fill="#fff" stroke="#495057" strokeWidth={2} />
            <text x={X.x + 12} y={X.y - 12} className="svg-label" fill="#495057">meet here · {fmt(ang, 1)}°</text>
          </g>
        )}
        <Handle x={a1.x} y={a1.y} color="#1c7ed6" onStart={h.checkpoint} onDrag={setP('a1')} label="A" />
        <Handle x={a2.x} y={a2.y} color="#1c7ed6" onStart={h.checkpoint} onDrag={setP('a2')} label="B" />
        <Handle x={b1.x} y={b1.y} color="#e8590c" onStart={h.checkpoint} onDrag={setP('b1')} label="C" />
        <Handle x={b2.x} y={b2.y} color="#e8590c" onStart={h.checkpoint} onDrag={setP('b2')} label="D" />
      </svg>
      <div className="overlay-badge" style={{ color }}>
        {status === 'parallel' ? <><T k="parallel" /> — they never meet</> : status === 'perpendicular' ? <><T k="perpendicular" /> — square corner</> : <>Lines cross at {fmt(ang, 1)}°</>}
      </div>
    </div>
  );
  const rotB = (deg: number) => h.commit((s) => {
    const m = { x: (s.b1.x + s.b2.x) / 2, y: (s.b1.y + s.b2.y) / 2 };
    const dir = sub(s.a2, s.a1);
    const L = dist(s.b1, s.b2) / 2;
    const u = rotate({ x: dir.x / Math.hypot(dir.x, dir.y), y: dir.y / Math.hypot(dir.x, dir.y) }, deg);
    return { ...s, b1: sub(m, { x: u.x * L, y: u.y * L }), b2: add(m, { x: u.x * L, y: u.y * L }) };
  });
  const controls = (
    <>
      <Toggle label="Snap points to the grid" checked={snapOn} onChange={setSnapOn} />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()}>
        <button className="btn" onClick={() => rotB(0)}>Make CD parallel</button>
        <button className="btn" onClick={() => rotB(90)}>Make CD perpendicular</button>
      </ToolBar>
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: (
      <>
        <p>Each dot is a <T k="point" /> — an exact position. Two points make a <T k="segment" /> (the thick part).</p>
        <p>The dashed parts show the full <T k="line" />: it carries on forever in both directions.</p>
      </>
    ),
    touch: <p>Drag the points A, B, C and D. Watch where the dashed lines meet.</p>,
    experiment: (
      <ul>
        <li>Make the lines meet far away, then even further…</li>
        <li>Make them never meet at all.</li>
        <li>Make them cross like a plus sign (+).</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz
        question="You made the blue and orange lines point exactly the same way. Where do they meet?"
        options={[
          { label: 'Far away, off the screen', why: 'Turn snapping on and check: the "meet here" marker disappears completely.' },
          { label: 'Nowhere — they never meet', correct: true, why: 'Lines that point the same way stay the same distance apart forever. They are parallel.' },
        ]}
      />
    ),
    understand: (
      <ul>
        <li><T k="parallel" /> lines point the same way and stay the same distance apart.</li>
        <li><T k="perpendicular" /> lines meet at a right angle (90°) — a perfect square corner.</li>
        <li>On squared paper: going <b>3 across, 1 up</b> is perpendicular to going <b>1 across, 3 down</b> (swap the numbers, flip one direction).</li>
      </ul>
    ),
    calculate: (
      <>
        <Formula parts={['steps (', { s: 'a', means: 'squares across', color: '#1c7ed6' }, ', ', { s: 'b', means: 'squares up', color: '#c2255c' }, ')  ⟂  steps (−', { s: 'b', means: '', color: '#c2255c' }, ', ', { s: 'a', means: '', color: '#1c7ed6' }, ')']} caption="⟂ means 'is perpendicular to'. Swap the two step numbers and make one negative." />
        <ChoiceQuiz
          question="Line 1 goes 2 across and 5 up. Which line is perpendicular to it?"
          options={[
            { label: '2 across, 5 up', why: 'That is the same direction — parallel, not perpendicular.' },
            { label: '5 across, 2 down', correct: true, why: 'Swap 2 and 5, and flip one direction (up → down).' },
            { label: '5 across, 2 up', why: 'Close! You swapped the numbers but you must also flip one direction.' },
          ]}
        />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Phone edges, table legs and shelves are <b>parallel</b>; corners of boxes are <b>perpendicular</b>.</li>
          <li>In perspective sketches, parallel edges seem to meet at a <T k="vanishingPoint" /> (Level 10).</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['Length AB', `${fmt(dist(a1, a2) / U, 2)} cm`],
      ['Length CD', `${fmt(dist(b1, b2) / U, 2)} cm`],
      ['Steps AB (across, up)', `(${fmt((a2.x - a1.x) / U, 1)}, ${fmt(-(a2.y - a1.y) / U, 1)})`],
      ['Steps CD (across, up)', `(${fmt((b2.x - b1.x) / U, 1)}, ${fmt(-(b2.y - b1.y) / U, 1)})`],
      ['Angle between lines', `${fmt(ang, 1)}°`],
      ['Relationship', status],
      ...(parallel ? ([['Gap between the lines', `${fmt(gap, 2)} cm`]] as [ReactNode, ReactNode][]) : []),
    ]} />
  );
  return <Lesson id="l2-lines" title="Points, lines, parallel & perpendicular" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Triangles & polygons                                                */
/* ================================================================== */

function regular(n: number, c: Vec = { x: 400, y: 260 }, r = 160): Vec[] {
  return Array.from({ length: n }, (_, i) => polar(c, r, 90 + (360 * i) / n));
}

function triangleKind(sides: number[], angles: number[]) {
  const [a, b, c] = sides.map((s) => Math.round(s * 10) / 10);
  const bySides = a === b && b === c ? 'equilateral (3 equal sides)' : a === b || b === c || a === c ? 'isosceles (2 equal sides)' : 'scalene (no equal sides)';
  const maxA = Math.max(...angles);
  const byAngle = Math.abs(maxA - 90) < 0.5 ? 'right-angled' : maxA > 90 ? 'obtuse' : 'acute';
  return `${byAngle}, ${bySides}`;
}

function ShapesLesson() {
  const [n, setN] = useState(3);
  const h = useHistory<Vec[]>(() => [{ x: 240, y: 400 }, { x: 600, y: 400 }, { x: 360, y: 120 }]);
  const [snapOn, setSnapOn] = useState(false);
  const pts = h.value;
  const changeN = (k: number) => {
    setN(k);
    h.commit(regular(k));
  };
  const sides = sideLengths(pts).map((s) => s / U);
  const angles = interiorAngles(pts);
  const sum = angles.reduce((s, x) => s + x, 0);
  const area = polygonArea(pts) / (U * U);
  const per = perimeter(pts) / U;
  const crossed = isSelfIntersecting(pts);
  const c = centroid(pts);
  // altitude for triangles: from vertex 2 to line 0-1
  let foot: Vec | null = null;
  if (n === 3) {
    const [A, B, C] = pts;
    const d = sub(B, A);
    const t = ((C.x - A.x) * d.x + (C.y - A.y) * d.y) / (d.x * d.x + d.y * d.y);
    foot = { x: A.x + d.x * t, y: A.y + d.y * t };
  }
  const tool = (
    <div style={{ position: 'relative' }}>
      <svg className="tool" viewBox={`0 0 ${W} ${H}`}>
        <GridLines x0={0} y0={0} w={W} h={H} step={U} />
        <path d={pathFrom(pts)} fill={crossed ? '#ffe3e3' : '#d0ebff'} stroke={crossed ? '#e5484d' : '#1c7ed6'} strokeWidth={3} strokeLinejoin="round" />
        {foot && (
          <g pointerEvents="none">
            <line x1={pts[0].x} y1={pts[0].y} x2={foot.x} y2={foot.y} stroke="#adb5bd" strokeDasharray="4 4" />
            <line x1={pts[2].x} y1={pts[2].y} x2={foot.x} y2={foot.y} stroke="#c2255c" strokeWidth={2} strokeDasharray="6 4" />
            <text x={(pts[2].x + foot.x) / 2 + 8} y={(pts[2].y + foot.y) / 2} className="svg-label small" fill="#c2255c">height {fmt(dist(pts[2], foot) / U, 1)}</text>
          </g>
        )}
        {pts.map((p, i) => {
          const prev = pts[(i - 1 + n) % n];
          const next = pts[(i + 1) % n];
          const m = { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
          const out = sub(m, c);
          const L = Math.hypot(out.x, out.y) || 1;
          const lp = { x: m.x + (out.x / L) * 22, y: m.y + (out.y / L) * 22 };
          const dirIn = sub(c, p);
          const Li = Math.hypot(dirIn.x, dirIn.y) || 1;
          const ap = { x: p.x + (dirIn.x / Li) * 36, y: p.y + (dirIn.y / Li) * 36 };
          void prev;
          return (
            <g key={i} pointerEvents="none">
              <text x={lp.x} y={lp.y} className="svg-label small" fill="#1c7ed6" textAnchor="middle" dominantBaseline="middle">{fmt(sides[i], 1)}</text>
              <text x={ap.x} y={ap.y} className="svg-label small" fill="#e8590c" textAnchor="middle" dominantBaseline="middle">{fmt(angles[i], 0)}°</text>
            </g>
          );
        })}
        {pts.map((p, i) => (
          <Handle key={i} x={p.x} y={p.y} label={String.fromCharCode(65 + i)} onStart={h.checkpoint}
            onDrag={(q) => h.set((s) => s.map((o, j) => (j === i ? (snapOn ? snapV(q, U) : { x: clamp(q.x, 10, W - 10), y: clamp(q.y, 10, H - 10) }) : o)))} />
        ))}
      </svg>
      <div className="overlay-badge">
        {n === 3 ? <><T k="triangle" />: {triangleKind(sides, angles)}</> : <>{n}-sided <T k="polygon" /></>}
        {crossed && ' — sides cross! not a simple polygon'}
      </div>
    </div>
  );
  const controls = (
    <>
      <Stepper label="Number of sides" value={n} min={3} max={8} onChange={changeN} />
      <Stats>
        <Stat label="angle sum" value={`${fmt(sum, 0)}°`} color="#e8590c" />
        <Stat label="perimeter" value={`${fmt(per, 1)} cm`} color="#f08c00" />
        <Stat label="area" value={`${fmt(area, 1)} cm²`} color="#1971c2" />
      </Stats>
      <div className="row">
        <Toggle label="Snap to grid" checked={snapOn} onChange={setSnapOn} />
        <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()}>
          <button className="btn" onClick={() => h.commit(regular(n))}>Make it regular</button>
        </ToolBar>
      </div>
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A <T k="triangle" /> with its <T k="side" /> lengths (blue) and its corner angles (orange). Each corner is a <T k="vertex" />.</p>,
    touch: <p>Drag the corners A, B, C. Change the number of sides with − and +.</p>,
    experiment: (
      <ul>
        <li>Make a tall thin triangle, then a flat wide one. Watch the <b>angle sum</b>.</li>
        <li>Switch to 4 sides, then 5, 6… Note the angle sum each time.</li>
        <li>Drag one corner across the shape so the sides cross. What does the tool say?</li>
      </ul>
    ),
    discover: (
      <>
        <ChoiceQuiz
          question="What happened to a triangle's angle sum when you changed its shape?"
          options={[
            { label: 'It changed every time', why: 'The individual angles changed — but check the "angle sum" box again.' },
            { label: 'It always stayed 180°', correct: true, why: 'Every triangle, any shape, has angles that add up to 180° — half a turn.' },
          ]}
        />
        <ChoiceQuiz
          question="Each extra side added 180° to the angle sum. What is the sum for 5 sides?"
          options={[
            { label: '360°', why: '360° is for 4 sides (a quadrilateral).' },
            { label: '540°', correct: true, why: '180 + 180 + 180 = 540. A pentagon can be cut into 3 triangles.' },
            { label: '900°', why: 'That would be 7 sides.' },
          ]}
        />
      </>
    ),
    understand: (
      <>
        <p>Any <T k="polygon" /> can be cut into triangles from one corner. With <b>n</b> sides you get <b>n − 2</b> triangles, each worth 180°.</p>
        <p>A triangle is half of a box around it: that is why its area has a “½” in it.</p>
        <p>A <i>regular</i> polygon has all sides equal and all angles equal.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={['angle sum = (', { s: 'n', means: 'number of sides', color: '#1c7ed6' }, ' − 2) × 180°']} />
        <Formula parts={[{ s: 'A', means: 'area of a triangle', color: '#1971c2' }, ' = ½ × ', { s: 'b', means: 'base (the side A–B)', color: '#495057' }, ' × ', { s: 'h', means: 'height: the dashed pink line, at a right angle to the base', color: '#c2255c' }]} />
        <NumberQuiz question="A triangular phone stand side panel has base 12 cm and height 8 cm. Area?" answer={48} unit="cm²" hint="Half of 12 × 8."
          diagnose={(x) => (x === 96 ? 'That is the whole rectangle around it. A triangle is half of that.' : null)}
          solution={<Steps steps={['A = ½ × b × h', '= ½ × 12 × 8', '= ½ × 96 = 48 cm²']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Triangles are rigid — that is why brackets, bike frames and bridges use them (try the <b>Build the Bridge</b> puzzle).</li>
          <li>Hexagon bolt heads, octagon stop signs and pentagon logos are regular polygons.</li>
          <li>Constructing a product shape = placing corners precisely, exactly like this tool.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <>
      <NumberTable rows={pts.map((_, i) => [`Side ${String.fromCharCode(65 + i)}${String.fromCharCode(65 + ((i + 1) % n))} · angle at ${String.fromCharCode(65 + i)}`, `${fmt(sides[i], 2)} cm · ${fmt(angles[i], 1)}°`] as [ReactNode, ReactNode])} />
      <Steps steps={[
        `Angle sum: ${angles.map((a) => fmt(a, 1)).join(' + ')} = ${fmt(sum, 1)}°`,
        `Rule: (${n} − 2) × 180 = ${(n - 2) * 180}°`,
        `Perimeter: ${sides.map((s) => fmt(s, 2)).join(' + ')} = ${fmt(per, 2)} cm`,
        `Area (counting squares, shoelace method): ${fmt(area, 2)} cm²`,
      ]} />
    </>
  );
  return <Lesson id="l2-shapes" title="Triangles & polygons" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Circles                                                             */
/* ================================================================== */

function CircleLesson() {
  const h = useHistory({ r: 2.5 });
  const { r } = h.value;
  const [mode, setMode] = useState<'measure' | 'roll' | 'slices'>('measure');
  const [roll, setRoll] = useState(0);
  const [slices, setSlices] = useState(12);
  const [t, setT] = useState(0);
  const rp = r * U * 0.8;
  const C = 2 * Math.PI * r;
  const A = Math.PI * r * r;
  const rollTimer = useRef(0);
  useEffect(() => () => cancelAnimationFrame(rollTimer.current), []);
  const playRoll = () => {
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 4000);
      setRoll(k);
      if (k < 1) rollTimer.current = requestAnimationFrame(tick);
    };
    rollTimer.current = requestAnimationFrame(tick);
  };

  let body: ReactNode;
  if (mode === 'measure') {
    const c = { x: 400, y: 250 };
    const edge = polar(c, rp, 20);
    body = (
      <g>
        <circle cx={c.x} cy={c.y} r={rp} fill="#fff4e6" stroke="#f08c00" strokeWidth={4} />
        <line x1={c.x - rp} y1={c.y} x2={c.x + rp} y2={c.y} stroke="#7048e8" strokeWidth={3} strokeDasharray="8 4" />
        <text x={c.x - rp / 2} y={c.y + 20} className="svg-label" fill="#7048e8" textAnchor="middle">diameter {fmt(2 * r, 1)} cm</text>
        <line x1={c.x} y1={c.y} x2={edge.x} y2={edge.y} stroke="#1c7ed6" strokeWidth={4} />
        <text x={(c.x + edge.x) / 2} y={(c.y + edge.y) / 2 - 12} className="svg-label" fill="#1c7ed6">radius {fmt(r, 1)} cm</text>
        <circle cx={c.x} cy={c.y} r={5} fill="#495057" />
        <text x={c.x + 4} y={c.y - rp - 14} className="svg-label" fill="#f08c00" textAnchor="middle">circumference {fmt(C, 2)} cm</text>
        <Handle x={edge.x} y={edge.y} color="#1c7ed6" onStart={h.checkpoint} title="change the radius" onDrag={(p) => h.set({ r: clamp(snap(dist(c, p) / (U * 0.8), 0.1), 0.5, 5.5) })} />
      </g>
    );
  } else if (mode === 'roll') {
    const sc = Math.min(1, 640 / (C * U * 0.8 + 2 * rp));
    const rr = rp * sc;
    const x0 = 60 + rr;
    const ground = 380;
    const travelled = roll * C * U * 0.8 * sc;
    const cx = x0 + travelled;
    const ang = (travelled / rr) * (180 / Math.PI);
    const mark = polar({ x: cx, y: ground - rr }, rr, -90 - ang);
    const d = 2 * rr;
    body = (
      <g>
        <line x1={20} y1={ground} x2={780} y2={ground} stroke="#495057" strokeWidth={2} />
        <line x1={x0} y1={ground} x2={x0 + travelled} y2={ground} stroke="#f08c00" strokeWidth={7} />
        {[1, 2, 3].map((k) => (
          <g key={k}>
            <rect x={x0 + (k - 1) * d} y={ground + 14} width={d} height={14} fill={k % 2 ? '#d0bfff' : '#b197fc'} />
            <text x={x0 + (k - 0.5) * d} y={ground + 46} className="svg-label small" fill="#5f3dc4" textAnchor="middle">diameter {k}</text>
          </g>
        ))}
        <rect x={x0 + 3 * d} y={ground + 14} width={d * (Math.PI - 3)} height={14} fill="#e5484d" />
        <text x={x0 + 3 * d + 10} y={ground + 66} className="svg-label small" fill="#e5484d">+0.14…</text>
        <circle cx={cx} cy={ground - rr} r={rr} fill="#fff4e6" stroke="#f08c00" strokeWidth={4} />
        <line x1={cx} y1={ground - rr} x2={mark.x} y2={mark.y} stroke="#1c7ed6" strokeWidth={3} />
        <circle cx={mark.x} cy={mark.y} r={7} fill="#e5484d" />
        <text x={x0 + travelled / 2} y={ground - 2 * rr - 20} className="svg-label" fill="#f08c00" textAnchor="middle">{roll > 0 ? `rolled ${fmt(roll * C, 2)} cm` : 'press ▶ Roll one turn'}</text>
      </g>
    );
  } else {
    const N = slices;
    const al = 360 / N;
    const R = Math.min(rp, 130);
    const s = (2 * Math.PI * R) / N;
    const C0 = { x: 170, y: 250 };
    const X = 360;
    const Y = 250 - R / 2;
    body = (
      <g>
        {Array.from({ length: N }, (_, k) => {
          const startA = { p: C0, h: (k + 0.5) * al };
          const j = Math.floor(k / 2);
          const down = k % 2 === 0;
          const endP = down ? { x: X + j * s + s / 2, y: Y } : { x: X + j * s + s, y: Y + R };
          const endH = down ? -90 : 90;
          let dh = endH - startA.h;
          dh = ((dh + 540) % 360) - 180;
          const p = { x: lerp(startA.p.x, endP.x, t), y: lerp(startA.p.y, endP.y, t) };
          const hd = startA.h + dh * t;
          return (
            <path key={k} d={arcPath({ x: 0, y: 0 }, R, -al / 2, al, true)} transform={`translate(${p.x} ${p.y}) rotate(${-hd})`} fill={k % 2 ? '#ffa94d' : '#74c0fc'} stroke="#fff" strokeWidth={1} />
          );
        })}
        {t > 0.98 && (
          <g pointerEvents="none">
            <DimLine a={{ x: X + s / 2, y: Y + R }} b={{ x: X + (N / 2) * s + s / 2, y: Y + R }} offset={-34} label={`≈ half the circumference = π × r`} color="#e8590c" />
            <DimLine a={{ x: X + (N / 2) * s + s / 2 + 8, y: Y + R }} b={{ x: X + (N / 2) * s + s / 2 + 8, y: Y }} offset={-22} label="r" color="#1c7ed6" />
          </g>
        )}
      </g>
    );
  }

  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} ${H}`}>
      <SvgDefs />
      {body}
    </svg>
  );
  const controls = (
    <>
      <Segmented value={mode} onChange={(m) => { setMode(m); setRoll(0); }} options={[{ value: 'measure', label: '📏 Measure' }, { value: 'roll', label: '🛞 Roll the wheel' }, { value: 'slices', label: '🍕 Slice & rearrange' }]} />
      <Slider label={<T k="radius" />} value={r} min={0.5} max={5.5} step={0.1} unit="cm" onStart={h.checkpoint} onChange={(x) => h.set({ r: x })} color="#1c7ed6" />
      {mode === 'roll' && <button className="btn primary" onClick={playRoll}>▶ Roll one turn</button>}
      {mode === 'slices' && (
        <>
          <Slider label="Number of slices" value={slices} min={4} max={40} step={2} onChange={setSlices} />
          <Slider label="Rearrange" value={t} min={0} max={1} step={0.01} onChange={setT} format={(x) => `${Math.round(x * 100)}%`} />
        </>
      )}
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A <T k="circle" />: every point on the edge is the same distance from the centre. That distance is the <T k="radius" />. Straight across through the centre is the <T k="diameter" />.</p>,
    touch: <p>Drag the blue dot to grow or shrink the circle.</p>,
    experiment: (
      <ul>
        <li>Choose <b>🛞 Roll the wheel</b> and press play. The wheel unrolls its edge onto the ground.</li>
        <li>Compare the orange line with the purple diameter blocks underneath.</li>
        <li>Try a big wheel and a small wheel.</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz
        question="How many diameters long is the unrolled edge (the circumference)?"
        options={[
          { label: 'Exactly 3', why: 'Look at the little red piece after the third purple block.' },
          { label: 'A bit more than 3 — about 3.14', correct: true, why: 'For every circle, big or small! This number is called π (pi).' },
          { label: 'It depends on the size of the wheel', why: 'Try two sizes — the ratio stays the same. Only the actual lengths change.' },
        ]}
      />
    ),
    understand: (
      <>
        <p>Every circle's edge is <b>π ≈ 3.14 times</b> its diameter. That number never changes.</p>
        <p>Choose <b>🍕 Slice & rearrange</b>: cut the circle into thin slices and line them up. They make an almost-rectangle, π × r long and r tall.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'C', means: 'circumference: distance around', color: '#f08c00' }, ' = ', { s: 'π', means: 'pi ≈ 3.14159', color: '#7048e8' }, ' × ', { s: 'd', means: 'diameter', color: '#7048e8' }, ' = 2 × π × ', { s: 'r', means: 'radius', color: '#1c7ed6' }]} />
        <Formula parts={[{ s: 'A', means: 'area inside', color: '#1971c2' }, ' = ', { s: 'π', means: 'pi', color: '#7048e8' }, ' × ', { s: 'r', means: 'radius', color: '#1c7ed6' }, '²']} caption="r² means r × r. From the slices: (π × r) long × r tall." />
        <NumberQuiz question="A bottle is 6 cm across (diameter). How long must its wrap-around label be?" answer={18.85} tolerance={0.1} unit="cm" hint="Distance around = π × diameter."
          diagnose={(x) => (Math.abs(x - 28.27) < 0.2 ? 'That is the area of the bottom. A label goes around — circumference.' : Math.abs(x - 37.7) < 0.2 ? 'You used 6 as the radius. 6 cm across is the diameter.' : null)}
          solution={<Steps steps={['C = π × d', '= 3.1416 × 6', '≈ 18.85 cm']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Labels on bottles, belts on pulleys, tyres: all need the <b>circumference</b>.</li>
          <li>Lids, buttons and speaker grilles: the <b>area</b> tells you material and airflow.</li>
          <li>Sketch circles in perspective as ellipses — their size still comes from the radius.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['Radius r', `${fmt(r, 1)} cm`],
      ['Diameter d = 2 × r', `2 × ${fmt(r, 1)} = ${fmt(2 * r, 1)} cm`],
      ['Circumference C = π × d', `3.14159 × ${fmt(2 * r, 1)} = ${fmt(C, 2)} cm`],
      ['C ÷ d', `${fmt(C, 2)} ÷ ${fmt(2 * r, 1)} = ${fmt(Math.PI, 5)}`],
      ['Area A = π × r × r', `3.14159 × ${fmt(r, 1)} × ${fmt(r, 1)} = ${fmt(A, 2)} cm²`],
    ]} />
  );
  return <Lesson id="l2-circle" title="Circles" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Symmetry                                                            */
/* ================================================================== */

type SymShape = 'rectangle' | 'square' | 'equilateral' | 'isosceles' | 'pentagon' | 'hexagon' | 'parallelogram' | 'scalene';
const SYM_SHAPES: Record<SymShape, { pts: Vec[]; lines: number; label: string }> = {
  rectangle: { pts: [{ x: -150, y: -80 }, { x: 150, y: -80 }, { x: 150, y: 80 }, { x: -150, y: 80 }], lines: 2, label: 'Rectangle' },
  square: { pts: [{ x: -110, y: -110 }, { x: 110, y: -110 }, { x: 110, y: 110 }, { x: -110, y: 110 }], lines: 4, label: 'Square' },
  equilateral: { pts: regular(3, { x: 0, y: 0 }, 150), lines: 3, label: 'Equilateral triangle' },
  isosceles: { pts: [{ x: -90, y: 110 }, { x: 90, y: 110 }, { x: 0, y: -140 }], lines: 1, label: 'Isosceles triangle' },
  pentagon: { pts: regular(5, { x: 0, y: 0 }, 140), lines: 5, label: 'Regular pentagon' },
  hexagon: { pts: regular(6, { x: 0, y: 0 }, 140), lines: 6, label: 'Regular hexagon' },
  parallelogram: { pts: [{ x: -170, y: 80 }, { x: 90, y: 80 }, { x: 170, y: -80 }, { x: -90, y: -80 }], lines: 0, label: 'Parallelogram' },
  scalene: { pts: [{ x: -150, y: 100 }, { x: 160, y: 60 }, { x: -20, y: -120 }], lines: 0, label: 'Scalene triangle' },
};

function reflect(p: Vec, deg: number): Vec {
  const a = (deg * Math.PI) / 90; // reflection across a line at angle deg through the origin
  return { x: p.x * Math.cos(a) + p.y * Math.sin(a), y: p.x * Math.sin(a) - p.y * Math.cos(a) };
}

function SymmetryLesson() {
  const [tab, setTab] = useState<'mirror' | 'find'>('mirror');
  const [mirror, setMirror] = useState<'v' | 'h' | 'both' | 'radial'>('v');
  const [radialN, setRadialN] = useState(6);
  const sk = useHistory<Stroke[]>([]);
  const [shape, setShape] = useState<SymShape>('rectangle');
  const [lineDeg, setLineDeg] = useState(30);
  const [found, setFound] = useState<Record<string, number[]>>({});
  const cx = 400;
  const cy = 250;

  const copies = useMemo(() => {
    if (mirror === 'v') return [`matrix(-1 0 0 1 ${2 * cx} 0)`];
    if (mirror === 'h') return [`matrix(1 0 0 -1 0 ${2 * cy})`];
    if (mirror === 'both') return [`matrix(-1 0 0 1 ${2 * cx} 0)`, `matrix(1 0 0 -1 0 ${2 * cy})`, `matrix(-1 0 0 -1 ${2 * cx} ${2 * cy})`];
    return Array.from({ length: radialN - 1 }, (_, k) => `rotate(${(360 * (k + 1)) / radialN} ${cx} ${cy})`);
  }, [mirror, radialN]);

  const S = SYM_SHAPES[shape];
  // canonical symmetry test: reflect vertices and see if they land on vertices
  const reflected = S.pts.map((p) => reflect(p, -lineDeg));
  const match = reflected.every((q) => S.pts.some((p) => dist(p, q) < 6));
  const fl = found[shape] ?? [];
  const canonical = Math.round(((lineDeg % 180) + 180) % 180);
  useEffect(() => {
    if (tab !== 'find' || !match) return;
    setFound((f) => {
      const list = f[shape] ?? [];
      if (list.some((d) => Math.abs(d - canonical) < 3 || Math.abs(d - canonical) > 177)) return f;
      return { ...f, [shape]: [...list, canonical] };
    });
  }, [match, canonical, shape, tab]);
  const lineEnd = polar({ x: cx, y: cy }, 230, lineDeg);
  const lineStart = polar({ x: cx, y: cy }, 230, lineDeg + 180);

  const tool =
    tab === 'mirror' ? (
      <svg className="tool" viewBox={`0 0 ${W} ${H}`}>
        <GridLines x0={0} y0={0} w={W} h={H} step={U} />
        {(mirror === 'v' || mirror === 'both') && <line x1={cx} y1={0} x2={cx} y2={H} stroke="#7048e8" strokeWidth={2} strokeDasharray="8 6" />}
        {(mirror === 'h' || mirror === 'both') && <line x1={0} y1={cy} x2={W} y2={cy} stroke="#7048e8" strokeWidth={2} strokeDasharray="8 6" />}
        {mirror === 'radial' && Array.from({ length: radialN }, (_, k) => {
          const e = polar({ x: cx, y: cy }, 300, 90 + (360 * k) / radialN);
          return <line key={k} x1={cx} y1={cy} x2={e.x} y2={e.y} stroke="#d0bfff" strokeDasharray="4 6" />;
        })}
        <SketchLayer active strokes={sk.value} onStrokes={(s) => sk.commit(s)} width={W} height={H} copies={copies} size={4} />
      </svg>
    ) : (
      <svg className="tool" viewBox={`0 0 ${W} ${H}`}>
        <g transform={`translate(${cx} ${cy})`}>
          <path d={pathFrom(S.pts)} fill="#d0ebff" stroke="#1c7ed6" strokeWidth={3} />
          <path d={pathFrom(reflected)} fill={match ? '#b2f2bb88' : '#ffc9c955'} stroke={match ? '#2b8a3e' : '#e5484d'} strokeWidth={2} strokeDasharray="6 4" />
          {fl.map((d) => {
            const e = polar({ x: 0, y: 0 }, 200, d);
            return <line key={d} x1={-e.x} y1={-e.y} x2={e.x} y2={e.y} stroke="#2b8a3e" strokeWidth={2} opacity={0.5} />;
          })}
        </g>
        <line x1={lineStart.x} y1={lineStart.y} x2={lineEnd.x} y2={lineEnd.y} stroke="#7048e8" strokeWidth={3} />
        <Handle x={lineEnd.x} y={lineEnd.y} color="#7048e8" title="turn the mirror line" onDrag={(p) => setLineDeg(Math.round(((Math.atan2(-(p.y - cy), p.x - cx) * 180) / Math.PI + 360) % 360))} />
        <text x={20} y={30} className="svg-label" fill={match ? '#2b8a3e' : '#495057'}>{match ? '✔ Mirror line! The reflection fits exactly.' : 'Turn the purple mirror line until the dashed reflection fits the shape.'}</text>
        <text x={20} y={H - 20} className="svg-label" fill="#495057">Found {fl.length} line{fl.length === 1 ? '' : 's'} of symmetry</text>
      </svg>
    );
  const controls =
    tab === 'mirror' ? (
      <>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'mirror', label: '🪞 Mirror sketch' }, { value: 'find', label: '🔍 Find mirror lines' }]} />
        <Segmented small value={mirror} onChange={setMirror} options={[{ value: 'v', label: 'Left | Right' }, { value: 'h', label: 'Top / Bottom' }, { value: 'both', label: 'Both' }, { value: 'radial', label: 'Radial' }]} />
        {mirror === 'radial' && <Stepper label="Copies" value={radialN} min={3} max={12} onChange={setRadialN} />}
        <ToolBar onUndo={sk.undo} canUndo={sk.canUndo} onReset={() => sk.reset([])} />
      </>
    ) : (
      <>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'mirror', label: '🪞 Mirror sketch' }, { value: 'find', label: '🔍 Find mirror lines' }]} />
        <select className="btn" value={shape} onChange={(e) => setShape(e.target.value as SymShape)}>
          {(Object.keys(SYM_SHAPES) as SymShape[]).map((k) => <option key={k} value={k}>{SYM_SHAPES[k].label}</option>)}
        </select>
        <Slider label="Mirror line angle" value={lineDeg} min={0} max={179} unit="°" onChange={setLineDeg} />
      </>
    );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A shape has <T k="symmetry" /> when one half is a mirror image of the other. The dashed purple line is the mirror.</p>,
    touch: <p>Draw on one side of the mirror with your finger or stylus. The other side draws itself.</p>,
    experiment: (
      <ul>
        <li>Draw half a bottle or half a vase on the left. You get the whole thing.</li>
        <li>Try <b>Both</b> and <b>Radial</b> mirrors — like a snowflake or a wheel rim.</li>
        <li>Open <b>🔍 Find mirror lines</b> and find every mirror line of each shape.</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz
        question="How many mirror lines does a regular hexagon (6 equal sides) have?"
        options={[
          { label: '2', why: 'A rectangle has 2. Check the hexagon in 🔍 Find mirror lines.' },
          { label: '6', correct: true, why: 'Regular shapes have as many mirror lines as sides: 3 for a triangle, 4 for a square, 6 for a hexagon.' },
          { label: '12', why: 'There are 12 ways to place a hexagon on itself if you include turning, but only 6 are mirrors.' },
        ]}
      />
    ),
    understand: (
      <>
        <p>Mirror symmetry: fold along the line and both halves land exactly on top of each other.</p>
        <p>Every point on one side has a partner on the other side, the <b>same distance</b> from the mirror line.</p>
        <p>A parallelogram has no mirror lines, even though it looks “balanced” — it has turning symmetry instead.</p>
      </>
    ),
    calculate: (
      <>
        <p>Mirror across a vertical line at x = m:</p>
        <Formula parts={['new ', { s: 'x', means: 'horizontal position', color: '#1c7ed6' }, ' = 2 × ', { s: 'm', means: 'position of the mirror line', color: '#7048e8' }, ' − old ', { s: 'x', means: '', color: '#1c7ed6' }]} caption="The height (y) stays the same." />
        <NumberQuiz question="A mirror line is at x = 50 mm. A screw hole is at x = 30 mm. Where is its mirror partner?" answer={70} unit="mm" hint="It is 20 mm left of the mirror, so the partner is 20 mm right of it."
          solution={<Steps steps={['2 × 50 − 30', '= 100 − 30', '= 70 mm']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Most products are symmetrical left–right: draw a <b>centre line first</b>, then sketch one half and mirror it.</li>
          <li>Screw holes, feet and buttons are placed in mirror pairs so the product sits and looks balanced.</li>
          <li>Radial symmetry: wheels, fans, knobs, bottle caps.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['Mirror mode', tab === 'mirror' ? mirror : 'finding lines'],
      ['Strokes drawn', `${sk.value.length} (shown ${copies.length + 1} times)`],
      ['Shape', S.label],
      ['Mirror lines it has', `${S.lines}`],
      ['Found so far', `${fl.length}${fl.length ? ` at ${fl.map((d) => `${d}°`).join(', ')}` : ''}`],
    ]} />
  );
  return <Lesson id="l2-symmetry" title="Symmetry mirror" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

export default {
  'l2-rectangle': RectangleLesson,
  'l2-lines': LinesLesson,
  'l2-shapes': ShapesLesson,
  'l2-circle': CircleLesson,
  'l2-symmetry': SymmetryLesson,
  'l2-challenge': RectangleChallenge,
};
