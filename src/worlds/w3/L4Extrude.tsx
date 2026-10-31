import { useMemo, useRef, useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { CadSketch, ConstraintPanel, useSketchHistory, type CadTool } from '../../components/sketch/CadSketch';
import { SketchOnPlane } from '../../components/sketch/SketchPlane3D';
import { AxisHandle } from '../../components/three/AxisHandle';
import { ObjectMesh, Label } from '../../components/three/ObjectMesh';
import { NumberField, Seg, Slider } from '../../components/ui';
import { addCircle, addRect, analyse, closedLoops, sid, solve, type Sketch } from '../../lib/cad/sketch';
import { area, checkProfiles, pointInPolygon, type Loop } from '../../lib/poly';
import { makeObject, objectVolume, type SceneObject } from '../../lib/shapes';
import { fmt, relTol, scoreFromError } from '../../lib/math';
import { useSettings } from '../../store/progress';
import type { Feedback, LessonStep } from '../../lib/types';

export function plateSketch(): Sketch {
  let s = addRect({ points: [], entities: [], constraints: [] }, 0, 0, 80, 50);
  const [a, b, , d] = s.points;
  s = {
    ...s,
    constraints: [
      ...s.constraints,
      { id: sid('k'), type: 'fix', refs: [a.id], x: 0, y: 0 },
      { id: sid('k'), type: 'hdist', refs: [a.id, b.id], value: 80 },
      { id: sid('k'), type: 'vdist', refs: [a.id, d.id], value: 50 },
    ],
  };
  let cid: string;
  [s, cid] = addCircle(s, 20, 25, 10);
  s = { ...s, constraints: [...s.constraints, { id: sid('k'), type: 'radius', refs: [cid], value: 10 }] };
  return solve(s);
}

/** Organise closed loops into outlines with holes using containment. */
export function sketchSolids(sk: Sketch) {
  const { loops, openEnds } = closedLoops(sk);
  const asLoops: Loop[] = loops.map((pts, i) => {
    const depth = loops.filter((o, j) => j !== i && pointInPolygon(pts[0], o)).length;
    return { id: String(i), pts, hole: depth % 2 === 1 };
  });
  return { ...checkProfiles(asLoops), openEnds, loopCount: loops.length };
}

const TARGET_V = 45000; // mm³

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'An extrusion pushes a closed 2D profile straight out of its sketch plane, like toothpaste from a tube. The plate profile is sketched on the Top plane.', ta: 'Extrusion ஒரு மூடிய 2D வடிவத்தை அதன் தளத்திலிருந்து நேராக வெளியே தள்ளுகிறது.' },
  { stage: 'TOUCH', text: 'Drag the orange arrow on the 3D part, or the slider, to change the extrusion distance. Try “Symmetric” to grow equally in both directions.', ta: '3D பாகத்தின் ஆரஞ்சு அம்பை இழுங்கள் அல்லது slider பயன்படுத்துங்கள்.' },
  { stage: 'EXPERIMENT', text: 'Edit the sketch on the left: draw a rectangle or circle inside the plate — inner loops become holes automatically. An open sketch cannot be extruded.', ta: 'உள்ளே வரையப்படும் மூடிய வடிவங்கள் தானாகத் துளைகளாகும். திறந்த வரைவை extrude செய்ய முடியாது.' },
  { stage: 'UNDERSTAND', text: 'Volume of an extrusion = profile area × distance (V = A·d). That is why the profile area is shown.', ta: 'Extrusion கனஅளவு = வடிவப் பரப்பு × தூரம் (V = A·d).' },
  { stage: 'BUILD', text: 'Challenge: the plate must contain exactly 45 cm³ of material, keep its Ø20 hole, and be extruded from the Top plane in one direction.', ta: 'சவால்: தகடு சரியாக 45 cm³ பொருள் கொண்டிருக்க வேண்டும், Ø20 துளையுடன்.' },
];

