import { useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { SketchText, SketchView, usePx } from '../../components/sketch/SketchView';
import { NumberField, Task } from '../../components/ui';
import { DEG, fmt, relTol } from '../../lib/math';
import { useSettings } from '../../store/progress';
import type { Feedback, LessonStep, Vec2 } from '../../lib/types';

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'A ramp is a right-angled triangle: run (adjacent), rise (opposite) and the sloped length (hypotenuse).', ta: 'சாய்தளம் ஒரு செங்கோண முக்கோணம்: அடிப்பக்கம், உயரம், சாய்வுப் பக்கம்.' },
  { stage: 'TOUCH', text: 'Drag the orange corner to change the rise and run. The squares on each side show Pythagoras: the two small areas add up to the big one.', ta: 'ஆரஞ்சு மூலையை இழுங்கள். பித்தகோரஸ்: இரு சிறிய சதுரங்களின் பரப்பு = பெரிய சதுரம்.' },
  { stage: 'UNDERSTAND', text: 'SOH-CAH-TOA: sin θ = opposite ÷ hypotenuse, cos θ = adjacent ÷ hypotenuse, tan θ = opposite ÷ adjacent. And a² + b² = c².', ta: 'sin = எதிர் ÷ கர்ணம், cos = அடுத்துள்ள ÷ கர்ணம், tan = எதிர் ÷ அடுத்துள்ள. a² + b² = c².' },
  { stage: 'TEST', text: 'Solve the two design problems and type your answers.', ta: 'இரண்டு வடிவமைப்புக் கணக்குகளைத் தீர்த்து விடைகளை டைப் செய்யுங்கள்.' },
];

function Corner({ p, onDown }: { p: Vec2; onDown: (e: React.PointerEvent) => void }) {
  const r = usePx(11);
  return <circle cx={p[0]} cy={p[1]} r={r} fill="#f8961e" stroke="#0e141b" strokeWidth={usePx(2)} onPointerDown={onDown} style={{ cursor: 'grab' }} />;
}

