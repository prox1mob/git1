import { useMemo, useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Ghost, ObjectMesh } from '../../components/three/ObjectMesh';
import { NumberField, Seg, Slider, Task, Toggle } from '../../components/ui';
import { makeObject, meshVolumeArea, getGeometry, type SceneObject } from '../../lib/shapes';
import { fmt } from '../../lib/math';
import type { Feedback, LessonStep, Vec3 } from '../../lib/types';

type Op = 'union' | 'subtract' | 'intersect';
type ToolType = 'cylinder' | 'sphere' | 'box';
type Axis = 'x' | 'y' | 'z';
interface State {
  a: Vec3; // box w,h,d
  tool: ToolType;
  r: number;
  len: number;
  axis: Axis;
  pos: Vec3;
  op: Op;
}
const INIT: State = { a: [50, 20, 40], tool: 'cylinder', r: 8, len: 30, axis: 'x', pos: [0, 10, 0], op: 'union' };

function build(s: State) {
  const A = makeObject('box', { dims: { w: s.a[0], h: s.a[1], d: s.a[2] }, position: [0, s.a[1] / 2, 0], material: { preset: 'abs', color: '#4cc9f0', roughness: 0.4, metalness: 0, opacity: 1 } });
  const rot: Vec3 = s.axis === 'x' ? [0, 0, Math.PI / 2] : s.axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  const B =
    s.tool === 'cylinder'
      ? makeObject('cylinder', { dims: { r: s.r, h: s.len }, position: s.pos, rotation: rot })
      : s.tool === 'sphere'
        ? makeObject('sphere', { dims: { r: s.r }, position: s.pos })
        : makeObject('box', { dims: { w: s.r * 2, h: s.r * 2, d: s.r * 2 }, position: s.pos });
  B.material = { preset: 'abs', color: '#f8961e', roughness: 0.4, metalness: 0, opacity: 1 };
  const R = makeObject('csg', { csg: { op: s.op, a: A, b: B }, material: { preset: 'abs', color: '#90be6d', roughness: 0.35, metalness: 0, opacity: 1 } });
  return { A, B, R };
}

const TASKS = [
  { name: 'Through-hole', text: 'Make a 60 × 20 × 40 mm block (W × H × D) with a Ø10 hole going right through its 20 mm height, at the centre of the block.' },
  { name: 'Dice blank', text: 'Make a rounded dice blank: keep only the overlap of a 30 mm cube and a Ø40 sphere, both centred.' },
];

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Boolean operations combine two solids: UNION joins them, SUBTRACT cuts the second out of the first, INTERSECT keeps only the overlap.', ta: 'Union இணைக்கும், Subtract வெட்டும், Intersect பொதுப் பகுதியை மட்டும் வைக்கும்.' },
  { stage: 'EXPERIMENT', text: 'Move the orange tool through the blue block and switch between the three operations. Turn on “Show tools” to see the inputs as ghosts.', ta: 'ஆரஞ்சுக் கருவியை நீலக் கட்டைக்குள் நகர்த்தி மூன்று செயல்களையும் மாற்றிப் பாருங்கள்.' },
  { stage: 'UNDERSTAND', text: 'A hole is a subtracted cylinder. For a through-hole, the cylinder must stick out of BOTH faces — otherwise you get a blind hole or a paper-thin skin.', ta: 'துளை = கழிக்கப்பட்ட cylinder. முழுத் துளைக்கு அது இரு முகங்களுக்கும் வெளியே நீள வேண்டும்.' },
  { stage: 'BUILD', text: 'Complete the two tasks and lock each one in. Booleans here are real mesh operations (three-bvh-csg); the volume is measured from the result.', ta: 'இரண்டு பணிகளையும் முடித்து lock செய்யுங்கள்.' },
];

