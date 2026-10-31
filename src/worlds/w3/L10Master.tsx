import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { Slider, Toggle } from '../../components/ui';
import { csgRaw, extrusionGeometry } from '../../lib/shapes';
import { rectPoly, treatCorners } from '../../lib/poly';
import { exportSTL } from '../../lib/export';
import { fmt } from '../../lib/math';
import { useProgress } from '../../store/progress';
import { toast } from '../../store/toast';
import type { Feedback, LessonStep } from '../../lib/types';

interface P {
  L: number;
  W: number;
  H: number;
  t: number;
  r: number;
  pw: number;
  ph: number;
  py: number;
  bosses: boolean;
}
const INIT: P = { L: 56, W: 36, H: 20, t: 1.2, r: 1, pw: 8, ph: 3, py: 6, bosses: false };
const PCB = { L: 50, W: 30, T: 1.6, comp: 10.4, stand: 3 };
const USB = { w: 8.9, h: 3.2 };

function rounded(l: number, w: number, r: number) {
  const b = rectPoly(-l / 2, -w / 2, l / 2, w / 2);
  return r > 0.2 ? treatCorners(b, Math.min(r, Math.min(l, w) / 2 - 0.1), 'fillet', 6) : b;
}
function prism(o: [number, number][], y0: number, h: number) {
  const g = extrusionGeometry({ outline: o, holes: [], depth: h, bevel: 0 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + h / 2, 0);
  return g;
}
function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function derive(p: P) {
  const pcbY = p.t + PCB.stand; // bottom of board
  const usbY = pcbY + PCB.T + USB.h / 2;
  const pcbX = -p.L / 2 + p.t + 0.5 + PCB.L / 2;
  return { pcbY, usbY, pcbX, innerL: p.L - 2 * p.t, innerW: p.W - 2 * p.t, innerH: p.H - 2 * p.t };
}

export function buildBase(p: P) {
  const hb = p.H - p.t;
  let g: THREE.BufferGeometry = prism(rounded(p.L, p.W, p.r), 0, hb);
  const tools: THREE.BufferGeometry[] = [prism(rounded(p.L - 2 * p.t, p.W - 2 * p.t, Math.max(0, p.r - p.t)), p.t, hb)];
  tools.push(box(p.t * 3, p.ph, p.pw, -p.L / 2, p.py, 0));
  g = csgRaw(g, tools, 'subtract');
  if (p.bosses) {
    const { pcbX } = derive(p);
    const xs = [pcbX - PCB.L / 2 + 3.5, pcbX + PCB.L / 2 - 3.5];
    const zs = [-PCB.W / 2 + 3.5, PCB.W / 2 - 3.5];
    const posts: THREE.BufferGeometry[] = [];
    const holes: THREE.BufferGeometry[] = [];
    for (const x of xs)
      for (const z of zs) {
        const c = new THREE.CylinderGeometry(2.8, 2.8, PCB.stand + 0.2, 20);
        c.translate(x, p.t + PCB.stand / 2 - 0.1, z);
        posts.push(c);
        const h = new THREE.CylinderGeometry(1.1, 1.1, PCB.stand + 2, 16);
        h.translate(x, p.t + PCB.stand / 2 + 0.5, z);
        holes.push(h);
      }
    g = csgRaw(g, posts, 'union');
    g = csgRaw(g, holes, 'subtract');
  }
  return g;
}
function buildLid(p: P) {
  return prism(rounded(p.L, p.W, p.r), 0, p.t);
}

function EnableClipping() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);
  return null;
}

