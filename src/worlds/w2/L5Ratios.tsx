import { Edges } from '@react-three/drei';
import { useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { DimensionLines, Label } from '../../components/three/ObjectMesh';
import { Slider, Task, Toggle } from '../../components/ui';
import { fmt, relTol } from '../../lib/math';
import { useSettings } from '../../store/progress';
import type { Feedback, LessonStep, Vec3 } from '../../lib/types';

const BASE: Vec3 = [60, 180, 60];
const GOALS: { text: string; ta: string; s: Vec3 }[] = [
  { text: 'Make a 1 : 2 scale model of the bottle (half size in every direction).', ta: 'பாட்டிலின் 1:2 அளவு மாதிரி செய்யுங்கள்.', s: [0.5, 0.5, 0.5] },
  { text: 'Resize the bottle to 270 mm tall while keeping its proportions.', ta: 'விகிதத்தை மாற்றாமல் 270 mm உயரம் ஆக்குங்கள்.', s: [1.5, 1.5, 1.5] },
  { text: 'Design a slim variant: keep the 180 mm height, but make width : height = 1 : 4 (round in X and Z).', ta: '180 mm உயரம் வைத்து அகலம் : உயரம் = 1 : 4 ஆக்குங்கள்.', s: [0.75, 1, 0.75] },
];

function gcdRatio(a: number, b: number, c: number) {
  const r = [a, b, c].map((v) => Math.round(v));
  const g = (x: number, y: number): number => (y ? g(y, x % y) : x);
  const k = r.reduce((s, v) => g(s, v), 0) || 1;
  return r.map((v) => v / k).join(' : ');
}

function Bottle({ s, ghost }: { s: Vec3; ghost?: boolean }) {
  const mat = ghost ? <meshBasicMaterial color="#8d9aa8" transparent opacity={0.18} depthWrite={false} /> : <meshPhysicalMaterial color="#90be6d" roughness={0.15} transmission={0.4} thickness={5} />;
  return (
    <group scale={s}>
      <mesh position={[0, 60, 0]} castShadow={!ghost}>
        <cylinderGeometry args={[30, 30, 120, 40]} />
        {mat}
        {ghost && <Edges color="#8d9aa8" />}
      </mesh>
      <mesh position={[0, 135, 0]} castShadow={!ghost}>
        <cylinderGeometry args={[10, 30, 30, 40]} />
        {mat}
      </mesh>
      <mesh position={[0, 165, 0]} castShadow={!ghost}>
        <cylinderGeometry args={[10, 10, 30, 30]} />
        {mat}
      </mesh>
    </group>
  );
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'A ratio compares sizes: this bottle is 60 : 180 = 1 : 3 (width : height). Proportion is what makes a small model look like the real thing.', ta: 'விகிதம் அளவுகளை ஒப்பிடுகிறது: இந்தப் பாட்டில் 60 : 180 = 1 : 3.' },
  { stage: 'EXPERIMENT', text: 'Turn off “Lock proportions” and stretch only the height. The bottle looks different — non-uniform scaling changes the design, not just its size.', ta: '"Lock proportions" அணைத்து உயரத்தை மட்டும் நீட்டுங்கள். வடிவமே மாறும்.' },
  { stage: 'UNDERSTAND', text: 'Uniform scale multiplies every dimension by the same factor k. Lengths × k, areas × k², volumes × k³. A 1 : 2 model holds only 1/8 of the liquid!', ta: 'சீரான அளவுமாற்றம்: நீளம் × k, பரப்பு × k², கனஅளவு × k³.' },
  { stage: 'TEST', text: 'Complete the three scaling tasks and lock each one in.', ta: 'மூன்று பணிகளையும் முடித்து lock செய்யுங்கள்.' },
];

