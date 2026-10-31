import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { NumberField, Slider, Task } from '../../components/ui';
import { fmt, relTol } from '../../lib/math';
import { useSettings } from '../../store/progress';
import type { Feedback, LessonStep } from '../../lib/types';

const L0 = 80; // free length mm
const TOP = 200;

function Helix({ len }: { len: number }) {
  const geo = useMemo(() => {
    const coils = 10;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= coils * 24; i++) {
      const t = i / 24;
      pts.push(new THREE.Vector3(12 * Math.cos(t * Math.PI * 2), -(t / coils) * len, 12 * Math.sin(t * Math.PI * 2)));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), coils * 24, 1.4, 8, false);
  }, [len]);
  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial color="#b7bcc4" metalness={1} roughness={0.25} />
    </mesh>
  );
}

function Sim({ k, m, kick, onX }: { k: number; m: number; kick: number; onX: (x: number) => void }) {
  const st = useRef({ x: 0, v: 0, kick: -1, t: 0 });
  const spring = useRef<THREE.Group>(null);
  const mass = useRef<THREE.Mesh>(null);
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.03);
    const s = st.current;
    if (s.kick !== kick) {
      s.kick = kick;
      s.x = 0;
      s.v = 0;
    }
    const sub = 10;
    for (let i = 0; i < sub; i++) {
      const h = dt / sub;
      const a = (m * 9.81 - k * s.x - 2 * 0.08 * Math.sqrt(k * m) * s.v) / m; // x in metres
      s.v += a * h;
      s.x += s.v * h;
    }
    const len = L0 + s.x * 1000;
    if (spring.current) spring.current.scale.y = len / L0;
    if (mass.current) mass.current.position.y = -len - 14;
    s.t += dt;
    if (s.t > 0.1) {
      s.t = 0;
      onX(s.x * 1000);
    }
  });
  return (
    <group position={[0, TOP, 0]}>
      <group ref={spring}>
        <Helix len={L0} />
      </group>
      <mesh ref={mass} position={[0, -L0 - 14, 0]} castShadow>
        <cylinderGeometry args={[18, 18, 28, 32]} />
        <meshStandardMaterial color="#f8961e" metalness={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'A mass hangs on a spring. Press “Release” and watch it bounce and settle.', ta: 'சுருள்வில்லில் ஒரு நிறை தொங்குகிறது. "Release" அழுத்தி அது அதிர்ந்து நிலைபெறுவதைப் பாருங்கள்.' },
  { stage: 'UNDERSTAND', text: "Hooke's law: F = k·x. The spring force grows in a straight line with extension. k (stiffness, N/m) says how many newtons stretch it by one metre. At rest, k·x = m·g.", ta: 'ஹூக்கின் விதி: F = k·x. ஓய்வில் k·x = m·g.' },
  { stage: 'EXPERIMENT', text: 'Change k and the mass. Stiffer springs stretch less and bounce faster; heavier masses stretch more and bounce slower.', ta: 'k மற்றும் நிறையை மாற்றிப் பாருங்கள்.' },
  { stage: 'BUILD', text: 'Choose k so a 2 kg mass stretches the spring exactly 20 mm. Then predict how far your spring stretches with 3 kg.', ta: '2 kg நிறை 20 mm நீட்டும்படி k-ஐத் தேர்ந்தெடுங்கள். பிறகு 3 kg-க்கு நீட்சியைக் கணியுங்கள்.' },
];

