import { useRef, useState, type ReactNode } from 'react';
import { add, clamp, fmt, headingDeg, pick, randInt, rotate, snap, sub, type Vec } from '../../../core/geometry';
import { useHistory } from '../../../core/history';
import { updateSettings, useSettings, type Difficulty } from '../../../core/store';
import { Challenge, ChoiceQuiz, NumberQuiz, type CheckResult } from '../../../ui/feedback';
import { DesignLink, Formula, Note, NumberTable, Segmented, Slider, Stat, Stats, Steps, T, ToolBar } from '../../../ui/kit';
import { Lesson, Workbench, type StageKey } from '../../../ui/lesson';
import { DimLine, GridLines, Handle, useSvgDrag } from '../../../ui/svg';

const W = 800;

/* ================================================================== */
/* mm, cm and m                                                        */
/* ================================================================== */

const VIEWS = {
  m: { range: 2000, snap: 10, label: '0 – 2 m' },
  cm: { range: 200, snap: 1, label: '0 – 20 cm' },
  mm: { range: 20, snap: 0.1, label: '0 – 2 cm (magnified)' },
} as const;
type ViewKey = keyof typeof VIEWS;

const OBJECTS: { label: string; mm: number }[] = [
  { label: '🪙 coin', mm: 25 },
  { label: '💳 bank card', mm: 85.6 },
  { label: '📱 phone', mm: 150 },
  { label: '📄 A4 sheet', mm: 297 },
  { label: '🚪 door', mm: 2000 },
  { label: '🔩 screw', mm: 12 },
];

