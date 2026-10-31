import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { ObjectMesh } from '../../components/three/ObjectMesh';
import { Seg, Slider, Task, Toggle } from '../../components/ui';
import { getGeometry, makeObject, objectBox, objectMatrix, objectSize, type SceneObject } from '../../lib/shapes';
import { bake, isWatertight, overhangs } from '../../lib/meshAnalysis';
import { exportSTL } from '../../lib/export';
import { listProjects, type Project } from '../../lib/storage';
import { flattenWorld } from '../../store/editorStore';
import { fmt } from '../../lib/math';
import { useProgress } from '../../store/progress';
import { toast } from '../../store/toast';
import type { Feedback, LessonStep, Vec3 } from '../../lib/types';

const BED: Vec3 = [220, 250, 220];
const mat = (c: string) => ({ preset: 'pla', color: c, roughness: 0.55, metalness: 0, opacity: 1 });

function clip(t: number, attached: boolean): SceneObject[] {
  return [
    makeObject('box', { name: 'Base', dims: { w: 40, h: 4, d: 20 }, position: [0, 2, 0], material: mat('#4cc9f0') }),
    makeObject('box', { name: 'Left finger', dims: { w: t, h: 14, d: 20 }, position: [-8, 11, 0], material: mat('#4cc9f0') }),
    makeObject('box', { name: 'Right finger', dims: { w: t, h: 14, d: 20 }, position: [8, 11, 0], material: mat('#4cc9f0') }),
    makeObject('cylinder', { name: 'Left grip', dims: { r: 2, h: 20 }, position: [-8 + t / 2 + 1, 17, 0], rotation: [Math.PI / 2, 0, 0], material: mat('#f8961e') }),
    makeObject('cylinder', { name: 'Right grip', dims: { r: 2, h: 20 }, position: [8 - t / 2 - 1, 17, 0], rotation: [Math.PI / 2, 0, 0], material: mat('#f8961e') }),
    makeObject('box', { name: 'Label tab', dims: { w: 14, h: 10, d: Math.max(t, 0.6) }, position: [0, attached ? 9 : 12, -9.4], material: mat('#90be6d') }),
  ];
}

const ORIENT: { name: string; e: Vec3 }[] = [
  { name: 'Upright', e: [0, 0, 0] },
  { name: 'On its side', e: [Math.PI / 2, 0, 0] },
  { name: 'Upside down', e: [Math.PI, 0, 0] },
  { name: 'On its end', e: [0, 0, Math.PI / 2] },
];

