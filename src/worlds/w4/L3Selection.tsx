import { useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Task } from '../../components/ui';
import { MATERIALS, materialById } from '../../lib/materials';
import type { Feedback, LessonStep } from '../../lib/types';

interface Scenario {
  title: string;
  brief: string;
  needs: string[];
  best: string[];
  ok: string[];
  why: string;
  shape: 'tube' | 'dish' | 'grip' | 'box' | 'slat' | 'knob';
}
const SCENARIOS: Scenario[] = [
  { title: 'Racing bicycle frame', brief: 'Must be very stiff and strong, yet as light as possible. Cost is less important.', needs: ['high stiffness per weight', 'high strength', 'low density'], best: ['cfrp', 'alu'], ok: ['steel', 'bamboo'], why: 'Carbon fibre and aluminium have the best stiffness-to-weight. Steel works (classic frames) but is heavier; bamboo frames exist but need careful joints.', shape: 'tube' },
  { title: 'Transparent oven dish', brief: 'Goes from fridge (4 °C) to oven (220 °C). You must see the food. Must be food-safe.', needs: ['transparent', 'survives 220 °C', 'thermal-shock resistant'], best: ['boro'], ok: ['glass'], why: 'Borosilicate expands very little with heat, so it survives sudden temperature changes. Soda-lime glass is cheaper but can crack from thermal shock. Polycarbonate softens near 140 °C.', shape: 'dish' },
  { title: 'Grip for a power drill', brief: 'Soft, non-slip, comfortable in sweaty hands, damps vibration.', needs: ['flexible', 'high friction', 'vibration damping'], best: ['silicone', 'rubber'], ok: [], why: 'Elastomers (rubbers) deform under the fingers, increasing contact area and friction, and absorb vibration. Hard plastics and metals cannot.', shape: 'grip' },
  { title: 'Housing for a mass-produced router', brief: '100 000 units per year, low cost, impact-resistant, electrically insulating, complex shape with clips.', needs: ['low cost', 'mouldable', 'tough', 'insulating'], best: ['abs', 'pc'], ok: ['gfrp'], why: 'ABS and polycarbonate are injection-moulded cheaply in huge volumes with clips and bosses, and they insulate. Metals conduct electricity and are costly to form into complex shapes.', shape: 'box' },
  { title: 'Outdoor bench slats', brief: 'Rain, sun and frost for 10 years; pleasant to touch on hot and cold days; sustainable.', needs: ['weather-resistant', 'low thermal conductivity', 'renewable'], best: ['bamboo', 'oak'], ok: ['gfrp'], why: 'Wood and bamboo feel neutral to touch because they conduct heat poorly, and they are renewable (with proper treatment). Metal gets burning hot or freezing cold.', shape: 'slat' },
  { title: 'Knob on a pan lid', brief: 'The lid reaches 150 °C. The knob must stay safe to grab and not melt.', needs: ['survives 150 °C+', 'low thermal conductivity'], best: ['silicone', 'porcelain'], ok: ['oak', 'bamboo'], why: 'Silicone and porcelain survive the heat and conduct little of it. Wood works but chars and ages near its limit. Metals conduct heat straight to your hand; ABS softens at ~80 °C.', shape: 'knob' },
];

function Preview({ shape, mat }: { shape: Scenario['shape']; mat?: string }) {
  const m = mat ? materialById(mat) : undefined;
  const mt = <meshPhysicalMaterial color={m?.color ?? '#8d9aa8'} roughness={m?.roughness ?? 0.6} metalness={m?.metalness ?? 0} transmission={m?.transmission ?? 0} thickness={8} clearcoat={m?.clearcoat ?? 0} transparent={!!m?.transmission} />;
  switch (shape) {
    case 'tube':
      return (
        <group position={[0, 40, 0]}>
          {[
            [0, 0, 0.3, 90],
            [30, -10, -1.1, 70],
            [-25, -10, 1.1, 70],
          ].map(([x, y, rz, l], i) => (
            <mesh key={i} position={[x, y, 0]} rotation={[0, 0, rz]} castShadow>
              <cylinderGeometry args={[4, 4, l, 24]} />
              {mt}
            </mesh>
          ))}
        </group>
      );
    case 'dish':
      return (
        <mesh position={[0, 12, 0]} castShadow>
          <cylinderGeometry args={[45, 38, 24, 48, 1, true]} />
          {mt}
        </mesh>
      );
    case 'grip':
      return (
        <mesh position={[0, 40, 0]} castShadow>
          <capsuleGeometry args={[16, 50, 8, 24]} />
          {mt}
        </mesh>
      );
    case 'box':
      return (
        <mesh position={[0, 15, 0]} castShadow>
          <boxGeometry args={[90, 30, 60]} />
          {mt}
        </mesh>
      );
    case 'slat':
      return (
        <group>
          {[-24, 0, 24].map((z) => (
            <mesh key={z} position={[0, 30, z]} castShadow>
              <boxGeometry args={[120, 6, 20]} />
              {mt}
            </mesh>
          ))}
        </group>
      );
    default:
      return (
        <group>
          <mesh position={[0, 3, 0]}>
            <cylinderGeometry args={[60, 60, 6, 48]} />
            <meshStandardMaterial color="#b7bcc4" metalness={1} roughness={0.3} />
          </mesh>
          <mesh position={[0, 20, 0]} castShadow>
            <sphereGeometry args={[16, 32, 16]} />
            {mt}
          </mesh>
        </group>
      );
  }
}

