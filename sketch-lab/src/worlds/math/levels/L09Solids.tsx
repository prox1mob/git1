import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { fmt, pick, randInt } from '../../../core/geometry';
import { useHistory } from '../../../core/history';
import { useSettings, type Difficulty } from '../../../core/store';
import { Challenge, ChoiceQuiz, NumberQuiz, type CheckResult } from '../../../ui/feedback';
import { DesignLink, Formula, NumberTable, Segmented, Slider, Stat, Stats, Steps, T, Toggle, ToolBar, type Sym } from '../../../ui/kit';
import { Lesson, Workbench, type StageKey } from '../../../ui/lesson';
import { clearGroup, gridTexture, labelSprite, ThreeStage, type ThreeCtx } from '../tools/ThreeStage';

const FACE_COLORS = ['#ffa94d', '#74c0fc', '#8ce99a', '#ffd43b', '#e599f7', '#ff8787'];
const FACE_NAMES = ['bottom', 'front', 'back', 'left', 'right', 'top'];

function ViewButtons({ ctx }: { ctx: RefObject<ThreeCtx | null> }) {
  return (
    <div className="toolbar">
      <span className="muted small">View:</span>
      <button className="btn small" onClick={() => ctx.current?.view([0, 0.0001, 1])}>Front</button>
      <button className="btn small" onClick={() => ctx.current?.view([1, 0.0001, 0])}>Side</button>
      <button className="btn small" onClick={() => ctx.current?.view([0, 1, 0.0001])}>Top</button>
      <button className="btn small" onClick={() => ctx.current?.view([1, 0.85, 1.25])}>3D</button>
    </div>
  );
}

/* ================================================================== */
/* Cube explorer                                                       */
/* ================================================================== */

interface CubeParts {
  root: THREE.Group;
  pivots: { front: THREE.Object3D; back: THREE.Object3D; left: THREE.Object3D; right: THREE.Object3D; top: THREE.Object3D };
  faces: THREE.Mesh[];
  labels: THREE.Sprite[];
  edges: THREE.Group;
  verts: THREE.Group;
  units: THREE.InstancedMesh;
  refCube: THREE.Group;
}

function buildCube(group: THREE.Group, s: number): CubeParts {
  clearGroup(group);
  const root = new THREE.Group();
  group.add(root);
  const faces: THREE.Mesh[] = [];
  const labels: THREE.Sprite[] = [];
  const face = (i: number) => {
    const geo = new THREE.PlaneGeometry(s, s);
    const mat = new THREE.MeshStandardMaterial({ map: gridTexture(s, s, FACE_COLORS[i]), side: THREE.DoubleSide, roughness: 0.75, transparent: true, polygonOffset: true, polygonOffsetFactor: 1 });
    const m = new THREE.Mesh(geo, mat);
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#1f2a44' })));
    const lab = labelSprite(`${i + 1} · ${FACE_NAMES[i]}`, '#1f2a44', 0.45);
    lab.position.set(0, 0, 0.02);
    lab.visible = false;
    m.add(lab);
    labels.push(lab);
    faces.push(m);
    return m;
  };
  const bottom = face(0);
  bottom.rotation.x = Math.PI / 2;
  bottom.position.y = -s / 2;
  root.add(bottom);
  const mk = (x: number, z: number, faceIdx: number, rotY: number) => {
    const p = new THREE.Object3D();
    p.position.set(x, -s / 2, z);
    const m = face(faceIdx);
    m.position.y = s / 2;
    m.rotation.y = rotY;
    p.add(m);
    root.add(p);
    return p;
  };
  const front = mk(0, s / 2, 1, 0);
  const back = mk(0, -s / 2, 2, Math.PI);
  const left = mk(-s / 2, 0, 3, -Math.PI / 2);
  const right = mk(s / 2, 0, 4, Math.PI / 2);
  const top = new THREE.Object3D();
  top.position.set(0, s, 0);
  const topFace = face(5);
  topFace.position.z = s / 2;
  topFace.rotation.x = -Math.PI / 2;
  top.add(topFace);
  back.add(top);

  // highlighted edges & vertices (shown only when folded)
  const edges = new THREE.Group();
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#e5484d' });
  const h = s / 2;
  const corners = [-h, h];
  const addEdge = (a: THREE.Vector3, b: THREE.Vector3) => {
    const len = a.distanceTo(b);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05 + s * 0.006, 0.05 + s * 0.006, len, 10), edgeMat);
    c.position.copy(a).add(b).multiplyScalar(0.5);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    edges.add(c);
  };
  for (const y of corners) for (const z of corners) addEdge(new THREE.Vector3(-h, y, z), new THREE.Vector3(h, y, z));
  for (const x of corners) for (const z of corners) addEdge(new THREE.Vector3(x, -h, z), new THREE.Vector3(x, h, z));
  for (const x of corners) for (const y of corners) addEdge(new THREE.Vector3(x, y, -h), new THREE.Vector3(x, y, h));
  const verts = new THREE.Group();
  const vMat = new THREE.MeshStandardMaterial({ color: '#7048e8' });
  for (const x of corners) for (const y of corners) for (const z of corners) {
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.1 + s * 0.012, 16, 12), vMat);
    sp.position.set(x, y, z);
    verts.add(sp);
  }
  root.add(edges, verts);

  // unit cubes, ordered bottom layer first
  const units = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshStandardMaterial({ color: '#ffffff' }), s * s * s);
  const m4 = new THREE.Matrix4();
  let k = 0;
  const layerColors = ['#4dabf7', '#ffa94d', '#69db7c', '#f783ac', '#ffd43b', '#9775fa'];
  for (let y = 0; y < s; y++)
    for (let z = 0; z < s; z++)
      for (let x = 0; x < s; x++) {
        m4.makeTranslation(x - (s - 1) / 2, y - (s - 1) / 2, z - (s - 1) / 2);
        units.setMatrixAt(k, m4);
        units.setColorAt(k, new THREE.Color(layerColors[y % layerColors.length]));
        k++;
      }
  root.add(units);

  // a single unit cube for size comparison
  const refCube = new THREE.Group();
  const rc = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#adb5bd' }));
  rc.add(new THREE.LineSegments(new THREE.EdgesGeometry(rc.geometry), new THREE.LineBasicMaterial({ color: '#1f2a44' })));
  refCube.add(rc);
  const rl = labelSprite('1 unit cube', '#495057', 0.4);
  rl.position.y = 0.95;
  refCube.add(rl);
  refCube.position.set(-3 * h - 1.4, -h + 0.5, h + 1);
  group.add(refCube);
  return { root, pivots: { front, back, left, right, top }, faces, labels, edges, verts, units, refCube };
}

