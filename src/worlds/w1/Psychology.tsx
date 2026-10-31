import { useMemo, useState } from 'react';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx, type Criterion } from '../../components/lesson/LessonShell';
import { Button, Eyebrow, Note, Slider } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { contrastRatio, errorToScore, oklchToRgbGamut, rgbToOklch, wrapHue } from '../../lib/color';
import { AdPreview, MoodBars, MOODS, moodScores, pal, ROLES, type Mood, type Palette } from './palette';

const BASE = pal({ background: '#E9E2D6', surface: '#C9B79C', primary: '#6B4F3A', accent: '#C2552B', text: '#2A221C' });
const PRESETS: Record<Mood, Palette> = {
  calm: pal({ background: '#E6EEF0', surface: '#BFD3D8', primary: '#6E95A3', accent: '#4F7F8E', text: '#21363D' }),
  excitement: pal({ background: '#FFD23F', surface: '#FF6B35', primary: '#E5243B', accent: '#1B1B1E', text: '#1B1B1E' }),
  tension: pal({ background: '#121212', surface: '#3A0D0D', primary: '#B3001B', accent: '#E8E8E8', text: '#F2F2F2' }),
  nostalgia: pal({ background: '#E8D5B5', surface: '#C9A27A', primary: '#8C5A3C', accent: '#B4653A', text: '#3D2B1F' }),
  elegance: pal({ background: '#0F0F10', surface: '#26262A', primary: '#C8B07A', accent: '#C8B07A', text: '#EDEAE3' }),
};
const COPY = { brand: 'Maison Lumen', headline: 'Light, kept.', sub: 'Candles poured by hand in small batches.', cta: 'Discover' };

/** Transform a palette by mood dials: warmth (hue rotation toward orange/blue), saturation, lightness and contrast. */
function transform(p: Palette, d: { warmth: number; sat: number; light: number; contrast: number }): Palette {
  const out = {} as Palette;
  for (const r of ROLES) {
    let [L, C, h] = rgbToOklch(p[r]);
    const target = d.warmth >= 0 ? 55 : 240;
    const diff = ((target - h + 540) % 360) - 180;
    h = wrapHue(h + diff * Math.min(1, Math.abs(d.warmth)) * 0.6);
    C = C * d.sat;
    L = 0.5 + (L - 0.5) * d.contrast + d.light;
    out[r] = oklchToRgbGamut([Math.max(0, Math.min(1, L)), C, h]);
  }
  return out;
}

export default function Psychology({ level }: LevelProps) {
  return <LessonShell level={level} observe={<Observe />} experiment={<Experiment />}
    discover={
      <Concepts items={[
        { title: 'Temperature', body: 'Warm palettes read as energy, intimacy, appetite or danger; cool palettes as calm, trust, distance or cold. The same warmth can be cosy or alarming depending on everything else.' },
        { title: 'Saturation & lightness', body: 'Light, soft colour reads gentle and open; dark, deep colour reads serious or luxurious; high saturation reads loud and youthful.' },
        { title: 'Contrast', body: 'High contrast feels dramatic and confident; low contrast feels quiet, dreamy or vintage.' },
        { title: 'Culture changes meaning', body: 'White is purity and weddings in many Western contexts but mourning in parts of East Asia. Red is luck and celebration in China, danger or passion elsewhere, and a loss in Western finance.' },
        { title: 'Context changes meaning', body: 'Green on a food label says fresh; on skin it says sick. Lighting, subject, typography and audience all reshape how a palette feels. Treat associations as starting hypotheses, then test.' },
      ]} footer={<Note>The mood meters in this lesson use a transparent rule-of-thumb model of common Western design conventions (temperature, saturation, lightness, contrast, hue spread). They are a conversation starter, not a measurement of emotion.</Note>} />
    }
    challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

function Observe() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {MOODS.map((m, i) => <figure key={m}><AdPreview p={PRESETS[m]} copy={COPY} product="poster" /><figcaption className="mt-1 text-center font-display text-[16px] text-ink-200">{String.fromCharCode(65 + i)}</figcaption></figure>)}
      </div>
      <ObserveQuestion question="Five versions of one ad. Which one feels the calmest — and which the most tense?" options={['Calm A, tense C', 'Calm D, tense B', 'Calm E, tense C', 'They feel the same']}
        reveal={() => (
          <div className="space-y-2">
            <p>The palettes were designed as A calm · B excitement · C tension · D nostalgia · E elegance. Many people agree on A and C; the others overlap more (is E elegant or tense? Is D nostalgic or just warm?).</p>
            <p>That overlap is the lesson: colour <i>biases</i> feeling, but culture, context and the rest of the design finish the job.</p>
          </div>
        )} />
    </div>
  );
}

