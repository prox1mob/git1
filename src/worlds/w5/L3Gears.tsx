import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { Slider, Task, Toggle } from '../../components/ui';
import { gearGeom, gearOutline, meshAngle } from '../../lib/gears';
import { fmt } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

const M = 3; // module (mm)
const IDLER = 13;

function useGearGeo(z: number) {
  return useMemo(() => {
    const s = new THREE.Shape(gearOutline(z, M).map(([x, y]) => new THREE.Vector2(x, y)));
    const hole = new THREE.Path();
    hole.absarc(0, 0, Math.min(6, gearGeom(z, M).rf * 0.4), 0, Math.PI * 2, true);
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: 8, bevelEnabled: false, curveSegments: 16 });
    g.translate(0, 0, -4);
    g.computeVertexNormals();
    return g;
  }, [z]);
}

function Gear({ z, x, color, angleRef, idx, marker }: { z: number; x: number; color: string; angleRef: React.MutableRefObject<number[]>; idx: number; marker?: boolean }) {
  const geo = useGearGeo(z);
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.z = angleRef.current[idx];
  });
  const g = gearGeom(z, M);
  return (
    <group position={[x, 0, 0]}>
      <group ref={ref}>
        <mesh geometry={geo} castShadow>
          <meshStandardMaterial color={color} metalness={0.6} roughness={0.35} />
        </mesh>
        {marker && (
          <mesh position={[g.r * 0.6, 0, 4.5]}>
            <circleGeometry args={[3, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        )}
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -8]}>
        <cylinderGeometry args={[3, 3, 20, 12]} />
        <meshStandardMaterial color="#577590" />
      </mesh>
      <mesh position={[0, 0, 0.1]}>
        <ringGeometry args={[g.r - 0.25, g.r + 0.25, 96]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

function Driver({ angles, gears, rpm, running }: { angles: React.MutableRefObject<number[]>; gears: { z: number; theta0: number }[]; rpm: number; running: boolean }) {
  const t = useRef(0);
  useFrame((_, dt) => {
    if (running) t.current += Math.min(dt, 0.05) * ((rpm * 2 * Math.PI) / 60);
    const out: number[] = [gears[0].theta0 + t.current];
    for (let i = 1; i < gears.length; i++) out.push(gears[i].theta0 - (gears[i - 1].z / gears[i].z) * (out[i - 1] - gears[i - 1].theta0));
    angles.current = out;
  });
  return null;
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'These are real involute gears: each tooth flank is a mathematical curve, so the teeth roll smoothly against each other. The dashed yellow circles are the pitch circles — they roll without slipping.', ta: 'இவை உண்மையான involute பற்சக்கரங்கள். மஞ்சள் வட்டங்கள் pitch circles.' },
  { stage: 'EXPERIMENT', text: 'Change the tooth counts. Meshing gears turn in OPPOSITE directions. Speed ratio = teeth on output ÷ teeth on input.', ta: 'பற்களின் எண்ணிக்கையை மாற்றுங்கள். இணைந்த பற்சக்கரங்கள் எதிர்த் திசைகளில் சுழலும்.' },
  { stage: 'UNDERSTAND', text: 'More teeth on the output = slower but stronger (more torque). An idler gear in between reverses the direction again but does not change the overall ratio.', ta: 'வெளியீட்டில் அதிக பற்கள் = மெதுவாக, ஆனால் அதிக திருப்பு விசை. இடைநிலை (idler) பற்சக்கரம் திசையை மாற்றும், விகிதத்தை அல்ல.' },
  { stage: 'BUILD', text: 'Challenge: make the output (orange) turn exactly 3× slower than the input (blue), in the SAME direction.', ta: 'சவால்: வெளியீடு உள்ளீட்டை விட 3 மடங்கு மெதுவாக, அதே திசையில் சுழல வேண்டும்.' },
];

export default function L3Gears() {
  const [z1, setZ1] = useState(12);
  const [z2, setZ2] = useState(24);
  const [idler, setIdler] = useState(false);
  const [rpm, setRpm] = useState(20);
  const [running, setRunning] = useState(true);
  const angles = useRef<number[]>([0, 0, 0]);
  const g1 = gearGeom(z1, M),
    g2 = gearGeom(z2, M),
    gi = gearGeom(IDLER, M);
  const chain = idler ? [z1, IDLER, z2] : [z1, z2];
  const xs = idler ? [0, g1.r + gi.r, g1.r + 2 * gi.r + g2.r] : [0, g1.r + g2.r];
  const gears = useMemo(() => {
    const out: { z: number; theta0: number }[] = [{ z: chain[0], theta0: 0 }];
    for (let i = 1; i < chain.length; i++) out.push({ z: chain[i], theta0: meshAngle(0, out[i - 1].theta0, chain[i - 1], chain[i]) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z1, z2, idler]);
  const ratio = z2 / z1;
  const same = idler;
  const cx = xs[xs.length - 1] / 2;

  const evaluate = (): Feedback => {
    const rOk = Math.abs(ratio - 3) < 0.01;
    return {
      score: (rOk ? 60 : Math.max(0, 40 - Math.abs(ratio - 3) * 20)) + (same ? 40 : 0),
      correct: [rOk ? `Ratio ${z2}:${z1} = 3 : 1 — the output turns at ${fmt(rpm / 3, 1)} rpm.` : '', same ? 'An idler gear makes the output turn the same way as the input.' : ''].filter(Boolean),
      issues: [...(rOk ? [] : [{ label: `Ratio is ${fmt(ratio, 2)} : 1, needs 3 : 1.`, detail: `Output teeth = 3 × input teeth (e.g. ${z1} → ${z1 * 3}).` }]), ...(same ? [] : [{ label: 'The output turns the opposite way.', detail: 'Two meshing gears always reverse direction. Add an idler gear.' }])],
      why: 'Gear ratios trade speed for torque: clocks, bicycles, drills and robot joints all use them. Direction matters too — a wrong direction can drive a mechanism into its end stop.',
      suggestion: rOk ? 'Turn on the idler and watch the white markers: input and output now turn the same way.' : 'Use 12 and 36 teeth, or 15 and 45.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w5-l3"
      steps={steps}
      evaluate={evaluate}
      hints={[{ en: 'Centre distance = module × (z1 + z2) ÷ 2: gears with the same module always fit.', ta: 'மைய தூரம் = module × (z1 + z2) ÷ 2.' }]}
      viewport={
        <Stage3D fit={Math.max(80, xs[xs.length - 1] * 0.7)} camera={[cx, 30, Math.max(180, xs[xs.length - 1] * 1.5)]} target={[cx, 0, 0]} grid={false} shadows={false} env showViews={false}>
          <Driver angles={angles} gears={gears} rpm={rpm} running={running} />
          {gears.map((g, i) => (
            <Gear key={`${i}-${g.z}-${idler}`} z={g.z} x={xs[i]} idx={i} angleRef={angles} color={i === 0 ? '#4cc9f0' : i === gears.length - 1 ? '#f8961e' : '#b7bcc4'} marker={i === 0 || i === gears.length - 1} />
          ))}
          <Label position={[0, -g1.ra - 10, 0]} color="#4cc9f0">{`input ${z1}T · ${rpm} rpm ↺`}</Label>
          <Label position={[xs[xs.length - 1], -g2.ra - 10, 0]} color="#f8961e">{`output ${z2}T · ${fmt(rpm / ratio, 1)} rpm ${same ? '↺' : '↻'}`}</Label>
          {idler && <Label position={[xs[1], gi.ra + 10, 0]} color="#b7bcc4">{`idler ${IDLER}T`}</Label>}
        </Stage3D>
      }
    >
      <Slider label="Input gear teeth (blue)" value={z1} min={8} max={30} step={1} onChange={setZ1} />
      <Slider label="Output gear teeth (orange)" value={z2} min={8} max={90} step={1} onChange={setZ2} />
      <Toggle checked={idler} onChange={setIdler} label={`Idler gear in between (${IDLER} teeth)`} />
      <Slider label="Input speed" value={rpm} min={1} max={60} step={1} unit="rpm" onChange={setRpm} />
      <button className="btn small" onClick={() => setRunning(!running)}>
        {running ? '⏸ Pause' : '▶ Run'}
      </button>
      <div className="formula">ratio = {z2} ÷ {z1} = {fmt(ratio, 3)} : 1</div>
      <div className="formula">output speed = {rpm} ÷ {fmt(ratio, 3)} = {fmt(rpm / ratio, 2)} rpm</div>
      <div className="formula">torque × {fmt(ratio, 2)} (ignoring friction)</div>
      <div className="kv">
        <span>Module</span>
        <span>{M} mm</span>
        <span>Centre distance</span>
        <span>{fmt(g1.r + g2.r + (idler ? 2 * gi.r : 0), 1)} mm</span>
        <span>Direction</span>
        <span>{same ? 'same as input' : 'reversed'}</span>
      </div>
      <Task ok={Math.abs(ratio - 3) < 0.01}>3 : 1 reduction</Task>
      <Task ok={same}>Same direction as the input</Task>
    </LevelShell>
  );
}