function CubeLesson() {
  const h = useHistory({ s: 3, unfold: 0, fill: 0 });
  const { s, unfold, fill } = h.value;
  const [units, setUnits] = useState(false);
  const [highlight, setHighlight] = useState<'none' | 'faces' | 'edges' | 'vertices'>('none');
  const [spin, setSpin] = useState(false);
  const ctxRef = useRef<ThreeCtx | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const parts = useRef<CubeParts | null>(null);
  const anim = useRef<{ key: 'unfold' | 'fill'; to: number; speed: number } | null>(null);

  const setup = (ctx: ThreeCtx) => {
    ctxRef.current = ctx;
    const g = new THREE.Group();
    ctx.scene.add(g);
    groupRef.current = g;
    parts.current = buildCube(g, s);
  };

  useEffect(() => {
    if (groupRef.current) parts.current = buildCube(groupRef.current, s);
  }, [s]);

  useEffect(() => {
    const p = parts.current;
    if (!p) return;
    const a = (unfold * Math.PI) / 2;
    p.pivots.front.rotation.x = a;
    p.pivots.back.rotation.x = -a;
    p.pivots.left.rotation.z = a;
    p.pivots.right.rotation.z = -a;
    p.pivots.top.rotation.x = -a;
    const folded = unfold < 0.001;
    p.faces.forEach((f) => {
      const m = f.material as THREE.MeshStandardMaterial;
      m.opacity = units && folded ? 0.16 : 1;
      m.depthWrite = !(units && folded);
    });
    p.labels.forEach((l) => (l.visible = highlight === 'faces'));
    p.edges.visible = highlight === 'edges' && folded;
    p.verts.visible = highlight === 'vertices' && folded;
    p.units.visible = units && folded;
    p.units.count = Math.round(fill) * s * s;
    p.root.position.y = unfold * (s / 2) * 0;
  }, [unfold, units, highlight, fill, s]);

  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.controls.autoRotate = spin;
      ctxRef.current.controls.autoRotateSpeed = 2;
    }
  }, [spin]);

  const onFrame = (_: ThreeCtx, dt: number) => {
    const a = anim.current;
    if (!a) return;
    const cur = h.value[a.key];
    const step = a.speed * dt;
    const next = Math.abs(a.to - cur) <= step ? a.to : cur + Math.sign(a.to - cur) * step;
    h.set((st) => ({ ...st, [a.key]: next }));
    if (next === a.to) anim.current = null;
  };

  const tool = (
    <div style={{ position: 'relative' }}>
      <ThreeStage setup={setup} onFrame={onFrame} camPos={[7.5, 6.5, 10]} />
      <div className="overlay-badge">
        <T k="cube" /> · side {s} · {unfold > 0.001 ? 'unfolding into a net' : units ? `${Math.round(fill) * s * s} of ${s ** 3} unit cubes` : 'drag to spin'}
      </div>
    </div>
  );
  const controls = (
    <>
      <Slider label="Side length s" value={s} min={1} max={6} unit="units" onStart={h.checkpoint} onChange={(x) => h.set((st) => ({ ...st, s: x, fill: Math.min(st.fill, x) }))} color="#1971c2" />
      <Slider label={<>Unfold into a <T k="net" /></>} value={unfold} min={0} max={1} step={0.01} onStart={h.checkpoint} onChange={(x) => h.set((st) => ({ ...st, unfold: x }))} format={(x) => `${Math.round(x * 100)}%`} color="#e8590c" />
      <div className="row">
        <button className="btn" onClick={() => { h.checkpoint(); anim.current = { key: 'unfold', to: unfold > 0.5 ? 0 : 1, speed: 0.5 }; }}>{unfold > 0.5 ? '📦 Fold it up' : '📄 Unfold it'}</button>
        <Toggle label="Fill with unit cubes" checked={units} onChange={(v) => { setUnits(v); if (v) h.commit((st) => ({ ...st, unfold: 0 })); }} />
        {units && (
          <>
            <button className="btn" onClick={() => { h.checkpoint(); h.set((st) => ({ ...st, fill: 0 })); anim.current = { key: 'fill', to: s, speed: 1.2 }; }}>▶ Fill layer by layer</button>
            <Slider label="Layers" value={Math.round(fill)} min={0} max={s} onStart={h.checkpoint} onChange={(x) => h.set((st) => ({ ...st, fill: x }))} />
          </>
        )}
      </div>
      <div className="row">
        <Segmented small value={highlight} onChange={setHighlight} options={[{ value: 'none', label: 'Plain' }, { value: 'faces', label: 'Count faces' }, { value: 'edges', label: 'Count edges' }, { value: 'vertices', label: 'Count vertices' }]} />
        <Toggle label="Auto-spin" checked={spin} onChange={setSpin} />
        <ViewButtons ctx={ctxRef} />
        <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => { setUnits(false); h.reset(); }} />
      </div>
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A <T k="cube" />: a box where every <T k="edge" /> is the same length. Each flat side is a <T k="face" /> and every face is a <T k="square" />.</p>,
    touch: <p>Drag on the cube to spin it. Pinch (or scroll) to zoom. Try the Front, Side and Top view buttons.</p>,
    experiment: (
      <ul>
        <li>Choose <b>Count faces</b>, <b>Count edges</b>, <b>Count vertices</b> and count each.</li>
        <li>Press <b>📄 Unfold it</b> — the cube becomes a flat <T k="net" />.</li>
        <li>Turn on <b>Fill with unit cubes</b> and press ▶. Change the side length and fill again.</li>
      </ul>
    ),
    discover: (
      <>
        <ChoiceQuiz
          question="A cube with side 2 holds 8 unit cubes. If the side doubles to 4, how many unit cubes fit?"
          options={[
            { label: '16 (twice as many)', why: 'Doubling the side doubles it in all three directions: length, width AND height.' },
            { label: '32 (four times as many)', why: 'Four times is what happens to a face area. Volume has one more direction.' },
            { label: '64 (eight times as many)', correct: true, why: '2 × 2 × 2 = 8 times more. Fill side 2 and side 4 to see it.' },
          ]}
          hint="Set the side to 4 and fill it layer by layer. Count one layer, then count the layers."
        />
        <ChoiceQuiz
          question="When the cube unfolds, how many squares make the net?"
          options={[{ label: '4', why: 'Count again after unfolding — there is a top and a bottom too.' }, { label: '6', correct: true, why: 'One square for each face. The net is the cardboard you need to make the box.' }, { label: '8', why: '8 is the number of corners (vertices), not faces.' }]}
        />
      </>
    ),
    understand: (
      <>
        <p><T k="surfaceArea" /> = the area of every face added together. It is the flat net — the material you need.</p>
        <p><T k="volume" /> = how many unit cubes fill the inside. Count one layer (s × s), then multiply by the number of layers (s).</p>
        <p>A cube has 6 faces, 12 edges and 8 vertices.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'SA', means: 'surface area (all 6 faces)', color: '#e8590c' }, ' = 6 × ', { s: 's', means: 'side length', color: '#1971c2' }, '²']} caption="s² = s × s is the area of one face." />
        <Formula parts={[{ s: 'V', means: 'volume (unit cubes inside)', color: '#2b8a3e' }, ' = ', { s: 's', means: 'side length', color: '#1971c2' }, '³']} caption="s³ = s × s × s: one layer (s × s) times s layers." />
        <NumberQuiz question="A cube-shaped speaker box has 5 cm sides. What is its volume?" answer={125} unit="cm³" hint="One layer is 5 × 5. How many layers?"
          diagnose={(x) => (x === 150 ? 'That is the surface area (6 × 25). Volume counts the cubes inside.' : x === 15 ? 'You added 5 + 5 + 5. Volume multiplies.' : x === 25 ? 'That is just one layer. There are 5 layers.' : null)}
          solution={<Steps steps={['V = s × s × s', '= 5 × 5 × 5', '= 25 × 5 = 125 cm³']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Packaging: the <b>net</b> is the shape you cut from card; its area is the material cost.</li>
          <li>Containers: <b>volume</b> is the capacity. 1 litre fills a 10 cm cube.</li>
          <li>Sketching: the Front, Side and Top views are the three views of a technical drawing.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['Side s', `${s} units`],
      ['Faces / edges / vertices', '6 / 12 / 8'],
      ['Area of one face', `${s} × ${s} = ${s * s} square units`],
      ['Surface area', `6 × ${s * s} = ${6 * s * s} square units`],
      ['One layer of cubes', `${s} × ${s} = ${s * s}`],
      ['Volume', `${s * s} × ${s} layers = ${s ** 3} cubic units`],
      ['Total edge length', `12 × ${s} = ${12 * s} units`],
      ['Filled so far', `${Math.round(fill)} layers = ${Math.round(fill) * s * s} cubes`],
    ]} />
  );
  return <Lesson id="l9-cube" title="3D cube explorer" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Solids gallery                                                      */
