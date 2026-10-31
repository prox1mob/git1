import { Line } from '@react-three/drei';
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { NumberField, Seg, Slider, Task } from '../../components/ui';
import { bake, infillLines, placeOnBed, sliceAt } from '../../lib/meshAnalysis';
import { fmt } from '../../lib/math';
import { bracketGeometry, estimate } from './print';
import type { Feedback, LessonStep, Vec2, Vec3 } from '../../lib/types';

type Model = 'vase' | 'knot' | 'bracket';

function model(m: Model) {
  if (m === 'vase') {
    const pts = [
      [0, 0],
      [22, 0],
      [26, 10],
      [24, 30],
      [14, 45],
      [12, 52],
      [15, 60],
      [0, 60],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return placeOnBed(bake(new THREE.LatheGeometry(pts, 48)));
  }
  if (m === 'knot') return placeOnBed(bake(new THREE.TorusKnotGeometry(16, 5, 120, 16)));
  return placeOnBed(bake(bracketGeometry(), new THREE.Matrix4().makeRotationX(-Math.PI / 2)));
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'A slicer cuts the 3D model into horizontal layers and plans the nozzle’s path on each one: outlines (walls) first, then a lattice of infill inside.', ta: 'Slicer மாதிரியைக் கிடைமட்ட அடுக்குகளாக வெட்டி, ஒவ்வொன்றிலும் முனையின் பாதையைத் திட்டமிடுகிறது.' },
  { stage: 'TOUCH', text: 'Drag the layer slider to “print” the part up to that height. The panel shows the exact path for the current layer.', ta: 'அடுக்கு slider-ஐ இழுத்து அந்த உயரம் வரை "அச்சிடுங்கள்".' },
  { stage: 'UNDERSTAND', text: 'These contours are real: each triangle of the mesh is intersected with the layer plane. Number of layers = height ÷ layer height. Curved and sloped surfaces become small stair-steps.', ta: 'அடுக்குகளின் எண்ணிக்கை = உயரம் ÷ அடுக்கு உயரம்.' },
  { stage: 'BUILD', text: 'Prepare the vase: layer height ≤ 0.2 mm, infill between 10 % and 30 %, within the time budget — and work out how many layers it will have.', ta: 'Vase-ஐத் தயார் செய்யுங்கள்: ≤ 0.2 mm, 10–30 % infill, நேர வரம்புக்குள்.' },
];

