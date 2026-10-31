import { useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { DimensionLines } from '../../components/three/ObjectMesh';
import { Seg, Slider } from '../../components/ui';
import { fmt, relTol, scoreFromError } from '../../lib/math';
import { useSettings } from '../../store/progress';
import type { Feedback, LessonStep } from '../../lib/types';

type Shape = 'box' | 'cylinder' | 'sphere' | 'cone';
const TARGET_ML = 330;

const steps: LessonStep[] = [
  { stage: 'EXPERIMENT', text: 'Pick a shape and drag its sliders. The formulas update with your numbers substituted in.', ta: 'ஒரு வடிவத்தைத் தேர்ந்தெடுத்து slider-களை இழுங்கள். சூத்திரங்கள் உங்கள் எண்களுடன் மாறும்.' },
  { stage: 'UNDERSTAND', text: 'Volume grows with the cube of size, area with the square. Double every dimension: area × 4, volume × 8. 1 cm³ = 1000 mm³ = 1 mL.', ta: 'கனஅளவு அளவின் மூன்றாம் அடுக்கில், பரப்பளவு இரண்டாம் அடுக்கில் வளரும். 1 cm³ = 1 mL.' },
  { stage: 'BUILD', text: 'Challenge: design a drinks can (cylinder) that holds 330 mL using as little sheet metal (surface area) as possible.', ta: 'சவால்: 330 mL கொள்ளும், மிகக் குறைந்த உலோகப் பரப்பில் ஒரு கேன் வடிவமையுங்கள்.' },
  { stage: 'IMPROVE', text: 'Watch the curve: for a fixed volume, area changes with the radius. Find the bottom of the curve.', ta: 'வளைவைக் கவனியுங்கள்: நிலையான கனஅளவுக்கு, ஆரத்துடன் பரப்பளவு மாறுகிறது.' },
];

function calc(shape: Shape, a: number, b: number, c: number) {
  switch (shape) {
    case 'box':
      return { V: a * b * c, A: 2 * (a * b + a * c + b * c), vf: `V = w·h·d = ${fmt(a)}·${fmt(b)}·${fmt(c)}`, af: `A = 2(wh + wd + hd)` };
    case 'cylinder':
      return { V: Math.PI * a * a * b, A: 2 * Math.PI * a * a + 2 * Math.PI * a * b, vf: `V = πr²h = π·${fmt(a)}²·${fmt(b)}`, af: `A = 2πr² + 2πrh` };
    case 'sphere':
      return { V: (4 / 3) * Math.PI * a ** 3, A: 4 * Math.PI * a * a, vf: `V = 4/3·πr³ = 4/3·π·${fmt(a)}³`, af: `A = 4πr² = 4π·${fmt(a)}²` };
    default: {
      const s = Math.hypot(a, b);
      return { V: (Math.PI * a * a * b) / 3, A: Math.PI * a * a + Math.PI * a * s, vf: `V = πr²h/3 = π·${fmt(a)}²·${fmt(b)}/3`, af: `A = πr² + πr·s, s = √(r²+h²) = ${fmt(s)}` };
    }
  }
}

function AreaCurve({ r, h }: { r: number; h: number }) {
  const V = TARGET_ML * 1000;
  const W = 300,
    H = 140;
  const rs = Array.from({ length: 60 }, (_, i) => 15 + i * 1.2);
  const A = (rr: number) => 2 * Math.PI * rr * rr + (2 * V) / rr;
  const as = rs.map(A);
  const mn = Math.min(...as),
    mx = Math.max(...as);
  const X = (rr: number) => ((rr - 15) / (rs[rs.length - 1] - 15)) * (W - 30) + 25;
  const Y = (a: number) => H - 20 - ((a - mn) / (mx - mn)) * (H - 35);
  const userA = 2 * Math.PI * r * r + 2 * Math.PI * r * h;
  const ropt = Math.cbrt(V / (2 * Math.PI));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ background: 'var(--bg2)', borderRadius: 8 }}>
      <polyline points={rs.map((rr, i) => `${X(rr)},${Y(as[i])}`).join(' ')} fill="none" stroke="#4cc9f0" strokeWidth={2} />
      <line x1={X(ropt)} x2={X(ropt)} y1={10} y2={H - 20} stroke="#3fb950" strokeDasharray="3 3" />
      {r >= 15 && r <= rs[rs.length - 1] && <circle cx={X(r)} cy={Math.max(5, Math.min(H - 20, Y(userA)))} r={5} fill="#f8961e" />}
      <text x={25} y={H - 5} fill="#8d9aa8" fontSize={10}>
        radius 15 mm
      </text>
      <text x={W - 70} y={H - 5} fill="#8d9aa8" fontSize={10}>
        86 mm
      </text>
      <text x={X(ropt) + 4} y={18} fill="#3fb950" fontSize={10}>
        minimum area
      </text>
      <text x={4} y={12} fill="#8d9aa8" fontSize={10}>
        area for 330 mL
      </text>
    </svg>
  );
}

