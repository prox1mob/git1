import { Edges, Line } from '@react-three/drei';
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D, type ViewName } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { NumberField, Slider, Task, Toggle } from '../../components/ui';
import { absTol, DEG, dist3, fmt } from '../../lib/math';
import { useSettings } from '../../store/progress';
import type { Feedback, LessonStep, Vec3 } from '../../lib/types';

const P0: Vec3 = [20, 10, 0];
const R0 = 30;

function Part({ color = '#f8961e', ghost, axes }: { color?: string; ghost?: boolean; axes?: boolean }) {
  const mat = ghost ? <meshBasicMaterial color={color} transparent opacity={0.25} depthWrite={false} /> : <meshStandardMaterial color={color} roughness={0.4} />;
  return (
    <group>
      <mesh position={[15, 0, 0]} castShadow={!ghost}>
        <boxGeometry args={[30, 10, 10]} />
        {mat}
        <Edges color={ghost ? color : '#0b0f14'} />
      </mesh>
      <mesh position={[35, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow={!ghost}>
        <coneGeometry args={[7, 10, 20]} />
        {mat}
      </mesh>
      {axes && (
        <group>
          <Line points={[[0, 0, 0], [25, 0, 0]]} color="#ff5f5f" lineWidth={3} />
          <Line points={[[0, 0, 0], [0, 25, 0]]} color="#5bd75b" lineWidth={3} />
          <Line points={[[0, 0, 0], [0, 0, 25]]} color="#4d8dff" lineWidth={3} />
          <Label position={[28, 0, 0]} color="#ff8a8a" size={10}>
            local x
          </Label>
        </group>
      )}
    </group>
  );
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Every part carries its own little set of axes (local coordinates). The big axes at the origin are world coordinates.', ta: 'ஒவ்வொரு பாகத்துக்கும் சொந்த அச்சுகள் உண்டு (local). Origin-இல் உள்ளவை world அச்சுகள்.' },
  { stage: 'EXPERIMENT', text: 'Rotate the part, then use “Move along local X”: it slides along its own nose direction, not along the world X.', ta: 'பாகத்தைச் சுழற்றி "local X வழியே நகர்த்து" பயன்படுத்துங்கள்: அது தன் மூக்கின் திசையில் நகரும்.' },
  { stage: 'UNDERSTAND', text: 'Translation moves, rotation turns, scaling resizes. The ORDER matters: turning then moving is not the same as moving then turning (which swings the part around the world origin). Turn on “Order demo” to see both.', ta: 'நகர்த்தல், சுழற்றல், அளவுமாற்றல் — வரிசை முக்கியம்! "Order demo" இயக்கிப் பாருங்கள்.' },
  { stage: 'UNDERSTAND', text: 'Optional: “Show the math” reveals the 4×4 matrix software uses. The left 3×3 block is rotation & scale; the last column is the position.', ta: 'விருப்பம்: "Show the math" 4×4 அணியைக் காட்டும்.' },
  { stage: 'TEST', text: 'Task 1: move the part 40 mm along its own X axis (start pose is restored by “Reset”). Task 2: answer the order question.', ta: 'பணி 1: பாகத்தை அதன் சொந்த X அச்சில் 40 mm நகர்த்துங்கள். பணி 2: வரிசைக் கேள்விக்குப் பதில்.' },
];

export default function L8Transforms() {
  const { difficulty } = useSettings();
  const tol = absTol(difficulty);
  const [pos, setPos] = useState<Vec3>(P0);
  const [rz, setRz] = useState(R0);
  const [ry, setRy] = useState(0);
  const [sc, setSc] = useState(1);
  const [local, setLocal] = useState(10);
  const [math, setMath] = useState(false);
  const [order, setOrder] = useState(false);
  const [quiz, setQuiz] = useState<'a' | 'b' | null>(null);
  const [view, setView] = useState<ViewName>('persp');
  const [corr, setCorr] = useState(false);
  const rot: Vec3 = [0, ry * DEG, rz * DEG];
  const m = useMemo(() => new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(sc, sc, sc)), [pos, rz, ry, sc]);
  const expected: Vec3 = [P0[0] + 40 * Math.cos(R0 * DEG), P0[1] + 40 * Math.sin(R0 * DEG), 0];

  const moveLocal = () => {
    const d = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(...rot)).multiplyScalar(local);
    setPos([pos[0] + d.x, pos[1] + d.y, pos[2] + d.z]);
  };

  const evaluate = (): Feedback => {
    const e = dist3(pos, expected);
    const rotOk = Math.abs(rz - R0) < 1 && Math.abs(ry) < 1 && Math.abs(sc - 1) < 0.01;
    const t1 = e <= tol && rotOk;
    const t2 = quiz === 'b';
    const correct: string[] = [];
    const issues: Feedback['issues'] = [];
    if (t1) correct.push(`Moved along local X to (${pos.map((v) => fmt(v, 1)).join(', ')}).`);
    else if (!rotOk) issues.push({ label: 'Task 1: the rotation or scale changed.', detail: 'Keep the 30° tilt and scale 1 — only the position should change.' });
    else issues.push({ label: `Task 1: part is ${fmt(e, 1)} mm from the target.`, detail: `Moving 40 mm along a 30° tilted axis changes X by 40·cos30° = ${fmt(40 * Math.cos(R0 * DEG), 2)} and Y by 40·sin30° = 20. Target (${expected.map((v) => fmt(v, 2)).join(', ')}).` });
    if (t2) correct.push('Task 2: the orange part was moved first, then rotated about the world origin (M = R·T).');
    else issues.push({ label: quiz ? 'Task 2: not quite.' : 'Task 2 not answered.', detail: 'Rotating after moving swings the part around the world origin, so it ends up on the Y axis.' });
    return {
      score: (t1 ? 60 : rotOk ? Math.max(0, 40 - e) : 0) + (t2 ? 40 : 0),
      correct,
      issues,
      why: 'Assemblies are chains of transforms: a screw is placed in a lid, the lid on a box, the box on a desk. Local vs world axes and transform order decide where every part ends up — and are the source of many “why did it fly away?” bugs in CAD and games.',
      suggestion: 'Use “Move along local X” rather than calculating by hand — CAD tools offer the same “local / world” switch on their move gizmos.',
      canShowCorrection: true,
    };
  };

  const els = m.elements;
  const T = new THREE.Matrix4().makeTranslation(50, 0, 0);
  const R = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
  const ghostRT = new THREE.Matrix4().multiplyMatrices(R, T);
  const dec = (mm: THREE.Matrix4) => {
    const p = new THREE.Vector3(),
      q = new THREE.Quaternion(),
      s = new THREE.Vector3();
    mm.decompose(p, q, s);
    return { p, q };
  };
  const g1 = dec(ghostRT);
  const TR = new THREE.Matrix4().makeTranslation(...pos).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)));
  const RTm = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)).multiply(new THREE.Matrix4().makeTranslation(...pos));
  const d1 = dec(TR),
    d2 = dec(RTm);

  return (
    <LevelShell
      id="w2-l8"
      steps={steps}
      evaluate={evaluate}
      onCorrection={setCorr}
      onRetry={() => {
        setPos(P0);
        setRz(R0);
        setRy(0);
        setSc(1);
        setQuiz(null);
      }}
      hints={[{ en: 'Set “Move along local X” to 40 and press it once — or type X = 54.64 and Y = 30.', ta: '"Move along local X" = 40 அமைத்து ஒருமுறை அழுத்துங்கள்.' }]}
      viewport={
        <Stage3D fit={110} camera={[60, 90, 190]} target={[20, 20, 0]} view={view} onViewChange={setView} axes={80}>
          <group position={pos} rotation={rot} scale={sc}>
            <Part axes />
          </group>
          {order && (
            <>
              <group position={d1.p} quaternion={d1.q}>
                <Part ghost color="#4cc9f0" />
              </group>
              <group position={d2.p} quaternion={d2.q}>
                <Part ghost color="#f94144" />
              </group>
              <Label position={[d2.p.x, d2.p.y + 15, d2.p.z]} color="#ff8a80">
                move, then rotate
              </Label>
            </>
          )}
          <group position={g1.p} quaternion={g1.q}>
            <Part ghost color="#ffd166" />
          </group>
          <Label position={[g1.p.x - 12, g1.p.y + 12, 0]} color="#ffd166">
            Task 2 part
          </Label>
          {corr && (
            <group position={expected} rotation={[0, 0, R0 * DEG]}>
              <Part ghost color="#3fb950" />
            </group>
          )}
        </Stage3D>
      }
    >
      <div className="lbl">Position (world, mm)</div>
      {(['x', 'y', 'z'] as const).map((a, i) => (
        <NumberField key={a} axis={a} value={pos[i]} digits={2} onChange={(v) => setPos(pos.map((q, k) => (k === i ? v : q)) as Vec3)} />
      ))}
      <Slider label="Rotate about Z" value={rz} min={-180} max={180} step={1} unit="°" onChange={setRz} />
      <Slider label="Rotate about Y" value={ry} min={-180} max={180} step={1} unit="°" onChange={setRy} />
      <Slider label="Uniform scale" value={sc} min={0.25} max={2} step={0.05} onChange={setSc} digits={2} />
      <div className="numrow">
        <NumberField label="Local X move" value={local} digits={1} onChange={setLocal} unit="mm" />
        <button className="btn small accent" onClick={moveLocal}>
          Move along local X
        </button>
      </div>
      <Toggle checked={order} onChange={setOrder} label="Order demo (blue: rotate then move · red: move then rotate)" />
      <Toggle checked={math} onChange={setMath} label="Show the math (4×4 matrix)" />
      {math && (
        <table className="mono" style={{ fontSize: 12, borderCollapse: 'collapse', margin: '0 auto' }}>
          <tbody>
            {[0, 1, 2, 3].map((r) => (
              <tr key={r}>
                {[0, 1, 2, 3].map((c) => (
                  <td key={c} style={{ padding: '2px 8px', textAlign: 'right', color: c === 3 && r < 3 ? '#ffd166' : r < 3 && c < 3 ? '#9ff0ff' : '#8d9aa8' }}>
                    {fmt(els[c * 4 + r], 3)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="card" style={{ padding: 10 }}>
        <Task ok={dist3(pos, expected) <= tol}>Task 1: move the part 40 mm along its own X axis</Task>
        <p style={{ fontSize: 14, margin: '6px 0' }}>Task 2: the yellow part started at the origin pointing along +X. Which sequence placed it?</p>
        <div className="grid" style={{ gap: 6 }}>
          <button className={`btn small ${quiz === 'a' ? 'on' : ''}`} onClick={() => setQuiz('a')}>
            (a) rotate 90° about its centre, then move 50 mm along X
          </button>
          <button className={`btn small ${quiz === 'b' ? 'on' : ''}`} onClick={() => setQuiz('b')}>
            (b) move 50 mm along X, then rotate 90° about the world origin
          </button>
        </div>
      </div>
    </LevelShell>
  );
}
