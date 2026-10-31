import { useMemo, useState } from 'react';
import { GradeCanvas } from '../../components/grading/GradeCanvas';
import { Scope } from '../../components/grading/Scopes';
import { Concepts, LessonShell, ObserveQuestion, weighted, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Badge, Button, Eyebrow, Note, Segmented, Toggle, cx } from '../../components/ui';
import type { Frame } from '../../engine/GradeEngine';
import { defaultParams, type CaptureSpec, type GradeParams, type SourceSpec } from '../../engine/params';
import type { LevelProps } from '../../game/registry';
import { mulberry32, shuffle } from '../../lib/random';

const SOURCES: { label: string; source: SourceSpec; aspect: number; rolloff?: number }[] = [
  { label: 'Still life', source: { kind: 'scene', scene: 'stilllife' }, aspect: 3 / 2 },
  { label: 'Portrait', source: { kind: 'scene', scene: 'portrait', variant: 3, params: [3, 1, 0, 0] }, aspect: 3 / 2 },
  { label: 'Test pattern', source: { kind: 'scene', scene: 'bars' }, aspect: 16 / 9, rolloff: 0 },
  { label: 'Coast', source: { kind: 'scene', scene: 'coast' }, aspect: 3 / 2 },
];

interface Problem { id: string; label: string; capture?: CaptureSpec; params?: Partial<GradeParams>; tell: string }
const PROBLEMS: Problem[] = [
  { id: 'over', label: 'Overexposed / clipped highlights', capture: { exposure: 1.8 }, params: { rolloff: 0 }, tell: 'The waveform piles up in a flat line at 100% and the histogram is pushed against the right wall.' },
  { id: 'under', label: 'Underexposed', capture: { exposure: -2 }, tell: 'Everything sits in the bottom third of the waveform; the histogram hugs the left.' },
  { id: 'crushed', label: 'Crushed blacks', params: { blacks: -1, contrast: 0.25 }, tell: 'A flat line along 0% on the waveform: shadow detail merged into pure black.' },
  { id: 'warm', label: 'Warm (orange) cast', capture: { castTemp: 3300 }, tell: 'In the parade, red stands taller than blue across the image; the vectorscope blob leans toward red/yellow.' },
  { id: 'green', label: 'Green cast', capture: { castTint: 50, castTemp: 6000 }, tell: 'Green is the tallest channel in the parade; neutrals on the vectorscope drift toward the G target.' },
  { id: 'oversat', label: 'Oversaturated', params: { saturation: 1.9 }, tell: 'The vectorscope trace stretches far out toward (and past) the target boxes.' },
  { id: 'flat', label: 'Flat / low contrast', params: { contrast: -0.75 }, tell: 'The waveform is squeezed into a narrow band in the middle; nothing near 0% or 100%.' },
  { id: 'fine', label: 'Technically fine', tell: 'Levels span the range without piling up, channels align on neutrals and saturation sits inside the targets.' },
];

export default function Scopes({ level }: LevelProps) {
  return <LessonShell level={level} observe={<Observe />} experiment={<Experiment />} discover={<Discover />} challenge={(ctx) => <Detective ctx={ctx} />} />;
}

function Observe() {
  const [f, setF] = useState<Frame | null>(null);
  const p = useMemo(() => defaultParams(), []);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <GradeCanvas source={{ kind: 'scene', scene: 'facade' }} params={p} aspect={3 / 2} onAnalysis={setF} label="Facade" />
        <div><Scope frame={f} kind="waveform" /><p className="mt-2 text-[12px] text-ink-400">Waveform of the image on the left.</p></div>
      </div>
      <ObserveQuestion
        question="The waveform is a strange picture of the image. What do you think its horizontal axis represents?"
        options={['Time', 'Position across the image, left to right', 'Colour', 'Brightness']}
        reveal={() => <p>Left-to-right on the waveform <b>is</b> left-to-right in the image; the vertical axis is brightness (0–100%). That is why you can see the building’s grid of windows as a pattern, the bright sky at the top-left and the dark lobby along the bottom. Each column of pixels becomes a column of dots stacked by brightness.</p>}
      />
    </div>
  );
}

