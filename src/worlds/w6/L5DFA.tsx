import { Edges } from '@react-three/drei';
import { useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { Seg, Task, Toggle } from '../../components/ui';
import type { Feedback, LessonStep, Vec3 } from '../../lib/types';

interface Step {
  id: string;
  name: string;
  secs: number;
  pos: Vec3;
  size: Vec3;
  color: string;
  dfa: boolean; // present in the improved design
  orig: boolean; // present in the original design
}
const PARTS: Step[] = [
  { id: 'base', name: 'Base housing', secs: 3, pos: [0, 6, 0], size: [90, 12, 60], color: '#577590', dfa: true, orig: true },
  { id: 'pcb', name: 'Circuit board', secs: 4, pos: [0, 14, 0], size: [70, 2, 45], color: '#2e7d32', dfa: true, orig: true },
  { id: 'pcbscrews', name: '4 × PCB screws', secs: 32, pos: [0, 17, 0], size: [66, 3, 41], color: '#e9edf2', dfa: false, orig: true },
  { id: 'lid', name: 'Lid', secs: 3, pos: [0, 24, 0], size: [90, 4, 60], color: '#4cc9f0', dfa: true, orig: true },
  { id: 'lidscrews', name: '6 × lid screws', secs: 48, pos: [0, 28, 0], size: [86, 3, 56], color: '#e9edf2', dfa: false, orig: true },
];
const ORDER = ['base', 'pcb', 'pcbscrews', 'lid', 'lidscrews'];

const IDEAS: { text: string; good: boolean; why: string }[] = [
  { text: 'Replace the PCB screws with moulded snap clips', good: true, why: 'Removes 4 parts and ~30 s; clips are moulded into the base for free.' },
  { text: 'Replace the 6 lid screws with snap-fits (plus 1 screw for servicing)', good: true, why: 'Fewer parts and tools; one screw keeps it tamper-resistant.' },
  { text: 'Make the lid symmetric or add a key so it cannot go on backwards', good: true, why: 'Poka-yoke: mistakes become impossible.' },
  { text: 'Add chamfers to guide the lid into place', good: true, why: 'Self-locating parts assemble faster and more reliably.' },
  { text: 'Use five different screw lengths so each is “optimised”', good: false, why: 'More part types, more mistakes. Standardise fasteners.' },
  { text: 'Assemble from several directions (top, bottom and sides)', good: false, why: 'Re-orienting the product wastes time; prefer top-down assembly.' },
];

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'This electronics box is assembled by hand. Each part placed and each screw driven costs seconds — and every second is paid for on every single unit.', ta: 'ஒவ்வொரு பாகமும், ஒவ்வொரு திருகும் நேரம் எடுக்கும் — ஒவ்வொரு அலகிலும்.' },
  { stage: 'EXPERIMENT', text: 'Assemble the original design: tap the parts in the correct order. Watch the total time.', ta: 'சரியான வரிசையில் பாகங்களைத் தட்டி இணையுங்கள்.' },
  { stage: 'UNDERSTAND', text: 'Design for Assembly (DFA): fewer parts, standard fasteners, snap-fits, top-down assembly, self-locating features and designs that cannot be assembled wrongly.', ta: 'DFA: குறைந்த பாகங்கள், snap-fit, மேலிருந்து கீழ் இணைப்பு, தவறாக இணைக்க முடியாத வடிவமைப்பு.' },
  { stage: 'BUILD', text: 'Then pick the DFA improvements that genuinely help, and compare the improved assembly time.', ta: 'உண்மையில் உதவும் DFA மேம்பாடுகளைத் தேர்ந்தெடுங்கள்.' },
];

