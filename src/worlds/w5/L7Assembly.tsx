import { Edges } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { Slider, Task } from '../../components/ui';
import { DEG } from '../../lib/math';
import { toast } from '../../store/toast';
import type { Feedback, LessonStep, Vec3 } from '../../lib/types';

type MateId = 'pinAxis' | 'pinSeat' | 'pinLock' | 'armAxis' | 'armSeat' | 'armTopTop' | 'armEdge';
const MATES: { id: MateId; label: string; part: 'pin' | 'arm'; dof: number; valid: boolean; why: string }[] = [
  { id: 'pinAxis', label: 'Concentric: pin ↔ base hole', part: 'pin', dof: 4, valid: true, why: 'Lines up the two axes: removes 2 sideways moves and 2 tilts.' },
  { id: 'pinSeat', label: 'Coincident: pin shoulder ↔ base top face', part: 'pin', dof: 1, valid: true, why: 'Sets the height: removes sliding along the axis.' },
  { id: 'pinLock', label: 'Fix rotation: pin flat ↔ base side face (parallel)', part: 'pin', dof: 1, valid: true, why: 'A flat on the pin stops it spinning in the hole.' },
  { id: 'armAxis', label: 'Concentric: arm hole ↔ pin', part: 'arm', dof: 4, valid: true, why: 'The arm can now only slide along and turn around the pin.' },
  { id: 'armSeat', label: 'Coincident: arm bottom face ↔ pin shoulder top', part: 'arm', dof: 1, valid: true, why: 'Sets the arm’s height. One DOF remains: rotation — a revolute joint.' },
  { id: 'armTopTop', label: 'Coincident: arm TOP face ↔ base top face', part: 'arm', dof: 0, valid: false, why: 'That would bury the arm inside the base — the faces point the wrong way. Real CAD would flip it or report an error.' },
  { id: 'armEdge', label: 'Concentric: arm hole ↔ base edge', part: 'arm', dof: 0, valid: false, why: 'A concentric mate needs two round (cylindrical) features. An edge is straight.' },
];

function Part({ target, children }: { target: { p: Vec3; r: Vec3 }; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!g.current) return;
    const k = 1 - Math.exp(-dt * 6);
    g.current.position.lerp(new THREE.Vector3(...target.p), k);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...target.r));
    g.current.quaternion.slerp(q, k);
  });
  return <group ref={g}>{children}</group>;
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Three loose parts: a base plate with a hole, a shouldered pin, and an arm. Each free part has 6 degrees of freedom.', ta: 'மூன்று தனிப் பாகங்கள். ஒவ்வொரு தனிப் பாகத்துக்கும் 6 DOF.' },
  { stage: 'UNDERSTAND', text: 'Mates (assembly constraints) connect features: concentric aligns round features, coincident makes faces touch, parallel aligns directions. Each mate removes some freedom.', ta: 'Mates அம்சங்களை இணைக்கின்றன: concentric, coincident, parallel. ஒவ்வொன்றும் சுதந்திரத்தைக் குறைக்கிறது.' },
  { stage: 'BUILD', text: 'Assemble a pivoting arm: the pin must be completely fixed (0 DOF) and the arm must keep exactly ONE freedom — rotation. Some mates in the list are wrong: choose carefully.', ta: 'Pin முழுமையாக நிலையாக (0 DOF), arm-க்கு ஒரே ஒரு சுதந்திரம் — சுழற்சி.' },
  { stage: 'TEST', text: 'When the arm has 1 DOF, use the slider to swing it and check the motion.', ta: 'Arm-க்கு 1 DOF ஆனதும் slider-ஆல் சுழற்றிப் பாருங்கள்.' },
];