export default function L6Trig() {
  const { difficulty } = useSettings();
  const tol = relTol(difficulty);
  const [run, setRun] = useState(120);
  const [rise, setRise] = useState(50);
  const [drag, setDrag] = useState(false);
  const [ans, setAns] = useState({ run: 0, len: 0, ang: 0, h: 0 });
  const [corr, setCorr] = useState(false);
  const hyp = Math.hypot(run, rise);
  const th = Math.atan2(rise, run);
  const S = 0.25; // drawing scale for the Pythagoras squares

  // targets
  const t1run = 150 * 12,
    t1len = Math.hypot(1800, 150),
    t1ang = Math.atan(150 / 1800) / DEG;
  const t2h = 100 * Math.sin(65 * DEG);

  const evaluate = (): Feedback => {
    const checks: [string, number, number, string][] = [
      ['Ramp run for 1 : 12 slope', ans.run, t1run, 'run = rise × 12'],
      ['Ramp sloped length', ans.len, t1len, 'c = √(a² + b²)'],
      ['Ramp angle', ans.ang, t1ang, 'θ = atan(rise ÷ run)'],
      ['Phone-stand height', ans.h, t2h, 'h = leg × sin 65°'],
    ];
    const correct: string[] = [];
    const issues: Feedback['issues'] = [];
    let s = 0;
    for (const [l, v, t, how] of checks) {
      const e = Math.abs(v - t) / t;
      if (e <= tol) {
        s++;
        correct.push(`${l}: ${fmt(v, 2)} ✓`);
      } else issues.push({ label: `${l}: you wrote ${fmt(v, 2)}.`, detail: `Use ${how} → ${fmt(t, 2)}.` });
    }
    return {
      score: Math.round((s / checks.length) * 100),
      correct,
      issues,
      why: 'Trigonometry turns angles into lengths and back. It sizes ramps, stand legs, chamfers and drafts, and tells a CNC machine where a sloped hole ends. Accessibility codes (like 1 : 12 ramps) are written as ratios you must convert.',
      suggestion: 'Model the problem with the triangle on the left first (set rise and run), read the values, then type them in.',
      canShowCorrection: true,
    };
  };

  const A: Vec2 = [0, 0],
    B: Vec2 = [run * S, 0],
    C: Vec2 = [run * S, rise * S];
  const nx = -Math.sin(th),
    ny = Math.cos(th);
  const hypSq: Vec2[] = [A, C, [C[0] + nx * hyp * S, C[1] + ny * hyp * S], [A[0] + nx * hyp * S, A[1] + ny * hyp * S]];

  return (
    <LevelShell
      id="w2-l6"
      steps={steps}
      evaluate={evaluate}
      onCorrection={setCorr}
      hints={[{ en: '1 : 12 means 12 mm of run for every 1 mm of rise: 150 × 12 = 1800 mm.', ta: '1 : 12 என்றால் ஒவ்வொரு 1 mm உயரத்துக்கும் 12 mm நீளம்.' }]}
      viewport={
        <div style={{ flex: 1, display: 'flex' }}>
          <SketchView
            extent={60}
            center={[25, 10]}
            grid={5}
            onMove={({ pt }) => {
              if (!drag) return;
              setRun(Math.max(10, Math.round(pt[0] / S)));
              setRise(Math.max(5, Math.round(pt[1] / S)));
            }}
            onUp={() => setDrag(false)}
          >
            <polygon points={[A, B, [B[0], -run * S], [0, -run * S]].map((p) => p.join(',')).join(' ')} fill="rgba(255,95,95,0.15)" stroke="#ff5f5f" vectorEffect="non-scaling-stroke" />
            <polygon points={[B, [B[0] + rise * S, 0], [B[0] + rise * S, rise * S], C].map((p) => p.join(',')).join(' ')} fill="rgba(91,215,91,0.15)" stroke="#5bd75b" vectorEffect="non-scaling-stroke" />
            <polygon points={hypSq.map((p) => p.join(',')).join(' ')} fill="rgba(77,141,255,0.15)" stroke="#4d8dff" vectorEffect="non-scaling-stroke" />
            <polygon points={[A, B, C].map((p) => p.join(',')).join(' ')} fill="rgba(248,150,30,0.25)" stroke="#f8961e" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
            <path d={`M ${8} 0 A 8 8 0 0 1 ${8 * Math.cos(th)} ${8 * Math.sin(th)}`} fill="none" stroke="#ffd166" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <SketchText x={B[0] / 2} y={-run * S / 2}>{`run² = ${fmt(run * run, 0)}`}</SketchText>
            <SketchText x={B[0] + (rise * S) / 2} y={(rise * S) / 2}>{`rise² = ${fmt(rise * rise, 0)}`}</SketchText>
            <SketchText x={(hypSq[0][0] + hypSq[2][0]) / 2} y={(hypSq[0][1] + hypSq[2][1]) / 2}>{`hyp² = ${fmt(hyp * hyp, 0)}`}</SketchText>
            <SketchText x={B[0] / 2} y={-3} color="#ff8a8a">{`run ${run}`}</SketchText>
            <SketchText x={B[0] - 2} y={C[1] / 2} anchor="end" color="#8ae68a">{`rise ${rise}`}</SketchText>
            <SketchText x={C[0] / 2 - 4} y={C[1] / 2 + 4} anchor="end" color="#8ab4ff">{`${fmt(hyp, 1)}`}</SketchText>
            <SketchText x={14} y={3} color="#ffd166" anchor="start">{`θ ${fmt(th / DEG, 1)}°`}</SketchText>
            <Corner p={C} onDown={(e) => { e.stopPropagation(); setDrag(true); }} />
            {corr && <SketchText x={25} y={-45} color="#ffd166">{`Ramp: run 1800, length ${fmt(t1len, 1)}, angle ${fmt(t1ang, 2)}° · Stand: ${fmt(t2h, 1)} mm`}</SketchText>}
          </SketchView>
        </div>
      }
    >
      <div className="grid cols-2" style={{ gap: 6 }}>
        <NumberField label="Run (mm)" value={run} onChange={(v) => setRun(Math.max(1, v))} digits={1} />
        <NumberField label="Rise (mm)" value={rise} onChange={(v) => setRise(Math.max(1, v))} digits={1} />
      </div>
      <div className="formula">c = √({run}² + {rise}²) = {fmt(hyp, 2)}</div>
      <div className="formula">sin θ = {rise}/{fmt(hyp, 1)} = {fmt(Math.sin(th), 4)}</div>
      <div className="formula">cos θ = {run}/{fmt(hyp, 1)} = {fmt(Math.cos(th), 4)}</div>
      <div className="formula">tan θ = {rise}/{run} = {fmt(Math.tan(th), 4)} → θ = {fmt(th / DEG, 2)}°</div>
      <div className="card" style={{ padding: 10 }}>
        <b>Problem 1 — accessible ramp</b>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0' }}>
          A step is 150 mm high. Accessibility guidelines allow a maximum slope of 1 : 12. Find the minimum run, the sloped length and the angle.
        </p>
        <NumberField label="Run (mm)" value={ans.run} onChange={(v) => setAns({ ...ans, run: v })} digits={1} />
        <NumberField label="Length (mm)" value={ans.len} onChange={(v) => setAns({ ...ans, len: v })} digits={1} />
        <NumberField label="Angle (°)" value={ans.ang} onChange={(v) => setAns({ ...ans, ang: v })} digits={2} />
        <hr className="sep" />
        <b>Problem 2 — phone stand</b>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0' }}>
          The stand’s back support is 100 mm long and leans at 65° to the desk. How high is its top edge?
        </p>
        <NumberField label="Height (mm)" value={ans.h} onChange={(v) => setAns({ ...ans, h: v })} digits={1} />
        <Task ok={ans.run > 0 && ans.len > 0 && ans.ang > 0 && ans.h > 0}>All four answers entered</Task>
      </div>
    </LevelShell>
  );
}
