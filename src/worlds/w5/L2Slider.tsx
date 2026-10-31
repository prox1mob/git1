import { Edges } from '@react-three/drei';
import { useRef, useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { AxisHandle } from '../../components/three/AxisHandle';
import { Label } from '../../components/three/ObjectMesh';
import { Slider, Task } from '../../components/ui';
import { clamp, fmt } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

const DEPTH = 300;

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'A drawer slides on rails: it can only move in one straight line. That is a prismatic (sliding) joint — 1 degree of freedom, a translation.', ta: 'Drawer தண்டவாளங்களில் ஒரே நேர்கோட்டில் நழுவுகிறது — 1 DOF.' },
  { stage: 'TOUCH', text: 'Drag the orange handle on the drawer front to pull it out and push it back in.', ta: 'Drawer முன்பக்க ஆரஞ்சு கைப்பிடியை இழுங்கள்.' },
  { stage: 'UNDERSTAND', text: 'The stop decides the maximum travel. Too short and you cannot reach the back; too long and the drawer tips out because too little of it stays supported by the rails.', ta: 'Stop அதிகபட்ச நகர்வைத் தீர்மானிக்கிறது. அதிகமானால் drawer கவிழும்.' },
  { stage: 'BUILD', text: 'The 300 mm drawer must open at least 200 mm, but at least 80 mm of it must always stay on the rails. Set the stop, then test it by pulling the drawer fully open.', ta: '300 mm drawer குறைந்தது 200 mm திறக்க வேண்டும்; ஆனால் குறைந்தது 80 mm தண்டவாளத்தில் இருக்க வேண்டும்.' },
];

export default function L2Slider() {
  const [stop, setStop] = useState(280);
  const [pos, setPos] = useState(0);
  const [tested, setTested] = useState(false);
  const start = useRef(0);
  const x = clamp(pos, 0, stop);
  const engaged = DEPTH - x;
  const tips = engaged < 80;

  const evaluate = (): Feedback => {
    const checks: [boolean, string, string][] = [
      [stop >= 200, `Opens ${stop} mm (≥ 200 mm)`, `Only opens ${stop} mm — the back of the drawer is out of reach.`],
      [DEPTH - stop >= 80, `${DEPTH - stop} mm stays on the rails at full extension`, `At full extension only ${DEPTH - stop} mm stays on the rails — it will tip out.`],
      [tested, 'Tested by pulling the drawer to its stop', 'Pull the drawer all the way to the stop to test it.'],
    ];
    return {
      score: Math.round((checks.filter((c) => c[0]).length / 3) * 100),
      correct: checks.filter((c) => c[0]).map((c) => c[1]),
      issues: checks.filter((c) => !c[0]).map((c) => ({ label: c[2] })),
      why: 'Linear constraints appear in drawers, printer heads, syringes and camera zooms. Their travel limits balance access against support — and testing at the extremes is how designers find failures early.',
      suggestion: 'Any stop between 200 and 220 mm works. Pick one and pull the drawer to the end.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w5-l2"
      steps={steps}
      evaluate={evaluate}
      viewport={
        <Stage3D fit={220} camera={[380, 260, 380]} target={[0, 60, 120]} env showViews={false}>
          <mesh position={[0, 80, -150]}>
            <boxGeometry args={[220, 160, 6]} />
            <meshStandardMaterial color="#577590" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 108, 80, 0]}>
              <boxGeometry args={[6, 160, 300]} />
              <meshStandardMaterial color="#577590" transparent opacity={0.55} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={`r${s}`} position={[s * 100, 50, 0]}>
              <boxGeometry args={[6, 8, 300]} />
              <meshStandardMaterial color="#b7bcc4" metalness={1} roughness={0.3} />
            </mesh>
          ))}
          <group position={[0, tips ? 30 : 50, x]} rotation={[tips ? 0.25 : 0, 0, 0]}>
            <mesh position={[0, 20, 0]} castShadow>
              <boxGeometry args={[190, 60, DEPTH]} />
              <meshStandardMaterial color={tips ? '#f85149' : '#d8b779'} roughness={0.7} />
              <Edges color="#4a3a20" />
            </mesh>
            <mesh position={[0, 30, DEPTH / 2 + 4]}>
              <boxGeometry args={[210, 90, 8]} />
              <meshStandardMaterial color="#a9784a" />
            </mesh>
          </group>
          <AxisHandle position={[0, 70, DEPTH / 2 + x + 14]} dir={[0, 0, 1]} size={7} onStart={() => (start.current = x)} onDrag={(d) => { const v = clamp(Math.round(start.current + d), 0, 400); setPos(v); if (v >= stop) setTested(true); }} />
          <mesh position={[0, 46, -DEPTH / 2 + 300 - (300 - stop)]}>
            <boxGeometry args={[220, 4, 4]} />
            <meshStandardMaterial color="#f94144" />
          </mesh>
          <Label position={[0, 150, x + 150]} color={tips ? '#ff8a80' : '#e8eef4'}>
            {`open ${fmt(x)} mm · ${fmt(engaged)} mm on rails${tips ? ' — tips out!' : ''}`}
          </Label>
        </Stage3D>
      }
    >
      <Slider label="Stop position (maximum travel)" value={stop} min={100} max={300} step={5} unit="mm" onChange={(v) => { setStop(v); setTested(false); }} />
      <Slider label="Pull the drawer" value={pos} min={0} max={320} step={1} unit="mm" onChange={(v) => { setPos(v); if (v >= stop) setTested(true); }} />
      <Task ok={stop >= 200}>Opens at least 200 mm</Task>
      <Task ok={DEPTH - stop >= 80}>At least 80 mm stays on the rails</Task>
      <Task ok={tested}>Tested at full extension</Task>
    </LevelShell>
  );
}