export default function L7Assembly() {
  const [applied, setApplied] = useState<MateId[]>([]);
  const [wrong, setWrong] = useState(0);
  const [swing, setSwing] = useState(0);
  const has = (m: MateId) => applied.includes(m);
  const pinDof = 6 - MATES.filter((m) => m.part === 'pin' && has(m.id)).reduce((s, m) => s + m.dof, 0);
  const armDof = 6 - MATES.filter((m) => m.part === 'arm' && has(m.id)).reduce((s, m) => s + m.dof, 0);
  const swung = armDof === 1 && Math.abs(swing) > 20;

  const pinT = { p: [has('pinAxis') ? 0 : -70, has('pinSeat') ? 8 : 45, has('pinAxis') ? 0 : 40] as Vec3, r: [has('pinAxis') ? 0 : 0.6, has('pinLock') ? 0 : 0.8, 0] as Vec3 };
  const armT = {
    p: [has('armAxis') ? 0 : 70, has('armSeat') ? 14 : 55, has('armAxis') ? 0 : 50] as Vec3,
    r: [has('armAxis') ? 0 : -0.5, armDof === 1 ? swing * DEG : has('armAxis') ? 0.7 : 0.3, has('armAxis') ? 0 : 0.4] as Vec3,
  };

  const apply = (id: MateId) => {
    const m = MATES.find((x) => x.id === id)!;
    if (!m.valid) {
      setWrong(wrong + 1);
      toast(`✗ ${m.why}`, 4200);
      return;
    }
    if (has(id)) return;
    setApplied([...applied, id]);
    toast(`✓ ${m.label}: −${m.dof} DOF. ${m.why}`, 3500);
  };

  const evaluate = (): Feedback => {
    const checks: [boolean, string, string][] = [
      [pinDof === 0, 'Pin fully constrained (0 DOF)', `Pin still has ${pinDof} DOF.`],
      [armDof === 1, 'Arm keeps exactly 1 DOF (revolute joint)', `Arm has ${armDof} DOF — it should keep only rotation.`],
      [swung, 'Arm motion tested', 'Swing the arm with the slider to test the joint.'],
    ];
    const base = (checks.filter((c) => c[0]).length / 3) * 100;
    return {
      score: Math.max(0, Math.round(base - wrong * 5)),
      correct: checks.filter((c) => c[0]).map((c) => c[1]),
      issues: [...checks.filter((c) => !c[0]).map((c) => ({ label: c[2] })), ...(wrong ? [{ label: `${wrong} invalid mate attempt(s) (−5 each).`, detail: 'Mates must pair compatible features: round with round for concentric, facing faces for coincident.' }] : [])],
      why: 'Assemblies are defined by how parts touch, not where they float. Counting degrees of freedom tells you whether a mechanism will move as intended — or rattle (too few constraints) or jam (too many).',
      suggestion: 'For each part, ask: which motions must remain? Then add mates until only those remain.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w5-l7"
      steps={steps}
      evaluate={evaluate}
      onRetry={() => { setApplied([]); setWrong(0); setSwing(0); }}
      viewport={
        <Stage3D fit={110} camera={[120, 120, 180]} target={[0, 15, 0]} env showViews={false}>
          <mesh position={[0, 3, 0]} castShadow receiveShadow>
            <boxGeometry args={[90, 6, 60]} />
            <meshStandardMaterial color="#577590" />
            <Edges color="#0b0f14" />
          </mesh>
          <mesh position={[0, 6.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[4, 24]} />
            <meshBasicMaterial color="#0b0f14" />
          </mesh>
          <Part target={pinT}>
            <mesh position={[0, -4, 0]} castShadow>
              <cylinderGeometry args={[4, 4, 12, 24]} />
              <meshStandardMaterial color="#e9edf2" metalness={1} roughness={0.25} />
            </mesh>
            <mesh position={[0, 3, 0]} castShadow>
              <cylinderGeometry args={[6, 6, 2, 24]} />
              <meshStandardMaterial color="#e9edf2" metalness={1} roughness={0.25} />
            </mesh>
            <mesh position={[0, 12, 0]} castShadow>
              <cylinderGeometry args={[3.5, 3.5, 16, 24]} />
              <meshStandardMaterial color="#e9edf2" metalness={1} roughness={0.25} />
            </mesh>
          </Part>
          <Part target={armT}>
            <group>
              <mesh position={[30, 0, 0]} castShadow>
                <boxGeometry args={[70, 5, 14]} />
                <meshStandardMaterial color="#f8961e" />
                <Edges color="#0b0f14" />
              </mesh>
              <mesh castShadow>
                <cylinderGeometry args={[8, 8, 5, 24]} />
                <meshStandardMaterial color="#f8961e" />
              </mesh>
            </group>
          </Part>
          <Label position={[-60, 80, 0]} color="#e9edf2">{`pin: ${pinDof} DOF`}</Label>
          <Label position={[60, 80, 0]} color="#f8961e">{`arm: ${armDof} DOF`}</Label>
        </Stage3D>
      }
    >
      <div className="lbl">Available mates (tap to apply)</div>
      <div className="grid" style={{ gap: 6 }}>
        {MATES.map((m) => (
          <button key={m.id} className={`btn small ${has(m.id) ? 'on' : ''}`} style={{ justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left', minHeight: 40 }} onClick={() => apply(m.id)}>
            {has(m.id) ? '✓ ' : ''}
            {m.label}
          </button>
        ))}
      </div>
      <Slider label="Swing the arm (only works with 1 DOF)" value={swing} min={-120} max={120} step={1} unit="°" onChange={setSwing} disabled={armDof !== 1} />
      <Task ok={pinDof === 0}>Pin: 0 DOF</Task>
      <Task ok={armDof === 1}>Arm: 1 DOF</Task>
      <Task ok={swung}>Arm swung through its joint</Task>
      <button className="btn small" onClick={() => setApplied(applied.slice(0, -1))} disabled={!applied.length}>
        ↶ Remove last mate
      </button>
    </LevelShell>
  );
}
