import { useMemo, useState, type PointerEvent as RPointerEvent } from 'react';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx, type Criterion } from '../../components/lesson/LessonShell';
import { Badge, Button, Eyebrow, Segmented, Toggle, cx } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { contrastRatio, errorToScore, hslToRgb, hueDelta, rangeScore, rgbToHex, wrapHue } from '../../lib/color';
import { AdPreview, chromaticHues, detectHarmony, hueSpan, paletteFromHues, SCHEME_OFFSETS, type Palette, type Scheme } from './palette';

type S = Exclude<Scheme, 'free'>;
const SCHEMES: { value: S; label: string }[] = [
  { value: 'complementary', label: 'Complementary' }, { value: 'analogous', label: 'Analogous' }, { value: 'triadic', label: 'Triadic' }, { value: 'split-complementary', label: 'Split-comp.' }, { value: 'monochromatic', label: 'Mono' },
];
const COPY = { brand: 'Aural', headline: 'Hear the quiet.', sub: 'Studio sound, wherever you are.', cta: 'Pre-order now' };

/** A hue wheel with draggable handles. Drag the large handle to rotate the scheme; in free mode drag any handle. */
export function HarmonyWheel({ hues, onChange, free, size = 300 }: { hues: number[]; onChange: (h: number[]) => void; free: boolean; size?: number }) {
  const [drag, setDrag] = useState<number | null>(null);
  const R = size / 2, r = R * 0.78;
  const angleAt = (e: RPointerEvent<HTMLDivElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    return wrapHue((Math.atan2(e.clientX - b.left - b.width / 2, -(e.clientY - b.top - b.height / 2)) * 180) / Math.PI);
  };
  const pos = (h: number) => ({ left: R + Math.sin((h * Math.PI) / 180) * r, top: R - Math.cos((h * Math.PI) / 180) * r });
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    if (drag === null || !e.buttons) return;
    const a = angleAt(e);
    if (free) onChange(hues.map((h, i) => (i === drag ? a : h)));
    else { const d = hueDelta(hues[drag], a); onChange(hues.map((h) => wrapHue(h + d))); }
  };
  return (
    <div className="relative touch-none select-none" style={{ width: size, height: size }}
      onPointerDown={(e) => { const a = angleAt(e); let best = 0, bd = 999; hues.forEach((h, i) => { const d = Math.abs(hueDelta(h, a)); if (d < bd) { bd = d; best = i; } }); setDrag(best); e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={move} onPointerUp={() => setDrag(null)}
      role="slider" tabIndex={0} aria-label={`Harmony wheel. Base hue ${Math.round(hues[0])} degrees. Arrow keys rotate.`} aria-valuenow={Math.round(hues[0])}
      onKeyDown={(e) => { const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 5 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -5 : 0; if (d) { e.preventDefault(); onChange(hues.map((h) => wrapHue(h + d))); } }}>
      <div className="absolute inset-0 rounded-full" style={{ background: 'conic-gradient(from 0deg, hsl(0 85% 55%), hsl(60 85% 55%), hsl(120 85% 45%), hsl(180 85% 45%), hsl(240 85% 60%), hsl(300 85% 55%), hsl(360 85% 55%))' }} />
      <div className="absolute rounded-full bg-ink-900" style={{ inset: size * 0.2 }} />
      <svg className="pointer-events-none absolute inset-0" width={size} height={size}>
        {hues.map((h, i) => { const p = pos(h); return <line key={i} x1={R} y1={R} x2={p.left} y2={p.top} stroke="rgba(255,255,255,0.35)" strokeWidth={1.2} />; })}
      </svg>
      {hues.map((h, i) => {
        const p = pos(h);
        return <div key={i} className={cx('pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_0_0_1px_rgba(0,0,0,.6),0_4px_10px_rgba(0,0,0,.5)]', i === 0 ? 'h-9 w-9' : 'h-7 w-7')} style={{ ...p, background: rgbToHex(hslToRgb([h, 0.85, 0.52])) }} />;
      })}
    </div>
  );
}

function useScheme(initial: S = 'complementary', base = 20) {
  const [scheme, setScheme] = useState<S>(initial);
  const [hues, setHues] = useState<number[]>(() => SCHEME_OFFSETS[initial].map((o) => wrapHue(base + o)));
  const [free, setFree] = useState(false);
  const [dark, setDark] = useState(false);
  const choose = (s: S) => { setScheme(s); setHues(SCHEME_OFFSETS[s].map((o) => wrapHue(hues[0] + o))); };
  const palette = useMemo(() => paletteFromHues(hues, { dark, mono: scheme === 'monochromatic' && !free }), [hues, dark, scheme, free]);
  return { scheme, choose, hues, setHues, free, setFree, dark, setDark, palette };
}

function WheelPanel({ s, size = 280 }: { s: ReturnType<typeof useScheme>; size?: number }) {
  const h = detectHarmony(chromaticHues(Object.values(s.palette)));
  return (
    <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
      <Segmented size="sm" value={s.scheme} onChange={s.choose} options={SCHEMES} label="Scheme" />
      <div className="flex justify-center"><HarmonyWheel hues={s.hues} onChange={s.setHues} free={s.free} size={size} /></div>
      <div className="flex flex-wrap gap-4"><Toggle checked={s.free} onChange={s.setFree} label="Free handles (break the rules)" /><Toggle checked={s.dark} onChange={s.setDark} label="Dark background" /></div>
      <p className="text-[12.5px] text-ink-400">Reads as <b className="capitalize text-ink-100">{h.scheme}</b>{h.error > 0 ? ` (off by ~${Math.round(h.error)}°)` : ''}. Hues: {s.hues.map((x) => `${Math.round(x)}°`).join(' · ')}</p>
    </div>
  );
}

export default function Harmony({ level }: LevelProps) {
  return <LessonShell level={level} observe={<Observe />} experiment={<Experiment />}
    discover={
      <Concepts items={[
        { title: 'Complementary', body: 'Two hues opposite each other. Maximum contrast and vibration — perfect for making one element (a button, a product) pop against its surroundings. Use one as the dominant, the other sparingly.' },
        { title: 'Analogous', body: 'Neighbouring hues within about 60°. Calm, cohesive, natural — like a sunset or a forest. Needs value contrast, because hue contrast is low.' },
        { title: 'Triadic', body: 'Three hues evenly spaced. Lively and balanced; usually one dominates and two support, or it gets loud.' },
        { title: 'Split-complementary', body: 'A base hue plus the two neighbours of its complement. The punch of complementary with less tension; forgiving for beginners.' },
        { title: 'Monochromatic', body: 'One hue in different lightness and saturation. Elegant and unified; hierarchy comes entirely from value.' },
        { title: 'Rules are starting points', body: 'Schemes guarantee relationships, not beauty. Proportion (who dominates), value contrast and saturation matter as much as the angles.' },
      ]} />
    }
    challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

function Observe() {
  const a = paletteFromHues([210, 190, 230]);
  const b = paletteFromHues([210, 30, 30]);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <figure><AdPreview p={a} copy={COPY} /><figcaption className="mt-2 font-display text-[17px] text-ink-100">A</figcaption></figure>
        <figure><AdPreview p={b} copy={COPY} /><figcaption className="mt-2 font-display text-[17px] text-ink-100">B</figcaption></figure>
      </div>
      <ObserveQuestion question="Same layout, same blue background. In which ad does the ‘Pre-order now’ button grab you faster?" options={['A', 'B', 'Equal']}
        reveal={() => <p>B. In A, every colour is a neighbour of blue (analogous): harmonious and calm, but nothing breaks out. In B the button and product are orange — blue’s complement — so the eye goes straight to them. Same hues on a wheel, different relationships, different jobs.</p>} />
    </div>
  );
}

function Experiment() {
  const s = useScheme('complementary', 210);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <WheelPanel s={s} />
      <div className="mx-auto w-full max-w-[460px]"><AdPreview p={s.palette} copy={COPY} /></div>
    </div>
  );
}

