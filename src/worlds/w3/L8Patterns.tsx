import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Seg, Slider, Task, Toggle } from '../../components/ui';
import { csgRaw, meshVolumeArea } from '../../lib/shapes';
import { fmt } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

interface Flange {
  D: number;
  t: number;
  bore: number;
  n: number;
  pcd: number;
  hole: number;
  start: number;
}
interface Plate {
  n: number;
  spacing: number;
  hole: number;
  rowY: number;
  mirror: boolean;
}
const F0: Flange = { D: 70, t: 8, bore: 20, n: 4, pcd: 50, hole: 6, start: 0 };
const P0: Plate = { n: 3, spacing: 20, hole: 5, rowY: 10, mirror: false };

function cyl(r: number, h: number, x: number, z: number, seg = 32) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  g.translate(x, h / 2 - 0.0, z);
  return g;
}

export function flangeGeometry(f: Flange) {
  const base = cyl(f.D / 2, f.t, 0, 0, 64);
  const tools: THREE.BufferGeometry[] = [];
  if (f.bore > 0) {
    const g = cyl(f.bore / 2, f.t + 4, 0, 0, 40);
    g.translate(0, -2, 0);
    tools.push(g);
  }
  for (let i = 0; i < f.n; i++) {
    const a = ((f.start + (360 / f.n) * i) * Math.PI) / 180;
    const g = cyl(f.hole / 2, f.t + 4, (f.pcd / 2) * Math.cos(a), (f.pcd / 2) * Math.sin(a), 24);
    g.translate(0, -2, 0);
    tools.push(g);
  }
  return csgRaw(base, tools, 'subtract');
}
function plateGeometry(p: Plate) {
  const base = new THREE.BoxGeometry(100, 3, 60);
  base.translate(0, 1.5, 0);
  const tools: THREE.BufferGeometry[] = [];
  const rows = p.mirror ? [p.rowY, -p.rowY] : [p.rowY];
  for (const zr of rows)
    for (let i = 0; i < p.n; i++) {
      const x = (i - (p.n - 1) / 2) * p.spacing;
      const g = cyl(p.hole / 2, 7, x, -zr, 20);
      g.translate(0, -2, 0);
      tools.push(g);
    }
  return csgRaw(base, tools, 'subtract');
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Repeated features are rarely modelled one by one. A circular pattern copies a hole around an axis; a linear pattern copies it along a direction; mirroring copies features across a plane of symmetry.', ta: 'மீண்டும் வரும் அம்சங்களை ஒவ்வொன்றாக மாடல் செய்வதில்லை: circular pattern, linear pattern, mirror.' },
  { stage: 'EXPERIMENT', text: 'Change the count, the bolt-circle diameter (PCD) and the hole size. The holes are real Boolean cuts — watch the volume drop.', ta: 'எண்ணிக்கை, PCD, துளை அளவுகளை மாற்றிப் பாருங்கள்.' },
  { stage: 'UNDERSTAND', text: 'Patterns keep spacing exact and editable: change “6” to “8” and every hole moves to stay evenly spaced (360° ÷ N). Mirroring guarantees symmetry.', ta: 'Pattern இடைவெளியைத் துல்லியமாக வைத்திருக்கும்: 360° ÷ N.' },
  { stage: 'BUILD', text: 'Task 1: flange Ø80 × 8 mm with a Ø30 bore and 6 × Ø8 holes on a Ø60 PCD. Task 2: vent plate with 5 × Ø6 holes, 15 mm apart, in a row 15 mm from the centre, mirrored to the other side.', ta: 'பணி 1: Ø80 flange, Ø30 துளை, Ø60 PCD-இல் 6 × Ø8. பணி 2: 5 × Ø6 துளைகள், 15 mm இடைவெளி, mirror.' },
];

