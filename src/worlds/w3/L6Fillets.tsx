import { useMemo, useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { ObjectMesh } from '../../components/three/ObjectMesh';
import { Seg, Slider, Task } from '../../components/ui';
import { rectPoly, treatCorners } from '../../lib/poly';
import { makeObject } from '../../lib/shapes';
import { fmt } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

type Corner = 'sharp' | 'fillet' | 'chamfer';
type Edge = 'sharp' | 'round' | 'chamfer';
interface Spec {
  corner: Corner;
  cornerSize: number;
  edge: Edge;
  edgeSize: number;
}
const TASKS: { name: string; text: string; target: Spec; material: string; color: string }[] = [
  { name: 'Phone body', text: 'Smartphone body: 8 mm FILLETED corners and 1.5 mm ROUNDED edges, so it is comfortable in the hand and reflections flow smoothly.', target: { corner: 'fillet', cornerSize: 8, edge: 'round', edgeSize: 1.5 }, material: 'alu', color: '#2b2d31' },
  { name: 'Machined bracket', text: 'Machined plate: 5 mm CHAMFERED corners and 1 mm CHAMFERED edges, to remove sharp burrs and help it slide into its slot.', target: { corner: 'chamfer', cornerSize: 5, edge: 'chamfer', edgeSize: 1 }, material: 'steel', color: '#b7bcc4' },
];

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Real products almost never have perfectly sharp edges. Rounded edges are fillets; flat angled cuts are chamfers.', ta: 'உண்மைப் பொருட்களில் கூர்மையான விளிம்புகள் அரிது. வளைந்தவை fillet; சாய்வாக வெட்டியவை chamfer.' },
  { stage: 'EXPERIMENT', text: 'Change the corner treatment (seen from above) and the edge treatment (around the top and bottom faces). Orbit close and watch how light flows over the edges.', ta: 'மூலை மற்றும் விளிம்பு வடிவங்களை மாற்றி ஒளி எப்படிப் பாய்கிறது என்று பாருங்கள்.' },
  { stage: 'UNDERSTAND', text: 'Why they matter: sharp inside corners concentrate stress and crack; CNC cutters are round so inside corners always have a radius; moulded plastic flows better around radii; chamfers guide parts together and remove burrs; fillets feel comfortable and look premium.', ta: 'கூர்மையான உள் மூலைகள் அழுத்தத்தைக் குவிக்கும்; chamfer பாகங்களை இணைக்க வழிகாட்டும்; fillet கையில் வசதியாக இருக்கும்.' },
  { stage: 'BUILD', text: 'Complete both briefs and lock each one in.', ta: 'இரண்டு பணிகளையும் முடித்து lock செய்யுங்கள்.' },
];

