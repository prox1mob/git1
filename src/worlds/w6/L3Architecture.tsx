import { useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { Slider, Task } from '../../components/ui';
import { FLASHLIGHT, PartMesh, type Role } from './flashlight';
import type { Feedback, LessonStep } from '../../lib/types';

const ROLES: Role[] = ['Power', 'Light source', 'Optics', 'Control', 'Structure', 'Sealing'];

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'A torch looks like one object, but it is a system of components. Pull it apart with the slider and tap each part.', ta: 'Torch ஒரே பொருள் போலத் தோன்றினாலும், அது பல கூறுகளின் அமைப்பு.' },
  { stage: 'UNDERSTAND', text: 'Product architecture groups parts by function: power, light source, optics, control, structure and sealing. Functions connect through interfaces (contacts, threads, seals).', ta: 'பாகங்களைச் செயல்பாட்டின்படி பிரித்தல்: மின்சக்தி, ஒளி மூலம், ஒளியியல், கட்டுப்பாடு, அமைப்பு, அடைப்பு.' },
  { stage: 'TEST', text: 'Assign every part to its function: tap a part (in the list or in 3D), then tap a function.', ta: 'ஒவ்வொரு பாகத்தையும் அதன் செயல்பாட்டுக்கு ஒதுக்குங்கள்.' },
];

export default function L3Architecture() {
  const [explode, setExplode] = useState(0.6);
  const [sel, setSel] = useState<string>(FLASHLIGHT[0].id);
  const [map, setMap] = useState<Record<string, Role>>({});

  const evaluate = (): Feedback | string => {
    const done = FLASHLIGHT.filter((p) => map[p.id]).length;
    if (done < FLASHLIGHT.length) return `Assign all parts first (${done}/${FLASHLIGHT.length}).`;
    const right = FLASHLIGHT.filter((p) => map[p.id] === p.role);
    return {
      score: Math.round((right.length / FLASHLIGHT.length) * 100),
      correct: right.map((p) => `${p.name} → ${p.role}`),
      issues: FLASHLIGHT.filter((p) => map[p.id] !== p.role).map((p) => ({ label: `${p.name}: you chose ${map[p.id]}.`, detail: `Its main function is ${p.role}.` })),
      why: 'Thinking in functions helps teams split work, choose suppliers and spot where a product can be simplified (e.g. one part doing two jobs). It is also how you diagnose failures: no light? check power, then source, then control.',
      suggestion: 'Ask “what would stop working if I removed this part?” — the answer is its function.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w6-l3"
      steps={steps}
      evaluate={evaluate}
      viewport={
        <Stage3D fit={140} camera={[160, 140, 220]} target={[0, 80, 0]} env showViews={false}>
          {FLASHLIGHT.map((p, i) => (
            <PartMesh key={p.id} p={p} y={p.y0 + i * 22 * explode} selected={sel === p.id} onPick={(e) => { e.stopPropagation(); setSel(p.id); }} />
          ))}
          {FLASHLIGHT.map((p, i) => (sel === p.id ? <Label key={p.id} position={[40, p.y0 + i * 22 * explode + p.h / 2, 0]} color="#9ff0ff">{p.name}</Label> : null))}
        </Stage3D>
      }
    >
      <Slider label="Explode" value={explode} min={0} max={1} step={0.01} onChange={setExplode} digits={2} />
      <div className="lbl">Selected: {FLASHLIGHT.find((p) => p.id === sel)!.name}</div>
      <div className="btnrow">
        {ROLES.map((r) => (
          <button key={r} className={`btn small ${map[sel] === r ? 'on' : ''}`} onClick={() => { setMap({ ...map, [sel]: r }); const i = FLASHLIGHT.findIndex((p) => p.id === sel); const next = FLASHLIGHT.slice(i + 1).find((p) => !map[p.id]); if (next) setSel(next.id); }}>
            {r}
          </button>
        ))}
      </div>
      {FLASHLIGHT.map((p) => (
        <div key={p.id} onClick={() => setSel(p.id)} style={{ cursor: 'pointer' }}>
          <Task ok={!!map[p.id]}>
            {p.name} {map[p.id] && <span className="muted">→ {map[p.id]}</span>}
          </Task>
        </div>
      ))}
    </LevelShell>
  );
}
