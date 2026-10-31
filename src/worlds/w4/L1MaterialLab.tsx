import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { Seg, Slider, Task } from '../../components/ui';
import { MATERIALS, MATERIAL_CATEGORIES, materialById, proceduralTexture } from '../../lib/materials';
import { fmt } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

interface Look {
  color: string;
  roughness: number;
  metalness: number;
  transmission: number;
  clearcoat: number;
  texture?: 'wood' | 'fabric' | 'carbon' | 'brushed';
}
const TARGETS: { name: string; look: Look; test: (l: Look) => string[] }[] = [
  {
    name: 'Brushed aluminium',
    look: { color: '#c9ced6', roughness: 0.35, metalness: 1, transmission: 0, clearcoat: 0 },
    test: (l) => [l.metalness < 0.85 ? 'metalness should be high (it is a metal)' : '', l.roughness < 0.2 || l.roughness > 0.55 ? 'brushed metal is semi-rough (0.2–0.55)' : '', l.transmission > 0.05 ? 'aluminium is not transparent' : ''].filter(Boolean),
  },
  {
    name: 'Glossy red plastic',
    look: { color: '#d62828', roughness: 0.12, metalness: 0, transmission: 0, clearcoat: 0.6 },
    test: (l) => {
      const c = new THREE.Color(l.color);
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      const red = (hsl.h < 0.05 || hsl.h > 0.95) && hsl.s > 0.4;
      return [l.metalness > 0.15 ? 'plastic is not metallic (metalness ≈ 0)' : '', l.roughness > 0.25 ? 'glossy means low roughness (≤ 0.25)' : '', !red ? 'the colour should be a strong red' : '', l.transmission > 0.05 ? 'it should be opaque' : ''].filter(Boolean);
    },
  },
  {
    name: 'Frosted glass',
    look: { color: '#e8fbff', roughness: 0.45, metalness: 0, transmission: 1, clearcoat: 0 },
    test: (l) => [l.transmission < 0.75 ? 'glass transmits light (transmission high)' : '', l.roughness < 0.25 || l.roughness > 0.7 ? 'frosted means a blurred surface (roughness 0.25–0.7)' : '', l.metalness > 0.1 ? 'glass is not metallic' : ''].filter(Boolean),
  },
];

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Tap a material: plastic, metal, rubber, glass, wood, ceramic, fabric or composite. Orbit to watch reflections change.', ta: 'ஒரு பொருளைத் தட்டுங்கள்: பிளாஸ்டிக், உலோகம், ரப்பர், கண்ணாடி, மரம், பீங்கான், துணி, கலப்புப் பொருள்.' },
  { stage: 'EXPERIMENT', text: 'Use the sliders: colour, roughness (shiny ↔ matte), metalness (does it reflect like metal?), transmission (does light pass through?) and clearcoat (a glossy lacquer layer).', ta: 'Roughness = பளபளப்பு ↔ மங்கல்; Metalness = உலோகம் போல் பிரதிபலிப்பு; Transmission = ஒளி ஊடுருவல்.' },
  { stage: 'UNDERSTAND', text: 'These sliders change only how light bounces — the VISUAL material. A chrome-painted plastic looks like steel but is still weak and light. Engineering properties (stiffness, strength, density, heat) are listed below and do not change with the sliders.', ta: 'Slider-கள் தோற்றத்தை மட்டுமே மாற்றும். வலிமை, அடர்த்தி போன்ற பொறியியல் பண்புகள் மாறாது.' },
  { stage: 'BUILD', text: 'Challenge: recreate the three reference spheres — brushed aluminium, glossy red plastic and frosted glass — with the sliders, and lock each in.', ta: 'சவால்: மூன்று மாதிரிக் கோளங்களின் தோற்றத்தை slider-களால் உருவாக்குங்கள்.' },
];