export default function L7Boolean() {
  const [s, setS] = useState<State>(INIT);
  const [ghost, setGhost] = useState(true);
  const [task, setTask] = useState(0);
  const [locked, setLocked] = useState<(State | null)[]>([null, null]);
  const { A, B, R } = useMemo(() => build(s), [s]);
  const vol = useMemo(() => meshVolumeArea(getGeometry(R)).volume, [R]);
  const set = (p: Partial<State>) => setS({ ...s, ...p });

  const check = (i: number, l: State): string[] => {
    const errs: string[] = [];
    const near = (a: number, b: number, t = 0.6) => Math.abs(a - b) <= t;
    if (i === 0) {
      if (!(near(l.a[0], 60) && near(l.a[1], 20) && near(l.a[2], 40))) errs.push(`block is ${l.a.join(' × ')}, needs 60 × 20 × 40`);
      if (l.op !== 'subtract') errs.push('operation must be Subtract');
      if (l.tool !== 'cylinder') errs.push('the hole tool must be a cylinder');
      if (!near(l.r * 2, 10, 0.3)) errs.push(`hole is Ø${fmt(l.r * 2)}, needs Ø10`);
      if (l.axis !== 'y') errs.push('the hole must run vertically (axis Y) through the 20 mm height');
      const top = l.pos[1] + l.len / 2,
        bot = l.pos[1] - l.len / 2;
      if (l.axis === 'y' && !(top > 20 && bot < 0)) errs.push(`the cylinder spans y ${fmt(bot)}…${fmt(top)}; it must stick out above 20 and below 0`);
      if (!(near(l.pos[0], 0, 1) && near(l.pos[2], 0, 1))) errs.push(`hole centre at x ${fmt(l.pos[0])}, z ${fmt(l.pos[2])}; should be at 0, 0`);
    } else {
      if (!(near(l.a[0], 30) && near(l.a[1], 30) && near(l.a[2], 30))) errs.push(`cube is ${l.a.join(' × ')}, needs 30 × 30 × 30`);
      if (l.op !== 'intersect') errs.push('operation must be Intersect');
      if (l.tool !== 'sphere' || !near(l.r * 2, 40, 0.4)) errs.push('the tool must be a Ø40 sphere');
      if (!(near(l.pos[0], 0, 1) && near(l.pos[1], 15, 1) && near(l.pos[2], 0, 1))) errs.push(`sphere centre (${l.pos.map((v) => fmt(v)).join(', ')}) should be the cube centre (0, 15, 0)`);
    }
    return errs;
  };

  const evaluate = (): Feedback => {
    const correct: string[] = [];
    const issues: Feedback['issues'] = [];
    let sc = 0;
    locked.forEach((l, i) => {
      if (!l) return issues.push({ label: `${TASKS[i].name}: not locked in.` });
      const e = check(i, l);
      const v = meshVolumeArea(getGeometry(build(l).R)).volume;
      if (!e.length) {
        sc++;
        correct.push(`${TASKS[i].name}: correct — measured volume ${fmt(v / 1000, 2)} cm³.`);
      } else {
        sc += Math.max(0, 1 - e.length * 0.25);
        issues.push({ label: `${TASKS[i].name}: ${e[0]}.`, detail: e.slice(1).join('; ') || undefined });
      }
    });
    return {
      score: Math.round((sc / 2) * 100),
      correct,
      issues,
      why: 'Holes, slots, pockets and rounded blanks are mostly Boolean operations. Thinking “which simple solid do I add or remove?” is the fastest way to model real parts — and the through-hole rule prevents parts that look right on screen but cannot be assembled.',
      suggestion: 'For a through-hole, make the cylinder a few millimetres longer than the material it cuts and centre it on the part.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w3-l7"
      steps={steps}
      evaluate={evaluate}
      onRetry={() => setS(INIT)}
      hints={[{ en: 'Through-hole: cylinder Ø10 (radius 5), axis Y, length 30, centre (0, 10, 0).', ta: 'முழுத் துளை: Ø10 cylinder, அச்சு Y, நீளம் 30, மையம் (0, 10, 0).' }]}
      viewport={
        <Stage3D fit={90} camera={[90, 80, 110]} target={[0, 10, 0]} env>
          <ObjectMesh o={R} edges />
          {ghost && (
            <>
              <Ghost o={A as SceneObject} color="#4cc9f0" />
              <Ghost o={B as SceneObject} color="#f8961e" />
            </>
          )}
        </Stage3D>
      }
    >
      <div className="card" style={{ padding: 10 }}>
        <div className="btnrow">
          {TASKS.map((tk, i) => (
            <button key={i} className={`btn small ${task === i ? 'on' : ''}`} onClick={() => setTask(i)}>
              {locked[i] ? '🔒 ' : ''}
              {tk.name}
            </button>
          ))}
        </div>
        <p style={{ margin: '8px 0', fontSize: 14 }}>{TASKS[task].text}</p>
      </div>
      <Seg value={s.op} onChange={(op) => set({ op })} options={[{ v: 'union', label: '∪ Union' }, { v: 'subtract', label: '− Subtract' }, { v: 'intersect', label: '∩ Intersect' }]} />
      <Toggle checked={ghost} onChange={setGhost} label="Show tools (ghosts)" />
      <div className="lbl">Blue block W × H × D (mm)</div>
      <div className="numrow">
        {[0, 1, 2].map((i) => (
          <NumberField key={i} axis={(['x', 'y', 'z'] as const)[i]} value={s.a[i]} digits={1} min={2} max={150} onChange={(v) => set({ a: s.a.map((q, k) => (k === i ? v : q)) as Vec3 })} />
        ))}
      </div>
      <div className="lbl">Orange tool</div>
      <Seg value={s.tool} onChange={(tool) => set({ tool })} options={[{ v: 'cylinder', label: 'Cylinder' }, { v: 'sphere', label: 'Sphere' }, { v: 'box', label: 'Cube' }]} />
      <Slider label={s.tool === 'box' ? 'Half-size' : 'Radius'} value={s.r} min={1} max={40} step={0.5} unit="mm" onChange={(r) => set({ r })} />
      {s.tool === 'cylinder' && (
        <>
          <Slider label="Length" value={s.len} min={2} max={120} step={1} unit="mm" onChange={(len) => set({ len })} />
          <Seg value={s.axis} onChange={(axis) => set({ axis })} options={[{ v: 'x', label: 'Axis X', cls: 'x' }, { v: 'y', label: 'Axis Y', cls: 'y' }, { v: 'z', label: 'Axis Z', cls: 'z' }]} />
        </>
      )}
      <div className="lbl">Tool centre (mm)</div>
      {[0, 1, 2].map((i) => (
        <NumberField key={i} axis={(['x', 'y', 'z'] as const)[i]} value={s.pos[i]} digits={1} onChange={(v) => set({ pos: s.pos.map((q, k) => (k === i ? v : q)) as Vec3 })} />
      ))}
      <div className="formula">Result volume (measured from mesh): {fmt(vol / 1000, 2)} cm³</div>
      <button className="btn small accent" onClick={() => { setLocked(locked.map((l, i) => (i === task ? { ...s } : l))); if (task === 0) setTask(1); }}>
        Lock in “{TASKS[task].name}”
      </button>
      {TASKS.map((tk, i) => (
        <Task key={i} ok={!!locked[i] && check(i, locked[i]!).length === 0}>
          {tk.name}: {locked[i] ? (check(i, locked[i]!).length ? 'locked — needs fixes' : 'locked ✓') : 'not locked'}
        </Task>
      ))}
    </LevelShell>
  );
}
