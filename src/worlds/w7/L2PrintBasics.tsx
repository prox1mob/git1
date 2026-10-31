import { Line } from '@react-three/drei';
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { Slider, Task, Toggle } from '../../components/ui';
import { overhangs, sliceAt } from '../../lib/meshAnalysis';
import { fmt } from '../../lib/math';
import { bracketGeometry, estimate, oriented, ORIENTATIONS } from './print';
import type { Feedback, LessonStep, Vec3 } from '../../lib/types';

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'An FDM printer squeezes melted plastic in thin layers from the bed upwards. Each layer must sit on something below it.', ta: 'FDM அச்சுப்பொறி உருகிய பிளாஸ்டிக்கை அடுக்கடுக்காகப் போடுகிறது. ஒவ்வொரு அடுக்கும் கீழே ஏதாவது ஒன்றின் மேல் இருக்க வேண்டும்.' },
  { stage: 'EXPERIMENT', text: 'Red faces are overhangs steeper than 45° — they need support material, which wastes time and leaves rough surfaces. Try every orientation.', ta: 'சிவப்பு முகங்கள் 45°-க்கு மேல் தொங்குபவை — அவற்றுக்கு support தேவை.' },
  { stage: 'UNDERSTAND', text: 'Layer height trades quality for time: thinner layers = smoother curves but more layers. Infill (the inside lattice) and wall count set strength and weight. Orientation also decides strength: layers bond weaker than the plastic itself.', ta: 'மெல்லிய அடுக்குகள் = மென்மையான மேற்பரப்பு, ஆனால் அதிக நேரம்.' },
  { stage: 'BUILD', text: 'Prepare the bracket: choose the orientation with the least support, a layer height of 0.2 mm or finer, and finish within the time budget.', ta: 'Bracket-ஐத் தயார் செய்யுங்கள்: குறைந்த support, ≤ 0.2 mm அடுக்கு, நேர வரம்புக்குள்.' },
];