/* ================================================================== */

type Solid = 'cuboid' | 'cylinder' | 'sphere' | 'cone' | 'prism' | 'cube';

interface SolidDims {
  a: number; // length / radius / side / base
  b: number; // width / triangle height
  c: number; // height / length
}

const SOLID_INFO: Record<Solid, { label: string; dims: (keyof SolidDims)[]; names: Record<string, string>; color: string }> = {
  cube: { label: 'Cube', dims: ['a'], names: { a: 'side s' }, color: '#74c0fc' },
  cuboid: { label: 'Cuboid', dims: ['a', 'b', 'c'], names: { a: 'length l', b: 'width w', c: 'height h' }, color: '#ffa94d' },
  cylinder: { label: 'Cylinder', dims: ['a', 'c'], names: { a: 'radius r', c: 'height h' }, color: '#8ce99a' },
  sphere: { label: 'Sphere', dims: ['a'], names: { a: 'radius r' }, color: '#e599f7' },
  cone: { label: 'Cone', dims: ['a', 'c'], names: { a: 'radius r', c: 'height h' }, color: '#ffd43b' },
  prism: { label: 'Triangular prism', dims: ['a', 'b', 'c'], names: { a: 'triangle base b', b: 'triangle height t', c: 'length L' }, color: '#ff8787' },
};

export function solidMeasures(k: Solid, d: SolidDims): { V: number; SA: number; vSteps: string[]; saSteps: string[] } {
  const { a, b, c } = d;
  const P = Math.PI;
  switch (k) {
    case 'cube':
      return { V: a ** 3, SA: 6 * a * a, vSteps: [`${a} × ${a} × ${a}`], saSteps: [`6 × ${a} × ${a}`] };
    case 'cuboid':
      return { V: a * b * c, SA: 2 * (a * b + a * c + b * c), vSteps: [`${a} × ${b} × ${c}`], saSteps: [`2 × (${a}×${b} + ${a}×${c} + ${b}×${c})`] };
    case 'cylinder':
      return { V: P * a * a * c, SA: 2 * P * a * a + 2 * P * a * c, vSteps: [`π × ${a}² × ${c}`, `base circle ${fmt(P * a * a, 2)} × height ${c}`], saSteps: [`two circles 2 × π × ${a}² = ${fmt(2 * P * a * a, 2)}`, `wrapped side 2 × π × ${a} × ${c} = ${fmt(2 * P * a * c, 2)}`] };
    case 'sphere':
      return { V: (4 / 3) * P * a ** 3, SA: 4 * P * a * a, vSteps: [`4/3 × π × ${a}³`], saSteps: [`4 × π × ${a}²`] };
    case 'cone': {
      const l = Math.hypot(a, c);
      return { V: (P * a * a * c) / 3, SA: P * a * a + P * a * l, vSteps: [`⅓ × π × ${a}² × ${c}`], saSteps: [`slant l = √(${a}² + ${c}²) = ${fmt(l, 2)}`, `base π × ${a}² + side π × ${a} × ${fmt(l, 2)}`] };
    }
    case 'prism': {
      const side = Math.hypot(a / 2, b);
      return { V: 0.5 * a * b * c, SA: a * b + c * (a + 2 * side), vSteps: [`triangle ½ × ${a} × ${b} = ${fmt(0.5 * a * b, 2)}`, `× length ${c}`], saSteps: [`two triangles 2 × ${fmt(0.5 * a * b, 2)}`, `three rectangles ${c} × (${a} + 2 × ${fmt(side, 2)})`] };
    }
  }
}

export function solidGeometry(k: Solid, d: SolidDims): THREE.BufferGeometry {
  const { a, b, c } = d;
  switch (k) {
    case 'cube':
      return new THREE.BoxGeometry(a, a, a);
    case 'cuboid':
      return new THREE.BoxGeometry(a, c, b);
    case 'cylinder':
      return new THREE.CylinderGeometry(a, a, c, 64, 1);
    case 'sphere':
      return new THREE.SphereGeometry(a, 64, 40);
    case 'cone':
      return new THREE.ConeGeometry(a, c, 64, 1);
    case 'prism': {
      const shape = new THREE.Shape();
      shape.moveTo(-a / 2, -b / 3);
      shape.lineTo(a / 2, -b / 3);
      shape.lineTo(0, (2 * b) / 3);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: c, bevelEnabled: false });
      g.translate(0, 0, -c / 2);
      g.rotateY(Math.PI / 2);
      return g;
    }
  }
}

