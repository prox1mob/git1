import { useState, type ReactNode } from 'react';
import { clamp, degToRad, fmt } from '../../../core/geometry';
import { useHistory } from '../../../core/history';
import { Challenge, type CheckResult } from '../../../ui/feedback';
import { DesignLink, SafetyNote, Segmented, Slider, Stat, Stats, ToolBar } from '../../../ui/kit';
import { Workbench } from '../../../ui/lesson';
import { DimLine } from '../../../ui/svg';

interface Rule {
  ok: boolean;
  text: ReactNode;
  why: ReactNode;
}

function Checklist({ rules }: { rules: Rule[] }) {
  return (
    <ul className="checklist">
      {rules.map((r, i) => (
        <li key={i}><span className={r.ok ? 'ok' : 'no'}>{r.ok ? '✓' : '✗'}</span> {r.text}</li>
      ))}
    </ul>
  );
}

function verdict(rules: Rule[], okText: string): CheckResult {
  const bad = rules.filter((r) => !r.ok);
  if (!bad.length) return { ok: true, happened: okText };
  return { ok: false, happened: <><b>{bad.length} of {rules.length} constraints</b> not met yet:<Checklist rules={bad} /></>, why: bad[0].why };
}

/* ---------------- Brief 1: pen holder ---------------- */

const PEN_D = 10;
const PEN_L = 140;

/** How many 10 mm pens fit standing in a circle of diameter D (best of several hexagonal packings). */
export function pensThatFit(D: number): { n: number; pts: { x: number; y: number }[] } {
  const R = D / 2 - PEN_D / 2;
  let best: { x: number; y: number }[] = [];
  if (R < 0) return { n: 0, pts: [] };
  const dy = (PEN_D * Math.sqrt(3)) / 2;
  for (const ox of [0, PEN_D / 2, PEN_D / 4]) {
    for (const oy of [0, dy / 2]) {
      const pts: { x: number; y: number }[] = [];
      for (let r = -12; r <= 12; r++) {
        for (let c = -12; c <= 12; c++) {
          const x = c * PEN_D + (r % 2 ? PEN_D / 2 : 0) + ox;
          const y = r * dy + oy;
          if (Math.hypot(x, y) <= R + 1e-9) pts.push({ x, y });
        }
      }
      if (pts.length > best.length) best = pts;
    }
  }
  return { n: best.length, pts: best };
}

