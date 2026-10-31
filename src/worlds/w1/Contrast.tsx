import { useMemo, useState } from 'react';
import { ColourPicker } from '../../components/color/ColourPicker';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx, type Criterion } from '../../components/lesson/LessonShell';
import { Badge, Button, Eyebrow, Segmented, Slider, Toggle, cx } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { contrastRatio, deltaERgb, errorToScore, hexToRgb, oklchToRgbGamut, relativeLuminance, rgbToHex, rgbToOklch, wcag, type RGB } from '../../lib/color';

const hex = (h: string) => hexToRgb(h)!;

function Badges({ fg, bg }: { fg: RGB; bg: RGB }) {
  const w = wcag(fg, bg);
  const b = (ok: boolean, l: string) => <Badge tone={ok ? 'ok' : 'bad'}>{ok ? '✓' : '✕'} {l}</Badge>;
  return <div className="flex flex-wrap gap-1.5">{b(w.aaNormal, 'AA text 4.5')}{b(w.aaLarge, 'AA large 3')}{b(w.aaaNormal, 'AAA text 7')}{b(w.aaaLarge, 'AAA large 4.5')}{b(w.nonText, 'UI 3')}</div>;
}

function Specimen({ fg, bg, grey }: { fg: RGB; bg: RGB; grey?: boolean }) {
  return (
    <div className="rounded-xl p-6 ring-1 ring-white/10" style={{ background: rgbToHex(bg), color: rgbToHex(fg), filter: grey ? 'grayscale(1)' : undefined }}>
      <p className="font-['Playfair_Display_Variable'] text-[30px] font-bold leading-tight">Large headline, 24 px bold</p>
      <p className="mt-2 text-[16px] leading-relaxed">Body text at 16 px needs at least 4.5:1 contrast to meet WCAG AA. Small, thin type is where low contrast hurts most.</p>
      <p className="mt-2 text-[12px] opacity-100">Caption · 12 px</p>
      <button className="mt-3 rounded-full px-4 py-2 text-[14px] font-semibold ring-2" style={{ borderColor: rgbToHex(fg), color: rgbToHex(fg) }} tabIndex={-1}>Outline button</button>
    </div>
  );
}

export default function Contrast({ level }: LevelProps) {
  return <LessonShell level={level} observe={<Observe />} experiment={<Experiment />}
    discover={
      <Concepts items={[
        { title: 'Luminance, not hue', body: 'Readability depends on the difference in light between text and background. Two colours of different hue but equal luminance are nearly unreadable — even with perfect colour vision.' },
        { title: 'The contrast ratio', body: 'WCAG computes relative luminance (L) of each colour and then (L1 + 0.05) / (L2 + 0.05). It runs from 1:1 (identical) to 21:1 (black on white).' },
        { title: 'AA and AAA', body: 'AA: 4.5:1 for normal text, 3:1 for large text (≥ 24 px, or ≥ 18.7 px bold). AAA: 7:1 and 4.5:1. Icons, inputs and focus rings need 3:1 against their surroundings.' },
        { title: 'Hierarchy with contrast', body: 'Use contrast steps to rank information: primary text strongest, secondary softer, but never below the minimum. Low contrast is a style choice only when it is still readable.' },
        { title: 'Not just colour', body: 'About 1 in 12 men and 1 in 200 women have a colour-vision deficiency. Never rely on hue alone to carry meaning — pair it with luminance, shape or text.' },
        { title: 'Limits of the formula', body: 'WCAG 2 contrast is a simple, testable rule, not a full perception model. It can over-rate some dark colour pairs; newer models (like APCA) are under discussion.' },
      ]} />
    }
    challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

function Observe() {
  const pairs: [string, string][] = [['#FFFFFF', '#F4A259'], ['#767676', '#FFFFFF'], ['#E0457B', '#3A7BD5'], ['#1A1A1A', '#F4F2ED']];
  const [grey, setGrey] = useState(false);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {pairs.map(([f, b], i) => (
          <div key={i} className="rounded-xl p-5 ring-1 ring-white/10" style={{ background: b, color: f, filter: grey ? 'grayscale(1)' : undefined }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Sample {i + 1}</p>
            <p className="mt-2 text-[15px] leading-snug">The quick brown fox reads the small print.</p>
          </div>
        ))}
      </div>
      <Toggle checked={grey} onChange={setGrey} label="View in greyscale" />
      <ObserveQuestion question="Which samples are hard to read? (Try the greyscale toggle afterwards.)" options={['1 and 3', '2 only', '3 only', 'All are fine']}
        reveal={() => (
          <div className="space-y-2">
            <p>Measured: {pairs.map(([f, b], i) => `#${i + 1} ${contrastRatio(hex(f), hex(b)).toFixed(2)}:1`).join(' · ')}.</p>
            <p>Sample 3 is vivid but nearly unreadable: pink and blue have similar <b>luminance</b>, so in greyscale they almost merge. Sample 1 — white on a friendly orange — is a classic brand failure. Sample 2 sits just at the AA line. Greyscale reveals what contrast really is.</p>
          </div>
        )} />
    </div>
  );
}

function Experiment() {
  const [fg, setFg] = useState<RGB>(hex('#7A6F66'));
  const [bg, setBg] = useState<RGB>(hex('#F4F2ED'));
  const [edit, setEdit] = useState<'fg' | 'bg'>('fg');
  const [grey, setGrey] = useState(false);
  const ratio = contrastRatio(fg, bg);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Specimen fg={fg} bg={bg} grey={grey} />
        <div className="rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <div className="flex items-baseline justify-between"><p className="num font-display text-[44px] text-ink-50">{ratio.toFixed(2)}:1</p><Toggle checked={grey} onChange={setGrey} label="Greyscale" /></div>
          <Badges fg={fg} bg={bg} />
          <p className="mt-3 font-mono text-[12px] text-ink-400">L(text) = {relativeLuminance(fg).toFixed(3)} · L(background) = {relativeLuminance(bg).toFixed(3)} → ({Math.max(relativeLuminance(fg), relativeLuminance(bg)).toFixed(3)} + 0.05) / ({Math.min(relativeLuminance(fg), relativeLuminance(bg)).toFixed(3)} + 0.05)</p>
        </div>
        <div className="rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <Eyebrow className="mb-3">Hierarchy by contrast</Eyebrow>
          <div className="space-y-1 rounded-xl p-4" style={{ background: rgbToHex(bg) }}>
            {[1, 0.72, 0.5].map((k, i) => {
              const c = fg.map((v, j) => v * k + bg[j] * (1 - k)) as RGB;
              return <p key={i} style={{ color: rgbToHex(c) }} className={i === 0 ? 'text-[18px] font-semibold' : 'text-[14px]'}>{['Primary information', 'Secondary information', 'Tertiary hint'][i]} — {contrastRatio(c, bg).toFixed(2)}:1</p>;
            })}
          </div>
        </div>
      </div>
      <div className="space-y-3 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
        <Segmented value={edit} onChange={setEdit} options={[{ value: 'fg', label: 'Text colour' }, { value: 'bg', label: 'Background' }]} />
        {edit === 'fg' ? <ColourPicker key="fg" value={fg} onChange={setFg} wheelSize={180} /> : <ColourPicker key="bg" value={bg} onChange={setBg} wheelSize={180} />}
      </div>
    </div>
  );
}

