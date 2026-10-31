import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Arrow3D, Label } from '../../components/three/ObjectMesh';
import { Seg, Slider, Task } from '../../components/ui';
import { MATERIALS, materialById } from '../../lib/materials';
import { fmt } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

const L = 200,
  B = 20;
const BEAM_MATS = ['abs', 'pla', 'alu', 'steel', 'oak', 'bamboo', 'cfrp', 'gfrp', 'pc', 'brass'];

export function beam(matId: string, h: number, F: number) {
  const m = materialById(matId)!;
  const E = m.eng.E * 1000; // N/mm²
  const I = (B * h ** 3) / 12;
  const delta = (F * L ** 3) / (3 * E * I);
  const sigma = (6 * F * L) / (B * h * h);
  const mass = (m.eng.density / 1e6) * L * B * h; // g (kg/m³ → g/mm³ = /1e6)
  return { delta, sigma, sf: m.eng.strength / sigma, mass, E, I, brittle: m.eng.brittle, name: m.name };
}

function BentBeam({ h, delta, color, broken }: { h: number; delta: number; color: string; broken: boolean }) {
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(L, h, B, 60, 1, 1);
    g.translate(L / 2, 0, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setY(i, p.getY(i) - (delta * x * x * (3 * L - x)) / (2 * L ** 3));
    }
    g.computeVertexNormals();
    return g;
  }, [h, delta]);
  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial color={broken ? '#f85149' : color} roughness={0.5} metalness={0.2} />
    </mesh>
  );
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'A 200 mm shelf bracket sticks out of a wall and carries a load at its tip. Change the material: the shape and look stay the same, but the bending changes enormously.', ta: '200 mm அடைப்புக்குறி சுவரிலிருந்து நீண்டு முனையில் சுமையைத் தாங்குகிறது. பொருளை மாற்றினால் வளைவு பெரிதும் மாறும்.' },
  { stage: 'UNDERSTAND', text: 'Stiffness (Young’s modulus E) controls how much it bends; strength controls when it yields or breaks; density controls its weight. Thickness matters hugely: bending stiffness grows with thickness cubed (h³).', ta: 'E = விறைப்பு (வளைவு), strength = உடையும் வரம்பு, density = எடை. தடிமன் இரட்டிப்பானால் விறைப்பு 8 மடங்கு.' },
  { stage: 'EXPERIMENT', text: 'Visit the Weight and Heat tabs too: the same part weighs 8× more in steel than in plastic, and a metal handle carries heat thousands of times faster than wood.', ta: 'எடை மற்றும் வெப்பம் tab-களையும் பாருங்கள்.' },
  { stage: 'BUILD', text: 'Design the bracket: with a 50 N load it must bend ≤ 2 mm, weigh ≤ 60 g, and have a safety factor of at least 2 on strength.', ta: 'வடிவமையுங்கள்: 50 N சுமையில் வளைவு ≤ 2 mm, எடை ≤ 60 g, பாதுகாப்புக் காரணி ≥ 2.' },
];

