import { useMemo, useState, type ReactNode } from 'react';
import { angleAt, clamp, degToRad, dist, fmt, headingDeg, lineIntersection, randInt, radToDeg, type Vec } from '../../../core/geometry';
import { useHistory } from '../../../core/history';
import { BOX_EDGES, boxCorners, boxDirections, project, projectSegment, vanishingPoint, type Cam, type P3 } from '../../../core/perspective';
import { useSettings, type Difficulty } from '../../../core/store';
import { Challenge, ChoiceQuiz, NumberQuiz, type CheckResult } from '../../../ui/feedback';
import { DesignLink, Formula, Note, NumberTable, Slider, Steps, T, Toggle, ToolBar } from '../../../ui/kit';
import { Lesson, Workbench, type StageKey } from '../../../ui/lesson';
import { Handle } from '../../../ui/svg';
import { SketchLayer, type Stroke } from '../tools/SketchLayer';

const W = 800;

function Seg({ s, color = '#1f2a44', width = 2, dash }: { s: [Vec, Vec] | null; color?: string; width?: number; dash?: string }) {
  if (!s) return null;
  return <line x1={s[0].x} y1={s[0].y} x2={s[1].x} y2={s[1].y} stroke={color} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />;
}

function BoxWire({ cam, corners, color = '#1f2a44', width = 2.2 }: { cam: Cam; corners: P3[]; color?: string; width?: number }) {
  return <>{BOX_EDGES.map(([a, b], i) => <Seg key={i} s={projectSegment(cam, corners[a], corners[b])} color={color} width={width} />)}</>;
}

function GroundGrid({ cam, range = 8, far = 40, step = 2 }: { cam: Cam; range?: number; far?: number; step?: number }) {
  const lines: ReactNode[] = [];
  for (let x = -range; x <= range; x += step) lines.push(<Seg key={`x${x}`} s={projectSegment(cam, { x, y: 0, z: 0 }, { x, y: 0, z: far })} color="#dee2e6" width={1} />);
  for (let z = 0; z <= far; z += step) lines.push(<Seg key={`z${z}`} s={projectSegment(cam, { x: -range, y: 0, z }, { x: range, y: 0, z })} color="#dee2e6" width={1} />);
  return <>{lines}</>;
}

/* ================================================================== */
/* Camera & projection                                                 */
/* ================================================================== */

const POSTS = [{ x: -2, z: 5 }, { x: 1, z: 10 }, { x: 3, z: 15 }];
const PX = (x: number) => 190 + x * 17;
const PZ = (z: number) => 440 - (z + 2) * 18;
const FRAME = { x: 400, y: 70, w: 380, h: 285 };