function SolidsLesson() {
  const [kind, setKind] = useState<Solid>('cylinder');
  const h = useHistory<Record<Solid, SolidDims>>({
    cube: { a: 3, b: 3, c: 3 }, cuboid: { a: 4, b: 2, c: 3 }, cylinder: { a: 1.5, b: 0, c: 4 }, sphere: { a: 2, b: 0, c: 0 }, cone: { a: 1.5, b: 0, c: 4 }, prism: { a: 3, b: 2.5, c: 4 },
  });
  const d = h.value[kind];
  const [wire, setWire] = useState(false);
  const [ghost, setGhost] = useState(false);
  const ctxRef = useRef<ThreeCtx | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const info = SOLID_INFO[kind];
  const m = solidMeasures(kind, d);
  const canGhost = kind === 'cone' || kind === 'sphere';
  const ghostV = kind === 'cone' ? Math.PI * d.a * d.a * d.c : kind === 'sphere' ? Math.PI * d.a * d.a * 2 * d.a : 0;

  const setup = (ctx: ThreeCtx) => {
    ctxRef.current = ctx;
    const g = new THREE.Group();
    ctx.scene.add(g);
    groupRef.current = g;
    const grid = new THREE.GridHelper(12, 12, '#adb5bd', '#dee2e6');
    grid.position.y = -3;
    ctx.scene.add(grid);
  };
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    clearGroup(g);
    const geo = solidGeometry(kind, d);
    const mat = new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.55, metalness: 0.05, wireframe: wire, side: THREE.DoubleSide, transparent: ghost, opacity: ghost ? 0.85 : 1 });
    const mesh = new THREE.Mesh(geo, mat);
    g.add(mesh);
    if (!wire) g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: '#1f2a44' })));
    if (ghost && canGhost) {
      const gh = kind === 'cone' ? new THREE.CylinderGeometry(d.a, d.a, d.c, 64, 1, true) : new THREE.CylinderGeometry(d.a, d.a, 2 * d.a, 64, 1, true);
      g.add(new THREE.Mesh(gh, new THREE.MeshBasicMaterial({ color: '#1c7ed6', wireframe: true, transparent: true, opacity: 0.35 })));
    }
  }, [kind, d, wire, ghost, info.color, canGhost]);

  const syms: Record<Solid, (string | Sym)[][]> = {
    cube: [[{ s: 'V', means: 'volume', color: '#2b8a3e' }, ' = ', { s: 's', means: 'side', color: '#1971c2' }, '³'], [{ s: 'SA', means: 'surface area', color: '#e8590c' }, ' = 6', { s: 's', means: 'side', color: '#1971c2' }, '²']],
    cuboid: [[{ s: 'V', means: 'volume', color: '#2b8a3e' }, ' = ', { s: 'l', means: 'length', color: '#1971c2' }, ' × ', { s: 'w', means: 'width', color: '#c2255c' }, ' × ', { s: 'h', means: 'height', color: '#7048e8' }], [{ s: 'SA', means: 'surface area: 3 pairs of rectangles', color: '#e8590c' }, ' = 2(lw + lh + wh)']],
    cylinder: [[{ s: 'V', means: 'volume = base circle × height', color: '#2b8a3e' }, ' = π', { s: 'r', means: 'radius', color: '#1971c2' }, '²', { s: 'h', means: 'height', color: '#7048e8' }], [{ s: 'SA', means: 'surface area: 2 circles + the label that wraps around', color: '#e8590c' }, ' = 2πr² + 2πrh']],
    sphere: [[{ s: 'V', means: 'volume', color: '#2b8a3e' }, ' = ⁴⁄₃ π', { s: 'r', means: 'radius', color: '#1971c2' }, '³'], [{ s: 'SA', means: 'surface area (exactly 4 circles of the same radius!)', color: '#e8590c' }, ' = 4π', { s: 'r', means: 'radius', color: '#1971c2' }, '²']],
    cone: [[{ s: 'V', means: 'volume — one third of the cylinder around it', color: '#2b8a3e' }, ' = ⅓ π', { s: 'r', means: 'radius', color: '#1971c2' }, '²', { s: 'h', means: 'height', color: '#7048e8' }], [{ s: 'SA', means: 'surface area', color: '#e8590c' }, ' = πr² + πr', { s: 'l', means: 'slant length = √(r² + h²)', color: '#c2255c' }]],
    prism: [[{ s: 'V', means: 'volume = triangle area × length', color: '#2b8a3e' }, ' = ½', { s: 'b', means: 'triangle base', color: '#1971c2' }, { s: 't', means: 'triangle height', color: '#c2255c' }, { s: 'L', means: 'prism length', color: '#7048e8' }], [{ s: 'SA', means: 'surface area: 2 triangles + 3 rectangles', color: '#e8590c' }, ' = bt + L(b + 2 × side)']],
  };

  const tool = (
    <div style={{ position: 'relative' }}>
      <ThreeStage setup={setup} camPos={[7, 5.5, 9]} />
      <div className="overlay-badge">{info.label} · V = {fmt(m.V, 2)} cm³ · SA = {fmt(m.SA, 2)} cm²</div>
    </div>
  );
  const controls = (
    <>
      <Segmented value={kind} onChange={(k) => { setKind(k); setGhost(false); }} options={(Object.keys(SOLID_INFO) as Solid[]).map((k) => ({ value: k, label: SOLID_INFO[k].label }))} />
      {info.dims.map((key) => (
        <Slider key={key} label={info.names[key]} value={d[key]} min={0.5} max={5} step={0.1} unit="cm" onStart={h.checkpoint}
          onChange={(x) => h.set((s) => ({ ...s, [kind]: { ...s[kind], [key]: x } }))} />
      ))}
      <div className="row">
        <Toggle label="Wireframe" checked={wire} onChange={setWire} />
        {canGhost && <Toggle label={kind === 'cone' ? 'Compare with cylinder' : 'Compare with cylinder around it'} checked={ghost} onChange={setGhost} />}
        <ViewButtons ctx={ctxRef} />
        <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
      </div>
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>Six solids that hide inside almost every product: <T k="cube" />, <T k="cuboid" />, <T k="cylinder" />, <T k="sphere" />, <T k="cone" /> and <T k="prism" />.</p>,
    touch: <p>Pick a solid, spin it, and drag its size sliders.</p>,
    experiment: (
      <ul>
        <li>Turn on <b>Wireframe</b> to see how the surface is built from little flat pieces.</li>
        <li>For the cone, turn on <b>Compare with cylinder</b>. Read the volume ratio in the Numbers tab.</li>
        <li>Do the same for the sphere.</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz
        question="A cone fits exactly inside a cylinder (same base, same height). How many cones of water fill the cylinder?"
        options={[{ label: '2', why: 'Check the Numbers tab: cone volume ÷ cylinder volume = 0.333…' }, { label: '3', correct: true, why: 'Always exactly 3 — a cone is one third of its cylinder.' }, { label: 'It depends on the size', why: 'Change the sliders: the ratio stays 0.333.' }]}
      />
    ),
    understand: (
      <>
        <p>Shapes with the <b>same cross-section all the way through</b> (prisms, cylinders, cuboids): volume = base area × height.</p>
        <p>Shapes that <b>come to a point</b> (cones, pyramids): one third of that.</p>
        <p>A sphere fills two thirds of the cylinder that wraps around it.</p>
      </>
    ),
    calculate: (
      <>
        {syms[kind].map((p, i) => <Formula key={i} parts={p} />)}
        <NumberQuiz question="A drinks can is a cylinder with radius 3 cm and height 12 cm. What is its volume? (cm³, 1 decimal)" answer={339.3} tolerance={0.3} unit="cm³"
          hint="Base circle area π × 3 × 3 first, then × height."
          diagnose={(x) => (Math.abs(x - 113.1) < 0.5 ? 'That is the volume of a cone. A can is a full cylinder (no ⅓).' : Math.abs(x - 1357.2) < 1 ? 'You used 6 cm — that is the diameter. Use the radius.' : null)}
          solution={<Steps steps={['base = π × 3² = 28.27 cm²', 'V = 28.27 × 12 = 339.3 cm³ (≈ 339 ml)']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Bottles, cans, knobs and pens are cylinders. Lamp shades and funnels are (cut) cones.</li>
          <li>Break a complex product into simple solids, add their volumes → material and weight estimates.</li>
          <li>1 cm³ holds 1 ml of water.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <>
      <NumberTable rows={[
        ...info.dims.map((k) => [info.names[k], `${d[k]} cm`] as [ReactNode, ReactNode]),
        ['Volume', `${m.vSteps.join(' → ')} = ${fmt(m.V, 2)} cm³`],
        ['Surface area', `${m.saSteps.join(' + ')} = ${fmt(m.SA, 2)} cm²`],
        ...(canGhost ? ([['Cylinder around it', `${fmt(ghostV, 2)} cm³`], ['Ratio solid ÷ cylinder', `${fmt(m.V / ghostV, 4)}`]] as [ReactNode, ReactNode][]) : []),
      ]} />
    </>
  );
  return <Lesson id="l9-solids" title="Solids gallery" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Volume builder (area & volume visualiser)                           */
/* ================================================================== */

function VolumeLesson() {
  const h = useHistory({ l: 5, w: 3, ht: 4, layers: 0 });
  const { l, w, ht, layers } = h.value;
  const groupRef = useRef<THREE.Group | null>(null);
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const anim = useRef(false);
  const lastT = useRef(0);
  const setup = (ctx: ThreeCtx) => {
    const g = new THREE.Group();
    ctx.scene.add(g);
    groupRef.current = g;
  };
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    clearGroup(g);
    const base = new THREE.Mesh(new THREE.PlaneGeometry(l, w), new THREE.MeshStandardMaterial({ map: gridTexture(l, w, '#fff3bf'), side: THREE.DoubleSide }));
    base.rotation.x = -Math.PI / 2;
    base.position.y = -ht / 2 - 0.01;
    g.add(base);
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(l, ht, w)), new THREE.LineBasicMaterial({ color: '#1f2a44' }));
    g.add(box);
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.92, 0.92, 0.92), new THREE.MeshStandardMaterial({ color: '#fff' }), l * w * ht);
    const m4 = new THREE.Matrix4();
    let k = 0;
    const cols = ['#4dabf7', '#ffa94d', '#69db7c', '#f783ac', '#ffd43b', '#9775fa', '#3bc9db', '#ff8787'];
    for (let y = 0; y < ht; y++)
      for (let z = 0; z < w; z++)
        for (let x = 0; x < l; x++) {
          m4.makeTranslation(x - (l - 1) / 2, y - (ht - 1) / 2, z - (w - 1) / 2);
          inst.setMatrixAt(k, m4);
          inst.setColorAt(k, new THREE.Color(cols[y % cols.length]));
          k++;
        }
    inst.count = Math.min(layers, ht) * l * w;
    meshRef.current = inst;
    g.add(inst);
    const lab1 = labelSprite(`${l} long`, '#1971c2', 0.45);
    lab1.position.set(0, -ht / 2 - 0.3, w / 2 + 0.6);
    const lab2 = labelSprite(`${w} wide`, '#c2255c', 0.45);
    lab2.position.set(l / 2 + 0.8, -ht / 2 - 0.3, 0);
    const lab3 = labelSprite(`${ht} tall`, '#7048e8', 0.45);
    lab3.position.set(-l / 2 - 0.8, 0, w / 2);
    g.add(lab1, lab2, lab3);
  }, [l, w, ht]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (meshRef.current) meshRef.current.count = Math.min(Math.round(layers), ht) * l * w;
  }, [layers, l, w, ht]);
  const onFrame = (_: ThreeCtx) => {
    if (!anim.current) return;
    const now = performance.now();
    if (now - lastT.current < 650) return;
    lastT.current = now;
    h.set((s) => {
      if (s.layers >= s.ht) {
        anim.current = false;
        return s;
      }
      return { ...s, layers: s.layers + 1 };
    });
  };
  const tool = (
    <div style={{ position: 'relative' }}>
      <ThreeStage setup={setup} onFrame={onFrame} camPos={[10, 9, 13]} />
      <div className="overlay-badge">Base {l} × {w} = {l * w} squares · {Math.round(layers)} of {ht} layers · {Math.round(layers) * l * w} cubes</div>
    </div>
  );
  const controls = (
    <>
      <Slider label="Length" value={l} min={1} max={8} onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, l: x }))} color="#1971c2" />
      <Slider label="Width" value={w} min={1} max={8} onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, w: x }))} color="#c2255c" />
      <Slider label="Height" value={ht} min={1} max={8} onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, ht: x, layers: Math.min(s.layers, x) }))} color="#7048e8" />
      <Slider label="Layers filled" value={layers} min={0} max={ht} onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, layers: x }))} />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()}>
        <button className="btn primary" onClick={() => { h.commit((s) => ({ ...s, layers: 0 })); anim.current = true; lastT.current = performance.now(); }}>▶ Build layer by layer</button>
      </ToolBar>
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A box outline sitting on a squared base. The squares on the floor show the base <T k="area" />.</p>,
    touch: <p>Press <b>▶ Build layer by layer</b>. Spin the view while it builds.</p>,
    experiment: (
      <ul>
        <li>Count the squares on the floor — then count the cubes in the first layer.</li>
        <li>Change the height. Does one layer change?</li>
        <li>Make a 2 × 2 × 6 tower and a 4 × 3 × 2 slab. Which holds more?</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz
        question="How does the number of cubes in ONE layer compare to the floor squares?"
        options={[{ label: 'They are equal', correct: true, why: 'Each floor square gets exactly one cube per layer. So volume = base area × number of layers.' }, { label: 'One layer has more', why: 'Look straight down from the Top: each cube sits on one floor square.' }]}
      />
    ),
    understand: (
      <>
        <p><T k="area" /> counts flat squares (2 directions). <T k="volume" /> counts cubes (3 directions).</p>
        <p>Volume = base area × height. That works for every box, and every shape with straight sides going up.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'V', means: 'volume in cubic units', color: '#2b8a3e' }, ' = ', { s: 'l', means: 'length', color: '#1971c2' }, ' × ', { s: 'w', means: 'width', color: '#c2255c' }, ' × ', { s: 'h', means: 'height', color: '#7048e8' }]} caption="l × w is the base area. × h stacks that many layers." />
        <NumberQuiz question="A pencil box is 20 cm long, 6 cm wide and 4 cm tall. Volume?" answer={480} unit="cm³" hint="Floor first: 20 × 6. Then layers."
          diagnose={(x) => (x === 30 ? 'You added. Volume multiplies the three sizes.' : x === 120 ? 'That is just the floor (one layer).' : null)}
          solution={<Steps steps={['base = 20 × 6 = 120 cm²', 'V = 120 × 4 = 480 cm³']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>1 cm³ = 1 ml. A 10 × 10 × 10 cm box holds 1000 ml = 1 litre.</li>
          <li>Packing: how many products fit in a shipping carton? Count per layer, then layers.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['Base area', `${l} × ${w} = ${l * w} square units`],
      ['Cubes per layer', `${l * w}`],
      ['Layers', `${ht}`],
      ['Volume', `${l * w} × ${ht} = ${l * w * ht} cubic units`],
      ['Built so far', `${Math.round(layers)} × ${l * w} = ${Math.round(layers) * l * w}`],
      ['Surface area', `2 × (${l}×${w} + ${l}×${ht} + ${w}×${ht}) = ${2 * (l * w + l * ht + w * ht)}`],
    ]} />
  );
  return <Lesson id="l9-volume" title="Volume builder" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Cross-sections                                                      */
