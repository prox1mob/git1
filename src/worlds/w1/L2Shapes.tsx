import { useMemo, useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { MiniEditor } from '../../components/editor/MiniEditor';
import { Inspector } from '../../components/editor/panels';
import { Ghost } from '../../components/three/ObjectMesh';
import { Task } from '../../components/ui';
import { createEditorStore, EditorContext, flattenWorld } from '../../store/editorStore';
import { makeObject, objectSize, type SceneObject } from '../../lib/shapes';
import { useSettings } from '../../store/progress';
import { absTol, fmt } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Almost every product starts as simple shapes: a bottle is a cylinder, a lamp shade a cone, a dice a cube. These are called primitives.', ta: 'பெரும்பாலான பொருட்கள் எளிய வடிவங்களில் இருந்து தொடங்குகின்றன: பாட்டில் = cylinder, விளக்கு மூடி = cone. இவை primitives எனப்படும்.' },
  { stage: 'TOUCH', text: 'Tap a shape to select it. Use the Move / Rotate / Scale gizmo arrows, or "☝ Gestures": drag to move, pinch to resize, twist two fingers to rotate.', ta: 'ஒரு வடிவத்தைத் தட்டித் தேர்ந்தெடுக்கவும். Move / Rotate / Scale அல்லது Gestures பயன்படுத்தவும்.' },
  { stage: 'EXPERIMENT', text: 'Add a sphere, cylinder, cone and prism from the toolbar. Change "Sides" on a prism: 3 makes a triangular prism, 6 a hexagonal one.', ta: 'Toolbar-இல் இருந்து sphere, cylinder, cone, prism சேர்க்கவும். Prism-இன் Sides மாற்றிப் பாருங்கள்.' },
  { stage: 'UNDERSTAND', text: 'Each shape is defined by a few numbers: a box by width, height, depth; a cylinder by radius and height. Typing numbers in the panel is more precise than dragging.', ta: 'ஒவ்வொரு வடிவமும் சில எண்களால் வரையறுக்கப்படுகிறது: box = அகலம், உயரம், ஆழம்; cylinder = ஆரம், உயரம்.' },
  { stage: 'BUILD', text: 'Complete the six tasks on the right. They are checked live as you work.', ta: 'வலப்புறம் உள்ள ஆறு பணிகளை முடிக்கவும்.' },
];

function analyse(objs: SceneObject[], tol: number, dupCount: number, rotCount: number) {
  const flat = flattenWorld(objs);
  const types = new Set(flat.map((o) => o.type));
  const cyl = flat.filter((o) => o.type === 'cylinder');
  const cones = flat.filter((o) => o.type === 'cone');
  const spheres = flat.filter((o) => o.type === 'sphere');
  const tall = cyl.find((c) => Math.abs(objectSize(c)[1] - 60) <= tol);
  const sph = spheres.find((s) => Math.abs(objectSize(s)[0] - 30) <= tol);
  let stack: { ok: boolean; gap: number; off: number; cone?: SceneObject; cyl?: SceneObject } = { ok: false, gap: Infinity, off: Infinity };
  for (const c of cyl)
    for (const k of cones) {
      const ch = objectSize(c)[1],
        kh = objectSize(k)[1];
      const gap = k.position[1] - kh / 2 - (c.position[1] + ch / 2);
      const off = Math.hypot(k.position[0] - c.position[0], k.position[2] - c.position[2]);
      const upright = Math.abs(k.rotation[0]) < 0.05 && Math.abs(k.rotation[2]) < 0.05;
      const ok = Math.abs(gap) <= tol && off <= tol * 1.5 && upright;
      if (ok || Math.abs(gap) + off < Math.abs(stack.gap) + stack.off) stack = { ok, gap, off, cone: k, cyl: c };
    }
  const rotated = rotCount > 0 || flat.some((o) => o.rotation.some((r) => Math.abs(r) > 0.01));
  return {
    shapes: ['sphere', 'cylinder', 'cone', 'prism'].every((t) => types.has(t as SceneObject['type'])),
    missing: ['sphere', 'cylinder', 'cone', 'prism'].filter((t) => !types.has(t as SceneObject['type'])),
    rotated,
    tall: !!tall,
    cylH: cyl.map((c) => objectSize(c)[1]),
    dup: dupCount > 0,
    sphere: !!sph,
    sphD: spheres.map((s) => objectSize(s)[0]),
    stack,
  };
}

