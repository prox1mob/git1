import { Edges } from '@react-three/drei';
import { useMemo, useRef, useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D, type ViewName } from '../../components/Stage3D';
import { ObjectGestures, type DragAxis } from '../../components/three/ObjectGestures';
import { CoordinateGuides, Label } from '../../components/three/ObjectMesh';
import { NumberField, Seg, Task } from '../../components/ui';
import { absTol, dist3, fmt, rng } from '../../lib/math';
import { useSettings } from '../../store/progress';
import type { Feedback, LessonStep, Vec3 } from '../../lib/types';

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Every point has an address (x, y, z). The dashed lines drop from a point to the floor and across to each axis — that is how you read its coordinates.', ta: 'ஒவ்வொரு புள்ளிக்கும் ஒரு முகவரி (x, y, z). கோடுகள் புள்ளியிலிருந்து தரைக்கும் அச்சுகளுக்கும் செல்கின்றன.' },
  { stage: 'EXPERIMENT', text: 'Type numbers into X, Y, Z for the drone, or drag it (choose an axis first). Negative numbers go left, down or backwards.', ta: 'Drone-க்கு X, Y, Z எண்களை டைப் செய்யுங்கள் அல்லது இழுங்கள். எதிர்மறை எண்கள் இடது, கீழ், பின் திசை.' },
  { stage: 'UNDERSTAND', text: 'Use the Top view to read X and Z without Y getting in the way, then the Front view to read Y. Each grid cell is 10 mm.', ta: 'Top view-இல் X, Z படிக்கவும்; Front view-இல் Y படிக்கவும். ஒவ்வொரு கட்டமும் 10 mm.' },
  { stage: 'TEST', text: 'Part A: read the coordinates of the three red markers. Part B: fly the drone to the three listed coordinates and lock each one in.', ta: 'பகுதி A: சிவப்புக் குறிகளின் ஆயத்தொலைவுகளைப் படியுங்கள். பகுதி B: drone-ஐ கொடுக்கப்பட்ட இடங்களுக்கு நகர்த்துங்கள்.' },
];

