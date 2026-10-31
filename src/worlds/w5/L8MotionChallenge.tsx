import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { Seg, Slider } from '../../components/ui';
import { DEG, fmt } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

export interface StandParams {
  D: number; // base depth (footprint)
  Ls: number; // back plate length
  s: number; // leg attachment distance from hinge, along back plate
  Lk: number; // leg length
  n: [number, number, number]; // notch distances from hinge along the base
}
export const STAND_INIT: StandParams = { D: 70, Ls: 110, s: 70, Lk: 60, n: [40, 55, 70] };
const PHONE = { h: 160, t: 8, mass: 180, com: 80 };
const LIN = 0.223; // g per mm of 60 × 3 mm PLA plate

export function angleFor(p: StandParams, n: number) {
  const c = (p.s * p.s + n * n - p.Lk * p.Lk) / (2 * p.s * n);
  if (c < -1 || c > 1) return null;
  return Math.acos(c) / DEG;
}
export function stability(p: StandParams, thDeg: number) {
  const th = thDeg * DEG;
  const parts: [number, number][] = [
    [PHONE.mass, -PHONE.com * Math.cos(th)],
    [LIN * p.D, -p.D / 2],
    [LIN * p.Ls, -(p.Ls / 2) * Math.cos(th)],
  ];
  const n = p.n.find((v) => angleFor(p, v) != null && Math.abs((angleFor(p, v) ?? 0) - thDeg) < 0.01) ?? p.n[0];
  parts.push([LIN * p.Lk, (-p.s * Math.cos(th) - n) / 2]);
  const m = parts.reduce((a, q) => a + q[0], 0);
  const cx = parts.reduce((a, q) => a + q[0] * q[1], 0) / m;
  return { cx, margin: Math.min(cx + p.D, -cx), mass: m };
}

export function standRubric(p: StandParams) {
  const angles = p.n.map((v) => (v <= p.D ? angleFor(p, v) : null));
  const valid = angles.filter((a): a is number => a != null);
  const rows: { criterion: string; points: number; max: number; note?: string }[] = [];
  const allValid = valid.length === 3;
  rows.push({ criterion: 'All three notches give a valid, reachable angle', points: allValid ? 20 : valid.length * 5, max: 20, note: angles.map((a, i) => `notch ${i + 1}: ${a == null ? 'impossible' : fmt(a, 1) + '°'}`).join(', ') });
  const lo = valid.length ? Math.min(...valid) : 99,
    hi = valid.length ? Math.max(...valid) : 0;
  rows.push({ criterion: 'Viewing angles cover 50°–70°', points: (lo <= 52 ? 12.5 : 0) + (hi >= 68 ? 12.5 : 0), max: 25, note: valid.length ? `range ${fmt(lo, 1)}°–${fmt(hi, 1)}°` : 'no valid angles' });
  const stab = valid.map((a) => stability(p, a).margin);
  const stableAll = stab.length > 0 && stab.every((m) => m >= 10);
  rows.push({ criterion: 'Stable at every angle (centre of mass ≥ 10 mm inside the footprint)', points: stableAll ? 25 : stab.filter((m) => m >= 10).length * 6, max: 25, note: stab.map((m) => `${fmt(m, 1)} mm`).join(', ') });
  rows.push({ criterion: 'Compact footprint (base depth ≤ 100 mm)', points: p.D <= 100 ? 10 : 0, max: 10, note: `${p.D} mm` });
  rows.push({ criterion: 'Back plate supports the phone (≥ 100 mm) and the leg attaches on it', points: p.Ls >= 100 && p.s <= p.Ls - 5 ? 10 : 0, max: 10 });
  rows.push({ criterion: 'Folds flat (leg shorter than the back plate)', points: p.Lk < p.Ls ? 10 : 0, max: 10 });
  return { rows, angles };
}

