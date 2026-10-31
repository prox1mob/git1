import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { NumberField, Seg, Slider, Task } from '../../components/ui';
import { csgRaw, extrusionGeometry } from '../../lib/shapes';
import { rectPoly, treatCorners } from '../../lib/poly';
import { fmt } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

interface Params {
  W: number;
  D: number;
  r: number;
  H: number;
  t: number;
  f: number;
  N: number;
  d: number;
  spacing: 'driven' | 'fixed';
  pitch: number;
}
const INIT: Params = { W: 100, D: 60, r: 6, H: 25, t: 2, f: 2, N: 3, d: 8, spacing: 'fixed', pitch: 25 };

interface Feature {
  key: string;
  name: string;
  icon: string;
  error?: string;
  deps: string;
}

function rounded(w: number, d: number, r: number) {
  const base = rectPoly(-w / 2, -d / 2, w / 2, d / 2);
  return r > 0.2 ? treatCorners(base, r, 'fillet', 8) : base;
}
function prism(outline: [number, number][], y0: number, h: number) {
  const g = extrusionGeometry({ outline, holes: [], depth: h, bevel: 0 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + h / 2, 0);
  return g;
}

export function evaluateFeatures(p: Params): Feature[] {
  const pitch = p.spacing === 'driven' ? p.W / (p.N + 1) : p.pitch;
  const f: Feature[] = [
    { key: 'sketch', name: `Sketch: rounded rectangle ${p.W} × ${p.D}, R${p.r}`, icon: '✏️', deps: 'W, D, r' },
    { key: 'extrude', name: `Extrude ${p.H} mm`, icon: '⬆️', deps: 'H · uses Sketch' },
    { key: 'shell', name: `Shell: walls ${p.t} mm, floor ${p.f} mm`, icon: '🫙', deps: 't, f · uses Extrude' },
    { key: 'holes', name: `Hole pattern: ${p.N} × Ø${p.d}, pitch ${fmt(pitch, 1)}${p.spacing === 'driven' ? ' (= W ÷ (N+1))' : ' (fixed)'}`, icon: '⦿', deps: 'N, d, pitch · uses Shell floor' },
  ];
  if (p.r * 2 >= Math.min(p.W, p.D)) f[0].error = 'Corner radius is larger than half the width — the outline collapses.';
  if (p.t * 2 >= Math.min(p.W, p.D) - 1) f[2].error = 'Walls are thicker than the part — nothing left inside.';
  else if (p.f >= p.H) f[2].error = 'Floor is as thick as the whole part.';
  const span = (p.N - 1) * pitch;
  if (p.d >= pitch - 0.5) f[3].error = 'Holes overlap: diameter is larger than the pitch.';
  else if (span / 2 + p.d / 2 >= p.W / 2 - p.t) f[3].error = 'Outer holes cut into the side walls.';
  else if (p.d / 2 >= p.D / 2 - p.t) f[3].error = 'Holes are wider than the inside of the tray.';
  return f;
}

function buildModel(p: Params, upTo: number) {
  const feats = evaluateFeatures(p);
  const failAt = feats.findIndex((x) => x.error);
  const last = Math.min(upTo, failAt < 0 ? 3 : failAt - 1);
  if (last < 1) return { geo: null as THREE.BufferGeometry | null, feats, failAt };
  let g: THREE.BufferGeometry = prism(rounded(p.W, p.D, p.r), 0, p.H);
  if (last >= 2) g = csgRaw(g, [prism(rounded(p.W - 2 * p.t, p.D - 2 * p.t, Math.max(0, p.r - p.t)), p.f, p.H - p.f + 2)], 'subtract');
  if (last >= 3) {
    const pitch = p.spacing === 'driven' ? p.W / (p.N + 1) : p.pitch;
    const tools: THREE.BufferGeometry[] = [];
    for (let i = 0; i < p.N; i++) {
      const c = new THREE.CylinderGeometry(p.d / 2, p.d / 2, p.f + 4, 24);
      c.translate((i - (p.N - 1) / 2) * pitch, p.f / 2, 0);
      tools.push(c);
    }
    g = csgRaw(g, tools, 'subtract');
  }
  return { geo: g, feats, failAt };
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Professional CAD stores a recipe, not just a shape: a feature history. Each feature uses the result of the ones above it.', ta: 'தொழில்முறை CAD ஒரு செய்முறையைச் சேமிக்கிறது: feature history.' },
  { stage: 'TOUCH', text: 'Drag the “Roll back” slider to watch the tray being built step by step. Then edit any earlier number — everything downstream rebuilds.', ta: '"Roll back" slider-ஐ இழுத்து படிப்படியாகக் கட்டுவதைப் பாருங்கள்.' },
  { stage: 'UNDERSTAND', text: 'Relationships carry intent: if the hole pitch is DRIVEN by the width (W ÷ (N+1)), the holes stay evenly spaced when the tray grows. A FIXED pitch does not — and features can fail (red) when an upstream change breaks them.', ta: 'உறவுகள் நோக்கத்தைக் கொண்டு செல்கின்றன: pitch = W ÷ (N+1) என்றால் துளைகள் எப்போதும் சம இடைவெளியில் இருக்கும்.' },
  { stage: 'BUILD', text: 'Design change from the customer: make the tray 120 mm wide with FOUR Ø8 holes, still evenly spaced across the width, 2 mm walls, and no failed features.', ta: 'வாடிக்கையாளர் மாற்றம்: 120 mm அகலம், நான்கு Ø8 துளைகள், சம இடைவெளி, 2 mm சுவர்.' },
];

export default function L9Parametric() {
  const [p, setP] = useState<Params>(INIT);
  const [upTo, setUpTo] = useState(3);
  const [open, setOpen] = useState<string>('holes');
  const { geo, feats, failAt } = useMemo(() => buildModel(p, upTo), [p, upTo]);
  const set = (q: Partial<Params>) => setP({ ...p, ...q });
  const pitch = p.spacing === 'driven' ? p.W / (p.N + 1) : p.pitch;
  const even = Math.abs(pitch - p.W / (p.N + 1)) < 0.5;

  const evaluate = (): Feedback => {
    const checks: [boolean, string, string][] = [
      [p.W === 120, 'Width 120 mm', `Width is ${p.W} mm`],
      [p.N === 4, 'Four holes', `${p.N} holes`],
      [p.d === 8, 'Ø8 holes', `Holes are Ø${p.d}`],
      [p.t === 2, '2 mm walls', `Walls are ${p.t} mm`],
      [even, 'Holes evenly spaced across the width', `Pitch ${fmt(pitch, 1)} mm, but even spacing needs ${fmt(p.W / (p.N + 1), 1)} mm`],
      [failAt < 0, 'No failed features', `Feature “${feats[failAt]?.name}” failed: ${feats[failAt]?.error}`],
      [p.spacing === 'driven', 'Hole pitch driven by the width (robust to future changes)', 'Pitch is a fixed number — the next width change will break the spacing again'],
    ];
    return {
      score: Math.round((checks.filter((c) => c[0]).length / checks.length) * 100),
      correct: checks.filter((c) => c[0]).map((c) => c[1]),
      issues: checks.filter((c) => !c[0]).map((c) => ({ label: c[2] })),
      why: 'Products change constantly: a bigger battery, a new connector, a customer request. A well-built feature history turns a design change into a two-number edit instead of a remodel. Capturing relationships (like pitch = W ÷ (N+1)) is what “parametric” really means.',
      suggestion: p.spacing !== 'driven' ? 'Open the Hole pattern feature and switch spacing to “Driven by width”.' : 'Try W = 160 and N = 6: if your relationships are right, nothing fails.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w3-l9"
      steps={steps}
      evaluate={evaluate}
      onRetry={() => setP(INIT)}
      hints={[{ en: 'Even spacing for 4 holes across 120 mm: 120 ÷ 5 = 24 mm pitch.', ta: '120 mm-இல் 4 துளைகள்: 120 ÷ 5 = 24 mm.' }]}
      viewport={
        <Stage3D fit={100} camera={[90, 110, 140]} target={[0, 8, 0]} env>
          {geo && (
            <mesh geometry={geo} castShadow>
              <meshStandardMaterial color="#e9edf2" roughness={0.45} />
            </mesh>
          )}
        </Stage3D>
      }
    >
      <Slider label={`Roll back: show up to feature ${upTo + 1}`} value={upTo} min={0} max={3} step={1} onChange={setUpTo} />
      <div className="tree">
        {feats.map((ft, i) => {
          const failed = !!ft.error;
          const skipped = failAt >= 0 && i > failAt;
          return (
            <div key={ft.key} className="card" style={{ padding: 8, marginBottom: 6, borderColor: failed ? 'var(--bad)' : i > upTo ? 'var(--border)' : 'var(--accent-d)', opacity: i > upTo || skipped ? 0.55 : 1 }}>
              <div className="node" onClick={() => setOpen(open === ft.key ? '' : ft.key)}>
                <span>{ft.icon}</span>
                <span className="nm">
                  {i + 1}. {ft.name}
                </span>
                <span>{failed ? '⚠' : skipped ? '⏸' : '✓'}</span>
              </div>
              <div className="muted" style={{ fontSize: 11, paddingLeft: 30 }}>
                parameters: {ft.deps}
              </div>
              {failed && <div style={{ color: 'var(--bad)', fontSize: 12, paddingLeft: 30 }}>{ft.error}</div>}
              {open === ft.key && (
                <div style={{ paddingLeft: 8, marginTop: 6 }}>
                  {ft.key === 'sketch' && (
                    <>
                      <NumberField label="Width W" value={p.W} digits={0} min={20} max={250} onChange={(W) => set({ W })} unit="mm" />
                      <NumberField label="Depth D" value={p.D} digits={0} min={20} max={200} onChange={(D) => set({ D })} unit="mm" />
                      <NumberField label="Corner r" value={p.r} digits={1} min={0} max={60} onChange={(r) => set({ r })} unit="mm" />
                    </>
                  )}
                  {ft.key === 'extrude' && <NumberField label="Height H" value={p.H} digits={0} min={4} max={100} onChange={(H) => set({ H })} unit="mm" />}
                  {ft.key === 'shell' && (
                    <>
                      <NumberField label="Wall t" value={p.t} digits={1} min={0.5} max={40} onChange={(t) => set({ t })} unit="mm" />
                      <NumberField label="Floor f" value={p.f} digits={1} min={0.5} max={40} onChange={(f) => set({ f })} unit="mm" />
                    </>
                  )}
                  {ft.key === 'holes' && (
                    <>
                      <NumberField label="Count N" value={p.N} digits={0} min={1} max={12} onChange={(N) => set({ N: Math.round(N) })} />
                      <NumberField label="Hole Ø d" value={p.d} digits={1} min={1} max={40} onChange={(d) => set({ d })} unit="mm" />
                      <Seg value={p.spacing} onChange={(spacing) => set({ spacing })} options={[{ v: 'fixed', label: 'Fixed pitch' }, { v: 'driven', label: 'Driven by width' }]} />
                      {p.spacing === 'fixed' && <NumberField label="Pitch" value={p.pitch} digits={1} min={1} onChange={(v) => set({ pitch: v })} unit="mm" />}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Task ok={p.W === 120 && p.N === 4 && even && failAt < 0}>Customer change applied cleanly</Task>
    </LevelShell>
  );
}
