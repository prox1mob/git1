import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { Seg, Slider } from '../../components/ui';
import { rectPoly, treatCorners } from '../../lib/poly';
import { fmt } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

type Base = 'round' | 'box' | 'hex' | 'tri';
interface V {
  base: Base;
  H: number;
  W: number;
  taper: number;
  radius: number;
  color: string;
}
const START: V[] = [
  { base: 'round', H: 120, W: 80, taper: 1, radius: 0, color: '#4cc9f0' },
  { base: 'round', H: 120, W: 80, taper: 1, radius: 0, color: '#f8961e' },
  { base: 'round', H: 120, W: 80, taper: 1, radius: 0, color: '#90be6d' },
];

function bodyGeo(v: V) {
  let g: THREE.BufferGeometry;
  if (v.base === 'box') {
    const o = treatCorners(rectPoly(-v.W / 2, -v.W / 2, v.W / 2, v.W / 2), Math.max(0.01, v.radius), 'fillet', 8);
    g = new THREE.ExtrudeGeometry(new THREE.Shape(o.map(([x, y]) => new THREE.Vector2(x, y))), { depth: v.H, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
  } else {
    g = new THREE.CylinderGeometry(v.W / 2, v.W / 2, v.H, v.base === 'round' ? 64 : v.base === 'hex' ? 6 : 3, 8);
    g.translate(0, v.H / 2, 0);
  }
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 1 + (v.taper - 1) * (p.getY(i) / v.H);
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

function Variant({ v, x, label }: { v: V; x: number; label: string }) {
  const g = useMemo(() => bodyGeo(v), [v]);
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={g} castShadow>
        <meshPhysicalMaterial color={v.color} roughness={0.5} sheen={0.6} />
      </mesh>
      <mesh position={[0, v.H * 0.45, (v.W / 2) * (1 + (v.taper - 1) * 0.45) + 0.6]}>
        <circleGeometry args={[Math.min(v.W, v.H) * 0.22, 40]} />
        <meshStandardMaterial color="#1e2126" roughness={0.9} />
      </mesh>
      <Label position={[0, -14, 0]}>{label}</Label>
    </group>
  );
}

const diff = (a: V, b: V) => (a.base !== b.base ? 1 : 0) + Math.abs(a.H / a.W - b.H / b.W) + Math.abs(a.taper - b.taper) + Math.abs(a.radius - b.radius) / 20;

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Brief: a small Bluetooth speaker for a bedside table. Designers never stop at the first idea — they explore many forms quickly with simple shapes.', ta: 'சுருக்கம்: படுக்கை மேசைக்கான சிறிய ஸ்பீக்கர். முதல் யோசனையோடு நிறுத்தாமல் பல வடிவங்களை ஆராயுங்கள்.' },
  { stage: 'EXPERIMENT', text: 'Shape three genuinely different variants: change the base form, proportions, taper and corner radius. Keep each inside the 200 mm tall × 150 mm wide envelope.', ta: 'மூன்று உண்மையில் வேறுபட்ட வடிவங்களை உருவாக்குங்கள்.' },
  { stage: 'UNDERSTAND', text: 'Each form says something: tall and narrow feels elegant, low and wide feels stable, tapers feel dynamic, soft radii feel friendly. There is no single right answer — the point is choice.', ta: 'ஒவ்வொரு வடிவமும் ஏதோ ஒன்றைச் சொல்கிறது. ஒரே சரியான விடை இல்லை.' },
  { stage: 'TEST', text: 'Pick a favourite and write why — that reasoning is what design reviews are about.', ta: 'விருப்பமானதைத் தேர்ந்தெடுத்து ஏன் என்று எழுதுங்கள்.' },
];

export default function L1Forms() {
  const [vs, setVs] = useState<V[]>(START);
  const [cur, setCur] = useState(0);
  const [fav, setFav] = useState<number | null>(null);
  const [why, setWhy] = useState('');
  const v = vs[cur];
  const set = (p: Partial<V>) => setVs(vs.map((x, i) => (i === cur ? { ...x, ...p } : x)));
  const inEnv = vs.map((x) => x.H <= 200 && x.W <= 150 && x.W * Math.max(1, x.taper) <= 150);

  const evaluate = (): Feedback => {
    const pairs = [diff(vs[0], vs[1]), diff(vs[0], vs[2]), diff(vs[1], vs[2])];
    const distinct = pairs.filter((d) => d >= 0.35).length;
    const rubric = [
      { criterion: 'Three clearly different variants (form, proportion, taper or radius)', points: (distinct / 3) * 40, max: 40, note: `difference scores ${pairs.map((d) => fmt(d, 2)).join(', ')} (≥ 0.35 counts)` },
      { criterion: 'All variants inside the 200 × 150 mm envelope', points: (inEnv.filter(Boolean).length / 3) * 20, max: 20 },
      { criterion: 'A favourite is chosen', points: fav != null ? 15 : 0, max: 15 },
      { criterion: 'Reasoning written (refers to user, context or meaning)', points: why.trim().length >= 25 ? 25 : why.trim().length >= 8 ? 12 : 0, max: 25, note: why ? `“${why.slice(0, 80)}”` : 'empty' },
    ];
    const bad = rubric.filter((r) => r.points < r.max);
    return {
      score: Math.round(rubric.reduce((s, r) => s + r.points, 0)),
      correct: rubric.filter((r) => r.points >= r.max).map((r) => r.criterion),
      issues: bad.map((r) => ({ label: r.criterion, detail: r.note })),
      why: 'Form exploration widens the solution space before details lock it in. The rubric rewards range and reasoning — it does not judge which form is most beautiful.',
      suggestion: bad.length ? `Next: ${bad[0].criterion.toLowerCase()}.` : 'Show the three variants to someone else and ask which they would put by their bed — and why.',
      rubric,
    };
  };

  return (
    <LevelShell
      id="w6-l1"
      steps={steps}
      evaluate={evaluate}
      viewport={
        <Stage3D fit={200} camera={[0, 160, 480]} target={[0, 60, 0]} env showViews={false}>
          {vs.map((x, i) => (
            <Variant key={i} v={x} x={(i - 1) * 170} label={`${String.fromCharCode(65 + i)}${fav === i ? ' ★' : ''}`} />
          ))}
        </Stage3D>
      }
    >
      <Seg value={String(cur)} onChange={(c) => setCur(parseInt(c, 10))} options={vs.map((_, i) => ({ v: String(i), label: `Variant ${String.fromCharCode(65 + i)}${inEnv[i] ? '' : ' ⚠'}` }))} />
      <Seg value={v.base} onChange={(base) => set({ base })} options={[{ v: 'round', label: 'Round' }, { v: 'box', label: 'Box' }, { v: 'hex', label: 'Hex' }, { v: 'tri', label: 'Triangle' }]} />
      <Slider label="Height" value={v.H} min={40} max={240} step={1} unit="mm" onChange={(H) => set({ H })} />
      <Slider label="Width" value={v.W} min={40} max={180} step={1} unit="mm" onChange={(W) => set({ W })} />
      <Slider label="Taper (top ÷ bottom)" value={v.taper} min={0.4} max={1.4} step={0.05} onChange={(taper) => set({ taper })} digits={2} />
      {v.base === 'box' && <Slider label="Corner radius" value={v.radius} min={0} max={Math.round(v.W / 2 - 1)} step={1} unit="mm" onChange={(radius) => set({ radius })} />}
      <div className="numrow">
        <span className="lbl">Colour</span>
        <input type="color" value={v.color} onChange={(e) => set({ color: e.target.value })} />
        <span className="muted" style={{ fontSize: 12 }}>
          H : W = {fmt(v.H / v.W, 2)}
        </span>
      </div>
      <div className="lbl">Favourite</div>
      <Seg value={fav == null ? '' : String(fav)} onChange={(f) => setFav(parseInt(f, 10))} options={vs.map((_, i) => ({ v: String(i), label: String.fromCharCode(65 + i) }))} />
      <textarea rows={2} placeholder="Why this one? Think about the user, the bedroom, what the form communicates…" value={why} onChange={(e) => setWhy(e.target.value)} />
    </LevelShell>
  );
}
