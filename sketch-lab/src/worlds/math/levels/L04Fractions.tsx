import { useEffect, useRef, useState, type ReactNode } from 'react';
import { arcPath, clamp, fmt, gcd, pick, randInt, simplifyRatio, snap } from '../../../core/geometry';
import { useHistory } from '../../../core/history';
import { useSettings, type Difficulty } from '../../../core/store';
import { Challenge, ChoiceQuiz, NumberQuiz, type CheckResult } from '../../../ui/feedback';
import { DesignLink, Formula, Note, NumberTable, Segmented, Stat, Stats, Stepper, Steps, T, Toggle, ToolBar } from '../../../ui/kit';
import { Lesson, Workbench, type StageKey } from '../../../ui/lesson';
import { DimLine, GridLines, Handle, SvgDefs } from '../../../ui/svg';

const W = 800;

/* ================================================================== */
/* Fraction visualiser                                                 */
/* ================================================================== */

type FShape = 'bar' | 'pie' | 'triangle' | 'grid';

interface Frac {
  d: number;
  shaded: number[];
}

function gridDims(d: number): [number, number] {
  let r = Math.floor(Math.sqrt(d));
  while (d % r) r--;
  return [r, d / r];
}

/** Path of part i of a whole drawn inside the box (x, y, w, h). */
function partPath(shape: FShape, d: number, i: number, x: number, y: number, w: number, h: number): string {
  if (shape === 'bar') {
    const pw = w / d;
    return `M${x + i * pw} ${y} h${pw} v${h} h${-pw} Z`;
  }
  if (shape === 'pie') {
    const c = { x: x + w / 2, y: y + h / 2 };
    const r = Math.min(w, h) / 2;
    if (d === 1) return `M${c.x - r} ${c.y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
    return arcPath(c, r, 90 - (360 * i) / d, -360 / d, true);
  }
  if (shape === 'triangle') {
    const apex = { x: x + w / 2, y };
    const bx = (k: number) => x + (w * k) / d;
    return `M${apex.x} ${apex.y} L${bx(i)} ${y + h} L${bx(i + 1)} ${y + h} Z`;
  }
  const [rows, cols] = gridDims(d);
  const r = Math.floor(i / cols);
  const c = i % cols;
  return `M${x + (c * w) / cols} ${y + (r * h) / rows} h${w / cols} v${h / rows} h${-w / cols} Z`;
}

function FractionShapes({ f, shape, wholes, color, x, y, onPaint, onStart }: {
  f: Frac; shape: FShape; wholes: number; color: string; x: number; y: number;
  onPaint: (i: number, on: boolean) => void; onStart: () => void;
}) {
  const paint = useRef<boolean | null>(null);
  useEffect(() => {
    const up = () => (paint.current = null);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);
  const size = shape === 'bar' ? { w: 220, h: 90 } : { w: 170, h: 170 };
  const gap = 24;
  return (
    <g>
      {Array.from({ length: wholes }, (_, k) => {
        const ox = x + k * (size.w + gap);
        return (
          <g key={k}>
            {Array.from({ length: f.d }, (_, i) => {
              const idx = k * f.d + i;
              const on = f.shaded.includes(idx);
              return (
                <path
                  key={i}
                  d={partPath(shape, f.d, i, ox, y, size.w, size.h)}
                  fill={on ? color : '#fff'}
                  stroke="#1f2a44"
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
                    onStart();
                    paint.current = !on;
                    onPaint(idx, !on);
                  }}
                  onPointerEnter={() => {
                    if (paint.current !== null) onPaint(idx, paint.current);
                  }}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

function NumberLine({ x, y, w, wholes, marks }: { x: number; y: number; w: number; wholes: number; marks: { d: number; n: number; color: string }[] }) {
  const ticks: ReactNode[] = [];
  marks.forEach((m, mi) => {
    for (let k = 0; k <= m.d * wholes; k++) {
      const tx = x + (w * k) / (m.d * wholes);
      ticks.push(<line key={`${mi}-${k}`} x1={tx} y1={y - (mi ? 0 : 8)} x2={tx} y2={y + (mi ? 8 : 0)} stroke={m.color} strokeWidth={1.4} />);
    }
  });
  return (
    <g pointerEvents="none">
      <line x1={x} y1={y} x2={x + w} y2={y} stroke="#1f2a44" strokeWidth={2} />
      {Array.from({ length: wholes + 1 }, (_, k) => (
        <g key={k}>
          <line x1={x + (w * k) / wholes} y1={y - 14} x2={x + (w * k) / wholes} y2={y + 14} stroke="#1f2a44" strokeWidth={2.5} />
          <text x={x + (w * k) / wholes} y={y + 32} textAnchor="middle" className="svg-label">{k}</text>
        </g>
      ))}
      {ticks}
      {marks.map((m, mi) => {
        const mx = x + (w * m.n) / (m.d * wholes);
        return (
          <g key={mi}>
            <path d={mi ? `M${mx} ${y + 10} l-8 14 h16 Z` : `M${mx} ${y - 10} l-8 -14 h16 Z`} fill={m.color} />
            <text x={mx} y={mi ? y + 50 : y - 30} textAnchor="middle" className="svg-label" fill={m.color}>{m.n}/{m.d}</text>
          </g>
        );
      })}
    </g>
  );
}

function fracText(n: number, d: number) {
  if (n <= d || d === 0) return `${n}/${d}`;
  const whole = Math.floor(n / d);
  const rest = n % d;
  return rest ? `${n}/${d} = ${whole} ${rest}/${d}` : `${n}/${d} = ${whole}`;
}

const SHAPE_OPTS: { value: FShape; label: string }[] = [
  { value: 'bar', label: '▭ Bar' },
  { value: 'pie', label: '◔ Circle' },
  { value: 'triangle', label: '△ Triangle' },
  { value: 'grid', label: '▦ Grid' },
];

function FractionLesson() {
  const [shape, setShape] = useState<FShape>('pie');
  const [wholes, setWholes] = useState(1);
  const [compare, setCompare] = useState(false);
  const h = useHistory<{ a: Frac; b: Frac }>({ a: { d: 4, shaded: [0] }, b: { d: 8, shaded: [0, 1] } });
  const { a, b } = h.value;
  const n1 = a.shaded.length;
  const n2 = b.shaded.length;
  const equal = n1 * b.d === n2 * a.d;

  const paint = (which: 'a' | 'b') => (i: number, on: boolean) =>
    h.set((s) => {
      const f = s[which];
      const shaded = on ? (f.shaded.includes(i) ? f.shaded : [...f.shaded, i]) : f.shaded.filter((x) => x !== i);
      return { ...s, [which]: { ...f, shaded } };
    });
  const setD = (which: 'a' | 'b', d: number) =>
    h.commit((s) => ({ ...s, [which]: { d, shaded: s[which].shaded.filter((i) => i < d * wholes).slice(0, d * wholes) } }));
  const split = (which: 'a' | 'b', k: number) =>
    h.commit((s) => {
      const f = s[which];
      if (f.d * k > 36) return s;
      const shaded: number[] = [];
      for (const i of f.shaded) {
        const whole = Math.floor(i / f.d);
        const local = i % f.d;
        for (let j = 0; j < k; j++) shaded.push(whole * f.d * k + local * k + j);
      }
      return { ...s, [which]: { d: f.d * k, shaded } };
    });
  const simplify = (which: 'a' | 'b') =>
    h.commit((s) => {
      const f = s[which];
      const n = f.shaded.length;
      const g = gcd(n, f.d);
      if (g <= 1 || n === 0) return s;
      const d = f.d / g;
      return { ...s, [which]: { d, shaded: Array.from({ length: n / g }, (_, i) => i) } };
    });

  const yA = shape === 'bar' ? 40 : 20;
  const shapeH = shape === 'bar' ? 90 : 170;
  const yB = yA + shapeH + 40;
  const lineY = compare ? yB + shapeH + 46 : yA + shapeH + 70;
  const svgH = lineY + 70;

  const tool = (
    <div style={{ position: 'relative' }}>
      <svg className="tool" viewBox={`0 0 ${W} ${svgH}`}>
        <FractionShapes f={a} shape={shape} wholes={wholes} color="#ff922b" x={40} y={yA} onPaint={paint('a')} onStart={h.checkpoint} />
        <text x={760} y={yA + shapeH / 2} textAnchor="end" className="svg-label big" fill="#e8590c">{n1}/{a.d}</text>
        {compare && (
          <>
            <FractionShapes f={b} shape={shape} wholes={wholes} color="#4dabf7" x={40} y={yB} onPaint={paint('b')} onStart={h.checkpoint} />
            <text x={760} y={yB + shapeH / 2} textAnchor="end" className="svg-label big" fill="#1c7ed6">{n2}/{b.d}</text>
          </>
        )}
        <NumberLine x={60} y={lineY} w={660} wholes={wholes} marks={[{ d: a.d, n: n1, color: '#e8590c' }, ...(compare ? [{ d: b.d, n: n2, color: '#1c7ed6' }] : [])]} />
      </svg>
      <div className="overlay-badge right">
        {compare ? (equal ? '✔ Same amount — equivalent fractions!' : n1 * b.d > n2 * a.d ? `${n1}/${a.d} is bigger` : `${n2}/${b.d} is bigger`) : 'Tap or swipe parts to shade them'}
      </div>
    </div>
  );

  const fracControls = (which: 'a' | 'b', f: Frac, color: string) => (
    <div className="row">
      <Stepper label={<span style={{ color }}>Equal parts (<T k="denominator" />)</span>} value={f.d} min={1} max={shape === 'grid' ? 24 : 36} onChange={(d) => setD(which, d)} />
      <button className="btn" onClick={() => split(which, 2)} disabled={shape === 'grid' || f.d * 2 > 36}>✂ Split every part in 2</button>
      <button className="btn" onClick={() => split(which, 3)} disabled={shape === 'grid' || f.d * 3 > 36}>✂ in 3</button>
      <button className="btn" onClick={() => simplify(which)} disabled={gcd(f.shaded.length, f.d) <= 1 || f.shaded.length === 0}>🧩 Merge (simplify)</button>
    </div>
  );

  const controls = (
    <>
      <Segmented value={shape} onChange={setShape} options={SHAPE_OPTS} />
      <Stepper label="Wholes" value={wholes} min={1} max={3} onChange={(k) => { setWholes(k); h.commit((s) => ({ a: { ...s.a, shaded: s.a.shaded.filter((i) => i < s.a.d * k) }, b: { ...s.b, shaded: s.b.shaded.filter((i) => i < s.b.d * k) } })); }} />
      <Toggle label="Compare two fractions" checked={compare} onChange={setCompare} />
      {fracControls('a', a, '#e8590c')}
      {compare && fracControls('b', b, '#1c7ed6')}
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
    </>
  );

  const stages: Record<StageKey, ReactNode> = {
    see: <p>A whole shape is cut into <b>equal</b> parts. Some parts are coloured. The coloured amount is a <T k="fraction" />, and the arrow shows it on a <T k="numberLine" />.</p>,
    touch: <p>Tap parts to colour them. Swipe across several parts to colour many at once. Tap again to clear.</p>,
    experiment: (
      <ul>
        <li>Change the number of equal parts with − and +.</li>
        <li>Colour exactly half of a 2-part, a 4-part and a 6-part circle.</li>
        <li>Press <b>✂ Split every part in 2</b>. Did the coloured amount change?</li>
        <li>Try other shapes: bar, triangle, grid.</li>
      </ul>
    ),
    discover: (
      <>
        <ChoiceQuiz
          question="Is 2/4 the same amount as 1/2?"
          options={[
            { label: 'No — 2 and 4 are bigger numbers', why: 'Turn on "Compare two fractions": colour 1/2 and 2/4. The coloured areas are identical.' },
            { label: 'Yes — it is the same amount, cut differently', correct: true, why: 'Splitting every part in 2 doubles both numbers but the coloured area stays the same. These are equivalent fractions.' },
          ]}
        />
        <ChoiceQuiz
          question="Which is bigger: 1/3 or 1/4 of the same pizza?"
          options={[
            { label: '1/4 — because 4 is bigger than 3', why: 'More parts means each part is smaller! Cut a circle into 3, then into 4, and compare one slice.' },
            { label: '1/3', correct: true, why: 'Sharing among 3 people gives bigger slices than sharing among 4.' },
          ]}
          hint="Would you rather share a pizza with 2 friends or with 3 friends?"
        />
      </>
    ),
    understand: (
      <>
        <p>The bottom number, the <T k="denominator" />, says how many <b>equal</b> parts the whole is cut into.</p>
        <p>The top number, the <T k="numerator" />, says how many of those parts you take.</p>
        <p>More than one whole? Then the top number is bigger than the bottom one, like 5/4 = 1 whole and 1/4.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'n', means: 'numerator — parts taken', color: '#e8590c' }, ' / ', { s: 'd', means: 'denominator — equal parts in one whole', color: '#1f2a44' }, ' = ', { s: 'n', means: '', color: '#e8590c' }, ' ÷ ', { s: 'd', means: '', color: '#1f2a44' }]} caption="A fraction is a division. 3/4 = 3 ÷ 4 = 0.75. Times 100 gives the percentage: 75%." />
        <NumberQuiz question="A battery bar shows 3 of 8 segments lit. What percentage is that?" answer={37.5} tolerance={0.1} unit="%"
          hint="3 ÷ 8 first, then × 100."
          diagnose={(x) => (Math.abs(x - 0.375) < 0.01 ? 'That is the decimal. Multiply by 100 to get a percentage.' : Math.abs(x - 38) < 0.6 ? 'Close — that is rounded. Give the exact value.' : null)}
          solution={<Steps steps={['3 ÷ 8 = 0.375', '0.375 × 100 = 37.5%']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Layouts: a screen split into 2/3 picture and 1/3 controls.</li>
          <li>The <b>rule of thirds</b>: place the main subject of a sketch 1/3 of the way across.</li>
          <li>Drawer fronts, shelves and grille slots are often equal fractions of a height.</li>
        </ul>
      </DesignLink>
    ),
  };
  const row = (f: Frac, label: string): [ReactNode, ReactNode][] => {
    const n = f.shaded.length;
    const g = gcd(n, f.d);
    return [
      [`${label} fraction`, fracText(n, f.d)],
      [`${label} as division`, `${n} ÷ ${f.d} = ${fmt(n / f.d, 4)}`],
      [`${label} percentage`, `${fmt((100 * n) / f.d, 2)}%`],
      [`${label} simplest form`, n === 0 ? '0' : `${n / g}/${f.d / g}${g > 1 ? ` (both ÷ ${g})` : ' (already simplest)'}`],
    ];
  };
  const numbers = (
    <>
      <NumberTable rows={[...row(a, 'Orange'), ...(compare ? row(b, 'Blue') : [])]} />
      {compare && (
        <Steps steps={[
          `Cross-multiply to compare: ${n1} × ${b.d} = ${n1 * b.d} and ${n2} × ${a.d} = ${n2 * a.d}`,
          equal ? 'Equal results → the fractions are equal.' : `${n1 * b.d > n2 * a.d ? 'Orange' : 'Blue'} is bigger.`,
        ]} />
      )}
    </>
  );
  return <Lesson id="l4-fractions" title="Fraction visualiser" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Are the parts equal?                                                */
/* ================================================================== */

const BAR_MM = 300;
const BAR_PX = 640;
const BX = 80;

function EqualPartsLesson() {
  const [cutsN, setCutsN] = useState(3);
  const h = useHistory<number[]>([60, 140, 230]);
  const cuts = h.value;
  const pxPerMm = BAR_PX / BAR_MM;
  const edges = [0, ...cuts, BAR_MM];
  const parts = edges.slice(1).map((e, i) => e - edges[i]);
  const ideal = BAR_MM / parts.length;
  const allEqual = parts.every((p) => Math.abs(p - ideal) <= 2);
  const changeN = (k: number) => {
    setCutsN(k);
    h.commit(Array.from({ length: k }, (_, i) => Math.round(((i + 1) * BAR_MM) / (k + 1) + (i % 2 ? 12 : -12))));
  };
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 300`}>
      <SvgDefs />
      {parts.map((p, i) => {
        const x = BX + edges[i] * pxPerMm;
        const good = Math.abs(p - ideal) <= 2;
        return (
          <g key={i}>
            <rect x={x} y={90} width={p * pxPerMm} height={80} fill={i % 2 ? '#8d5524' : '#a0522d'} opacity={0.85} />
            <text x={x + (p * pxPerMm) / 2} y={135} textAnchor="middle" className="svg-label" fill={good ? '#2b8a3e' : '#e5484d'}>{fmt(p, 0)} mm</text>
            <text x={x + (p * pxPerMm) / 2} y={200} textAnchor="middle" className="svg-label small" fill="#495057">{fmt(p / BAR_MM, 2)} of bar</text>
          </g>
        );
      })}
      <DimLine a={{ x: BX, y: 90 }} b={{ x: BX + BAR_PX, y: 90 }} offset={-30} label={`${BAR_MM} mm plank`} />
      {cuts.map((c, i) => (
        <g key={i}>
          <line x1={BX + c * pxPerMm} y1={70} x2={BX + c * pxPerMm} y2={190} stroke="#212529" strokeWidth={3} strokeDasharray="6 3" />
          <Handle x={BX + c * pxPerMm} y={240} shape="diamond" color="#495057" onStart={h.checkpoint} title={`cut ${i + 1}`}
            onDrag={(p) => {
              const mm = snap((p.x - BX) / pxPerMm, 1);
              const lo = (i ? cuts[i - 1] : 0) + 5;
              const hi = (i < cuts.length - 1 ? cuts[i + 1] : BAR_MM) - 5;
              h.set((s) => s.map((x, j) => (j === i ? clamp(mm, lo, hi) : x)));
            }} />
          <text x={BX + c * pxPerMm} y={280} textAnchor="middle" className="svg-label small">✂ {c} mm</text>
        </g>
      ))}
    </svg>
  );
  const controls = (
    <>
      <Stepper label="Number of cuts" value={cutsN} min={1} max={7} onChange={changeN} />
      <Stat label="pieces" value={parts.length} />
      <Stat label="each should be" value={`${fmt(ideal, 1)} mm`} color="#2b8a3e" />
      <Stat label="equal?" value={allEqual ? '✔ yes' : '✘ not yet'} color={allEqual ? '#2b8a3e' : '#e5484d'} />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()}>
        <button className="btn" onClick={() => h.commit(Array.from({ length: cutsN }, (_, i) => Math.round(((i + 1) * BAR_MM) / (cutsN + 1))))}>Show equal cuts</button>
      </ToolBar>
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A 300 mm wooden plank with saw cuts (dashed). The pieces are <b>not</b> all the same length.</p>,
    touch: <p>Drag the ◆ handles under the plank to move the cuts.</p>,
    experiment: (
      <ul>
        <li>Make 4 pieces (3 cuts) that are all the same length.</li>
        <li>Then try 5 pieces, then 6.</li>
        <li>Can you make 3 pieces where one is “a third”, but the others are not?</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz
        question="You cut the plank into 4 pieces: 50, 50, 100 and 100 mm. Is each piece 1/4 of the plank?"
        options={[
          { label: 'Yes, there are 4 pieces', why: 'Counting pieces is not enough. 1/4 of 300 mm is 75 mm — none of these is 75 mm.' },
          { label: 'No — the pieces are not equal', correct: true, why: 'A fraction like 1/4 only makes sense when all 4 parts are equal.' },
        ]}
      />
    ),
    understand: (
      <>
        <p>Fractions are <b>fair shares</b>. “Quarters” means 4 <b>equal</b> parts.</p>
        <p>Equal parts can still have different shapes — a square can be cut into 4 equal strips, 4 small squares, or 4 triangles. What matters is that each covers the same amount.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'piece', means: 'length of one equal piece', color: '#2b8a3e' }, ' = ', { s: 'L', means: 'total length', color: '#8d5524' }, ' ÷ ', { s: 'n', means: 'number of pieces (= cuts + 1)', color: '#1f2a44' }]} />
        <NumberQuiz question="A 1000 mm board is cut into 4 equal pieces. Each saw cut destroys 3 mm of wood (the kerf). How long is each piece?" answer={247.75} tolerance={0.05} unit="mm"
          hint="4 pieces need 3 cuts. Take away the wood lost in cuts first."
          diagnose={(x) => (x === 250 ? 'You forgot the wood the saw turns into dust: 3 cuts × 3 mm.' : Math.abs(x - 247) < 0.1 ? '4 pieces need only 3 cuts, not 4.' : null)}
          solution={<Steps steps={['4 pieces → 3 cuts', '3 × 3 mm = 9 mm lost', '1000 − 9 = 991 mm left', '991 ÷ 4 = 247.75 mm']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Equally spaced shelves, ribs and grille slots: divide the length by the number of gaps.</li>
          <li>Real cutting removes material (saw kerf, laser kerf) — designers allow for it.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <>
      <NumberTable rows={parts.map((p, i) => [`Piece ${i + 1}`, `${fmt(p, 0)} mm = ${fmt(p, 0)}/${BAR_MM} = ${fmt(p / BAR_MM, 3)}`] as [ReactNode, ReactNode])} />
      <Steps steps={[`Equal pieces: ${BAR_MM} ÷ ${parts.length} = ${fmt(ideal, 2)} mm each`, `Largest difference from equal: ${fmt(Math.max(...parts.map((p) => Math.abs(p - ideal))), 1)} mm`]} />
    </>
  );
  return <Lesson id="l4-equal" title="Are the parts equal?" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Ratios by resizing                                                  */
/* ================================================================== */

const PRESETS: { label: string; w: number; h: number }[] = [
  { label: '16 : 9 (TV)', w: 16, h: 9 },
  { label: '4 : 3 (photo)', w: 4, h: 3 },
  { label: '1 : 1 (square)', w: 1, h: 1 },
  { label: '√2 : 1 (A4 paper)', w: Math.SQRT2, h: 1 },
  { label: '19.5 : 9 (phone)', w: 19.5, h: 9 },
];

function ratioText(w: number, h: number) {
  const iw = Math.round(w * 10);
  const ih = Math.round(h * 10);
  if (Math.abs(w * 10 - iw) < 1e-6 && Math.abs(h * 10 - ih) < 1e-6) {
    const [a, b] = simplifyRatio(iw, ih);
    if (a <= 40 && b <= 40) return `${a} : ${b}`;
  }
  return `${fmt(w / h, 3)} : 1`;
}

function RatioLesson() {
  const ORIG = { x: 60, y: 440 };
  const S = 20; // px per unit
  const h = useHistory({ aw: 8, ah: 4.5, bw: 12, bh: 8 });
  const { aw, ah, bw, bh } = h.value;
  const [lock, setLock] = useState(false);
  const ra = aw / ah;
  const rb = bw / bh;
  const inProp = Math.abs(rb - ra) / ra < 0.01;
  const kx = bw / aw;
  const ky = bh / ah;
  const diagEnd = { x: ORIG.x + 34 * S, y: ORIG.y - (34 * S) / ra };
  const tool = (
    <div style={{ position: 'relative' }}>
      <svg className="tool" viewBox={`0 0 ${W} 470`}>
        <GridLines x0={ORIG.x} y0={ORIG.y - 21 * S} w={34 * S} h={21 * S} step={S} major={5} />
        <line x1={ORIG.x} y1={ORIG.y} x2={diagEnd.x} y2={diagEnd.y} stroke="#e8590c" strokeWidth={1.5} strokeDasharray="8 5" />
        <rect x={ORIG.x} y={ORIG.y - bh * S} width={bw * S} height={bh * S} fill={inProp ? '#d3f9d855' : '#e7f5ff88'} stroke={inProp ? '#2b8a3e' : '#1c7ed6'} strokeWidth={3} />
        <rect x={ORIG.x} y={ORIG.y - ah * S} width={aw * S} height={ah * S} fill="#ffe8cc" stroke="#e8590c" strokeWidth={3} />
        <text x={ORIG.x + 6} y={ORIG.y - ah * S + 18} className="svg-label small" fill="#e8590c">original {ratioText(aw, ah)}</text>
        <text x={ORIG.x + bw * S - 6} y={ORIG.y - bh * S - 8} className="svg-label small" fill={inProp ? '#2b8a3e' : '#1c7ed6'} textAnchor="end">copy {ratioText(bw, bh)}</text>
        <Handle x={ORIG.x + aw * S} y={ORIG.y - ah * S} color="#e8590c" onStart={h.checkpoint} title="resize the original"
          onDrag={(p) => h.set((s) => ({ ...s, aw: clamp(snap((p.x - ORIG.x) / S, 0.5), 1, 34), ah: clamp(snap((ORIG.y - p.y) / S, 0.5), 1, 21) }))} />
        <Handle x={ORIG.x + bw * S} y={ORIG.y - bh * S} color={inProp ? '#2b8a3e' : '#1c7ed6'} r={11} onStart={h.checkpoint} title="resize the copy"
          onDrag={(p) => h.set((s) => {
            let w = clamp(snap((p.x - ORIG.x) / S, 0.5), 1, 34);
            let hh = clamp(snap((ORIG.y - p.y) / S, 0.5), 1, 21);
            if (lock) {
              hh = w / (s.aw / s.ah);
              if (hh > 21) {
                hh = 21;
                w = hh * (s.aw / s.ah);
              }
            }
            return { ...s, bw: w, bh: hh };
          })} />
      </svg>
      <div className="overlay-badge">{inProp ? '✔ In proportion — the corner sits on the dashed diagonal' : 'Not in proportion — the copy is stretched'}</div>
    </div>
  );
  const controls = (
    <>
      <div className="row">
        {PRESETS.map((p) => (
          <button key={p.label} className="btn small" onClick={() => h.commit((s) => ({ ...s, aw: Math.round(p.w * (4.5 / p.h) * 100) / 100, ah: 4.5 }))}>{p.label}</button>
        ))}
      </div>
      <Toggle label="🔒 Lock the copy's proportions" checked={lock} onChange={setLock} />
      <Stats>
        <Stat label="original ratio" value={ratioText(aw, ah)} color="#e8590c" sub={`${fmt(aw, 2)} ÷ ${fmt(ah, 2)} = ${fmt(ra, 3)}`} />
        <Stat label="copy ratio" value={ratioText(bw, bh)} color={inProp ? '#2b8a3e' : '#1c7ed6'} sub={`${fmt(bw, 2)} ÷ ${fmt(bh, 2)} = ${fmt(rb, 3)}`} />
        <Stat label="scale factors" value={`×${fmt(kx, 2)} / ×${fmt(ky, 2)}`} sub="width / height" />
      </Stats>
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>An orange original and a blue copy. The dashed orange line is the original's diagonal, extended.</p>,
    touch: <p>Drag the blue corner to resize the copy. Drag the orange corner to change the original.</p>,
    experiment: (
      <ul>
        <li>Put the blue corner exactly on the dashed line. What does the label say?</li>
        <li>Move it off the line — the copy looks stretched or squashed.</li>
        <li>Try a preset like 16 : 9, then make a bigger copy that is in proportion.</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz
        question="When is the copy in proportion with the original?"
        options={[
          { label: 'When I add the same amount to width and height', why: 'Try it: 8×4.5 → 12×8.5 adds 4 to both, but the corner leaves the diagonal.' },
          { label: 'When I multiply width and height by the same number', correct: true, why: 'Same scale factor on both sides keeps the shape. The corner then sits on the diagonal.' },
        ]}
      />
    ),
    understand: (
      <>
        <p>A <T k="ratio" /> compares two amounts: width : height. 16 : 9 means “16 across for every 9 up”.</p>
        <p>Two shapes are in <T k="proportion" /> when their ratios are equal. Then one is just a zoomed copy of the other.</p>
        <p>Designer's trick: shapes with the same proportions share the same diagonal.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'w₁', means: 'original width', color: '#e8590c' }, ' : ', { s: 'h₁', means: 'original height', color: '#e8590c' }, ' = ', { s: 'w₂', means: 'new width', color: '#1c7ed6' }, ' : ', { s: 'h₂', means: 'new height', color: '#1c7ed6' }]} />
        <Formula parts={[{ s: 'h₂', means: 'the height you want', color: '#1c7ed6' }, ' = ', { s: 'h₁', means: 'original height', color: '#e8590c' }, ' × ', { s: 'w₂', means: 'new width', color: '#1c7ed6' }, ' ÷ ', { s: 'w₁', means: 'original width', color: '#e8590c' }]} caption="w₂ ÷ w₁ is the scale factor. Multiply the other side by the same factor." />
        <NumberQuiz question="A 4 : 3 photo is enlarged to 12 cm wide, in proportion. How tall is it?" answer={9} unit="cm" hint="12 is 4 × 3, so multiply the 3 by the same."
          diagnose={(x) => (x === 11 ? 'You added 8 to both sides. Proportions multiply, they do not add.' : x === 16 ? 'That is the width scaled by 4 / 3. The height must use the same factor, ×3.' : null)}
          solution={<Steps steps={['scale factor = 12 ÷ 4 = 3', 'height = 3 × 3 = 9 cm']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Drawing a product from a photo: measure width : height on the photo and keep it in your sketch.</li>
          <li>Screens, paper sizes and packaging are specified by their ratios.</li>
          <li>The diagonal trick works on paper too — use a ruler to extend the diagonal before enlarging a sketch.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['Original', `${fmt(aw, 2)} × ${fmt(ah, 2)} → ratio ${fmt(ra, 3)} : 1`],
      ['Copy', `${fmt(bw, 2)} × ${fmt(bh, 2)} → ratio ${fmt(rb, 3)} : 1`],
      ['Width scale factor', `${fmt(bw, 2)} ÷ ${fmt(aw, 2)} = ${fmt(kx, 3)}`],
      ['Height scale factor', `${fmt(bh, 2)} ÷ ${fmt(ah, 2)} = ${fmt(ky, 3)}`],
      ['Height needed for proportion', `${fmt(ah, 2)} × ${fmt(kx, 3)} = ${fmt(ah * kx, 2)}`],
      ['In proportion?', inProp ? 'yes' : 'no'],
    ]} />
  );
  return <Lesson id="l4-ratio" title="Ratios by resizing" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Challenge: scale a product sketch                                   */
/* ================================================================== */

/** A Bluetooth speaker side sketch in a 1×1 box (original 120 × 180 mm). */
function SpeakerSketch({ x, y, w, h, color = '#1f2a44', dashed }: { x: number; y: number; w: number; h: number; color?: string; dashed?: boolean }) {
  const X = (u: number) => x + u * w;
  const Y = (v: number) => y + v * h;
  const style = { vectorEffect: 'non-scaling-stroke' as const };
  const dash = dashed ? '7 5' : undefined;
  return (
    <g fill="none" stroke={color} strokeWidth={2.5} strokeDasharray={dash} pointerEvents="none">
      <rect x={X(0.04)} y={Y(0)} width={w * 0.92} height={h * 0.93} rx={Math.min(w, h) * 0.12} style={style} fill={dashed ? 'none' : '#f1f3f5'} />
      <ellipse cx={X(0.5)} cy={Y(0.62)} rx={w * 0.34} ry={h * 0.227} style={style} />
      <ellipse cx={X(0.5)} cy={Y(0.62)} rx={w * 0.12} ry={h * 0.08} style={style} fill={dashed ? 'none' : '#adb5bd'} />
      <ellipse cx={X(0.5)} cy={Y(0.22)} rx={w * 0.15} ry={h * 0.1} style={style} />
      <rect x={X(0.2)} y={Y(0.93)} width={w * 0.6} height={h * 0.07} rx={4} style={style} fill={dashed ? 'none' : '#495057'} />
    </g>
  );
}

const ORIG_W = 120;
const ORIG_H = 180;

type ScaleTarget = { kind: 'width' | 'height' | 'factor' | 'fit'; value: number; w: number; h: number; text: string };

function scaleTarget(d: Difficulty): ScaleTarget {
  if (d === 'easy') {
    const k = pick([1.5, 2, 0.5, 2.5]);
    return { kind: 'width', value: ORIG_W * k, w: ORIG_W * k, h: ORIG_H * k, text: `${ORIG_W * k} mm wide` };
  }
  if (d === 'normal') {
    if (Math.random() < 0.5) {
      const w = pick([80, 100, 140, 160, 200]);
      return { kind: 'width', value: w, w, h: (ORIG_H * w) / ORIG_W, text: `${w} mm wide` };
    }
    const hh = pick([90, 150, 210, 240, 270]);
    return { kind: 'height', value: hh, w: (ORIG_W * hh) / ORIG_H, h: hh, text: `${hh} mm tall` };
  }
  if (Math.random() < 0.5) {
    const k = pick([0.75, 1.25, 1.4, 0.6]);
    return { kind: 'factor', value: k, w: ORIG_W * k, h: ORIG_H * k, text: `scaled by a factor of ${k}` };
  }
  const box = randInt(15, 27) * 10;
  const k = Math.min(box / ORIG_W, box / ORIG_H);
  return { kind: 'fit', value: box, w: ORIG_W * k, h: ORIG_H * k, text: `as large as possible inside a ${box} × ${box} mm box` };
}

function ScaleChallenge() {
  const { difficulty } = useSettings();
  const [target, setTarget] = useState(() => scaleTarget(difficulty));
  const h = useHistory({ w: 150, h: 160 });
  const [lock, setLock] = useState(false);
  const [mistake, setMistake] = useState(false);
  const [ghost, setGhost] = useState(false);
  const PX = 1.25;
  const BASE = { x: 330, y: 470 };
  const { w, h: hh } = h.value;
  const tolMm = difficulty === 'easy' ? 3 : difficulty === 'normal' ? 2 : 1.5;
  const step = difficulty === 'easy' ? 5 : 1;
  const ratio = ORIG_W / ORIG_H;
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 500`}>
      <GridLines x0={BASE.x} y0={BASE.y - 360 * PX} w={360 * PX} h={360 * PX} step={10 * PX} major={5} />
      <g>
        <text x={40} y={40} className="svg-label" fill="#495057">Original (120 × 180 mm)</text>
        <SpeakerSketch x={60} y={70} w={ORIG_W * PX} h={ORIG_H * PX} />
        <DimLine a={{ x: 60, y: 70 + ORIG_H * PX }} b={{ x: 60 + ORIG_W * PX, y: 70 + ORIG_H * PX }} offset={18} label="120 mm" color="#495057" />
        <DimLine a={{ x: 60, y: 70 + ORIG_H * PX }} b={{ x: 60, y: 70 }} offset={18} label="180 mm" color="#495057" />
      </g>
      <line x1={BASE.x} y1={BASE.y} x2={BASE.x + 360 * PX} y2={BASE.y - (360 * PX) / ratio} stroke={mistake ? '#e5484d' : '#adb5bd'} strokeDasharray="6 5" />
      {target.kind === 'fit' && <rect x={BASE.x} y={BASE.y - target.value * PX} width={target.value * PX} height={target.value * PX} fill="none" stroke="#f08c00" strokeWidth={2} strokeDasharray="10 5" />}
      {ghost && <SpeakerSketch x={BASE.x} y={BASE.y - target.h * PX} w={target.w * PX} h={target.h * PX} color="#2b8a3e" dashed />}
      <SpeakerSketch x={BASE.x} y={BASE.y - hh * PX} w={w * PX} h={hh * PX} color={mistake ? '#e5484d' : '#1c7ed6'} />
      <DimLine a={{ x: BASE.x, y: BASE.y }} b={{ x: BASE.x + w * PX, y: BASE.y }} offset={14} label={`${fmt(w, 0)} mm`} color="#1c7ed6" />
      <DimLine a={{ x: BASE.x + w * PX, y: BASE.y }} b={{ x: BASE.x + w * PX, y: BASE.y - hh * PX }} offset={14} label={`${fmt(hh, 0)} mm`} color="#c2255c" />
      <Handle x={BASE.x + w * PX} y={BASE.y - hh * PX} r={11} onStart={h.checkpoint} title="resize the sketch"
        onDrag={(p) => h.set(() => {
          let nw = clamp(snap((p.x - BASE.x) / PX, step), 30, 360);
          let nh = clamp(snap((BASE.y - p.y) / PX, step), 30, 360);
          if (lock) {
            nh = nw / ratio;
            if (nh > 360) {
              nh = 360;
              nw = nh * ratio;
            }
          }
          return { w: nw, h: nh };
        })} />
    </svg>
  );
  const check = (): CheckResult => {
    const errW = w - target.w;
    const errH = hh - target.h;
    const prop = Math.abs(w / hh - ratio) / ratio;
    if (Math.abs(errW) <= tolMm && Math.abs(errH) <= tolMm) return { ok: true, happened: `${fmt(w, 0)} × ${fmt(hh, 0)} mm — scale factor ×${fmt(w / ORIG_W, 3)} on both sides.` };
    if (prop > 0.02) {
      return {
        ok: false,
        happened: <>Your sketch is {fmt(w, 0)} × {fmt(hh, 0)} mm. Width changed by <b>×{fmt(w / ORIG_W, 2)}</b> but height by <b>×{fmt(hh / ORIG_H, 2)}</b> — the round speaker cones have become ovals.</>,
        why: 'To keep proportions, width and height must be multiplied by the same scale factor. The top-right corner must sit on the dashed diagonal.',
      };
    }
    return {
      ok: false,
      happened: <>The proportions are right 👍 but the size is {fmt(w, 0)} × {fmt(hh, 0)} mm, not {fmt(target.w, 0)} × {fmt(target.h, 0)} mm.</>,
      why: target.kind === 'fit' ? 'The tallest side reaches the box first. Make the height equal to the box size.' : 'Slide the corner along the diagonal until the required dimension matches.',
    };
  };
  const panel = (
    <Challenge
      id="l4-scale"
      title="Scale a product sketch"
      brief={
        <>
          <p>The speaker sketch must be redrawn <span className="target">{target.text}</span>, keeping its proportions.</p>
          <p className="muted small">Drag the corner. Tolerance ±{tolMm} mm.</p>
        </>
      }
      check={check}
      onResult={(r) => setMistake(!!r && !r.ok)}
      onNewTarget={() => { setTarget(scaleTarget(difficulty)); setGhost(false); }}
      hint={target.kind === 'fit' ? 'Which side of the speaker is longer? That side decides the scale factor.' : target.kind === 'factor' ? `Multiply both 120 and 180 by ${target.value}.` : 'First find the scale factor: new size ÷ original size. Then multiply the other side by it.'}
      solution={
        <>
          <Steps steps={[
            target.kind === 'factor' ? `factor = ${target.value}` : target.kind === 'height' ? `factor = ${target.value} ÷ 180 = ${fmt(target.value / 180, 4)}` : target.kind === 'fit' ? `factor = ${target.value} ÷ 180 = ${fmt(target.value / 180, 4)} (height is the longer side)` : `factor = ${target.value} ÷ 120 = ${fmt(target.value / 120, 4)}`,
            `width = 120 × factor = ${fmt(target.w, 1)} mm`,
            `height = 180 × factor = ${fmt(target.h, 1)} mm`,
          ]} />
          <button className="btn small" onClick={() => setGhost(true)}>Show the target outline</button>
        </>
      }
    >
      {difficulty === 'easy' ? (
        <Toggle label="🔒 Lock proportions" checked={lock} onChange={setLock} />
      ) : (
        <Note>On Normal and Hard, the proportion lock is off — work out the numbers yourself.</Note>
      )}
    </Challenge>
  );
  return <Workbench title="Challenge: scale a product sketch" tool={tool} controls={<ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />} panel={panel} />;
}

export default {
  'l4-fractions': FractionLesson,
  'l4-equal': EqualPartsLesson,
  'l4-ratio': RatioLesson,
  'l4-scale': ScaleChallenge,
};
