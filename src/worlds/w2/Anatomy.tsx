import { useMemo, useState, type PointerEvent as RPointerEvent } from 'react';
import { ChallengeBrief, Concepts, LessonShell, ObserveQuestion, weighted, type ChallengeCtx, type Criterion } from '../../components/lesson/LessonShell';
import { Badge, Button, Eyebrow, Segmented, cx } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { fontById } from '../../lib/fonts';
import { glyphPositions, useTypeMetrics, type TypeMetrics } from '../../lib/typeMetrics';

const W = 1000, H = 430, FS = 200, BASE = 300, X0 = 60;
const WORD = 'Hxodp';
type Part = 'baseline' | 'xheight' | 'cap' | 'ascender' | 'descender' | 'counter' | 'thick' | 'thin';
const INFO: Record<Part, { name: string; what: string }> = {
  baseline: { name: 'Baseline', what: 'The invisible line letters sit on. Round letters like “o” dip slightly below it (overshoot) so they look aligned.' },
  xheight: { name: 'x-height', what: 'The height of lowercase letters without ascenders. A large x-height reads well at small sizes; a small one feels classical and elegant.' },
  cap: { name: 'Cap height', what: 'The height of flat capital letters like H. Used to align type with images and other elements.' },
  ascender: { name: 'Ascender', what: 'The part of a lowercase letter that rises above the x-height, as in d, h, k and l. Often taller than the capitals.' },
  descender: { name: 'Descender', what: 'The part that drops below the baseline, as in p, g and y. Long descenders need generous line spacing.' },
  counter: { name: 'Counter', what: 'The enclosed or partly enclosed space inside a letter. Open counters stay legible when small or blurred.' },
  thick: { name: 'Thick stroke (stem)', what: 'The heaviest part of a stroke. The ratio between thick and thin strokes is called stroke contrast.' },
  thin: { name: 'Thin stroke (hairline)', what: 'The lightest part of a stroke. High contrast (thin hairlines) looks refined but breaks up at small sizes.' },
};
const FONTS = ['playfair', 'garamond', 'inter', 'bodoni', 'robotoslab', 'jetbrains', 'fraunces', 'montserrat'];

function geometry(m: TypeMetrics, fontId: string) {
  const f = fontById(fontId);
  const pos = glyphPositions(WORD, f, 400, FS);
  const o = pos[2];
  const lines: Record<Exclude<Part, 'counter' | 'thick' | 'thin'>, number> = {
    baseline: BASE, xheight: BASE - m.xHeight * FS, cap: BASE - m.capHeight * FS, ascender: BASE - m.ascender * FS, descender: BASE + m.descender * FS,
  };
  const oc = { x: X0 + o.x + o.w / 2, y: BASE - (m.xHeight * FS) / 2 };
  return { lines, oc, oW: o.w, points: { counter: oc, thick: { x: X0 + o.x + o.w * 0.14, y: oc.y }, thin: { x: oc.x, y: BASE - m.xHeight * FS + 4 } } };
}

function Specimen({ fontId, onTap, show = true, highlight, marks }: { fontId: string; onTap?: (x: number, y: number) => void; show?: boolean; highlight?: Part | null; marks?: { x: number; y: number; ok: boolean }[] }) {
  const m = useTypeMetrics(fontId, 400);
  const f = fontById(fontId);
  const g = useMemo(() => (m ? geometry(m, fontId) : null), [m, fontId]);
  const tap = (e: RPointerEvent<SVGSVGElement>) => {
    if (!onTap) return;
    const r = e.currentTarget.getBoundingClientRect();
    onTap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cx('w-full rounded-xl bg-paper', onTap && 'cursor-crosshair')} onPointerDown={tap} role="img" aria-label={`Specimen of ${f.label}`}>
      {g && show && Object.entries(g.lines).map(([k, y]) => (
        <g key={k}>
          <line x1={20} x2={W - 20} y1={y} y2={y} stroke={highlight === k ? '#b8432f' : '#9a948b'} strokeWidth={highlight === k ? 2.5 : 1} strokeDasharray={k === 'baseline' ? undefined : '6 6'} />
          <text x={W - 24} y={y - 6} textAnchor="end" fontSize="15" fill={highlight === k ? '#b8432f' : '#8a847b'} fontFamily="Inter Variable, sans-serif">{INFO[k as Part].name}</text>
        </g>
      ))}
      <text x={X0} y={BASE} fontSize={FS} fill="#151515" style={{ fontFamily: f.css, fontKerning: 'normal' }}>{WORD}</text>
      {g && show && highlight && (highlight === 'counter' || highlight === 'thick' || highlight === 'thin') && (
        <circle cx={g.points[highlight].x} cy={g.points[highlight].y} r={highlight === 'counter' ? g.oW * 0.22 : 12} fill="none" stroke="#b8432f" strokeWidth={3} />
      )}
      {marks?.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={9} fill={p.ok ? '#3fa66b' : '#d64545'} stroke="#fff" strokeWidth={2} />)}
    </svg>
  );
}