export default function L2PrintBasics() {
  const base = useMemo(() => bracketGeometry(), []);
  const [o, setO] = useState(0);
  const [layer, setLayer] = useState(0.3);
  const [infill, setInfill] = useState(20);
  const [lines, setLines] = useState(true);
  const all = useMemo(() => ORIENTATIONS.map((x) => oriented(base, x.euler)), [base]);
  const g = all[o];
  const ov = useMemo(() => overhangs(g), [g]);
  const colored = useMemo(() => {
    const c = g.clone();
    c.setAttribute('color', new THREE.BufferAttribute(ov.colors, 3));
    return c;
  }, [g, ov]);
  const est = useMemo(() => estimate(g, layer, infill), [g, layer, infill]);
  const supports = useMemo(() => all.map((x) => overhangs(x).supportVolume), [all]);
  const best = supports.indexOf(Math.min(...supports));
  const budget = useMemo(() => estimate(all[best], 0.2, 20).minutes * 1.2, [all, best]);
  const contour = useMemo(() => {
    if (!lines) return [] as Vec3[][];
    const out: Vec3[][] = [];
    const step = Math.max(layer, est.height / 60);
    for (let h = layer / 2; h < est.height; h += step) for (const l of sliceAt(g, h)) out.push([...l, l[0]].map(([x, z]) => [x, h, z] as Vec3));
    return out;
  }, [g, layer, lines, est.height]);

  const evaluate = (): Feedback => {
    const ratio = (supports[best] + 1) / (supports[o] + 1);
    const orientScore = Math.round(60 * Math.min(1, ratio));
    const lOk = layer <= 0.2 + 1e-9;
    const tOk = est.minutes <= budget;
    return {
      score: orientScore + (lOk ? 20 : 0) + (tOk ? 20 : 0),
      correct: [o === best ? `“${ORIENTATIONS[o].name}” needs the least support (${fmt(supports[o] / 1000, 2)} cm³).` : '', lOk ? `Layer height ${layer} mm gives a fine finish.` : '', tOk ? `Prints in about ${fmt(est.minutes, 0)} min (budget ${fmt(budget, 0)} min).` : ''].filter(Boolean),
      issues: [
        ...(o === best ? [] : [{ label: `“${ORIENTATIONS[o].name}” needs ${fmt(supports[o] / 1000, 2)} cm³ of support.`, detail: `“${ORIENTATIONS[best].name}” needs only ${fmt(supports[best] / 1000, 2)} cm³.` }]),
        ...(lOk ? [] : [{ label: `Layer height ${layer} mm is too coarse for this part.` }]),
        ...(tOk ? [] : [{ label: `About ${fmt(est.minutes, 0)} min — over the ${fmt(budget, 0)} min budget.`, detail: 'Reduce infill, or use a thicker layer within the quality limit.' }]),
      ],
      why: 'Orientation is the cheapest decision in 3D printing: it changes support waste, surface quality, print time and even the direction in which the part is weakest. Experienced designers decide it before modelling details.',
      suggestion: 'Look for the orientation where the big flat face sits on the bed and nothing hangs in the air.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w7-l2"
      steps={steps}
      evaluate={evaluate}
      hints={[{ en: 'The T’s crossbar overhangs when the part stands upright. Lay it flat on its back so the whole profile touches the bed.', ta: 'நிமிர்ந்து நிற்கும்போது T-இன் குறுக்குக் கம்பி தொங்குகிறது. அதைப் படுக்க வையுங்கள்.' }]}
      viewport={
        <Stage3D fit={80} camera={[90, 80, 120]} target={[0, 15, 0]} env showViews>
          <mesh geometry={colored} castShadow>
            <meshStandardMaterial vertexColors roughness={0.55} />
          </mesh>
          {contour.map((l, i) => (
            <Line key={i} points={l} color="#0b0f14" lineWidth={0.8} transparent opacity={0.5} />
          ))}
          <mesh position={[0, -0.5, 0]} receiveShadow>
            <boxGeometry args={[140, 1, 140]} />
            <meshStandardMaterial color="#2a3644" />
          </mesh>
          <Label position={[0, est.height + 12, 0]} color="#ff8a80">{`overhang ${fmt(ov.overhangArea / 100, 1)} cm²`}</Label>
        </Stage3D>
      }
    >
      <div className="lbl">Orientation on the bed</div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {ORIENTATIONS.map((x, i) => (
          <button key={i} className={`btn small ${o === i ? 'on' : ''}`} onClick={() => setO(i)}>
            {x.name}
          </button>
        ))}
      </div>
      <Slider label="Layer height" value={layer} min={0.08} max={0.4} step={0.04} unit="mm" onChange={setLayer} digits={2} />
      <Slider label="Infill" value={infill} min={0} max={100} step={5} unit="%" onChange={setInfill} />
      <Toggle checked={lines} onChange={setLines} label="Show layer lines" />
      <div className="kv">
        <span>Height</span>
        <span>{fmt(est.height, 1)} mm</span>
        <span>Layers</span>
        <span>{est.layers}</span>
        <span>Support volume</span>
        <span>{fmt(est.supportVolume / 1000, 2)} cm³</span>
        <span>Estimated time</span>
        <span>{fmt(est.minutes, 0)} min</span>
        <span>Filament</span>
        <span>{fmt(est.filament, 1)} g</span>
        <span>Time budget</span>
        <span>{fmt(budget, 0)} min</span>
      </div>
      <Task ok={o === best}>Least-support orientation</Task>
      <Task ok={layer <= 0.2 + 1e-9}>Layer height ≤ 0.2 mm</Task>
      <Task ok={est.minutes <= budget}>Within the time budget</Task>
      <div className="note warn">Estimates use a simplified motion model (no acceleration, fixed speeds). Real slicers and machines differ — always check with your printer’s slicer.</div>
    </LevelShell>
  );
}
