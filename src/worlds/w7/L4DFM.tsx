import { Edges } from '@react-three/drei';
import { useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { Slider, Task, Toggle } from '../../components/ui';
import { fmt } from '../../lib/math';
import type { Feedback, LessonStep, Vec3 } from '../../lib/types';

type Spot = 'wall' | 'corner' | 'ledge' | 'cavity';
const SPOTS: { id: Spot; at: Vec3; q: string; options: string[]; answer: number; explain: string }[] = [
  { id: 'wall', at: [-32, 30, 0], q: 'What is the problem with this fin?', options: ['It is too thin to print or mould reliably', 'It is too tall to be seen', 'It has the wrong colour'], answer: 0, explain: 'Walls thinner than about 1–1.2 mm (FDM) or 0.8 mm (moulding) fail to fill, warp or snap.' },
  { id: 'corner', at: [0, 9, -16], q: 'What is risky about this inside corner?', options: ['It is perfectly sharp: it concentrates stress and cannot be machined', 'It is too smooth', 'It is too far from the edge'], answer: 0, explain: 'Sharp inside corners crack under load, and a round cutter cannot make them. Add a radius.' },
  { id: 'ledge', at: [32, 30, 0], q: 'How will this ledge print upright?', options: ['It hangs in the air: it needs support or a 45° chamfer underneath', 'It prints perfectly', 'It will melt'], answer: 0, explain: 'Flat overhangs sag. A 45° chamfer underneath lets each layer rest on the one below.' },
  { id: 'cavity', at: [0, 20, 20], q: 'This block is hollow inside and sealed. What goes wrong in resin printing or casting?', options: ['Trapped resin/air cannot escape — add a drain hole', 'Nothing, hollow is always fine', 'It becomes heavier'], answer: 0, explain: 'Sealed cavities trap liquid resin (it can crack the part later) or air (casting voids). Add drain/vent holes.' },
];

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'This part looks fine on screen but has four manufacturing problems. Tap the yellow markers to inspect each area.', ta: 'இந்தப் பாகத்தில் நான்கு உற்பத்திப் பிரச்சினைகள் உள்ளன. மஞ்சள் குறிகளைத் தட்டுங்கள்.' },
  { stage: 'UNDERSTAND', text: 'Design for Manufacturing (DFM) rules: minimum wall thickness, radii on inside corners, self-supporting angles (≤ 45° overhang), and no sealed cavities.', ta: 'DFM விதிகள்: குறைந்தபட்ச சுவர் தடிமன், உள் மூலைகளில் ஆரம், ≤ 45° தொங்கல், மூடிய குழிகள் கூடாது.' },
  { stage: 'BUILD', text: 'Identify all four problems, then fix each one with the controls that appear.', ta: 'நான்கையும் கண்டறிந்து ஒவ்வொன்றையும் சரிசெய்யுங்கள்.' },
];