export default function L8Patterns() {
  const [mode, setMode] = useState<'flange' | 'plate'>('flange');
  const [f, setF] = useState<Flange>(F0);
  const [p, setP] = useState<Plate>(P0);
  const [locked, setLocked] = useState<{ f?: Flange; p?: Plate }>({});
  const geo = useMemo(() => (mode === 'flange' ? flangeGeometry(f) : plateGeometry(p)), [mode, f, p]);
  const vol = useMemo(() => meshVolumeArea(geo).volume, [geo]);
  const holeOverlap = mode === 'flange' ? (Math.PI * f.pcd) / f.n <= f.hole + 1 : p.spacing <= p.hole + 1;
  const edgeClash = mode === 'flange' ? f.pcd / 2 + f.hole / 2 >= f.D / 2 - 1 || f.pcd / 2 - f.hole / 2 <= f.bore / 2 + 1 : (p.n - 1) * p.spacing / 2 + p.hole / 2 >= 49 || p.rowY + p.hole / 2 >= 29;

  const fErr = (x?: Flange) => {
    if (!x) return ['not locked in'];
    const e: string[] = [];
    if (x.D !== 80 || x.t !== 8) e.push(`disc is Ø${x.D} × ${x.t}, needs Ø80 × 8`);
    if (x.bore !== 30) e.push(`bore is Ø${x.bore}, needs Ø30`);
    if (x.n !== 6) e.push(`${x.n} holes, needs 6`);
    if (x.pcd !== 60) e.push(`PCD is Ø${x.pcd}, needs Ø60`);
    if (x.hole !== 8) e.push(`holes are Ø${x.hole}, need Ø8`);
    return e;
  };
  const pErr = (x?: Plate) => {
    if (!x) return ['not locked in'];
    const e: string[] = [];
    if (x.n !== 5) e.push(`${x.n} holes per row, needs 5`);
    if (x.spacing !== 15) e.push(`spacing ${x.spacing} mm, needs 15`);
    if (x.hole !== 6) e.push(`holes Ø${x.hole}, need Ø6`);
    if (x.rowY !== 15) e.push(`row is ${x.rowY} mm from centre, needs 15`);
    if (!x.mirror) e.push('the row must be mirrored');
    return e;
  };

  const evaluate = (): Feedback => {
    const fe = fErr(locked.f),
      pe = pErr(locked.p);
    const sc = (e: string[]) => (e.length === 0 ? 1 : Math.max(0, 1 - e.length * 0.25));
    return {
      score: Math.round(((sc(fe) + sc(pe)) / 2) * 100),
      correct: [fe.length ? '' : 'Flange: 6 × Ø8 holes on a Ø60 PCD with a Ø30 bore.', pe.length ? '' : 'Vent plate: mirrored linear pattern of 5 × Ø6 holes at 15 mm pitch.'].filter(Boolean),
      issues: [...(fe.length ? [{ label: `Flange: ${fe[0]}.`, detail: fe.slice(1).join('; ') || undefined }] : []), ...(pe.length ? [{ label: `Vent plate: ${pe[0]}.`, detail: pe.slice(1).join('; ') || undefined }] : [])],
      why: 'Bolt circles, vent grilles, speaker holes and gear teeth are patterns. Modelling them as patterns keeps them evenly spaced, makes them easy to change, and communicates the intent (PCD, pitch) to manufacturing.',
      suggestion: 'Lock in each task while its tab is active — the flange and the plate are stored separately.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w3-l8"
      steps={steps}
      evaluate={evaluate}
      hints={[{ en: 'Angle between holes = 360° ÷ 6 = 60°. Hole spacing along the bolt circle = π × 60 ÷ 6 ≈ 31 mm — plenty of room for Ø8 holes.', ta: 'துளைகளுக்கிடையே கோணம் = 360° ÷ 6 = 60°.' }]}
      viewport={
        <Stage3D fit={90} camera={[70, 90, 110]} env>
          <mesh geometry={geo} castShadow>
            <meshStandardMaterial color={mode === 'flange' ? '#b7bcc4' : '#e9edf2'} metalness={0.8} roughness={0.3} />
          </mesh>
        </Stage3D>
      }
    >
      <Seg value={mode} onChange={setMode} options={[{ v: 'flange', label: 'Task 1 · Circular pattern' }, { v: 'plate', label: 'Task 2 · Linear + mirror' }]} />
      {mode === 'flange' ? (
        <>
          <Slider label="Disc diameter" value={f.D} min={40} max={120} step={1} unit="mm" onChange={(D) => setF({ ...f, D })} />
          <Slider label="Thickness" value={f.t} min={2} max={20} step={1} unit="mm" onChange={(t) => setF({ ...f, t })} />
          <Slider label="Centre bore Ø" value={f.bore} min={0} max={60} step={1} unit="mm" onChange={(bore) => setF({ ...f, bore })} />
          <Slider label="Number of holes" value={f.n} min={2} max={16} step={1} onChange={(n) => setF({ ...f, n })} />
          <Slider label="Bolt circle Ø (PCD)" value={f.pcd} min={20} max={110} step={1} unit="mm" onChange={(pcd) => setF({ ...f, pcd })} />
          <Slider label="Hole Ø" value={f.hole} min={2} max={20} step={1} unit="mm" onChange={(hole) => setF({ ...f, hole })} />
          <Slider label="Start angle" value={f.start} min={0} max={90} step={5} unit="°" onChange={(start) => setF({ ...f, start })} />
          <div className="formula">Angle between holes = 360° ÷ {f.n} = {fmt(360 / f.n, 1)}°</div>
          <button className="btn small accent" onClick={() => setLocked({ ...locked, f: { ...f } })}>
            Lock in flange
          </button>
        </>
      ) : (
        <>
          <Slider label="Holes per row" value={p.n} min={1} max={9} step={1} onChange={(n) => setP({ ...p, n })} />
          <Slider label="Spacing (pitch)" value={p.spacing} min={6} max={25} step={1} unit="mm" onChange={(spacing) => setP({ ...p, spacing })} />
          <Slider label="Hole Ø" value={p.hole} min={2} max={12} step={1} unit="mm" onChange={(hole) => setP({ ...p, hole })} />
          <Slider label="Row distance from centre" value={p.rowY} min={0} max={25} step={1} unit="mm" onChange={(rowY) => setP({ ...p, rowY })} />
          <Toggle checked={p.mirror} onChange={(mirror) => setP({ ...p, mirror })} label="Mirror across the centre plane" />
          <button className="btn small accent" onClick={() => setLocked({ ...locked, p: { ...p } })}>
            Lock in vent plate
          </button>
        </>
      )}
      {holeOverlap && <div className="note warn">⚠ Holes overlap or nearly touch — the pattern would fail or leave fragile webs.</div>}
      {edgeClash && <div className="note warn">⚠ A hole breaks through an edge or the bore — leave at least 1 mm of material.</div>}
      <div className="formula">Volume: {fmt(vol / 1000, 2)} cm³</div>
      <Task ok={fErr(locked.f).length === 0}>Flange {locked.f ? 'locked' : 'not locked'}</Task>
      <Task ok={pErr(locked.p).length === 0}>Vent plate {locked.p ? 'locked' : 'not locked'}</Task>
    </LevelShell>
  );
}