export default function L4AreaVolume() {
  const { difficulty } = useSettings();
  const tol = relTol(difficulty);
  const [shape, setShape] = useState<Shape>('cylinder');
  const [a, setA] = useState(30);
  const [b, setB] = useState(60);
  const [c, setC] = useState(40);
  const [corr, setCorr] = useState(false);
  const { V, A, vf, af } = calc(shape, a, b, c);
  const h = shape === 'box' ? b : shape === 'sphere' ? 2 * a : b;
  const w = shape === 'box' ? a : 2 * a;
  const d = shape === 'box' ? c : 2 * a;
  const box = new THREE.Box3(new THREE.Vector3(-w / 2, 0, -d / 2), new THREE.Vector3(w / 2, h, d / 2));
  const ropt = Math.cbrt((TARGET_ML * 1000) / (2 * Math.PI));

  const evaluate = (): Feedback | string => {
    if (shape !== 'cylinder') return 'The can challenge uses the cylinder — select “Cylinder”.';
    const vml = V / 1000;
    const vErr = Math.abs(vml - TARGET_ML) / TARGET_ML;
    const Aopt = 6 * Math.PI * ropt * ropt;
    const eff = Aopt / A;
    const vScore = scoreFromError(vErr, tol);
    const aScore = scoreFromError(Math.max(0, 1 - eff), tol / 2);
    const score = Math.round(0.5 * vScore + 0.5 * aScore * (vErr <= tol * 2 ? 1 : 0.3));
    const correct: string[] = [];
    const issues: Feedback['issues'] = [];
    if (vErr <= tol) correct.push(`Holds ${fmt(vml, 1)} mL — within tolerance of 330 mL.`);
    else issues.push({ label: `Holds ${fmt(vml, 1)} mL, target 330 mL.`, detail: `V = πr²h. With r = ${fmt(a)} mm you need h = ${fmt((TARGET_ML * 1000) / (Math.PI * a * a))} mm.` });
    if (eff >= 1 - tol / 2) correct.push(`Surface area ${fmt(A / 100, 1)} cm² is within ${fmt((1 / eff - 1) * 100, 1)}% of the theoretical minimum.`);
    else issues.push({ label: `Uses ${fmt((1 / eff - 1) * 100, 0)}% more metal than necessary.`, detail: `Minimum is ${fmt(Aopt / 100, 1)} cm² at r ≈ ${fmt(ropt, 1)} mm, h ≈ ${fmt(2 * ropt, 1)} mm.` });
    return {
      score,
      correct,
      issues,
      why: 'Material is cost, weight and carbon. For a cylinder of fixed volume, area is smallest when the height equals the diameter. Real cans are taller and thinner because of grip, stacking, pressure and the extra thickness of the ends — maths sets the baseline, other requirements shape the final design.',
      suggestion: vErr > tol ? 'First lock the volume: pick a radius, then compute h = V / (πr²) and set it exactly.' : 'Move the radius towards the green line on the curve, re-adjusting height to keep 330 mL.',
      canShowCorrection: true,
    };
  };

  const dims =
    shape === 'box'
      ? [
          ['Width w', a, setA],
          ['Height h', b, setB],
          ['Depth d', c, setC],
        ]
      : shape === 'sphere'
        ? [['Radius r', a, setA]]
        : [
            ['Radius r', a, setA],
            ['Height h', b, setB],
          ];

  return (
    <LevelShell
      id="w2-l4"
      steps={steps}
      evaluate={evaluate}
      onCorrection={setCorr}
      hints={[{ en: 'For minimum area, h = 2r. Then 330 000 = πr²·2r, so r = ∛(330 000 / 2π) ≈ 37.4 mm.', ta: 'குறைந்த பரப்புக்கு h = 2r.' }]}
      viewport={
        <Stage3D fit={110} camera={[110, 100, 160]} target={[0, 30, 0]} axes={false}>
          <mesh position={[0, h / 2, 0]} castShadow>
            {shape === 'box' && <boxGeometry args={[a, b, c]} />}
            {shape === 'cylinder' && <cylinderGeometry args={[a, a, b, 48]} />}
            {shape === 'sphere' && <sphereGeometry args={[a, 48, 24]} />}
            {shape === 'cone' && <coneGeometry args={[a, b, 48]} />}
            <meshStandardMaterial color={shape === 'cylinder' ? '#c9ced6' : '#4cc9f0'} metalness={shape === 'cylinder' ? 0.8 : 0} roughness={0.3} />
          </mesh>
          <DimensionLines box={box} />
          {corr && shape === 'cylinder' && (
            <mesh position={[110, ropt, 0]}>
              <cylinderGeometry args={[ropt, ropt, 2 * ropt, 48]} />
              <meshStandardMaterial color="#3fb950" transparent opacity={0.5} />
            </mesh>
          )}
        </Stage3D>
      }
    >
      <Seg value={shape} onChange={setShape} options={[{ v: 'box', label: 'Box' }, { v: 'cylinder', label: 'Cylinder' }, { v: 'sphere', label: 'Sphere' }, { v: 'cone', label: 'Cone' }]} />
      {dims.map(([l, v, set]) => (
        <Slider key={l as string} label={l as string} value={v as number} min={5} max={120} step={0.5} unit="mm" onChange={set as (n: number) => void} />
      ))}
      <div className="formula">{vf}</div>
      <div className="formula">
        V = {fmt(V, 0)} mm³ = <b>{fmt(V / 1000, 1)} cm³ (mL)</b>
      </div>
      <div className="formula">{af}</div>
      <div className="formula">
        A = {fmt(A, 0)} mm² = <b>{fmt(A / 100, 1)} cm²</b>
      </div>
      <div className="kv">
        <span>Area ÷ volume</span>
        <span>{fmt(A / V, 3)} per mm</span>
      </div>
      {shape === 'cylinder' && (
        <>
          <div className="lbl">Can challenge — area needed for 330 mL at each radius</div>
          <AreaCurve r={a} h={b} />
        </>
      )}
    </LevelShell>
  );
}
