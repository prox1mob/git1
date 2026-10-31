import { useState } from 'react';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx, type Criterion } from '../../components/lesson/LessonShell';
import { Button, Eyebrow } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { contrastRatio, errorToScore, hueDelta, rangeScore, rgbToHex, rgbToLch } from '../../lib/color';
import { useSaveToGallery } from '../../lib/gallery';
import { MoodBars, PaletteEditor, chromaticHues, detectHarmony, features, moodScores, pal, ROLES, type Palette } from './palette';

export function Poster({ p, id }: { p: Palette; id?: string }) {
  const c = (r: keyof Palette) => rgbToHex(p[r]);
  return (
    <svg id={id} viewBox="0 0 500 700" className="w-full rounded-xl shadow-2xl shadow-black/50" role="img" aria-label="Jazz festival poster in the current palette">
      <rect width="500" height="700" fill={c('background')} />
      <circle cx="320" cy="250" r="190" fill={c('surface')} />
      <path d="M210 120 C 250 120 260 170 250 230 L 235 360 C 230 420 290 440 320 405 C 340 385 360 400 345 430 C 315 490 205 470 205 380 L 220 230 C 225 180 200 150 175 150 Z" fill={c('primary')} />
      <circle cx="248" cy="275" r="7" fill={c('background')} /><circle cx="244" cy="305" r="7" fill={c('background')} /><circle cx="240" cy="335" r="7" fill={c('background')} />
      <text x="40" y="545" fill={c('primary')} fontFamily="Bodoni Moda Variable, serif" fontWeight="700" fontSize="64" letterSpacing="-1">After Hours</text>
      <text x="42" y="585" fill={c('accent')} fontFamily="Inter Variable, sans-serif" fontWeight="700" fontSize="18" letterSpacing="5">12 – 15 NOVEMBER · OLD TOWN</text>
      <text x="42" y="620" fill={c('text')} fontFamily="Inter Variable, sans-serif" fontSize="14">Four nights of late-night jazz in candle-lit cellars.</text>
      <text x="42" y="642" fill={c('text')} fontFamily="Inter Variable, sans-serif" fontSize="14">Trios, quartets and the occasional surprise.</text>
      <rect x="350" y="612" width="110" height="40" rx="20" fill={c('accent')} />
      <text x="405" y="637" textAnchor="middle" fill={contrastRatio([1, 1, 1], p.accent) > contrastRatio([0.05, 0.05, 0.05], p.accent) ? '#fff' : '#111'} fontFamily="Inter Variable, sans-serif" fontWeight="700" fontSize="14">Tickets</text>
      <text x="40" y="60" fill={c('text')} fontFamily="Inter Variable, sans-serif" fontWeight="600" fontSize="12" letterSpacing="4" opacity="0.8">THE CITY JAZZ SOCIETY PRESENTS</text>
    </svg>
  );
}

const START = pal({ background: '#E4E4E4', surface: '#CFCFCF', primary: '#9A9A9A', accent: '#B0B0B0', text: '#A5A5A5' });
const BAD = pal({ background: '#FF2D55', surface: '#00C2FF', primary: '#FFE600', accent: '#7CFF00', text: '#FFFFFF' });
const GOOD = pal({ background: '#1B1412', surface: '#3A2620', primary: '#E9C58A', accent: '#D9643A', text: '#E9DFD2' });

export function evaluatePoster(p: Palette): Criterion[] {
  const head = contrastRatio(p.primary, p.background), body = contrastRatio(p.text, p.background), cta = contrastRatio(p.accent, p.background), surf = contrastRatio(p.surface, p.background);
  const hues = chromaticHues(Object.values(p));
  const h = detectHarmony(hues);
  const m = moodScores(p), f = features(p);
  const others = ROLES.filter((r) => r !== 'accent').map((r) => rgbToLch(p[r]));
  const acc = rgbToLch(p.accent);
  const accentUnique = acc[1] >= 25 && (acc[1] >= Math.max(...others.map((o) => o[1])) - 5 || others.every((o) => o[1] < 12 || Math.abs(hueDelta(o[2], acc[2])) > 35));
  return [
    { label: 'Readability', score: Math.round((errorToScore(Math.max(0, 4.5 - body), 0, 2.5) + errorToScore(Math.max(0, 3 - head), 0, 1.5) + errorToScore(Math.max(0, 3 - cta), 0, 1.5)) / 3), weight: 2, detail: `Headline ${head.toFixed(1)}:1 · body ${body.toFixed(1)}:1 · CTA ${cta.toFixed(1)}:1.` },
    { label: 'Hierarchy', score: Math.round((rangeScore(head - surf, 1.5, 21, 2) + (accentUnique ? 100 : 30)) / 2), weight: 2, detail: `Headline out-contrasts the background shape by ${(head - surf).toFixed(1)}; accent ${accentUnique ? 'is' : 'is not'} the single loudest colour.` },
    hues.length === 0
      ? { label: 'Harmony', score: 35, weight: 1, detail: 'No chromatic colour: there is no hue relationship yet.' }
      : { label: 'Harmony', score: h.scheme === 'free' ? 30 : errorToScore(h.error, 15, 60), weight: 1, detail: `Reads as ${h.scheme}${h.error ? `, ~${Math.round(h.error)}° off` : ''}.` },
    { label: 'Atmosphere: intimate, warm, sophisticated', score: Math.round((rangeScore((m.elegance + m.nostalgia) / 2, 55, 100, 30) + rangeScore(f.warmth, 0.05, 1, 0.25)) / 2), weight: 2, detail: `Elegance ${m.elegance}, nostalgia ${m.nostalgia}, warmth ${(f.warmth * 100).toFixed(0)}.` },
  ];
}