function CameraLesson() {
  const h = useHistory({ x: 0, z: -1, yaw: 0, f: 300, eye: 1.6 });
  const s = h.value;
  const cam: Cam = { x: s.x, y: s.eye, z: s.z, yaw: s.yaw, f: s.f, u0: FRAME.x + FRAME.w / 2, v0: FRAME.y + FRAME.h / 2 };
  const half = radToDeg(Math.atan(FRAME.w / 2 / s.f));
  const fwd = { x: Math.sin(degToRad(s.yaw)), z: Math.cos(degToRad(s.yaw)) };
  const camP = { x: PX(s.x), y: PZ(s.z) };
  const yawH = { x: PX(s.x + fwd.x * 3), y: PZ(s.z + fwd.z * 3) };
  const wedge = (a: number) => ({ x: PX(s.x + Math.sin(degToRad(s.yaw + a)) * 30), y: PZ(s.z + Math.cos(degToRad(s.yaw + a)) * 30) });
  const postInfo = POSTS.map((p) => {
    const top = project(cam, { x: p.x, y: 2, z: p.z });
    const bot = project(cam, { x: p.x, y: 0, z: p.z });
    const depth = (p.x - s.x) * fwd.x + (p.z - s.z) * fwd.z;
    return { top, bot, depth, px: top && bot ? bot.y - top.y : 0 };
  });
  const rug = [{ x: -1, y: 0, z: 3 }, { x: 1, y: 0, z: 3 }, { x: 1, y: 0, z: 9 }, { x: -1, y: 0, z: 9 }];
  const rugP = rug.map((p) => project(cam, p));
  const colors = ['#e8590c', '#1c7ed6', '#2b8a3e'];
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 460`}>
      <defs>
        <clipPath id="camframe"><rect x={FRAME.x} y={FRAME.y} width={FRAME.w} height={FRAME.h} /></clipPath>
        <clipPath id="planclip"><rect x={10} y={20} width={370} height={430} /></clipPath>
      </defs>
      {/* plan view */}
      <text x={14} y={16} className="svg-label small" fill="#495057">PLAN — seen from above</text>
      <g clipPath="url(#planclip)">
        {Array.from({ length: 13 }, (_, i) => <line key={`gx${i}`} x1={PX(i - 6)} y1={20} x2={PX(i - 6)} y2={450} stroke="#f1f3f5" />)}
        {Array.from({ length: 23 }, (_, i) => <line key={`gz${i}`} x1={10} y1={PZ(i - 2)} x2={380} y2={PZ(i - 2)} stroke="#f1f3f5" />)}
        <path d={`M${camP.x} ${camP.y} L${wedge(-half).x} ${wedge(-half).y} L${wedge(half).x} ${wedge(half).y} Z`} fill="#ffd43b33" stroke="#fab005" strokeDasharray="4 4" />
        <path d={`M${PX(-1)} ${PZ(3)} L${PX(1)} ${PZ(3)} L${PX(1)} ${PZ(9)} L${PX(-1)} ${PZ(9)} Z`} fill="#e599f755" stroke="#ae3ec9" />
        {POSTS.map((p, i) => (
          <g key={i}>
            <line x1={camP.x} y1={camP.y} x2={PX(p.x)} y2={PZ(p.z)} stroke={colors[i]} strokeDasharray="3 4" />
            <rect x={PX(p.x) - 5} y={PZ(p.z) - 5} width={10} height={10} fill={colors[i]} />
            <text x={PX(p.x) + 9} y={PZ(p.z) + 4} fontSize={11} fill={colors[i]}>{fmt(postInfo[i].depth, 1)} m</text>
          </g>
        ))}
      </g>
      <Handle x={camP.x} y={camP.y} color="#1f2a44" r={10} title="move the camera" onStart={h.checkpoint}
        onDrag={(p) => h.set((st) => ({ ...st, x: clamp((p.x - 190) / 17, -6, 6), z: clamp((440 - p.y) / 18 - 2, -2, 4) }))}>
        <text y={4} fontSize={11} textAnchor="middle" fill="#fff" pointerEvents="none">📷</text>
      </Handle>
      <Handle x={yawH.x} y={yawH.y} r={7} color="#fab005" title="turn the camera" onStart={h.checkpoint}
        onDrag={(p) => h.set((st) => ({ ...st, yaw: clamp(Math.round(90 - headingDeg(camP, p)), -50, 50) }))} />
      {/* image */}
      <text x={FRAME.x} y={FRAME.y - 8} className="svg-label small" fill="#495057">WHAT THE CAMERA SEES (picture plane)</text>
      <rect x={FRAME.x} y={FRAME.y} width={FRAME.w} height={FRAME.h} fill="#f8f9fa" stroke="#1f2a44" strokeWidth={2} />
      <g clipPath="url(#camframe)">
        <rect x={FRAME.x} y={cam.v0} width={FRAME.w} height={FRAME.h} fill="#f1f3f5" />
        <GroundGrid cam={cam} />
        {rugP.every(Boolean) && <path d={rugP.map((p, i) => `${i ? 'L' : 'M'}${p!.x} ${p!.y}`).join(' ') + 'Z'} fill="#e599f777" stroke="#ae3ec9" strokeWidth={2} />}
        <line x1={FRAME.x} y1={cam.v0} x2={FRAME.x + FRAME.w} y2={cam.v0} stroke="#e5484d" strokeWidth={1.5} strokeDasharray="8 4" />
        {[...POSTS].map((p, i) => ({ p, i })).sort((a, b) => postInfo[b.i].depth - postInfo[a.i].depth).map(({ p, i }) => (
          <BoxWire key={i} cam={cam} corners={boxCorners(p.x, p.z, 0.6, 2, 0.6, 0)} color={colors[i]} width={2.5} />
        ))}
        {postInfo.map((pi, i) => pi.top && pi.bot && (
          <text key={i} x={pi.top.x + 8} y={pi.top.y - 4} fontSize={11} fontWeight={700} fill={colors[i]}>{fmt(pi.px, 0)} px</text>
        ))}
      </g>
      <text x={FRAME.x + FRAME.w - 4} y={cam.v0 - 4} textAnchor="end" fontSize={11} fill="#e5484d">horizon (eye level)</text>
      <text x={FRAME.x} y={FRAME.y + FRAME.h + 20} fontSize={12} fill="#495057">Three identical posts, 2 m tall. Purple rug: 2 × 6 m on the floor.</text>
    </svg>
  );
  const controls = (
    <>
      <Slider label="Zoom (focal length f)" value={s.f} min={120} max={700} unit="px" onStart={h.checkpoint} onChange={(x) => h.set((st) => ({ ...st, f: x }))} />
      <Slider label="Eye height" value={s.eye} min={0.2} max={4} step={0.1} unit="m" onStart={h.checkpoint} onChange={(x) => h.set((st) => ({ ...st, eye: x }))} />
      <Slider label="Turn camera" value={s.yaw} min={-50} max={50} unit="°" onStart={h.checkpoint} onChange={(x) => h.set((st) => ({ ...st, yaw: x }))} />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>Left: the scene from above, with a camera 📷. Right: the flat picture the camera makes. Three posts are exactly the same size — but not in the picture.</p>,
    touch: <p>Drag the 📷 in the plan. Turn it with the yellow dot. Change zoom and eye height.</p>,
    experiment: (
      <ul>
        <li>Walk the camera towards the posts. Which one grows fastest?</li>
        <li>Lower the eye height to the floor. Raise it to 4 m. Watch the red horizon line and the rug.</li>
        <li>Zoom in and out.</li>
      </ul>
    ),
    discover: (
      <>
        <ChoiceQuiz question="One post is twice as far away as another. In the picture it is…" options={[{ label: 'half as tall', correct: true, why: 'Picture height = f × real height ÷ distance. Double the distance → half the height. Check the px labels.' }, { label: 'the same height', why: 'Look at the px numbers next to each post.' }, { label: 'a quarter as tall', why: 'Size shrinks with distance, not distance squared.' }]} />
        <ChoiceQuiz question="The 6 m long rug looks much shorter than it is. This is called…" options={[{ label: 'foreshortening', correct: true, why: 'Lengths pointing away from you are squashed in the picture.' }, { label: 'symmetry', why: 'Symmetry is about mirror halves.' }]} />
      </>
    ),
    understand: (
      <>
        <p>Light from each point travels in a straight line into the camera. Where that line crosses the picture is where the point appears.</p>
        <p>Far things make smaller angles at your eye, so they look smaller: <b>relative scale</b>. The floor rises towards the <T k="horizon" />, which is always at <b>eye level</b>.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'h', means: 'height in the picture (px)', color: '#e8590c' }, ' = ', { s: 'f', means: 'focal length (zoom), in px', color: '#1f2a44' }, ' × ', { s: 'H', means: 'real height', color: '#2b8a3e' }, ' ÷ ', { s: 'z', means: 'distance in front of the camera', color: '#1c7ed6' }]} />
        <NumberQuiz question="f = 300 px. A 2 m post stands 12 m away. How tall is it in the picture? (px)" answer={50} unit="px" hint="300 × 2 ÷ 12." solution={<Steps steps={['300 × 2 = 600', '600 ÷ 12 = 50 px']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Sketch the far end of a product a little smaller than the near end — that is what makes it look 3D.</li>
          <li>Wide-angle lenses (small f) exaggerate perspective; telephoto (large f) flattens it. Product photos often use a long lens.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={postInfo.map((pi, i) => [`post ${i + 1} (${['orange', 'blue', 'green'][i]})`, `${fmt(pi.depth, 2)} m away → ${fmt(s.f, 0)} × 2 ÷ ${fmt(pi.depth, 2)} = ${fmt(pi.px, 1)} px`] as [ReactNode, ReactNode])
      .concat([['horizon', `${fmt(s.eye, 1)} m above the floor (eye level)`], ['field of view', `${fmt(2 * half, 1)}°`]])} />
  );
  return <Lesson id="l10-camera" title="Camera & projection" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Horizon & vanishing points                                          */
/* ================================================================== */

function VpLesson() {
  const h = useHistory({ yaw: 35, eye: 2.2, z: 6, f: 340, grid: true });
  const s = h.value;
  const cam: Cam = { x: 0, y: s.eye, z: 0, yaw: 0, f: s.f, u0: 400, v0: 210 };
  const corners = boxCorners(0, s.z, 3, 1.6, 2, s.yaw);
  const [d1, d2] = boxDirections(s.yaw);
  const vp1 = vanishingPoint(cam, d1);
  const vp2 = vanishingPoint(cam, d2);
  const cols = ['#1c7ed6', '#e8590c'];
  const pc = corners.map((p) => project(cam, p));
  const ext: ReactNode[] = [];
  BOX_EDGES.slice(0, 8).forEach(([a, b], i) => {
    const vp = i % 2 === 0 ? vp1 : vp2;
    const col = i % 2 === 0 ? cols[0] : cols[1];
    const pa = pc[a];
    const pb = pc[b];
    if (!vp || !pa || !pb) return;
    const far = dist(pa, vp) > dist(pb, vp) ? pa : pb;
    ext.push(<line key={i} x1={far.x} y1={far.y} x2={vp.x} y2={vp.y} stroke={col} strokeWidth={1.2} strokeDasharray="5 5" opacity={0.8} />);
  });
  const above = s.eye > 1.6;
  const points = vp1 && vp2 ? 'two-point perspective' : 'one-point perspective';
  const tool = (
    <svg className="tool" viewBox={`-200 0 1200 460`}>
      <rect x={-200} y={cam.v0} width={1200} height={250} fill="#f1f3f5" />
      {s.grid && <GroundGrid cam={cam} range={16} far={60} step={2} />}
      <line x1={-200} y1={cam.v0} x2={1000} y2={cam.v0} stroke="#e5484d" strokeWidth={2} />
      <text x={-190} y={cam.v0 - 6} className="svg-label small" fill="#e5484d">horizon = your eye level ({fmt(s.eye, 1)} m)</text>
      {ext}
      <BoxWire cam={cam} corners={corners} width={3} />
      {[vp1, vp2].map((vp, i) => vp && (
        <g key={i}>
          <circle cx={vp.x} cy={vp.y} r={9} fill={cols[i]} />
          <text x={vp.x} y={vp.y - 16} textAnchor="middle" className="svg-label" fill={cols[i]}>VP {i + 1}</text>
        </g>
      ))}
      {!vp1 && <text x={980} y={cam.v0 + 24} textAnchor="end" className="svg-label small" fill={cols[0]}>blue edges stay parallel (no VP)</text>}
      {!vp2 && <text x={980} y={cam.v0 + 24} textAnchor="end" className="svg-label small" fill={cols[1]}>orange edges stay parallel (no VP)</text>}
    </svg>
  );
  const controls = (
    <>
      <Slider label="Turn the box" value={s.yaw} min={0} max={90} unit="°" onStart={h.checkpoint} onChange={(x) => h.set((st) => ({ ...st, yaw: x }))} />
      <Slider label="Your eye height" value={s.eye} min={0.3} max={5} step={0.1} unit="m" onStart={h.checkpoint} onChange={(x) => h.set((st) => ({ ...st, eye: x }))} />
      <Slider label="Box distance" value={s.z} min={4} max={20} step={0.5} unit="m" onStart={h.checkpoint} onChange={(x) => h.set((st) => ({ ...st, z: x }))} />
      <Slider label="Lens (focal length)" value={s.f} min={200} max={800} unit="px" onStart={h.checkpoint} onChange={(x) => h.set((st) => ({ ...st, f: x }))} />
      <Toggle label="Perspective grid on the floor" checked={s.grid} onChange={(v) => h.commit((st) => ({ ...st, grid: v }))} />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()}>
        <button className="btn small" onClick={() => h.commit((st) => ({ ...st, yaw: 0 }))}>One-point view</button>
        <button className="btn small" onClick={() => h.commit((st) => ({ ...st, yaw: 35 }))}>Two-point view</button>
      </ToolBar>
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A box (1.6 m tall) drawn by a real perspective camera. Its edges, continued as dashed lines, meet at <T k="vanishingPoint" plural />, sitting on the red <T k="horizon" />.</p>,
    touch: <p>Turn the box. Raise and lower your eye. Move the box nearer and further.</p>,
    experiment: (
      <ul>
        <li>Turn the box to 0°: one set of edges stops converging — <b>one-point perspective</b>.</li>
        <li>Put your eye below 1.6 m: can you still see the top of the box?</li>
        <li>Change the lens: what happens to the distance between the VPs?</li>
      </ul>
    ),
    discover: (
      <>
        <ChoiceQuiz question="Where do the vanishing points of flat (horizontal) edges always sit?" options={[{ label: 'On the horizon line', correct: true, why: 'Horizontal lines meet at eye level, whatever their direction.' }, { label: 'At the top of the picture', why: 'Raise your eye: the VPs move with the horizon, not to the top.' }, { label: 'Anywhere', why: 'Turn the box — the VPs slide along the horizon but never leave it.' }]} />
        <ChoiceQuiz question="Your eye is lower than the top of the box. Do you see its top face?" options={[{ label: 'No', correct: true, why: 'The top is above eye level, so you look up at it from below. Set the eye to 1.0 m to check.' }, { label: 'Yes', why: 'Try eye height 1.0 m: the top face disappears.' }]} />
      </>
    ),
    understand: (
      <>
        <p>Parallel lines in the world <b>seem</b> to meet at one point in the picture: their vanishing point.</p>
        <p>Each direction has its own VP. Lines parallel to the picture (verticals, or edges facing you square-on) never converge.</p>
        <p>Above the horizon you see undersides; below it you see tops.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'u', means: 'distance of the VP from the picture centre, along the horizon', color: '#1c7ed6' }, ' = ', { s: 'f', means: 'focal length (px)', color: '#1f2a44' }, ' × tan ', { s: 'β', means: 'angle between the edges and your viewing direction', color: '#e8590c' }]} />
        <NumberQuiz question="f = 400 px. Edges point 45° away from your line of sight. How far from the centre is their VP? (px)" answer={400} unit="px" hint="tan 45° = 1." solution={<Steps steps={['400 × tan 45°', '= 400 × 1 = 400 px']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Start every product sketch with a horizon line and two VPs. Every edge goes to a VP or straight up.</li>
          <li>VPs far apart → calm, realistic look. VPs close together → dramatic, distorted look.</li>
          <li>Show the top of a product by placing the horizon above it.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['view type', points],
      ['VP 1 (blue edges)', vp1 ? `(${fmt(vp1.x - 400, 0)}, 0) px from centre` : 'none — parallel'],
      ['VP 2 (orange edges)', vp2 ? `(${fmt(vp2.x - 400, 0)}, 0) px from centre` : 'none — parallel'],
      ['eye height vs box top (1.6 m)', above ? 'above → you see the top' : 'below → top hidden'],
      ['f × tan(box angle)', vp1 ? `${s.f} × tan ${s.yaw}° = ${fmt(s.f * Math.tan(degToRad(s.yaw)), 0)} px` : '—'],
    ]} />
  );
  return <Lesson id="l10-vp" title="Horizon & vanishing points" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Challenge: two-point box                                            */
/* ================================================================== */

interface BoxTask {
  hy: number;
  vl: Vec;
  vr: Vec;
  T: Vec;
  B: Vec;
  back: boolean;
  tol: number;
  guides: boolean;
}

function boxTask(d: Difficulty): BoxTask {
  const hy = randInt(150, 220);
  const fx = randInt(340, 460);
  const by = randInt(380, 430);
  const ht = randInt(100, 150);
  return {
    hy,
    vl: { x: randInt(30, 140), y: hy },
    vr: { x: randInt(660, 770), y: hy },
    T: { x: fx, y: Math.max(hy + 40, by - ht) },
    B: { x: fx, y: by },
    back: d === 'hard',
    tol: d === 'easy' ? 2 : d === 'normal' ? 1.2 : 0.8,
    guides: d === 'easy',
  };
}

interface BoxPts {
  LT: Vec;
  LB: Vec;
  RT: Vec;
  RB: Vec;
  K: Vec;
}

function initialPts(t: BoxTask): BoxPts {
  return {
    LT: { x: t.T.x - 150, y: t.T.y },
    LB: { x: t.B.x - 150, y: t.B.y },
    RT: { x: t.T.x + 160, y: t.T.y },
    RB: { x: t.B.x + 160, y: t.B.y },
    K: { x: t.T.x + 10, y: t.T.y - 40 },
  };
}

function missAngle(anchor: Vec, p: Vec, vp: Vec) {
  return angleAt(p, anchor, vp);
}

function TwoPointChallenge() {
  const { difficulty } = useSettings();
  const [task, setTask] = useState(() => boxTask(difficulty));
  const h = useHistory<BoxPts>(() => initialPts(task));
  const [bad, setBad] = useState<string[]>([]);
  const [showSolution, setShowSolution] = useState(false);
  const [sketch, setSketch] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const p = h.value;
  const solK = useMemo(() => lineIntersection(p.LT, task.vr, p.RT, task.vl), [p.LT, p.RT, task]);
  const extend = (a: Vec, b: Vec, toX: number) => {
    const dx = b.x - a.x;
    if (Math.abs(dx) < 1e-6) return b;
    const t = (toX - a.x) / dx;
    return { x: toX, y: a.y + (b.y - a.y) * t };
  };
  const lines: { key: string; from: Vec; to: Vec; vp: Vec }[] = [
    { key: 'LT', from: task.T, to: p.LT, vp: task.vl },
    { key: 'LB', from: task.B, to: p.LB, vp: task.vl },
    { key: 'RT', from: task.T, to: p.RT, vp: task.vr },
    { key: 'RB', from: task.B, to: p.RB, vp: task.vr },
  ];
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 500`}>
      <line x1={0} y1={task.hy} x2={W} y2={task.hy} stroke="#e5484d" strokeWidth={1.5} />
      <text x={6} y={task.hy - 6} className="svg-label small" fill="#e5484d">horizon</text>
      {[task.vl, task.vr].map((v, i) => (
        <g key={i}><circle cx={v.x} cy={v.y} r={7} fill={i ? '#e8590c' : '#1c7ed6'} /><text x={v.x} y={v.y + 22} textAnchor="middle" className="svg-label small" fill={i ? '#e8590c' : '#1c7ed6'}>{i ? 'VP right' : 'VP left'}</text></g>
      ))}
      {task.guides && [task.T, task.B].flatMap((q, i) => [
        <line key={`gl${i}`} x1={q.x} y1={q.y} x2={task.vl.x} y2={task.vl.y} stroke="#1c7ed6" strokeDasharray="3 6" opacity={0.5} />,
        <line key={`gr${i}`} x1={q.x} y1={q.y} x2={task.vr.x} y2={task.vr.y} stroke="#e8590c" strokeDasharray="3 6" opacity={0.5} />,
      ])}
      {bad.length > 0 && lines.filter((l) => bad.includes(l.key)).map((l) => {
        const e = extend(l.from, l.to, l.vp.x);
        return (
          <g key={`x${l.key}`}>
            <line x1={l.to.x} y1={l.to.y} x2={e.x} y2={e.y} stroke="#e5484d" strokeDasharray="6 4" strokeWidth={1.5} />
            <line x1={e.x} y1={e.y} x2={l.vp.x} y2={l.vp.y} stroke="#e5484d" strokeWidth={3} />
          </g>
        );
      })}
      {/* the box */}
      <g stroke="#1f2a44" strokeWidth={3} strokeLinecap="round">
        <line x1={task.T.x} y1={task.T.y} x2={task.B.x} y2={task.B.y} strokeWidth={4} />
        <line x1={task.T.x} y1={task.T.y} x2={p.LT.x} y2={p.LT.y} />
        <line x1={task.B.x} y1={task.B.y} x2={p.LB.x} y2={p.LB.y} />
        <line x1={p.LT.x} y1={p.LT.y} x2={p.LB.x} y2={p.LB.y} />
        <line x1={task.T.x} y1={task.T.y} x2={p.RT.x} y2={p.RT.y} />
        <line x1={task.B.x} y1={task.B.y} x2={p.RB.x} y2={p.RB.y} />
        <line x1={p.RT.x} y1={p.RT.y} x2={p.RB.x} y2={p.RB.y} />
        {task.back && (
          <>
            <line x1={p.LT.x} y1={p.LT.y} x2={p.K.x} y2={p.K.y} />
            <line x1={p.RT.x} y1={p.RT.y} x2={p.K.x} y2={p.K.y} />
          </>
        )}
      </g>
      {showSolution && (
        <g stroke="#2b8a3e" strokeWidth={1.5} strokeDasharray="4 4" fill="none">
          <line x1={task.T.x} y1={task.T.y} x2={task.vl.x} y2={task.vl.y} />
          <line x1={task.B.x} y1={task.B.y} x2={task.vl.x} y2={task.vl.y} />
          <line x1={task.T.x} y1={task.T.y} x2={task.vr.x} y2={task.vr.y} />
          <line x1={task.B.x} y1={task.B.y} x2={task.vr.x} y2={task.vr.y} />
          {solK && task.back && <><line x1={p.LT.x} y1={p.LT.y} x2={task.vr.x} y2={task.vr.y} /><line x1={p.RT.x} y1={p.RT.y} x2={task.vl.x} y2={task.vl.y} /><circle cx={solK.x} cy={solK.y} r={8} /></>}
        </g>
      )}
      <SketchLayer active={sketch} strokes={strokes} onStrokes={setStrokes} width={W} height={500} />
      {!sketch && (
        <>
          {(['LT', 'LB', 'RT', 'RB'] as const).map((k) => (
            <Handle key={k} x={p[k].x} y={p[k].y} r={8} color={k[0] === 'L' ? '#1c7ed6' : '#e8590c'} highlight={bad.includes(k)} onStart={h.checkpoint}
              onDrag={(q) => h.set((st) => ({ ...st, [k]: { x: clamp(q.x, 0, W), y: clamp(q.y, 0, 500) } }))} />
          ))}
          {task.back && <Handle x={p.K.x} y={p.K.y} r={8} color="#7048e8" shape="diamond" highlight={bad.includes('K')} onStart={h.checkpoint} onDrag={(q) => h.set((st) => ({ ...st, K: q }))} />}
        </>
      )}
    </svg>
  );
  const check = (): CheckResult => {
    const wrong: string[] = [];
    const msgs: ReactNode[] = [];
    for (const l of lines) {
      const a = missAngle(l.from, l.to, l.vp);
      if (a > task.tol) {
        wrong.push(l.key);
        const e = extend(l.from, l.to, l.vp.x);
        msgs.push(<li key={l.key}><span className="no">✗</span> Edge to {l.key === 'LT' || l.key === 'RT' ? 'top' : 'bottom'} {l.key[0] === 'L' ? 'left' : 'right'} corner misses its VP by {fmt(a, 1)}° — it passes {e.y < l.vp.y ? 'above' : 'below'} it.</li>);
      }
    }
    if (Math.abs(p.LT.x - p.LB.x) > 4) { wrong.push('LT', 'LB'); msgs.push(<li key="lv"><span className="no">✗</span> The left back edge is not vertical (tilted {fmt(Math.abs(p.LT.x - p.LB.x), 0)} px).</li>); }
    if (Math.abs(p.RT.x - p.RB.x) > 4) { wrong.push('RT', 'RB'); msgs.push(<li key="rv"><span className="no">✗</span> The right back edge is not vertical.</li>); }
    if (task.back && solK && dist(p.K, solK) > 10) { wrong.push('K'); msgs.push(<li key="k"><span className="no">✗</span> The back corner is {fmt(dist(p.K, solK), 0)} px from where the two top edges meet.</li>); }
    setBad(wrong);
    if (!wrong.length) return { ok: true, happened: 'Every receding edge points exactly at its vanishing point, and the verticals are vertical.', why: 'That is a correct two-point perspective box. Try sketching over it!' };
    return {
      ok: false,
      happened: <><ul className="checklist">{msgs}</ul><div className="muted small">Red lines show where your edges really go.</div></>,
      why: 'In two-point perspective every horizontal edge must head straight for one of the two VPs on the horizon. Vertical edges stay vertical.',
    };
  };
  const panel = (
    <Challenge
      id="l10-challenge"
      title="Sketch a box in two-point perspective"
      brief={
        <>
          <p>The front edge, horizon and two vanishing points are given. Drag the <b style={{ color: '#1c7ed6' }}>blue</b> and <b style={{ color: '#e8590c' }}>orange</b> corners{task.back ? <> and the <b style={{ color: '#7048e8' }}>purple</b> back corner</> : null} to complete a correct box.</p>
          <p className="muted small">Tolerance {task.tol}°. {task.guides ? 'Easy mode: faint guide lines are shown.' : 'No guide lines — imagine them!'}</p>
        </>
      }
      check={check}
      onResult={(r) => { if (!r || r.ok) setBad([]); }}
      onNewTarget={() => { const t = boxTask(difficulty); setTask(t); h.reset(initialPts(t)); setBad([]); setShowSolution(false); setStrokes([]); }}
      hint="Imagine a straight line from the top of the front edge to each VP. The top corners must sit on those lines; then drop the back edges straight down."
      solution={<><p>The green dashed lines are the construction lines: put each corner on them, keep back edges vertical{task.back ? ', and the back corner where the two lines from the top corners cross' : ''}.</p><button className="btn small" onClick={() => setShowSolution(true)}>Show construction lines</button></>}
    >
      <div className="toolbar" style={{ marginTop: 8 }}>
        <Toggle label="✏️ Sketch over it" checked={sketch} onChange={setSketch} />
        {strokes.length > 0 && <button className="btn small" onClick={() => setStrokes(strokes.slice(0, -1))}>↶ stroke</button>}
      </div>
      {sketch && <Note kind="design">Sketch the box freehand along the construction. A pen with pressure gives thick and thin lines.</Note>}
    </Challenge>
  );
  return <Workbench title="Challenge: two-point box" tool={tool} controls={<ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset(initialPts(task))} />} panel={panel} />;
}

export default {
  'l10-camera': CameraLesson,
  'l10-vp': VpLesson,
  'l10-challenge': TwoPointChallenge,
};
