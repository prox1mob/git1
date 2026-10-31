import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { NumberField, Seg, Task } from '../../components/ui';
import { csgRaw } from '../../lib/shapes';
import { fmt } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

type Proc = 'fdm' | 'sla' | 'cnc';
const PROC: Record<Proc, { name: string; tol: number }> = {
  fdm: { name: 'FDM 3D printer', tol: 0.15 },
  sla: { name: 'Resin (SLA) printer', tol: 0.05 },
  cnc: { name: 'CNC machining', tol: 0.005 },
};

export function fit(hole: number, peg: number, tol: number) {
  const nominal = hole - peg;
  const min = nominal - 2 * tol; // hole printed small, peg printed big
  const max = nominal + 2 * tol;
  const kind = min > 0 ? 'clearance' : max < 0 ? 'interference' : 'transition';
  return { nominal, min, max, kind };
}

const TASKS: { name: string; text: string; proc: Proc; peg: number; check: (f: ReturnType<typeof fit>) => string | null }[] = [
  {
    name: 'Printed hinge pin',
    text: 'A Ø5.00 mm hinge pin must turn freely in its hole on an FDM printer (±0.15 mm). Design for a clearance fit with 0.05–0.40 mm worst-case clearance.',
    proc: 'fdm',
    peg: 5,
    check: (f) => (f.min < 0.05 ? `worst-case clearance ${fmt(f.min, 3)} mm — it may jam` : f.min > 0.4 ? `worst-case clearance ${fmt(f.min, 3)} mm — it will wobble` : null),
  },
  {
    name: 'Bearing press fit',
    text: 'A Ø8.000 mm steel shaft must be pressed into a CNC-machined aluminium hole (±0.005 mm) and stay put: interference of 0.01–0.03 mm in every case.',
    proc: 'cnc',
    peg: 8,
    check: (f) => (f.kind !== 'interference' ? 'not an interference fit in every case — it could slip' : -f.max < 0.01 ? `minimum interference ${fmt(-f.max, 3)} mm is too small` : -f.min > 0.03 ? `maximum interference ${fmt(-f.min, 3)} mm is too tight — it may crack the part` : null),
  },
];

function Assembly({ hole, peg, kind }: { hole: number; peg: number; kind: string }) {
  const block = useMemo(() => {
    const b = new THREE.BoxGeometry(30, 16, 30);
    b.translate(0, 8, 0);
    const h = new THREE.CylinderGeometry(hole / 2, hole / 2, 20, 48);
    h.translate(0, 8, 0);
    return csgRaw(b, [h], 'subtract');
  }, [hole]);
  const g = useRef<THREE.Group>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current = (t.current + dt / 3) % 1;
    const stopAt = kind === 'clearance' ? -1 : 16.5;
    const y = Math.max(stopAt, 40 - t.current * 60);
    if (g.current) g.current.position.y = y;
  });
  const scale = 4; // exaggerate the diameter difference visually
  const shown = hole + (peg - hole) * scale;
  return (
    <group>
      <mesh geometry={block} castShadow>
        <meshStandardMaterial color="#4cc9f0" roughness={0.5} transparent opacity={0.7} />
      </mesh>
      <group ref={g}>
        <mesh position={[0, 10, 0]} castShadow>
          <cylinderGeometry args={[Math.max(0.5, shown / 2), Math.max(0.5, shown / 2), 20, 48]} />
          <meshStandardMaterial color={kind === 'clearance' ? '#3fb950' : kind === 'interference' ? '#f85149' : '#e3b341'} metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'No machine makes parts exactly to size. A tolerance (±) says how far a real dimension may differ from the CAD number.', ta: 'எந்த இயந்திரமும் சரியான அளவில் செய்வதில்லை. Tolerance (±) எவ்வளவு மாறலாம் என்று சொல்கிறது.' },
  { stage: 'UNDERSTAND', text: 'Fits: CLEARANCE (always a gap — it slides), INTERFERENCE (always overlapping — pressed in), TRANSITION (could be either — unpredictable). Worst case: the hole comes out small and the peg big at the same time.', ta: 'Clearance = எப்போதும் இடைவெளி; Interference = எப்போதும் மேலொன்று; Transition = இரண்டில் ஒன்று.' },
  { stage: 'EXPERIMENT', text: 'Change the hole diameter and the process. Watch the peg drop in (green), jam (red) or maybe-jam (yellow). Differences are drawn 4× larger so you can see them.', ta: 'துளை விட்டத்தையும் செயல்முறையையும் மாற்றிப் பாருங்கள்.' },
  { stage: 'BUILD', text: 'Size the holes for both tasks and lock each in.', ta: 'இரு பணிகளுக்கும் துளைகளின் அளவை அமையுங்கள்.' },
];