export default function L5Slicing() {
  const [m, setM] = useState<Model>('vase');
  const [layer, setLayer] = useState(0.3);
  const [infill, setInfill] = useState(20);
  const [frac, setFrac] = useState(0.5);
  const [guess, setGuess] = useState(0);
  const g = useMemo(() => model(m), [m]);
  g.computeBoundingBox();
  const H = g.boundingBox!.max.y;
  const layers = Math.ceil(H / layer);
  const cur = Math.max(1, Math.round(frac * layers));
  const h = (cur - 0.5) * layer;
  const loops = useMemo(() => sliceAt(g, h), [g, h]);
  const spacing = infill > 0 ? 0.45 / (infill / 100) : 0;
  const inf = useMemo(() => infillLines(loops, spacing, cur % 2 ? 45 : -45), [loops, spacing, cur]);
  const stack = useMemo(() => {
    const out: Vec3[][] = [];
    const step = Math.max(1, Math.ceil(cur / 70));
    for (let i = 1; i <= cur; i += step) {
      const y = (i - 0.5) * layer;
      for (const l of sliceAt(g, y)) out.push([...l, l[0]].map(([x, z]) => [x, y, z] as Vec3));
    }
    return out;
  }, [g, cur, layer]);
  const est = useMemo(() => estimate(g, layer, infill), [g, layer, infill]);
  const vase = useMemo(() => model('vase'), []);
  const budget = useMemo(() => estimate(vase, 0.2, 15).minutes * 1.1, [vase]);
  const vaseH = useMemo(() => {
    vase.computeBoundingBox();
    return vase.boundingBox!.max.y;
  }, [vase]);

  const pts = loops.flat();
  const xs = pts.map((p) => p[0]),
    zs = pts.map((p) => p[1]);
  const pad = 4;
  const vb = pts.length ? [Math.min(...xs) - pad, Math.min(...zs) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...zs) - Math.min(...zs) + 2 * pad] : [-10, -10, 20, 20];
  const toPath = (l: Vec2[]) => l.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ') + 'Z';

  const evaluate = (): Feedback => {
    const isVase = m === 'vase';
    const e = estimate(vase, layer, infill);
    const correctLayers = Math.ceil(vaseH / layer);
    const checks: [boolean, string, string][] = [
      [isVase, 'Vase selected', 'Select the vase model for the challenge.'],
      [layer <= 0.2 + 1e-9, `Layer height ${layer} mm`, `Layer height ${layer} mm is coarser than 0.2 mm.`],
      [infill >= 10 && infill <= 30, `Infill ${infill} %`, `Infill ${infill} % is outside 10–30 %.`],
      [e.minutes <= budget, `About ${fmt(e.minutes, 0)} min — within the ${fmt(budget, 0)} min budget`, `About ${fmt(e.minutes, 0)} min — over the ${fmt(budget, 0)} min budget.`],
      [Math.abs(guess - correctLayers) <= 1, `${correctLayers} layers — correct`, `You wrote ${guess} layers; ${fmt(vaseH, 1)} mm ÷ ${layer} mm = ${correctLayers}.`],
    ];
    return {
      score: Math.round((checks.filter((c) => c[0]).length / checks.length) * 100),
      correct: checks.filter((c) => c[0]).map((c) => c[1]),
      issues: checks.filter((c) => !c[0]).map((c) => ({ label: c[2] })),
      why: 'Slicing settings decide print time, strength, weight and finish as much as the CAD model does. Knowing what the slicer does lets you design parts that print well — and predict cost.',
      suggestion: 'Infill rarely needs to exceed 20–30 % for prototypes; strength comes mostly from walls.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w7-l5"
      steps={steps}
      evaluate={evaluate}
      hints={[{ en: 'The vase is 60 mm tall: at 0.2 mm that is 300 layers.', ta: 'Vase 60 mm உயரம்: 0.2 mm-இல் 300 அடுக்குகள்.' }]}
      viewport={
        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', display: 'flex', minHeight: 260 }}>
            <Stage3D fit={60} camera={[70, 70, 100]} target={[0, H / 2, 0]} env showViews={false}>
              <mesh geometry={g}>
                <meshStandardMaterial color="#8d9aa8" transparent opacity={0.15} depthWrite={false} />
              </mesh>
              {stack.map((l, i) => (
                <Line key={i} points={l} color="#f8961e" lineWidth={1} />
              ))}
              {loops.map((l, i) => (
                <Line key={`c${i}`} points={[...l, l[0]].map(([x, z]) => [x, h, z] as Vec3)} color="#ffffff" lineWidth={2.5} />
              ))}
              <mesh position={[0, -0.5, 0]}>
                <boxGeometry args={[120, 1, 120]} />
                <meshStandardMaterial color="#2a3644" />
              </mesh>
            </Stage3D>
          </div>
          <div style={{ flex: '1 1 240px', display: 'flex', minHeight: 240, background: '#0e141b', padding: 8 }}>
            <svg viewBox={vb.join(' ')} style={{ width: '100%', height: '100%' }}>
              {loops.map((l, i) => (
                <path key={i} d={toPath(l)} fill="none" stroke="#f8961e" strokeWidth={0.45} />
              ))}
              {loops.map((l, i) => (
                <path key={`w${i}`} d={toPath(l)} fill="none" stroke="#ffd166" strokeWidth={0.2} strokeDasharray="0.6 0.4" />
              ))}
              {inf.map(([a, b], i) => (
                <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#4cc9f0" strokeWidth={0.3} />
              ))}
            </svg>
          </div>
        </div>
      }
    >
      <Seg value={m} onChange={setM} options={[{ v: 'vase', label: 'Vase' }, { v: 'knot', label: 'Knot' }, { v: 'bracket', label: 'Bracket' }]} />
      <Slider label={`Layer ${cur} of ${layers} (z = ${fmt(h, 2)} mm)`} value={frac} min={0.001} max={1} step={0.001} onChange={setFrac} digits={2} />
      <Slider label="Layer height" value={layer} min={0.08} max={0.4} step={0.04} unit="mm" onChange={setLayer} digits={2} />
      <Slider label="Infill" value={infill} min={0} max={100} step={5} unit="%" onChange={setInfill} />
      <div className="kv">
        <span>Height</span>
        <span>{fmt(H, 1)} mm</span>
        <span>Loops in this layer</span>
        <span>{loops.length}</span>
        <span>Infill lines</span>
        <span>{inf.length}</span>
        <span>Estimated time</span>
        <span>{fmt(est.minutes, 0)} min</span>
        <span>Filament</span>
        <span>{fmt(est.filament, 1)} g</span>
        <span>Vase time budget</span>
        <span>{fmt(budget, 0)} min</span>
      </div>
      <NumberField label="Vase layers at your layer height" value={guess} digits={0} onChange={(v) => setGuess(Math.round(v))} />
      <Task ok={m === 'vase' && layer <= 0.2 + 1e-9 && infill >= 10 && infill <= 30}>Vase settings in range</Task>
      <div className="note">Simplified slicer: one outline per loop (no inward offset walls), straight infill, no seam, retraction or cooling. Real slicers (Cura, PrusaSlicer, Bambu Studio) do much more.</div>
    </LevelShell>
  );
}