interface Case { id: string; title: string; fg: string; bg: string; adjust: 'fg' | 'bg'; need: number; large: boolean; note: string }
const CASES: Case[] = [
  { id: 'btn', title: 'Orange button', fg: '#FFFFFF', bg: '#F4A259', adjust: 'bg', need: 4.5, large: false, note: 'White 16 px label on the brand orange button. Adjust the button colour.' },
  { id: 'caption', title: 'Grey caption', fg: '#A3A3A3', bg: '#FFFFFF', adjust: 'fg', need: 4.5, large: false, note: 'Captions in a light grey on white. Adjust the grey.' },
  { id: 'teal', title: 'Teal headline', fg: '#4CC2B8', bg: '#FFFFFF', adjust: 'fg', need: 3, large: true, note: 'A 28 px bold headline in brand teal. Large text: 3:1 is enough.' },
  { id: 'purple', title: 'Purple on navy', fg: '#7766C4', bg: '#22264F', adjust: 'fg', need: 4.5, large: false, note: 'Body text in brand violet on a dark navy panel. Adjust the violet.' },
];

/** Smallest lightness change (OkLCh, hue and chroma kept) that meets the target. */
function optimalFix(c: Case) {
  const orig = hex(c.adjust === 'fg' ? c.fg : c.bg);
  const other = hex(c.adjust === 'fg' ? c.bg : c.fg);
  const [L, C, h] = rgbToOklch(orig);
  let best: RGB = orig;
  for (let d = 0; d <= 1; d += 0.002) {
    for (const s of [-1, 1]) {
      const cand = oklchToRgbGamut([Math.min(1, Math.max(0, L + s * d)), C, h]);
      if (contrastRatio(cand, other) >= c.need) { best = cand; return { best, dE: deltaERgb(orig, best) }; }
    }
  }
  return { best, dE: deltaERgb(orig, best) };
}

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const [i, setI] = useState(0);
  const [lch, setLch] = useState(() => CASES.map((c) => rgbToOklch(hex(c.adjust === 'fg' ? c.fg : c.bg))));
  const c = CASES[i];
  const cur = (k: number) => oklchToRgbGamut(lch[k]);
  const pair = (k: number) => { const cs = CASES[k]; const adj = cur(k); return cs.adjust === 'fg' ? { fg: adj, bg: hex(cs.bg) } : { fg: hex(cs.fg), bg: adj }; };
  const optimal = useMemo(() => CASES.map(optimalFix), []);
  const { fg, bg } = pair(i);
  const ratio = contrastRatio(fg, bg);
  const submit = () => {
    const criteria: Criterion[] = CASES.flatMap((cs, k) => {
      const p = pair(k);
      const r = contrastRatio(p.fg, p.bg);
      const orig = hex(cs.adjust === 'fg' ? cs.fg : cs.bg);
      const dE = deltaERgb(orig, cur(k));
      return [
        { label: `${cs.title} · passes ${cs.need}:1`, score: r >= cs.need ? 100 : Math.round((r / cs.need) * 50), weight: 2, detail: `${r.toFixed(2)}:1 (${cs.large ? 'large text' : 'normal text'}).` },
        { label: `${cs.title} · brand preserved`, score: errorToScore(Math.max(0, dE - optimal[k].dE), 2, 20), weight: 1, detail: `Changed by ΔE00 ${dE.toFixed(1)}; the smallest passing change is ΔE00 ${optimal[k].dE.toFixed(1)}.` },
      ];
    });
    ctx.submit({
      score: weighted(criteria), criteria,
      worked: criteria.filter((x) => x.score >= 95).map((x) => x.label),
      improve: criteria.filter((x) => x.score < 80).map((x) => `${x.label}: ${x.detail}`),
      why: 'Accessible colour is not about making everything black and white — it is about finding the version of the brand colour that everyone can read. Adjusting lightness while keeping hue and chroma usually preserves brand recognition.',
      meta: { contrast: Math.max(...CASES.map((_, k) => contrastRatio(pair(k).fg, pair(k).bg))) },
      visual: <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{CASES.map((cs, k) => { const p = pair(k); return <div key={cs.id} className="rounded-xl p-4 text-[14px]" style={{ background: rgbToHex(p.bg), color: rgbToHex(p.fg) }}><b>{cs.title}</b><br />{contrastRatio(p.fg, p.bg).toFixed(2)}:1</div>; })}</div>,
    });
  };
  return (
    <div>
      <ChallengeBrief title="Fix four failing brand colours" aside={<div className="flex flex-wrap gap-2">{CASES.map((cs, k) => <Button key={cs.id} size="sm" variant={k === i ? 'primary' : 'secondary'} onClick={() => setI(k)}>{k + 1}. {cs.title}</Button>)}</div>}>
        Reach the required WCAG ratio while changing the brand colour as little as possible. Each fix is compared with the smallest possible passing change.
      </ChallengeBrief>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-xl p-8" style={{ background: c.id === 'btn' ? '#ffffff' : rgbToHex(bg), color: rgbToHex(fg) }}>
          {c.id === 'btn' ? (
            <div className="grid place-items-center py-10"><span className="rounded-full px-8 py-4 text-[16px] font-semibold" style={{ background: rgbToHex(bg), color: rgbToHex(fg) }}>Add to basket</span></div>
          ) : c.large ? <p className="font-['Playfair_Display_Variable'] text-[34px] font-bold leading-tight">A headline in the brand colour</p> : <p className="text-[16px] leading-relaxed">This is body copy set at sixteen pixels. Readers with low vision, older eyes, glare on a phone or a cheap screen all need enough contrast to read it comfortably.</p>}
        </div>
        <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <p className="text-[13px] text-ink-300">{c.note}</p>
          <p className={cx('num font-display text-[40px]', ratio >= c.need ? 'text-ok' : 'text-ink-50')}>{ratio.toFixed(2)}:1 <span className="text-[14px] text-ink-400">need {c.need}:1</span></p>
          <Badges fg={fg} bg={bg} />
          <Slider label="Lightness (OkLCh)" value={lch[i][0]} min={0} max={1} step={0.002} onChange={(v) => setLch((a) => a.map((x, k) => (k === i ? [v, x[1], x[2]] : x)))} format={(v) => `${Math.round(v * 100)}%`} track={`linear-gradient(to right, #000, ${rgbToHex(oklchToRgbGamut([0.6, lch[i][1], lch[i][2]]))}, #fff)`} />
          <Slider label="Chroma" value={lch[i][1]} min={0} max={0.3} step={0.002} onChange={(v) => setLch((a) => a.map((x, k) => (k === i ? [x[0], v, x[2]] : x)))} format={(v) => v.toFixed(3)} />
          <p className="text-[12px] text-ink-400">Hue is locked at {Math.round(lch[i][2])}° to protect the brand. Change from original: ΔE00 {deltaERgb(hex(c.adjust === 'fg' ? c.fg : c.bg), cur(i)).toFixed(1)}.</p>
          <Hint>Move lightness only. For dark text on light grounds go darker; for light text on dark grounds go lighter; for a white label on a coloured button, darken the button.</Hint>
          <Button variant="primary" onClick={submit}>Submit all four</Button>
        </div>
      </div>
    </div>
  );
}
