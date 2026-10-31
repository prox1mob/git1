import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { Slider, Task, Toggle } from '../../components/ui';
import { fmt } from '../../lib/math';
import type { Feedback, LessonStep, Vec2, Vec3 } from '../../lib/types';

interface Bars {
  a: number; // crank
  b: number; // coupler
  c: number; // rocker
  d: number; // ground
}

export function solve4bar({ a, b, c, d }: Bars, th: number): { B: Vec2; C: Vec2 } | null {
  const B: Vec2 = [a * Math.cos(th), a * Math.sin(th)];
  const D: Vec2 = [d, 0];
  const dx = D[0] - B[0],
    dy = D[1] - B[1];
  const L = Math.hypot(dx, dy);
  if (L > b + c || L < Math.abs(b - c) || L < 1e-9) return null;
  const x = (b * b - c * c + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(0, b * b - x * x));
  const ux = dx / L,
    uy = dy / L;
  return { B, C: [B[0] + ux * x - uy * h, B[1] + uy * x + ux * h] };
}

export function analyse4bar(bars: Bars) {
  const n = 360;
  const valid: boolean[] = [];
  const rocker: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = solve4bar(bars, (i / n) * Math.PI * 2);
    valid.push(!!s);
    if (s) rocker.push(Math.atan2(s.C[1], s.C[0] - bars.d));
  }
  const full = valid.every(Boolean);
  const swing = rocker.length ? ((Math.max(...rocker) - Math.min(...rocker)) * 180) / Math.PI : 0;
  const L = [bars.a, bars.b, bars.c, bars.d].sort((x, y) => x - y);
  const grashof = L[0] + L[3] <= L[1] + L[2];
  const crankShortest = bars.a <= Math.min(bars.b, bars.c, bars.d);
  return { full, swing, grashof, crankShortest, valid };
}