function UnitsLesson() {
  const h = useHistory({ L: 150 });
  const { L } = h.value;
  const [view, setView] = useState<ViewKey>('cm');
  const V = VIEWS[view];
  const x0 = 40;
  const x1 = 760;
  const X = (mm: number) => x0 + ((x1 - x0) * Math.min(mm, V.range)) / V.range;
  const ticks: ReactNode[] = [];
  const minor = view === 'm' ? 10 : view === 'cm' ? 1 : 0.1;
  for (let k = 0, i = 0; k <= V.range + 1e-9; k += minor, i++) {
    const major = view === 'm' ? i % 10 === 0 : view === 'cm' ? i % 10 === 0 : i % 10 === 0;
    const mid = i % 5 === 0;
    const x = X(k);
    ticks.push(<line key={i} x1={x} y1={220} x2={x} y2={220 + (major ? 30 : mid ? 20 : 11)} stroke="#1f2a44" strokeWidth={major ? 1.6 : 0.8} />);
    if (major) {
      const lab = view === 'm' ? `${fmt(k / 1000, 1)} m` : view === 'cm' ? `${fmt(k / 10, 0)} cm` : `${fmt(k / 10, 0)} cm`;
      ticks.push(<text key={`t${i}`} x={x} y={270} fontSize={12} textAnchor="middle" fill="#1f2a44">{lab}</text>);
    }
  }
  const over = L > V.range;
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 330`}>
      <rect x={x0 - 14} y={212} width={x1 - x0 + 28} height={70} rx={6} fill="#ffe066" stroke="#f08c00" />
      {ticks}
      <rect x={x0} y={140} width={X(L) - x0} height={40} rx={8} fill="#74c0fc" stroke="#1971c2" strokeWidth={2} />
      {over && <text x={x1 - 6} y={166} textAnchor="end" className="svg-label" fill="#e5484d">continues off the ruler →</text>}
      <line x1={X(L)} y1={130} x2={X(L)} y2={220} stroke="#1971c2" strokeDasharray="4 3" />
      {!over && (
        <Handle x={X(L)} y={160} color="#1971c2" onStart={h.checkpoint} title="stretch the object"
          onDrag={(p) => h.set({ L: clamp(snap(((p.x - x0) / (x1 - x0)) * V.range, V.snap), V.snap, V.range) })} />
      )}
      <text x={x0} y={50} className="svg-label big" fill="#1f2a44">{fmt(L, 1)} mm = {fmt(L / 10, 2)} cm = {fmt(L / 1000, 4)} m</text>
      <text x={x0} y={84} className="svg-label" fill="#495057">Ruler view: {V.label}. Drag the blue bar's end.</text>
    </svg>
  );
  const controls = (
    <>
      <Segmented value={view} onChange={(v) => { setView(v); if (L > VIEWS[v].range) h.commit({ L: VIEWS[v].range / 2 }); }} options={[{ value: 'm', label: '🔭 metres' }, { value: 'cm', label: '📏 centimetres' }, { value: 'mm', label: '🔬 millimetres' }]} />
      <div className="row">
        {OBJECTS.map((o) => (
          <button key={o.label} className="btn small" onClick={() => { h.commit({ L: o.mm }); setView(o.mm > 200 ? 'm' : o.mm > 20 ? 'cm' : 'mm'); }}>{o.label}</button>
        ))}
      </div>
      <Stats>
        <Stat label="millimetres" value={`${fmt(L, 1)} mm`} color="#c2255c" />
        <Stat label="centimetres" value={`${fmt(L / 10, 2)} cm`} color="#1971c2" />
        <Stat label="metres" value={`${fmt(L / 1000, 4)} m`} color="#2b8a3e" />
      </Stats>
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A blue object lying on a <T k="ruler" />. Its length is written three ways: millimetres, centimetres and metres.</p>,
    touch: <p>Drag the end of the blue bar. Switch the ruler view: metres, centimetres, or magnified millimetres.</p>,
    experiment: (
      <ul>
        <li>Tap the object buttons: coin, card, phone, A4, door.</li>
        <li>In the 🔬 view, count the tiny marks between 0 and 1 cm.</li>
        <li>Watch the decimal point move as you switch units.</li>
      </ul>
    ),
    discover: (
      <>
        <ChoiceQuiz question="How many millimetres fit in one centimetre?" options={[{ label: '10', correct: true, why: 'Count the small marks in the 🔬 view: 10 mm make 1 cm.' }, { label: '100', why: '100 is how many centimetres make a metre.' }, { label: '1000', why: '1000 mm make a whole metre.' }]} />
        <ChoiceQuiz question="Which is longer: 45 cm or 0.5 m?" options={[{ label: '45 cm', why: '0.5 m = 50 cm, which is 5 cm more than 45 cm.' }, { label: '0.5 m', correct: true, why: 'Change both to the same unit: 0.5 m = 50 cm > 45 cm.' }]} hint="Turn both into centimetres first." />
      </>
    ),
    understand: (
      <>
        <p>1 cm = 10 mm. 1 m = 100 cm = 1000 mm. Each step is “times 10” (or 100, or 1000).</p>
        <p>Changing units does not change the object — only the size of the counting step.</p>
        <p>Always compare lengths in the <b>same unit</b>.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'cm', means: 'centimetres', color: '#1971c2' }, ' = ', { s: 'mm', means: 'millimetres', color: '#c2255c' }, ' ÷ 10']} />
        <Formula parts={[{ s: 'm', means: 'metres', color: '#2b8a3e' }, ' = ', { s: 'mm', means: 'millimetres', color: '#c2255c' }, ' ÷ 1000']} caption="Dividing by 10 moves the decimal point one place left; by 1000, three places." />
        <NumberQuiz question="A desk is 1.35 m wide. How many millimetres is that?" answer={1350} unit="mm" hint="metres → mm: × 1000 (move the point 3 places right)."
          diagnose={(x) => (x === 135 ? 'That is centimetres. Millimetres are 10 times more.' : x === 13.5 ? 'You moved the point the wrong way. Bigger unit → smaller unit means a bigger number.' : null)}
          solution={<Steps steps={['1.35 × 1000', '= 1350 mm']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Product drawings are almost always in <b>millimetres</b> — no unit is written; the title block says “all dimensions in mm”.</li>
          <li>Furniture and rooms use mm too (a door is 2000 mm, not 2 m).</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['Length', `${fmt(L, 1)} mm`],
      ['in cm', `${fmt(L, 1)} ÷ 10 = ${fmt(L / 10, 2)} cm`],
      ['in m', `${fmt(L, 1)} ÷ 1000 = ${fmt(L / 1000, 4)} m`],
      ['in inches (for interest)', `${fmt(L, 1)} ÷ 25.4 = ${fmt(L / 25.4, 2)} in`],
    ]} />
  );
  return <Lesson id="l5-units" title="mm, cm and m" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Virtual ruler & calibration                                         */
/* ================================================================== */

const PXMM = 3; // drawing scale on the measuring table: 1 mm = 3 px

interface RulerState {
  o: Vec;
  rot: number;
}

/** A draggable, rotatable 150 mm ruler drawn at the table scale. */
export function VirtualRuler({ s, onChange, onStart, lengthMm = 150, pxPerMm = PXMM }: { s: RulerState; onChange: (r: RulerState) => void; onStart?: () => void; lengthMm?: number; pxPerMm?: number }) {
  const start = useRef(s.o);
  const drag = useSvgDrag({
    onStart: () => {
      start.current = s.o;
      onStart?.();
    },
    onMove: (p, st) => onChange({ ...s, o: add(start.current, sub(p, st)) }),
  });
  const len = lengthMm * pxPerMm;
  const ticks: ReactNode[] = [];
  for (let k = 0; k <= lengthMm; k++) {
    const x = 12 + k * pxPerMm;
    const L = k % 10 === 0 ? 18 : k % 5 === 0 ? 12 : 7;
    ticks.push(<line key={k} x1={x} y1={0} x2={x} y2={L} stroke="#1f2a44" strokeWidth={k % 10 === 0 ? 1.2 : 0.7} />);
    if (k % 10 === 0) ticks.push(<text key={`t${k}`} x={x} y={30} fontSize={10} textAnchor="middle" fill="#1f2a44">{k / 10}</text>);
  }
  const knob = add(s.o, rotate({ x: len + 46, y: 20 }, -s.rot));
  return (
    <g>
      <g transform={`translate(${s.o.x} ${s.o.y}) rotate(${-s.rot})`} className="draggable" {...drag}>
        <rect x={0} y={0} width={len + 24} height={44} rx={4} fill="rgba(255,236,153,0.85)" stroke="#f59f00" />
        {ticks}
        <text x={len - 4} y={40} fontSize={9} textAnchor="end" fill="#868e96">cm · mm</text>
      </g>
      <Handle x={knob.x} y={knob.y} r={10} color="#f59f00" title="rotate the ruler" onStart={onStart}
        onDrag={(p) => onChange({ ...s, rot: snap(headingDeg(s.o, p) + Math.atan2(20, len + 46) * (180 / Math.PI), 0.5) })}>
        <text y={4} fontSize={13} textAnchor="middle" fill="#fff" pointerEvents="none">⟳</text>
      </Handle>
    </g>
  );
}

interface Part {
  name: string;
  len: number;
  draw: (len: number) => ReactNode;
}

const PARTS: Part[] = [
  { name: 'screw', len: 0, draw: (l) => <g><rect x={0} y={-5} width={l * PXMM - 12} height={10} fill="#adb5bd" /><rect x={l * PXMM - 14} y={-12} width={14} height={24} rx={3} fill="#868e96" />{Array.from({ length: Math.floor((l * PXMM - 16) / 6) }, (_, i) => <line key={i} x1={4 + i * 6} y1={-5} x2={8 + i * 6} y2={5} stroke="#495057" />)}</g> },
  { name: 'eraser', len: 0, draw: (l) => <g><rect x={0} y={-18} width={l * PXMM} height={36} rx={6} fill="#ffc9c9" stroke="#e03131" /><rect x={l * PXMM * 0.55} y={-18} width={l * PXMM * 0.45} height={36} fill="#a5d8ff" stroke="#1971c2" /></g> },
  { name: 'USB stick', len: 0, draw: (l) => <g><rect x={0} y={-14} width={l * PXMM * 0.75} height={28} rx={6} fill="#495057" /><rect x={l * PXMM * 0.75} y={-9} width={l * PXMM * 0.25} height={18} fill="#ced4da" stroke="#868e96" /></g> },
  { name: 'key', len: 0, draw: (l) => <g><circle cx={30} cy={0} r={28} fill="#fcc419" stroke="#e67700" /><circle cx={18} cy={0} r={8} fill="#fff" /><path d={`M58 -7 H${l * PXMM} V3 H${l * PXMM - 8} V9 H${l * PXMM - 16} V3 H${l * PXMM - 26} V9 H${l * PXMM - 34} V3 H58 Z`} fill="#fcc419" stroke="#e67700" /></g> },
];

function measureTask(d: Difficulty) {
  const part = randInt(0, PARTS.length - 1);
  const ranges: [number, number][] = [[18, 60], [40, 70], [45, 65], [50, 75]];
  const [lo, hi] = ranges[part];
  const len = d === 'hard' ? randInt(lo * 2, hi * 2) / 2 : randInt(lo, hi);
  const rot = d === 'easy' ? 0 : d === 'normal' ? pick([0, 0, 15, -20, 30]) : randInt(-60, 60);
  return { part, len, rot };
}

function RulerLesson() {
  const { difficulty, pxPerMm } = useSettings();
  const [task, setTask] = useState(() => measureTask(difficulty));
  const h = useHistory<RulerState>({ o: { x: 120, y: 330 }, rot: 0 });
  const [calib, setCalib] = useState(pxPerMm ?? 3.78);
  const part = PARTS[task.part];
  const center = { x: 400, y: 150 };
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 460`}>
      <GridLines x0={0} y0={0} w={W} h={460} step={30} color="#f1f3f5" />
      <g transform={`translate(${center.x - (task.len * PXMM) / 2} ${center.y}) rotate(${-task.rot} ${(task.len * PXMM) / 2} 0)`}>{part.draw(task.len)}</g>
      <VirtualRuler s={h.value} onChange={h.set} onStart={h.checkpoint} />
      <text x={20} y={30} className="svg-label" fill="#495057">Measuring table — on this drawing 1 mm = {PXMM} px</text>
    </svg>
  );
  const controls = (
    <>
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()}>
        <button className="btn" onClick={() => setTask(measureTask(difficulty))}>🎲 New part to measure</button>
        <button className="btn" onClick={() => h.commit({ o: { x: 120, y: 330 }, rot: 0 })}>Put the ruler down flat</button>
      </ToolBar>
      <span className="muted small">Drag the ruler. Turn it with the ⟳ knob. Line up 0 with one end of the part.</span>
    </>
  );
  const measure = (
    <NumberQuiz
      key={`${task.part}-${task.len}-${task.rot}`}
      question={`How long is the ${part.name}? (to the nearest ${difficulty === 'hard' ? '0.5' : '1'} mm)`}
      answer={task.len}
      tolerance={difficulty === 'hard' ? 0.5 : 1}
      unit="mm"
      hint="Put the 0 mark exactly on one end. Count the big numbers (centimetres), then the small marks (millimetres)."
      diagnose={(x) => (Math.abs(x - task.len / 10) < 0.2 ? 'You gave centimetres. Each big number is 10 mm.' : Math.abs(x - task.len - 4) <= 1 || Math.abs(x - task.len + 4) <= 1 ? 'Check where your 0 sits — the ruler has a small blank edge before the 0 mark.' : null)}
      solution={<>The {part.name} is <b>{task.len} mm</b> = {fmt(task.len / 10, 2)} cm.</>}
    />
  );
  const cardPx = 85.6 * calib;
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A small product part lies on the measuring table, with a yellow <T k="ruler" /> below it.</p>,
    touch: <p>Drag the ruler onto the part. Use the ⟳ knob to turn it when the part is tilted.</p>,
    experiment: (
      <ul>
        <li>Line up the <b>0 mark</b>, not the end of the plastic.</li>
        <li>Try measuring from 1 cm instead of 0 — then subtract 10 mm.</li>
        <li>Press 🎲 for another part.</li>
      </ul>
    ),
    discover: measure,
    understand: (
      <>
        <p>Accurate measuring: 0 on one end, ruler <b>parallel</b> to the edge, eye straight above the mark.</p>
        <p>Big numbers are centimetres; each small mark is 1 millimetre.</p>
        <Note kind="approx">Screens are different sizes, so “1 cm” on screen is rarely a real centimetre — unless you calibrate (next stage).</Note>
      </>
    ),
    calculate: (
      <>
        <p><b>Screen calibration.</b> Hold a bank card (85.6 mm wide) against your screen and drag the slider until the blue card matches it exactly.</p>
        <svg viewBox={`0 0 ${Math.max(360, cardPx + 20)} ${53.98 * calib + 20}`} style={{ width: cardPx + 20, maxWidth: '100%', height: 'auto' }}>
          <rect x={10} y={10} width={cardPx} height={53.98 * calib} rx={3.18 * calib} fill="#4dabf7" stroke="#1864ab" />
          <text x={20} y={34} fill="#fff" fontWeight={700} fontSize={14}>85.6 × 54 mm card</text>
        </svg>
        <Slider label="Card size on screen" value={calib} min={2} max={7} step={0.01} onChange={setCalib} format={(v) => `${fmt(v, 2)} px per mm`} />
        <button className="btn primary" onClick={() => updateSettings({ pxPerMm: calib })}>Save calibration</button>
        {pxPerMm && <Note>Calibrated: {fmt(pxPerMm, 2)} screen px = 1 mm. Sketch-to-Math will now show real millimetres.</Note>}
        <Formula parts={[{ s: 'k', means: 'pixels per millimetre on your screen', color: '#1971c2' }, ' = card width in pixels ÷ 85.6']} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>A phone case designer measures the phone to a fraction of a millimetre — 1 mm too small and the case will not fit.</li>
          <li>Measure twice, cut once. Write every dimension down with its unit.</li>
        </ul>
        {measure}
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['Part', part.name],
      ['Drawing scale', `1 mm = ${PXMM} px`],
      ['Part tilted by', `${task.rot}°`],
      ['Ruler angle', `${fmt(h.value.rot, 1)}°`],
      ['Your screen', pxPerMm ? `${fmt(pxPerMm, 2)} px per real mm (calibrated)` : 'not calibrated'],
    ]} />
  );
  return <Lesson id="l5-ruler" title="Virtual ruler & screen calibration" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Scale drawings                                                      */