function usePenHolder() {
  const h = useHistory({ d: 40, ht: 60, t: 1.5 });
  const { d, ht, t } = h.value;
  const fit = pensThatFit(d);
  const Ro = d / 2 + t;
  const material = (Math.PI * (Ro * Ro - (d / 2) ** 2) * ht + Math.PI * Ro * Ro * t) / 1000;
  const rules: Rule[] = [
    { ok: fit.n >= 10, text: <>Holds 10 pens (Ø{PEN_D} mm) — fits {fit.n}</>, why: 'Round pens cannot fill a circle completely; you need more inside area than 10 × one pen’s area. Widen the inside.' },
    { ok: ht >= 0.55 * PEN_L && ht <= 0.7 * PEN_L, text: <>Height {ht} mm is 55–70% of a {PEN_L} mm pen ({fmt(0.55 * PEN_L, 0)}–{fmt(0.7 * PEN_L, 0)} mm)</>, why: 'Too short and pens fall out; too tall and you cannot grab them.' },
    { ok: t >= 2, text: <>Wall at least 2 mm (now {t} mm)</>, why: 'Thin walls crack and are hard to 3D-print or mould.' },
    { ok: material <= 40, text: <>Material ≤ 40 cm³ (now {fmt(material, 1)} cm³)</>, why: 'Material = (outer circle − inner circle) × height + base. Thick or wide walls cost more.' },
  ];
  const S = 3;
  const tool = (
    <svg className="tool" viewBox="0 0 800 440">
      <g transform="translate(200 220)">
        <circle r={Ro * S} fill="#ffd8a8" stroke="#d9480f" strokeWidth={2} />
        <circle r={(d / 2) * S} fill="#fff" stroke="#d9480f" />
        {fit.pts.map((p, i) => <circle key={i} cx={p.x * S} cy={p.y * S} r={(PEN_D / 2) * S - 1} fill={i < 10 ? '#4dabf7' : '#a5d8ff'} stroke="#1864ab" />)}
        <text y={-Ro * S - 14} textAnchor="middle" className="svg-label small" fill="#495057">TOP VIEW · {fit.n} pens fit</text>
      </g>
      <g transform="translate(470 400)">
        <rect x={0} y={-ht * 2} width={Ro * 2 * 2} height={ht * 2} fill="#ffd8a8" stroke="#d9480f" />
        <rect x={t * 2} y={-ht * 2} width={d * 2} height={(ht - t) * 2} fill="#fff" />
        <rect x={t * 2 + 10} y={-(PEN_L + t) * 2} width={PEN_D * 2} height={PEN_L * 2} fill="#4dabf7" opacity={0.7} />
        <DimLine a={{ x: Ro * 4, y: 0 }} b={{ x: Ro * 4, y: -ht * 2 }} offset={-20} label={`${ht} mm`} />
        <text x={0} y={22} className="svg-label small" fill="#495057">SIDE SECTION with one pen</text>
      </g>
    </svg>
  );
  const controls = (
    <>
      <Slider label="Inside diameter" value={d} min={20} max={90} unit="mm" onStart={h.checkpoint} onChange={(v) => h.set((s) => ({ ...s, d: v }))} />
      <Slider label="Height" value={ht} min={30} max={150} unit="mm" onStart={h.checkpoint} onChange={(v) => h.set((s) => ({ ...s, ht: v }))} />
      <Slider label="Wall thickness" value={t} min={1} max={6} step={0.5} unit="mm" onStart={h.checkpoint} onChange={(v) => h.set((s) => ({ ...s, t: v }))} />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
    </>
  );
  return { tool, controls, rules, brief: <p>A desk pen holder for <b>10 pens</b> (Ø10 mm, 140 mm long), printed in plastic, using at most <b>40 cm³</b> of material.</p>, ok: 'A tidy, printable pen holder that meets every constraint.', hint: 'Find the smallest inside diameter that fits 10 pens first, then set the height, then the thinnest wall allowed.' };
}

/* ---------------- Brief 2: phone stand ---------------- */