export default function L5Spring() {
  const { difficulty } = useSettings();
  const tol = relTol(difficulty);
  const [k, setK] = useState(500);
  const [m, setM] = useState(1);
  const [kick, setKick] = useState(0);
  const [x, setX] = useState(0);
  const [pred, setPred] = useState(0);
  const eq = ((m * 9.81) / k) * 1000;

  const evaluate = (): Feedback => {
    const kOk = Math.abs(k - 981) / 981 <= tol;
    const truth = ((3 * 9.81) / k) * 1000;
    const pOk = Math.abs(pred - truth) / truth <= tol;
    return {
      score: (kOk ? 60 : Math.max(0, 40 - Math.abs(k - 981) / 20)) + (pOk ? 40 : 0),
      correct: [kOk ? `k = ${k} N/m: 2 kg × 9.81 = 19.6 N ÷ 0.020 m ≈ 981 N/m.` : '', pOk ? `Predicted ${fmt(pred, 1)} mm for 3 kg — correct for your spring.` : ''].filter(Boolean),
      issues: [...(kOk ? [] : [{ label: `k = ${k} N/m gives ${fmt(((2 * 9.81) / k) * 1000, 1)} mm with 2 kg, not 20 mm.`, detail: 'k = F ÷ x = (2 × 9.81 N) ÷ 0.020 m.' }]), ...(pOk ? [] : [{ label: `3 kg prediction ${fmt(pred, 1)} mm; with your k it would be ${fmt(truth, 1)} mm.`, detail: 'Extension is proportional to force: 3 kg stretches 1.5× as far as 2 kg.' }])],
      why: 'Springs store energy and set forces in buttons, clips, suspension, pens and scales. Sizing k lets a designer choose exactly how hard a button feels or how far a seat sinks.',
      suggestion: 'Use the F–x graph: the line’s slope is k. Read off where the 2 kg force (19.6 N) meets 20 mm.',
      canShowCorrection: false,
    };
  };

  const W = 260,
    H = 140;
  const maxX = 60,
    maxF = 60;
  const X = (mm: number) => 30 + (mm / maxX) * (W - 40);
  const Y = (f: number) => H - 20 - (f / maxF) * (H - 30);
  return (
    <LevelShell
      id="w5-l5"
      steps={steps}
      evaluate={evaluate}
      hints={[{ en: '20 mm = 0.020 m. 2 kg weighs 2 × 9.81 = 19.62 N. k = 19.62 ÷ 0.020.', ta: '20 mm = 0.020 m; k = 19.62 ÷ 0.020.' }]}
      viewport={
        <Stage3D fit={130} camera={[120, 140, 260]} target={[0, 110, 0]} env showViews={false}>
          <mesh position={[0, TOP + 5, 0]}>
            <boxGeometry args={[80, 10, 40]} />
            <meshStandardMaterial color="#577590" />
          </mesh>
          <Sim k={k} m={m} kick={kick} onX={setX} />
          <Label position={[60, TOP - L0 - x, 0]} color="#ffd166">{`x = ${fmt(x, 1)} mm`}</Label>
        </Stage3D>
      }
    >
      <Slider label="Spring stiffness k" value={k} min={100} max={3000} step={1} unit="N/m" onChange={setK} />
      <Slider label="Mass" value={m} min={0.2} max={5} step={0.1} unit="kg" onChange={setM} digits={1} />
      <button className="btn small accent" onClick={() => setKick(kick + 1)}>
        ▶ Release from rest
      </button>
      <div className="formula">
        rest extension x = m·g ÷ k = {fmt(m * 9.81, 2)} ÷ {k} = {fmt(eq, 1)} mm
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ background: 'var(--bg2)', borderRadius: 8 }}>
        <line x1={30} y1={H - 20} x2={W - 5} y2={H - 20} stroke="#8d9aa8" />
        <line x1={30} y1={H - 20} x2={30} y2={5} stroke="#8d9aa8" />
        <line x1={X(0)} y1={Y(0)} x2={X(Math.min(maxX, (maxF / k) * 1000))} y2={Y(Math.min(maxF, (k * maxX) / 1000))} stroke="#4cc9f0" strokeWidth={2} />
        <circle cx={X(Math.min(maxX, eq))} cy={Y(m * 9.81)} r={5} fill="#f8961e" />
        <line x1={X(20)} x2={X(20)} y1={5} y2={H - 20} stroke="#3fb950" strokeDasharray="3 3" />
        <line x1={30} x2={W - 5} y1={Y(19.62)} y2={Y(19.62)} stroke="#3fb950" strokeDasharray="3 3" />
        <text x={W - 70} y={H - 5} fill="#8d9aa8" fontSize={10}>
          extension (mm)
        </text>
        <text x={34} y={12} fill="#8d9aa8" fontSize={10}>
          force (N)
        </text>
      </svg>
      <NumberField label="3 kg prediction" value={pred} digits={1} unit="mm" onChange={setPred} />
      <Task ok={Math.abs(k - 981) / 981 <= tol}>2 kg → 20 mm</Task>
      <Task ok={pred > 0}>Prediction entered</Task>
      <div className="note">Simplified: ideal linear spring with light damping, no spring mass. Real springs are linear only within their working range.</div>
    </LevelShell>
  );
}