/* ================================================================== */

const SCALES: { label: string; k: number }[] = [
  { label: '1:50', k: 1 / 50 }, { label: '1:20', k: 1 / 20 }, { label: '1:10', k: 1 / 10 }, { label: '1:5', k: 1 / 5 }, { label: '1:2', k: 1 / 2 },
  { label: '1:1', k: 1 }, { label: '2:1', k: 2 }, { label: '5:1', k: 5 }, { label: '10:1', k: 10 },
];

const REAL: { label: string; w: number; h: number; shape: 'rect' | 'circle' }[] = [
  { label: '🪑 table top', w: 1200, h: 750, shape: 'rect' },
  { label: '📱 phone', w: 150, h: 72, shape: 'rect' },
  { label: '🚗 car (top view)', w: 4500, h: 1800, shape: 'rect' },
  { label: '💍 ring', w: 20, h: 20, shape: 'circle' },
  { label: '⚙️ watch gear', w: 8, h: 8, shape: 'circle' },
  { label: '📷 camera', w: 130, h: 90, shape: 'rect' },
];

function ScaleLesson() {
  const [obj, setObj] = useState(0);
  const [si, setSi] = useState(2);
  const o = REAL[obj];
  const s = SCALES[si];
  const dw = o.w * s.k;
  const dh = o.h * s.k;
  const P = 1.45; // screen px per paper mm
  const paper = { x: 60, y: 30, w: 297, h: 210 };
  const fits = dw <= paper.w - 20 && dh <= paper.h - 20;
  const best = [...SCALES].reverse().find((x) => o.w * x.k <= paper.w - 20 && o.h * x.k <= paper.h - 20);
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 380`}>
      <rect x={paper.x} y={paper.y} width={paper.w * P} height={paper.h * P} fill="#fff" stroke="#adb5bd" />
      <text x={paper.x + 6} y={paper.y + 16} fontSize={11} fill="#868e96">A4 paper 297 × 210 mm</text>
      <clipPath id="paperclip"><rect x={paper.x} y={paper.y} width={paper.w * P} height={paper.h * P} /></clipPath>
      <g clipPath="url(#paperclip)">
        {o.shape === 'rect' ? (
          <rect x={paper.x + 10 * P} y={paper.y + 24 * P} width={dw * P} height={dh * P} fill={fits ? '#d0ebff' : '#ffe3e3'} stroke={fits ? '#1971c2' : '#e5484d'} strokeWidth={2} />
        ) : (
          <circle cx={paper.x + 10 * P + (dw * P) / 2} cy={paper.y + 24 * P + (dh * P) / 2} r={(dw * P) / 2} fill={fits ? '#d0ebff' : '#ffe3e3'} stroke={fits ? '#1971c2' : '#e5484d'} strokeWidth={2} />
        )}
      </g>
      {fits && <DimLine a={{ x: paper.x + 10 * P, y: paper.y + 24 * P }} b={{ x: paper.x + 10 * P + dw * P, y: paper.y + 24 * P }} offset={-12} label={`${fmt(dw, 1)} mm on paper`} />}
      <rect x={paper.x + paper.w * P - 120} y={paper.y + paper.h * P - 40} width={120} height={40} fill="#f8f9fa" stroke="#868e96" />
      <text x={paper.x + paper.w * P - 112} y={paper.y + paper.h * P - 24} fontSize={11} fill="#495057">SCALE {s.label}</text>
      <text x={paper.x + paper.w * P - 112} y={paper.y + paper.h * P - 9} fontSize={10} fill="#868e96">dimensions in mm</text>
      <text x={paper.x + paper.w * P + 20} y={60} className="svg-label" fill="#1f2a44">Real: {o.w} × {o.h} mm</text>
      <text x={paper.x + paper.w * P + 20} y={86} className="svg-label" fill="#1971c2">Drawn: {fmt(dw, 1)} × {fmt(dh, 1)} mm</text>
      <text x={paper.x + paper.w * P + 20} y={112} className="svg-label" fill={fits ? '#2b8a3e' : '#e5484d'}>{fits ? '✔ fits on A4' : '✘ too big for A4'}</text>
    </svg>
  );
  const controls = (
    <>
      <div className="row">{REAL.map((r, i) => <button key={r.label} className={`btn small${i === obj ? ' active' : ''}`} onClick={() => setObj(i)}>{r.label}</button>)}</div>
      <Segmented small value={si} onChange={setSi} options={SCALES.map((x, i) => ({ value: i, label: x.label }))} />
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A sheet of A4 paper with a drawing on it. The box in the corner says the <T k="scale" />.</p>,
    touch: <p>Pick a real object, then pick a scale. Watch the drawing shrink or grow.</p>,
    experiment: (
      <ul>
        <li>Draw the table at 1:1. Does it fit? Try 1:10.</li>
        <li>Draw the watch gear at 1:1 — tiny! Try 10:1.</li>
        <li>Find the biggest scale where the car still fits.</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz question="At scale 1:10, a real length of 500 mm is drawn as…" options={[{ label: '50 mm', correct: true, why: '1:10 means every 10 mm of the real object becomes 1 mm on paper. 500 ÷ 10 = 50.' }, { label: '5000 mm', why: 'That would be 10:1 — an enlargement.' }, { label: '510 mm', why: 'Scales multiply or divide; they never add.' }]} />
    ),
    understand: (
      <>
        <p>A scale <b>1 : N</b> means 1 mm on paper stands for N mm in real life (a reduction).</p>
        <p><b>N : 1</b> means the drawing is N times bigger than the real thing (an enlargement, for tiny parts).</p>
        <p>The numbers written on the drawing are always the <b>real</b> sizes.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'drawn', means: 'length on paper', color: '#1971c2' }, ' = ', { s: 'real', means: 'real length', color: '#1f2a44' }, ' ÷ ', { s: 'N', means: 'the second number of a 1 : N scale', color: '#c2255c' }]} />
        <NumberQuiz question="A 1200 mm table drawn at 1:20 — how long is the line on paper?" answer={60} unit="mm" hint="1:20 means divide by 20."
          diagnose={(x) => (x === 24000 ? 'You multiplied. 1:20 makes it smaller, so divide.' : null)}
          solution={<Steps steps={['1200 ÷ 20', '= 60 mm']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Pick the biggest standard scale that fits the paper: here that is <b>{best?.label ?? 'none'}</b> for the {o.label.slice(3)}.</li>
          <li>Standard scales (1:2, 1:5, 1:10…) make it easy to measure a printed drawing with an ordinary ruler.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['Real size', `${o.w} × ${o.h} mm`],
      ['Scale', `${s.label} → × ${fmt(s.k, 4)}`],
      ['Drawn width', `${o.w} × ${fmt(s.k, 4)} = ${fmt(dw, 2)} mm`],
      ['Drawn height', `${o.h} × ${fmt(s.k, 4)} = ${fmt(dh, 2)} mm`],
      ['Fits A4 (with margins)?', fits ? 'yes' : 'no'],
      ['Best standard scale', best?.label ?? '—'],
    ]} />
  );
  return <Lesson id="l5-scale" title="Scale drawings" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Challenge: draw a smartphone                                        */
/* ================================================================== */

interface PhoneSpec {
  w: number;
  h: number;
  r?: number;
  border?: number;
  cam?: { x: number; y: number; d: number };
}

interface PhoneDraw {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  r: number;
  border: number;
  cam: { x: number; y: number; d: number };
}

function phoneSpec(d: Difficulty): PhoneSpec {
  const w = pick([68, 70, 72, 75, 78]);
  const h = pick([140, 146, 150, 155, 160]);
  if (d === 'easy') return { w, h };
  const r = pick([6, 8, 10]);
  const border = pick([3, 4, 5]);
  if (d === 'normal') return { w, h, r, border };
  return { w, h, r, border, cam: { x: randInt(10, 16), y: randInt(10, 16), d: pick([8, 10, 12]) } };
}

const PH = 2.4; // px per mm
const O = { x: 60, y: 30 };

function PhoneChallenge() {
  const { difficulty } = useSettings();
  const [spec, setSpec] = useState(() => phoneSpec(difficulty));
  const h = useHistory<PhoneDraw>({ x0: 10, y0: 10, x1: 70, y1: 140, r: 4, border: 2, cam: { x: 20, y: 20, d: 6 } });
  const d = h.value;
  const [bad, setBad] = useState<Set<string>>(new Set());
  const step = difficulty === 'hard' ? 0.5 : 1;
  const W_ = d.x1 - d.x0;
  const H_ = d.y1 - d.y0;
  const X = (mm: number) => O.x + mm * PH;
  const Y = (mm: number) => O.y + mm * PH;
  const toMm = (p: Vec) => ({ x: snap((p.x - O.x) / PH, step), y: snap((p.y - O.y) / PH, step) });
  const corner = (kx: 'x0' | 'x1', ky: 'y0' | 'y1') => (p: Vec) => {
    const m = toMm(p);
    h.set((s) => ({ ...s, [kx]: clamp(m.x, 0, 280), [ky]: clamp(m.y, 0, 175) }));
  };
  const camC = { x: d.x0 + d.cam.x, y: d.y0 + d.cam.y };
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 485`}>
      <GridLines x0={O.x} y0={O.y} w={280 * PH} h={175 * PH} step={PH * 5} major={2} color="#f1f3f5" majorColor="#dee2e6" />
      <rect x={X(d.x0)} y={Y(d.y0)} width={W_ * PH} height={H_ * PH} rx={d.r * PH} fill="#343a40" stroke={bad.has('w') || bad.has('h') || bad.has('r') ? '#e5484d' : '#1f2a44'} strokeWidth={3} />
      {spec.border !== undefined && (
        <rect x={X(d.x0 + d.border)} y={Y(d.y0 + d.border)} width={Math.max(0, W_ - 2 * d.border) * PH} height={Math.max(0, H_ - 2 * d.border) * PH} rx={Math.max(0, d.r - d.border) * PH} fill="#4dabf7" stroke={bad.has('border') ? '#e5484d' : 'none'} strokeWidth={3} />
      )}
      {spec.cam && <circle cx={X(camC.x)} cy={Y(camC.y)} r={(d.cam.d / 2) * PH} fill="#212529" stroke={bad.has('cam') ? '#e5484d' : '#adb5bd'} strokeWidth={2} />}
      <DimLine a={{ x: X(d.x0), y: Y(d.y0) }} b={{ x: X(d.x1), y: Y(d.y0) }} offset={-16} label={`${fmt(W_, 1)}`} error={bad.has('w')} />
      <DimLine a={{ x: X(d.x1), y: Y(d.y0) }} b={{ x: X(d.x1), y: Y(d.y1) }} offset={-16} label={`${fmt(H_, 1)}`} error={bad.has('h')} />
      {spec.cam && (
        <>
          <DimLine a={{ x: X(d.x0), y: Y(camC.y) }} b={{ x: X(camC.x), y: Y(camC.y) }} offset={0} label={`${fmt(d.cam.x, 1)}`} color="#868e96" error={bad.has('cam')} />
          <DimLine a={{ x: X(camC.x), y: Y(d.y0) }} b={{ x: X(camC.x), y: Y(camC.y) }} offset={0} label={`${fmt(d.cam.y, 1)}`} color="#868e96" error={bad.has('cam')} />
        </>
      )}
      <Handle x={X(d.x0)} y={Y(d.y0)} onStart={h.checkpoint} onDrag={corner('x0', 'y0')} step={PH * step} />
      <Handle x={X(d.x1)} y={Y(d.y0)} onStart={h.checkpoint} onDrag={corner('x1', 'y0')} step={PH * step} />
      <Handle x={X(d.x0)} y={Y(d.y1)} onStart={h.checkpoint} onDrag={corner('x0', 'y1')} step={PH * step} />
      <Handle x={X(d.x1)} y={Y(d.y1)} onStart={h.checkpoint} onDrag={corner('x1', 'y1')} step={PH * step} />
      {spec.cam && <Handle x={X(camC.x)} y={Y(camC.y)} r={6} color="#adb5bd" onStart={h.checkpoint} title="move the camera" step={PH * step}
        onDrag={(p) => { const m = toMm(p); h.set((s) => ({ ...s, cam: { ...s.cam, x: m.x - s.x0, y: m.y - s.y0 } })); }} />}
      <text x={O.x + 280 * PH} y={O.y + 175 * PH + 22} textAnchor="end" fontSize={11} fill="#868e96">grid: small square = 5 mm · all dimensions in mm</text>
    </svg>
  );
  const items: { key: string; label: string; want: number; have: number }[] = [
    { key: 'w', label: 'Width', want: spec.w, have: W_ },
    { key: 'h', label: 'Height', want: spec.h, have: H_ },
    ...(spec.r !== undefined ? [{ key: 'r', label: 'Corner radius', want: spec.r, have: d.r }] : []),
    ...(spec.border !== undefined ? [{ key: 'border', label: 'Screen border', want: spec.border, have: d.border }] : []),
    ...(spec.cam ? [{ key: 'cam', label: 'Camera Ø', want: spec.cam.d, have: d.cam.d }, { key: 'cam', label: 'Camera from left', want: spec.cam.x, have: d.cam.x }, { key: 'cam', label: 'Camera from top', want: spec.cam.y, have: d.cam.y }] : []),
  ];
  const tol = difficulty === 'hard' ? 0.25 : 0.5;
  const check = (): CheckResult => {
    const wrong = items.filter((i) => Math.abs(i.have - i.want) > tol);
    setBad(new Set(wrong.map((i) => i.key)));
    if (!wrong.length) return { ok: true, happened: 'Every dimension matches the drawing.', why: 'A case maker could now build a case from your drawing.' };
    const swapped = Math.abs(W_ - spec.h) <= tol && Math.abs(H_ - spec.w) <= tol;
    return {
      ok: false,
      happened: (
        <ul className="checklist">
          {items.map((i, k) => (
            <li key={k}><span className={Math.abs(i.have - i.want) <= tol ? 'ok' : 'no'}>{Math.abs(i.have - i.want) <= tol ? '✓' : '✗'}</span> {i.label}: yours {fmt(i.have, 1)} mm, needed {i.want} mm</li>
          ))}
        </ul>
      ),
      why: swapped ? 'Width and height are swapped — the phone is lying on its side. Width is across, height is up.' : 'The red dimension lines show which sizes are off. Even 1 mm matters: a case would not fit.',
    };
  };
  const panel = (
    <Challenge
      id="l5-phone"
      title="Draw a smartphone to size"
      brief={
        <>
          <p>Draw the phone body exactly <span className="target">{spec.w} × {spec.h} mm</span>.</p>
          {spec.r !== undefined && <p>Corner radius <span className="target">{spec.r} mm</span>, screen border <span className="target">{spec.border} mm</span> all round.</p>}
          {spec.cam && <p>Camera hole Ø <span className="target">{spec.cam.d} mm</span>, its centre <span className="target">{spec.cam.x} mm</span> from the left edge and <span className="target">{spec.cam.y} mm</span> from the top.</p>}
          <Note>Why so exact? Cases, screen protectors and holders are made from these numbers. Factories work to tolerances of about ±0.1 mm.</Note>
        </>
      }
      check={check}
      onResult={(r) => { if (!r || r.ok) setBad(new Set()); }}
      onNewTarget={() => setSpec(phoneSpec(difficulty))}
      hint="Each small grid square is 5 mm. Count squares for the big sizes, then fine-tune with the dimension labels."
      solution={<Steps steps={[`Drag corners until the dimension labels read ${spec.w} and ${spec.h}.`, ...(spec.r !== undefined ? [`Set radius ${spec.r} and border ${spec.border} with the sliders.`] : []), ...(spec.cam ? [`Set the camera size to ${spec.cam.d}, drag its centre to ${spec.cam.x} / ${spec.cam.y}.`] : [])]} />}
    >
      {spec.r !== undefined && <Slider label="Corner radius" value={d.r} min={0} max={20} step={step} unit="mm" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, r: x }))} />}
      {spec.border !== undefined && <Slider label="Screen border" value={d.border} min={0} max={12} step={step} unit="mm" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, border: x }))} />}
      {spec.cam && <Slider label="Camera diameter" value={d.cam.d} min={2} max={20} step={step} unit="mm" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, cam: { ...s.cam, d: x } }))} />}
    </Challenge>
  );
  return <Workbench title="Challenge: draw a smartphone to size" tool={tool} controls={<ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />} panel={panel} />;
}

export default {
  'l5-units': UnitsLesson,
  'l5-ruler': RulerLesson,
  'l5-scale': ScaleLesson,
  'l5-phone': PhoneChallenge,
};