export function printChecks(objs: SceneObject[], orient: Vec3) {
  const R = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...orient));
  const parts = flattenWorld(objs);
  const boxes = parts.map((o) => objectBox(o).applyMatrix4(R));
  const all = boxes.reduce((a, b) => a.union(b.clone()), new THREE.Box3());
  const lift = -all.min.y;
  const size = new THREE.Vector3();
  all.getSize(size);
  // connectivity (touching / overlapping boxes, 0.25 mm slack), seeded from parts on the bed
  const touch = (a: THREE.Box3, b: THREE.Box3) => a.clone().expandByScalar(0.25).intersectsBox(b);
  const reached = new Set<number>();
  boxes.forEach((b, i) => {
    if (b.min.y + lift < 0.3) reached.add(i);
  });
  let grew = true;
  while (grew) {
    grew = false;
    boxes.forEach((b, i) => {
      if (!reached.has(i) && [...reached].some((j) => touch(b, boxes[j]))) {
        reached.add(i);
        grew = true;
      }
    });
  }
  const floating = parts.filter((_, i) => !reached.has(i)).map((o) => o.name);
  const thin = parts.filter((o) => Math.min(...objectSize(o)) < 1.2).map((o) => `${o.name} (${fmt(Math.min(...objectSize(o)), 1)} mm)`);
  const leaky = parts.filter((o) => !isWatertight(bake(getGeometry(o))).watertight).map((o) => o.name);
  // overhang on the oriented, merged surface
  let over = 0,
    area = 0;
  const T = new THREE.Matrix4().makeTranslation(0, lift, 0).multiply(R);
  for (const o of parts) {
    const g = bake(getGeometry(o), T.clone().multiply(objectMatrix(o)));
    const ov = overhangs(g);
    over += ov.overhangArea;
    area += ov.totalArea;
  }
  return { size: [size.x, size.y, size.z] as Vec3, fits: size.x <= BED[0] && size.y <= BED[1] && size.z <= BED[2], floating, thin, leaky, overPct: area ? (over / area) * 100 : 0, lift, R };
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Your client wants a printable cable clip. Version 1 arrived from a teammate — run the pre-print checks before wasting filament.', ta: 'வாடிக்கையாளருக்கு அச்சிடக்கூடிய கேபிள் கிளிப் வேண்டும். முதலில் அச்சுக்கு முந்தைய சோதனைகளைச் செய்யுங்கள்.' },
  { stage: 'UNDERSTAND', text: 'Checks: closed (watertight) mesh, fits the build volume, no floating parts, minimum feature size (≥ 1.2 mm for FDM), and low overhang in the chosen orientation.', ta: 'சோதனைகள்: மூடிய mesh, அச்சுப் பகுதிக்குள் பொருந்துதல், மிதக்கும் பாகங்கள் இல்லை, ≥ 1.2 mm, குறைந்த தொங்கல்.' },
  { stage: 'BUILD', text: 'Fix the design parameters, choose an orientation with ≤ 5 % overhang, and export the STL. You can also run the same checks on your own gallery models.', ta: 'அளவுருக்களைச் சரிசெய்து, ≤ 5 % தொங்கல் கொண்ட திசையைத் தேர்ந்தெடுத்து STL ஏற்றுமதி செய்யுங்கள்.' },
];

