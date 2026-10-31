import { useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { CadSketch, ConstraintPanel, useSketchHistory } from '../../components/sketch/CadSketch';
import { Seg, Task } from '../../components/ui';
import { addCircle, addLine, addPoint, addRect, analyse, pointLineDistance, pointOf, sid, solve, type SCircle, type SLine, type Sketch } from '../../lib/cad/sketch';
import { absTol, fmt } from '../../lib/math';
import { useSettings } from '../../store/progress';
import type { Feedback, LessonStep, Vec2 } from '../../lib/types';

function quad(pts: Vec2[]): Sketch {
  let s: Sketch = { points: [], entities: [], constraints: [] };
  const ids: string[] = [];
  for (const p of pts) {
    let id: string;
    [s, id] = addPoint(s, p[0], p[1]);
    ids.push(id);
  }
  for (let i = 0; i < ids.length; i++) [s] = addLine(s, ids[i], ids[(i + 1) % ids.length]);
  return s;
}
function challenge(): Sketch {
  let s = quad([
    [3, 4],
    [57, -3],
    [63, 36],
    [-4, 43],
  ]);
  [s] = addCircle(s, 24, 55, 7);
  return s;
}
function exampleUnder(): Sketch {
  return solve(addRect({ points: [], entities: [], constraints: [] }, 0, 0, 50, 30));
}
function exampleFull(): Sketch {
  let s = addRect({ points: [], entities: [], constraints: [] }, 0, 0, 50, 30);
  const [a, b, , d] = s.points;
  s = {
    ...s,
    constraints: [
      ...s.constraints,
      { id: sid('k'), type: 'fix', refs: [a.id], x: 0, y: 0 },
      { id: sid('k'), type: 'hdist', refs: [a.id, b.id], value: 50 },
      { id: sid('k'), type: 'vdist', refs: [a.id, d.id], value: 30 },
    ],
  };
  return solve(s);
}
function exampleConflict(): Sketch {
  const s = exampleFull();
  const [, , c, d] = s.points;
  return solve({ ...s, constraints: [...s.constraints, { id: sid('k'), type: 'hdist', refs: [d.id, c.id], value: 60 }] });
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Load the three examples. Drag the points of each one: the under-constrained rectangle stretches, the fully constrained one cannot move, the conflicting one is red because two rules disagree (50 mm and 60 mm for the same width).', ta: 'மூன்று உதாரணங்களையும் ஏற்றி புள்ளிகளை இழுத்துப் பாருங்கள்.' },
  { stage: 'UNDERSTAND', text: 'A point in 2D has 2 degrees of freedom (x, y); a circle adds its radius. Each constraint removes freedom: Horizontal removes 1, Coincident removes 2, a dimension removes 1. Zero left = fully constrained.', ta: '2D-இல் ஒரு புள்ளிக்கு 2 சுதந்திர அளவுகள் (x, y). ஒவ்வொரு கட்டுப்பாடும் சுதந்திரத்தைக் குறைக்கிறது.' },
  { stage: 'EXPERIMENT', text: 'Constraints you can add: coincident, horizontal, vertical, parallel, perpendicular, tangent, equal, concentric, fix — plus dimensions. Select 1–2 items to see which apply.', ta: 'Coincident, horizontal, vertical, parallel, perpendicular, tangent, equal, concentric, fix — மற்றும் அளவுகள்.' },
  { stage: 'BUILD', text: 'Challenge: turn the wobbly shape into a FULLY constrained 60 × 40 rectangle with its bottom-left corner fixed at the origin, and a circle of radius 10 tangent to the top edge, its centre 30 mm from the left edge.', ta: 'சவால்: 60 × 40 செவ்வகம், கீழ்-இடது மூலை origin-இல், ஆரம் 10 வட்டம் மேல் விளிம்பைத் தொட்டு, இடது விளிம்பிலிருந்து 30 mm.' },
];

export default function L3Constraints() {
  const { difficulty } = useSettings();
  const tol = absTol(difficulty) / 2;
  const h = useSketchHistory(challenge());
  const [mode, setMode] = useState<'challenge' | 'under' | 'full' | 'conflict'>('challenge');
  const ex = useSketchHistory(exampleUnder());
  const [sel, setSel] = useState<string[]>([]);
  const cur = mode === 'challenge' ? h : ex;
  const info = analyse(cur.sk);

  const sk = h.sk;
  const lines = sk.entities.filter((e) => e.kind === 'line') as SLine[];
  const circle = sk.entities.find((e) => e.kind === 'circle') as SCircle | undefined;
  const P = sk.points.slice(0, 4).map((p) => [p.x, p.y] as Vec2);
  const minX = Math.min(...P.map((p) => p[0])),
    minY = Math.min(...P.map((p) => p[1]));
  const bl = P.reduce((b, p) => (Math.hypot(p[0] - minX, p[1] - minY) < Math.hypot(b[0] - minX, b[1] - minY) ? p : b), P[0]);
  const isRect = lines.every((l) => {
    const a = pointOf(sk, l.a),
      b = pointOf(sk, l.b);
    return Math.abs(a[0] - b[0]) < 0.05 || Math.abs(a[1] - b[1]) < 0.05;
  });
  const W = Math.max(...P.map((p) => p[0])) - minX;
  const H = Math.max(...P.map((p) => p[1])) - minY;
  const topLine = lines.reduce((t, l) => (pointOf(sk, l.a)[1] + pointOf(sk, l.b)[1] > pointOf(sk, t.a)[1] + pointOf(sk, t.b)[1] ? l : t), lines[0]);
  const leftLine = lines.reduce((t, l) => (pointOf(sk, l.a)[0] + pointOf(sk, l.b)[0] < pointOf(sk, t.a)[0] + pointOf(sk, t.b)[0] ? l : t), lines[0]);
  const c = circle ? pointOf(sk, circle.c) : ([0, 0] as Vec2);
  const tangentErr = circle ? Math.abs(pointLineDistance(c, pointOf(sk, topLine.a), pointOf(sk, topLine.b)) - circle.r) : 99;
  const leftDist = circle ? pointLineDistance(c, pointOf(sk, leftLine.a), pointOf(sk, leftLine.b)) : 0;
  const chInfo = analyse(sk);
  const checks: [boolean, string, string][] = [
    [isRect, 'All sides horizontal or vertical', 'Some sides are slanted — add Horizontal / Vertical constraints.'],
    [Math.hypot(bl[0], bl[1]) <= tol, 'Bottom-left corner at the origin', `Bottom-left corner is at (${fmt(bl[0])}, ${fmt(bl[1])}) — select it and press ⚓ Fix, then make sure it is at 0, 0.`],
    [Math.abs(W - 60) <= tol && Math.abs(H - 40) <= tol, 'Size 60 × 40 mm', `Size is ${fmt(W)} × ${fmt(H)} mm.`],
    [!!circle && Math.abs(circle.r - 10) <= tol, 'Circle radius 10 mm', `Radius is ${fmt(circle?.r ?? 0)} mm.`],
    [tangentErr <= tol, 'Circle tangent to the top edge', 'The circle does not touch the top edge — select the top line + circle → Tangent.'],
    [Math.abs(leftDist - 30) <= tol, 'Circle centre 30 mm from the left edge', `Centre is ${fmt(leftDist)} mm from the left edge.`],
    [chInfo.status === 'full', 'Fully constrained (0 DOF)', chInfo.status === 'conflict' ? 'Conflicting constraints — remove the last one you added.' : chInfo.status === 'redundant' ? 'A redundant constraint duplicates another — remove it.' : `${chInfo.dof} degree(s) of freedom remain.`],
  ];

  const evaluate = (): Feedback => {
    const ok = checks.filter((k) => k[0]).length;
    return {
      score: Math.round((ok / checks.length) * 100),
      correct: checks.filter((k) => k[0]).map((k) => k[1]),
      issues: checks.filter((k) => !k[0]).map((k) => ({ label: k[2] })),
      why: 'Constraints capture how a design should behave when it changes. If the circle is “tangent” and “30 mm from the left”, it stays put when the plate grows — instead of floating to a random position. Conflicts mean two requirements cannot both be true.',
      suggestion: chInfo.status === 'under' ? 'Drag each blue point — whatever moves still needs a constraint. Fix the corner first, then shape (H/V), then size (dimensions), then relationships (tangent).' : 'Order that works well: Fix → Horizontal/Vertical → dimensions → tangent / distance.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w3-l3"
      steps={steps}
      evaluate={evaluate}
      onRetry={() => h.reset(challenge())}
      hints={[
        { en: 'Shape first: select each side and press Horizontal or Vertical. The quad snaps into a rectangle.', ta: 'முதலில் ஒவ்வொரு பக்கத்தையும் Horizontal / Vertical ஆக்குங்கள்.' },
        { en: 'Total DOF at the start: 4 points × 2 + circle (x, y, r) = 11. You need 11 independent constraints.', ta: 'தொடக்க DOF: 4 × 2 + 3 = 11.' },
      ]}
      viewport={
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="toolbar">
            <Seg
              value={mode}
              onChange={(m) => {
                setMode(m);
                setSel([]);
                if (m === 'under') ex.reset(exampleUnder());
                if (m === 'full') ex.reset(exampleFull());
                if (m === 'conflict') ex.reset(exampleConflict());
              }}
              options={[
                { v: 'challenge', label: '🎯 Challenge' },
                { v: 'under', label: 'Example: under' },
                { v: 'full', label: 'Example: full' },
                { v: 'conflict', label: 'Example: conflict' },
              ]}
            />
            <button className="btn small icon" onClick={cur.undo} disabled={!cur.canUndo}>
              ↶
            </button>
            <button className="btn small icon" onClick={cur.redo} disabled={!cur.canRedo}>
              ↷
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <CadSketch key={mode} sketch={cur.sk} onChange={cur.change} tool="select" selection={sel} onSelect={setSel} info={info} extent={65} center={[28, 28]} />
          </div>
        </div>
      }
    >
      <ConstraintPanel sketch={cur.sk} selection={sel} onChange={cur.change} onSelect={setSel} />
      {mode === 'challenge' ? (
        <div className="card" style={{ padding: 10 }}>
          {checks.map((k, i) => (
            <Task key={i} ok={k[0]}>
              {k[1]}
            </Task>
          ))}
        </div>
      ) : (
        <div className="note">Example mode: experiment freely. Switch back to 🎯 Challenge to continue — your challenge sketch is kept.</div>
      )}
      <div className="muted" style={{ fontSize: 12 }}>
        Colours: <span style={{ color: '#4cc9f0' }}>blue = free</span> · <span style={{ color: '#e8eef4' }}>white = fully defined</span> · <span style={{ color: '#f85149' }}>red = conflict</span>
      </div>
    </LevelShell>
  );
}
