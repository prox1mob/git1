import { useState } from 'react';
import { ChallengeBrief, Concepts, LessonShell, ObserveQuestion, weighted, type ChallengeCtx, type Criterion } from '../../components/lesson/LessonShell';
import { Badge, Button, Eyebrow, Segmented, cx } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { clampWeight, fontById, FONTS, type FontDef, type TypeCategory } from '../../lib/fonts';

const CATS: { value: TypeCategory; label: string }[] = [
  { value: 'serif', label: 'Serif' }, { value: 'sans', label: 'Sans-serif' }, { value: 'mono', label: 'Monospace' }, { value: 'slab', label: 'Slab serif' }, { value: 'display', label: 'Display' },
];

export function Cover({ font, title = 'The Last Lighthouse', sub = 'A novel of the northern coast', author = 'Ingrid Vale', className }: { font: FontDef; title?: string; sub?: string; author?: string; className?: string }) {
  const w = (n: number) => clampWeight(font, n);
  return (
    <div className={cx('flex aspect-[3/4] flex-col justify-between rounded-lg bg-paper p-7 text-ink-950 shadow-xl shadow-black/40', className)} style={{ fontFamily: font.css }}>
      <p className="text-[12px] uppercase" style={{ letterSpacing: '0.2em', fontWeight: w(500) }}>{sub}</p>
      <div>
        <div className="mb-4 h-1 w-14 bg-[#b8432f]" />
        <h3 className="text-[42px] leading-[0.98]" style={{ fontWeight: w(700), textTransform: font.id === 'bebas' ? 'uppercase' : undefined }}>{title}</h3>
      </div>
      <p className="text-[16px]" style={{ fontWeight: w(400) }}>{author}</p>
    </div>
  );
}

