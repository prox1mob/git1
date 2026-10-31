import { useEffect, useMemo, useRef, useState } from 'react';
import { ColourPanel, CurveEditor, FilmPanel, HslMixer, ToolSection, TonePanel, WheelsPanel, WhiteBalancePanel } from '../../components/grading/Controls';
import { GradeCanvas, type GradeHandle } from '../../components/grading/GradeCanvas';
import { GradeViewport } from '../../components/grading/GradeViewport';
import { ScopePanel } from '../../components/grading/Scopes';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Badge, Button, Note, Toggle, cx } from '../../components/ui';
import { meanDeltaE } from '../../engine/analysis';
import type { Frame } from '../../engine/GradeEngine';
import { defaultParams, type CaptureSpec, type GradeParams, type SourceSpec } from '../../engine/params';
import type { LevelProps } from '../../game/registry';
import { errorToScore, rangeScore } from '../../lib/color';
import { useSaveToGallery } from '../../lib/gallery';
import { useClock } from '../../lib/hooks';
import { frameLab, toneStats } from '../shared/measure';

interface Shot { label: string; source: SourceSpec; capture: CaptureSpec }
const SHOTS: Shot[] = [
  { label: '1 · Wide: the street', source: { kind: 'scene', scene: 'street' }, capture: { castTemp: 5200, exposure: -0.5 } },
  { label: '2 · Medium: her face in the neon', source: { kind: 'scene', scene: 'portrait', variant: 3, params: [2, 3, 0, 0] }, capture: { exposure: 0.55, castTint: 22 } },
  { label: '3 · Close: the sign', source: { kind: 'scene', scene: 'street', frame: [-0.24, 0.16, 0.42] }, capture: { castTemp: 8200, exposure: -0.75 } },
];
const ASPECT = 16 / 9;
type Corr = { exposure: number; temp: number; tint: number };
const NEUTRAL_CORR: Corr = { exposure: 0, temp: 6504, tint: 0 };
const compose = (look: GradeParams, c: Corr): GradeParams => ({ ...look, ...c });

export default function Colourist({ level }: LevelProps) {
  return <LessonShell level={level}
    observe={<Observe />}
    experiment={<Note className="max-w-2xl">This finale has no separate playground: the challenge itself is the full suite. Take your time in it — every control is live, and you can refine as often as you like.</Note>}
    discover={
      <Concepts items={[
        { title: 'Two layers of decisions', body: 'Per-shot corrections fix each camera’s problems so all shots start equal. One shared look then gives the sequence its identity. Change the look once and every shot follows.' },
        { title: 'Balance the sequence, not the frame', body: 'A shot that looks perfect on its own may jump when cut between its neighbours. Watch the sequence play, not just stills.' },
        { title: 'Identity through restraint', body: 'A coherent look is usually a few strong decisions — black level, a temperature split, saturation hierarchy — applied consistently, not a different trick per shot.' },
      ]} />
    }
    challenge={(ctx) => <Suite ctx={ctx} />} />;
}

function Observe() {
  const p = useMemo(() => defaultParams(), []);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {SHOTS.map((s) => <figure key={s.label}><GradeCanvas source={s.source} capture={s.capture} params={p} aspect={ASPECT} time={1} label={s.label} maxPixels={500_000} /><figcaption className="mt-1.5 text-[12px] text-ink-400">{s.label}</figcaption></figure>)}
      </div>
      <ObserveQuestion question="Three shots of one scene, straight from three cameras. Do they feel like one moment in one place?" options={['Yes', 'No — each has its own colour and brightness', 'Only shots 1 and 3 match']}
        reveal={() => <p>Each camera was set differently: one warm and dark, one bright with a green tint, one cool and dark. Before any creative look, a colourist balances them so they belong together — then applies a single look on top.</p>} />
    </div>
  );
}

