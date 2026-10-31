import { useState, type ReactNode } from 'react';
import { clamp, fmt, polar, randInt } from '../../../core/geometry';
import { useHistory } from '../../../core/history';
import { useSettings, type Difficulty } from '../../../core/store';
import { Challenge, ChoiceQuiz, NumberQuiz, type CheckResult } from '../../../ui/feedback';
import { DesignLink, Formula, Note, NumberTable, Slider, Stepper, Steps, T, Toggle, ToolBar } from '../../../ui/kit';
import { Lesson, Workbench, type StageKey } from '../../../ui/lesson';
import { DimLine, GridLines } from '../../../ui/svg';

const W = 800;

/* ================================================================== */
/* Variables are sliders                                               */
/* ================================================================== */

function VarBox({ name, value, color, hidden }: { name: string; value: number; color: string; hidden: boolean }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', margin: '0 4px' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{name}</span>
      <span style={{ border: `2.5px solid ${color}`, borderRadius: 8, padding: '2px 10px', minWidth: 40, textAlign: 'center', fontWeight: 800, fontSize: 20, background: '#fff' }}>{hidden ? '?' : fmt(value, 1)}</span>
    </span>
  );
}

const EXPRS: { id: string; label: string; text: string; f: (w: number, h: number) => number; unit: string; sub: (w: number, h: number) => string }[] = [
  { id: 'area', label: 'Glass panel area', text: 'A = w × h', f: (w, h) => w * h, unit: 'cm²', sub: (w, h) => `${fmt(w, 1)} × ${fmt(h, 1)}` },
  { id: 'trim', label: 'Edge trim length (perimeter)', text: 'P = 2w + 2h', f: (w, h) => 2 * w + 2 * h, unit: 'cm', sub: (w, h) => `2 × ${fmt(w, 1)} + 2 × ${fmt(h, 1)}` },
  { id: 'diag', label: 'Screen diagonal', text: 'd = √(w² + h²)', f: (w, h) => Math.hypot(w, h), unit: 'cm', sub: (w, h) => `√(${fmt(w, 1)}² + ${fmt(h, 1)}²)` },
  { id: 'frame', label: 'Frame area with a 1 cm border', text: 'F = (w + 2)(h + 2) − w × h', f: (w, h) => (w + 2) * (h + 2) - w * h, unit: 'cm²', sub: (w, h) => `(${fmt(w, 1)} + 2)(${fmt(h, 1)} + 2) − ${fmt(w, 1)} × ${fmt(h, 1)}` },
];