export default function Anatomy({ level }: LevelProps) {
  return <LessonShell level={level}
    observe={
      <div className="space-y-5">
        <div className="mx-auto max-w-4xl"><Specimen fontId="playfair" show={false} /></div>
        <ObserveQuestion question="Look at the bottoms and tops of these letters. What invisible structure holds them together?" options={['They all sit on one line', 'Lowercase letters share a height', 'Some letters break out above or below', 'All three']}
          reveal={() => <p>All three. Every typeface is built on invisible horizontal lines — a baseline, an x-height, a cap height, and extents for ascenders and descenders — plus consistent shapes like counters and strokes. Knowing these names lets you describe exactly why one typeface feels different from another.</p>} />
      </div>
    }
    experiment={<Experiment />}
    discover={
      <Concepts items={(['baseline', 'xheight', 'cap', 'ascender', 'descender', 'counter'] as Part[]).map((p) => ({ title: INFO[p].name, body: INFO[p].what }))
        .concat([{ title: 'Stroke contrast', body: 'The ratio between the thickest and thinnest parts of strokes. Didones like Bodoni are extreme; geometric sans faces like Montserrat are nearly monolinear. Measured here by rasterising the “o”.' }])} />
    }
    challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

function Experiment() {
  const [font, setFont] = useState('playfair');
  const [part, setPart] = useState<Part | null>('xheight');
  const m = useTypeMetrics(font);
  const g = m ? geometry(m, font) : null;
  const onTap = (x: number, y: number) => {
    if (!g) return;
    for (const k of ['counter', 'thick', 'thin'] as const) if (Math.hypot(g.points[k].x - x, g.points[k].y - y) < (k === 'counter' ? g.oW * 0.2 : 16)) { setPart(k); return; }
    let best: Part = 'baseline', bd = 1e9;
    for (const [k, ly] of Object.entries(g.lines)) { const d = Math.abs(ly - y); if (d < bd) { bd = d; best = k as Part; } }
    setPart(best);
  };
  return (
    <div className="space-y-4">
      <Segmented value={font} onChange={setFont} options={FONTS.map((f) => ({ value: f, label: fontById(f).label }))} />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div><Specimen fontId={font} onTap={onTap} highlight={part} /><p className="mt-2 text-[12px] text-ink-400">Tap a line, the inside of the “o”, its thick side or its thin top.</p></div>
        <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          {part && <div><Eyebrow>Selected</Eyebrow><p className="font-display text-[26px] text-ink-50">{INFO[part].name}</p><p className="mt-1 text-[13.5px] leading-relaxed text-ink-300">{INFO[part].what}</p></div>}
          {m && (
            <dl className="grid grid-cols-2 gap-y-1.5 border-t border-ink-700 pt-3 text-[12.5px]">
              {[['x-height', m.xHeight], ['Cap height', m.capHeight], ['Ascender', m.ascender], ['Descender', m.descender]].map(([k, v]) => <div key={k as string} className="contents"><dt className="text-ink-400">{k}</dt><dd className="num font-mono text-ink-100">{Math.round((v as number) * 100)}% of size</dd></div>)}
              <dt className="text-ink-400">x-height ÷ cap</dt><dd className="num font-mono text-ink-100">{(m.xHeight / m.capHeight).toFixed(2)}</dd>
              <dt className="text-ink-400">Stroke contrast</dt><dd className="num font-mono text-ink-100">{m.strokeContrast.toFixed(1)} : 1</dd>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}

interface Task { kind: 'tap'; part: Part; font: string; prompt: string }
interface Compare { kind: 'compare'; metric: 'xHeight' | 'strokeContrast'; a: string; b: string; prompt: string }
const TASKS: (Task | Compare)[] = [
  { kind: 'tap', part: 'xheight', font: 'garamond', prompt: 'Tap the x-height line.' },
  { kind: 'tap', part: 'baseline', font: 'inter', prompt: 'Tap the baseline.' },
  { kind: 'tap', part: 'descender', font: 'playfair', prompt: 'Tap the descender line (the bottom of the “p”).' },
  { kind: 'tap', part: 'cap', font: 'robotoslab', prompt: 'Tap the cap height.' },
  { kind: 'tap', part: 'counter', font: 'fraunces', prompt: 'Tap inside the counter of the “o”.' },
  { kind: 'compare', metric: 'xHeight', a: 'garamond', b: 'inter', prompt: 'Which typeface has the larger x-height (relative to its size)?' },
  { kind: 'compare', metric: 'strokeContrast', a: 'montserrat', b: 'bodoni', prompt: 'Which typeface has more stroke contrast?' },
];

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const [i, setI] = useState(0);
  const [taps, setTaps] = useState<Record<number, { x: number; y: number }>>({});
  const [picks, setPicks] = useState<Record<number, 'a' | 'b'>>({});
  const t = TASKS[i];
  const metrics = Object.fromEntries(['garamond', 'inter', 'playfair', 'robotoslab', 'fraunces', 'montserrat', 'bodoni'].map((f) => [f, useTypeMetrics(f)])) as Record<string, TypeMetrics | null>; // eslint-disable-line react-hooks/rules-of-hooks
  const judge = (k: number): Criterion => {
    const task = TASKS[k];
    if (task.kind === 'tap') {
      const m = metrics[task.font];
      const tp = taps[k];
      if (!m || !tp) return { label: task.prompt, score: 0, weight: 1, detail: 'No answer.' };
      const g = geometry(m, task.font);
      if (task.part === 'counter') { const d = Math.hypot(tp.x - g.oc.x, tp.y - g.oc.y); return { label: task.prompt, score: d < g.oW * 0.25 ? 100 : d < g.oW * 0.5 ? 50 : 0, weight: 1, detail: `${Math.round(d)} units from the centre of the counter.` }; }
      const target = g.lines[task.part as keyof typeof g.lines];
      const nearest = Object.entries(g.lines).sort((a, b) => Math.abs(a[1] - tp.y) - Math.abs(b[1] - tp.y))[0][0];
      const err = Math.abs(tp.y - target);
      return { label: task.prompt, score: nearest === task.part && err < 18 ? 100 : err < 30 ? 50 : 0, weight: 1, detail: nearest === task.part ? `Within ${Math.round(err)} units of the line.` : `Closest line to your tap: ${INFO[nearest as Part].name}.` };
    }
    const ma = metrics[task.a], mb = metrics[task.b];
    const truth = ma && mb ? (ma[task.metric] > mb[task.metric] ? 'a' : 'b') : 'a';
    return { label: task.prompt, score: picks[k] === truth ? 100 : 0, weight: 1, detail: ma && mb ? `${fontById(task.a).label} ${task.metric === 'xHeight' ? Math.round(ma.xHeight * 100) + '%' : ma.strokeContrast.toFixed(1) + ':1'} vs ${fontById(task.b).label} ${task.metric === 'xHeight' ? Math.round(mb.xHeight * 100) + '%' : mb.strokeContrast.toFixed(1) + ':1'} (measured).` : '' };
  };
  const answered = (k: number) => (TASKS[k].kind === 'tap' ? !!taps[k] : !!picks[k]);
  const submit = () => {
    const criteria = TASKS.map((_, k) => judge(k));
    ctx.submit({ score: weighted(criteria), criteria, worked: criteria.filter((c) => c.score === 100).map((c) => c.label), improve: criteria.filter((c) => c.score < 100).map((c) => `${c.label} ${c.detail}`),
      why: 'Naming the parts of letters turns vague impressions (“this feels cramped”, “that looks elegant”) into precise, fixable observations: a small x-height, long descenders, high stroke contrast.' });
  };
  return (
    <div>
      <ChallengeBrief title="Seven quick identifications" aside={<div className="flex flex-wrap gap-1.5">{TASKS.map((_, k) => <button key={k} onClick={() => setI(k)} className={cx('h-9 w-9 rounded-full text-[12.5px] ring-1', k === i ? 'bg-ink-100 text-ink-950 ring-ink-100' : answered(k) ? 'text-ink-100 ring-ink-500' : 'text-ink-500 ring-ink-700')}>{k + 1}</button>)}</div>}>
        Guide lines are hidden. Tap precisely, or choose between two typefaces. Answers are checked against metrics measured from the actual fonts.
      </ChallengeBrief>
      <p className="mb-3 font-display text-[24px] text-ink-50">{t.prompt}</p>
      {t.kind === 'tap' ? (
        <div className="mx-auto max-w-4xl"><Specimen fontId={t.font} show={false} onTap={(x, y) => setTaps((s) => ({ ...s, [i]: { x, y } }))} marks={taps[i] ? [{ ...taps[i], ok: true }] : []} /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(['a', 'b'] as const).map((k) => (
            <button key={k} onClick={() => setPicks((s) => ({ ...s, [i]: k }))} className={cx('rounded-2xl p-2 text-left ring-2', picks[i] === k ? 'ring-ink-100' : 'ring-transparent')}>
              <Specimen fontId={t[k]} show={false} />
              <p className="mt-2 text-[13px] text-ink-300">{fontById(t[k]).label}</p>
            </button>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {i < TASKS.length - 1 && <Button onClick={() => setI(i + 1)}>Next →</Button>}
        <Button variant="primary" disabled={!TASKS.every((_, k) => answered(k))} onClick={submit}>Submit answers</Button>
        <Badge tone="outline">{TASKS.filter((_, k) => answered(k)).length}/{TASKS.length} answered</Badge>
      </div>
    </div>
  );
}