function ScopeGrid({ frame }: { frame: Frame | null }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div><Eyebrow className="mb-1">Waveform (luma)</Eyebrow><Scope frame={frame} kind="waveform" /></div>
      <div><Eyebrow className="mb-1">RGB parade</Eyebrow><Scope frame={frame} kind="parade" /></div>
      <div><Eyebrow className="mb-1">Vectorscope</Eyebrow><div className="mx-auto max-w-[260px]"><Scope frame={frame} kind="vectorscope" /></div></div>
      <div><Eyebrow className="mb-1">Histogram</Eyebrow><Scope frame={frame} kind="histogram" /></div>
    </div>
  );
}

function Experiment() {
  const [si, setSi] = useState(0);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [frame, setFrame] = useState<Frame | null>(null);
  const s = SOURCES[si];
  const active = PROBLEMS.filter((p) => on[p.id] && p.id !== 'fine');
  const capture: CaptureSpec = Object.assign({}, ...active.map((p) => p.capture ?? {}));
  const params = useMemo(() => defaultParams({ rolloff: s.rolloff ?? 0.5, ...Object.assign({}, ...active.map((p) => p.params ?? {})) }), [JSON.stringify(active.map((a) => a.id)), s.rolloff]);
  return (
    <div className="space-y-4">
      <Segmented value={si} onChange={setSi} label="Image" options={SOURCES.map((x, i) => ({ value: i, label: x.label }))} />
      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          <GradeCanvas source={s.source} capture={capture} params={params} aspect={s.aspect} onAnalysis={setFrame} label="Image with injected problems" />
          <div className="rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
            <Eyebrow className="mb-3">Inject a problem</Eyebrow>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {PROBLEMS.filter((p) => p.id !== 'fine').map((p) => <Toggle key={p.id} checked={!!on[p.id]} onChange={(v) => setOn((o) => ({ ...o, [p.id]: v }))} label={p.label} />)}
            </div>
          </div>
          {active.length > 0 && <Note>{active.map((a) => a.tell).join(' ')}</Note>}
        </div>
        <ScopeGrid frame={frame} />
      </div>
    </div>
  );
}

function Discover() {
  return (
    <Concepts items={[
      { title: 'Waveform', body: 'Each image column becomes a column of dots stacked by brightness, 0% at the bottom, 100% at the top. It shows exposure and contrast at a glance, and where in the frame they happen.' },
      { title: 'RGB parade', body: 'Three waveforms side by side, one per channel. On anything neutral the three should match in height. A channel standing taller is a cast you can see and measure.' },
      { title: 'Vectorscope', body: 'A colour wheel of the whole image: angle is hue, distance from the centre is saturation. Neutrals sit in the middle; the boxes mark 75% primaries; the dashed line is the skin line.' },
      { title: 'Histogram', body: 'A count of pixels per brightness. It loses position information but makes clipping obvious: spikes against either wall.' },
      { title: 'Why trust scopes', body: 'Your eyes adapt and screens lie. Scopes measure the signal itself, so two colourists on different monitors can agree on what is really there.' },
    ]} />
  );
}

