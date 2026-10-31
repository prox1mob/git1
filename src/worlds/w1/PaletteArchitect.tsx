import { useState } from 'react';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx, type Criterion } from '../../components/lesson/LessonShell';
import { Button, Eyebrow, Note } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { contrastRatio, errorToScore, hueDelta, rangeScore, rgbToLch } from '../../lib/color';
import { AdPreview, MoodBars, PaletteEditor, chromaticHues, detectHarmony, moodScores, pal, ROLES, type AdCopy, type Mood, type Palette, type Product } from './palette';

interface Brief { id: string; title: string; product: Product; copy: AdCopy; text: string; moods: Mood[]; rubric: (p: Palette) => Criterion[] }
const lch = (p: Palette, r: keyof Palette) => rgbToLch(p[r]);
const readable = (p: Palette, need = 4.5): Criterion => { const c = contrastRatio(p.text, p.background); return { label: 'Readable text', score: errorToScore(Math.max(0, need - c), 0, 2.5), weight: 1, detail: `Text ${c.toFixed(2)}:1 (need ${need}:1).` }; };
const harmonious = (p: Palette): Criterion => { const hs = chromaticHues(Object.values(p)); if (!hs.length) return { label: 'Coherent hue relationship', score: 35, weight: 1, detail: 'No chromatic colour at all — a purely neutral palette has no hue relationship to judge.' }; const h = detectHarmony(hs); return { label: 'Coherent hue relationship', score: h.scheme === 'free' ? 30 : errorToScore(h.error, 15, 60), weight: 1, detail: `Reads as ${h.scheme}${h.error ? `, ~${Math.round(h.error)}° off` : ''}.` }; };
const moodC = (p: Palette, m: Mood, min = 55): Criterion => { const s = moodScores(p)[m]; return { label: `Feels ${m}`, score: rangeScore(s, min, 100, 35), weight: 1, detail: `${m} reading ${s}/100 (convention model).` }; };

