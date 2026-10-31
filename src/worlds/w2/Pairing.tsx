import { useState } from 'react';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx, type Criterion } from '../../components/lesson/LessonShell';
import { Badge, Button, Eyebrow, cx } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { clampWeight, fontById, FONTS, type FontDef } from '../../lib/fonts';
import { useTypeMetrics, type TypeMetrics } from '../../lib/typeMetrics';

function Article({ head, body, kicker = 'Design', title = 'The Architecture of Quiet', text }: { head: FontDef; body: FontDef; kicker?: string; title?: string; text?: string }) {
  return (
    <article className="rounded-xl bg-paper p-7 text-ink-950 shadow-xl shadow-black/40">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b8432f]" style={{ fontFamily: body.css }}>{kicker}</p>
      <h3 className="mt-2 text-[40px] leading-[1.02]" style={{ fontFamily: head.css, fontWeight: clampWeight(head, 700), textTransform: head.id === 'bebas' ? 'uppercase' : undefined }}>{title}</h3>
      <p className="mt-4 text-[15.5px] leading-[1.6]" style={{ fontFamily: body.css, fontWeight: clampWeight(body, 400) }}>{text ?? 'A good building, like a good page, is mostly empty space arranged with intent. The architect Tadao Ando once said that he designs walls in order to frame the sky; the typographer designs letters in order to frame the reader’s attention. Both are judged by what you notice — and by what you don’t.'}</p>
    </article>
  );
}

export function pairingReport(h: FontDef, b: FontDef, mh: TypeMetrics | null, mb: TypeMetrics | null) {
  const same = h.id === b.id;
  const sameCat = h.category === b.category;
  const relation = same ? 'concord' : sameCat ? 'conflict' : 'contrast';
  const bodyOk = b.use !== 'display';
  const xr = mh && mb ? Math.abs(mh.xHeight / mh.capHeight - mb.xHeight / mb.capHeight) : 0.05;
  return { relation, bodyOk, xr };
}

export default function Pairing({ level }: LevelProps) {
  return <LessonShell level={level}
    observe={
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2"><Article head={fontById('playfair')} body={fontById('inter')} /><Article head={fontById('inter')} body={fontById('dmsans')} /></div>
        <ObserveQuestion question="Which pairing feels more intentional?" options={['Left', 'Right', 'Both']}
          reveal={() => <p>Most people prefer the left: a high-contrast serif headline with a neutral sans body — clearly different roles. The right pairs two similar sans-serifs: close enough to look like an accident, different enough to feel slightly off. That uneasy middle ground is called <b>conflict</b>.</p>} />
      </div>
    }
    experiment={<Experiment />}
    discover={
      <Concepts items={[
        { title: 'Concord', body: 'One family for everything, using weight and size for contrast. Safe, unified, sometimes monotonous.' },
        { title: 'Contrast', body: 'Two clearly different faces with different jobs — typically a characterful display serif with a neutral sans, or vice versa. Most editorial design lives here.' },
        { title: 'Conflict', body: 'Two faces that are similar but not the same (two geometric sans, two transitional serifs). The eye senses a difference without a reason.' },
        { title: 'Shared proportions', body: 'Pairs harmonise when they share structure: similar x-height ratios, compatible widths, a common era or construction.' },
        { title: 'Roles matter', body: 'Display faces belong in headlines. Body text needs a face designed for reading at small sizes.' },
      ]} />
    }
    challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

function Picker({ value, onChange, label }: { value: string; onChange: (id: string) => void; label: string }) {
  return (
    <div>
      <Eyebrow className="mb-2">{label}</Eyebrow>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {FONTS.map((f) => <button key={f.id} onClick={() => onChange(f.id)} className={cx('rounded-lg px-2.5 py-2 text-left text-[15px] ring-1', value === f.id ? 'bg-ink-100 text-ink-950 ring-ink-100' : 'text-ink-200 ring-ink-650 hover:ring-ink-400')} style={{ fontFamily: f.css }}>{f.label}</button>)}
      </div>
    </div>
  );
}

function Experiment() {
  const [h, setH] = useState('playfair'), [b, setB] = useState('inter');
  const mh = useTypeMetrics(h), mb = useTypeMetrics(b);
  const r = pairingReport(fontById(h), fontById(b), mh, mb);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-3"><Article head={fontById(h)} body={fontById(b)} />
        <div className="flex flex-wrap gap-2"><Badge tone={r.relation === 'conflict' ? 'warn' : 'ok'}>{r.relation}</Badge><Badge tone={r.bodyOk ? 'ok' : 'bad'}>{r.bodyOk ? 'body face suits reading' : 'display face used for body'}</Badge><Badge tone="outline">x-height ratio difference {(r.xr * 100).toFixed(0)}%</Badge></div>
      </div>
      <div className="space-y-5 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750"><Picker label="Headline face" value={h} onChange={setH} /><Picker label="Body face" value={b} onChange={setB} /></div>
    </div>
  );
}

