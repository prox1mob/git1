import { Edges } from '@react-three/drei';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D, type ViewName } from '../../components/Stage3D';
import { AxisHandle } from '../../components/three/AxisHandle';
import { DimensionLines, Label } from '../../components/three/ObjectMesh';
import { NumberField, Seg, Task } from '../../components/ui';
import { fmt, fromUnit, relTol, toUnit, type LengthUnit } from '../../lib/math';
import { useSettings } from '../../store/progress';
import type { Feedback, LessonStep, Vec3 } from '../../lib/types';

interface Goal {
  text: string;
  ta: string;
  target: Vec3; // mm W,H,D
}
const GOALS: Goal[] = [
  { text: 'Make the parcel 12 cm wide (X), 45 mm tall (Y) and 0.08 m deep (Z).', ta: 'பார்சலை 12 cm அகலம், 45 mm உயரம், 0.08 m ஆழம் ஆக்குங்கள்.', target: [120, 45, 80] },
  { text: 'A phone is 6.1 in long (X), 0.3 in thick (Y) and 2.8 in wide (Z). Model its box. (1 in = 25.4 mm)', ta: 'ஒரு ஃபோன் 6.1 in நீளம், 0.3 in தடிமன், 2.8 in அகலம். (1 in = 25.4 mm)', target: [154.94, 7.62, 71.12] },
  { text: 'This box is a 1 : 10 scale model of a cabinet that is 600 mm wide, 900 mm tall and 400 mm deep. Size the model.', ta: 'இது 600 × 900 × 400 mm அலமாரியின் 1:10 அளவு மாதிரி. மாதிரியின் அளவை அமையுங்கள்.', target: [60, 90, 40] },
];

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Next to the box is a bank card (85.6 × 54 mm). Real objects have real sizes — keep a reference in your head.', ta: 'Box-க்கு அருகில் ஒரு வங்கி அட்டை (85.6 × 54 mm). உண்மைப் பொருட்களுக்கு உண்மையான அளவுகள் உண்டு.' },
  { stage: 'TOUCH', text: 'Drag the orange handles to stretch the box along X, Y and Z, or type numbers. Watch the dimension lines.', ta: 'ஆரஞ்சு கைப்பிடிகளை இழுத்து box-ஐ நீட்டுங்கள், அல்லது எண்களை டைப் செய்யுங்கள்.' },
  { stage: 'UNDERSTAND', text: '10 mm = 1 cm, 1000 mm = 100 cm = 1 m, 1 inch = 25.4 mm. Engineers usually work in millimetres to avoid decimals. Switch the unit buttons: the size never changes, only the number.', ta: '10 mm = 1 cm, 1000 mm = 1 m, 1 inch = 25.4 mm. அலகை மாற்றினால் எண் மட்டுமே மாறும், அளவு அல்ல.' },
  { stage: 'BUILD', text: 'Complete the three sizing tasks. For each one, set the box and press “Lock in”.', ta: 'மூன்று பணிகளையும் முடித்து ஒவ்வொன்றுக்கும் "Lock in" அழுத்துங்கள்.' },
];