const steps: LessonStep[] = [
  { stage: 'UNDERSTAND', text: 'Selecting a material means matching requirements to properties: list what the product needs (stiff? light? transparent? heat-safe? cheap in volume?) then rule materials out.', ta: 'தேவைகளைப் பட்டியலிட்டு, பொருந்தாத பொருட்களை நீக்குங்கள்.' },
  { stage: 'TEST', text: 'Six products, six briefs. Choose a material for each. The rubric is transparent: best choices score full marks, workable choices partial marks — there is rarely one single “right” answer.', ta: 'ஆறு பொருட்கள். ஒவ்வொன்றுக்கும் ஒரு பொருளைத் தேர்ந்தெடுங்கள்.' },
];

export default function L3Selection() {
  const [idx, setIdx] = useState(0);
  const [choice, setChoice] = useState<(string | null)[]>(SCENARIOS.map(() => null));
  const sc = SCENARIOS[idx];

  const evaluate = (): Feedback | string => {
    if (choice.some((c) => !c)) return `Choose a material for every product (${choice.filter(Boolean).length}/6).`;
    const rubric = SCENARIOS.map((s, i) => {
      const c = choice[i]!;
      const pts = s.best.includes(c) ? 10 : s.ok.includes(c) ? 6 : 0;
      return { criterion: `${s.title}: ${materialById(c)!.name}`, points: pts, max: 10, note: pts === 10 ? 'best fit' : pts ? 'workable, with compromises' : `does not meet: ${s.needs.join(', ')}` };
    });
    const total = rubric.reduce((a, r) => a + r.points, 0);
    return {
      score: Math.round((total / 60) * 100),
      correct: SCENARIOS.filter((s, i) => s.best.includes(choice[i]!)).map((s) => `${s.title}: ${s.why.split('.')[0]}.`),
      issues: SCENARIOS.flatMap((s, i) => (s.best.includes(choice[i]!) ? [] : [{ label: `${s.title}: ${materialById(choice[i]!)!.name} is ${s.ok.includes(choice[i]!) ? 'workable but not ideal' : 'a poor fit'}.`, detail: s.why }])),
      why: 'The same shape can succeed or fail depending only on its material. Engineers compare properties against requirements — and accept trade-offs such as cost vs weight.',
      suggestion: 'For each brief, underline the one requirement that rules out the most materials (e.g. “transparent” or “150 °C”) and start from there.',
      rubric,
    };
  };

  return (
    <LevelShell
      id="w4-l3"
      steps={steps}
      evaluate={evaluate}
      hints={[{ en: 'Check the max service temperature and thermal conductivity in the Material Lab for the heat-related briefs.', ta: 'வெப்பம் தொடர்பான பணிகளுக்கு max temperature மற்றும் thermal conductivity பாருங்கள்.' }]}
      viewport={
        <Stage3D fit={90} camera={[90, 90, 150]} target={[0, 20, 0]} env showViews={false}>
          <Preview shape={sc.shape} mat={choice[idx] ?? undefined} />
        </Stage3D>
      }
    >
      <div className="btnrow">
        {SCENARIOS.map((_, i) => (
          <button key={i} className={`btn small ${idx === i ? 'on' : ''}`} onClick={() => setIdx(i)}>
            {choice[i] ? '✓ ' : ''}
            {i + 1}
          </button>
        ))}
      </div>
      <div className="card" style={{ padding: 10 }}>
        <h3>{sc.title}</h3>
        <p style={{ fontSize: 14 }}>{sc.brief}</p>
        <div className="muted" style={{ fontSize: 12 }}>Key needs: {sc.needs.join(' · ')}</div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
        {MATERIALS.map((m) => (
          <button key={m.id} className={`btn small ${choice[idx] === m.id ? 'on' : ''}`} style={{ justifyContent: 'flex-start' }} onClick={() => setChoice(choice.map((c, i) => (i === idx ? m.id : c)))}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: m.color, display: 'inline-block' }} /> {m.name}
          </button>
        ))}
      </div>
      {choice[idx] && (
        <div className="kv">
          <span>Density</span>
          <span>{materialById(choice[idx]!)!.eng.density} kg/m³</span>
          <span>E</span>
          <span>{materialById(choice[idx]!)!.eng.E} GPa</span>
          <span>Max temp</span>
          <span>{materialById(choice[idx]!)!.eng.maxTemp} °C</span>
          <span>k</span>
          <span>{materialById(choice[idx]!)!.eng.k} W/m·K</span>
          <span>Relative cost</span>
          <span>{'●'.repeat(materialById(choice[idx]!)!.eng.cost)}{'○'.repeat(5 - materialById(choice[idx]!)!.eng.cost)}</span>
        </div>
      )}
      <Task ok={choice.every(Boolean)}>All six products have a material</Task>
    </LevelShell>
  );
}
