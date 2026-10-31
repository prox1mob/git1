import { useMemo, useRef, useState } from 'react';
import { CurveEditor, FilmPanel, ToolSection, TonePanel, WheelsPanel, ColourPanel } from '../../components/grading/Controls';
import { GradeCanvas, type GradeHandle } from '../../components/grading/GradeCanvas';
import { ChallengeBrief, Concepts, Hint, LessonShell, weighted, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Badge, Button, Eyebrow, Note } from '../../components/ui';
import { meanDeltaE } from '../../engine/analysis';
import { defaultParams, type GradeParams } from '../../engine/params';
import type { LevelProps } from '../../game/registry';
import { errorToScore } from '../../lib/color';
import { useClock } from '../../lib/hooks';
import { CompareObserve, FreeExperiment } from '../shared/GradingSteps';

const street = { kind: 'scene' as const, scene: 'street' as const };
const coast = { kind: 'scene' as const, scene: 'coast' as const };
const FILM: Partial<GradeParams> = {
  contrast: 0.18, rolloff: 0.9, density: 0.45, halation: 0.55, fade: 0.35, grain: 0.35, grainSize: 1.8, saturation: 0.92,
  gain: { x: -0.15, y: 0.18, m: 0 }, lift: { x: 0.2, y: -0.1, m: 0 },
};

const TABLE: [string, string, string][] = [
  ['Contrast curve (toe & shoulder)', 'Good approximation', 'Film’s characteristic curve is an S-shape in log exposure; a log-space contrast plus a highlight shoulder captures its feel well.'],
  ['Highlight roll-off', 'Good approximation', 'A smooth shoulder instead of a hard clip. Real negative film keeps compressing for many stops; the print stock adds its own shoulder.'],
  ['Colour density', 'Rough approximation', 'Here: saturated colours darken in Oklab. Real density comes from overlapping dye absorption spectra — it needs a spectral model.'],
  ['Halation', 'Rough approximation', 'Here: a blurred, red-orange copy of bright highlights. Real halation is light bouncing off the film base through specific layers, with wavelength-dependent spread.'],
  ['Grain', 'Visual approximation', 'Here: smooth luminance-weighted noise. Real grain is clouds of silver/dye particles whose size and structure vary by layer and exposure.'],
  ['Shadow rendering / fade', 'Good approximation', 'Lifted, slightly tinted blacks recall prints and scans. Full emulation would model the print’s minimum density (D-min) and stock-specific tints.'],
];