export default function L5Ratios() {
  const { difficulty } = useSettings();
  const tol = relTol(difficulty);
  const [s, setS] = useState<Vec3>([1, 1, 1]);
  const [lock, setLock] = useState(true);
  const [task, setTask] = useState(0);
  const [locked, setLocked] = useState<(Vec3 | null)[]>([null, null, null]);
  const [corr, setCorr] = useState(false);
  const dims: Vec3 = [BASE[0] * s[0], BASE[1] * s[1], BASE[2] * s[2]];
  const box = new THREE.Box3(new THREE.Vector3(-dims[0] / 2, 0, -dims[2] / 2), new THREE.Vector3(dims[0] / 2, dims[1], dims[2] / 2));
  const set = (i: number, v: number) => setS(lock ? [v, v, v] : (s.map((q, k) => (k === i ? v : q)) as Vec3));

  const evaluate = (): Feedback => {
    const correct: string[] = [];
    const issues: Feedback['issues'] = [];
    let sc = 0;
    GOALS.forEach((g, i) => {
      const l = locked[i];
      if (!l) return issues.push({ label: `Task ${i + 1} not locked in.` });
      const e = Math.max(...l.map((v, k) => Math.abs(v - g.s[k]) / g.s[k]));
      const d = l.map((v, k) => v * BASE[k]);
      if (e <= tol) {
        sc++;
        correct.push(`Task ${i + 1}: ${d.map((v) => fmt(v)).join(' × ')} mm (scale ${l.map((v) => fmt(v, 2)).join(', ')}).`);
      } else issues.push({ label: `Task ${i + 1}: ${d.map((v) => fmt(v)).join(' × ')} mm.`, detail: `Needed ${g.s.map((v, k) => fmt(v * BASE[k])).join(' × ')} mm — scale factors ${g.s.join(', ')}.` });
    });
    return {
      score: Math.round((sc / 3) * 100),
      correct,
      issues,
      why: 'Scale models, product families (S / M / L) and drawings at 1 : 2 or 1 : 10 all rely on proportion. Knowing that volume grows with k³ prevents surprises — like a “double-size” container holding eight times as much.',
      suggestion: 'Find the factor first: k = new size ÷ old size (270 ÷ 180 = 1.5). Use lock for uniform scaling and unlock only when the brief asks for a new proportion.',
      canShowCorrection: true,
    };
  };

  const g = GOALS[task];
  return (
    <LevelShell
      id="w2-l5"
      steps={steps}
      evaluate={evaluate}
      onCorrection={setCorr}
      hints={[{ en: 'For width : height = 1 : 4 with height 180 mm, the width must be 45 mm, so X and Z scale = 45 ÷ 60 = 0.75.', ta: 'உயரம் 180 என்றால் அகலம் 45 mm; அளவுக் காரணி 0.75.' }]}
      viewport={
        <Stage3D fit={160} camera={[200, 170, 280]} target={[0, 90, 0]} axes={false}>
          <group position={[-60, 0, 0]}>
            <Bottle s={[1, 1, 1]} ghost />
            <Label position={[0, 195, 0]}>original 60 × 180</Label>
          </group>
          <group position={[60, 0, 0]}>
            <Bottle s={s} />
            <group position={[0, 0, 0]}>
              <DimensionLines box={box} />
            </group>
          </group>
          {corr && (
            <group position={[180, 0, 0]}>
              <Bottle s={g.s} ghost />
              <Label position={[0, g.s[1] * 180 + 15, 0]} color="#ffd166">
                target
              </Label>
            </group>
          )}
        </Stage3D>
      }
    >
      <Toggle checked={lock} onChange={(v) => { setLock(v); if (v) setS([s[1], s[1], s[1]]); }} label="Lock proportions (uniform scale)" />
      {(['X (width)', 'Y (height)', 'Z (depth)'] as const).map((l, i) => (
        <Slider key={l} label={`Scale ${l}`} value={s[i]} min={0.1} max={2.5} step={0.01} onChange={(v) => set(i, v)} digits={2} />
      ))}
      <div className="kv">
        <span>Size</span>
        <span>{dims.map((v) => fmt(v)).join(' × ')} mm</span>
        <span>W : H : D</span>
        <span>{gcdRatio(dims[0], dims[1], dims[2])}</span>
        <span>Height ÷ width</span>
        <span>{fmt(dims[1] / dims[0], 3)}</span>
        <span>Volume vs original</span>
        <span>× {fmt(s[0] * s[1] * s[2], 3)}</span>
      </div>
      <div className="card" style={{ padding: 10 }}>
        <div className="btnrow">
          {GOALS.map((_, i) => (
            <button key={i} className={`btn small ${task === i ? 'on' : ''}`} onClick={() => setTask(i)}>
              {locked[i] ? '🔒 ' : ''}Task {i + 1}
            </button>
          ))}
        </div>
        <p style={{ margin: '8px 0' }}>{g.text}</p>
        <button className="btn small accent" onClick={() => { setLocked(locked.map((l, i) => (i === task ? ([...s] as Vec3) : l))); if (task < 2) setTask(task + 1); }}>
          Lock in task {task + 1}
        </button>
        {GOALS.map((_, i) => (
          <Task key={i} ok={!!locked[i]}>
            Task {i + 1}: {locked[i] ? locked[i]!.map((v, k) => fmt(v * BASE[k])).join(' × ') + ' mm' : 'not locked'}
          </Task>
        ))}
      </div>
    </LevelShell>
  );
}
