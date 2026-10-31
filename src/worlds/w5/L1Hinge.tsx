import { useState } from 'react';
import { Edges } from '@react-three/drei';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { Slider, Task } from '../../components/ui';
import { DEG, clamp } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'A hinge lets one part rotate about a fixed axis — the laptop screen turns around the pin at the back edge.', ta: 'கீல் ஒரு பாகத்தை நிலையான அச்சைச் சுற்றிச் சுழல அனுமதிக்கிறது.' },
  { stage: 'UNDERSTAND', text: 'A free body has 6 degrees of freedom (3 moves + 3 turns). A hinge removes 5 and leaves exactly 1: rotation about the hinge axis.', ta: 'சுதந்திரப் பொருளுக்கு 6 DOF. கீல் 5-ஐ நீக்கி 1 சுழற்சியை மட்டும் விடுகிறது.' },
  { stage: 'EXPERIMENT', text: 'Drag “Open the screen”. Then change the limits: real hinges have mechanical stops so the screen cannot fold backwards or crash into the keyboard.', ta: 'திரையைத் திறந்து பாருங்கள். பிறகு வரம்புகளை மாற்றுங்கள்.' },
  { stage: 'BUILD', text: 'Set the hinge limits to 0° (closed) and 135° (fully open), then open the screen to a comfortable 110° typing angle.', ta: 'வரம்புகளை 0° மற்றும் 135° ஆக அமைத்து, திரையை 110°-க்குத் திறங்கள்.' },
];

export default function L1Hinge() {
  const [lo, setLo] = useState(-20);
  const [hi, setHi] = useState(180);
  const [angle, setAngle] = useState(30);
  const a = clamp(angle, lo, hi);
  const atStop = angle !== a;

  const evaluate = (): Feedback => {
    const checks: [boolean, string, string][] = [
      [Math.abs(lo) <= 2, 'Closed stop at 0°', `Lower limit is ${lo}°: ${lo < 0 ? 'the screen could crush into the keyboard' : 'the lid would not close fully'}.`],
      [Math.abs(hi - 135) <= 3, 'Open stop at 135°', `Upper limit is ${hi}°, target 135°.`],
      [Math.abs(a - 110) <= 3, 'Screen at a 110° typing angle', `Screen is at ${a}°.`],
    ];
    return {
      score: Math.round((checks.filter((c) => c[0]).length / 3) * 100),
      correct: checks.filter((c) => c[0]).map((c) => c[1]),
      issues: checks.filter((c) => !c[0]).map((c) => ({ label: c[2] })),
      why: 'Joint limits protect products and people: they stop cables being torn, screens being bent backwards and fingers being pinched. Every hinge in a product needs a deliberate range of motion.',
      suggestion: 'Set the limits first, then try to drag beyond them — the screen should stop exactly at the ends.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w5-l1"
      steps={steps}
      evaluate={evaluate}
      viewport={
        <Stage3D fit={140} camera={[220, 160, 220]} target={[0, 40, 0]} env showViews={false}>
          <mesh position={[0, 4, 0]} castShadow>
            <boxGeometry args={[300, 8, 200]} />
            <meshStandardMaterial color="#b7bcc4" metalness={0.8} roughness={0.35} />
            <Edges color="#0b0f14" />
          </mesh>
          <mesh position={[0, 8.2, 20]}>
            <boxGeometry args={[260, 0.5, 100]} />
            <meshStandardMaterial color="#1e2126" />
          </mesh>
          <mesh position={[0, 8, -100]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[4, 4, 280, 20]} />
            <meshStandardMaterial color="#f8961e" />
          </mesh>
          <group position={[0, 8, -100]} rotation={[-a * DEG, 0, 0]}>
            <mesh position={[0, 3, 100]} castShadow>
              <boxGeometry args={[300, 6, 200]} />
              <meshStandardMaterial color={atStop ? '#f85149' : '#c9ced6'} metalness={0.8} roughness={0.3} />
              <Edges color="#0b0f14" />
            </mesh>
            <mesh position={[0, 6.2, 100]}>
              <boxGeometry args={[280, 0.5, 180]} />
              <meshStandardMaterial color="#123047" emissive="#1f6f8f" emissiveIntensity={0.4} />
            </mesh>
          </group>
          <Label position={[160, 20, -100]} color="#f8961e">
            hinge axis (1 DOF)
          </Label>
          <Label position={[0, 140, -100]} color={atStop ? '#ff8a80' : '#e8eef4'}>
            {`${a}°${atStop ? ' — stopped by the limit' : ''}`}
          </Label>
        </Stage3D>
      }
    >
      <Slider label="Open the screen" value={angle} min={-40} max={200} step={1} unit="°" onChange={setAngle} />
      <Slider label="Lower limit (closed stop)" value={lo} min={-40} max={60} step={1} unit="°" onChange={(v) => setLo(Math.min(v, hi - 5))} />
      <Slider label="Upper limit (open stop)" value={hi} min={60} max={200} step={1} unit="°" onChange={(v) => setHi(Math.max(v, lo + 5))} />
      <Task ok={Math.abs(lo) <= 2}>Lower limit 0°</Task>
      <Task ok={Math.abs(hi - 135) <= 3}>Upper limit 135°</Task>
      <Task ok={Math.abs(a - 110) <= 3}>Screen at 110°</Task>
      <div className="note">Simplified kinematic model: angle limits only. Real hinges also need friction (so the screen stays where you leave it) — a torque you would specify in N·m.</div>
    </LevelShell>
  );
}
