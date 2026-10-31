import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ToolSection, TonePanel, WheelsPanel, WhiteBalancePanel, ColourPanel } from '../../components/grading/Controls';
import { GradeCanvas, type GradeHandle } from '../../components/grading/GradeCanvas';
import { Scope, type ScopeKind } from '../../components/grading/Scopes';
import { Transport, useClip } from '../../components/grading/Transport';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Button, Eyebrow, Segmented } from '../../components/ui';
import type { Frame } from '../../engine/GradeEngine';
import { defaultParams, type CaptureSpec, type GradeParams, type SourceSpec } from '../../engine/params';
import { REGIONS } from '../../engine/scenes';
import type { LevelProps } from '../../game/registry';
import { errorToScore } from '../../lib/color';
import { dE, meanLab, uv, type Rect4 } from '../shared/measure';
import { regionMean } from '../../engine/analysis';
import { rgbToLab } from '../../lib/color';

const P = (skin: number, frame: [number, number, number]) => ({ kind: 'scene' as const, scene: 'portrait' as const, variant: skin, params: [0, 2, 0, 0] as [number, number, number, number], frame });
const WIDE: [number, number, number] = [0, 0, 1];
const CLOSE: [number, number, number] = [0, 0.07, 0.6];
const BG: Rect4 = [-0.36, 0.23, -0.31, 0.28];
const SAMPLES: { label: string; rect: Rect4 }[] = [
  { label: 'skin', rect: REGIONS.portrait.cheekL },
  { label: 'forehead', rect: REGIONS.portrait.forehead },
  { label: 'backdrop', rect: BG },
];

export function matchReport(a: Frame, af: [number, number, number], b: Frame, bf: [number, number, number]) {
  return SAMPLES.map((s) => ({ label: s.label, dE: dE(meanLab(a, s.rect, 3 / 2, af), meanLab(b, s.rect, 3 / 2, bf)) }));
}

export function MatchBench({ refSource, refCapture, refParams, source, capture, params, setParams, aspect, onFrames, scopes = ['parade', 'vectorscope'], extra, handleRef, video }: {
  refSource: SourceSpec; refCapture?: CaptureSpec; refParams: GradeParams; source: SourceSpec; capture?: CaptureSpec; params: GradeParams; setParams: (p: GradeParams) => void; aspect: number;
  onFrames?: (a: Frame | null, b: Frame | null) => void; scopes?: ScopeKind[]; extra?: ReactNode; handleRef?: RefObject<{ a: GradeHandle | null; b: GradeHandle | null }>; video?: boolean;
}) {
  const [fa, setFa] = useState<Frame | null>(null);
  const [fb, setFb] = useState<Frame | null>(null);
  const [scope, setScope] = useState<ScopeKind>(scopes[0]);
  const clip = useClip(10, false);
  const set = (q: Partial<GradeParams>) => setParams({ ...params, ...q });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <figure>
          <GradeCanvas ref={(h) => { if (handleRef) handleRef.current.a = h; }} source={refSource} capture={refCapture} params={refParams} aspect={aspect} time={video ? clip.time : 0} onAnalysis={(f) => { setFa(f); onFrames?.(f, fb); }} label="Reference shot" />
          <figcaption className="mt-1.5 text-[12px] text-ink-400">Reference (locked)</figcaption>
        </figure>
        <figure>
          <GradeCanvas ref={(h) => { if (handleRef) handleRef.current.b = h; }} source={source} capture={capture} params={params} aspect={aspect} time={video ? clip.time : 0} onAnalysis={(f) => { setFb(f); onFrames?.(fa, f); }} label="Shot to match" />
          <figcaption className="mt-1.5 text-[12px] text-ink-400">Your shot</figcaption>
        </figure>
      </div>
      {video && <Transport clip={clip} />}
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
          <div className="mb-2"><Segmented size="sm" value={scope} onChange={setScope} options={scopes.map((s) => ({ value: s, label: s === 'parade' ? 'RGB parade' : s[0].toUpperCase() + s.slice(1) }))} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Eyebrow className="mb-1">Reference</Eyebrow><div className={scope === 'vectorscope' ? 'mx-auto max-w-[240px]' : ''}><Scope frame={fa} kind={scope} zoom={scope === 'vectorscope' ? 2 : 1} /></div></div>
            <div><Eyebrow className="mb-1">Yours</Eyebrow><div className={scope === 'vectorscope' ? 'mx-auto max-w-[240px]' : ''}><Scope frame={fb} kind={scope} zoom={scope === 'vectorscope' ? 2 : 1} /></div></div>
          </div>
          {extra}
        </div>
        <div className="space-y-3">
          <ToolSection title="Balance & exposure"><WhiteBalancePanel p={params} set={set} /><div className="mt-3"><TonePanel p={params} set={set} include={['exposure', 'contrast']} /></div></ToolSection>
          <ToolSection title="Wheels" open={false}><WheelsPanel p={params} set={set} size={104} /></ToolSection>
          <ToolSection title="Saturation" open={false}><ColourPanel p={params} set={set} /></ToolSection>
        </div>
      </div>
    </div>
  );
}

