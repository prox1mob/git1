import { Edges, Line } from '@react-three/drei';
import { useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { NumberField, Seg, Slider, Task } from '../../components/ui';
import { angTol, angleDiffDeg, DEG, fmt } from '../../lib/math';
import { useSettings } from '../../store/progress';
import type { Feedback, LessonStep, Vec3 } from '../../lib/types';

type Axis = 'x' | 'y' | 'z';
interface Goal {
  text: string;
  axis: Axis;
  deg: number;
  ghost?: boolean;
}
const GOALS: Goal[] = [
  { text: 'Rotate the lever to 3π/4 radians about Z.', axis: 'z', deg: 135 },
  { text: 'Rotate the lever −60° about Y (clockwise seen from above).', axis: 'y', deg: -60 },
  { text: 'Match the yellow ghost. It is rotated about X — find the angle.', axis: 'x', deg: 120, ghost: true },
];
const COLORS: Record<Axis, string> = { x: '#ff5f5f', y: '#5bd75b', z: '#4d8dff' };

function piFraction(rad: number) {
  const f = rad / Math.PI;
  const dens = [1, 2, 3, 4, 6, 8, 12];
  for (const d of dens) {
    const n = Math.round(f * d);
    if (Math.abs(f * d - n) < 0.02) {
      if (n === 0) return '0';
      const num = Math.abs(n) === 1 ? 'π' : `${Math.abs(n)}π`;
      return `${n < 0 ? '−' : ''}${num}${d === 1 ? '' : `/${d}`}`;
    }
  }
  return `${fmt(f, 3)}π`;
}

function Lever({ rot, ghost }: { rot: Vec3; ghost?: boolean }) {
  return (
    <group rotation={rot}>
      <mesh position={[30, 0, 0]} castShadow={!ghost}>
        <boxGeometry args={[60, 8, 8]} />
        {ghost ? <meshBasicMaterial color="#ffd166" transparent opacity={0.25} depthWrite={false} /> : <meshStandardMaterial color="#f8961e" roughness={0.4} />}
        {ghost && <Edges color="#ffd166" />}
      </mesh>
      <mesh position={[62, 0, 0]}>
        <sphereGeometry args={[6, 20, 12]} />
        {ghost ? <meshBasicMaterial color="#ffd166" transparent opacity={0.25} depthWrite={false} /> : <meshStandardMaterial color="#e9edf2" />}
      </mesh>
      {!ghost && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[9, 9, 12, 32]} />
          <meshStandardMaterial color="#577590" />
        </mesh>
      )}
    </group>
  );
}

function Protractor({ axis, deg }: { axis: Axis; deg: number }) {
  // circle drawn in the plane perpendicular to the axis; 0° reference along the lever's start direction
  const R = 75;
  const pts = (a0: number, a1: number, r: number) => {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 4));
    return Array.from({ length: n + 1 }, (_, i) => {
      const a = (a0 + ((a1 - a0) * i) / n) * DEG;
      return planePt(axis, Math.cos(a) * r, Math.sin(a) * r);
    });
  };
  return (
    <group>
      <Line points={pts(0, 360, R)} color={COLORS[axis]} lineWidth={1} transparent opacity={0.5} />
      {Array.from({ length: 24 }, (_, i) => (
        <Line key={i} points={[planePt(axis, Math.cos(i * 15 * DEG) * (R - (i % 6 === 0 ? 8 : 4)), Math.sin(i * 15 * DEG) * (R - (i % 6 === 0 ? 8 : 4))), planePt(axis, Math.cos(i * 15 * DEG) * R, Math.sin(i * 15 * DEG) * R)]} color={COLORS[axis]} lineWidth={1} />
      ))}
      {Math.abs(deg) > 0.5 && <Line points={[[0, 0, 0], ...pts(0, deg, 40), [0, 0, 0]]} color="#ffd166" lineWidth={2} />}
      {[0, 90, 180, 270].map((a) => (
        <Label key={a} position={planePt(axis, Math.cos(a * DEG) * (R + 10), Math.sin(a * DEG) * (R + 10))} color={COLORS[axis]} size={11}>
          {a}°
        </Label>
      ))}
    </group>
  );
}

/** Map 2D angle coordinates into the rotation plane so that +angle follows the right-hand rule. */
function planePt(axis: Axis, u: number, v: number): Vec3 {
  if (axis === 'z') return [u, v, 0]; // from +X towards +Y
  if (axis === 'y') return [u, 0, -v]; // from +X towards −Z
  return [0, u, v]; // from +Y towards +Z (the lever starts pointing up for X rotations)
}

/** Euler rotation for the lever: it starts perpendicular to the chosen axis. */
function rotFor(axis: Axis, deg: number): Vec3 {
  if (axis === 'x') return [deg * DEG, 0, Math.PI / 2];
  if (axis === 'y') return [0, deg * DEG, 0];
  return [0, 0, deg * DEG];
}