export function Stand({ p, theta, legN }: { p: StandParams; theta: number; legN: number }) {
  const cur = useRef(theta);
  const back = useRef<THREE.Group>(null);
  const leg = useRef<THREE.Group>(null);
  const phone = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    cur.current += (theta - cur.current) * (1 - Math.exp(-dt * 5));
    const th = cur.current * DEG;
    // direction u = (−cos θ, sin θ) is +X rotated by (π − θ)
    if (back.current) back.current.rotation.z = Math.PI - th;
    if (phone.current) phone.current.rotation.z = Math.PI - th;
    // leg from K = s·u to foot at (-n, 0) where u = (-cos θ, sin θ)
    const K = new THREE.Vector2(-p.s * Math.cos(th), p.s * Math.sin(th));
    const F = new THREE.Vector2(cur.current < 1 ? K.x - p.Lk : -legN, 0);
    if (leg.current) {
      leg.current.position.set(K.x, K.y + 3, 0);
      leg.current.rotation.z = Math.atan2(F.y - K.y, F.x - K.x);
    }
  });
  return (
    <group>
      <mesh position={[-p.D / 2, 1.5, 0]} castShadow>
        <boxGeometry args={[p.D, 3, 60]} />
        <meshStandardMaterial color="#4cc9f0" />
      </mesh>
      <mesh position={[3, 5, 0]}>
        <boxGeometry args={[6, 10, 60]} />
        <meshStandardMaterial color="#4cc9f0" />
      </mesh>
      {p.n.map((n, i) => (
        <mesh key={i} position={[-n, 3.5, 0]}>
          <boxGeometry args={[2, 2, 60]} />
          <meshStandardMaterial color={n <= p.D ? '#0b0f14' : '#f85149'} />
        </mesh>
      ))}
      {/* back plate: built along -X then rotated about the hinge */}
      <group ref={back} position={[0, 3, 0]} rotation={[0, 0, Math.PI]}>
        <mesh position={[p.Ls / 2, 1.5, 0]} castShadow>
          <boxGeometry args={[p.Ls, 3, 60]} />
          <meshStandardMaterial color="#f8961e" />
        </mesh>
      </group>
      <group ref={leg}>
        <mesh position={[p.Lk / 2, 0, 0]} castShadow>
          <boxGeometry args={[p.Lk, 3, 40]} />
          <meshStandardMaterial color="#90be6d" />
        </mesh>
      </group>
      <group ref={phone} position={[0, 3, 0]} rotation={[0, 0, Math.PI]}>
        <mesh position={[PHONE.h / 2, -PHONE.t / 2, 0]} castShadow>
          <boxGeometry args={[PHONE.h, PHONE.t, 75]} />
          <meshPhysicalMaterial color="#1e2126" roughness={0.2} clearcoat={1} transparent opacity={0.85} />
        </mesh>
      </group>
    </group>
  );
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'A folding phone stand: a base (blue), a back plate on a hinge (orange) and a kickstand leg (green) that drops into one of three notches. Each notch gives a different viewing angle.', ta: 'மடிக்கக்கூடிய ஃபோன் ஸ்டாண்ட்: அடித்தளம், கீல் மேல் பின்தட்டு, மூன்று குழிகளில் ஒன்றில் விழும் கால்.' },
  { stage: 'UNDERSTAND', text: 'The angle comes from a triangle: hinge → leg pivot (s), hinge → notch (n), and the leg (L). Law of cosines: cos θ = (s² + n² − L²) ÷ (2·s·n). Stability comes from where the combined centre of mass falls.', ta: 'கோணம் ஒரு முக்கோணத்திலிருந்து வருகிறது: cos θ = (s² + n² − L²) ÷ (2·s·n).' },
  { stage: 'BUILD', text: 'Design brief: three angles covering 50°–70°, stable at every angle, footprint ≤ 100 mm, folds flat. Tap the notch buttons to watch it move.', ta: 'சுருக்கம்: 50°–70° வரை மூன்று கோணங்கள், ஒவ்வொன்றிலும் நிலைத்தன்மை, ≤ 100 mm அடித்தளம், தட்டையாக மடியும்.' },
  { stage: 'UNDERSTAND', text: 'This is a kinematic model: it calculates positions and a static centre of mass. A validated physical simulation (or a printed prototype) would also check friction in the notches, hinge play, flex and a finger tapping the screen.', ta: 'இது இயக்கவியல் மாதிரி மட்டும். உண்மையான சோதனை உராய்வு, வளைவு, தொடுதல் போன்றவற்றையும் சரிபார்க்கும்.' },
];