export default function L5DFA() {
  const [design, setDesign] = useState<'orig' | 'dfa'>('orig');
  const [seq, setSeq] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [ideas, setIdeas] = useState<boolean[]>(IDEAS.map(() => false));
  const parts = PARTS.filter((p) => (design === 'orig' ? p.orig : p.dfa));
  const order = ORDER.filter((id) => parts.some((p) => p.id === id));
  const done = seq.length === order.length;
  const total = parts.reduce((s, p) => s + p.secs, 0);
  const origTotal = PARTS.filter((p) => p.orig).reduce((s, p) => s + p.secs, 0);
  const dfaTotal = PARTS.filter((p) => p.dfa).reduce((s, p) => s + p.secs, 0) + 8 + 6;

  const tap = (id: string) => {
    if (seq.includes(id)) return;
    if (order[seq.length] === id) setSeq([...seq, id]);
    else setMistakes(mistakes + 1);
  };

  const evaluate = (): Feedback => {
    const ideaOk = IDEAS.filter((d, i) => d.good === ideas[i]).length;
    const rubric = [
      { criterion: 'Assembled in the correct order', points: done ? Math.max(0, 40 - mistakes * 5) : 0, max: 40, note: `${mistakes} wrong tap(s)` },
      { criterion: 'Chose the DFA improvements that help (and rejected those that do not)', points: (ideaOk / IDEAS.length) * 60, max: 60, note: `${ideaOk}/${IDEAS.length} judged correctly` },
    ];
    return {
      score: Math.round(rubric.reduce((s, r) => s + r.points, 0)),
      correct: IDEAS.filter((d, i) => d.good === ideas[i]).map((d) => `${d.good ? 'Kept' : 'Rejected'}: ${d.text}`),
      issues: IDEAS.flatMap((d, i) => (d.good === ideas[i] ? [] : [{ label: `${d.good ? 'Missed' : 'Wrongly chose'}: ${d.text}`, detail: d.why }])),
      why: `Assembly cost repeats on every unit: cutting ${origTotal - dfaTotal} s from a product made 100 000 times saves over ${Math.round(((origTotal - dfaTotal) * 100000) / 3600)} hours of work. DFA also reduces errors and warranty returns.`,
      suggestion: 'Count fasteners on any product around you: each one is a DFA question.',
      rubric,
    };
  };

  return (
    <LevelShell
      id="w6-l5"
      steps={steps}
      evaluate={evaluate}
      viewport={
        <Stage3D fit={90} camera={[90, 100, 130]} target={[0, 15, 0]} env showViews={false}>
          {parts.map((p) => {
            const placed = seq.includes(p.id) || design === 'dfa';
            const isScrews = p.id.includes('screws');
            return (
              <group key={p.id} position={placed ? p.pos : [p.pos[0] + 110, p.pos[1] + 20, p.pos[2]]} onClick={(e) => { e.stopPropagation(); if (design === 'orig') tap(p.id); }}>
                {isScrews ? (
                  [-1, 1].flatMap((sx) =>
                    [-1, 0, 1].slice(p.id === 'pcbscrews' ? 1 : 0).map((sz) => (
                      <mesh key={`${sx}${sz}`} position={[(sx * p.size[0]) / 2, 0, sz * (p.size[2] / 2) * (p.id === 'pcbscrews' ? 1 : 1)]}>
                        <cylinderGeometry args={[2, 2, 8, 12]} />
                        <meshStandardMaterial color={p.color} metalness={1} roughness={0.3} />
                      </mesh>
                    )),
                  )
                ) : (
                  <mesh castShadow>
                    <boxGeometry args={p.size} />
                    <meshStandardMaterial color={p.color} transparent opacity={p.id === 'lid' ? 0.75 : 1} />
                    <Edges color="#0b0f14" />
                  </mesh>
                )}
              </group>
            );
          })}
          <Label position={[0, 50, 0]}>{`${design === 'orig' ? 'Original' : 'Improved (DFA)'}: ${design === 'orig' ? total : dfaTotal} s per unit`}</Label>
        </Stage3D>
      }
    >
      <Seg value={design} onChange={setDesign} options={[{ v: 'orig', label: 'Original design' }, { v: 'dfa', label: 'Improved design' }]} />
      {design === 'orig' ? (
        <>
          <div className="lbl">Tap the parts in assembly order (in 3D or here)</div>
          <div className="btnrow">
            {PARTS.filter((p) => p.orig).map((p) => (
              <button key={p.id} className={`btn small ${seq.includes(p.id) ? 'on' : ''}`} onClick={() => tap(p.id)}>
                {p.name} · {p.secs}s
              </button>
            ))}
          </div>
          <Task ok={done}>Assembled ({seq.length}/{order.length}) · {mistakes} mistake(s)</Task>
          <button className="btn small" onClick={() => { setSeq([]); setMistakes(0); }}>↺ Restart assembly</button>
        </>
      ) : (
        <div className="note">Improved design: PCB clips and lid snap-fits are moulded in; one service screw remains. Estimated {dfaTotal} s instead of {origTotal} s.</div>
      )}
      <div className="lbl">Which changes improve assembly?</div>
      {IDEAS.map((d, i) => (
        <Toggle key={i} checked={ideas[i]} onChange={(v) => setIdeas(ideas.map((x, k) => (k === i ? v : x)))} label={d.text} />
      ))}
    </LevelShell>
  );
}