export default function L1Units() {
  const { difficulty } = useSettings();
  const tol = relTol(difficulty);
  const [dims, setDims] = useState<Vec3>([60, 40, 50]);
  const [unit, setUnit] = useState<LengthUnit>('mm');
  const [view, setView] = useState<ViewName>('persp');
  const [task, setTask] = useState(0);
  const [locked, setLocked] = useState<(Vec3 | null)[]>([null, null, null]);
  const [corr, setCorr] = useState(false);
  const start = useRef<Vec3>(dims);
  const [w, h, d] = dims;
  const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(w, h, d));
  const err = (a: Vec3, t: Vec3) => Math.max(...a.map((v, i) => Math.abs(v - t[i]) / t[i]));
  const setDim = (i: number, v: number) => setDims((ds) => ds.map((x, k) => (k === i ? Math.max(1, Math.min(400, v)) : x)) as Vec3);

  const evaluate = (): Feedback => {
    const correct: string[] = [];
    const issues: Feedback['issues'] = [];
    let s = 0;
    GOALS.forEach((g, i) => {
      const l = locked[i];
      if (!l) return issues.push({ label: `Task ${i + 1} not locked in yet.` });
      const e = err(l, g.target);
      if (e <= tol) {
        correct.push(`Task ${i + 1}: ${l.map((v) => fmt(v, 1)).join(' × ')} mm — correct.`);
        s += 1;
      } else {
        const wrong = ['width', 'height', 'depth'].filter((_, k) => Math.abs(l[k] - g.target[k]) / g.target[k] > tol);
        issues.push({ label: `Task ${i + 1}: ${wrong.join(', ')} off.`, detail: `You set ${l.map((v) => fmt(v, 1)).join(' × ')} mm; target is ${g.target.map((v) => fmt(v, 1)).join(' × ')} mm.` });
        s += Math.max(0, 1 - e) * 0.5;
      }
    });
    return {
      score: Math.round((s / GOALS.length) * 100),
      correct,
      issues,
      why: 'A unit mistake is one of the costliest errors in engineering — a part made in inches instead of millimetres is 25× too big. Always convert to one unit (usually mm) before modelling.',
      suggestion: 'Switch the unit buttons to the unit used in the task, type the number exactly, then switch back to mm to see the conversion.',
      canShowCorrection: true,
    };
  };

  const g = GOALS[task];
  return (
    <LevelShell
      id="w2-l1"
      steps={steps}
      evaluate={evaluate}
      onCorrection={setCorr}
      hints={[{ en: '0.08 m = 80 mm. 12 cm = 120 mm. 6.1 in × 25.4 = 154.94 mm.', ta: '0.08 m = 80 mm. 12 cm = 120 mm.' }]}
      viewport={
        <Stage3D fit={130} camera={[180, 130, 200]} target={[40, 20, 30]} view={view} onViewChange={setView} axes={40}>
          <mesh position={[w / 2, h / 2, d / 2]} castShadow>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color="#d8b779" roughness={0.8} />
            <Edges color="#4a3a20" />
          </mesh>
          <DimensionLines box={box} unit={unit} />
          {corr && (
            <mesh position={[g.target[0] / 2, g.target[1] / 2, g.target[2] / 2]}>
              <boxGeometry args={g.target} />
              <meshBasicMaterial color="#ffd166" transparent opacity={0.15} depthWrite={false} />
              <Edges color="#ffd166" />
            </mesh>
          )}
          {([0, 1, 2] as const).map((i) => {
            const pos: Vec3 = i === 0 ? [w, h / 2, d / 2] : i === 1 ? [w / 2, h, d / 2] : [w / 2, h / 2, d];
            const dir: Vec3 = i === 0 ? [1, 0, 0] : i === 1 ? [0, 1, 0] : [0, 0, 1];
            return (
              <AxisHandle
                key={i}
                position={pos}
                dir={dir}
                color={['#ff5f5f', '#5bd75b', '#4d8dff'][i]}
                shape="arrow"
                onStart={() => (start.current = dims)}
                onDrag={(dl) => setDim(i, Math.round(start.current[i] + dl))}
              />
            );
          })}
          <group position={[-70, 0.4, 20]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh receiveShadow>
              <boxGeometry args={[85.6, 54, 0.76]} />
              <meshStandardMaterial color="#3a6ea5" metalness={0.3} roughness={0.4} />
            </mesh>
          </group>
          <Label position={[-70, 3, 55]} color="#8ab4ff">
            bank card 85.6 × 54 mm
          </Label>
        </Stage3D>
      }
    >
      <div>
        <div className="lbl">Display unit</div>
        <Seg value={unit} onChange={setUnit} options={(['mm', 'cm', 'm', 'in'] as LengthUnit[]).map((u) => ({ v: u, label: u }))} />
      </div>
      <div>
        {(['x', 'y', 'z'] as const).map((a, i) => (
          <NumberField key={a} axis={a} label={['Width', 'Height', 'Depth'][i]} unit={unit} value={toUnit(dims[i], unit)} step={unit === 'mm' ? 1 : unit === 'cm' ? 0.1 : unit === 'm' ? 0.001 : 0.01} digits={unit === 'mm' ? 2 : 4} onChange={(v) => setDim(i, fromUnit(v, unit))} />
        ))}
      </div>
      <div className="kv">
        <span>In mm</span>
        <span>{dims.map((v) => fmt(v, 1)).join(' × ')}</span>
        <span>In cm</span>
        <span>{dims.map((v) => fmt(v / 10, 2)).join(' × ')}</span>
        <span>In m</span>
        <span>{dims.map((v) => fmt(v / 1000, 4)).join(' × ')}</span>
        <span>In inches</span>
        <span>{dims.map((v) => fmt(v / 25.4, 2)).join(' × ')}</span>
      </div>
      <div className="card" style={{ padding: 10 }}>
        <div className="btnrow">
          {GOALS.map((_, i) => (
            <button key={i} className={`btn small ${task === i ? 'on' : ''}`} onClick={() => setTask(i)}>
              {locked[i] ? '🔒 ' : ''}Task {i + 1}
            </button>
          ))}
        </div>
        <p style={{ margin: '8px 0' }}>{g.text}</p>
        <button
          className="btn small accent"
          onClick={() => {
            setLocked(locked.map((l, i) => (i === task ? ([...dims] as Vec3) : l)));
            if (task < GOALS.length - 1) setTask(task + 1);
          }}
        >
          Lock in answer for task {task + 1}
        </button>
        {GOALS.map((_, i) => (
          <Task key={i} ok={!!locked[i]}>
            Task {i + 1}: {locked[i] ? `${locked[i]!.map((v) => fmt(v, 1)).join(' × ')} mm` : 'not locked'}
          </Task>
        ))}
      </div>
    </LevelShell>
  );
}