export default function FilmEmulation({ level }: LevelProps) {
  return <LessonShell level={level}
    observe={
      <CompareObserve shots={[{ label: 'Digital', source: street, aspect: 16 / 9 }, { label: 'Film-inspired', source: street, aspect: 16 / 9, params: FILM }]}
        question="What makes the right-hand frame feel like film? Name as many things as you can."
        options={['The lights glow', 'The blacks are softer', 'There is texture', 'The colour feels denser', 'All of these']}
        reveal={() => <p>All of them, layered: a red-orange <b>halation</b> glow around the lamps, <b>faded blacks</b>, fine <b>grain</b>, a gentle <b>highlight roll-off</b>, and <b>density</b> that darkens saturated colours. Each is subtle; together they read as “film”.</p>} />
    }
    experiment={
      <FreeExperiment video scenes={[{ label: 'Night street', source: street, aspect: 16 / 9 }, { label: 'Coast', source: coast }, { label: 'Portrait', source: { kind: 'scene', scene: 'portrait', variant: 2, params: [1, 0, 0, 0] } }]} panels={['film', 'curves', 'wheels']} scopes={['histogram']}
        notes={
          <div className="rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
            <Eyebrow className="mb-3">What is real, what is approximated</Eyebrow>
            <ul className="space-y-2.5">
              {TABLE.map(([a, b, c]) => <li key={a} className="text-[12.5px] leading-relaxed text-ink-300"><span className="text-ink-100">{a}</span> <Badge tone={b.startsWith('Good') ? 'ok' : 'warn'}>{b}</Badge><br />{c}</li>)}
            </ul>
          </div>
        } />
    }
    discover={
      <Concepts items={[
        { title: 'Contrast curves', body: 'Film responds to light with an S-shaped curve: a soft toe in the shadows, a straight middle, a long gentle shoulder. Highlights compress rather than clip.' },
        { title: 'Colour density', body: 'Dyes absorb light, so rich colours are also darker. Digital saturation makes colours brighter and louder; density makes them deeper.' },
        { title: 'Grain', body: 'The image is built from particles. Grain is most visible in midtones, adds perceived sharpness, and hides banding. Size relates to film speed and format.' },
        { title: 'Halation', body: 'Bright light passes through the emulsion, reflects off the base and re-exposes the red-sensitive layer: a warm glow around lamps and bright edges.' },
        { title: 'Approximation vs model', body: 'Everything here is a perceptual approximation. Faithful stock emulation uses measured spectral sensitivities, dye densities, interlayer effects and print stocks.' },
      ]} />
    }
    challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const ref = useMemo(() => defaultParams(FILM), []);
  const [p, setP] = useState<GradeParams>(() => defaultParams());
  const [t] = useClock(true, 12);
  const A = useRef<GradeHandle>(null), B = useRef<GradeHandle>(null);
  const set = (q: Partial<GradeParams>) => setP({ ...p, ...q });
  const submit = () => {
    const ea = A.current?.engine, eb = B.current?.engine;
    if (!ea || !eb) return;
    const a = ea.analyzeScenario({ source: street, params: { ...ref, grain: 0 }, width: 240 });
    const b = eb.analyzeScenario({ source: street, params: { ...p, grain: 0 }, width: 240 });
    const dE = a && b ? meanDeltaE(a, b, 2) : 99;
    const grainErr = Math.abs(p.grain - ref.grain);
    const haloErr = Math.abs(p.halation - ref.halation);
    const criteria = [
      { label: 'Tone & colour match', score: errorToScore(dE, 2, 12), weight: 3, detail: `Mean ΔE00 ${dE.toFixed(2)} (grain excluded).` },
      { label: 'Halation', score: errorToScore(haloErr * 100, 10, 50), weight: 1, detail: `Your halation ${Math.round(p.halation * 100)} vs reference ${Math.round(ref.halation * 100)}.` },
      { label: 'Grain', score: errorToScore(grainErr * 100, 10, 45), weight: 1, detail: `Your grain ${Math.round(p.grain * 100)} vs reference ${Math.round(ref.grain * 100)}.` },
    ];
    ctx.submit({
      score: weighted(criteria), criteria,
      worked: criteria.filter((c) => c.score >= 85).map((c) => `${c.label}: well matched.`),
      improve: criteria.filter((c) => c.score < 85).map((c) => `${c.label}: ${c.detail}`),
      why: 'Matching a reference look is daily work: a director brings a still from a favourite film and asks for “this”. Breaking a look down into curve, density, halation, grain and black level is how you rebuild it.',
    });
  };
  return (
    <div>
      <ChallengeBrief title="Reverse-engineer a film look">Match the reference frame using the film tools, contrast and wheels. Tone and colour are measured as mean ΔE2000 with grain removed; grain and halation are compared separately.</ChallengeBrief>
      <div className="grid gap-4 lg:grid-cols-2">
        <figure><GradeCanvas ref={A} source={street} params={ref} aspect={16 / 9} time={t} label="Reference look" /><figcaption className="mt-1.5 text-[12px] text-ink-400">Reference</figcaption></figure>
        <figure><GradeCanvas ref={B} source={street} params={p} aspect={16 / 9} time={t} label="Your look" /><figcaption className="mt-1.5 text-[12px] text-ink-400">Yours</figcaption></figure>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <ToolSection title="Film"><FilmPanel p={p} set={set} /></ToolSection>
        <div className="space-y-3">
          <ToolSection title="Contrast & saturation"><TonePanel p={p} set={set} include={['contrast']} /><div className="mt-3"><ColourPanel p={p} set={set} /></div></ToolSection>
          <ToolSection title="Curves" open={false}><CurveEditor curves={p.curves} onChange={(curves) => set({ curves })} /></ToolSection>
        </div>
        <div className="space-y-3">
          <ToolSection title="Wheels"><WheelsPanel p={p} set={set} size={96} /></ToolSection>
          <div className="space-y-3 rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
            <Hint>Look at the lamps first (halation), then the darkest asphalt (faded blacks), then the overall warmth of the highlights (gain wheel).</Hint>
            <Button variant="primary" onClick={submit}>Submit match</Button>
            <Note>Scores ignore grain when comparing colour, because grain is random from frame to frame.</Note>
          </div>
        </div>
      </div>
    </div>
  );
}