export default function L6Fillets() {
  const [spec, setSpec] = useState<Spec>({ corner: 'sharp', cornerSize: 4, edge: 'sharp', edgeSize: 1 });
  const [task, setTask] = useState(0);
  const [locked, setLocked] = useState<(Spec | null)[]>([null, null]);
  const t = TASKS[task];
  const o = useMemo(() => {
    const base = rectPoly(-35, -70, 35, 70);
    const outline = spec.corner === 'sharp' ? base : treatCorners(base, spec.cornerSize, spec.corner === 'fillet' ? 'fillet' : 'chamfer', 10);
    return makeObject('extrusion', {
      extrusion: { outline, holes: [], depth: 8, bevel: spec.edge === 'sharp' ? 0 : spec.edgeSize, bevelSegs: spec.edge === 'chamfer' ? 1 : 5 },
      rotation: [-Math.PI / 2, 0, 0],
      position: [0, 4, 0],
      material: { preset: t.material, color: t.color, roughness: 0.25, metalness: 0.9, opacity: 1 },
    });
  }, [spec, t]);

  const evaluate = (): Feedback => {
    const correct: string[] = [];
    const issues: Feedback['issues'] = [];
    let s = 0;
    TASKS.forEach((tk, i) => {
      const l = locked[i];
      if (!l) return issues.push({ label: `${tk.name}: not locked in.` });
      const bits: string[] = [];
      if (l.corner !== tk.target.corner) bits.push(`corners should be ${tk.target.corner}ed, not ${l.corner}`);
      else if (Math.abs(l.cornerSize - tk.target.cornerSize) > 0.25) bits.push(`corner size ${fmt(l.cornerSize)} mm, target ${tk.target.cornerSize} mm`);
      if (l.edge !== tk.target.edge) bits.push(`edges should be ${tk.target.edge === 'round' ? 'rounded' : 'chamfered'}, not ${l.edge}`);
      else if (Math.abs(l.edgeSize - tk.target.edgeSize) > 0.15) bits.push(`edge size ${fmt(l.edgeSize)} mm, target ${tk.target.edgeSize} mm`);
      if (!bits.length) {
        s += 1;
        correct.push(`${tk.name}: correct edge treatments.`);
      } else {
        s += Math.max(0, 1 - bits.length * 0.35);
        issues.push({ label: `${tk.name}: ${bits[0]}.`, detail: bits.slice(1).join('; ') || undefined });
      }
    });
    return {
      score: Math.round((s / TASKS.length) * 100),
      correct,
      issues,
      why: 'Edge treatments change how a product feels, looks, survives and is made. They are among the last CAD features applied, but they decide whether a part cracks, cuts your hand or slides into place.',
      suggestion: 'Compare the two parts under the studio lighting: fillets give soft highlights, chamfers give crisp flat bands.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w3-l6"
      steps={steps}
      evaluate={evaluate}
      hints={[{ en: 'Corner = seen from the top (in the outline). Edge = where the top or bottom face meets the sides.', ta: 'Corner = மேலிருந்து பார்க்கும் வடிவம். Edge = மேல்/கீழ் முகம் பக்கங்களைச் சந்திக்கும் இடம்.' }]}
      viewport={
        <Stage3D fit={110} camera={[90, 110, 120]} target={[0, 0, 0]} env>
          <ObjectMesh o={o} />
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
        <p style={{ margin: '8px 0', fontSize: 14 }}>{t.text}</p>
      </div>
      <div className="lbl">Corners (outline)</div>
      <Seg value={spec.corner} onChange={(c) => setSpec({ ...spec, corner: c })} options={[{ v: 'sharp', label: 'Sharp' }, { v: 'fillet', label: 'Fillet' }, { v: 'chamfer', label: 'Chamfer' }]} />
      {spec.corner !== 'sharp' && <Slider label={spec.corner === 'fillet' ? 'Corner radius' : 'Corner chamfer size'} value={spec.cornerSize} min={1} max={20} step={0.5} unit="mm" onChange={(v) => setSpec({ ...spec, cornerSize: v })} />}
      <div className="lbl">Edges (top & bottom faces)</div>
      <Seg value={spec.edge} onChange={(e) => setSpec({ ...spec, edge: e })} options={[{ v: 'sharp', label: 'Sharp' }, { v: 'round', label: 'Rounded' }, { v: 'chamfer', label: 'Chamfer' }]} />
      {spec.edge !== 'sharp' && <Slider label={spec.edge === 'round' ? 'Edge radius' : 'Edge chamfer size'} value={spec.edgeSize} min={0.25} max={3.5} step={0.25} unit="mm" onChange={(v) => setSpec({ ...spec, edgeSize: v })} digits={2} />}
      <button className="btn small accent" onClick={() => { setLocked(locked.map((l, i) => (i === task ? { ...spec } : l))); if (task === 0) setTask(1); }}>
        Lock in “{t.name}”
      </button>
      {TASKS.map((tk, i) => (
        <Task key={i} ok={!!locked[i]}>
          {tk.name}: {locked[i] ? `${locked[i]!.corner} ${locked[i]!.corner === 'sharp' ? '' : fmt(locked[i]!.cornerSize) + ' mm'} · edges ${locked[i]!.edge} ${locked[i]!.edge === 'sharp' ? '' : fmt(locked[i]!.edgeSize) + ' mm'}` : 'not locked'}
        </Task>
      ))}
      <div className="note">Honest limit: this lab rounds every outline corner and the top/bottom edges together. Professional CAD lets you pick individual edges, using a B-rep kernel.</div>
    </LevelShell>
  );
}