function usePhoneStand() {
  const h = useHistory({ ang: 55, base: 50, lip: 5, slot: 14 });
  const { ang, base, lip, slot } = h.value;
  const comBack = 75 * Math.cos(degToRad(ang)) - 9 * Math.sin(degToRad(ang)) / 2;
  const tipOk = comBack <= base - 10;
  const rules: Rule[] = [
    { ok: ang >= 60 && ang <= 75, text: <>Viewing angle 60–75° (now {ang}°)</>, why: 'Too flat and you look down at a glare; too upright and it is hard to read at a desk.' },
    { ok: slot >= 10 && slot <= 12, text: <>Slot 10–12 mm for a 9 mm phone (now {slot} mm)</>, why: 'Clearance = slot − phone thickness. Too little and it jams; too much and it wobbles.' },
    { ok: lip >= 8, text: <>Front lip at least 8 mm tall (now {lip} mm)</>, why: 'A low lip lets the phone slide out.' },
    { ok: tipOk, text: <>Does not tip backwards (balance point {fmt(comBack, 0)} mm behind the lip, base reaches {base - 10} mm with a 10 mm safety margin)</>, why: 'If the phone’s balance point is behind the end of the base, the stand tips over. Lengthen the base or stand the phone more upright.' },
  ];
  const k = 2.2;
  const lipX = 260;
  const gy = 380;
  const back = { x: lipX - 150 * k * Math.cos(degToRad(ang)), y: gy - lip * k - 150 * k * Math.sin(degToRad(ang)) };
  const com = { x: lipX - comBack * k, y: gy - lip * k - 75 * k * Math.sin(degToRad(ang)) };
  const tool = (
    <svg className="tool" viewBox="0 0 800 440">
      <line x1={20} y1={gy} x2={780} y2={gy} stroke="#adb5bd" strokeWidth={2} />
      <rect x={lipX - base * k} y={gy - 8} width={base * k + slot * k + 10} height={8} fill="#868e96" />
      <rect x={lipX + slot * k} y={gy - lip * k - 8} width={10} height={lip * k + 8} fill="#495057" />
      <rect x={lipX - 6} y={gy - 30} width={6} height={22} fill="#495057" />
      <line x1={lipX} y1={gy - lip * k} x2={back.x} y2={back.y} stroke="#343a40" strokeWidth={9 * k} strokeLinecap="butt" />
      <circle cx={com.x} cy={com.y} r={7} fill={tipOk ? '#2b8a3e' : '#e5484d'} />
      <line x1={com.x} y1={com.y} x2={com.x} y2={gy} stroke={tipOk ? '#2b8a3e' : '#e5484d'} strokeDasharray="5 4" strokeWidth={2} />
      <text x={com.x - 8} y={com.y - 12} textAnchor="end" className="svg-label small" fill={tipOk ? '#2b8a3e' : '#e5484d'}>balance point</text>
      <text x={lipX + 30} y={gy - 120} className="svg-label" fill="#1c7ed6">{ang}°</text>
      <DimLine a={{ x: lipX - base * k, y: gy }} b={{ x: lipX, y: gy }} offset={20} label={`base ${base} mm`} />
      <text x={20} y={30} className="svg-label small" fill="#868e96">SIDE VIEW · simplified balance model</text>
    </svg>
  );
  const controls = (
    <>
      <Slider label="Phone angle from the desk" value={ang} min={40} max={85} unit="°" onStart={h.checkpoint} onChange={(v) => h.set((s) => ({ ...s, ang: v }))} />
      <Slider label="Base length behind the lip" value={base} min={20} max={120} unit="mm" onStart={h.checkpoint} onChange={(v) => h.set((s) => ({ ...s, base: v }))} />
      <Slider label="Lip height" value={lip} min={2} max={20} unit="mm" onStart={h.checkpoint} onChange={(v) => h.set((s) => ({ ...s, lip: v }))} />
      <Slider label="Slot width" value={slot} min={6} max={16} step={0.5} unit="mm" onStart={h.checkpoint} onChange={(v) => h.set((s) => ({ ...s, slot: v }))} />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
    </>
  );
  return { tool, controls, rules, brief: <><p>A desk stand for a 150 × 75 × 9 mm phone. It must hold the phone at a comfortable angle, grip it gently and never tip over.</p><SafetyNote>The tipping check is a simplified balance model — real products are tested with real phones, knocks and cables.</SafetyNote></>, ok: 'A stable, comfortable phone stand.', hint: 'Set the angle first (trigonometry!), then make the base long enough that the green balance point is over it.' };
}

/* ---------------- Brief 3: lunch box ---------------- */