const ROUNDS = 5;
function Detective({ ctx }: { ctx: ChallengeCtx }) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const quiz = useMemo(() => {
    const rng = mulberry32(seed);
    return shuffle(rng, PROBLEMS).slice(0, ROUNDS).map((p) => ({ problem: p, src: SOURCES[Math.floor(rng() * 2)], options: shuffle(rng, [p, ...shuffle(rng, PROBLEMS.filter((x) => x.id !== p.id)).slice(0, 3)]) }));
  }, [seed]);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>(() => Array(ROUNDS).fill(null));
  const [frame, setFrame] = useState<Frame | null>(null);
  const q = quiz[i];
  const answered = answers[i] !== null;
  const params = useMemo(() => defaultParams({ ...q.problem.params }), [q]);
  const done = answers.every((a) => a !== null);

  const submit = () => {
    const criteria = quiz.map((qq, k) => ({ label: `Case ${k + 1}`, score: answers[k] === qq.problem.id ? 100 : 0, weight: 1, detail: `Answer: ${PROBLEMS.find((p) => p.id === answers[k])?.label ?? '—'}. Truth: ${qq.problem.label}.` }));
    const wrong = quiz.filter((qq, k) => answers[k] !== qq.problem.id);
    ctx.submit({
      score: weighted(criteria), criteria,
      worked: criteria.filter((c) => c.score === 100).length ? [`You diagnosed ${criteria.filter((c) => c.score === 100).length} of ${ROUNDS} images from scopes alone.`] : [],
      improve: wrong.map((w) => `${w.problem.label}: ${w.problem.tell}`),
      why: 'Diagnosing from scopes is a professional reflex: it works on any monitor, in any room, at any hour. Once you can read problems blind, you stop being fooled by your screen or your tired eyes.',
    });
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-ink-850 px-5 py-4 ring-1 ring-ink-750">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-signal">The brief</p>
          <h2 className="mt-1 font-display text-[24px] text-ink-50">Scope detective</h2>
          <p className="mt-1.5 text-[14px] text-ink-300">Five images, hidden. Only their scopes are visible. Diagnose each one; the image is revealed after you answer.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => { setSeed(Math.floor(Math.random() * 1e9)); setAnswers(Array(ROUNDS).fill(null)); setI(0); }}>New cases</Button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {quiz.map((_, k) => (
          <button key={k} onClick={() => setI(k)} className={cx('h-10 w-10 rounded-full text-[13px] ring-1', k === i ? 'bg-ink-100 text-ink-950 ring-ink-100' : answers[k] ? 'text-ink-200 ring-ink-500' : 'text-ink-400 ring-ink-700')}>{k + 1}</button>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <div className="relative">
            <div className={cx('transition-opacity', answered ? 'opacity-100' : 'opacity-0')}>
              <GradeCanvas key={`${seed}-${i}`} source={q.src.source} capture={q.problem.capture} params={params} aspect={q.src.aspect} onAnalysis={setFrame} label={answered ? 'Revealed image' : 'Hidden image'} />
            </div>
            {!answered && <div className="absolute inset-0 grid place-items-center rounded-xl bg-ink-850 text-[13px] text-ink-400 ring-1 ring-ink-700">Image hidden — read the scopes</div>}
          </div>
          <div className="rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
            <p className="mb-3 text-[14px] text-ink-100">What is wrong with this image?</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((o) => {
                const chosen = answers[i] === o.id;
                const correct = answered && o.id === q.problem.id;
                return (
                  <button key={o.id} disabled={answered} onClick={() => setAnswers((a) => a.map((x, k) => (k === i ? o.id : x)))}
                    className={cx('min-h-11 rounded-xl px-3 py-2 text-left text-[13px] ring-1', correct ? 'bg-ok/15 text-ok ring-ok/40' : chosen ? 'bg-bad/15 text-bad ring-bad/40' : 'text-ink-200 ring-ink-600 hover:ring-ink-300')}>
                    {o.label}
                  </button>
                );
              })}
            </div>
            {answered && <p className="mt-3 text-[13px] leading-relaxed text-ink-300"><Badge tone={answers[i] === q.problem.id ? 'ok' : 'warn'}>{answers[i] === q.problem.id ? 'Correct' : 'Not quite'}</Badge> {q.problem.tell}</p>}
            <div className="mt-4 flex gap-2">
              {i < ROUNDS - 1 && <Button size="sm" onClick={() => setI(i + 1)}>Next case →</Button>}
              <Button size="sm" variant="primary" disabled={!done} onClick={submit}>{done ? 'Submit diagnosis' : `${answers.filter(Boolean).length}/${ROUNDS} answered`}</Button>
            </div>
          </div>
        </div>
        <ScopeGrid frame={frame} />
      </div>
    </div>
  );
}
