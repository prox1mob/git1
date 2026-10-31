import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Voxels } from '../../components/three/Voxels3D';
import { IsoSvg } from '../../components/VoxelSvg';
import { Label } from '../../components/three/ObjectMesh';
import { mirror, randomPolycube, rotate, sameUpToRotation, shapeKey, type Vox } from '../../lib/voxels';
import { rng } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

type Axis = 'x' | 'y' | 'z';
interface Round {
  shape: Vox[];
  axis: Axis;
  turns: number; // +1 = +90°, -1 = -90°, 2 = 180°
  options: Vox[][];
  answer: number;
  kinds: string[];
}

const AXIS_COLOR: Record<Axis, string> = { x: '#ff5f5f', y: '#5bd75b', z: '#4d8dff' };
const AXIS_VIEW: Record<Axis, string> = { x: 'the right (+X)', y: 'above (+Y)', z: 'the front (+Z)' };

function chiral(rand: () => number): Vox[] {
  for (let i = 0; i < 400; i++) {
    const s = randomPolycube(rand, 5 + Math.floor(rand() * 2), [3, 3, 3]);
    if (!sameUpToRotation(s, mirror(s))) return s;
  }
  return [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [1, 1, 1],
    [2, 1, 1],
  ];
}

function shuffle<T>(a: T[], rand: () => number) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function makeRound(rand: () => number): Round {
  const shape = chiral(rand);
  const axis = (['x', 'y', 'z'] as Axis[])[Math.floor(rand() * 3)];
  const turns = [1, -1, 2][Math.floor(rand() * 3)];
  const correct = rotate(shape, axis, turns);
  const otherAxes = (['x', 'y', 'z'] as Axis[]).filter((a) => a !== axis);
  const cands: { s: Vox[]; kind: string }[] = [
    { s: correct, kind: 'correct rotation' },
    { s: mirror(correct, 'x'), kind: 'a mirror image — no rotation can produce it' },
    { s: rotate(shape, otherAxes[0], turns), kind: `a rotation about ${otherAxes[0].toUpperCase()} instead` },
    { s: rotate(shape, axis, turns === 2 ? 1 : -turns), kind: 'a rotation in the wrong direction / amount' },
    { s: rotate(shape, otherAxes[1], 1), kind: `a rotation about ${otherAxes[1].toUpperCase()} instead` },
    { s: shape, kind: 'the original, unrotated' },
  ];
  const seen = new Set<string>();
  const uniq = cands.filter((c) => {
    const k = shapeKey(c.s);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const pickN = [uniq[0], ...shuffle(uniq.slice(1), rand).slice(0, 3)];
  const order = shuffle(pickN.map((_, i) => i), rand);
  return { shape, axis, turns, options: order.map((i) => pickN[i].s), kinds: order.map((i) => pickN[i].kind), answer: order.indexOf(0) };
}

function RotArrow({ axis, turns, r = 42 }: { axis: Axis; turns: number; r?: number }) {
  const arc = (Math.abs(turns) === 2 ? Math.PI : Math.PI / 2) + 0.4;
  const sign = turns < 0 ? -1 : 1;
  const color = AXIS_COLOR[axis];
  // Build the arc in the XY plane (rotation about +Z), then orient to the axis.
  const orient: [number, number, number] = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [-Math.PI / 2, 0, 0] : [0, 0, 0];
  const end = sign * arc;
  const tip = new THREE.Vector3(Math.cos(end) * r, Math.sin(end) * r, 0);
  const tangent = new THREE.Vector3(-Math.sin(end) * sign, Math.cos(end) * sign, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  return (
    <group rotation={orient}>
      <mesh rotation={[0, 0, sign < 0 ? end : 0]}>
        <torusGeometry args={[r, 1.2, 8, 48, arc]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={tip} quaternion={q}>
        <coneGeometry args={[3.5, 8, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.8, 0.8, r * 2.6, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

function Spinner({ shape, axis, turns, play }: { shape: Vox[]; axis: Axis; turns: number; play: number }) {
  const g = useRef<THREE.Group>(null);
  const t = useRef(0);
  const last = useRef(play);
  useFrame((_, dt) => {
    if (!g.current) return;
    if (last.current !== play) {
      last.current = play;
      t.current = 0;
    }
    if (play > 0) t.current = Math.min(1, t.current + dt / 1.6);
    const e = t.current < 0.5 ? 2 * t.current * t.current : 1 - Math.pow(-2 * t.current + 2, 2) / 2;
    const ang = e * turns * (Math.PI / 2);
    g.current.rotation.set(axis === 'x' ? ang : 0, axis === 'y' ? ang : 0, axis === 'z' ? ang : 0);
  });
  return (
    <group position={[0, 35, 0]}>
      <group ref={g}>
        <group position={[0, -22, 0]}>
          <Voxels vs={shape} />
        </group>
      </group>
    </group>
  );
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Study the object. The coloured arrow shows the axis and direction of a rotation. The camera is locked so you must imagine the turn.', ta: 'பொருளைக் கவனியுங்கள். வண்ண அம்பு சுழற்சியின் அச்சையும் திசையையும் காட்டுகிறது.' },
  { stage: 'UNDERSTAND', text: 'Right-hand rule: point your right thumb along the axis; your fingers curl in the positive (+) direction. Seen from the arrow tip, positive is counter-clockwise.', ta: 'வலக்கை விதி: வலது கட்டைவிரலை அச்சின் திசையில் வைத்தால், விரல்கள் வளையும் திசையே நேர்மறை (+) சுழற்சி.' },
  { stage: 'EXPERIMENT', text: 'Pick the drawing that shows the object after the rotation. Watch out for mirror images: they look similar but can never be reached by rotating.', ta: 'சுழற்சிக்குப் பிறகு பொருள் எப்படித் தோன்றும் என்பதைத் தேர்வு செய்யுங்கள். Mirror image-களில் கவனம்!' },
  { stage: 'TEST', text: 'After answering, press "▶ Verify in 3D" to watch the rotation, and orbit freely to compare. Five rounds, then "Check my work".', ta: 'பதில் அளித்த பின் "Verify in 3D" அழுத்திச் சுழற்சியைப் பாருங்கள்.' },
];

export default function L4Rotation() {
  const [seed, setSeed] = useState(() => Date.now() % 100000);
  const rounds = useMemo(() => {
    const rand = rng(seed);
    return Array.from({ length: 5 }, () => makeRound(rand));
  }, [seed]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(5).fill(null));
  const [play, setPlay] = useState(0);
  const r = rounds[idx];
  const picked = answers[idx];
  const angleText = r.turns === 2 ? '180°' : r.turns > 0 ? '+90° (counter-clockwise)' : '−90° (clockwise)';

  const evaluate = (): Feedback | string => {
    if (answers.some((a) => a == null)) return `Answer all five rounds first (${answers.filter((a) => a != null).length}/5).`;
    const right = answers.map((a, i) => a === rounds[i].answer);
    const mirrors = answers.filter((a, i) => a != null && rounds[i].kinds[a].startsWith('a mirror')).length;
    return {
      score: Math.round((right.filter(Boolean).length / 5) * 100),
      correct: rounds.flatMap((rd, i) => (right[i] ? [`Round ${i + 1}: ${rd.axis.toUpperCase()} ${rd.turns === 2 ? '180°' : rd.turns > 0 ? '+90°' : '−90°'} — correct.`] : [])),
      issues: rounds.flatMap((rd, i) => (right[i] ? [] : [{ label: `Round ${i + 1}: you chose ${rd.kinds[answers[i]!]}.`, detail: `Rotation was about ${rd.axis.toUpperCase()} by ${rd.turns === 2 ? '180°' : rd.turns > 0 ? '+90°' : '−90°'}.` }])),
      why: 'Mental rotation is the core skill behind reading assemblies, orienting parts for printing and predicting how a mechanism moves. It improves quickly with deliberate practice.',
      suggestion: mirrors ? 'You picked a mirror image at least once. Track one distinctive cube (e.g. the one sticking out) through the turn instead of the whole shape.' : 'Track a single distinctive cube through the rotation; then check where a second one ends up.',
    };
  };

  return (
    <LevelShell
      id="w1-l4"
      steps={steps}
      viewport={
        <Stage3D fit={90} camera={[120, 105, 160]} target={[0, 35, 0]} orbit={picked != null} axes={false} showViews={false}>
          <Spinner shape={r.shape} axis={r.axis} turns={r.turns} play={picked != null ? play : 0} />
          <group position={[0, 35, 0]}>
            <RotArrow axis={r.axis} turns={r.turns} />
          </group>
          <Label position={[0, 90, 0]} color={AXIS_COLOR[r.axis]}>
            Rotate {angleText} about {r.axis.toUpperCase()}
          </Label>
        </Stage3D>
      }
      evaluate={evaluate}
      onRetry={() => {
        setSeed(Date.now() % 100000);
        setAnswers(Array(5).fill(null));
        setIdx(0);
      }}
      hints={[{ en: 'Seen from the arrow’s tip (looking back at the object from ' + AXIS_VIEW[r.axis] + '), positive rotation is counter-clockwise.', ta: 'அம்பு முனையிலிருந்து பார்க்கும்போது நேர்மறை சுழற்சி கடிகார எதிர்திசை.' }]}
    >
      <div className="card" style={{ padding: 10 }}>
        <div className="stepnav">
          <b>Round {idx + 1} / 5</b>
          <span className="btnrow">
            {rounds.map((_, i) => (
              <button key={i} className={`btn small icon ${i === idx ? 'on' : ''}`} onClick={() => setIdx(i)} style={{ color: answers[i] == null ? undefined : answers[i] === rounds[i].answer ? 'var(--good)' : 'var(--bad)' }}>
                {i + 1}
              </button>
            ))}
          </span>
        </div>
        <p style={{ margin: '8px 0' }}>
          Rotate <b style={{ color: AXIS_COLOR[r.axis] }}>{angleText}</b> about the <b style={{ color: AXIS_COLOR[r.axis] }}>{r.axis.toUpperCase()}</b> axis. Which drawing shows the result?
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="muted" style={{ fontSize: 12 }}>
            Before
            <IsoSvg vs={r.shape} size={120} color={[200, 200, 210]} />
          </div>
        </div>
        <div className="options">
          {r.options.map((vs, i) => (
            <button
              key={i}
              className={`option ${picked === i ? 'sel' : ''} ${picked != null && i === r.answer ? 'right' : ''} ${picked === i && i !== r.answer ? 'wrong' : ''}`}
              onClick={() => {
                if (picked != null) return;
                const a = [...answers];
                a[idx] = i;
                setAnswers(a);
              }}
            >
              <IsoSvg vs={vs} size={120} />
              <span className="muted">{String.fromCharCode(65 + i)}</span>
            </button>
          ))}
        </div>
        {picked != null && (
          <div className="note">
            {picked === r.answer ? '✓ Correct!' : `✗ That was ${r.kinds[picked]}.`}
            <div className="btnrow" style={{ marginTop: 6 }}>
              <button className="btn small accent" onClick={() => setPlay((p) => p + 1)}>
                ▶ Verify in 3D
              </button>
              {idx < 4 && (
                <button className="btn small primary" onClick={() => setIdx(idx + 1)}>
                  Next round →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </LevelShell>
  );
}