function useLunchBox() {
  const h = useHistory({ w: 150, d: 120, ht: 60 });
  const { w, d, ht } = h.value;
  const wall = 2;
  const cap = ((w - 2 * wall) * (d - 2 * wall) * (ht - wall)) / 1e6;
  const ratio = w / d;
  const rules: Rule[] = [
    { ok: cap >= 1.0 && cap <= 1.2, text: <>Holds 1.0–1.2 L inside (now {fmt(cap, 2)} L)</>, why: 'Inside volume = (w − 4)(d − 4)(h − 2) mm³ because of the 2 mm walls. Divide by 1 000 000 for litres.' },
    { ok: Math.abs(ratio - 1.5) / 1.5 <= 0.03, text: <>Width : depth = 3 : 2 (now {fmt(ratio, 2)} : 1, needs 1.5 : 1)</>, why: 'The brand family uses a 3 : 2 footprint. Depth = width × 2 ÷ 3.' },
    { ok: ht <= 70, text: <>Height ≤ 70 mm so it lies flat in a bag (now {ht} mm)</>, why: 'Make it wider instead of taller.' },
    { ok: w <= 200, text: <>Width ≤ 200 mm (now {w} mm)</>, why: 'It has to fit a school bag pocket.' },
  ];
  const k = 1.6;
  const tool = (
    <svg className="tool" viewBox="0 0 800 440">
      <g transform="translate(60 40)">
        <text x={0} y={-10} className="svg-label small" fill="#868e96">TOP VIEW</text>
        <rect x={0} y={0} width={w * k} height={d * k} rx={14} fill="#c3fae8" stroke="#087f5b" strokeWidth={2} />
        <rect x={wall * k} y={wall * k} width={(w - 2 * wall) * k} height={(d - 2 * wall) * k} rx={12} fill="none" stroke="#087f5b" strokeDasharray="4 4" />
        <DimLine a={{ x: 0, y: d * k }} b={{ x: w * k, y: d * k }} offset={18} label={`${w} mm`} />
        <DimLine a={{ x: w * k, y: d * k }} b={{ x: w * k, y: 0 }} offset={18} label={`${d} mm`} />
      </g>
      <g transform={`translate(${Math.max(420, 100 + w * k)} 40)`}>
        <text x={0} y={-10} className="svg-label small" fill="#868e96">FRONT VIEW</text>
        <rect x={0} y={0} width={w * k} height={ht * k} rx={10} fill="#c3fae8" stroke="#087f5b" strokeWidth={2} />
        <line x1={0} y1={70 * k} x2={w * k} y2={70 * k} stroke="#e5484d" strokeDasharray="6 4" />
        <text x={w * k + 6} y={70 * k + 4} fontSize={11} fill="#e5484d">70 mm limit</text>
        <DimLine a={{ x: 0, y: 0 }} b={{ x: 0, y: ht * k }} offset={18} label={`${ht} mm`} />
      </g>
    </svg>
  );
  const controls = (
    <>
      <Slider label="Width" value={w} min={80} max={240} unit="mm" onStart={h.checkpoint} onChange={(v) => h.set((s) => ({ ...s, w: v }))} />
      <Slider label="Depth" value={d} min={60} max={200} unit="mm" onStart={h.checkpoint} onChange={(v) => h.set((s) => ({ ...s, d: v }))} />
      <Slider label="Height" value={ht} min={30} max={120} unit="mm" onStart={h.checkpoint} onChange={(v) => h.set((s) => ({ ...s, ht: clamp(v, 30, 120) }))} />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
    </>
  );
  return { tool, controls, rules, brief: <p>A lunch box: <b>1.0–1.2 litres</b> inside, a <b>3 : 2</b> footprint, flat enough for a bag, walls 2 mm.</p>, ok: 'Right capacity, right proportions, fits the bag.', hint: 'Pick a width, set depth = width × 2 ÷ 3, then adjust the height until the capacity is in range.' };
}

const BRIEFS = { pen: { label: '🖊️ Pen holder', make: usePenHolder }, stand: { label: '📱 Phone stand', make: usePhoneStand }, lunch: { label: '🍱 Lunch box', make: useLunchBox } } as const;
type BriefKey = keyof typeof BRIEFS;

function BriefView({ which, onSwitch }: { which: BriefKey; onSwitch: (k: BriefKey) => void }) {
  const b = BRIEFS[which].make();
  const met = b.rules.filter((r) => r.ok).length;
  const panel = (
    <Challenge
      id="puzzle-engineer"
      title={`Design brief: ${BRIEFS[which].label}`}
      brief={<>
        <Segmented small value={which} onChange={onSwitch} options={(Object.keys(BRIEFS) as BriefKey[]).map((k) => ({ value: k, label: BRIEFS[k].label }))} />
        <div style={{ marginTop: 8 }}>{b.brief}</div>
      </>}
      check={() => verdict(b.rules, b.ok)}
      hint={b.hint}
      solution={<p>Work through the checklist from top to bottom; each rule tells you which number to change. Every brief has many correct answers.</p>}
    >
      <Stats><Stat label="constraints met" value={`${met} / ${b.rules.length}`} color={met === b.rules.length ? '#2b8a3e' : '#e8590c'} /></Stats>
      <Checklist rules={b.rules} />
      <DesignLink>Real briefs are lists of constraints like these. Engineers turn each one into a number to check — exactly what you just did.</DesignLink>
    </Challenge>
  );
  return <Workbench title={`The Product Engineer — ${BRIEFS[which].label}`} tool={b.tool} controls={b.controls} panel={panel} />;
}

export default function ProductEngineer() {
  const [which, setWhich] = useState<BriefKey>('pen');
  return <BriefView key={which} which={which} onSwitch={setWhich} />;
}