function Suite({ ctx }: { ctx: ChallengeCtx }) {
  const [sel, setSel] = useState(0);
  const [corr, setCorr] = useState<Corr[]>(() => SHOTS.map(() => ({ ...NEUTRAL_CORR })));
  const [look, setLook] = useState<GradeParams>(() => defaultParams());
  const [playing, setPlaying] = useState(false);
  const [t] = useClock(true, 20);
  const [frame, setFrame] = useState<Frame | null>(null);
  const handle = useRef<GradeHandle>(null);
  const save = useSaveToGallery();
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setSel((s) => (s + 1) % SHOTS.length), 2600);
    return () => clearInterval(id);
  }, [playing]);
  const shot = SHOTS[sel];
  const params = useMemo(() => compose(look, corr[sel]), [look, corr, sel]);
  const setShotP = (q: Partial<GradeParams>) => setCorr((cs) => cs.map((c, k) => (k === sel ? { exposure: q.exposure ?? c.exposure, temp: q.temp ?? c.temp, tint: q.tint ?? c.tint } : c)));
  const setLookP = (q: Partial<GradeParams>) => setLook((l) => ({ ...l, ...q }));
  const shotP = { ...look, ...corr[sel] };

  const submit = () => {
    const e = handle.current?.engine;
    if (!e) return;
    const user = SHOTS.map((s, k) => e.analyzeScenario({ source: s.source, capture: s.capture, params: { ...compose(look, corr[k]), grain: 0 }, width: 240, time: 1 }));
    const clean = SHOTS.map((s) => e.analyzeScenario({ source: s.source, capture: {}, params: { ...compose(look, NEUTRAL_CORR), grain: 0 }, width: 240, time: 1 }));
    const neutral = SHOTS.map((s) => e.analyzeScenario({ source: s.source, capture: {}, params: defaultParams(), width: 240, time: 1 }));
    const corrDE = user.map((u, k) => (u && clean[k] ? meanDeltaE(u, clean[k]!, 3) : 30));
    const lookDE = clean.reduce((a, c, k) => a + (c && neutral[k] ? meanDeltaE(c, neutral[k]!, 3) : 0), 0) / SHOTS.length;
    const bs = user.map((u) => (u ? frameLab(u).b : 0));
    const meanB = bs.reduce((a, b) => a + b, 0) / bs.length;
    const spread = Math.sqrt(bs.reduce((a, b) => a + (b - meanB) ** 2, 0) / bs.length);
    const clip = Math.max(...user.map((u) => (u ? toneStats(u).clipHi : 1)));
    const criteria = [
      ...corrDE.map((d, k) => ({ label: `Correction · shot ${k + 1}`, score: errorToScore(d, 2, 12), weight: 1.5, detail: `Mean ΔE00 ${d.toFixed(2)} from how this shot would look from a correctly set camera with your look.` })),
      { label: 'Look · a deliberate identity', score: rangeScore(lookDE, 4, 30, 4), weight: 2, detail: `Your look moves the image by ΔE00 ${lookDE.toFixed(1)} on average.` },
      { label: 'Sequence coherence', score: errorToScore(spread, 2.5, 12), weight: 1.5, detail: `Spread of warmth (b*) across the three shots: ${spread.toFixed(2)}.` },
      { label: 'Technical · highlights', score: errorToScore(clip * 100, 1.5, 10), weight: 1, detail: `Worst shot clips ${(clip * 100).toFixed(1)}%.` },
    ];
    ctx.submit({
      score: weighted(criteria), criteria, subjective: true,
      worked: [...corrDE.map((d, k) => (d < 3 ? `Shot ${k + 1} is balanced to match the others.` : '')).filter(Boolean), ...(lookDE >= 4 ? ['The sequence has a visible, shared identity.'] : [])],
      improve: [...corrDE.map((d, k) => (d >= 3 ? `Shot ${k + 1}: its camera error is still visible — revisit its exposure and white balance.` : '')).filter(Boolean), ...(lookDE < 4 ? ['The look is very subtle; commit to a stronger shared decision.'] : [])],
      why: 'This is the whole job in miniature: neutralise each source, build one look, check it in motion and in sequence. The audience should feel a single world, never the edit.',
    });
  };

  return (
    <div>
      <ChallengeBrief title="Become the colourist">
        Three shots from three badly set cameras. Use <b>shot corrections</b> (exposure and white balance, per shot) so they match, and a <b>look</b> (everything else, shared) to give the scene its identity: a lonely night, neon in the rain. Scored on how well each correction cancels its camera error, the strength and coherence of the look, and clipping.
      </ChallengeBrief>
      <div className="mb-4 grid grid-cols-3 gap-3">
        {SHOTS.map((s, k) => (
          <button key={s.label} onClick={() => { setPlaying(false); setSel(k); }} className={cx('overflow-hidden rounded-xl text-left ring-2 transition', k === sel ? 'ring-ink-100' : 'ring-transparent opacity-80 hover:opacity-100')}>
            <GradeCanvas source={s.source} capture={s.capture} params={compose(look, corr[k])} aspect={ASPECT} time={1} label={s.label} maxPixels={250_000} rounded={false} />
            <p className="truncate bg-ink-850 px-2 py-1.5 text-[11.5px] text-ink-300">{s.label}</p>
          </button>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          <GradeViewport ref={handle} source={shot.source} capture={shot.capture} params={params} aspect={ASPECT} time={t} onAnalysis={setFrame} label={shot.label}
            toolbarExtra={<><Toggle checked={playing} onChange={setPlaying} label="Play the sequence" /><Button size="sm" variant="ghost" onClick={async () => { const img = handle.current?.snapshot(); if (img) await save({ title: `Become the Colourist — ${shot.label}`, source: 'World 04', image: img }); }}>Save frame</Button></>} />
          <div className="rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750"><ScopePanel frame={frame} kinds={['waveform', 'parade', 'vectorscope']} /></div>
        </div>
        <aside className="space-y-3">
          <div className="rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
            <p className="text-[12.5px] text-ink-300">Editing <b className="text-ink-50">{shot.label}</b></p>
            <div className="mt-3 flex flex-wrap gap-2"><Button variant="primary" size="sm" onClick={submit}>Submit the sequence</Button><Badge tone="outline">Unlimited retries</Badge></div>
            <div className="mt-3"><Hint>Correct each shot until the face, the asphalt and the neon feel like one place. Only then build the look — and play the sequence to judge it.</Hint></div>
          </div>
          <ToolSection title={`Shot correction · shot ${sel + 1} only`}>
            <WhiteBalancePanel p={shotP} set={setShotP} />
            <div className="mt-3"><TonePanel p={shotP} set={setShotP} include={['exposure']} /></div>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setCorr((cs) => cs.map((c, k) => (k === sel ? { ...NEUTRAL_CORR } : c)))}>Reset this shot</Button>
          </ToolSection>
          <ToolSection title="Look · all shots"><TonePanel p={look} set={setLookP} include={['contrast', 'highlights', 'shadows', 'rolloff']} /></ToolSection>
          <ToolSection title="Look · wheels" open={false}><WheelsPanel p={look} set={setLookP} size={100} /></ToolSection>
          <ToolSection title="Look · curves" open={false}><CurveEditor curves={look.curves} onChange={(curves) => setLookP({ curves })} /></ToolSection>
          <ToolSection title="Look · HSL" open={false}><HslMixer hsl={look.hsl} onChange={(hsl) => setLookP({ hsl })} /></ToolSection>
          <ToolSection title="Look · saturation & film" open={false}><ColourPanel p={look} set={setLookP} /><div className="mt-3"><FilmPanel p={look} set={setLookP} /></div></ToolSection>
        </aside>
      </div>
    </div>
  );
}