export default function L4Extrude() {
  const { difficulty } = useSettings();
  const tol = relTol(difficulty);
  const h = useSketchHistory(plateSketch());
  const [tool, setTool] = useState<CadTool>('select');
  const [sel, setSel] = useState<string[]>([]);
  const [depth, setDepth] = useState(10);
  const [dir, setDir] = useState<'one' | 'sym'>('one');
  const [corr, setCorr] = useState(false);
  const start = useRef(depth);
  const info = analyse(h.sk);
  const prof = useMemo(() => sketchSolids(h.sk), [h.sk]);
  const objects: SceneObject[] = useMemo(
    () =>
      prof.ok
        ? prof.solids.map((s) =>
            makeObject('extrusion', {
              extrusion: { outline: s.outline, holes: s.holes, depth, bevel: 0 },
              rotation: [-Math.PI / 2, 0, 0],
              position: [0, dir === 'one' ? depth / 2 : 0, 0],
              material: { preset: 'alu', color: '#c9ced6', roughness: 0.35, metalness: 0.7, opacity: 1 },
            }),
          )
        : [],
    [prof, depth, dir],
  );
  const A = prof.ok ? prof.solids.reduce((s, x) => s + area(x.outline) - x.holes.reduce((q, hh) => q + area(hh), 0), 0) : 0;
  const V = objects.reduce((s, o) => s + objectVolume(o), 0);
  const cx = prof.ok ? prof.solids[0].outline.reduce((s, p) => s + p[0], 0) / prof.solids[0].outline.length : 40;
  const cy = prof.ok ? prof.solids[0].outline.reduce((s, p) => s + p[1], 0) / prof.solids[0].outline.length : 25;
  const holeD = h.sk.entities.filter((e) => e.kind === 'circle').map((e) => (e.kind === 'circle' ? e.r * 2 : 0));

  const evaluate = (): Feedback | string => {
    if (!prof.ok) return 'The sketch is not a valid closed profile yet — see the warning in the panel.';
    const e = Math.abs(V - TARGET_V) / TARGET_V;
    const hole = holeD.some((d) => Math.abs(d - 20) < 0.5) && prof.solids.some((s) => s.holes.length > 0);
    const score = Math.round(scoreFromError(e, tol) * 0.7 + (hole ? 20 : 0) + (dir === 'one' ? 10 : 0));
    const need = TARGET_V / A;
    return {
      score,
      correct: [e <= tol ? `Volume ${fmt(V / 1000, 2)} cm³ — on target.` : '', hole ? 'Ø20 hole kept as an inner loop.' : '', dir === 'one' ? 'Extruded in one direction from the sketch plane.' : ''].filter(Boolean),
      issues: [
        ...(e > tol ? [{ label: `Volume is ${fmt(V / 1000, 2)} cm³, target 45 cm³.`, detail: `Area A = ${fmt(A, 1)} mm², so d = V / A = 45000 / ${fmt(A, 1)} = ${fmt(need, 2)} mm.` }] : []),
        ...(hole ? [] : [{ label: 'The Ø20 hole is missing or the wrong size.' }]),
        ...(dir === 'one' ? [] : [{ label: 'Use a one-direction extrusion so the plate sits on the sketch plane.' }]),
      ],
      why: 'Extrusion is the workhorse of CAD: most machined, moulded and printed parts start as extruded sketches. Knowing V = A·d lets you hit a weight or material budget before you ever print a part.',
      suggestion: `Type ${fmt(need, 2)} into the distance field — then try changing the hole size and watch how the required thickness changes.`,
      canShowCorrection: true,
    };
  };

  return (
    <LevelShell
      id="w3-l4"
      steps={steps}
      evaluate={evaluate}
      onCorrection={setCorr}
      onRetry={() => {
        h.reset(plateSketch());
        setDepth(10);
      }}
      hints={[{ en: 'Profile area = 80 × 50 − π × 10² ≈ 3685.8 mm². Distance = 45 000 ÷ 3685.8.', ta: 'பரப்பு ≈ 3685.8 mm². தூரம் = 45000 ÷ 3685.8.' }]}
      viewport={
        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', minHeight: 260 }}>
            <div className="toolbar">
              <Seg value={tool} onChange={setTool} options={[{ v: 'select', label: '✋' }, { v: 'line', label: '╱' }, { v: 'rect', label: '▭' }, { v: 'circle', label: '◯' }, { v: 'arc', label: '◠' }]} />
              <button className="btn small icon" onClick={h.undo} disabled={!h.canUndo}>
                ↶
              </button>
              <span className="muted" style={{ fontSize: 12 }}>Top-plane sketch</span>
            </div>
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              <CadSketch sketch={h.sk} onChange={h.change} tool={tool} selection={sel} onSelect={setSel} info={info} extent={60} center={[40, 25]} />
            </div>
          </div>
          <div style={{ flex: '1 1 300px', display: 'flex', minHeight: 260 }}>
            <Stage3D fit={100} camera={[130, 110, 130]} target={[40, 5, -25]} showViews={false} env axes={30}>
              <SketchOnPlane sketch={h.sk} plane="top" />
              {objects.map((o) => (
                <ObjectMesh key={o.id} o={o} edges />
              ))}
              {prof.ok && (
                <AxisHandle
                  position={[cx, (dir === 'one' ? depth : depth / 2) + 6, -cy]}
                  dir={[0, 1, 0]}
                  shape="arrow"
                  size={4}
                  onStart={() => (start.current = depth)}
                  onDrag={(d) => setDepth(Math.max(0.5, Math.round((start.current + (dir === 'one' ? d : 2 * d)) * 10) / 10))}
                />
              )}
              {corr && A > 0 && <Label position={[cx, TARGET_V / A + 10, -cy]} color="#ffd166">{`target thickness ${fmt(TARGET_V / A, 2)} mm`}</Label>}
            </Stage3D>
          </div>
        </div>
      }
    >
      {!prof.ok && (
        <div className="note warn">
          {prof.openEnds > 0 && <div>⚠ The sketch has {prof.openEnds} open end(s) — close every loop.</div>}
          {prof.errors.map((e, i) => (
            <div key={i}>⚠ {e}</div>
          ))}
        </div>
      )}
      <Seg value={dir} onChange={setDir} options={[{ v: 'one', label: 'One direction' }, { v: 'sym', label: 'Symmetric (mid-plane)' }]} />
      <Slider label="Extrusion distance" value={depth} min={0.5} max={60} step={0.1} unit="mm" onChange={setDepth} />
      <NumberField label="Distance" unit="mm" value={depth} digits={2} step={0.1} min={0.1} onChange={setDepth} />
      <div className="formula">A = {fmt(A, 1)} mm² (outline − holes)</div>
      <div className="formula">
        V = A × d = {fmt(A, 1)} × {fmt(depth, 2)} = <b>{fmt(V / 1000, 2)} cm³</b>
      </div>
      <details>
        <summary className="lbl" style={{ cursor: 'pointer' }}>
          Sketch constraints
        </summary>
        <ConstraintPanel sketch={h.sk} selection={sel} onChange={h.change} onSelect={setSel} />
      </details>
    </LevelShell>
  );
}