export function rubricFor(p: P) {
  const d = derive(p);
  const rows: { criterion: string; points: number; max: number; note?: string }[] = [];
  const add = (criterion: string, ok: number, max: number, note?: string) => rows.push({ criterion, points: Math.max(0, Math.min(max, ok * max)), max, note });
  const clearL = d.innerL - PCB.L - 0.5,
    clearW = (d.innerW - PCB.W) / 2;
  const headroom = p.H - p.t - (d.pcbY + PCB.T + PCB.comp);
  add('PCB fits with ≥ 1 mm clearance (length, width, height)', clearL >= 1 && clearW >= 1 && headroom >= 1 ? 1 : clearL >= 0 && clearW >= 0 && headroom >= 0 ? 0.4 : 0, 25, `clearances: length ${fmt(clearL, 1)}, sides ${fmt(clearW, 1)}, above ${fmt(headroom, 1)} mm`);
  add('Wall thickness ≥ 1.6 mm (strong enough to print/mould)', p.t >= 1.6 ? 1 : p.t >= 1.2 ? 0.4 : 0, 15, `wall ${fmt(p.t, 1)} mm`);
  const portOk = p.pw >= USB.w + 1 && p.ph >= USB.h + 1;
  const portAligned = Math.abs(p.py - d.usbY) <= 0.5;
  const portTidy = p.pw <= USB.w + 4 && p.ph <= USB.h + 4;
  add('USB-C opening clears the plug (≥ 0.5 mm all round)', portOk ? 1 : 0, 15, `opening ${fmt(p.pw, 1)} × ${fmt(p.ph, 1)}, plug ${USB.w} × ${USB.h} mm`);
  add('USB-C opening aligned with the connector height', portAligned ? 1 : Math.abs(p.py - d.usbY) <= 1.5 ? 0.4 : 0, 15, `opening centre y = ${fmt(p.py, 1)}, connector centre y = ${fmt(d.usbY, 2)} mm`);
  add('Opening is neat (not oversized)', portTidy ? 1 : 0, 5);
  add('Screw bosses support the PCB', p.bosses ? 1 : 0, 10);
  add('Compact: outer size within 60 × 42 × 26 mm', p.L <= 60 && p.W <= 42 && p.H <= 26 ? 1 : 0, 10, `outer ${fmt(p.L)} × ${fmt(p.W)} × ${fmt(p.H)} mm`);
  add('Comfortable corner radius ≥ 2 mm', p.r >= 2 ? 1 : 0, 5);
  return { rows, d };
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Brief: design a two-part enclosure (base + lid) for a 50 × 30 mm sensor board with a USB-C connector on its left edge. The green board and silver plug are shown in place.', ta: 'சுருக்கம்: USB-C இணைப்பு கொண்ட 50 × 30 mm சென்சார் பலகைக்கு இரண்டு பகுதி உறை வடிவமையுங்கள்.' },
  { stage: 'UNDERSTAND', text: 'Requirements: ≥ 1 mm clearance around the board, walls ≥ 1.6 mm, a USB-C opening aligned with the plug, screw bosses, compact outer size, comfortable corners. Use “Cutaway” to look inside.', ta: 'தேவைகள்: பலகையைச் சுற்றி ≥ 1 mm இடைவெளி, சுவர் ≥ 1.6 mm, USB-C திறப்பு, திருகு bosses.' },
  { stage: 'BUILD', text: 'Adjust the parameters. The base is a real shelled solid with Boolean cuts; the rubric is checked automatically.', ta: 'அளவுருக்களைச் சரிசெய்யுங்கள். மதிப்பீடு தானாக நடக்கும்.' },
  { stage: 'TEST', text: 'Check your design, then export the base and lid as STL for printing.', ta: 'சரிபார்த்து STL ஆக ஏற்றுமதி செய்யுங்கள்.' },
];