export default function L4DFM() {
  const [found, setFound] = useState<Record<Spot, number | null>>({ wall: null, corner: null, ledge: null, cavity: null });
  const [open, setOpen] = useState<Spot | null>(null);
  const [wall, setWall] = useState(0.5);
  const [radius, setRadius] = useState(0);
  const [chamfer, setChamfer] = useState(false);
  const [drain, setDrain] = useState(false);
  const ok = (s: Spot) => found[s] === SPOTS.find((x) => x.id === s)!.answer;
  const fixed: Record<Spot, boolean> = { wall: wall >= 1.2, corner: radius >= 1, ledge: chamfer, cavity: drain };
  const sp = open ? SPOTS.find((x) => x.id === open)! : null;

  const evaluate = (): Feedback => {
    const rows = SPOTS.map((s) => ({ criterion: s.explain.split('.')[0], points: (ok(s.id) ? 12.5 : 0) + (fixed[s.id] ? 12.5 : 0), max: 25, note: `${ok(s.id) ? 'identified' : 'not identified'} · ${fixed[s.id] ? 'fixed' : 'not fixed'}` }));
    return {
      score: Math.round(rows.reduce((s, r) => s + r.points, 0)),
      correct: SPOTS.filter((s) => ok(s.id) && fixed[s.id]).map((s) => `${s.id}: identified and fixed.`),
      issues: SPOTS.filter((s) => !(ok(s.id) && fixed[s.id])).map((s) => ({ label: `${s.id}: ${ok(s.id) ? 'identified but not fixed' : 'not identified correctly'}.`, detail: s.explain })),
      why: 'Every DFM problem found in CAD saves a failed print, a scrapped mould or a cracked part in a customer’s hands. Fixing it on screen costs seconds; fixing it in steel costs weeks.',
      suggestion: 'Make DFM a habit: before exporting, scan for thin walls, sharp inside corners, overhangs and sealed volumes.',
      rubric: rows,
    };
  };

  const m = (c: string) => <meshStandardMaterial color={c} roughness={0.5} transparent opacity={0.92} />;
  return (
    <LevelShell
      id="w7-l4"
      steps={steps}
      evaluate={evaluate}
      viewport={
        <Stage3D fit={70} camera={[70, 70, 110]} target={[0, 15, 0]} env showViews={false}>
          <mesh position={[0, 4, 0]} castShadow>
            <boxGeometry args={[80, 8, 40]} />
            {m('#e9edf2')}
            <Edges color="#0b0f14" />
          </mesh>
          <mesh position={[-32, 22, 0]} castShadow>
            <boxGeometry args={[wall, 28, 30]} />
            {m(fixed.wall ? '#3fb950' : '#f8961e')}
          </mesh>
          <mesh position={[0, 20, -14]} castShadow>
            <boxGeometry args={[40, 24, 6]} />
            {m('#e9edf2')}
            <Edges color="#0b0f14" />
          </mesh>
          {radius > 0 && (
            <mesh position={[0, 8 + radius / 2, -11 + radius / 2]}>
              <boxGeometry args={[40, radius, radius]} />
              {m('#3fb950')}
            </mesh>
          )}
          <group position={[30, 30, 0]}>
            <mesh castShadow>
              <boxGeometry args={[16, 6, 24]} />
              {m(fixed.ledge ? '#3fb950' : '#f8961e')}
            </mesh>
            {chamfer && (
              <mesh position={[-3, -8, 0]} rotation={[0, 0, Math.PI / 4]}>
                <boxGeometry args={[14, 4, 24]} />
                {m('#3fb950')}
              </mesh>
            )}
          </group>
          <mesh position={[38, 19, 0]}>
            <boxGeometry args={[4, 22, 24]} />
            {m('#e9edf2')}
          </mesh>
          <mesh position={[0, 20, 12]} castShadow>
            <boxGeometry args={[30, 24, 14]} />
            <meshStandardMaterial color="#4cc9f0" transparent opacity={0.35} />
            <Edges color="#4cc9f0" />
          </mesh>
          <mesh position={[0, 20, 12]}>
            <boxGeometry args={[22, 16, 8]} />
            <meshStandardMaterial color="#f85149" transparent opacity={drain ? 0.1 : 0.45} />
          </mesh>
          {drain && (
            <mesh position={[0, 31, 12]}>
              <cylinderGeometry args={[2, 2, 6, 16]} />
              <meshBasicMaterial color="#0b0f14" />
            </mesh>
          )}
          {SPOTS.map((s) => (
            <group key={s.id} position={s.at}>
              <mesh onClick={(e) => { e.stopPropagation(); setOpen(s.id); }}>
                <sphereGeometry args={[3.2, 16, 12]} />
                <meshBasicMaterial color={ok(s.id) ? (fixed[s.id] ? '#3fb950' : '#4cc9f0') : '#ffd166'} />
              </mesh>
              <Label position={[0, 7, 0]} color="#ffd166" size={11}>
                {ok(s.id) ? (fixed[s.id] ? '✓' : 'fix me') : '?'}
              </Label>
            </group>
          ))}
        </Stage3D>
      }
    >
      <div className="lbl">Inspect an area (or tap a yellow marker)</div>
      <div className="btnrow">
        {SPOTS.map((s) => (
          <button key={s.id} className={`btn small ${open === s.id ? 'on' : ''}`} onClick={() => setOpen(s.id)}>
            {ok(s.id) ? '✓ ' : ''}
            {s.id}
          </button>
        ))}
      </div>
      {sp && (
        <div className="card" style={{ padding: 10 }}>
          <b>{sp.q}</b>
          <div className="grid" style={{ gap: 6, marginTop: 6 }}>
            {sp.options.map((o, i) => (
              <button key={i} className={`btn small ${found[sp.id] === i ? (i === sp.answer ? 'on' : 'danger') : ''}`} style={{ whiteSpace: 'normal', textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => setFound({ ...found, [sp.id]: i })}>
                {o}
              </button>
            ))}
          </div>
          {found[sp.id] != null && <p style={{ fontSize: 13, marginTop: 6 }}>{found[sp.id] === sp.answer ? '✓ ' : '✗ '}{sp.explain}</p>}
          {ok(sp.id) && sp.id === 'wall' && <Slider label="Fin wall thickness" value={wall} min={0.3} max={3} step={0.1} unit="mm" onChange={setWall} digits={1} />}
          {ok(sp.id) && sp.id === 'corner' && <Slider label="Inside corner radius" value={radius} min={0} max={5} step={0.5} unit="mm" onChange={setRadius} />}
          {ok(sp.id) && sp.id === 'ledge' && <Toggle checked={chamfer} onChange={setChamfer} label="Add a 45° chamfer under the ledge" />}
          {ok(sp.id) && sp.id === 'cavity' && <Toggle checked={drain} onChange={setDrain} label="Add a Ø4 drain / vent hole" />}
        </div>
      )}
      {SPOTS.map((s) => (
        <Task key={s.id} ok={ok(s.id) && fixed[s.id]}>
          {s.id}: {ok(s.id) ? (fixed[s.id] ? 'fixed' : 'identified') : 'not inspected'}
          {s.id === 'wall' && ok(s.id) && ` (${fmt(wall, 1)} mm)`}
        </Task>
      ))}
    </LevelShell>
  );
}