function shapeGeo(kind: string) {
  if (kind === 'bottle') {
    const pts = [
      [0, 0],
      [28, 0],
      [30, 6],
      [30, 70],
      [22, 90],
      [10, 100],
      [10, 115],
      [0, 115],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.LatheGeometry(pts, 64);
    g.translate(0, -57, 0);
    g.computeVertexNormals();
    return g;
  }
  if (kind === 'knot') return new THREE.TorusKnotGeometry(28, 9, 160, 24);
  return new THREE.SphereGeometry(40, 64, 32);
}

export default function L1MaterialLab() {
  const [preset, setPreset] = useState('abs');
  const [look, setLook] = useState<Look>({ color: '#e9edf2', roughness: 0.45, metalness: 0, transmission: 0, clearcoat: 0.2 });
  const [shape, setShape] = useState('sphere');
  const [task, setTask] = useState(0);
  const [locked, setLocked] = useState<(Look | null)[]>([null, null, null]);
  const geo = useMemo(() => shapeGeo(shape), [shape]);
  const m = materialById(preset)!;
  const map = look.texture ? proceduralTexture(look.texture) : undefined;

  const applyPreset = (id: string) => {
    const p = materialById(id)!;
    setPreset(id);
    setLook({ color: p.color, roughness: p.roughness, metalness: p.metalness, transmission: p.transmission ?? 0, clearcoat: p.clearcoat ?? 0, texture: p.texture });
  };

  const evaluate = (): Feedback => {
    const correct: string[] = [];
    const issues: Feedback['issues'] = [];
    let s = 0;
    TARGETS.forEach((t, i) => {
      const l = locked[i];
      if (!l) return issues.push({ label: `${t.name}: not locked in.` });
      const e = t.test(l);
      if (!e.length) {
        s++;
        correct.push(`${t.name}: convincing match.`);
      } else {
        s += Math.max(0, 1 - e.length * 0.4);
        issues.push({ label: `${t.name}: ${e[0]}.`, detail: e.slice(1).join('; ') || undefined });
      }
    });
    return {
      score: Math.round((s / 3) * 100),
      correct,
      issues,
      why: 'Physically based rendering describes surfaces with a few measurable ideas — roughness, metalness, transmission. Learning to read real materials this way lets you visualise products convincingly and communicate finishes (matte, satin, gloss) to manufacturers.',
      suggestion: 'Compare with the reference sphere from the same angle. Metal vs non-metal is the first decision; roughness is the second.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w4-l1"
      steps={steps}
      evaluate={evaluate}
      hints={[{ en: 'Metals: metalness 1. Plastics, glass, wood: metalness 0. Glass: transmission near 1.', ta: 'உலோகம்: metalness 1. பிளாஸ்டிக், கண்ணாடி, மரம்: 0.' }]}
      viewport={
        <Stage3D fit={120} camera={[0, 70, 230]} target={[0, 40, 0]} env showViews={false}>
          <mesh geometry={geo} position={[0, 45, 0]} castShadow>
            <meshPhysicalMaterial
              color={look.color}
              roughness={look.roughness}
              metalness={look.metalness}
              transmission={look.transmission}
              thickness={20}
              ior={1.5}
              clearcoat={look.clearcoat}
              clearcoatRoughness={0.1}
              sheen={m.sheen ?? 0}
              sheenColor={look.color}
              map={look.texture && look.texture !== 'brushed' ? map : undefined}
              roughnessMap={look.texture === 'brushed' ? map : undefined}
              transparent={look.transmission > 0}
            />
          </mesh>
          {TARGETS.map((t, i) => (
            <group key={t.name} position={[-90 + i * 90, 12, 90]}>
              <mesh castShadow>
                <sphereGeometry args={[12, 48, 24]} />
                <meshPhysicalMaterial color={t.look.color} roughness={t.look.roughness} metalness={t.look.metalness} transmission={t.look.transmission} thickness={10} clearcoat={t.look.clearcoat} transparent={t.look.transmission > 0} />
              </mesh>
              <Label position={[0, -18, 0]} color={i === task ? '#ffd166' : '#8d9aa8'} size={11}>
                {t.name}
              </Label>
            </group>
          ))}
        </Stage3D>
      }
    >
      <Seg value={shape} onChange={setShape} options={[{ v: 'sphere', label: 'Sphere' }, { v: 'bottle', label: 'Bottle' }, { v: 'knot', label: 'Knot' }]} />
      <div>
        {MATERIAL_CATEGORIES.map((c) => (
          <div key={c} className="btnrow" style={{ marginBottom: 4 }}>
            <span className="lbl" style={{ width: 78 }}>
              {c}
            </span>
            {MATERIALS.filter((x) => x.category === c).map((x) => (
              <button key={x.id} className={`btn small ${preset === x.id ? 'on' : ''}`} onClick={() => applyPreset(x.id)}>
                {x.name}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="numrow">
        <span className="lbl">Colour</span>
        <input type="color" value={look.color} onChange={(e) => setLook({ ...look, color: e.target.value })} />
      </div>
      <Slider label="Roughness (gloss → matte)" value={look.roughness} min={0} max={1} step={0.01} onChange={(roughness) => setLook({ ...look, roughness })} digits={2} />
      <Slider label="Metalness" value={look.metalness} min={0} max={1} step={0.01} onChange={(metalness) => setLook({ ...look, metalness })} digits={2} />
      <Slider label="Transmission (transparency)" value={look.transmission} min={0} max={1} step={0.01} onChange={(transmission) => setLook({ ...look, transmission })} digits={2} />
      <Slider label="Clearcoat (lacquer)" value={look.clearcoat} min={0} max={1} step={0.01} onChange={(clearcoat) => setLook({ ...look, clearcoat })} digits={2} />
      <div className="card" style={{ padding: 10 }}>
        <b>Engineering properties of “{m.name}”</b>
        <div className="kv" style={{ marginTop: 4 }}>
          <span>Density</span>
          <span>{m.eng.density} kg/m³</span>
          <span>Stiffness E</span>
          <span>{m.eng.E < 1 ? fmt(m.eng.E * 1000, 0) + ' MPa' : fmt(m.eng.E, 0) + ' GPa'}</span>
          <span>Strength</span>
          <span>{m.eng.strength} MPa</span>
          <span>Thermal conductivity</span>
          <span>{m.eng.k} W/m·K</span>
          <span>Max. service temp.</span>
          <span>{m.eng.maxTemp} °C</span>
          <span>Breaks by</span>
          <span>{m.eng.brittle ? 'cracking (brittle)' : 'bending / stretching'}</span>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {m.eng.notes} Values are rounded textbook figures; real grades vary.
        </div>
      </div>
      <div className="card" style={{ padding: 10 }}>
        <div className="btnrow">
          {TARGETS.map((t, i) => (
            <button key={i} className={`btn small ${task === i ? 'on' : ''}`} onClick={() => setTask(i)}>
              {locked[i] ? '🔒 ' : ''}
              {t.name}
            </button>
          ))}
        </div>
        <button className="btn small accent" style={{ marginTop: 6 }} onClick={() => { setLocked(locked.map((l, i) => (i === task ? { ...look } : l))); if (task < 2) setTask(task + 1); }}>
          Lock in “{TARGETS[task].name}”
        </button>
        {TARGETS.map((t, i) => (
          <Task key={i} ok={!!locked[i]}>
            {t.name}
          </Task>
        ))}
      </div>
    </LevelShell>
  );
}