export const BRIEFS: Brief[] = [
  {
    id: 'fashion', title: 'Fashion label', product: 'garment', moods: ['excitement', 'elegance'],
    copy: { brand: 'Atelier Nord', headline: 'Wear the weather.', sub: 'The AW collection, cut in Copenhagen.', cta: 'Shop the edit' },
    text: 'A Scandinavian label launching a bold autumn collection: confident, editorial, one fearless accent colour.',
    rubric: (p) => [
      { label: 'One fearless accent', score: rangeScore(lch(p, 'accent')[1], 50, 140, 25), weight: 1, detail: `Accent chroma C* ${lch(p, 'accent')[1].toFixed(0)}.` },
      { label: 'Accent stands out', score: errorToScore(Math.max(0, 3 - contrastRatio(p.accent, p.background)), 0, 1.5), weight: 1, detail: `Accent/background ${contrastRatio(p.accent, p.background).toFixed(2)}:1.` },
      readable(p), harmonious(p), moodC(p, 'excitement', 45),
    ],
  },
  {
    id: 'skincare', title: 'Skincare', product: 'bottle', moods: ['calm'],
    copy: { brand: 'Dew Lab', headline: 'Less, but better.', sub: 'Fragrance-free serum for sensitive skin.', cta: 'Find your routine' },
    text: 'A dermatologist-founded skincare brand: clean, gentle, trustworthy. Light and airy, soft colour, impeccable legibility (AAA).',
    rubric: (p) => [
      { label: 'Light, airy ground', score: rangeScore(lch(p, 'background')[0], 88, 100, 15), weight: 1, detail: `Background L* ${lch(p, 'background')[0].toFixed(0)}.` },
      { label: 'Soft colour', score: rangeScore(Math.max(lch(p, 'background')[1], lch(p, 'surface')[1]), 0, 20, 20), weight: 1, detail: `Background/surface chroma ≤ ${Math.max(lch(p, 'background')[1], lch(p, 'surface')[1]).toFixed(0)}.` },
      readable(p, 7), moodC(p, 'calm', 60),
    ],
  },
  {
    id: 'shoe', title: 'Luxury shoe', product: 'shoe', moods: ['elegance'],
    copy: { brand: 'Corvo', headline: 'Made slowly.', sub: 'Hand-lasted in Marche, Italy.', cta: 'Book a fitting' },
    text: 'A heritage shoemaker. Restraint, craft, premium: a near-black or near-white ground, at most one saturated colour, nothing loud.',
    rubric: (p) => {
      const L = lch(p, 'background')[0];
      const loud = ROLES.filter((r) => lch(p, r)[1] > 40).length;
      return [
        { label: 'Extreme ground (deep or pale)', score: L <= 22 || L >= 92 ? 100 : rangeScore(Math.min(Math.abs(L - 22), Math.abs(L - 92)), 0, 0, 25), weight: 1, detail: `Background L* ${L.toFixed(0)}.` },
        { label: 'Restraint', score: loud <= 1 ? 100 : loud === 2 ? 50 : 10, weight: 1, detail: `${loud} saturated colour${loud === 1 ? '' : 's'} (C* > 40).` },
        readable(p), moodC(p, 'elegance', 60),
      ];
    },
  },
  {
    id: 'tech', title: 'Tech product', product: 'device', moods: ['calm', 'excitement'],
    copy: { brand: 'Kinetic', headline: 'Think in real time.', sub: 'A laptop that never makes you wait.', cta: 'Pre-order' },
    text: 'A precise, trustworthy, innovative device brand. A cool primary (blues, cyans, violets) with one vivid, high-visibility accent.',
    rubric: (p) => {
      const h = lch(p, 'primary')[2];
      const cool = Math.min(Math.abs(hueDelta(h, 240)), 180);
      return [
        { label: 'Cool primary', score: rangeScore(cool, 0, 60, 50), weight: 1, detail: `Primary hue ${h.toFixed(0)}° (cool family ≈ 180–300°).` },
        { label: 'Vivid accent', score: rangeScore(lch(p, 'accent')[1], 45, 140, 25), weight: 1, detail: `Accent chroma C* ${lch(p, 'accent')[1].toFixed(0)}.` },
        { label: 'Accent visible', score: errorToScore(Math.max(0, 3 - contrastRatio(p.accent, p.background)), 0, 1.5), weight: 1, detail: `Accent/background ${contrastRatio(p.accent, p.background).toFixed(2)}:1.` },
        readable(p), harmonious(p),
      ];
    },
  },
];

const START = pal({ background: '#D9D4CC', surface: '#B8B1A6', primary: '#8C857B', accent: '#A69C8E', text: '#5F5A54' });

export default function PaletteArchitect({ level }: LevelProps) {
  return <LessonShell level={level}
    observe={
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[pal({ background: '#F6F3EE', surface: '#E7DED3', primary: '#C9B8A6', accent: '#8C6E54', text: '#2E2620' }), pal({ background: '#0E1A2B', surface: '#1C3354', primary: '#3E7BFA', accent: '#14E3C5', text: '#F1F5FB' }), pal({ background: '#121212', surface: '#262626', primary: '#E8E3D9', accent: '#B2945B', text: '#F2EFE9' }), pal({ background: '#FFF3E0', surface: '#FFB74D', primary: '#E64A19', accent: '#1A237E', text: '#1B1B1B' })].map((p, k) => (
            <AdPreview key={k} p={p} copy={{ brand: 'Brand', headline: 'Same words.', sub: 'Four different companies.', cta: 'Learn more' }} product="poster" />
          ))}
        </div>
        <ObserveQuestion question="Same words, four palettes. Match them to: skincare, tech, luxury, food delivery." options={['I can match them quickly', 'Some are ambiguous', 'They all feel the same']}
          reveal={() => <p>Most people place them as skincare (soft neutrals), tech (deep blue with a cyan spark), luxury (near-black with muted gold) and food delivery (warm, loud orange). A palette is often the fastest signal of what kind of company you are looking at — before a single word is read.</p>} />
      </div>
    }
    experiment={<Experiment />}
    discover={
      <Concepts items={[
        { title: 'Roles, not just colours', body: 'A working palette assigns jobs: background, surfaces, primary brand colour, an accent for actions, and text. Most of the area is background; the accent covers the least.' },
        { title: 'The 60–30–10 habit', body: 'Roughly 60% dominant, 30% secondary, 10% accent. Not a law, but it prevents the most common mistake: too many colours fighting at equal volume.' },
        { title: 'Brief first', body: 'Translate the brief’s adjectives into measurable colour decisions: “gentle” → light, low chroma; “premium” → restraint, deep or pale; “energetic” → saturation, warmth, contrast.' },
        { title: 'Accessibility is part of the palette', body: 'Pick text and accent colours that pass contrast from the start. Retro-fitting accessibility always costs more than designing it in.' },
      ]} />
    }
    challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