export default function ShotMatching({ level }: LevelProps) {
  return <LessonShell level={level}
    observe={<Observe />}
    experiment={<Experiment />}
    discover={
      <Concepts items={[
        { title: 'Why shots differ', body: 'Different cameras, lenses, settings, a cloud over the sun, a lamp switched on: shots from one scene rarely match out of the camera. Cut together, every difference jumps.' },
        { title: 'Pick a hero', body: 'Choose the best-looking shot of the scene as the reference and match the others to it — not all to an average.' },
        { title: 'Match in order', body: 'Exposure and contrast first (waveform), then balance (parade), then saturation and skin (vectorscope). Each step is easier when the previous one is right.' },
        { title: 'Match what the eye tracks', body: 'Skin and large neutral areas matter most. A slightly different background in a close-up goes unnoticed; a different face colour does not.' },
      ]} />
    }
    challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

function Observe() {
  const p = useMemo(() => defaultParams(), []);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <GradeCanvas source={P(3, WIDE)} params={p} aspect={3 / 2} label="Wide shot" />
        <GradeCanvas source={P(3, CLOSE)} capture={{ castTemp: 4300, exposure: -0.7 }} params={p} aspect={3 / 2} label="Close-up" />
      </div>
      <ObserveQuestion question="These two shots will be cut back-to-back in a film. Would the audience notice the cut?" options={['No, they match', 'Yes — the close-up feels like a different place', 'Only a professional would notice']}
        reveal={() => <p>Almost everyone notices, even if they can’t say why: the close-up is darker and cooler, so the person seems to have moved to a different room. Shot matching makes the cut invisible so the audience follows the story, not the jump.</p>} />
    </div>
  );
}

function Experiment() {
  const [p, setP] = useState<GradeParams>(() => defaultParams());
  const ref = useMemo(() => defaultParams(), []);
  return <MatchBench refSource={{ kind: 'scene', scene: 'street' }} refParams={ref} source={{ kind: 'scene', scene: 'street', frame: [-0.2, 0.12, 0.45] }} capture={{ castTemp: 9000, exposure: 0.7 }} params={p} setParams={setP} aspect={16 / 9} video
    extra={<p className="mt-3 text-[12.5px] text-ink-400">Practice pair: a wide night street and a tighter shot of the neon from a second camera with different settings.</p>} />;
}

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const [round, setRound] = useState(0);
  const cases = [
    { label: 'Close-up, warm & dark', skin: 3, capture: { castTemp: 4300, exposure: -0.7 } as CaptureSpec },
    { label: 'Close-up, cool & bright', skin: 1, capture: { castTemp: 9500, castTint: -15, exposure: 0.6 } as CaptureSpec },
  ];
  const [params, setParams] = useState<GradeParams[]>(() => cases.map(() => defaultParams()));
  const handles = useRef<{ a: GradeHandle | null; b: GradeHandle | null }>({ a: null, b: null });
  const refP = useMemo(() => defaultParams(), []);
  const [live, setLive] = useState<number | null>(null);
  const c = cases[round];
  const submit = () => {
    const ea = handles.current.a?.engine, eb = handles.current.b?.engine;
    if (!ea || !eb) return;
    const results = cases.map((cs, k) => {
      const a = ea.analyzeScenario({ source: P(cs.skin, WIDE), params: refP });
      const b = eb.analyzeScenario({ source: P(cs.skin, CLOSE), capture: cs.capture, params: params[k] });
      return a && b ? matchReport(a, WIDE, b, CLOSE) : [];
    });
    const criteria = results.flatMap((r, k) => r.map((x) => ({ label: `${cases[k].label} · ${x.label}`, score: errorToScore(x.dE, 2.5, 15), weight: x.label === 'backdrop' ? 1 : 2, detail: `ΔE00 ${x.dE.toFixed(2)} between the shots.` })));
    const avg = results.flat().reduce((a, x) => a + x.dE, 0) / Math.max(1, results.flat().length);
    ctx.submit({
      score: weighted(criteria), criteria,
      worked: avg < 3 ? ['The cuts would be invisible to an audience.'] : [],
      improve: criteria.filter((x) => x.score < 80).map((x) => `${x.label}: still ΔE ${x.detail?.match(/[\d.]+/)?.[0]} apart.`),
      why: 'Continuity of colour is part of continuity of story. Matching is unglamorous, precise work — and the reason big productions can cut between six cameras without anyone noticing.',
      meta: { matchDeltaE: avg },
    });
  };
  return (
    <div>
      <ChallengeBrief title="Make the close-ups cut with the wide shot" aside={<div className="flex gap-2">{cases.map((cs, k) => <Button key={cs.label} size="sm" variant={k === round ? 'primary' : 'secondary'} onClick={() => setRound(k)}>{k + 1}. {cs.label}</Button>)}</div>}>
        Two close-ups were shot on a second camera with the wrong settings. Match each to its locked wide shot. Measured as ΔE2000 on the face and the backdrop between the two shots.
      </ChallengeBrief>
      <MatchBench key={round} handleRef={handles} refSource={P(c.skin, WIDE)} refParams={refP} source={P(c.skin, CLOSE)} capture={c.capture} params={params[round]} setParams={(np) => setParams((all) => all.map((x, k) => (k === round ? np : x)))} aspect={3 / 2}
        onFrames={(a, b) => { if (a && b && ctx.difficulty === 'beginner') { const r = matchReport(a, WIDE, b, CLOSE); setLive(r.reduce((s, x) => s + x.dE, 0) / r.length); } }}
        extra={
          <div className="mt-3 space-y-3">
            {live !== null && ctx.difficulty === 'beginner' && <p className="text-[13px] text-ink-300">Average difference now: <b className="num font-mono text-ink-50">ΔE {live.toFixed(1)}</b> (aim below 2.5)</p>}
            <Hint>Exposure first: line up the face on the waveform. Then temperature until the parades have the same shape. Skin on the vectorscope (×2) should point the same way in both.</Hint>
            <Button variant="primary" onClick={submit}>Submit both matches</Button>
          </div>
        } />
    </div>
  );
}

// keep the helper available to the finale
export const regionLab = (f: Frame, r: Rect4, aspect: number, frame?: [number, number, number]) => rgbToLab(regionMean(f, uv(r, aspect, frame)));
