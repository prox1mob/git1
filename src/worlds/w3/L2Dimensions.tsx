import { useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { CadSketch, ConstraintPanel, useSketchHistory } from '../../components/sketch/CadSketch';
import { Task } from '../../components/ui';
import { addCircle, addRect, analyse, isDimension, lineLength, pointLineDistance, pointOf, sid, solve, type SCircle, type SLine, type Sketch } from '../../lib/cad/sketch';
import { absTol, fmt } from '../../lib/math';
import { useSettings } from '../../store/progress';
import type { Feedback, LessonStep } from '../../lib/types';

function start(): Sketch {
  let s = addRect({ points: [], entities: [], constraints: [] }, 0, 0, 68, 42);
  s = { ...s, constraints: [...s.constraints, { id: sid('k'), type: 'fix', refs: [s.points[0].id], x: 0, y: 0 }] };
  [s] = addCircle(s, 30, 15, 6);
  return solve(s);
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'This mounting plate is sketched but not sized. Its corner is anchored (⚓) at the origin and its sides are already horizontal / vertical.', ta: 'இந்தத் தகடு வரையப்பட்டுள்ளது, ஆனால் அளவிடப்படவில்லை.' },
  { stage: 'TOUCH', text: 'Select the bottom line and press “↔ Length”. A dimension appears with its current value. Change the number — the geometry follows. Dimensions DRIVE the sketch.', ta: 'அடிக்கோட்டைத் தேர்ந்தெடுத்து "Length" அழுத்துங்கள். எண்ணை மாற்றினால் வடிவமும் மாறும்.' },
  { stage: 'UNDERSTAND', text: 'To position the hole, select its centre point and an edge line, then add a point–line distance. Select the circle alone to set its diameter.', ta: 'துளையின் நிலைக்கு: மையப்புள்ளி + விளிம்புக் கோடு → point–line distance.' },
  { stage: 'BUILD', text: 'Make the plate 80 × 50 mm with a Ø20 hole whose centre is 20 mm from the left edge and 25 mm from the bottom edge. Aim for “Fully constrained”.', ta: 'தகடு 80 × 50 mm, Ø20 துளை; மையம் இடது விளிம்பிலிருந்து 20 mm, கீழிருந்து 25 mm.' },
];

export default function L2Dimensions() {
  const { difficulty } = useSettings();
  const tol = absTol(difficulty) / 2;
  const h = useSketchHistory(start());
  const [sel, setSel] = useState<string[]>([]);
  const info = analyse(h.sk);
  const sk = h.sk;
  const lines = sk.entities.filter((e) => e.kind === 'line') as SLine[];
  const circle = sk.entities.find((e) => e.kind === 'circle') as SCircle | undefined;
  const left = lines[3],
    bottom = lines[0];
  const W = lineLength(sk, lines[0]),
    H = lineLength(sk, lines[1]);
  const c = circle ? pointOf(sk, circle.c) : ([0, 0] as [number, number]);
  const dl = circle && left ? pointLineDistance(c, pointOf(sk, left.a), pointOf(sk, left.b)) : 0;
  const db = circle && bottom ? pointLineDistance(c, pointOf(sk, bottom.a), pointOf(sk, bottom.b)) : 0;
  const dimCount = sk.constraints.filter((k) => isDimension(k.type)).length;
  const checks: [boolean, string, string][] = [
    [Math.abs(W - 80) <= tol, 'Width 80 mm', `Width is ${fmt(W)} mm`],
    [Math.abs(H - 50) <= tol, 'Height 50 mm', `Height is ${fmt(H)} mm`],
    [!!circle && Math.abs(circle.r * 2 - 20) <= tol, 'Hole Ø20', `Hole is Ø${fmt((circle?.r ?? 0) * 2)}`],
    [Math.abs(dl - 20) <= tol, 'Hole 20 mm from the left edge', `Hole centre is ${fmt(dl)} mm from the left edge`],
    [Math.abs(db - 25) <= tol, 'Hole 25 mm from the bottom edge', `Hole centre is ${fmt(db)} mm from the bottom edge`],
  ];

  const evaluate = (): Feedback => {
    const geo = checks.filter((k) => k[0]).length;
    const full = info.status === 'full';
    const score = Math.round(geo * 16 + (full ? 20 : dimCount >= 4 ? 10 : 0));
    return {
      score,
      correct: [...checks.filter((k) => k[0]).map((k) => k[1]), ...(full ? ['Sketch is fully constrained — it cannot change by accident.'] : [])],
      issues: [
        ...checks.filter((k) => !k[0]).map((k) => ({ label: k[2] })),
        ...(full ? [] : [{ label: `Still ${info.dof} degree(s) of freedom.`, detail: info.status === 'conflict' ? 'Some dimensions contradict each other — remove one.' : 'Add the missing dimensions so nothing is left to chance (blue items can still move).' }]),
      ],
      why: 'Dimensions encode design intent. A part that “looks right” but is not dimensioned will drift when you edit it, and the factory will not know which sizes matter. Fully defined sketches are predictable.',
      suggestion: dimCount < 5 ? 'You need five dimensions: width, height, diameter and two hole positions.' : 'Drag a blue point: if anything still moves, a dimension is missing there.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w3-l2"
      steps={steps}
      evaluate={evaluate}
      onRetry={() => h.reset(start())}
      hints={[{ en: 'Select the circle’s centre dot, then the left (vertical) line, then “↔ Point–line distance”, and type 20.', ta: 'வட்ட மையம் + இடது கோடு → Point–line distance → 20.' }]}
      viewport={
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="toolbar">
            <span className="muted" style={{ fontSize: 13 }}>
              Select tool · drag points · tap shapes to select
            </span>
            <button className="btn small icon" onClick={h.undo} disabled={!h.canUndo}>
              ↶
            </button>
            <button className="btn small icon" onClick={h.redo} disabled={!h.canRedo}>
              ↷
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <CadSketch sketch={sk} onChange={h.change} tool="select" selection={sel} onSelect={setSel} info={info} extent={70} center={[40, 25]} />
          </div>
        </div>
      }
    >
      <ConstraintPanel sketch={sk} selection={sel} onChange={h.change} onSelect={setSel} dimsOnly />
      <div className="card" style={{ padding: 10 }}>
        {checks.map((k, i) => (
          <Task key={i} ok={k[0]}>
            {k[1]} <span className="muted">· now {k[2].replace(/^[^0-9Ø]*/, '')}</span>
          </Task>
        ))}
        <Task ok={info.status === 'full'}>Fully constrained</Task>
      </div>
    </LevelShell>
  );
}