/* ================================================================== */

type SecSolid = 'cube' | 'cuboid' | 'cylinder' | 'cone' | 'sphere';

/** Intersect a (non-transformed) mesh geometry with a plane; returns the convex section polygon in 3D + plane basis. */
export function sectionPolygon(geo: THREE.BufferGeometry, plane: THREE.Plane): THREE.Vector3[] {
  const pos = geo.getAttribute('position');
  const idx = geo.getIndex();
  const n = idx ? idx.count : pos.count;
  const get = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, idx ? idx.getX(i) : i);
  const pts: THREE.Vector3[] = [];
  for (let t = 0; t < n; t += 3) {
    const v = [get(t), get(t + 1), get(t + 2)];
    const d = v.map((p) => plane.distanceToPoint(p));
    for (let e = 0; e < 3; e++) {
      const a = e;
      const b = (e + 1) % 3;
      if ((d[a] > 0 && d[b] < 0) || (d[a] < 0 && d[b] > 0)) {
        const k = d[a] / (d[a] - d[b]);
        pts.push(v[a].clone().lerp(v[b], k));
      } else if (Math.abs(d[a]) < 1e-9) pts.push(v[a].clone());
    }
  }
  if (pts.length < 3) return [];
  // unique
  const uniq: THREE.Vector3[] = [];
  for (const p of pts) if (!uniq.some((q) => q.distanceToSquared(p) < 1e-8)) uniq.push(p);
  const c = uniq.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / uniq.length);
  const nrm = plane.normal;
  const u = new THREE.Vector3().crossVectors(nrm, Math.abs(nrm.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  const w = new THREE.Vector3().crossVectors(nrm, u);
  return uniq.sort((p, q) => Math.atan2(p.clone().sub(c).dot(w), p.clone().sub(c).dot(u)) - Math.atan2(q.clone().sub(c).dot(w), q.clone().sub(c).dot(u)));
}

function planeCoords(poly: THREE.Vector3[], normal: THREE.Vector3) {
  if (!poly.length) return [];
  const u = new THREE.Vector3().crossVectors(normal, Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  const w = new THREE.Vector3().crossVectors(normal, u);
  return poly.map((p) => ({ x: p.dot(u), y: p.dot(w) }));
}

/** Merge almost-collinear vertices to count real corners. */
function cornerCount(pts: { x: number; y: number }[]): number {
  let n = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i - 1 + pts.length) % pts.length];
    const b = pts[i];
    const c = pts[(i + 1) % pts.length];
    const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    const l = Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - b.x, c.y - b.y);
    if (l > 1e-9 && Math.abs(cr / l) > 0.05) n++;
  }
  return n;
}