const BRIEFS = [
  { id: 'calm', title: 'Calm & cohesive', text: 'A meditation-sound edition. The ad should feel serene and unified: all colours within a narrow analogous family (span ≤ 60°), nothing shouting.' },
  { id: 'pop', title: 'Make the button pop', text: 'Launch day. The call-to-action must be the first thing seen: accent hue at least 150° from the background hue, and accent/background contrast at least 3:1.' },
  { id: 'triadic', title: 'Playful triadic', text: 'A youth edition. Three hues roughly 120° apart (±20°), with readable text (4.5:1).' },
];

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  // Each brief starts from the 'wrong' scheme so the relationship has to be designed, not accepted.
  const states = [useScheme('complementary', 30), useScheme('analogous', 200), useScheme('analogous', 10)];
  const [i, setI] = useState(0);
  const s = states[i];
  const evalBrief = (k: number, p: Palette): Criterion[] => {
    const hues = chromaticHues(Object.values(p));
    const text = contrastRatio(p.text, p.background);
    if (k === 0) {
      const span = hueSpan(hues);
      return [
        { label: 'Calm · analogous span', score: rangeScore(span, 0, 60, 60), weight: 2, detail: `Chromatic hues span ${Math.round(span)}°.` },
        { label: 'Calm · readable text', score: errorToScore(Math.max(0, 4.5 - text), 0, 2.5), weight: 1, detail: `Text contrast ${text.toFixed(2)}:1.` },
      ];
    }
    if (k === 1) {
      const gap = Math.abs(hueDelta(states[1].hues[0], states[1].hues[states[1].hues.length - 1]));
      const accentGap = Math.abs(hueDelta(chromaticHues([p.background], 3)[0] ?? states[1].hues[0], chromaticHues([p.accent], 3)[0] ?? 0));
      const ac = contrastRatio(p.accent, p.background);
      return [
        { label: 'Pop · hue opposition', score: rangeScore(Math.max(gap, accentGap), 150, 180, 60), weight: 2, detail: `Accent sits ${Math.round(accentGap)}° from the background hue.` },
        { label: 'Pop · accent contrast', score: errorToScore(Math.max(0, 3 - ac), 0, 2), weight: 2, detail: `Accent/background ${ac.toFixed(2)}:1.` },
      ];
    }
    const h = detectHarmony(hues);
    return [
      { label: 'Triadic · spacing', score: h.scheme === 'triadic' ? errorToScore(h.error, 20, 50) : 20, weight: 2, detail: `Reads as ${h.scheme}, off by ~${Math.round(h.error)}°.` },
      { label: 'Triadic · readable text', score: errorToScore(Math.max(0, 4.5 - text), 0, 2.5), weight: 1, detail: `Text contrast ${text.toFixed(2)}:1.` },
    ];
  };
  const submit = () => {
    const criteria = states.flatMap((st, k) => evalBrief(k, st.palette));
    ctx.submit({
      score: weighted(criteria), criteria,
      worked: criteria.filter((c) => c.score >= 90).map((c) => `${c.label} — ${c.detail}`),
      improve: criteria.filter((c) => c.score < 90).map((c) => `${c.label}: ${c.detail}`),
      why: 'Harmony schemes are a vocabulary for intent: analogous to soothe, complementary to direct the eye, triadic to energise. The measurement here checks the relationships; whether the result is beautiful is still your call.',
      meta: { contrast: Math.max(...states.map((st) => contrastRatio(st.palette.text, st.palette.background))) },
      visual: <div className="grid gap-3 sm:grid-cols-3">{states.map((st, k) => <figure key={k}><AdPreview p={st.palette} copy={COPY} /><figcaption className="mt-1 text-[12px] text-ink-400">{BRIEFS[k].title}</figcaption></figure>)}</div>,
    });
  };
  const live = evalBrief(i, s.palette);
  return (
    <div>
      <ChallengeBrief title="Three briefs, one advertisement" aside={<div className="flex flex-wrap gap-2">{BRIEFS.map((b, k) => <Button key={b.id} size="sm" variant={k === i ? 'primary' : 'secondary'} onClick={() => setI(k)}>{k + 1}. {b.title}</Button>)}</div>}>
        {BRIEFS[i].text}
      </ChallengeBrief>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <WheelPanel s={s} size={260} />
          {ctx.difficulty === 'beginner' && <div className="flex flex-wrap gap-2">{live.map((c) => <Badge key={c.label} tone={c.score >= 85 ? 'ok' : c.score >= 50 ? 'warn' : 'bad'}>{c.label.split('· ')[1]} {c.score}</Badge>)}</div>}
          <Hint>{i === 0 ? 'Choose Analogous and keep the handles close; a light background keeps it serene.' : i === 1 ? 'Complementary puts the accent opposite the base. Check the contrast badge — a dark background helps a bright accent.' : 'Triadic, then rotate the whole scheme until the colours feel right. Text stays dark on a light ground.'}</Hint>
          <div className="flex gap-2"><Eyebrow className="self-center">All three briefs are scored together</Eyebrow><Button variant="primary" onClick={submit}>Submit</Button></div>
        </div>
        <div className="mx-auto w-full max-w-[440px]"><AdPreview p={s.palette} copy={COPY} /></div>
      </div>
    </div>
  );
}
