import { useState } from 'react';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx, type Criterion } from '../../components/lesson/LessonShell';
import { Badge, Button, Slider } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { rangeScore } from '../../lib/color';
import { clampWeight, fontById } from '../../lib/fonts';
import { useTypeMetrics } from '../../lib/typeMetrics';

interface Spec { id: string; title: string; font: string; weight: number; size: number; caps: boolean; text: string; tracking: number; leading: number; measure: number; targets: { tracking: [number, number]; leading?: [number, number]; cpl?: [number, number] }; why: string }
const BODY = 'Good typography is invisible. When the spacing is right, the reader forgets the page and follows the thought. Too tight and the words crowd into a grey wall; too loose and the eye loses its place at the end of every line and has to hunt for the next one. Line length matters as much as line spacing: very long lines tire the eye, very short ones chop the rhythm into fragments.';
const SPECS: Spec[] = [
  { id: 'body', title: 'Body paragraph', font: 'sourceserif', weight: 400, size: 17, caps: false, text: BODY, tracking: -25, leading: 1.02, measure: 105, targets: { tracking: [-10, 15], leading: [1.4, 1.7], cpl: [50, 75] }, why: 'Body text needs air between lines (≈1.4–1.7×), neutral tracking and 50–75 characters per line.' },
  { id: 'label', title: 'All-caps label', font: 'inter', weight: 600, size: 14, caps: true, text: 'New collection · Autumn / Winter · Shop now', tracking: 0, leading: 1.2, measure: 70, targets: { tracking: [60, 180] }, why: 'Capitals were designed to start words, not fill them. Set in a row they need extra tracking (+60 to +180‰ em) to breathe.' },
  { id: 'display', title: 'Display headline', font: 'playfair', weight: 700, size: 64, caps: false, text: 'Where the quiet things are kept', tracking: 40, leading: 1.6, measure: 18, targets: { tracking: [-35, 0], leading: [0.92, 1.15] }, why: 'Big type magnifies gaps: headlines usually want tighter tracking and leading close to 1× so the lines read as one shape.' },
];

function Sample({ s, tracking, leading, measure, cpl }: { s: Spec; tracking: number; leading: number; measure: number; cpl?: number }) {
  const f = fontById(s.font);
  return (
    <div className="overflow-hidden rounded-xl bg-paper p-6 text-ink-950 sm:p-8">
      <p style={{ fontFamily: f.css, fontWeight: clampWeight(f, s.weight), fontSize: s.size, letterSpacing: `${tracking / 1000}em`, lineHeight: leading, maxWidth: `${measure}ch`, textTransform: s.caps ? 'uppercase' : undefined }}>{s.text}</p>
      {cpl !== undefined && <p className="mt-3 font-mono text-[11px] text-ink-500">≈ {Math.round(cpl)} characters per line</p>}
    </div>
  );
}

export function useCpl(s: Spec, measure: number, tracking: number) {
  const m = useTypeMetrics(s.font, s.weight);
  if (!m) return undefined;
  // `ch` = width of "0"; estimate characters per line from the measured average glyph width plus tracking.
  const zero = 0.55;
  return (measure * zero) / (m.avgWidth + tracking / 1000);
}

