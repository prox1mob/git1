import { Edges } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Task } from '../../components/ui';
import type { Feedback, LessonStep } from '../../lib/types';

type Method = 'print' | 'mould' | 'cnc' | 'sheet' | 'cast';
const METHODS: { id: Method; name: string; setup: string; unit: string; volume: string; materials: string; freedom: string; accuracy: string; note: string }[] = [
  { id: 'print', name: '3D printing', setup: 'None', unit: 'Medium–high', volume: '1–1 000', materials: 'Plastics, resins, some metals', freedom: 'Very high (internal channels, lattices)', accuracy: '±0.05–0.3 mm', note: 'Builds layer by layer from a digital file. Perfect for prototypes and one-offs.' },
  { id: 'mould', name: 'Injection moulding', setup: 'Very high (steel mould €5k–100k)', unit: 'Very low', volume: '10 000 – millions', materials: 'Thermoplastics, rubber', freedom: 'Medium (needs draft, even walls, no undercuts without extra cost)', accuracy: '±0.05–0.1 mm', note: 'Molten plastic is injected into a mould: seconds per part once the tool exists.' },
  { id: 'cnc', name: 'CNC machining', setup: 'Low–medium (programming, fixtures)', unit: 'Medium–high', volume: '1–10 000', materials: 'Metals, plastics, wood', freedom: 'Medium (tools must reach every surface; inside corners are rounded)', accuracy: '±0.005–0.05 mm', note: 'A spinning cutter removes material from a solid block. Very precise and strong.' },
  { id: 'sheet', name: 'Sheet-metal fabrication', setup: 'Low–medium', unit: 'Low', volume: '10 – 100 000', materials: 'Steel, aluminium, stainless sheet', freedom: 'Low (flat patterns, bends, constant thickness)', accuracy: '±0.1–0.5 mm', note: 'Flat sheet is laser-cut, punched and bent: enclosures, brackets, chassis.' },
  { id: 'cast', name: 'Casting', setup: 'Medium (patterns / dies)', unit: 'Low–medium', volume: '10 – 100 000+', materials: 'Aluminium, iron, bronze, zinc', freedom: 'High (complex 3D shapes, but needs draft and machining of key faces)', accuracy: '±0.2–1 mm', note: 'Molten metal poured into a mould: engine blocks, taps, sculptures.' },
];

const QUIZ: { q: string; best: Method[]; ok: Method[]; why: string }[] = [
  { q: 'Five custom brackets to test fit on a robot this week.', best: ['print'], ok: ['cnc'], why: 'No tooling, fast turnaround. CNC also works if they must be metal.' },
  { q: '500 000 plastic toothbrush handles per year.', best: ['mould'], ok: [], why: 'The mould cost is spread over huge volumes, making each part cents.' },
  { q: 'A precise aluminium camera mount, 50 pieces, tight tolerances.', best: ['cnc'], ok: ['cast'], why: 'Machining gives tight tolerances on metal at low volume without expensive tooling.' },
  { q: 'Steel enclosure for an industrial power supply, 2 000 units.', best: ['sheet'], ok: ['cnc'], why: 'Folded sheet steel makes strong, cheap boxes with flat walls.' },
  { q: '10 000 aluminium bike-brake lever bodies with organic 3D shapes.', best: ['cast'], ok: ['cnc', 'mould'], why: 'Die casting reproduces complex metal shapes cheaply at volume; key surfaces are then machined.' },
];