export default function L3Angles() {
  const { difficulty } = useSettings();
  const tol = angTol(difficulty);
  const [axis, setAxis] = useState<Axis>('z');
  const [deg, setDeg] = useState(0);
  const [task, setTask] = useState(0);
  const [locked, setLocked] = useState<({ axis: Axis; deg: number } | null)[]>([null, null, null]);
  const [corr, setCorr] = useState(false);
  const rot = rotFor(axis, deg);
  const g = GOALS[task];
  const gRot = rotFor(g.axis, g.deg);

  const steps: LessonStep[] = [
    { stage: 'OBSERVE', text: 'The lever spins around one axis at a time. The coloured ring is a protractor in the plane of rotation.', ta: 'Lever ஒரு நேரத்தில் ஒரு அச்சைச் சுற்றிச் சுழல்கிறது. வண்ண வட்டம் ஒரு கோணமானி.' },
    { stage: 'EXPERIMENT', text: 'Pick an axis and drag the angle slider. Positive angles turn counter-clockwise when you look back along the axis towards the origin (right-hand rule).', ta: 'அச்சைத் தேர்ந்தெடுத்து slider-ஐ இழுங்கள். நேர்மறைக் கோணம் = கடிகார எதிர்திசை (வலக்கை விதி).' },
    { stage: 'UNDERSTAND', text: 'A full turn is 360° = 2π radians, so 180° = π rad and 1 rad ≈ 57.3°. Radians measure angle as arc length ÷ radius — the natural unit for maths and code.', ta: 'முழுச் சுற்று 360° = 2π ரேடியன். 180° = π rad, 1 rad ≈ 57.3°.' },
    { stage: 'TEST', text: 'Complete the three rotation tasks and lock each one in.', ta: 'மூன்று சுழற்சிப் பணிகளை முடித்து lock செய்யுங்கள்.' },
  ];

  const evaluate = (): Feedback => {
    const correct: string[] = [];
    const issues: Feedback['issues'] = [];
    let s = 0;
    GOALS.forEach((gg, i) => {
      const l = locked[i];
      if (!l) return issues.push({ label: `Task ${i + 1} not locked in.` });
      if (l.axis !== gg.axis) return issues.push({ label: `Task ${i + 1}: rotated about ${l.axis.toUpperCase()} instead of ${gg.axis.toUpperCase()}.` });
      const e = angleDiffDeg(l.deg, gg.deg);
      if (e <= tol) {
        s++;
        correct.push(`Task ${i + 1}: ${fmt(l.deg)}° (${piFraction(l.deg * DEG)} rad) about ${gg.axis.toUpperCase()}.`);
      } else {
        issues.push({ label: `Task ${i + 1}: ${fmt(l.deg)}° is ${fmt(e)}° away from the target.`, detail: Math.abs(l.deg + gg.deg) < tol ? 'Right size, wrong direction — check the sign (right-hand rule).' : `Target was ${fmt(gg.deg)}° = ${piFraction(gg.deg * DEG)} rad.` });
        s += Math.max(0, 1 - e / 90) * 0.4;
      }
    });
    return {
      score: Math.round((s / 3) * 100),
      correct,
      issues,
      why: 'Rotations appear everywhere in design: hinge limits, chamfer angles, draft angles in moulds and joint angles in robots. Software usually stores radians, people usually think in degrees — converting confidently avoids silent errors.',
      suggestion: 'Convert first: degrees = radians × 180 / π. Then check the direction with the right-hand rule before you lock in.',
      canShowCorrection: true,
    };
  };

  return (
    <LevelShell
      id="w2-l3"
      steps={steps}
      evaluate={evaluate}
      onCorrection={setCorr}
      hints={[{ en: '3π/4 rad = 3 × 180 / 4 = 135°.', ta: '3π/4 rad = 135°.' }]}
      viewport={
        <Stage3D fit={110} camera={[110, 120, 170]} target={[0, 10, 0]} axes={90}>
          <group position={[0, 10, 0]}>
            <Lever rot={rot} />
            {(g.ghost || corr) && <Lever rot={gRot} ghost />}
            <Protractor axis={axis} deg={deg} />
          </group>
        </Stage3D>
      }
    >
      <div>
        <div className="lbl">Rotation axis</div>
        <Seg
          value={axis}
          onChange={(a) => {
            setAxis(a);
            setDeg(0);
          }}
          options={[
            { v: 'x', label: 'X', cls: 'x' },
            { v: 'y', label: 'Y', cls: 'y' },
            { v: 'z', label: 'Z', cls: 'z' },
          ]}
        />
      </div>
      <Slider label="Angle" value={deg} min={-360} max={360} step={1} unit="°" onChange={setDeg} />
      <div className="numrow">
        <NumberField label="degrees" value={deg} step={1} digits={2} onChange={(v) => setDeg(v)} />
      </div>
      <div className="numrow">
        <NumberField label="radians" value={deg * DEG} step={0.01} digits={4} onChange={(v) => setDeg(v / DEG)} />
      </div>
      <div className="formula">
        {fmt(deg, 1)}° = {fmt(deg * DEG, 3)} rad = {piFraction(deg * DEG)} rad
      </div>
      <div className="btnrow">
        {[30, 45, 60, 90, 180].map((a) => (
          <button key={a} className="btn small" onClick={() => setDeg(a)}>
            {a}° = {piFraction(a * DEG)}
          </button>
        ))}
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
            setLocked(locked.map((l, i) => (i === task ? { axis, deg } : l)));
            if (task < 2) setTask(task + 1);
          }}
        >
          Lock in task {task + 1}
        </button>
        {GOALS.map((_, i) => (
          <Task key={i} ok={!!locked[i]}>
            Task {i + 1}: {locked[i] ? `${fmt(locked[i]!.deg)}° about ${locked[i]!.axis.toUpperCase()}` : 'not locked'}
          </Task>
        ))}
      </div>
    </LevelShell>
  );
}