export default function TrackingLeading({ level }: LevelProps) {
  return <LessonShell level={level}
    observe={
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2"><Sample s={SPECS[0]} tracking={-25} leading={1.02} measure={110} /><Sample s={SPECS[0]} tracking={0} leading={1.55} measure={62} /></div>
        <ObserveQuestion question="Same paragraph, same typeface and size. Which one would you rather read a whole chapter of?" options={['Left', 'Right']}
          reveal={() => <p>Almost everyone picks the right. The left is set with negative tracking, leading of 1.0 and very long lines: a dense grey wall where your eye loses its place. The right has neutral tracking, about 1.55× leading and a comfortable line length. Nothing about the letters changed — only the space around them.</p>} />
      </div>
    }
    experiment={<Experiment />}
    discover={
      <Concepts items={[
        { title: 'Tracking', body: 'Uniform spacing added to or removed from a whole run of text, measured in thousandths of an em. Unlike kerning, it changes every gap equally.' },
        { title: 'Leading', body: 'The distance from one baseline to the next — named after the strips of lead used in metal type. Expressed here as a multiple of the font size.' },
        { title: 'Measure', body: 'The length of a line. About 50–75 characters is the classic comfortable range for continuous reading; screens and small text tolerate slightly less.' },
        { title: 'Size changes the rules', body: 'Small text likes slightly open tracking and generous leading. Large headlines want tighter tracking and leading near 1. All-caps always want more tracking.' },
        { title: 'Density and rhythm', body: 'Spacing sets the texture (“colour”) of a text block. Even, mid-grey texture reads calmly; patchy texture with rivers and gaps reads as careless.' },
      ]} />
    }
    challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

function Controls({ s, v, set, cpl }: { s: Spec; v: { tracking: number; leading: number; measure: number }; set: (v: { tracking: number; leading: number; measure: number }) => void; cpl?: number }) {
  return (
    <div className="space-y-3">
      <Slider label="Tracking (‰ em)" value={v.tracking} min={-60} max={250} step={1} onChange={(tracking) => set({ ...v, tracking })} format={(x) => (x > 0 ? '+' : '') + x} defaultValue={0} />
      {s.id !== 'label' && <Slider label="Leading (× size)" value={v.leading} min={0.8} max={2.2} step={0.01} onChange={(leading) => set({ ...v, leading })} format={(x) => x.toFixed(2)} />}
      {s.id === 'body' && <Slider label="Measure (line length)" value={v.measure} min={20} max={120} step={1} onChange={(measure) => set({ ...v, measure })} format={(x) => `${x}ch`} hint={cpl ? `≈ ${Math.round(cpl)} characters per line` : undefined} />}
    </div>
  );
}

function Experiment() {
  const s = SPECS[0];
  const [v, setV] = useState({ tracking: 0, leading: 1.5, measure: 64 });
  const cpl = useCpl(s, v.measure, v.tracking);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Sample s={s} tracking={v.tracking} leading={v.leading} measure={v.measure} cpl={cpl} />
      <div className="rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750"><Controls s={s} v={v} set={setV} cpl={cpl} /></div>
    </div>
  );
}

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const [i, setI] = useState(0);
  const [vals, setVals] = useState(() => SPECS.map((s) => ({ tracking: s.tracking, leading: s.leading, measure: s.measure })));
  const s = SPECS[i];
  const cpls = [useCpl(SPECS[0], vals[0].measure, vals[0].tracking), undefined, undefined];
  const judge = (k: number): Criterion[] => {
    const sp = SPECS[k], v = vals[k], t = sp.targets;
    const out: Criterion[] = [{ label: `${sp.title} · tracking`, score: rangeScore(v.tracking, t.tracking[0], t.tracking[1], 40), weight: 1, detail: `${v.tracking > 0 ? '+' : ''}${v.tracking}‰ em (aim ${t.tracking[0]} to ${t.tracking[1]}).` }];
    if (t.leading) out.push({ label: `${sp.title} · leading`, score: rangeScore(v.leading, t.leading[0], t.leading[1], 0.3), weight: 1, detail: `${v.leading.toFixed(2)}× (aim ${t.leading[0]}–${t.leading[1]}).` });
    if (t.cpl && cpls[k] !== undefined) out.push({ label: `${sp.title} · line length`, score: rangeScore(cpls[k]!, t.cpl[0], t.cpl[1], 25), weight: 1, detail: `≈ ${Math.round(cpls[k]!)} characters per line (aim ${t.cpl[0]}–${t.cpl[1]}).` });
    return out;
  };
  const submit = () => {
    const criteria = SPECS.flatMap((_, k) => judge(k));
    ctx.submit({ score: weighted(criteria), criteria, worked: criteria.filter((c) => c.score === 100).map((c) => c.label), improve: criteria.filter((c) => c.score < 100).map((c) => `${c.label}: ${c.detail}`),
      why: 'These ranges are long-established typographic conventions, backed by readability research for continuous text. They are starting points: a fashion headline may break them on purpose — but only after you know where they are.' });
  };
  return (
    <div>
      <ChallengeBrief title={`${i + 1}. ${s.title}`} aside={<div className="flex flex-wrap gap-2">{SPECS.map((sp, k) => <Button key={sp.id} size="sm" variant={k === i ? 'primary' : 'secondary'} onClick={() => setI(k)}>{k + 1}. {sp.title}</Button>)}</div>}>Three specimens were set badly. Fix the spacing of each so it reads well at its size and job.</ChallengeBrief>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Sample s={s} tracking={vals[i].tracking} leading={vals[i].leading} measure={vals[i].measure} cpl={i === 0 ? cpls[0] : undefined} />
        <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <Controls s={s} v={vals[i]} set={(v) => setVals((all) => all.map((x, k) => (k === i ? v : x)))} cpl={i === 0 ? cpls[0] : undefined} />
          {ctx.difficulty === 'beginner' && <div className="flex flex-wrap gap-2">{judge(i).map((c) => <Badge key={c.label} tone={c.score >= 90 ? 'ok' : c.score >= 50 ? 'warn' : 'bad'}>{c.label.split(' · ')[1]} {c.score}</Badge>)}</div>}
          <Hint>{s.why}</Hint>
          <Button variant="primary" onClick={submit}>Submit all three</Button>
        </div>
      </div>
    </div>
  );
}