function Traits({ f }: { f: FontDef }) {
  const rows: [string, string, number][] = [['Casual', 'Formal', f.traits.formal], ['Cool', 'Warm', f.traits.warm], ['Traditional', 'Modern', f.traits.modern], ['Quiet', 'Loud', f.traits.loud]];
  return (
    <ul className="space-y-2.5">
      {rows.map(([a, b, v]) => (
        <li key={a}>
          <div className="flex justify-between text-[11.5px] text-ink-400"><span>{a}</span><span>{b}</span></div>
          <div className="relative mt-1 h-1.5 rounded-full bg-ink-700"><div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-100" style={{ left: `${v * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export default function Families({ level }: LevelProps) {
  return <LessonShell level={level}
    observe={
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{['garamond', 'inter', 'jetbrains', 'abril'].map((f) => <Cover key={f} font={fontById(f)} />)}</div>
        <ObserveQuestion question="The same book, four typefaces. Which cover feels like a technical manual?" options={['The first', 'The second', 'The third', 'The fourth']}
          reveal={() => <p>The third — a monospaced face, where every letter takes the same width, like code or a typewriter. The first feels literary and classical (old-style serif), the second neutral and modern (sans), the fourth theatrical (fat-face display). Typeface choice changes the genre before anyone reads a word.</p>} />
      </div>
    }
    experiment={<Experiment />}
    discover={
      <Concepts items={[
        { title: 'Serif', body: 'Small strokes (serifs) finish the main strokes. Old-style (Garamond) feels classical and warm; transitional and Didone (Bodoni) feel formal and refined. Excellent for long reading in print.' },
        { title: 'Sans-serif', body: 'No serifs. Grotesques and neo-grotesques (Inter) feel neutral and modern; geometric sans (Montserrat) feel clean and confident; humanist sans feel friendlier.' },
        { title: 'Monospace', body: 'Every character has the same width. Essential for code and tabular data; signals “technical”, “raw” or “typewritten”.' },
        { title: 'Slab serif', body: 'Thick, block-like serifs with little contrast. Sturdy, mechanical, sometimes rustic — posters, packaging, workwear.' },
        { title: 'Display', body: 'Designed for big sizes and personality: condensed, fat, extended or decorative. Loud headlines, weak body text.' },
      ]} />
    }
    challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

function Experiment() {
  const [cat, setCat] = useState<TypeCategory>('serif');
  const [fid, setFid] = useState('garamond');
  const f = fontById(fid);
  const list = FONTS.filter((x) => x.category === cat);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="mx-auto w-full max-w-sm"><Cover font={f} /></div>
      <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
        <Segmented value={cat} onChange={(c) => { setCat(c); setFid(FONTS.find((x) => x.category === c)!.id); }} options={CATS} label="Category" />
        <div className="flex flex-wrap gap-2">{list.map((x) => <button key={x.id} onClick={() => setFid(x.id)} className={cx('h-10 rounded-full px-4 text-[15px] ring-1', fid === x.id ? 'bg-ink-100 text-ink-950 ring-ink-100' : 'text-ink-200 ring-ink-600')} style={{ fontFamily: x.css }}>{x.label}</button>)}</div>
        <div><p className="font-display text-[22px] text-ink-50">{f.label}</p><p className="text-[12.5px] text-ink-400">{f.classification}</p><p className="mt-2 text-[13.5px] leading-relaxed text-ink-300">{f.note}</p></div>
        <div><Eyebrow className="mb-2">Personality (curated, not measured)</Eyebrow><Traits f={f} /></div>
        <p className="text-[24px] leading-snug text-ink-100" style={{ fontFamily: f.css }}>Sphinx of black quartz, judge my vow. 0123456789</p>
      </div>
    </div>
  );
}

interface Brief { title: string; text: string; cats: TypeCategory[]; t: FontDef['traits'] }
const BRIEFS: Brief[] = [
  { title: 'Law firm annual report', text: 'Authority, tradition and trust. Long passages of reading.', cats: ['serif'], t: { formal: 0.85, warm: 0.55, modern: 0.35, loud: 0.2 } },
  { title: 'Coding bootcamp website', text: 'Technical credibility with energy; code snippets everywhere.', cats: ['mono', 'sans'], t: { formal: 0.35, warm: 0.3, modern: 0.95, loud: 0.4 } },
  { title: 'Craft brewery label', text: 'Hand-made, sturdy, a bit of swagger. Seen on a crowded shelf.', cats: ['slab', 'display'], t: { formal: 0.3, warm: 0.65, modern: 0.45, loud: 0.7 } },
  { title: 'Luxury perfume', text: 'Refined, feminine-coded elegance; the name will be set very large.', cats: ['serif', 'display'], t: { formal: 0.95, warm: 0.4, modern: 0.35, loud: 0.6 } },
  { title: 'Action film poster', text: 'Tall, tight, explosive title that dominates the frame.', cats: ['display'], t: { formal: 0.3, warm: 0.25, modern: 0.7, loud: 0.95 } },
  { title: 'Meditation app', text: 'Friendly, calm, contemporary, legible on small screens.', cats: ['sans'], t: { formal: 0.4, warm: 0.6, modern: 0.8, loud: 0.25 } },
];
const dist = (a: FontDef['traits'], b: FontDef['traits']) => Math.sqrt(((a.formal - b.formal) ** 2 + (a.warm - b.warm) ** 2 + (a.modern - b.modern) ** 2 + (a.loud - b.loud) ** 2) / 4);

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState<(string | null)[]>(() => BRIEFS.map(() => null));
  const b = BRIEFS[i];
  const submit = () => {
    const criteria: Criterion[] = BRIEFS.map((br, k) => {
      const f = picks[k] ? fontById(picks[k]!) : null;
      if (!f) return { label: br.title, score: 0, weight: 1, detail: 'No typeface chosen.' };
      const catOk = br.cats.includes(f.category);
      const d = dist(f.traits, br.t);
      return { label: br.title, score: Math.round((catOk ? 55 : 15) + 45 * Math.max(0, 1 - d / 0.4)), weight: 1, detail: `${f.label} (${f.classification}) — category ${catOk ? 'fits' : 'is unusual for this brief'}; personality distance ${(d * 100).toFixed(0)}/100.` };
    });
    ctx.submit({ score: weighted(criteria), criteria, subjective: true, worked: criteria.filter((c) => c.score >= 85).map((c) => c.label), improve: criteria.filter((c) => c.score < 70).map((c) => `${c.label}: ${c.detail}`),
      why: 'Typeface choice is mostly about genre and expectation. Matching category first and personality second gets you 90% of the way; the rest is taste — which is why the personality coordinates here are clearly labelled as curated opinion.' });
  };
  return (
    <div>
      <ChallengeBrief title={`Brief ${i + 1}: ${b.title}`} aside={<div className="flex flex-wrap gap-1.5">{BRIEFS.map((br, k) => <button key={br.title} onClick={() => setI(k)} className={cx('h-9 w-9 rounded-full text-[12.5px] ring-1', k === i ? 'bg-ink-100 text-ink-950 ring-ink-100' : picks[k] ? 'text-ink-100 ring-ink-500' : 'text-ink-500 ring-ink-700')}>{k + 1}</button>)}</div>}>{b.text}</ChallengeBrief>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="mx-auto w-full max-w-xs">{picks[i] ? <Cover font={fontById(picks[i]!)} title={b.title.split(' ').slice(0, 2).join(' ')} sub={b.text.split('.')[0]} author="Studio proposal" /> : <div className="grid aspect-[3/4] place-items-center rounded-lg bg-ink-850 text-[13px] text-ink-500 ring-1 ring-ink-700">Choose a typeface</div>}</div>
        <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FONTS.map((f) => (
              <button key={f.id} onClick={() => setPicks((p) => p.map((x, k) => (k === i ? f.id : x)))} className={cx('rounded-xl px-3 py-2.5 text-left ring-1', picks[i] === f.id ? 'bg-ink-100 text-ink-950 ring-ink-100' : 'text-ink-100 ring-ink-650 hover:ring-ink-400')}>
                <span className="block text-[20px] leading-tight" style={{ fontFamily: f.css }}>{f.id === 'bebas' ? 'AG' : 'Ag'} {f.label}</span>
                <span className={cx('text-[10.5px]', picks[i] === f.id ? 'text-ink-600' : 'text-ink-500')}>{CATS.find((c) => c.value === f.category)!.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {i < BRIEFS.length - 1 && <Button onClick={() => setI(i + 1)}>Next brief →</Button>}
            <Button variant="primary" disabled={picks.some((p) => !p)} onClick={submit}>Submit all six</Button>
            <Badge tone="outline">{picks.filter(Boolean).length}/{BRIEFS.length}</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
