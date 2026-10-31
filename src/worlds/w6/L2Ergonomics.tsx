import { useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { Seg, Slider, Task } from '../../components/ui';
import { fmt } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

/** Simplified adult hand dimensions (mm), rounded from published anthropometric surveys. */
const HANDS = {
  p5f: { name: '5th percentile (small adult)', length: 165, breadth: 69 },
  p50: { name: '50th percentile (average adult)', length: 185, breadth: 82 },
  p95m: { name: '95th percentile (large adult)', length: 205, breadth: 97 },
};
type HandId = keyof typeof HANDS;

export function gripFit(d: number, handLen: number) {
  const finger = handLen * 0.42; // index-to-little finger functional length, simplified
  const thumbReach = handLen * 0.3;
  const wrap = (Math.PI * d) / (finger + thumbReach); // fraction of circumference closed by fingers + thumb
  return { wrap, ok: wrap >= 0.75 && wrap <= 1.05, verdict: wrap > 1.05 ? 'too thick — fingers and thumb cannot close around it' : wrap < 0.75 ? 'too thin — fingers overlap, grip force is wasted' : 'comfortable power grip' };
}

function Hand({ d, len, breadth, handleLen }: { d: number; len: number; breadth: number; handleLen: number }) {
  const finger = len * 0.42;
  const R = d / 2 + 8;
  const arc = Math.min(Math.PI * 1.95, finger / R);
  const fingers = 4;
  const fw = breadth / fingers;
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[d / 2, d / 2, handleLen, 48]} />
        <meshStandardMaterial color="#f8961e" roughness={0.6} />
      </mesh>
      {Array.from({ length: fingers }, (_, i) => (
        <mesh key={i} position={[-breadth / 2 + fw * (i + 0.5), 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[R, 7.5, 12, 40, arc]} />
          <meshStandardMaterial color="#d8a47f" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, -len * 0.2, -R - 10]}>
        <boxGeometry args={[breadth, len * 0.5, 22]} />
        <meshStandardMaterial color="#d8a47f" roughness={0.7} />
      </mesh>
    </group>
  );
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Hands differ a lot: a large adult hand is about 25 % longer than a small one. A handle must work for most people, not just the designer.', ta: 'கைகள் பெரிதும் வேறுபடுகின்றன. கைப்பிடி பெரும்பாலானோருக்கு வேலை செய்ய வேண்டும்.' },
  { stage: 'EXPERIMENT', text: 'Switch between small, average and large hands. Change the handle diameter and watch how far the fingers wrap around it.', ta: 'சிறிய, சராசரி, பெரிய கைகளை மாற்றிப் பாருங்கள்.' },
  { stage: 'UNDERSTAND', text: 'Design for a range — commonly the 5th to 95th percentile. Diameter must suit the small hand (not too thick) and the large hand (not too thin); length must fit the widest palm plus clearance.', ta: '5 முதல் 95 வரையிலான சதவீதத்துக்கு வடிவமையுங்கள்.' },
  { stage: 'BUILD', text: 'Choose one handle diameter and length that give a comfortable grip for ALL three hands, with at least 10 mm of length to spare beyond the widest palm.', ta: 'மூன்று கைகளுக்கும் வசதியான ஒரே விட்டமும் நீளமும் தேர்ந்தெடுங்கள்.' },
];

export default function L2Ergonomics() {
  const [hand, setHand] = useState<HandId>('p50');
  const [d, setD] = useState(48);
  const [len, setLen] = useState(90);
  const h = HANDS[hand];
  const fits = (Object.keys(HANDS) as HandId[]).map((k) => ({ k, ...gripFit(d, HANDS[k].length) }));
  const lenOk = len >= HANDS.p95m.breadth + 10;

  const evaluate = (): Feedback => {
    const ok = fits.filter((f) => f.ok).length;
    return {
      score: Math.round((ok / 3) * 70 + (lenOk ? 30 : 0)),
      correct: [...fits.filter((f) => f.ok).map((f) => `${HANDS[f.k].name}: ${f.verdict}.`), ...(lenOk ? [`Length ${len} mm clears the 95th-percentile palm (${HANDS.p95m.breadth} mm).`] : [])],
      issues: [...fits.filter((f) => !f.ok).map((f) => ({ label: `${HANDS[f.k].name}: ${f.verdict}.`, detail: `wrap ${fmt(f.wrap * 100, 0)} % of the circumference` })), ...(lenOk ? [] : [{ label: `Length ${len} mm is shorter than the large palm + 10 mm (${HANDS.p95m.breadth + 10} mm).` }])],
      why: 'Ergonomics turns body data into dimensions. Designing for an “average” person fails most people; designing for a range (and testing with real hands) makes tools, handles and devices comfortable and safe.',
      suggestion: 'Find the diameter where both the small and the large hand turn green — here around 36–39 mm.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w6-l2"
      steps={steps}
      evaluate={evaluate}
      viewport={
        <Stage3D fit={120} camera={[150, 90, 160]} target={[0, 0, 0]} env showViews={false} grid={false}>
          <Hand d={d} len={h.length} breadth={h.breadth} handleLen={len} />
          <Label position={[0, d / 2 + 40, 0]} color={gripFit(d, h.length).ok ? '#3fb950' : '#ff8a80'}>
            {gripFit(d, h.length).verdict}
          </Label>
        </Stage3D>
      }
    >
      <Seg value={hand} onChange={setHand} options={[{ v: 'p5f', label: 'Small (P5)' }, { v: 'p50', label: 'Average (P50)' }, { v: 'p95m', label: 'Large (P95)' }]} />
      <div className="kv">
        <span>Hand length</span>
        <span>{h.length} mm</span>
        <span>Palm breadth</span>
        <span>{h.breadth} mm</span>
      </div>
      <Slider label="Handle diameter" value={d} min={15} max={70} step={1} unit="mm" onChange={setD} />
      <Slider label="Handle length" value={len} min={60} max={160} step={1} unit="mm" onChange={setLen} />
      {fits.map((f) => (
        <Task key={f.k} ok={f.ok}>
          {HANDS[f.k].name}: {f.verdict}
        </Task>
      ))}
      <Task ok={lenOk}>Length ≥ {HANDS.p95m.breadth + 10} mm</Task>
      <div className="note">Simplified model: rounded survey values and a geometric wrap estimate. Real ergonomic design also considers gloves, grip force, texture, shape of the cross-section and user testing.</div>
    </LevelShell>
  );
}
