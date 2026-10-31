import { useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Arrow3D, Label } from '../../components/three/ObjectMesh';
import { Slider, Task } from '../../components/ui';
import { fmt } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

const LEN = 1000; // mm
const LOAD_KG = 30;
const G = 9.81;

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'A lever is a rigid bar turning on a pivot (fulcrum). A 30 kg stone sits on the left end; you push down on the right end.', ta: 'நெம்புகோல் ஒரு சுழல்மையத்தில் திரும்பும் கம்பி. இடது முனையில் 30 kg கல்.' },
  { stage: 'EXPERIMENT', text: 'Move the pivot. Near the stone, a small push lifts it — but your end must travel much further. Move the pivot away and it becomes hard to push.', ta: 'சுழல்மையத்தை நகர்த்துங்கள். கல்லுக்கு அருகில் இருந்தால் குறைந்த விசை போதும் — ஆனால் உங்கள் முனை அதிக தூரம் நகர வேண்டும்.' },
  { stage: 'UNDERSTAND', text: 'Balance of torques: effort × effort arm = load × load arm. Mechanical advantage MA = effort arm ÷ load arm. You never get something for nothing: distance moved is divided by the same MA.', ta: 'விசை × விசைக் கை = சுமை × சுமைக் கை. MA = விசைக் கை ÷ சுமைக் கை.' },
  { stage: 'BUILD', text: 'Lift the 30 kg stone (294 N) with no more than 100 N of effort, AND make the stone rise at least 50 mm when your end moves down 300 mm.', ta: '100 N-க்கு மிகாத விசையில் 30 kg கல்லைத் தூக்குங்கள்; உங்கள் முனை 300 mm இறங்கும்போது கல் குறைந்தது 50 mm உயர வேண்டும்.' },
];

export default function L4Lever() {
  const [pivot, setPivot] = useState(500);
  const [push, setPush] = useState(0);
  const loadArm = pivot;
  const effortArm = LEN - pivot;
  const W = LOAD_KG * G;
  const need = (W * loadArm) / effortArm;
  const ma = effortArm / loadArm;
  const lifts = push >= need - 0.01;
  const rise = (300 * loadArm) / effortArm;
  const tilt = lifts ? Math.atan(Math.min(250, 300) / effortArm) * 0.6 : 0;

  const evaluate = (): Feedback => {
    const checks: [boolean, string, string][] = [
      [need <= 100, `Effort needed ${fmt(need, 1)} N ≤ 100 N`, `Effort needed is ${fmt(need, 1)} N — move the pivot closer to the stone.`],
      [rise >= 50, `Stone rises ${fmt(rise, 1)} mm for a 300 mm push`, `The stone only rises ${fmt(rise, 1)} mm — the pivot is too close to the stone.`],
      [lifts && push <= 100, 'You pushed hard enough to lift it', 'Use the effort slider to actually lift the stone (without exceeding 100 N).'],
    ];
    return {
      score: Math.round((checks.filter((c) => c[0]).length / 3) * 100),
      correct: checks.filter((c) => c[0]).map((c) => c[1]),
      issues: checks.filter((c) => !c[0]).map((c) => ({ label: c[2] })),
      why: 'Levers are everywhere in products: pliers, scissors, bottle openers, brake levers, door handles. Designers choose the pivot to balance comfortable force against how far a hand must move.',
      suggestion: 'The pivot must sit between 143 mm and 254 mm from the stone: use the formulas on the right to see why.',
      canShowCorrection: false,
    };
  };

  const x0 = -LEN / 2;
  const px = x0 + pivot;
  return (
    <LevelShell
      id="w5-l4"
      steps={steps}
      evaluate={evaluate}
      hints={[{ en: 'Effort ≤ 100 N needs effort arm ≥ 2.94 × load arm. Rise ≥ 50 mm needs load arm ≥ effort arm ÷ 6.', ta: 'விசைக் கை ≥ 2.94 × சுமைக் கை; சுமைக் கை ≥ விசைக் கை ÷ 6.' }]}
      viewport={
        <Stage3D fit={600} camera={[0, 300, 1300]} target={[0, 100, 0]} env showViews={false} gridSize={50}>
          <mesh position={[px, 50, 0]} castShadow>
            <coneGeometry args={[60, 100, 3]} />
            <meshStandardMaterial color="#577590" />
          </mesh>
          <group position={[px, 105, 0]} rotation={[0, 0, tilt]}>
            <mesh position={[LEN / 2 - pivot, 0, 0]} castShadow>
              <boxGeometry args={[LEN, 16, 60]} />
              <meshStandardMaterial color="#d8b779" />
            </mesh>
            <mesh position={[-pivot + 60, 58, 0]} castShadow>
              <dodecahedronGeometry args={[55]} />
              <meshStandardMaterial color="#8d9aa8" roughness={0.9} />
            </mesh>
            <Arrow3D from={[effortArm - 30, 160, 0]} to={[effortArm - 30, 15, 0]} color={lifts ? '#3fb950' : '#ffd166'} width={4} />
          </group>
          <Label position={[x0 + 60, 270, 0]}>{`30 kg = ${fmt(W, 0)} N`}</Label>
          <Label position={[x0 + LEN - 30, 300, 0]} color="#ffd166">{`push ${fmt(push, 0)} N`}</Label>
          <Label position={[px, -20, 0]} color="#9ff0ff">{`pivot ${pivot} mm from stone`}</Label>
        </Stage3D>
      }
    >
      <Slider label="Pivot distance from the stone" value={pivot} min={60} max={940} step={1} unit="mm" onChange={setPivot} />
      <Slider label="Your push (effort)" value={push} min={0} max={600} step={1} unit="N" onChange={setPush} />
      <div className="formula">load arm = {pivot} mm · effort arm = {effortArm} mm</div>
      <div className="formula">MA = {effortArm} ÷ {pivot} = {fmt(ma, 2)}</div>
      <div className="formula">effort needed = {fmt(W, 0)} ÷ {fmt(ma, 2)} = {fmt(need, 1)} N</div>
      <div className="formula">stone rises = 300 ÷ {fmt(ma, 2)} = {fmt(rise, 1)} mm</div>
      <div className="muted" style={{ fontSize: 12 }}>
        {lifts ? '✓ The stone lifts.' : `Push at least ${fmt(need, 0)} N to lift it.`} (100 N ≈ the weight of a 10 kg bag.)
      </div>
      <Task ok={need <= 100}>Effort ≤ 100 N</Task>
      <Task ok={rise >= 50}>Stone rises ≥ 50 mm</Task>
      <Task ok={lifts && push <= 100}>Stone lifted</Task>
      <div className="note">Simplified: rigid weightless lever, no friction. This is a first-class lever (pivot between load and effort); wheelbarrows are second-class, tweezers third-class.</div>
    </LevelShell>
  );
}