function Drone({ p }: { p: Vec3 }) {
  return (
    <group position={p}>
      <mesh castShadow>
        <boxGeometry args={[14, 5, 14]} />
        <meshStandardMaterial color="#e9edf2" roughness={0.3} />
        <Edges color="#0b0f14" />
      </mesh>
      {[
        [-10, 3, -10],
        [10, 3, -10],
        [-10, 3, 10],
        [10, 3, 10],
      ].map((q, i) => (
        <mesh key={i} position={q as Vec3}>
          <cylinderGeometry args={[5, 5, 1, 20]} />
          <meshStandardMaterial color="#4cc9f0" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

export default function L2Coords() {
  const { difficulty } = useSettings();
  const tol = absTol(difficulty);
  const [seed] = useState(() => Date.now() % 100000);
  const { markers, goals } = useMemo(() => {
    const r = rng(seed);
    const v = () => Math.round((r() * 2 - 1) * 6) * 10;
    const vy = () => Math.round(r() * 6) * 10;
    return {
      markers: Array.from({ length: 3 }, () => [v(), vy(), v()] as Vec3),
      goals: Array.from({ length: 3 }, () => [v(), vy() + 10, v()] as Vec3),
    };
  }, [seed]);
  const [reads, setReads] = useState<Vec3[]>(markers.map(() => [0, 0, 0]));
  const [p, setP] = useState<Vec3>([0, 20, 0]);
  const [axis, setAxis] = useState<DragAxis>('xz');
  const [drag, setDrag] = useState(false);
  const [placed, setPlaced] = useState<(Vec3 | null)[]>([null, null, null]);
  const [goal, setGoal] = useState(0);
  const [view, setView] = useState<ViewName>('persp');
  const [corr, setCorr] = useState(false);
  const pRef = useRef(p);
  pRef.current = p;

  const evaluate = (): Feedback => {
    const correct: string[] = [];
    const issues: Feedback['issues'] = [];
    let s = 0;
    markers.forEach((m, i) => {
      const e = dist3(m, reads[i]);
      if (e <= tol) {
        s++;
        correct.push(`Marker ${i + 1} read correctly as (${m.join(', ')}).`);
      } else issues.push({ label: `Marker ${i + 1}: you wrote (${reads[i].join(', ')}).`, detail: `It is at (${m.join(', ')}). Check ${['x', 'y', 'z'].filter((_, k) => Math.abs(m[k] - reads[i][k]) > tol).join(', ')}.` });
    });
    goals.forEach((g, i) => {
      const pl = placed[i];
      if (pl && dist3(pl, g) <= tol) {
        s++;
        correct.push(`Drone placed at (${g.join(', ')}).`);
      } else issues.push({ label: `Delivery ${i + 1} (${g.join(', ')}) ${pl ? `was locked at (${pl.map((v) => fmt(v)).join(', ')})` : 'not locked in'}.` });
    });
    return {
      score: Math.round((s / 6) * 100),
      correct,
      issues,
      why: 'Coordinates are how CAD software, CNC machines and 3D printers know exactly where to put material. A machine reads (x, y, z) literally — a sign error moves a hole to the wrong side of a part.',
      suggestion: issues.length ? 'Read one axis at a time: Top view for X and Z, Front view for Y. Count grid cells (10 mm each) from the origin.' : 'Try reading the markers in the perspective view only — then confirm with the orthographic views.',
      canShowCorrection: issues.length > 0,
    };
  };

  return (
    <LevelShell
      id="w2-l2"
      steps={steps}
      evaluate={evaluate}
      onCorrection={setCorr}
      hints={[{ en: 'A marker standing on the floor has y = 0. Its height above the floor is its Y coordinate.', ta: 'தரையில் இருக்கும் குறியின் y = 0.' }]}
      viewport={
        <Stage3D fit={110} camera={[120, 110, 160]} view={view} onViewChange={setView} axes={70}>
          {markers.map((m, i) => (
            <group key={i}>
              <mesh position={m}>
                <sphereGeometry args={[3.5, 20, 12]} />
                <meshStandardMaterial color="#f85149" emissive="#f85149" emissiveIntensity={0.3} />
              </mesh>
              <CoordinateGuides p={m} />
              <Label position={[m[0], m[1] + 9, m[2]]} color="#ff8a80">
                {corr ? `M${i + 1} (${m.join(', ')})` : `M${i + 1}`}
              </Label>
            </group>
          ))}
          {goals.map((g, i) => (
            <group key={i} position={g}>
              <mesh>
                <boxGeometry args={[16, 1, 16]} />
                <meshBasicMaterial color={placed[i] && dist3(placed[i]!, g) <= tol ? '#3fb950' : '#ffd166'} transparent opacity={corr || i === goal ? 0.5 : 0.12} />
              </mesh>
              {(corr || i === goal) && <Label position={[0, 6, 0]} color="#ffd166">{`D${i + 1}`}</Label>}
            </group>
          ))}
          <Drone p={p} />
          <CoordinateGuides p={p} />
          <Label position={[p[0], p[1] + 12, p[2]]} color="#9ff0ff">
            ({fmt(p[0])}, {fmt(p[1])}, {fmt(p[2])})
          </Label>
          {drag && (
            <ObjectGestures enabled axis={axis} snap={5} allowRotate={false} allowScale={false} get={() => ({ position: pRef.current, rotation: [0, 0, 0], scale: [1, 1, 1] })} onChange={(t) => setP([t.position[0], Math.max(0, t.position[1]), t.position[2]])} />
          )}
        </Stage3D>
      }
    >
      <div className="card" style={{ padding: 10 }}>
        <h3>Part A — read the markers</h3>
        {markers.map((_, i) => (
          <div key={i} className="numrow" style={{ marginBottom: 4 }}>
            <b style={{ width: 28 }}>M{i + 1}</b>
            {(['x', 'y', 'z'] as const).map((a, k) => (
              <NumberField key={a} axis={a} value={reads[i][k]} digits={0} step={10} onChange={(v) => setReads(reads.map((r, j) => (j === i ? (r.map((q, kk) => (kk === k ? v : q)) as Vec3) : r)))} />
            ))}
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 10 }}>
        <h3>Part B — deliver with the drone</h3>
        <div className="numrow" style={{ marginBottom: 6 }}>
          {(['x', 'y', 'z'] as const).map((a, k) => (
            <NumberField key={a} axis={a} value={p[k]} digits={0} step={5} onChange={(v) => setP(p.map((q, kk) => (kk === k ? (k === 1 ? Math.max(0, v) : v) : q)) as Vec3)} />
          ))}
        </div>
        <div className="btnrow">
          <button className={`btn small ${drag ? 'on' : ''}`} onClick={() => setDrag(!drag)}>
            {drag ? '☝ Dragging drone' : '⟳ Orbit view'}
          </button>
          {drag && <Seg value={axis} onChange={setAxis} options={[{ v: 'xz', label: 'Floor' }, { v: 'x', label: 'X', cls: 'x' }, { v: 'y', label: 'Y', cls: 'y' }, { v: 'z', label: 'Z', cls: 'z' }]} />}
        </div>
        {goals.map((g, i) => (
          <div key={i} onClick={() => setGoal(i)} style={{ cursor: 'pointer' }}>
            <Task ok={!!placed[i] && dist3(placed[i]!, g) <= tol}>
              D{i + 1}: fly to <span className="mono">({g.join(', ')})</span> {i === goal && <span className="tag">current</span>}
            </Task>
          </div>
        ))}
        <button
          className="btn small accent"
          onClick={() => {
            setPlaced(placed.map((q, i) => (i === goal ? ([...p] as Vec3) : q)));
            setGoal(Math.min(2, goal + 1));
          }}
        >
          Lock in delivery D{goal + 1}
        </button>
      </div>
    </LevelShell>
  );
}
