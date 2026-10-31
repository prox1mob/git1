import { useMemo, useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D, type ViewName } from '../../components/Stage3D';
import { Voxels, VOX, voxelCenter } from '../../components/three/Voxels3D';
import { Label } from '../../components/three/ObjectMesh';
import { IsoSvg, ProjectionSvg } from '../../components/VoxelSvg';
import { T, Toggle } from '../../components/ui';
import { drawingKey, mirrorProjection, normalize, project, randomPolycube, vkey, type Projection, type View, type Vox } from '../../lib/voxels';
import { rng } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

type Round =
  | { kind: 'view'; shape: Vox[]; view: View; options: Projection[]; labels: string[]; answer: number }
  | { kind: 'reverse'; shape: Vox[]; options: Vox[][]; answer: number };

const VIEW_TEXT: Record<View, string> = {
  front: 'FRONT view (looking from the front, along −Z)',
  top: 'TOP view (looking straight down, along −Y)',
  side: 'RIGHT SIDE view (looking from the right, along −X)',
};

function shuffle<T>(arr: T[], rand: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function goodShape(rand: () => number): Vox[] {
  for (let i = 0; i < 300; i++) {
    const s = randomPolycube(rand, 5 + Math.floor(rand() * 3), [3, 3, 3]);
    const keys = (['front', 'top', 'side'] as View[]).map((v) => drawingKey(project(s, v)));
    const mk = (['front', 'top', 'side'] as View[]).map((v) => drawingKey(mirrorProjection(project(s, v))));
    if (new Set([...keys, ...mk]).size >= 5 && new Set(keys).size === 3) return s;
  }
  return randomPolycube(rand, 6);
}

function viewRound(shape: Vox[], view: View, rand: () => number): Round {
  const others = (['front', 'top', 'side'] as View[]).filter((v) => v !== view);
  const cand: { p: Projection; label: string }[] = [
    { p: project(shape, view), label: `the ${view} view` },
    { p: project(shape, others[0]), label: `the ${others[0]} view` },
    { p: project(shape, others[1]), label: `the ${others[1]} view` },
    { p: mirrorProjection(project(shape, view)), label: `a mirror image of the ${view} view (as seen from the opposite side)` },
    { p: mirrorProjection(project(shape, others[0])), label: `a mirror image of the ${others[0]} view` },
  ];
  const seen = new Set<string>();
  const uniq = cand.filter((c) => {
    const k = drawingKey(c.p);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const four = [uniq[0], ...shuffle(uniq.slice(1), rand).slice(0, 3)];
  const order = shuffle([0, 1, 2, 3].slice(0, four.length), rand);
  return { kind: 'view', shape, view, options: order.map((i) => four[i].p), labels: order.map((i) => four[i].label), answer: order.indexOf(0) };
}

function viewsKey(s: Vox[]) {
  return (['front', 'top', 'side'] as View[]).map((v) => drawingKey(project(s, v))).join('#');
}

function reverseRound(shape: Vox[], rand: () => number): Round {
  const base = viewsKey(shape);
  const variants: Vox[][] = [];
  const keys = new Set([base]);
  const dirs: Vox[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [0, 0, -1],
    [0, -1, 0],
  ];
  for (let g = 0; g < 400 && variants.length < 3; g++) {
    const n = normalize(shape);
    const i = Math.floor(rand() * n.length);
    const d = dirs[Math.floor(rand() * 6)];
    const moved: Vox = [n[i][0] + d[0], n[i][1] + d[1], n[i][2] + d[2]];
    if (n.some((v) => vkey(v) === vkey(moved))) continue;
    const next = normalize([...n.slice(0, i), ...n.slice(i + 1), moved]);
    if (Math.max(...next.map((v) => Math.max(...v))) > 3) continue;
    const k = viewsKey(next);
    if (keys.has(k)) continue;
    keys.add(k);
    variants.push(next);
  }
  const all = [shape, ...variants];
  const order = shuffle(all.map((_, i) => i), rand);
  return { kind: 'reverse', shape, options: order.map((i) => all[i]), answer: order.indexOf(0) };
}

function makeRounds(seed: number): Round[] {
  const rand = rng(seed);
  const a = goodShape(rand);
  const b = goodShape(rand);
  const c = goodShape(rand);
  const views: View[] = ['front', 'top', 'side'];
  return [viewRound(a, 'front', rand), viewRound(a, 'top', rand), viewRound(a, 'side', rand), reverseRound(b, rand), viewRound(c, views[Math.floor(rand() * 3)], rand)];
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Engineers describe 3D parts with flat drawings called orthographic views: front, top and side. Each is what you see looking straight along one axis — no perspective.', ta: 'பொறியாளர்கள் 3D பாகங்களை front, top, side எனும் தட்டையான வரைபடங்களால் விவரிக்கிறார்கள்.' },
  { stage: 'TOUCH', text: 'Turn on "Glass box": the object’s shadow is projected straight onto three walls. Then press Front / Top / Side above the 3D view to look exactly along each axis.', ta: '"Glass box" இயக்கவும்: பொருளின் நிழல் மூன்று சுவர்களில் நேராக விழும்.' },
  { stage: 'UNDERSTAND', text: 'Lines in a view appear wherever a surface ends or steps closer/further away. Depth disappears: two cubes, one behind the other, look like one square from the front.', ta: 'ஒரு மேற்பரப்பு முடியும் அல்லது ஆழம் மாறும் இடத்தில் கோடுகள் தோன்றும். முன்னிருந்து பார்க்கும் போது ஆழம் தெரியாது.' },
  { stage: 'TEST', text: 'Answer five questions. Pick an option, read the explanation, then go to the next question. Press "Check my work" when all five are answered.', ta: 'ஐந்து கேள்விகளுக்குப் பதிலளியுங்கள்.' },
];

export default function L3Ortho() {
  const [seed, setSeed] = useState(() => Date.now() % 100000);
  const rounds = useMemo(() => makeRounds(seed), [seed]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null, null, null]);
  const [glass, setGlass] = useState(true);
  const [view, setView] = useState<ViewName>('persp');
  const r = rounds[idx];
  const picked = answers[idx];
  const shape = r.shape;
  const showShape = r.kind === 'view' || picked != null;
  const c = voxelCenter(shape);
  const lift = 25;
  const wall = 40;

  const pick = (i: number) => {
    if (picked != null) return;
    const a = [...answers];
    a[idx] = i;
    setAnswers(a);
  };

  const evaluate = (): Feedback | string => {
    if (answers.some((a) => a == null)) return `Answer all five questions first (${answers.filter((a) => a != null).length}/5 done).`;
    const right = answers.map((a, i) => a === rounds[i].answer);
    const correct: string[] = [];
    const issues: Feedback['issues'] = [];
    rounds.forEach((rd, i) => {
      const what = rd.kind === 'view' ? `Q${i + 1}: ${VIEW_TEXT[rd.view].split(' (')[0]}` : `Q${i + 1}: matching three views to a 3D object`;
      if (right[i]) correct.push(`${what} — correct.`);
      else if (rd.kind === 'view') issues.push({ label: `${what} — you picked ${rd.labels[answers[i]!]}.`, detail: 'Imagine standing on that side of the glass box and looking straight at the object.' });
      else issues.push({ label: `${what} — the object you picked has at least one view that differs.`, detail: 'Check each view in turn: does the front view match? the top? the side?' });
    });
    const score = Math.round((right.filter(Boolean).length / rounds.length) * 100);
    return {
      score,
      correct,
      issues,
      why: 'Technical drawings are how designs travel to workshops and factories. Reading views correctly prevents parts being made back-to-front or mirrored — one of the most expensive mistakes in manufacturing.',
      suggestion: issues.length ? 'Use the Front / Top / Side camera buttons on a question you missed and compare what you see with each option.' : 'Try Advanced mode or a new set: practise until you can predict the view before looking.',
      canShowCorrection: false,
    };
  };

  const proj = (v: View) => project(shape, v);
  const flat = (v: View) => {
    const n = normalize(shape);
    return n.map(([x, y, z]) => {
      const px = (x + 0.5) * VOX - c[0],
        py = (y + 0.5) * VOX + lift,
        pz = (z + 0.5) * VOX - c[2];
      if (v === 'front') return { p: [px, py, -wall] as [number, number, number], s: [VOX, VOX, 0.6] as [number, number, number] };
      if (v === 'top') return { p: [px, 0.3, pz] as [number, number, number], s: [VOX, 0.6, VOX] as [number, number, number] };
      return { p: [-wall, py, pz] as [number, number, number], s: [0.6, VOX, VOX] as [number, number, number] };
    });
  };
  const colors: Record<View, string> = { front: '#4d8dff', top: '#5bd75b', side: '#ff5f5f' };

  const viewport = (
    <Stage3D fit={100} camera={[150, 115, 185]} target={[-10, 25, -10]} view={view} onViewChange={setView} axes={false}>
      {showShape && <Voxels vs={shape} lift={lift} />}
      {showShape &&
        glass &&
        (['front', 'top', 'side'] as View[]).map((v) => (
          <group key={v}>
            {flat(v).map((f, i) => (
              <mesh key={i} position={f.p}>
                <boxGeometry args={f.s} />
                <meshBasicMaterial color={colors[v]} transparent opacity={0.55} />
              </mesh>
            ))}
            <Label position={v === 'front' ? [0, lift + c[1] * 2 + 12, -wall] : v === 'top' ? [c[0] + 20, 1, c[2] + 10] : [-wall, lift + c[1] * 2 + 12, 0]} color={colors[v]}>
              {v === 'side' ? 'right-side view' : `${v} view`}
            </Label>
          </group>
        ))}
      {showShape && glass && (
        <>
          <mesh position={[0, 40, -wall - 0.5]}>
            <planeGeometry args={[110, 80]} />
            <meshBasicMaterial color="#4d8dff" transparent opacity={0.05} />
          </mesh>
          <mesh position={[-wall - 0.5, 40, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[110, 80]} />
            <meshBasicMaterial color="#ff5f5f" transparent opacity={0.05} />
          </mesh>
        </>
      )}
    </Stage3D>
  );

  return (
    <LevelShell
      id="w1-l3"
      steps={steps}
      viewport={viewport}
      evaluate={evaluate}
      onRetry={() => {
        setSeed(Date.now() % 100000);
        setAnswers([null, null, null, null, null]);
        setIdx(0);
      }}
      hints={[
        { en: 'The front view keeps X (left–right) and Y (up–down); the top view keeps X and Z; the side view keeps Z and Y.', ta: 'Front view: X, Y. Top view: X, Z. Side view: Z, Y.' },
        { en: 'A mirror-image option has the same outline flipped left-to-right — check which side the tall part is on.', ta: 'Mirror image: அதே வடிவம் இடம்-வலம் மாறியிருக்கும்.' },
      ]}
    >
      <Toggle checked={glass} onChange={setGlass} label="Glass box (projections on the walls)" />
      <div className="card" style={{ padding: 10 }}>
        <div className="stepnav">
          <b>
            Question {idx + 1} / {rounds.length}
          </b>
          <span className="btnrow">
            {rounds.map((_, i) => (
              <button key={i} className={`btn small icon ${i === idx ? 'on' : ''}`} onClick={() => setIdx(i)} style={{ color: answers[i] == null ? undefined : answers[i] === rounds[i].answer ? 'var(--good)' : 'var(--bad)' }}>
                {i + 1}
              </button>
            ))}
          </span>
        </div>
        {r.kind === 'view' ? (
          <p style={{ marginTop: 8 }}>
            Which drawing is the <b>{VIEW_TEXT[r.view]}</b> of the object in the 3D view?
          </p>
        ) : (
          <>
            <p style={{ marginTop: 8 }}>These are the front, top and right-side views of a hidden object. Which object is it?</p>
            <div className="btnrow" style={{ justifyContent: 'space-around', alignItems: 'flex-end' }}>
              {(['front', 'top', 'side'] as View[]).map((v) => (
                <div key={v} style={{ textAlign: 'center' }}>
                  <ProjectionSvg p={proj(v)} size={90} color={colors[v]} />
                  <div className="muted" style={{ fontSize: 11 }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="options" style={{ marginTop: 8 }}>
          {r.kind === 'view'
            ? r.options.map((p, i) => (
                <button key={i} className={`option ${picked === i ? 'sel' : ''} ${picked != null && i === r.answer ? 'right' : ''} ${picked === i && i !== r.answer ? 'wrong' : ''}`} onClick={() => pick(i)}>
                  <ProjectionSvg p={p} size={120} />
                  <span className="muted">{String.fromCharCode(65 + i)}</span>
                </button>
              ))
            : r.options.map((vs, i) => (
                <button key={i} className={`option ${picked === i ? 'sel' : ''} ${picked != null && i === r.answer ? 'right' : ''} ${picked === i && i !== r.answer ? 'wrong' : ''}`} onClick={() => pick(i)}>
                  <IsoSvg vs={vs} size={120} />
                  <span className="muted">{String.fromCharCode(65 + i)}</span>
                </button>
              ))}
        </div>
        {picked != null && (
          <div className="note" style={{ marginTop: 8 }}>
            {picked === r.answer ? '✓ Correct! ' : '✗ Not quite. '}
            {r.kind === 'view' ? (
              <T en={`Option ${String.fromCharCode(65 + picked)} is ${r.labels[picked]}. Press "${r.view === 'side' ? 'Side' : r.view === 'top' ? 'Top' : 'Front'}" above the 3D view to see it for real.`} />
            ) : (
              <T en="The correct object is now shown in 3D. Use the Front / Top / Side buttons to confirm each drawing." />
            )}
            {idx < rounds.length - 1 && (
              <div style={{ marginTop: 6 }}>
                <button className="btn small primary" onClick={() => setIdx(idx + 1)}>
                  Next question →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </LevelShell>
  );
}