export default function L10Master() {
  const [p, setP] = useState<P>(INIT);
  const [cut, setCut] = useState(true);
  const [explode, setExplode] = useState(true);
  const base = useMemo(() => buildBase(p), [p]);
  const lid = useMemo(() => buildLid(p), [p]);
  const { rows, d } = rubricFor(p);
  const set = (q: Partial<P>) => setP({ ...p, ...q });
  const clip = useMemo(() => (cut ? [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)] : []), [cut]);

  const evaluate = (): Feedback => {
    const score = Math.round(rows.reduce((s, r) => s + r.points, 0));
    const bad = rows.filter((r) => r.points < r.max);
    return {
      score,
      correct: rows.filter((r) => r.points >= r.max).map((r) => r.criterion),
      issues: bad.map((r) => ({ label: r.criterion, detail: r.note })),
      why: 'An enclosure is where CAD meets reality: one millimetre too small and the board will not fit; a port 1 mm too low and the cable will not plug in. Engineers design around the components, with deliberate clearances and wall thicknesses that suit the manufacturing process.',
      suggestion: bad.length ? `Start with “${bad[0].criterion}”. ${bad[0].note ?? ''}` : 'Export the STL and check it in a slicer — then print a test fit before committing to the final version.',
      rubric: rows,
      canShowCorrection: false,
    };
  };

  const doExport = () => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(base);
    const l = new THREE.Mesh(lid);
    l.position.set(p.L + 10, 0, 0);
    g.add(b, l);
    try {
      exportSTL(g, 'enclosure-base-and-lid');
      const nb = useProgress.getState().bump('exports');
      if (nb.length) toast('📦 Badge unlocked: Ready for Reality');
    } catch (e) {
      toast(String(e));
    }
  };

  return (
    <LevelShell
      id="w3-l10"
      steps={steps}
      evaluate={evaluate}
      onRetry={() => setP(INIT)}
      hints={[
        { en: 'Inner length must be ≥ 50 + 0.5 + 1 = 51.5 mm, so outer length ≥ 51.5 + 2 × wall.', ta: 'உள் நீளம் ≥ 51.5 mm.' },
        { en: `The plug’s centre is at y = wall + 3 (standoff) + 1.6 (board) + 1.6 (half plug) — about ${fmt(INIT.t + 3 + 1.6 + 1.6, 1)} mm with a 1.2 mm wall; recompute when you change the wall.`, ta: 'Plug மையம் = wall + 3 + 1.6 + 1.6.' },
      ]}
      viewport={
        <Stage3D fit={80} camera={[-80, 65, 100]} target={[0, 10, 0]} env>
          <EnableClipping />
          <mesh geometry={base} castShadow>
            <meshStandardMaterial color="#e9edf2" roughness={0.5} clippingPlanes={clip} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={lid} position={[0, explode ? p.H + 18 : p.H - p.t, 0]} castShadow>
            <meshStandardMaterial color="#4cc9f0" roughness={0.4} transparent opacity={0.85} clippingPlanes={clip} />
          </mesh>
          <group position={[d.pcbX, d.pcbY + PCB.T / 2, 0]}>
            <mesh>
              <boxGeometry args={[PCB.L, PCB.T, PCB.W]} />
              <meshStandardMaterial color="#2e7d32" />
            </mesh>
            <mesh position={[0, PCB.T / 2 + 4, 0]}>
              <boxGeometry args={[18, 8, 12]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            <mesh position={[10, PCB.T / 2 + PCB.comp / 2, -6]}>
              <cylinderGeometry args={[4, 4, PCB.comp, 20]} />
              <meshStandardMaterial color="#555" metalness={0.6} />
            </mesh>
            <mesh position={[-PCB.L / 2 + 3.5, PCB.T / 2 + USB.h / 2, 0]}>
              <boxGeometry args={[7.5, USB.h, USB.w]} />
              <meshStandardMaterial color="#c9ced6" metalness={1} roughness={0.25} />
            </mesh>
          </group>
          <Label position={[-p.L / 2 - 10, p.py, 0]} color="#ffd166">
            USB-C
          </Label>
        </Stage3D>
      }
    >
      <Slider label="Outer length (X)" value={p.L} min={40} max={80} step={0.5} unit="mm" onChange={(L) => set({ L })} />
      <Slider label="Outer width (Z)" value={p.W} min={25} max={60} step={0.5} unit="mm" onChange={(W) => set({ W })} />
      <Slider label="Outer height (Y)" value={p.H} min={10} max={40} step={0.5} unit="mm" onChange={(H) => set({ H })} />
      <Slider label="Wall thickness" value={p.t} min={0.8} max={4} step={0.1} unit="mm" onChange={(t) => set({ t })} digits={1} />
      <Slider label="Corner radius" value={p.r} min={0} max={8} step={0.5} unit="mm" onChange={(r) => set({ r })} />
      <div className="lbl">USB-C opening (left wall)</div>
      <Slider label="Opening width" value={p.pw} min={4} max={16} step={0.1} unit="mm" onChange={(pw) => set({ pw })} digits={1} />
      <Slider label="Opening height" value={p.ph} min={2} max={10} step={0.1} unit="mm" onChange={(ph) => set({ ph })} digits={1} />
      <Slider label="Opening centre height (y)" value={p.py} min={2} max={25} step={0.05} unit="mm" onChange={(py) => set({ py })} digits={2} />
      <Toggle checked={p.bosses} onChange={(bosses) => set({ bosses })} label="Screw bosses (4 × M2 standoffs)" />
      <Toggle checked={cut} onChange={setCut} label="Cutaway view" />
      <Toggle checked={explode} onChange={setExplode} label="Lift the lid (exploded)" />
      <div className="kv">
        <span>Inner cavity</span>
        <span>
          {fmt(d.innerL, 1)} × {fmt(d.innerW, 1)} × {fmt(p.H - 2 * p.t, 1)} mm
        </span>
        <span>Connector centre y</span>
        <span>{fmt(d.usbY, 2)} mm</span>
      </div>
      <button className="btn small" onClick={doExport}>
        ⬇ Export base + lid (STL)
      </button>
      <div className="note">Real enclosures also need lid fastening, draft angles (moulding) or tolerance tests (printing). Printing a quick test fit is always worth it.</div>
    </LevelShell>
  );
}