function Demo({ m }: { m: Method }) {
  const g = useRef<THREE.Group>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (g.current) g.current.userData.t = t.current;
  });
  const [, force] = useState(0);
  useFrame(() => force((n) => (n + 1) % 1000));
  const k = (t.current % 4) / 4;
  if (m === 'print') {
    const layers = Math.floor(k * 30);
    return (
      <group ref={g}>
        {Array.from({ length: layers }, (_, i) => (
          <mesh key={i} position={[0, i * 2 + 1, 0]}>
            <cylinderGeometry args={[25 - i * 0.4, 25 - i * 0.4, 1.8, 40]} />
            <meshStandardMaterial color="#f8961e" />
          </mesh>
        ))}
        <mesh position={[30 * Math.cos(t.current * 6), layers * 2 + 12, 30 * Math.sin(t.current * 6) * 0.3]}>
          <coneGeometry args={[4, 10, 12]} />
          <meshStandardMaterial color="#b7bcc4" metalness={1} />
        </mesh>
      </group>
    );
  }
  if (m === 'mould') {
    const open = Math.max(0, Math.sin(k * Math.PI * 2)) * 30;
    return (
      <group ref={g}>
        <mesh position={[-25 - open, 25, 0]}>
          <boxGeometry args={[50, 50, 50]} />
          <meshStandardMaterial color="#577590" metalness={0.8} roughness={0.3} />
          <Edges />
        </mesh>
        <mesh position={[25 + open, 25, 0]}>
          <boxGeometry args={[50, 50, 50]} />
          <meshStandardMaterial color="#577590" metalness={0.8} roughness={0.3} />
          <Edges />
        </mesh>
        {open > 20 && (
          <mesh position={[0, 25, 0]}>
            <torusGeometry args={[10, 4, 16, 32]} />
            <meshStandardMaterial color="#f94144" />
          </mesh>
        )}
      </group>
    );
  }
  if (m === 'cnc') {
    return (
      <group ref={g}>
        <mesh position={[0, 15, 0]}>
          <boxGeometry args={[70, 30, 50]} />
          <meshStandardMaterial color="#c9ced6" metalness={1} roughness={0.35} />
        </mesh>
        <mesh position={[-30 + k * 60, 45, 0]}>
          <cylinderGeometry args={[4, 4, 30, 16]} />
          <meshStandardMaterial color="#ffd166" metalness={1} roughness={0.2} />
        </mesh>
      </group>
    );
  }
  if (m === 'sheet') {
    const bend = Math.min(1, k * 1.5) * (Math.PI / 2);
    return (
      <group ref={g}>
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[60, 2, 50]} />
          <meshStandardMaterial color="#b7bcc4" metalness={1} roughness={0.3} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 30, 1, 0]} rotation={[0, 0, s * bend]}>
            <mesh position={[s * 15, 0, 0]}>
              <boxGeometry args={[30, 2, 50]} />
              <meshStandardMaterial color="#b7bcc4" metalness={1} roughness={0.3} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  return (
    <group ref={g}>
      <mesh position={[0, 20, 0]}>
        <boxGeometry args={[70, 40, 50]} />
        <meshStandardMaterial color="#b5838d" roughness={1} transparent opacity={0.45} />
      </mesh>
      <mesh position={[0, 20, 0]} scale={[1, Math.min(1, k * 1.4), 1]}>
        <sphereGeometry args={[14, 24, 16]} />
        <meshStandardMaterial color="#ff7b00" emissive="#ff4400" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Tap each method to see how it makes parts. The table compares setup cost, cost per part, volumes, materials, design freedom and accuracy.', ta: 'ஒவ்வொரு முறையையும் தட்டிப் பாருங்கள்.' },
  { stage: 'UNDERSTAND', text: 'The key trade-off: methods with expensive tooling (moulds, dies) make each part cheap at high volume; tool-free methods (printing, CNC) suit prototypes and small batches.', ta: 'விலையுயர்ந்த அச்சுகள் அதிக அளவில் ஒவ்வொரு பாகத்தையும் மலிவாக்கும்; அச்சில்லா முறைகள் முன்மாதிரிகளுக்கு ஏற்றவை.' },
  { stage: 'TEST', text: 'Choose the best manufacturing method for each of the five scenarios.', ta: 'ஐந்து சூழல்களுக்கும் சிறந்த உற்பத்தி முறையைத் தேர்ந்தெடுங்கள்.' },
];

export default function L1Methods() {
  const [m, setM] = useState<Method>('print');
  const [ans, setAns] = useState<(Method | null)[]>(QUIZ.map(() => null));
  const info = METHODS.find((x) => x.id === m)!;

  const evaluate = (): Feedback | string => {
    if (ans.some((a) => !a)) return `Answer all five scenarios (${ans.filter(Boolean).length}/5).`;
    const rubric = QUIZ.map((q, i) => ({ criterion: q.q, points: q.best.includes(ans[i]!) ? 10 : q.ok.includes(ans[i]!) ? 5 : 0, max: 10, note: `you chose ${METHODS.find((x) => x.id === ans[i])!.name} · ${q.why}` }));
    return {
      score: Math.round((rubric.reduce((s, r) => s + r.points, 0) / 50) * 100),
      correct: QUIZ.filter((q, i) => q.best.includes(ans[i]!)).map((q) => q.q),
      issues: QUIZ.flatMap((q, i) => (q.best.includes(ans[i]!) ? [] : [{ label: q.q, detail: `Best: ${q.best.map((b) => METHODS.find((x) => x.id === b)!.name).join(' or ')}. ${q.why}` }])),
      why: 'The same CAD model can cost €2 or €200 depending on how it is made — and some shapes are only possible with some processes. Choosing the process early shapes the whole design.',
      suggestion: 'Ask two questions first: how many parts, and what material? That usually narrows it to one or two methods.',
      rubric,
    };
  };

  return (
    <LevelShell
      id="w7-l1"
      steps={steps}
      evaluate={evaluate}
      viewport={
        <Stage3D fit={90} camera={[90, 80, 140]} target={[0, 20, 0]} env showViews={false}>
          <Demo m={m} />
        </Stage3D>
      }
    >
      <div className="btnrow">
        {METHODS.map((x) => (
          <button key={x.id} className={`btn small ${m === x.id ? 'on' : ''}`} onClick={() => setM(x.id)}>
            {x.name}
          </button>
        ))}
      </div>
      <div className="card" style={{ padding: 10 }}>
        <b>{info.name}</b>
        <p className="muted" style={{ fontSize: 13 }}>
          {info.note}
        </p>
        <div className="kv">
          <span>Setup / tooling</span>
          <span>{info.setup}</span>
          <span>Cost per part</span>
          <span>{info.unit}</span>
          <span>Typical quantity</span>
          <span>{info.volume}</span>
          <span>Materials</span>
          <span>{info.materials}</span>
          <span>Shape freedom</span>
          <span>{info.freedom}</span>
          <span>Accuracy</span>
          <span>{info.accuracy}</span>
        </div>
      </div>
      {QUIZ.map((q, i) => (
        <div key={i} className="card" style={{ padding: 8 }}>
          <div style={{ fontSize: 14, marginBottom: 4 }}>
            {i + 1}. {q.q}
          </div>
          <select value={ans[i] ?? ''} onChange={(e) => setAns(ans.map((a, k) => (k === i ? (e.target.value as Method) : a)))}>
            <option value="" disabled>
              Choose a method…
            </option>
            {METHODS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
      ))}
      <Task ok={ans.every(Boolean)}>All scenarios answered</Task>
    </LevelShell>
  );
}