export default function L6Prototype() {
  const [t, setT] = useState(0.8);
  const [attached, setAttached] = useState(false);
  const [o, setO] = useState(0);
  const [exported, setExported] = useState(false);
  const [source, setSource] = useState<'clip' | 'gallery'>('clip');
  const [projects, setProjects] = useState<Project[]>([]);
  const [pid, setPid] = useState<string>('');
  const root = useRef<THREE.Group>(null);
  useEffect(() => {
    listProjects().then((p) => {
      setProjects(p);
      if (p[0]) setPid(p[0].id);
    });
  }, []);
  const objs = useMemo(() => {
    if (source === 'gallery') {
      const p = projects.find((x) => x.id === pid);
      return p ? p.versions[p.versions.length - 1].objects : [];
    }
    return clip(t, attached);
  }, [source, projects, pid, t, attached]);
  const chk = useMemo(() => printChecks(objs, ORIENT[o].e), [objs, o]);

  const doExport = () => {
    if (!root.current) return;
    try {
      exportSTL(root.current, source === 'clip' ? 'cable-clip' : projects.find((x) => x.id === pid)?.name ?? 'model');
      setExported(true);
      const nb = useProgress.getState().bump('exports');
      if (nb.length) toast('📦 Badge unlocked: Ready for Reality');
    } catch (e) {
      toast(String(e));
    }
  };

  const evaluate = (): Feedback | string => {
    if (source !== 'clip') return 'The scored challenge uses the cable clip. Switch the source back to “Cable clip v1”.';
    const c = printChecks(clip(t, attached), ORIENT[o].e);
    const rubric = [
      { criterion: 'Watertight meshes', points: c.leaky.length ? 0 : 15, max: 15, note: c.leaky.join(', ') || 'all closed' },
      { criterion: 'Fits a 220 × 250 × 220 mm build volume', points: c.fits ? 10 : 0, max: 10, note: c.size.map((v) => fmt(v, 1)).join(' × ') + ' mm' },
      { criterion: 'No floating parts', points: c.floating.length ? 0 : 20, max: 20, note: c.floating.join(', ') || 'all connected to the bed' },
      { criterion: 'Every feature ≥ 1.2 mm', points: c.thin.length ? 0 : 20, max: 20, note: c.thin.join(', ') || 'ok' },
      { criterion: 'Overhang ≤ 5 % of the surface', points: c.overPct <= 5 ? 20 : c.overPct <= 12 ? 8 : 0, max: 20, note: `${fmt(c.overPct, 1)} % in “${ORIENT[o].name}”` },
      { criterion: 'STL exported', points: exported ? 15 : 0, max: 15 },
    ];
    const bad = rubric.filter((r) => r.points < r.max);
    return {
      score: Math.round(rubric.reduce((s, r) => s + r.points, 0)),
      correct: rubric.filter((r) => r.points >= r.max).map((r) => r.criterion),
      issues: bad.map((r) => ({ label: r.criterion, detail: r.note })),
      why: 'A pre-print checklist turns a gamble into a plan. Floating islands print as spaghetti, sub-millimetre features vanish, and leaky meshes confuse slicers. Fixing these on screen is free.',
      suggestion: bad.length ? `Next: ${bad[0].criterion}.` : 'Print it, measure it with calipers, and compare against the CAD dimensions.',
      rubric,
    };
  };

  return (
    <LevelShell
      id="w7-l6"
      steps={steps}
      evaluate={evaluate}
      hints={[{ en: 'Thicken the walls to 1.2 mm or more, attach the label tab to the base, and lay the clip on its side.', ta: 'சுவர்களை ≥ 1.2 mm ஆக்கி, label tab-ஐ இணைத்து, கிளிப்பைப் பக்கவாட்டில் வையுங்கள்.' }]}
      viewport={
        <Stage3D fit={60} camera={[60, 60, 90]} target={[0, 10, 0]} env showViews>
          <group ref={root} position={[0, chk.lift, 0]} rotation={ORIENT[o].e}>
            {objs.map((ob) => (
              <ObjectMesh key={ob.id} o={chk.floating.includes(ob.name) || chk.thin.some((x) => x.startsWith(ob.name)) ? { ...ob, material: { ...ob.material, color: '#f85149' } } : ob} edges />
            ))}
          </group>
          <mesh position={[0, -0.5, 0]} receiveShadow>
            <boxGeometry args={[220, 1, 220]} />
            <meshStandardMaterial color="#2a3644" />
          </mesh>
        </Stage3D>
      }
    >
      <Seg value={source} onChange={setSource} options={[{ v: 'clip', label: 'Cable clip v1 (scored)' }, { v: 'gallery', label: `My gallery (${projects.length})` }]} />
      {source === 'clip' ? (
        <>
          <Slider label="Wall / tab thickness" value={t} min={0.6} max={3} step={0.1} unit="mm" onChange={setT} digits={1} />
          <Toggle checked={attached} onChange={setAttached} label="Label tab attached to the base" />
        </>
      ) : projects.length ? (
        <select value={pid} onChange={(e) => setPid(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : (
        <p className="muted">No saved models yet — save one from the editor first.</p>
      )}
      <div className="lbl">Orientation on the bed</div>
      <Seg value={String(o)} onChange={(v) => setO(parseInt(v, 10))} options={ORIENT.map((x, i) => ({ v: String(i), label: x.name }))} />
      <Task ok={!chk.leaky.length}>Watertight {chk.leaky.length ? `· leaks: ${chk.leaky.join(', ')}` : ''}</Task>
      <Task ok={chk.fits}>Fits the bed · {chk.size.map((v) => fmt(v, 1)).join(' × ')} mm</Task>
      <Task ok={!chk.floating.length}>No floating parts {chk.floating.length ? `· ${chk.floating.join(', ')}` : ''}</Task>
      <Task ok={!chk.thin.length}>Features ≥ 1.2 mm {chk.thin.length ? `· ${chk.thin.join(', ')}` : ''}</Task>
      <Task ok={chk.overPct <= 5}>Overhang {fmt(chk.overPct, 1)} % (≤ 5 %)</Task>
      <button className="btn accent" onClick={doExport} disabled={!objs.length}>
        ⬇ Export STL in this orientation
      </button>
      <Task ok={exported}>STL exported</Task>
      <div className="note warn">These are geometry checks only. Real manufacturing suitability depends on the specific machine, material and process settings — always validate with a test print.</div>
    </LevelShell>
  );
}