export default function L8MotionChallenge() {
  const [p, setP] = useState<StandParams>(STAND_INIT);
  const [pose, setPose] = useState<'fold' | '0' | '1' | '2'>('1');
  const { rows, angles } = standRubric(p);
  const idx = pose === 'fold' ? -1 : parseInt(pose, 10);
  const theta = idx < 0 ? 2 : angles[idx] ?? 0;
  const st = idx >= 0 && angles[idx] != null ? stability(p, angles[idx]!) : null;
  const set = (q: Partial<StandParams>) => setP({ ...p, ...q });

  const evaluate = (): Feedback => {
    const score = Math.round(rows.reduce((s, r) => s + r.points, 0));
    const bad = rows.filter((r) => r.points < r.max);
    return {
      score,
      correct: rows.filter((r) => r.points >= r.max).map((r) => r.criterion),
      issues: bad.map((r) => ({ label: r.criterion, detail: r.note })),
      why: 'Mechanisms are judged by their whole range of motion, not one pose. Every position must work — and stay stable — while the product still folds small for the bag.',
      suggestion: bad.length ? `Work on “${bad[0].criterion}”. ${bad[0].note ?? ''}` : 'Print it! A kinematic model gets you close; a physical prototype reveals friction and wobble.',
      rubric: rows,
    };
  };

  return (
    <LevelShell
      id="w5-l8"
      steps={steps}
      evaluate={evaluate}
      onRetry={() => setP(STAND_INIT)}
      hints={[{ en: 'Moving a notch further from the hinge lowers the angle. A longer leg raises all angles. Try s = 75, leg = 60 and notches near 35, 50 and 62 mm, then check stability.', ta: 'குழியை கீலிலிருந்து தொலைவாக்கினால் கோணம் குறையும்.' }]}
      viewport={
        <Stage3D fit={150} camera={[-30, 120, 380]} target={[-40, 70, 0]} env showViews={false}>
          <Stand p={p} theta={theta} legN={idx >= 0 ? p.n[idx] : 0} />
          {st && (
            <>
              <mesh position={[st.cx, 1, 35]}>
                <sphereGeometry args={[3, 12, 8]} />
                <meshBasicMaterial color={st.margin >= 10 ? '#3fb950' : '#f85149'} />
              </mesh>
              <Label position={[st.cx, -12, 35]} color={st.margin >= 10 ? '#3fb950' : '#ff8a80'}>
                {`centre of mass · margin ${fmt(st.margin, 1)} mm`}
              </Label>
            </>
          )}
          <Label position={[-60, 160, 0]}>{idx >= 0 ? (angles[idx] == null ? 'this notch is impossible' : `${fmt(angles[idx]!, 1)}°`) : 'folded'}</Label>
        </Stage3D>
      }
    >
      <Seg value={pose} onChange={setPose} options={[{ v: 'fold', label: 'Folded' }, { v: '0', label: 'Notch 1' }, { v: '1', label: 'Notch 2' }, { v: '2', label: 'Notch 3' }]} />
      <Slider label="Base depth (footprint)" value={p.D} min={40} max={140} step={1} unit="mm" onChange={(D) => set({ D })} />
      <Slider label="Back plate length" value={p.Ls} min={60} max={160} step={1} unit="mm" onChange={(Ls) => set({ Ls })} />
      <Slider label="Leg pivot distance s" value={p.s} min={20} max={150} step={1} unit="mm" onChange={(s) => set({ s })} />
      <Slider label="Leg length L" value={p.Lk} min={20} max={150} step={1} unit="mm" onChange={(Lk) => set({ Lk })} />
      {p.n.map((n, i) => (
        <Slider key={i} label={`Notch ${i + 1} distance n${i + 1}`} value={n} min={10} max={140} step={1} unit="mm" onChange={(v) => set({ n: p.n.map((q, k) => (k === i ? v : q)) as [number, number, number] })} />
      ))}
      <div className="kv">
        {angles.map((a, i) => (
          <span key={i} style={{ display: 'contents' }}>
            <span>Notch {i + 1}</span>
            <span>{a == null || p.n[i] > p.D ? '✗ impossible' : `${fmt(a, 1)}°`}</span>
          </span>
        ))}
      </div>
    </LevelShell>
  );
}