function Dials({ d, set }: { d: { warmth: number; sat: number; light: number; contrast: number }; set: (d: { warmth: number; sat: number; light: number; contrast: number }) => void }) {
  return (
    <div className="space-y-3">
      <Slider label="Cool ← temperature → Warm" value={d.warmth} min={-1} max={1} step={0.01} defaultValue={0} onChange={(warmth) => set({ ...d, warmth })} format={(v) => (v > 0 ? '+' : '') + Math.round(v * 100)} track="linear-gradient(to right,#3b6fd8,#888,#e38a2e)" />
      <Slider label="Saturation" value={d.sat} min={0} max={2} step={0.01} defaultValue={1} onChange={(sat) => set({ ...d, sat })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Lightness" value={d.light} min={-0.4} max={0.4} step={0.01} defaultValue={0} onChange={(light) => set({ ...d, light })} format={(v) => (v > 0 ? '+' : '') + Math.round(v * 100)} />
      <Slider label="Contrast" value={d.contrast} min={0.3} max={1.6} step={0.01} defaultValue={1} onChange={(contrast) => set({ ...d, contrast })} format={(v) => `${Math.round(v * 100)}%`} />
    </div>
  );
}

function Experiment() {
  const [d, setD] = useState({ warmth: 0, sat: 1, light: 0, contrast: 1 });
  const p = useMemo(() => transform(BASE, d), [d]);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[460px]"><AdPreview p={p} copy={COPY} product="poster" /></div>
      <div className="space-y-5 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
        <Dials d={d} set={setD} />
        <div><Eyebrow className="mb-2">Convention-based mood reading</Eyebrow><MoodBars p={p} /></div>
      </div>
    </div>
  );
}

const BRIEFS: { mood: Mood; title: string; text: string }[] = [
  { mood: 'calm', title: 'Meditation app launch', text: 'The ad must feel calm and restorative. Calm should be the strongest reading, with readable text.' },
  { mood: 'excitement', title: 'Energy drink summer drop', text: 'Loud, energetic, impossible to scroll past. Excitement should dominate.' },
  { mood: 'elegance', title: 'Luxury watch', text: 'Quiet confidence and craft. Elegance should lead, with nothing cheap or loud.' },
];

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const [i, setI] = useState(0);
  const [dials, setDials] = useState(() => BRIEFS.map(() => ({ warmth: 0, sat: 1, light: 0, contrast: 1 })));
  const pals = dials.map((d) => transform(BASE, d));
  const evaluate = (k: number): Criterion[] => {
    const m = moodScores(pals[k]);
    const target = m[BRIEFS[k].mood];
    const rival = Math.max(...MOODS.filter((x) => x !== BRIEFS[k].mood).map((x) => m[x]));
    const text = contrastRatio(pals[k].text, pals[k].background);
    return [
      { label: `${BRIEFS[k].title} · ${BRIEFS[k].mood} leads`, score: Math.round(Math.max(0, Math.min(100, 60 + (target - rival) * 3))), weight: 2, detail: `${BRIEFS[k].mood} ${target} vs strongest rival ${rival}.` },
      { label: `${BRIEFS[k].title} · strength`, score: Math.round(Math.min(100, target * 1.4)), weight: 1, detail: `${BRIEFS[k].mood} reading ${target}/100.` },
      { label: `${BRIEFS[k].title} · readable`, score: errorToScore(Math.max(0, 4.5 - text), 0, 2.5), weight: 1, detail: `Text contrast ${text.toFixed(2)}:1.` },
    ];
  };
  const submit = () => {
    const criteria = BRIEFS.flatMap((_, k) => evaluate(k));
    ctx.submit({
      score: weighted(criteria), criteria, subjective: true,
      worked: criteria.filter((c) => c.score >= 85).map((c) => c.label),
      improve: criteria.filter((c) => c.score < 70).map((c) => `${c.label}: ${c.detail}`),
      why: 'Brand teams brief in feelings. Translating a feeling into temperature, saturation, lightness and contrast — and knowing that the translation is cultural, not universal — is the professional skill.',
      visual: <div className="grid gap-3 sm:grid-cols-3">{pals.map((p, k) => <figure key={k}><AdPreview p={p} copy={COPY} product="poster" /><figcaption className="mt-1 text-[12px] text-ink-400">{BRIEFS[k].title}</figcaption></figure>)}</div>,
    });
  };
  return (
    <div>
      <ChallengeBrief title="Three briefs, three feelings" aside={<div className="flex flex-wrap gap-2">{BRIEFS.map((b, k) => <Button key={b.mood} size="sm" variant={k === i ? 'primary' : 'secondary'} onClick={() => setI(k)}>{k + 1}. {b.title}</Button>)}</div>}>{BRIEFS[i].text}</ChallengeBrief>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[440px]"><AdPreview p={pals[i]} copy={COPY} product="poster" /></div>
        <div className="space-y-5 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <Dials d={dials[i]} set={(d) => setDials((all) => all.map((x, k) => (k === i ? d : x)))} />
          {ctx.difficulty !== 'advanced' && <div><Eyebrow className="mb-2">Mood reading</Eyebrow><MoodBars p={pals[i]} highlight={BRIEFS[i].mood} /></div>}
          <Hint>{i === 0 ? 'Calm likes light, soft, slightly cool and low contrast.' : i === 1 ? 'Excitement likes high saturation, warmth and contrast.' : 'Elegance likes restraint: low saturation, strong value contrast, very dark or very light.'}</Hint>
          <Button variant="primary" onClick={submit}>Submit all three</Button>
        </div>
      </div>
    </div>
  );
}