function sectionName(kind: SecSolid, pts: { x: number; y: number }[]): string {
  if (pts.length < 3) return 'no cut — the plane misses the solid';
  if (kind === 'cube' || kind === 'cuboid') {
    const n = cornerCount(pts);
    return ({ 3: 'triangle', 4: 'quadrilateral (rectangle when cut straight)', 5: 'pentagon', 6: 'hexagon' } as Record<number, string>)[n] ?? `${n}-sided polygon`;
  }
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const r = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const mean = r.reduce((s, x) => s + x, 0) / r.length;
  const spread = (Math.max(...r) - Math.min(...r)) / mean;
  const corners = cornerCount(pts);
  if (spread < 0.03) return 'circle';
  if (kind === 'cylinder' && corners >= 4 && corners <= 6) return 'rectangle (cut along the length)';
  if (corners >= 2 && corners < 10) return 'curved shape with a straight edge (it cut through a flat end)';
  return 'ellipse (an oval)';
}

function SectionsLesson() {
  const [kind, setKind] = useState<SecSolid>('cube');
  const h = useHistory({ y: 0.3, tiltX: 0, tiltZ: 0 });
  const { y, tiltX, tiltZ } = h.value;
  const groupRef = useRef<THREE.Group | null>(null);
  const [poly, setPoly] = useState<{ x: number; y: number }[]>([]);
  const ctxRef = useRef<ThreeCtx | null>(null);
  const setup = (ctx: ThreeCtx) => {
    ctxRef.current = ctx;
    ctx.renderer.localClippingEnabled = true;
    const g = new THREE.Group();
    ctx.scene.add(g);
    groupRef.current = g;
  };
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    clearGroup(g);
    const geo = kind === 'cube' ? new THREE.BoxGeometry(3, 3, 3) : kind === 'cuboid' ? new THREE.BoxGeometry(4, 2.4, 2.4) : kind === 'cylinder' ? new THREE.CylinderGeometry(1.4, 1.4, 3.4, 64) : kind === 'cone' ? new THREE.ConeGeometry(1.7, 3.4, 64) : new THREE.SphereGeometry(1.7, 64, 40);
    const normal = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler((tiltX * Math.PI) / 180, 0, (tiltZ * Math.PI) / 180));
    const point = new THREE.Vector3(0, y * 1.7, 0);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
    const keep = new THREE.Plane().setFromNormalAndCoplanarPoint(normal.clone().negate(), point);
    const solid = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#74c0fc', side: THREE.DoubleSide, clippingPlanes: [keep], roughness: 0.6 }));
    const ghost = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#adb5bd', wireframe: true, transparent: true, opacity: 0.18 }));
    g.add(solid, ghost, new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: '#1f2a44', clippingPlanes: [keep] })));
    const sec = sectionPolygon(geo, plane);
    if (sec.length >= 3) {
      const c = sec.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / sec.length);
      const verts: number[] = [];
      for (let i = 0; i < sec.length; i++) {
        const a = sec[i];
        const b = sec[(i + 1) % sec.length];
        verts.push(c.x, c.y, c.z, a.x, a.y, a.z, b.x, b.y, b.z);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      sg.computeVertexNormals();
      g.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: '#ff922b', side: THREE.DoubleSide })));
      const outline = new THREE.BufferGeometry().setFromPoints([...sec, sec[0]]);
      g.add(new THREE.Line(outline, new THREE.LineBasicMaterial({ color: '#d9480f' })));
    }
    // show the cutting plane as a translucent sheet
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: '#ffd43b', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    sheet.position.copy(point);
    sheet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    g.add(sheet);
    setPoly(planeCoords(sec, normal));
  }, [kind, y, tiltX, tiltZ]);

  const name = sectionName(kind, poly);
  const area = poly.length >= 3 ? Math.abs(poly.reduce((s, p, i) => s + p.x * poly[(i + 1) % poly.length].y - poly[(i + 1) % poly.length].x * p.y, 0) / 2) : 0;
  // 2D preview
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const span = poly.length ? Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 0.1) : 1;
  const k = 150 / span;
  const mx = poly.length ? (Math.max(...xs) + Math.min(...xs)) / 2 : 0;
  const my = poly.length ? (Math.max(...ys) + Math.min(...ys)) / 2 : 0;
  const preview = (
    <svg viewBox="0 0 200 200" style={{ width: 170, height: 170, background: '#fff', borderRadius: 12, border: '1px solid #dee2e6' }}>
      {poly.length >= 3 && <path d={poly.map((p, i) => `${i ? 'L' : 'M'}${100 + (p.x - mx) * k} ${100 - (p.y - my) * k}`).join(' ') + ' Z'} fill="#ffa94d" stroke="#d9480f" strokeWidth={2.5} />}
    </svg>
  );
  const tool = (
    <div style={{ position: 'relative' }}>
      <ThreeStage setup={setup} camPos={[6, 5, 7]} />
      <div className="overlay-badge">Section: <b>{name}</b></div>
      <div style={{ position: 'absolute', right: 10, top: 10 }}>{preview}</div>
    </div>
  );
  const controls = (
    <>
      <Segmented value={kind} onChange={setKind} options={[{ value: 'cube', label: 'Cube' }, { value: 'cuboid', label: 'Cuboid' }, { value: 'cylinder', label: 'Cylinder' }, { value: 'cone', label: 'Cone' }, { value: 'sphere', label: 'Sphere' }]} />
      <Slider label="Cut height" value={y} min={-1} max={1} step={0.01} onStart={h.checkpoint} onChange={(v) => h.set((s) => ({ ...s, y: v }))} />
      <Slider label="Tilt forward" value={tiltX} min={-70} max={70} unit="°" onStart={h.checkpoint} onChange={(v) => h.set((s) => ({ ...s, tiltX: v }))} />
      <Slider label="Tilt sideways" value={tiltZ} min={-70} max={70} unit="°" onStart={h.checkpoint} onChange={(v) => h.set((s) => ({ ...s, tiltZ: v }))} />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()}>
        <button className="btn" onClick={() => { setKind('cube'); h.commit({ y: 0, tiltX: 45, tiltZ: 35 }); }}>Try: hexagon in a cube</button>
        <button className="btn" onClick={() => { setKind('cube'); h.commit({ y: 0.75, tiltX: 40, tiltZ: 35 }); }}>Try: triangle in a cube</button>
      </ToolBar>
      <ViewButtons ctx={ctxRef} />
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A yellow cutting sheet slices the solid. The top part is removed so you can see the orange cut face — the <T k="crossSection" />.</p>,
    touch: <p>Move the <b>Cut height</b> slider. Spin the view to look straight at the cut.</p>,
    experiment: (
      <ul>
        <li>Tilt the cut through a cube. How many different shapes can you make?</li>
        <li>Cut a cylinder straight, then tilted.</li>
        <li>Cut a sphere anywhere. Is the section ever not a circle?</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz
        question="Can a slice through a cube be a hexagon (6 sides)?"
        options={[{ label: 'No — a cube only has square faces', why: 'Press "Try: hexagon in a cube". The cut crosses all 6 faces, so the section has 6 edges.' }, { label: 'Yes, when the cut is tilted to cross all six faces', correct: true, why: 'Each face the plane crosses adds one edge to the section.' }]}
      />
    ),
    understand: (
      <>
        <p>Each flat face the cut crosses gives the section one straight edge. Crossing a curved surface gives a curved edge.</p>
        <p>Spheres always give circles. Cylinders give circles, ovals or rectangles.</p>
      </>
    ),
    calculate: (
      <>
        <p>The section's area (Numbers tab) is computed from its outline — the same shoelace method as the polygon tool.</p>
        <Formula parts={[{ s: 'V', means: 'volume of a prism-like shape', color: '#2b8a3e' }, ' = ', { s: 'A', means: 'area of the cross-section (if it is the same all the way through)', color: '#e8590c' }, ' × ', { s: 'L', means: 'length', color: '#1971c2' }]} />
        <NumberQuiz question="An aluminium extrusion has a cross-section area of 2.5 cm² and is 40 cm long. Volume of metal?" answer={100} unit="cm³" hint="Cross-section × length."
          solution={<Steps steps={['V = A × L', '= 2.5 × 40 = 100 cm³']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Engineering drawings use <b>section views</b> (hatched) to show wall thickness and inner parts.</li>
          <li>Extrusions (window frames, heat sinks) are designed as a cross-section, then stretched.</li>
          <li>Sketching tip: draw section lines across a product to make its curved form readable.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['Solid', kind],
      ['Cut height', fmt(y, 2)],
      ['Tilt', `${tiltX}° forward, ${tiltZ}° sideways`],
      ['Section shape', name],
      ['Section area', `${fmt(area, 2)} square units`],
      ['Outline points', `${poly.length}`],
    ]} />
  );
  return <Lesson id="l9-sections" title="Cross-sections" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Container challenge                                                 */