function Bar({ p, q, w = 6, color }: { p: Vec2; q: Vec2; w?: number; color: string }) {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
  return (
    <mesh position={[(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 0]} rotation={[0, 0, ang]} castShadow>
      <boxGeometry args={[len + w, w, 4]} />
      <meshStandardMaterial color={color} metalness={0.4} roughness={0.4} />
    </mesh>
  );
}

function Mechanism({ bars, speed, offset, trace }: { bars: Bars; speed: number; offset: number; trace: boolean }) {
  const [state, setState] = useState<{ B: Vec2; C: Vec2 } | null>(solve4bar(bars, 0.3));
  const th = useRef(0.3);
  const dir = useRef(1);
  const info = useMemo(() => analyse4bar(bars), [bars]);
  const path = useMemo(() => {
    const pts: Vec3[] = [];
    for (let i = 0; i <= 360; i++) {
      const s = solve4bar(bars, (i / 360) * Math.PI * 2);
      if (!s) continue;
      const mx = (s.B[0] + s.C[0]) / 2,
        my = (s.B[1] + s.C[1]) / 2;
      const ux = s.C[0] - s.B[0],
        uy = s.C[1] - s.B[1];
      const L = Math.hypot(ux, uy) || 1;
      pts.push([mx - (uy / L) * offset, my + (ux / L) * offset, 3]);
    }
    return pts;
  }, [bars, offset]);
  useFrame((_, dt) => {
    let next = th.current + dir.current * speed * Math.min(dt, 0.05);
    let s = solve4bar(bars, next);
    if (!s) {
      dir.current *= -1;
      next = th.current;
      s = solve4bar(bars, next);
    }
    th.current = next;
    if (s) setState(s);
  });
  if (!state) return <Label position={[bars.d / 2, 40, 0]} color="#ff8a80">These lengths cannot be assembled</Label>;
  const { B, C } = state;
  const ux = C[0] - B[0],
    uy = C[1] - B[1];
  const L = Math.hypot(ux, uy) || 1;
  const P: Vec2 = [(B[0] + C[0]) / 2 - (uy / L) * offset, (B[1] + C[1]) / 2 + (ux / L) * offset];
  return (
    <group>
      <Bar p={[0, 0]} q={[bars.d, 0]} color="#577590" w={8} />
      <Bar p={[0, 0]} q={B} color="#4cc9f0" />
      <Bar p={B} q={C} color="#90be6d" />
      <Bar p={[bars.d, 0]} q={C} color="#f8961e" />
      <Line points={[[B[0], B[1], 2], [P[0], P[1], 2], [C[0], C[1], 2]]} color="#90be6d" lineWidth={2} />
      {[[0, 0], [bars.d, 0], B, C].map((p, i) => (
        <mesh key={i} position={[p[0], p[1], 3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[3, 3, 8, 16]} />
          <meshStandardMaterial color="#e9edf2" metalness={1} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[P[0], P[1], 4]}>
        <sphereGeometry args={[3.5, 16, 8]} />
        <meshBasicMaterial color="#ffd166" />
      </mesh>
      {trace && path.length > 2 && <Line points={path} color="#ffd166" lineWidth={1.5} />}
      <Label position={[bars.d / 2, -25, 0]} color={info.full ? '#3fb950' : '#ff8a80'}>
        {info.full ? 'crank turns fully' : 'crank cannot turn fully — it rocks back and forth'}
      </Label>
    </group>
  );
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'A four-bar linkage: a fixed ground link, a crank (blue) driven by a motor, a coupler (green) and a rocker (orange). Four pins, four bars.', ta: 'நான்கு-கம்பி இணைப்பு: நிலைக் கம்பி, crank (நீலம்), coupler (பச்சை), rocker (ஆரஞ்சு).' },
  { stage: 'EXPERIMENT', text: 'Change the bar lengths. Watch whether the crank can turn all the way round, how far the rocker swings, and the yellow curve traced by a point on the coupler.', ta: 'கம்பிகளின் நீளத்தை மாற்றிப் பாருங்கள்.' },
  { stage: 'UNDERSTAND', text: 'Grashof’s rule: if shortest + longest ≤ sum of the other two, at least one link can rotate fully. If the shortest link is the crank, you get a crank-rocker: continuous rotation in, back-and-forth swing out.', ta: 'Grashof விதி: மிகக் குறுகியது + மிக நீளமானது ≤ மற்ற இரண்டின் கூட்டு என்றால், ஒரு கம்பி முழுமையாகச் சுழலும்.' },
  { stage: 'BUILD', text: 'Design a windscreen-wiper style crank-rocker: the crank must rotate fully and the rocker must swing at least 60°.', ta: 'Wiper போன்ற crank-rocker: crank முழுமையாகச் சுழல வேண்டும், rocker குறைந்தது 60° ஆட வேண்டும்.' },
];

export default function L6Linkage() {
  const [bars, setBars] = useState<Bars>({ a: 30, b: 100, c: 80, d: 110 });
  const [speed, setSpeed] = useState(1.5);
  const [offset, setOffset] = useState(25);
  const [trace, setTrace] = useState(true);
  const info = analyse4bar(bars);
  const set = (k: keyof Bars, v: number) => setBars({ ...bars, [k]: v });

  const evaluate = (): Feedback => {
    const checks: [boolean, string, string][] = [
      [info.grashof, 'Grashof condition holds (s + l ≤ p + q)', 'Shortest + longest is greater than the other two — no link can rotate fully.'],
      [info.full && info.crankShortest, 'The crank (input) rotates a full turn', 'The crank cannot rotate fully — make it the shortest link.'],
      [info.swing >= 60, `Rocker swings ${fmt(info.swing, 1)}°`, `Rocker only swings ${fmt(info.swing, 1)}° — lengthen the crank or shorten the rocker.`],
    ];
    return {
      score: Math.round((checks.filter((c) => c[0]).length / 3) * 100),
      correct: checks.filter((c) => c[0]).map((c) => c[1]),
      issues: checks.filter((c) => !c[0]).map((c) => ({ label: c[2] })),
      why: 'Linkages turn simple rotation into complex motion with no electronics: wipers, folding chairs, pliers, car suspension, excavator arms and walking toys. Length ratios alone decide what they can do.',
      suggestion: 'Increase the crank length step by step: the swing grows, until the crank stops being able to turn fully.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w5-l6"
      steps={steps}
      evaluate={evaluate}
      hints={[{ en: 'Try crank 40, coupler 100, rocker 70, ground 110.', ta: 'Crank 40, coupler 100, rocker 70, ground 110 முயலுங்கள்.' }]}
      viewport={
        <Stage3D fit={120} camera={[55, 40, 260]} target={[55, 40, 0]} grid={false} shadows={false} env showViews={false}>
          <Mechanism bars={bars} speed={speed} offset={offset} trace={trace} />
        </Stage3D>
      }
    >
      <Slider label="Crank a (blue, input)" value={bars.a} min={10} max={120} step={1} unit="mm" onChange={(v) => set('a', v)} />
      <Slider label="Coupler b (green)" value={bars.b} min={20} max={160} step={1} unit="mm" onChange={(v) => set('b', v)} />
      <Slider label="Rocker c (orange, output)" value={bars.c} min={20} max={160} step={1} unit="mm" onChange={(v) => set('c', v)} />
      <Slider label="Ground d" value={bars.d} min={30} max={160} step={1} unit="mm" onChange={(v) => set('d', v)} />
      <Slider label="Motor speed" value={speed} min={0} max={5} step={0.1} unit="rad/s" onChange={setSpeed} />
      <Slider label="Coupler point offset" value={offset} min={-60} max={60} step={1} unit="mm" onChange={setOffset} />
      <Toggle checked={trace} onChange={setTrace} label="Trace the coupler curve" />
      <div className="kv">
        <span>Grashof</span>
        <span>{info.grashof ? 'yes' : 'no'}</span>
        <span>Crank shortest</span>
        <span>{info.crankShortest ? 'yes' : 'no'}</span>
        <span>Rocker swing</span>
        <span>{fmt(info.swing, 1)}°</span>
      </div>
      <Task ok={info.full && info.crankShortest}>Crank rotates fully</Task>
      <Task ok={info.swing >= 60}>Rocker swing ≥ 60°</Task>
      <div className="note">Kinematic animation: positions are solved exactly from geometry, but forces, inertia and pin friction are not simulated.</div>
    </LevelShell>
  );
}