export default function L3Tolerances() {
  const [task, setTask] = useState(0);
  const [hole, setHole] = useState<number[]>([5.1, 8.02]);
  const [proc, setProc] = useState<Proc[]>(['fdm', 'cnc']);
  const [locked, setLocked] = useState<(number | null)[]>([null, null]);
  const t = TASKS[task];
  const f = fit(hole[task], t.peg, PROC[proc[task]].tol);

  const evaluate = (): Feedback => {
    const correct: string[] = [];
    const issues: Feedback['issues'] = [];
    let s = 0;
    TASKS.forEach((tk, i) => {
      const l = locked[i];
      if (l == null) return issues.push({ label: `${tk.name}: not locked in.` });
      if (proc[i] !== tk.proc) return issues.push({ label: `${tk.name}: use the ${PROC[tk.proc].name} as stated in the brief.` });
      const e = tk.check(fit(l, tk.peg, PROC[tk.proc].tol));
      if (!e) {
        s++;
        correct.push(`${tk.name}: hole Ø${fmt(l, 3)} mm works in the worst case.`);
      } else issues.push({ label: `${tk.name}: ${e}.` });
    });
    return {
      score: Math.round((s / 2) * 100),
      correct,
      issues,
      why: 'Designing to nominal sizes is the most common reason printed and machined prototypes do not fit. Engineers design for the worst case of the process they will actually use.',
      suggestion: 'Hole = peg + wanted clearance + 2 × tolerance. For the press fit, the hole is SMALLER than the shaft.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w7-l3"
      steps={steps}
      evaluate={evaluate}
      hints={[{ en: 'FDM pin: worst-case clearance = hole − 5 − 0.30. For 0.05–0.40 you need a hole of 5.35–5.70 mm.', ta: 'FDM: துளை 5.35–5.70 mm.' }]}
      viewport={
        <Stage3D fit={50} camera={[50, 50, 70]} target={[0, 12, 0]} env showViews={false}>
          <Assembly hole={hole[task]} peg={t.peg} kind={f.kind} />
          <Label position={[0, 48, 0]} color={f.kind === 'clearance' ? '#3fb950' : f.kind === 'interference' ? '#ff8a80' : '#e3b341'}>
            {`${f.kind} fit`}
          </Label>
        </Stage3D>
      }
    >
      <div className="btnrow">
        {TASKS.map((tk, i) => (
          <button key={i} className={`btn small ${task === i ? 'on' : ''}`} onClick={() => setTask(i)}>
            {locked[i] != null ? '🔒 ' : ''}
            {tk.name}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 14 }}>{t.text}</p>
      <Seg value={proc[task]} onChange={(p) => setProc(proc.map((q, i) => (i === task ? p : q)))} options={(Object.keys(PROC) as Proc[]).map((k) => ({ v: k, label: `${PROC[k].name} ±${PROC[k].tol}` }))} />
      <div className="kv">
        <span>Peg / shaft Ø (given)</span>
        <span>{fmt(t.peg, 3)} mm</span>
      </div>
      <NumberField label="Hole Ø" value={hole[task]} digits={3} step={0.005} min={1} onChange={(v) => setHole(hole.map((h, i) => (i === task ? v : h)))} unit="mm" />
      <div className="kv">
        <span>Nominal clearance</span>
        <span>{fmt(f.nominal, 3)} mm</span>
        <span>Worst-case tightest</span>
        <span>{fmt(f.min, 3)} mm</span>
        <span>Worst-case loosest</span>
        <span>{fmt(f.max, 3)} mm</span>
        <span>Fit type</span>
        <span>{f.kind}</span>
      </div>
      <div className="formula">tightest = (hole − peg) − 2 × {PROC[proc[task]].tol}</div>
      <button className="btn small accent" onClick={() => { setLocked(locked.map((l, i) => (i === task ? hole[task] : l))); if (task === 0) setTask(1); }}>
        Lock in “{t.name}”
      </button>
      {TASKS.map((tk, i) => (
        <Task key={i} ok={locked[i] != null}>
          {tk.name}: {locked[i] != null ? `Ø${fmt(locked[i]!, 3)} mm` : 'not locked'}
        </Task>
      ))}
      <div className="note">Simplified ± model: real tolerances depend on the machine, material, orientation and size. Print a small test coupon before a real design.</div>
    </LevelShell>
  );
}