function Experiment() {
  const [p, setP] = useState<Palette>(BRIEFS[3] ? pal({ background: '#0E1A2B', surface: '#1C3354', primary: '#3E7BFA', accent: '#14E3C5', text: '#F1F5FB' }) : START);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[460px]"><AdPreview p={p} copy={BRIEFS[3].copy} product="device" /></div>
      <div className="space-y-5 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
        <PaletteEditor palette={p} onChange={setP} />
        <div><Eyebrow className="mb-2">Mood reading</Eyebrow><MoodBars p={p} /></div>
      </div>
    </div>
  );
}

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const [i, setI] = useState(0);
  const [pals, setPals] = useState<Palette[]>(() => BRIEFS.map(() => ({ ...START })));
  const b = BRIEFS[i];
  const live = b.rubric(pals[i]);
  const submit = () => {
    const criteria = BRIEFS.flatMap((br, k) => br.rubric(pals[k]).map((c) => ({ ...c, label: `${br.title} · ${c.label}` })));
    ctx.submit({
      score: weighted(criteria), criteria, subjective: true,
      worked: criteria.filter((c) => c.score >= 90).map((c) => c.label),
      improve: criteria.filter((c) => c.score < 70).map((c) => `${c.label}: ${c.detail}`),
      why: 'A palette is a brand’s fastest signal. Architecting it from roles, measurable constraints and the brief’s adjectives makes it defensible in a client meeting — and consistent across every screen and package.',
      meta: { contrast: Math.max(...pals.map((p) => contrastRatio(p.text, p.background))) },
      visual: <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{BRIEFS.map((br, k) => <figure key={br.id}><AdPreview p={pals[k]} copy={br.copy} product={br.product} /><figcaption className="mt-1 text-[12px] text-ink-400">{br.title}</figcaption></figure>)}</div>,
    });
  };
  return (
    <div>
      <ChallengeBrief title={`Brief ${i + 1}: ${b.title}`} aside={<div className="flex flex-wrap gap-2">{BRIEFS.map((br, k) => <Button key={br.id} size="sm" variant={k === i ? 'primary' : 'secondary'} onClick={() => setI(k)}>{k + 1}. {br.title}</Button>)}</div>}>{b.text}</ChallengeBrief>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[440px] space-y-3">
          <AdPreview p={pals[i]} copy={b.copy} product={b.product} />
          {ctx.difficulty === 'beginner' && <ul className="space-y-1 text-[12.5px]">{live.map((c) => <li key={c.label} className="flex justify-between"><span className="text-ink-300">{c.label}</span><span className={c.score >= 85 ? 'text-ok' : c.score >= 50 ? 'text-warn' : 'text-bad'}>{c.score}</span></li>)}</ul>}
        </div>
        <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <PaletteEditor palette={pals[i]} onChange={(p) => setPals((all) => all.map((x, k) => (k === i ? p : x)))} />
          <Hint>Start with the background (most area), then text (contrast), then the accent. Adjust the primary last.</Hint>
          <Note>Rubrics combine measurable constraints (contrast, lightness, chroma, hue family) with a convention-based mood reading.</Note>
          <Button variant="primary" onClick={submit}>Submit all four briefs</Button>
        </div>
      </div>
    </div>
  );
}