export default function L2Shapes() {
  const store = useMemo(() => createEditorStore({ objects: [makeObject('box', { name: 'Cube', position: [0, 10, 0] })], snapMove: 5 }), []);
  const objects = store((s) => s.objects);
  const stats = store((s) => s.stats);
  const { difficulty } = useSettings();
  const tol = absTol(difficulty);
  const [corr, setCorr] = useState(false);
  const a = analyse(objects, tol, stats.duplicates, stats.rotations);

  const evaluate = (): Feedback => {
    const checks: [boolean, string, string][] = [
      [a.shapes, 'Added a sphere, cylinder, cone and prism.', `Still missing: ${a.missing.join(', ')}.`],
      [a.rotated, 'Rotated a shape.', 'No shape has been rotated yet.'],
      [a.tall, 'Made a cylinder exactly 60 mm tall.', a.cylH.length ? `Cylinder heights: ${a.cylH.map((h) => fmt(h)).join(', ')} mm — target 60 mm.` : 'No cylinder yet.'],
      [a.dup, 'Duplicated an object.', 'Use ⧉ Duplicate to copy a shape.'],
      [a.sphere, 'Resized a sphere to 30 mm diameter.', a.sphD.length ? `Sphere diameters: ${a.sphD.map((d) => fmt(d)).join(', ')} mm — target 30 mm (radius 15).` : 'No sphere yet.'],
      [a.stack.ok, 'Stacked a cone neatly on top of a cylinder.', isFinite(a.stack.gap) ? `Closest cone is ${fmt(a.stack.gap)} mm ${a.stack.gap > 0 ? 'above' : 'inside'} the cylinder top and ${fmt(a.stack.off)} mm off-centre.` : 'Add a cone and a cylinder, then stack them.'],
    ];
    const score = Math.round((checks.filter((c) => c[0]).length / checks.length) * 100);
    return {
      score,
      correct: checks.filter((c) => c[0]).map((c) => c[1]),
      issues: checks.filter((c) => !c[0]).map((c) => ({ label: c[2] })),
      why: 'Designers sketch new products with primitives first, because they are fast to change. Precise sizes and clean stacking (faces touching, centres aligned) are what later make parts fit together in the real world.',
      suggestion: !a.stack.ok
        ? 'To stack: the cone’s Y must equal cylinder top (cylinder Y + half its height) + half the cone height. Type the numbers in the panel instead of dragging.'
        : 'Try the Front view: stacking errors are much easier to see when one axis is hidden.',
      canShowCorrection: !a.stack.ok || !a.tall,
    };
  };

  const ghosts: SceneObject[] = [];
  if (corr) {
    const c = a.stack.cyl;
    if (c) {
      const ch = objectSize(c)[1];
      const kh = a.stack.cone ? objectSize(a.stack.cone)[1] : 20;
      const kr = a.stack.cone ? objectSize(a.stack.cone)[0] / 2 : 10;
      ghosts.push(makeObject('cone', { position: [c.position[0], c.position[1] + ch / 2 + kh / 2, c.position[2]], dims: { r: kr, h: kh } }));
      if (!a.tall) ghosts.push(makeObject('cylinder', { position: [c.position[0], 30, c.position[2]], dims: { r: objectSize(c)[0] / 2, h: 60 } }));
    } else ghosts.push(makeObject('cylinder', { position: [0, 30, 0], dims: { r: 10, h: 60 } }), makeObject('cone', { position: [0, 70, 0], dims: { r: 10, h: 20 } }));
  }

  return (
    <EditorContext.Provider value={store}>
      <LevelShell
        id="w1-l2"
        steps={steps}
        viewport={
          <MiniEditor allowed={['box', 'sphere', 'cylinder', 'cone', 'prism']} fit={120}>
            {ghosts.map((g) => (
              <Ghost key={g.id} o={g} />
            ))}
          </MiniEditor>
        }
        evaluate={evaluate}
        onCorrection={setCorr}
        onRetry={() => store.getState().setObjects([makeObject('box', { name: 'Cube', position: [0, 10, 0] })])}
        hints={[
          { en: 'Select the cylinder and type 60 into "Height (Y)" in the panel.', ta: 'Cylinder-ஐத் தேர்ந்தெடுத்து Height-இல் 60 என டைப் செய்யவும்.' },
          { en: 'Cylinder height 60 at Y = 30 has its top at Y = 60. A 20 mm cone must then sit at Y = 70.', ta: 'Y = 30-இல் 60 mm cylinder-இன் மேல்பகுதி Y = 60. 20 mm cone, Y = 70-இல் இருக்க வேண்டும்.' },
        ]}
      >
        <div>
          <h3>Tasks</h3>
          <Task ok={a.shapes}>Add a sphere, a cylinder, a cone and a prism</Task>
          <Task ok={a.rotated}>Rotate any shape</Task>
          <Task ok={a.tall}>Make a cylinder exactly 60 mm tall</Task>
          <Task ok={a.dup}>Duplicate an object</Task>
          <Task ok={a.sphere}>Resize a sphere to 30 mm diameter</Task>
          <Task ok={a.stack.ok}>Stack a cone on top of a cylinder (touching, centred)</Task>
        </div>
        <div className="card" style={{ padding: 10 }}>
          <h3>Selected shape</h3>
          <Inspector unit="mm" showMaterial={false} />
        </div>
      </LevelShell>
    </EditorContext.Provider>
  );
}