export default function L2Properties() {
  const [tab, setTab] = useState<'beam' | 'weight' | 'heat'>('beam');
  const [mat, setMat] = useState('abs');
  const [h, setH] = useState(6);
  const [F, setF] = useState(50);
  const [corr, setCorr] = useState(false);
  const r = beam(mat, h, F);
  const broken = r.sf < 1;
  const scale = r.delta < 3 ? Math.min(10, 3 / Math.max(r.delta, 0.05)) : 1;
  const shown = Math.min(r.delta * scale, 80);

  const evaluate = (): Feedback => {
    const d = beam(mat, h, 50);
    const checks: [boolean, string, string][] = [
      [d.delta <= 2, `Deflection ${fmt(d.delta, 2)} mm ≤ 2 mm`, `Deflection ${fmt(d.delta, 2)} mm is over 2 mm — increase thickness or choose a stiffer material.`],
      [d.mass <= 60, `Mass ${fmt(d.mass, 1)} g ≤ 60 g`, `Mass ${fmt(d.mass, 1)} g is over 60 g — choose a lighter material or reduce thickness.`],
      [d.sf >= 2, `Safety factor ${fmt(d.sf, 1)} ≥ 2`, `Safety factor ${fmt(d.sf, 2)} is below 2 — it is too close to yielding or breaking.`],
    ];
    const ok = checks.filter((c) => c[0]).length;
    return {
      score: Math.round((ok / 3) * 100),
      correct: checks.filter((c) => c[0]).map((c) => c[1]),
      issues: checks.filter((c) => !c[0]).map((c) => ({ label: c[2] })),
      why: 'Material choice is a trade-off. Steel is stiff but heavy; plastic is light but floppy. Comparing stiffness-per-weight (E ÷ ρ) explains why bikes and aircraft use aluminium and carbon fibre — and why wood is a surprisingly good structural material.',
      suggestion: ok === 3 ? 'Find the lightest solution that still passes — that is what engineers call optimisation.' : 'Try bamboo, oak or carbon fibre and adjust the thickness until both deflection and mass pass.',
      canShowCorrection: true,
    };
  };

  const maxMass = Math.max(...MATERIALS.map((m) => m.eng.density));
  return (
    <LevelShell
      id="w4-l2"
      steps={steps}
      evaluate={evaluate}
      onCorrection={setCorr}
      hints={[{ en: 'Deflection δ = F·L³ / (3·E·I) with I = b·h³/12. Mass = density × volume. Bamboo at about 14 mm thick passes all three.', ta: 'δ = F·L³ / (3·E·I), I = b·h³/12.' }]}
      viewport={
        <Stage3D fit={150} camera={[110, 60, 260]} target={[100, -10, 0]} showViews={false} env>
          <mesh position={[-10, -10, 0]} receiveShadow>
            <boxGeometry args={[20, 80, 80]} />
            <meshStandardMaterial color="#577590" />
          </mesh>
          <group position={[0, 0, 0]}>
            <BentBeam h={h} delta={shown} color={materialById(mat)!.color} broken={broken} />
            <Arrow3D from={[L, 40 - shown, 0]} to={[L, h / 2 + 2 - shown, 0]} color="#ffd166" width={3} />
            <Label position={[L, 48 - shown, 0]} color="#ffd166">
              {F} N
            </Label>
            <Label position={[L / 2, -40, 0]} color={broken ? '#ff8a80' : '#e8eef4'}>
              {broken ? (r.brittle ? '💥 fractures' : '⚠ bends permanently (yields)') : `deflection ${fmt(r.delta, 2)} mm${scale > 1.01 ? ` (drawn ×${fmt(scale, 1)})` : ''}`}
            </Label>
            {corr && (
              <Label position={[L / 2, 40, 0]} color="#3fb950">
                e.g. bamboo 14 mm: {fmt(beam('bamboo', 14, 50).delta, 2)} mm, {fmt(beam('bamboo', 14, 50).mass, 0)} g
              </Label>
            )}
          </group>
        </Stage3D>
      }
    >
      <Seg value={tab} onChange={setTab} options={[{ v: 'beam', label: 'Stiffness & strength' }, { v: 'weight', label: 'Weight' }, { v: 'heat', label: 'Heat' }]} />
      {tab === 'beam' && (
        <>
          <div className="field">
            <label>Material</label>
            <select value={mat} onChange={(e) => setMat(e.target.value)}>
              {BEAM_MATS.map((id) => (
                <option key={id} value={id}>
                  {materialById(id)!.name} (E = {materialById(id)!.eng.E} GPa)
                </option>
              ))}
            </select>
          </div>
          <Slider label="Thickness h" value={h} min={2} max={30} step={0.5} unit="mm" onChange={setH} />
          <Slider label="Load F" value={F} min={5} max={300} step={5} unit="N" onChange={setF} />
          <div className="formula">I = b·h³/12 = {fmt(r.I, 0)} mm⁴</div>
          <div className="formula">δ = F·L³/(3·E·I) = {fmt(r.delta, 3)} mm</div>
          <div className="formula">σ = 6·F·L/(b·h²) = {fmt(r.sigma, 1)} MPa · strength {materialById(mat)!.eng.strength} MPa</div>
          <div className="kv">
            <span>Safety factor</span>
            <span style={{ color: r.sf >= 2 ? 'var(--good)' : r.sf >= 1 ? 'var(--warn)' : 'var(--bad)' }}>{fmt(r.sf, 2)}</span>
            <span>Mass</span>
            <span>{fmt(r.mass, 1)} g</span>
          </div>
          <Task ok={beam(mat, h, 50).delta <= 2}>δ ≤ 2 mm at 50 N</Task>
          <Task ok={beam(mat, h, 50).mass <= 60}>Mass ≤ 60 g</Task>
          <Task ok={beam(mat, h, 50).sf >= 2}>Safety factor ≥ 2 at 50 N</Task>
        </>
      )}
      {tab === 'weight' && (
        <div>
          <div className="lbl">Mass of the same 100 cm³ part</div>
          {MATERIALS.map((m) => (
            <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 60px', alignItems: 'center', gap: 6, fontSize: 12, margin: '2px 0' }}>
              <span>{m.name}</span>
              <span style={{ background: 'var(--panel3)', borderRadius: 3, height: 10 }}>
                <i style={{ display: 'block', height: '100%', width: `${(m.eng.density / maxMass) * 100}%`, background: m.color, borderRadius: 3 }} />
              </span>
              <span className="mono" style={{ textAlign: 'right' }}>
                {fmt((m.eng.density * 100) / 1000, 0)} g
              </span>
            </div>
          ))}
        </div>
      )}
      {tab === 'heat' && (
        <div>
          <div className="lbl">Heat flowing through a 3 mm thick, 10 cm² handle wall with an 80 °C difference: Q = k·A·ΔT / t</div>
          {[...MATERIALS].sort((a, b) => b.eng.k - a.eng.k).map((m) => {
            const Q = (m.eng.k * 0.001 * 80) / 0.003;
            return (
              <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 70px', alignItems: 'center', gap: 6, fontSize: 12, margin: '2px 0' }}>
                <span>{m.name}</span>
                <span style={{ background: 'var(--panel3)', borderRadius: 3, height: 10 }}>
                  <i style={{ display: 'block', height: '100%', width: `${(Math.log10(Q + 1) / Math.log10(4500)) * 100}%`, background: Q > 100 ? '#f85149' : Q > 10 ? '#f8961e' : '#4cc9f0', borderRadius: 3 }} />
                </span>
                <span className="mono" style={{ textAlign: 'right' }}>
                  {fmt(Q, Q < 10 ? 1 : 0)} W
                </span>
              </div>
            );
          })}
          <div className="note">Logarithmic bar scale. Red = the handle surface will quickly get dangerously hot; blue = good insulator.</div>
        </div>
      )}
      <div className="note warn">Simplified: ideal elastic beam theory, rounded material data, no fatigue, creep, moisture or grain direction effects. Real designs are checked with tests and proper analysis.</div>
    </LevelShell>
  );
}