export default function MasterOfColour({ level }: LevelProps) {
  return <LessonShell level={level}
    observe={
      <div className="space-y-5">
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2"><Poster p={BAD} /><Poster p={GOOD} /></div>
        <ObserveQuestion question="Both posters use five colours. Why does one feel like a jazz night and the other like a children’s party?" options={['Saturation', 'Temperature', 'Value contrast', 'All of these, working together']}
          reveal={() => <p>All of them. The right poster is dark, warm, low in saturation except for one accent, with strong value contrast for type. The left one has five equally loud, unrelated hues — no hierarchy, no atmosphere, and white text that barely reads on hot pink. Mastery is making harmony, contrast, hierarchy and mood agree.</p>} />
      </div>
    }
    experiment={<Experiment />}
    discover={
      <Concepts items={[
        { title: 'Everything at once', body: 'Real briefs don’t isolate skills. Harmony, contrast, hierarchy and mood must agree — and when they conflict, the brief decides which wins.' },
        { title: 'Order of decisions', body: 'Atmosphere (temperature, value) → hierarchy (what is loudest) → legibility (contrast checks) → harmony (refine hue relationships) → detail.' },
        { title: 'One loud voice', body: 'Let one colour carry the action or the key information. If everything shouts, nothing is heard.' },
      ]} />
    }
    challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

function Experiment() {
  const [p, setP] = useState<Palette>(GOOD);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[420px]"><Poster p={p} /></div>
      <div className="space-y-5 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750"><PaletteEditor palette={p} onChange={setP} /><div><Eyebrow className="mb-2">Mood reading</Eyebrow><MoodBars p={p} /></div></div>
    </div>
  );
}

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const [p, setP] = useState<Palette>(START);
  const save = useSaveToGallery();
  const live = evaluatePoster(p);
  const submit = () => {
    const criteria = evaluatePoster(p);
    ctx.submit({
      score: weighted(criteria), criteria, subjective: true,
      worked: criteria.filter((c) => c.score >= 85).map((c) => `${c.label}: ${c.detail}`),
      improve: criteria.filter((c) => c.score < 70).map((c) => `${c.label}: ${c.detail}`),
      why: 'A professional palette survives every test at once: it reads, it ranks information, it feels right for the audience and its colours belong together. This rubric checks each of those separately so you can see which one is holding you back.',
      meta: { contrast: contrastRatio(p.text, p.background) },
      visual: <div className="mx-auto max-w-xs"><Poster p={p} /></div>,
    });
  };
  const saveImg = async () => {
    const el = document.getElementById('master-poster');
    if (!el) return;
    const svg = new XMLSerializer().serializeToString(el);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 1000; c.height = 1400;
    c.getContext('2d')!.drawImage(img, 0, 0, 1000, 1400);
    await save({ title: 'After Hours — festival poster', source: 'Master of Colour', image: c.toDataURL('image/jpeg', 0.92) });
  };
  return (
    <div>
      <ChallengeBrief title="After Hours: a late-night jazz festival">
        The client wants the poster to feel <b>intimate, warm and sophisticated</b>. The title must read from across a street, the dates and ticket button must be unmissable, and the body copy must be comfortably legible. Five colours, five jobs.
      </ChallengeBrief>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[420px] space-y-3">
          <Poster p={p} id="master-poster" />
          {ctx.difficulty === 'beginner' && <ul className="space-y-1 text-[12.5px]">{live.map((c) => <li key={c.label} className="flex justify-between gap-3"><span className="text-ink-300">{c.label}</span><span className={c.score >= 85 ? 'text-ok' : c.score >= 50 ? 'text-warn' : 'text-bad'}>{c.score}</span></li>)}</ul>}
        </div>
        <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <PaletteEditor palette={p} onChange={setP} />
          <Hint>Think candle-lit cellar: a very dark warm background, a muted surface, a pale warm headline, one rich accent for the dates and the button.</Hint>
          <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={submit}>Submit poster</Button><Button variant="ghost" onClick={saveImg}>Save to gallery</Button></div>
        </div>
      </div>
    </div>
  );
}
