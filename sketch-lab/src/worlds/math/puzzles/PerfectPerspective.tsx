import { useMemo, useState } from 'react';
import { dist, fmt, randInt, type Vec } from '../../../core/geometry';
import { useHistory } from '../../../core/history';
import { BOX_EDGES, boxCorners, boxDirections, project, vanishingPoint, type Cam } from '../../../core/perspective';
import { useSettings, type Difficulty } from '../../../core/store';
import { Challenge, type CheckResult } from '../../../ui/feedback';
import { DesignLink, Note, Toggle, ToolBar } from '../../../ui/kit';
import { Workbench } from '../../../ui/lesson';
import { Handle } from '../../../ui/svg';
import { SketchLayer, type Stroke } from '../tools/SketchLayer';

const VX = -150;
const VW = 1100;
const VH = 520;

function makeScene() {
  for (;;) {
    const cam: Cam = { x: 0, y: randInt(5, 30) / 10, z: 0, yaw: 0, f: randInt(300, 420), u0: 400, v0: randInt(170, 260) };
    const yaw = randInt(22, 68);
    const z = randInt(60, 95) / 10;
    const corners = boxCorners(randInt(-10, 10) / 10, z, randInt(18, 30) / 10, randInt(10, 20) / 10, randInt(15, 25) / 10, yaw);
    const [d1, d2] = boxDirections(yaw);
    const v1 = vanishingPoint(cam, d1);
    const v2 = vanishingPoint(cam, d2);
    const pts = corners.map((p) => project(cam, p));
    if (!v1 || !v2 || pts.some((p) => !p)) continue;
    if ([v1, v2].some((v) => v.x < VX + 30 || v.x > VX + VW - 30)) continue;
    const [left, right] = v1.x < v2.x ? [v1, v2] : [v2, v1];
    return { cam, corners, pts: pts as Vec[], left, right, dirOfEdge: (i: number) => (i % 2 === 0 ? (v1.x < v2.x ? 'L' : 'R') : v1.x < v2.x ? 'R' : 'L') };
  }
}

const TOL: Record<Difficulty, number> = { easy: 28, normal: 16, hard: 9 };