interface Brief { title: string; text: string; head: { cats: FontDef['category'][] }; ideal: string; kicker: string; headline: string }
const BRIEFS: Brief[] = [
  { title: 'Culture magazine', text: 'A weekend culture magazine: classic authority in the headlines, modern clarity in long reads.', head: { cats: ['serif', 'display'] }, ideal: 'contrast', kicker: 'Culture', headline: 'The Return of the Salon' },
  { title: 'Product landing page', text: 'A developer-tools company: precise, technical, contemporary. Must read perfectly on screens.', head: { cats: ['sans', 'mono'] }, ideal: 'any', kicker: 'Release 4.0', headline: 'Ship faster, sleep better' },
  { title: 'Literary book jacket copy', text: 'A literary novel’s jacket and inside flap: warm, bookish, timeless.', head: { cats: ['serif'] }, ideal: 'any', kicker: 'A novel', headline: 'The Salt Orchard' },
];

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const [i, setI] = useState(0);
  const [pairs, setPairs] = useState(() => BRIEFS.map(() => ({ h: 'bebas', b: 'abril' })));
  const m = Object.fromEntries(FONTS.map((f) => [f.id, useTypeMetrics(f.id)])) as Record<string, TypeMetrics | null>; // eslint-disable-line react-hooks/rules-of-hooks
  const judge = (k: number): Criterion[] => {
    const br = BRIEFS[k], p = pairs[k], h = fontById(p.h), b = fontById(p.b);
    const r = pairingReport(h, b, m[p.h], m[p.b]);
    const techBody = k === 1 ? (b.category === 'sans' || b.category === 'mono' ? 100 : 40) : k === 2 ? (b.category === 'serif' ? 100 : 45) : (b.category === 'sans' || b.category === 'serif' ? 100 : 40);
    return [
      { label: `${br.title} · relationship`, score: r.relation === 'conflict' ? 30 : br.ideal === 'contrast' && r.relation !== 'contrast' ? 65 : 100, weight: 1, detail: `${h.label} + ${b.label}: ${r.relation}.` },
      { label: `${br.title} · body readability`, score: r.bodyOk ? 100 : 15, weight: 1, detail: r.bodyOk ? `${b.label} is designed for reading.` : `${b.label} is a display face — it breaks down in paragraphs.` },
      { label: `${br.title} · fits the brief`, score: Math.round((br.head.cats.includes(h.category) ? 50 : 15) + techBody / 2), weight: 1, detail: `Headline: ${h.classification}. Body: ${b.classification}.` },
      { label: `${br.title} · shared proportions`, score: r.relation === 'concord' ? 100 : Math.max(0, Math.round(100 - Math.max(0, r.xr - 0.04) * 900)), weight: 0.5, detail: `x-height/cap-height ratios differ by ${(r.xr * 100).toFixed(0)}% (measured).` },
    ];
  };
  const submit = () => {
    const criteria = BRIEFS.flatMap((_, k) => judge(k));
    ctx.submit({ score: weighted(criteria), criteria, subjective: true, worked: criteria.filter((c) => c.score === 100).map((c) => c.label), improve: criteria.filter((c) => c.score < 70).map((c) => `${c.label}: ${c.detail}`),
      why: 'Pairing is about giving each typeface a clear job. Contrast or concord both work; conflict — two near-twins — rarely does. Measurable checks (x-height proportions, text vs display design) support, but do not replace, judgement.' });
  };
  const br = BRIEFS[i];
  return (
    <div>
      <ChallengeBrief title={`${i + 1}. ${br.title}`} aside={<div className="flex flex-wrap gap-2">{BRIEFS.map((b, k) => <Button key={b.title} size="sm" variant={k === i ? 'primary' : 'secondary'} onClick={() => setI(k)}>{k + 1}. {b.title}</Button>)}</div>}>{br.text}</ChallengeBrief>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Article head={fontById(pairs[i].h)} body={fontById(pairs[i].b)} kicker={br.kicker} title={br.headline} />
          {ctx.difficulty === 'beginner' && <div className="flex flex-wrap gap-2">{judge(i).map((c) => <Badge key={c.label} tone={c.score >= 90 ? 'ok' : c.score >= 50 ? 'warn' : 'bad'}>{c.label.split(' · ')[1]} {c.score}</Badge>)}</div>}
        </div>
        <div className="space-y-5 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <Picker label="Headline face" value={pairs[i].h} onChange={(h) => setPairs((all) => all.map((x, k) => (k === i ? { ...x, h } : x)))} />
          <Picker label="Body face" value={pairs[i].b} onChange={(b) => setPairs((all) => all.map((x, k) => (k === i ? { ...x, b } : x)))} />
          <Hint>Pick the body face first — it does most of the work. Then choose a headline face that is clearly different (or the same family, bolder).</Hint>
          <Button variant="primary" onClick={submit}>Submit all three</Button>
        </div>
      </div>
    </div>
  );
}