function VariablesLesson() {
  const h = useHistory({ w: 6, h: 4 });
  const { w, h: hh } = h.value;
  const [hide, setHide] = useState(false);
  const U = 34;
  const ox = 60;
  const oy = 40;
  const tool = (
    <div>
      <svg className="tool" viewBox={`0 0 ${W} 400`}>
        <GridLines x0={ox} y0={oy} w={12 * U} h={9 * U} step={U} />
        <rect x={ox} y={oy} width={w * U} height={hh * U} fill="#e7f5ff" stroke="#1971c2" strokeWidth={3} />
        <DimLine a={{ x: ox, y: oy }} b={{ x: ox + w * U, y: oy }} offset={-14} label={hide ? 'w' : `w = ${fmt(w, 1)}`} color="#1c7ed6" />
        <DimLine a={{ x: ox, y: oy + hh * U }} b={{ x: ox, y: oy }} offset={-14} label={hide ? 'h' : `h = ${fmt(hh, 1)}`} color="#c2255c" />
        <text x={ox + (w * U) / 2} y={oy + (hh * U) / 2} textAnchor="middle" dominantBaseline="middle" className="svg-label big" fill="#1971c2">{hide ? 'A = w × h' : `A = ${fmt(w * hh, 1)}`}</text>
        <g transform="translate(520 60)">
          <text x={0} y={0} className="svg-label" fill="#495057">Area for every width (h = {hide ? 'h' : fmt(hh, 1)})</text>
          {Array.from({ length: 10 }, (_, i) => {
            const ww = i + 1;
            return (
              <g key={i} transform={`translate(0 ${18 + i * 28})`}>
                <rect x={0} y={0} width={(ww * hh * 220) / 120} height={20} rx={3} fill={ww === Math.round(w) ? '#1971c2' : '#a5d8ff'} />
                <text x={(ww * hh * 220) / 120 + 6} y={15} fontSize={12} fill="#495057">w={ww} → {hide ? '?' : fmt(ww * hh, 1)}</text>
              </g>
            );
          })}
        </g>
      </svg>
      <div style={{ padding: '6px 16px 14px', display: 'flex', alignItems: 'flex-end', gap: 6, flexWrap: 'wrap', fontSize: 20 }}>
        <VarBox name="w" value={w} color="#1c7ed6" hidden={hide} /> <span>×</span> <VarBox name="h" value={hh} color="#c2255c" hidden={hide} /> <span>=</span> <VarBox name="A" value={w * hh} color="#1971c2" hidden={hide} />
      </div>
    </div>
  );
  const controls = (
    <>
      <Slider label={<>width <b>w</b></>} value={w} min={1} max={12} step={0.5} unit="cm" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, w: x }))} color="#1c7ed6" />
      <Slider label={<>height <b>h</b></>} value={hh} min={1} max={9} step={0.5} unit="cm" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, h: x }))} color="#c2255c" />
      <Toggle label="Hide the numbers (letters only)" checked={hide} onChange={setHide} />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
      <table className="numtable">
        <tbody>
          {EXPRS.map((e) => (
            <tr key={e.id}>
              <th>{e.label}<br /><span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{e.text}</span></th>
              <td>{hide ? '—' : <>{e.sub(w, hh)} = {fmt(e.f(w, hh), 2)} {e.unit}</>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A rectangle whose sides are called <b>w</b> and <b>h</b>. The letters are just <b>names of boxes</b> that hold numbers.</p>,
    touch: <p>Move the <b>w</b> and <b>h</b> sliders. Every number on the page updates at once.</p>,
    experiment: (
      <ul>
        <li>Double w. What happens to A?</li>
        <li>Double both w and h.</li>
        <li>Turn on <b>Hide the numbers</b>: the rules still make sense with letters only.</li>
      </ul>
    ),
    discover: (
      <>
        <ChoiceQuiz question="If w doubles and h stays the same, the area…" options={[{ label: 'doubles', correct: true, why: 'A = w × h. Twice the w, twice the A. Check the bar chart: it grows in equal steps.' }, { label: 'stays the same', why: 'Try it: w from 3 to 6 changes A from 12 to 24 (with h = 4).' }, { label: 'becomes 4 times bigger', why: 'That happens when BOTH sides double.' }]} />
        <ChoiceQuiz question="If both w and h double, the area…" options={[{ label: 'doubles', why: 'Each doubling doubles the area: 2 × 2 = 4 times.' }, { label: 'becomes 4 times bigger', correct: true, why: 'Twice as wide AND twice as tall → 4 copies of the original fit inside.' }]} />
      </>
    ),
    understand: (
      <>
        <p>A <T k="variable" /> is a letter that stands for a number you can change — like a slider.</p>
        <p>An <T k="expression" /> such as <b>2w + 2h</b> is a recipe: “take w twice and h twice, add them up”.</p>
        <p><b>2w</b> means 2 × w. Algebra leaves out the × sign between a number and a letter.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'P', means: 'perimeter', color: '#f08c00' }, ' = 2', { s: 'w', means: 'width — whatever the slider says', color: '#1c7ed6' }, ' + 2', { s: 'h', means: 'height', color: '#c2255c' }]} caption="Substitute: replace each letter by its current number, then calculate." />
        <NumberQuiz question="A tablet is w = 24 cm, h = 16 cm. Edge trim P = 2w + 2h. How long is the trim?" answer={80} unit="cm" hint="2 × 24, then 2 × 16, then add."
          diagnose={(x) => (x === 40 ? 'You found w + h. The formula takes each side twice.' : x === 384 ? 'That is w × h (area). Perimeter adds.' : null)}
          solution={<Steps steps={['P = 2 × 24 + 2 × 16', '= 48 + 32', '= 80 cm']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>CAD programs are <b>parametric</b>: you name sizes (w, h, wall) and write rules. Change w, and the whole model updates — exactly like this page.</li>
          <li>One design, many sizes: a phone case family for every phone model.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={EXPRS.map((e) => [e.text, `${e.sub(w, hh)} = ${fmt(e.f(w, hh), 2)} ${e.unit}`] as [ReactNode, ReactNode])} />
  );
  return <Lesson id="l6-variables" title="Variables are sliders" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Patterns become expressions: socket strip                           */
/* ================================================================== */

function PatternsLesson() {
  const h = useHistory({ n: 3, p: 40, e: 25 });
  const { n, p, e } = h.value;
  const [reveal, setReveal] = useState(false);
  const L = 2 * e + n * p;
  const S = 0.9;
  const ox = 40;
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 420`}>
      <g transform="translate(0 30)">
        <rect x={ox} y={20} width={L * S} height={70} rx={12} fill="#f8f9fa" stroke="#495057" strokeWidth={2.5} />
        {Array.from({ length: n }, (_, i) => {
          const cx = ox + (e + p * i + p / 2) * S;
          return (
            <g key={i}>
              <rect x={cx - 15} y={34} width={30} height={42} rx={6} fill="#fff" stroke="#868e96" />
              <circle cx={cx - 6} cy={50} r={3} fill="#495057" />
              <circle cx={cx + 6} cy={50} r={3} fill="#495057" />
              <circle cx={cx} cy={64} r={3} fill="#495057" />
            </g>
          );
        })}
        <DimLine a={{ x: ox, y: 90 }} b={{ x: ox + e * S, y: 90 }} offset={22} label={`e`} color="#c2255c" />
        {n > 0 && <DimLine a={{ x: ox + e * S, y: 90 }} b={{ x: ox + (e + p) * S, y: 90 }} offset={22} label="p" color="#1c7ed6" />}
        <DimLine a={{ x: ox + (L - e) * S, y: 90 }} b={{ x: ox + L * S, y: 90 }} offset={22} label="e" color="#c2255c" />
        <DimLine a={{ x: ox, y: 20 }} b={{ x: ox + L * S, y: 20 }} offset={-16} label={`L = ${L} mm`} color="#1f2a44" />
      </g>
      <g transform="translate(40 200)">
        <text x={0} y={0} className="svg-label" fill="#495057">Length for each number of sockets</text>
        {Array.from({ length: 8 }, (_, i) => {
          const k = i + 1;
          const Lk = 2 * e + k * p;
          const x = 30 + i * 88;
          const y = 190 - (Lk / 450) * 170;
          return (
            <g key={k}>
              <circle cx={x} cy={y} r={k === n ? 8 : 5} fill={k === n ? '#e8590c' : '#1971c2'} />
              <text x={x} y={y - 12} fontSize={11} textAnchor="middle" fill="#495057">{Lk}</text>
              <text x={x} y={210} fontSize={11} textAnchor="middle" fill="#495057">n={k}</text>
              {i > 0 && <text x={x - 44} y={(y + 190 - ((2 * e + (k - 1) * p) / 450) * 170) / 2 + 18} fontSize={10} textAnchor="middle" fill="#2b8a3e">+{p}</text>}
            </g>
          );
        })}
        <line x1={30} y1={190 - ((2 * e + p) / 450) * 170} x2={30 + 7 * 88} y2={190 - ((2 * e + 8 * p) / 450) * 170} stroke="#1971c2" strokeDasharray="5 5" />
      </g>
    </svg>
  );
  const controls = (
    <>
      <Stepper label="Sockets n" value={n} min={1} max={8} onChange={(x) => h.commit((s) => ({ ...s, n: x }))} />
      <Slider label="Socket pitch p (centre to centre)" value={p} min={30} max={50} unit="mm" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, p: x }))} color="#1c7ed6" />
      <Slider label="End space e" value={e} min={10} max={40} unit="mm" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, e: x }))} color="#c2255c" />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>An extension board. Each socket takes the same space <b>p</b>, and there is extra space <b>e</b> at each end. The dots below show the board length for 1 to 8 sockets.</p>,
    touch: <p>Add and remove sockets with + and −. Change p and e with the sliders.</p>,
    experiment: (
      <ul>
        <li>How much longer does the board get for each extra socket? (Look at the green numbers.)</li>
        <li>Change e. Does the step between dots change?</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz
        question={`With p = ${p} mm and e = ${e} mm, how long is a board with 10 sockets?`}
        options={[
          { label: `${2 * e + 10 * p} mm`, correct: true, why: `Two end spaces plus ten socket spaces: 2 × ${e} + 10 × ${p}.` },
          { label: `${10 * p} mm`, why: 'You forgot the space at the two ends.' },
          { label: `${e + 10 * p} mm`, why: 'There is end space at BOTH ends.' },
        ]}
        hint="Look at the pattern: start value, then the same jump each time."
      />
    ),
    understand: (
      <>
        <p>A pattern that grows by the <b>same amount</b> each time is a straight-line pattern (the dots line up).</p>
        <p>Write the pattern once with letters, and it works for every n.</p>
        {!reveal && <button className="btn" onClick={() => setReveal(true)}>Show the rule</button>}
        {reveal && <p className="big-eq">L = 2e + n × p</p>}
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'L', means: 'board length (mm)', color: '#1f2a44' }, ' = 2', { s: 'e', means: 'end space (mm)', color: '#c2255c' }, ' + ', { s: 'n', means: 'number of sockets', color: '#e8590c' }, { s: 'p', means: 'pitch — space per socket (mm)', color: '#1c7ed6' }]} />
        <NumberQuiz question="Pitch 45 mm, end space 20 mm, 6 sockets. Board length?" answer={310} unit="mm" hint="2 × 20 + 6 × 45."
          diagnose={(x) => (x === 290 ? 'Only one end space counted — there are two.' : x === 270 ? 'Add the end spaces: 2 × 20.' : null)}
          solution={<Steps steps={['2 × 20 = 40', '6 × 45 = 270', '40 + 270 = 310 mm']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Keyboards, shelves, bike racks, drawer handles: length = ends + n × pitch.</li>
          <li>Reverse it: “the board must be 300 mm — how many sockets fit?” That is solving an equation (next topic).</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['n sockets', `${n}`],
      ['Rule', 'L = 2e + n × p'],
      ['Substitute', `2 × ${e} + ${n} × ${p}`],
      ['L', `${2 * e} + ${n * p} = ${L} mm`],
      ['Each extra socket adds', `${p} mm`],
    ]} />
  );
  return <Lesson id="l6-patterns" title="Patterns become expressions" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Balance scale                                                       */
/* ================================================================== */

export interface Eq {
  a: number; // x bags on the left
  b: number; // units on the left
  c: number; // x bags on the right
  d: number; // units on the right
}

export function eqText(q: Eq) {
  const side = (k: number, u: number) => {
    const parts: string[] = [];
    if (k) parts.push(k === 1 ? 'x' : `${k}x`);
    if (u || !k) parts.push(String(u));
    return parts.join(' + ');
  };
  return `${side(q.a, q.b)} = ${side(q.c, q.d)}`;
}

export function makeEquation(d: Difficulty): { q: Eq; x: number } {
  const x = randInt(2, 9);
  if (d === 'easy') {
    const b = randInt(1, 9);
    return { q: { a: 1, b, c: 0, d: x + b }, x };
  }
  if (d === 'normal') {
    const a = randInt(2, 4);
    const b = randInt(1, 8);
    return { q: { a, b, c: 0, d: a * x + b }, x };
  }
  const a = randInt(3, 5);
  const c = randInt(1, a - 1);
  const b = randInt(1, 6);
  return { q: { a, b, c, d: (a - c) * x + b }, x };
}

function checkText(q: Eq, x: number) {
  const side = (k: number, u: number) => `${k ? `${k} × ${x}${u ? ` + ${u}` : ''}` : u}`;
  return `${side(q.a, q.b)} = ${q.a * x + q.b} and ${side(q.c, q.d)} = ${q.c * x + q.d}`;
}

function Scale({ q, x, showX }: { q: Eq; x: number; showX?: boolean }) {
  const left = q.a * x + q.b;
  const right = q.c * x + q.d;
  const tilt = clamp((left - right) * 2.5, -16, 16);
  const pivot = { x: 400, y: 110 };
  const L = polar(pivot, 260, 180 + tilt);
  const R = polar(pivot, 260, tilt);
  const pan = (c: { x: number; y: number }, bags: number, units: number, key: string) => (
    <g key={key}>
      <line x1={c.x} y1={c.y} x2={c.x - 90} y2={c.y + 110} stroke="#868e96" />
      <line x1={c.x} y1={c.y} x2={c.x + 90} y2={c.y + 110} stroke="#868e96" />
      <path d={`M${c.x - 115} ${c.y + 110} Q${c.x} ${c.y + 150} ${c.x + 115} ${c.y + 110} Z`} fill="#dee2e6" stroke="#868e96" strokeWidth={2} />
      {Array.from({ length: bags }, (_, i) => {
        const bx = c.x - 100 + (i % 5) * 40;
        const by = c.y + 70 - Math.floor(i / 5) * 40;
        return (
          <g key={`b${i}`} transform={`translate(${bx} ${by})`}>
            <path d="M6 10 Q0 38 18 38 Q36 38 30 10 Z" fill="#9775fa" stroke="#5f3dc4" strokeWidth={1.5} />
            <path d="M8 10 L28 10 L24 4 L12 4 Z" fill="#7048e8" />
            <text x={18} y={30} textAnchor="middle" fill="#fff" fontWeight={800} fontSize={14} fontStyle="italic">x</text>
          </g>
        );
      })}
      {Array.from({ length: units }, (_, i) => {
        const ux = c.x - 100 + (bags ? 0 : 0) + ((i % 9) * 23);
        const uy = c.y + 92 - Math.floor(i / 9) * 22 - (bags ? 40 * Math.ceil(bags / 5) : 0);
        return (
          <g key={`u${i}`}>
            <rect x={ux} y={uy} width={20} height={20} rx={3} fill="#ffa94d" stroke="#d9480f" />
            <text x={ux + 10} y={uy + 15} textAnchor="middle" fontSize={11} fontWeight={700} fill="#7f3b08">1</text>
          </g>
        );
      })}
    </g>
  );
  return (
    <svg className="tool" viewBox={`0 0 ${W} 380`}>
      <polygon points={`${pivot.x - 40},360 ${pivot.x + 40},360 ${pivot.x},${pivot.y}`} fill="#495057" />
      <line x1={L.x} y1={L.y} x2={R.x} y2={R.y} stroke="#343a40" strokeWidth={10} strokeLinecap="round" />
      <circle cx={pivot.x} cy={pivot.y} r={9} fill="#ffd43b" />
      {pan(L, q.a, q.b, 'L')}
      {pan(R, q.c, q.d, 'R')}
      <text x={400} y={30} textAnchor="middle" className="svg-label big" fill={Math.abs(left - right) < 1e-9 ? '#2b8a3e' : '#e5484d'}>
        {eqText(q).replace('=', Math.abs(left - right) < 1e-9 ? '=' : '≠')}
      </text>
      {showX && <text x={400} y={56} textAnchor="middle" className="svg-label" fill="#7048e8">(each bag weighs x = {x})</text>}
    </svg>
  );
}

function BalanceTool({ start, x, allowOneSide = true, onSolved, guessX }: {
  start: Eq; x: number; allowOneSide?: boolean; onSolved?: () => void; guessX?: number | null;
}) {
  const h = useHistory<{ q: Eq; log: string[] }>({ q: start, log: [eqText(start)] });
  const [k, setK] = useState(2);
  const [oneSide, setOneSide] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { q } = h.value;
  const balanced = q.a * x + q.b === q.c * x + q.d;
  const solved = q.a === 1 && q.b === 0 && q.c === 0 && balanced;
  const apply = (label: string, f: (q: Eq) => Eq | string) => {
    const r = f(q);
    if (typeof r === 'string') {
      setMsg(r);
      return;
    }
    setMsg(null);
    h.commit((s) => ({ q: r, log: [...s.log, `${label} → ${eqText(r)}`] }));
    if (r.a === 1 && r.b === 0 && r.c === 0 && r.a * x + r.b === r.c * x + r.d) onSolved?.();
  };
  const both = !oneSide;
  return (
    <>
      <Scale q={q} x={guessX ?? x} showX={solved} />
      <div className="tool-controls">
        <div className="row">
          <button className="btn" onClick={() => apply(both ? '− 1 from both sides' : '− 1 from the left only', (s) => (s.b < 1 || (both && s.d < 1) ? 'There is no unit weight to take from both pans.' : { ...s, b: s.b - 1, d: both ? s.d - 1 : s.d }))}>− 1 unit</button>
          <button className="btn" onClick={() => apply(both ? `− ${Math.min(q.b, q.d)} from both sides` : `− ${q.b} from the left only`, (s) => {
            const m = both ? Math.min(s.b, s.d) : s.b;
            return m < 1 ? 'No unit weights to remove from both pans.' : { ...s, b: s.b - m, d: both ? s.d - m : s.d };
          })}>− all the units you can</button>
          <button className="btn" onClick={() => apply(both ? '− x from both sides' : '− x from the left only', (s) => (s.a < 1 || (both && s.c < 1) ? (both ? 'Both pans need an x bag to remove one from each.' : 'No x bag on the left.') : { ...s, a: s.a - 1, c: both ? s.c - 1 : s.c }))}>− 1 x bag</button>
          <Stepper label="split into" value={k} min={2} max={9} onChange={setK} />
          <button className="btn" onClick={() => apply(`÷ ${k} on both sides`, (s) => {
            if (!both) return 'Splitting only one side would just break the balance — try that with taking away instead.';
            if ([s.a, s.b, s.c, s.d].some((v) => v % k)) return `You cannot split ${eqText(s)} into ${k} equal groups — every bag and weight count must divide by ${k}.`;
            return { a: s.a / k, b: s.b / k, c: s.c / k, d: s.d / k };
          })}>÷ {k} groups</button>
        </div>
        <div className="row">
          {allowOneSide && <Toggle label="Change the LEFT pan only (experiment)" checked={oneSide} onChange={setOneSide} />}
          <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset({ q: start, log: [eqText(start)] })} />
        </div>
        {msg && <Note kind="info">{msg}</Note>}
        {!balanced && <Note kind="safety">The scale tipped: you changed one side only. An equation must stay balanced — undo and do the same to both sides.</Note>}
        {solved && <div className="praise">✅ x is alone: <b>x = {q.d}</b>. Check by putting it back: {checkText(start, q.d)} ✔</div>}
        <ol className="steps">{h.value.log.map((l, i) => <li key={i}>{l}</li>)}</ol>
      </div>
    </>
  );
}

function BalanceLesson() {
  const [eq, setEq] = useState(() => ({ q: { a: 3, b: 4, c: 0, d: 19 }, x: 5 }));
  const [round, setRound] = useState(0);
  const { difficulty } = useSettings();
  const tool = <BalanceTool key={round} start={eq.q} x={eq.x} />;
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A balance scale. Purple bags each hold the same <b>mystery weight x</b>. Orange blocks weigh 1. The scale is level, so both pans weigh the same: that is an <T k="equation" />.</p>,
    touch: <p>Press the buttons under the scale to remove weights. Watch the equation and the list of steps.</p>,
    experiment: (
      <ul>
        <li>Turn on <b>Change the LEFT pan only</b> and remove a unit. What happens?</li>
        <li>Undo. Now remove units from both sides until only bags are on the left.</li>
        <li>Split both sides into equal groups to find one bag.</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz
        question="What keeps the scale level?"
        options={[{ label: 'Doing the same thing to both pans', correct: true, why: 'Take 4 from both, or split both into 3 groups — the pans stay equal, so the equation stays true.' }, { label: 'Taking from the heavier pan only', why: 'Try it with the left-only switch: the scale tips the other way.' }]}
      />
    ),
    understand: (
      <>
        <p>To find x, get the bags <b>alone</b> on one side.</p>
        <p>Every step must be <b>reversible</b> and done to <b>both sides</b>: “− 4” undoes “+ 4”, “÷ 3” undoes “× 3”.</p>
        <p>Undo the operations in <b>reverse order</b>: first take away the loose units, then split the bags.</p>
      </>
    ),
    calculate: (
      <>
        <Steps steps={['3x + 4 = 19', '− 4 from both sides: 3x = 15', '÷ 3 on both sides: x = 5', 'Check: 3 × 5 + 4 = 19 ✔']} />
        <NumberQuiz question="Solve 4x + 6 = 30." answer={6} hint="Remove the 6 loose units from both sides first."
          diagnose={(v) => (v === 9 ? 'You divided 36 by 4 — the 6 must be taken away, not added.' : v === 7.5 ? 'Take away the 6 first, then divide.' : null)}
          solution={<Steps steps={['4x + 6 − 6 = 30 − 6 → 4x = 24', '4x ÷ 4 = 24 ÷ 4 → x = 6']} />} />
      </>
    ),
    apply: (
      <>
        <DesignLink>
          <p>“A 300 mm board with 20 mm ends: how many 40 mm sockets fit?” → 2 × 20 + 40n = 300 → 40n = 260 → n = 6.5, so 6 sockets.</p>
        </DesignLink>
        <button className="btn primary" onClick={() => { setEq(makeEquation(difficulty)); setRound((r) => r + 1); }}>🎲 New equation ({difficulty})</button>
      </>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['Equation', eqText(eq.q)],
      ['Left pan', `${eq.q.a} bags + ${eq.q.b} units`],
      ['Right pan', `${eq.q.c} bags + ${eq.q.d} units`],
      ['Rule', 'Same operation on both sides keeps the balance'],
    ]} />
  );
  return <Lesson id="l6-balance" title="The balance scale" tool={tool} stages={stages} numbers={numbers} />;
}

function BalanceChallenge() {
  const { difficulty } = useSettings();
  const [eq, setEq] = useState(() => makeEquation(difficulty));
  const [round, setRound] = useState(0);
  const [guess, setGuess] = useState('');
  const [showGuess, setShowGuess] = useState<number | null>(null);
  const check = (): CheckResult => {
    const g = Number(guess);
    if (guess.trim() === '' || Number.isNaN(g)) return { ok: false, happened: 'Type your value for x first.' };
    const L = eq.q.a * g + eq.q.b;
    const R = eq.q.c * g + eq.q.d;
    if (L === R) return { ok: true, happened: `x = ${g}: both pans weigh ${L}.` };
    setShowGuess(g);
    return {
      ok: false,
      happened: <>With x = {g}, the left pan weighs <b>{L}</b> and the right pan <b>{R}</b>, so the scale tips {L > R ? 'left' : 'right'} (shown above).</>,
      why: L > R ? 'Your x is too big — the bags are too heavy.' : 'Your x is too small — the bags are too light.',
    };
  };
  const panel = (
    <Challenge
      id="l6-challenge"
      title="Balance the mystery"
      brief={<><p>Find the weight of one bag: <span className="target">{eqText(eq.q)}</span></p><p className="muted small">Use the scale's buttons, then type x.</p></>}
      check={check}
      onResult={(r) => { if (!r || r.ok) setShowGuess(null); }}
      onNewTarget={() => { setEq(makeEquation(difficulty)); setRound((r) => r + 1); setGuess(''); setShowGuess(null); }}
      hint={eq.q.c ? 'First remove x bags from both sides until the bags are only on one side.' : 'First take away the loose units from both sides.'}
      solution={<Steps steps={[
        ...(eq.q.c ? [`− ${eq.q.c}x from both sides: ${eqText({ ...eq.q, a: eq.q.a - eq.q.c, c: 0 })}`] : []),
        `− ${eq.q.b} from both sides: ${eqText({ a: eq.q.a - eq.q.c, b: 0, c: 0, d: eq.q.d - eq.q.b })}`,
        ...(eq.q.a - eq.q.c > 1 ? [`÷ ${eq.q.a - eq.q.c} on both sides: x = ${eq.x}`] : [`x = ${eq.x}`]),
      ]} />}
    >
      <div className="quiz-input" style={{ marginTop: 8 }}>
        <span style={{ fontStyle: 'italic', fontWeight: 800 }}>x =</span>
        <input inputMode="numeric" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="?" />
      </div>
      {showGuess !== null && <Note>The scale is showing your guess x = {showGuess}.</Note>}
    </Challenge>
  );
  return <Workbench title="Challenge: balance the mystery" tool={<BalanceTool key={round} start={eq.q} x={eq.x} allowOneSide={false} guessX={showGuess} />} panel={panel} />;
}

export default {
  'l6-variables': VariablesLesson,
  'l6-patterns': PatternsLesson,
  'l6-balance': BalanceLesson,
  'l6-challenge': BalanceChallenge,
};