export default function PerfectPerspective() {
  const { difficulty } = useSettings();
  const [scene, setScene] = useState(makeScene);
  const h = useHistory({ L: { x: 120, y: 120 } as Vec, R: { x: 700, y: 120 } as Vec, r1a: { x: -100, y: 470 } as Vec, r1b: { x: 100, y: 440 } as Vec, r2a: { x: 750, y: 470 } as Vec, r2b: { x: 900, y: 440 } as Vec });
  const s = h.value;
  const [hints, setHints] = useState(false);
  const [solved, setSolved] = useState(false);
  const [sketch, setSketch] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [showTrue, setShowTrue] = useState(false);
  const tol = TOL[difficulty];
  const errL = dist(s.L, scene.left);
  const errR = dist(s.R, scene.right);

  const infinite = (a: Vec, b: Vec) => {
    const d = { x: b.x - a.x, y: b.y - a.y };
    const L = Math.hypot(d.x, d.y) || 1;
    return { x1: a.x - (d.x / L) * 3000, y1: a.y - (d.y / L) * 3000, x2: a.x + (d.x / L) * 3000, y2: a.y + (d.y / L) * 3000 };
  };

  const edgeHints = useMemo(() => BOX_EDGES.slice(0, 8).map(([a, b], i) => {
    const vp = scene.dirOfEdge(i) === 'L' ? scene.left : scene.right;
    const pa = scene.pts[a];
    const pb = scene.pts[b];
    const near = dist(pa, vp) < dist(pb, vp) ? pa : pb;
    const far = near === pa ? pb : pa;
    const d = { x: near.x - far.x, y: near.y - far.y };
    const L = Math.hypot(d.x, d.y) || 1;
    return { from: near, to: { x: near.x + (d.x / L) * 160, y: near.y + (d.y / L) * 160 } };
  }), [scene]);

  const tool = (
    <svg className="tool" viewBox={`${VX} 0 ${VW} ${VH}`}>
      <rect x={VX} y={0} width={VW} height={VH} fill="#fff" />
      <rect x={VX} y={scene.cam.v0} width={VW} height={VH} fill="#f8f9fa" />
      {(hints || showTrue) && edgeHints.map((e, i) => <line key={i} x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y} stroke="#e8590c" strokeDasharray="5 4" strokeWidth={1.5} />)}
      {showTrue && [scene.left, scene.right].map((v, i) => <circle key={i} cx={v.x} cy={v.y} r={12} fill="none" stroke="#2b8a3e" strokeWidth={3} />)}
      {BOX_EDGES.map(([a, b], i) => <line key={i} x1={scene.pts[a].x} y1={scene.pts[a].y} x2={scene.pts[b].x} y2={scene.pts[b].y} stroke="#1f2a44" strokeWidth={3} strokeLinecap="round" />)}
      <line {...infinite(s.r1a, s.r1b)} stroke="#7048e8" strokeWidth={1.5} />
      <line {...infinite(s.r2a, s.r2b)} stroke="#0c8599" strokeWidth={1.5} />
      <line x1={s.L.x} y1={s.L.y} x2={s.R.x} y2={s.R.y} stroke="#e5484d" strokeWidth={1.5} strokeDasharray="8 4" />
      {solved && <line x1={VX} y1={(s.L.y + s.R.y) / 2} x2={VX + VW} y2={(s.L.y + s.R.y) / 2} stroke="#e5484d" strokeWidth={2} />}
      <g transform={`translate(${VX} 0)`}>
        <SketchLayer active={sketch} strokes={strokes} onStrokes={setStrokes} width={VW} height={VH} />
      </g>
      {!sketch && (
        <>
          <Handle x={s.r1a.x} y={s.r1a.y} r={7} color="#7048e8" onStart={h.checkpoint} onDrag={(p) => h.set((st) => ({ ...st, r1a: p }))} title="ruler 1 end" />
          <Handle x={s.r1b.x} y={s.r1b.y} r={7} color="#7048e8" onStart={h.checkpoint} onDrag={(p) => h.set((st) => ({ ...st, r1b: p }))} title="ruler 1 end" />
          <Handle x={s.r2a.x} y={s.r2a.y} r={7} color="#0c8599" onStart={h.checkpoint} onDrag={(p) => h.set((st) => ({ ...st, r2a: p }))} title="ruler 2 end" />
          <Handle x={s.r2b.x} y={s.r2b.y} r={7} color="#0c8599" onStart={h.checkpoint} onDrag={(p) => h.set((st) => ({ ...st, r2b: p }))} title="ruler 2 end" />
          <Handle x={s.L.x} y={s.L.y} r={11} color="#e5484d" label="VP L" onStart={h.checkpoint} onDrag={(p) => h.set((st) => ({ ...st, L: p }))} />
          <Handle x={s.R.x} y={s.R.y} r={11} color="#e5484d" label="VP R" onStart={h.checkpoint} onDrag={(p) => h.set((st) => ({ ...st, R: p }))} />
        </>
      )}
    </svg>
  );
  const check = (): CheckResult => {
    const okL = errL <= tol;
    const okR = errR <= tol;
    const level = Math.abs(s.L.y - s.R.y);
    if (okL && okR) {
      setSolved(true);
      return { ok: true, happened: `Both vanishing points within ${fmt(Math.max(errL, errR), 0)} px. The red line between them is the horizon — your eye level.`, why: 'Now switch on “Sketch over it” and draw your own box using these two points.' };
    }
    setHints(true);
    return {
      ok: false,
      happened: <>Left VP is {fmt(errL, 0)} px off{okL ? ' ✓' : ''}, right VP is {fmt(errR, 0)} px off{okR ? ' ✓' : ''}. The orange dashes show which way the box's edges are heading.</>,
      why: level > 15 ? 'Your two VPs are at different heights. For a box standing on the ground both sit on one horizontal line: the horizon.' : 'A vanishing point is where two parallel box edges meet when you extend them. Lay a ruler along each of two parallel edges — the crossing is the VP.',
    };
  };
  const panel = (
    <Challenge
      id="puzzle-perspective"
      title="Perfect Perspective"
      brief={<><p>This box was drawn by a real perspective camera. Drag the two red <b>VP</b> markers to its vanishing points. Use the purple and teal <b>rulers</b> (drag their ends) to extend edges.</p><p className="muted small">Tolerance {tol} px.</p></>}
      check={check}
      onResult={(r) => { if (!r) setHints(false); }}
      onNewTarget={() => { setScene(makeScene()); setSolved(false); setHints(false); setShowTrue(false); setStrokes([]); h.reset(); }}
      hint="Pick two edges that are parallel on the real box (e.g. the top-left edge and the bottom-left edge). Put one ruler on each. Where the rulers cross is the left VP."
      solution={<><p>The true vanishing points are circled in green.</p><button className="btn small" onClick={() => setShowTrue(true)}>Show them</button></>}
    >
      <div className="toolbar" style={{ marginTop: 8 }}>
        <Toggle label="✏️ Sketch over it" checked={sketch} onChange={setSketch} />
        {strokes.length > 0 && <button className="btn small" onClick={() => setStrokes(strokes.slice(0, -1))}>↶ stroke</button>}
      </div>
      {solved && <Note kind="design">Your VPs and horizon are now guides. Sketch a second box beside the first — every horizontal edge must head to VP L or VP R.</Note>}
      <DesignLink>Artists find vanishing points in photos exactly like this before drawing a product into the scene.</DesignLink>
    </Challenge>
  );
  return <Workbench title="Perfect Perspective" tool={tool} controls={<ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />} panel={panel} />;
}