/* ================================================================== */

interface BoxDims {
  W: number;
  D: number;
  H: number;
}

interface BoxTarget {
  ml: number;
  t: number;
  maxH?: number;
  fixedD?: number;
  tol: number;
}

function boxTarget(d: Difficulty, base?: Partial<BoxTarget>): BoxTarget {
  if (base?.ml) return { t: 3, tol: 0.02, ...base } as BoxTarget;
  if (d === 'easy') return { ml: pick([500, 1000, 2000]), t: 2, tol: 0.05 };
  if (d === 'normal') return { ml: pick([750, 1500, 2500, 3000]), t: 3, tol: 0.02 };
  return { ml: randInt(12, 40) * 100, t: 4, tol: 0.01, maxH: pick([100, 120]), fixedD: pick([150, 180]) };
}

export function internalVolumeMl(b: BoxDims, t: number) {
  return (Math.max(0, b.W - 2 * t) * Math.max(0, b.D - 2 * t) * Math.max(0, b.H - t)) / 1000;
}

export function ContainerDesigner({ id, title, fixedTarget, intro }: { id: string; title: string; fixedTarget?: Partial<BoxTarget>; intro?: ReactNode }) {
  const { difficulty } = useSettings();
  const [target, setTarget] = useState(() => boxTarget(difficulty, fixedTarget));
  const h = useHistory<BoxDims>({ W: 120, D: 120, H: 80 });
  const b = { ...h.value, D: target.fixedD ?? h.value.D };
  const [cutaway, setCutaway] = useState(true);
  const [water, setWater] = useState(true);
  const groupRef = useRef<THREE.Group | null>(null);
  const t = target.t;
  const inner = internalVolumeMl(b, t);
  const outer = (b.W * b.D * b.H) / 1000;
  const material = outer - inner;
  const step = difficulty === 'easy' ? 5 : 1;

  const setup = (ctx: ThreeCtx) => {
    const g = new THREE.Group();
    ctx.scene.add(g);
    groupRef.current = g;
  };
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    clearGroup(g);
    const S = 1 / 50; // 50 mm per unit
    const mat = new THREE.MeshStandardMaterial({ color: '#ffa94d', roughness: 0.5 });
    const slab = (w: number, hh: number, d: number, x: number, y: number, z: number) => {
      const geo = new THREE.BoxGeometry(w * S, hh * S, d * S);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x * S, y * S, z * S);
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#7f3b08' })));
      g.add(m);
    };
    const { W, D, H } = b;
    slab(W, t, D, 0, -H / 2 + t / 2, 0); // floor
    slab(t, H - t, D, -W / 2 + t / 2, t / 2, 0); // left
    slab(t, H - t, D, W / 2 - t / 2, t / 2, 0); // right
    slab(W - 2 * t, H - t, t, 0, t / 2, -D / 2 + t / 2); // back
    if (!cutaway) slab(W - 2 * t, H - t, t, 0, t / 2, D / 2 - t / 2); // front
    if (water && inner > 0) {
      const wg = new THREE.BoxGeometry((W - 2 * t) * S * 0.995, (H - t) * S * 0.995, (D - 2 * t) * S * 0.995);
      const wm = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: '#4dabf7', transparent: true, opacity: 0.45 }));
      wm.position.set(0, (t / 2) * S, 0);
      g.add(wm);
    }
    const l1 = labelSprite(`${b.W} mm`, '#1971c2', 0.3);
    l1.position.set(0, (-H / 2) * S - 0.25, (D / 2) * S + 0.3);
    const l2 = labelSprite(`${b.D} mm`, '#c2255c', 0.3);
    l2.position.set((W / 2) * S + 0.5, (-H / 2) * S - 0.25, 0);
    const l3 = labelSprite(`${b.H} mm`, '#7048e8', 0.3);
    l3.position.set((-W / 2) * S - 0.5, 0, (D / 2) * S);
    g.add(l1, l2, l3);
    if (target.maxH) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(8, 0.04, 6), new THREE.MeshStandardMaterial({ color: '#868e96', transparent: true, opacity: 0.35 }));
      shelf.position.y = (-H / 2 + target.maxH) * S;
      g.add(shelf);
    }
  }, [b.W, b.D, b.H, t, cutaway, water, inner, target.maxH]); // eslint-disable-line react-hooks/exhaustive-deps

  const check = (): CheckResult => {
    const err = (inner - target.ml) / target.ml;
    if (target.maxH && b.H > target.maxH) return { ok: false, happened: <>The box is <b>{b.H} mm</b> tall — it hits the shelf above at {target.maxH} mm.</>, why: 'Constraints come first: lower the height, then make it wider to win back the volume.' };
    if (Math.abs(err) <= target.tol) return { ok: true, happened: `Inside: ${b.W - 2 * t} × ${b.D - 2 * t} × ${b.H - t} mm = ${fmt(inner, 0)} ml.`, why: `Material used: ${fmt(material, 0)} cm³ of plastic.` };
    const outerHit = Math.abs(outer - target.ml) / target.ml <= target.tol;
    return {
      ok: false,
      happened: <>The inside holds <b>{fmt(inner, 0)} ml</b> — {fmt(Math.abs(inner - target.ml), 0)} ml {inner > target.ml ? 'too much' : 'too little'} ({fmt(err * 100, 1)}%).</>,
      why: outerHit
        ? `You hit ${target.ml} ml with the OUTSIDE size. The walls (${t} mm) and floor take up space — the inside is smaller.`
        : 'The space inside = (width − 2 walls) × (depth − 2 walls) × (height − floor).',
    };
  };

  const tool = (
    <div style={{ position: 'relative' }}>
      <ThreeStage setup={setup} camPos={[4.5, 4, 6]} />
      <div className="overlay-badge">Inside: {fmt(inner, 0)} ml · target {target.ml} ml</div>
    </div>
  );
  const controls = (
    <>
      <Slider label="Outer width" value={b.W} min={40} max={300} step={step} unit="mm" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, W: x }))} color="#1971c2" />
      <Slider label="Outer depth" value={b.D} min={40} max={300} step={step} unit="mm" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, D: x }))} color="#c2255c" disabled={!!target.fixedD} />
      <Slider label="Outer height" value={b.H} min={20} max={250} step={step} unit="mm" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, H: x }))} color="#7048e8" />
      <div className="row">
        <Toggle label="Cut-away front" checked={cutaway} onChange={setCutaway} />
        <Toggle label="Show water" checked={water} onChange={setWater} />
        <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
      </div>
    </>
  );
  const panel = (
    <Challenge
      id={id}
      title={title}
      brief={
        <>
          {intro}
          <p>Design an open-top container that holds <span className="target">{target.ml >= 1000 ? `${target.ml / 1000} litre${target.ml > 1000 ? 's' : ''}` : `${target.ml} ml`}</span> inside.</p>
          <ul>
            <li>Walls and floor are <b>{t} mm</b> thick.</li>
            {target.fixedD && <li>Depth is fixed at <b>{target.fixedD} mm</b> (it must fit a drawer).</li>}
            {target.maxH && <li>Total height must be at most <b>{target.maxH} mm</b> (shelf above).</li>}
            <li>Tolerance ±{target.tol * 100}%.</li>
          </ul>
        </>
      }
      check={check}
      onNewTarget={fixedTarget ? undefined : () => setTarget(boxTarget(difficulty))}
      hint="1 litre = 1000 ml = 1000 cm³, the space inside a 100 × 100 × 100 mm cube. Divide mm³ by 1000 to get ml."
      solution={
        <Steps steps={[
          `Target: ${target.ml} ml = ${target.ml * 1000} mm³ inside.`,
          `Choose inside width and depth, e.g. ${target.fixedD ? target.fixedD - 2 * t : 100} × 100 mm.`,
          `Inside height = ${target.ml * 1000} ÷ (${target.fixedD ? target.fixedD - 2 * t : 100} × 100) = ${fmt((target.ml * 1000) / ((target.fixedD ? target.fixedD - 2 * t : 100) * 100), 1)} mm.`,
          `Outside: add the walls → width ${100 + 2 * t}${target.fixedD ? '' : `, depth ${100 + 2 * t}`}, height = inside height + ${t} mm floor.`,
          ...(target.maxH ? ['If that is too tall, make the inside wider and repeat.'] : []),
        ]} />
      }
    >
      <Stats>
        <Stat label="inside volume" value={`${fmt(inner, 0)} ml`} color="#1c7ed6" sub={`${b.W - 2 * t} × ${b.D - 2 * t} × ${b.H - t} mm`} />
        <Stat label="outside volume" value={`${fmt(outer, 0)} ml`} color="#868e96" />
        <Stat label="plastic used" value={`${fmt(material, 0)} cm³`} color="#e8590c" />
      </Stats>
    </Challenge>
  );
  return <Workbench title={title} tool={tool} controls={controls} panel={panel} />;
}

function ContainerChallenge() {
  return <ContainerDesigner id="l9-container" title="Challenge: design a storage container" />;
}

export default {
  'l9-cube': CubeLesson,
  'l9-solids': SolidsLesson,
  'l9-volume': VolumeLesson,
  'l9-sections': SectionsLesson,
  'l9-container': ContainerChallenge,
};

