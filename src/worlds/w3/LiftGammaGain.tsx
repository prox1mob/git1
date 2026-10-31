import { useState } from 'react';
import { Concepts, LessonShell, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Eyebrow, Note } from '../../components/ui';
import { defaultParams, gainVec, gammaVec, liftVec, type GradeParams } from '../../engine/params';
import type { LevelProps } from '../../game/registry';
import { errorToScore, rangeScore, rgbToHex, type RGB } from '../../lib/color';
import { CompareObserve } from '../shared/GradingSteps';
import { skinReport, tonalColour } from '../shared/measure';
import { GradingChallenge, LiveMetric, Workbench, type GradingRound } from '../shared/Workbench';

const portrait = { kind: 'scene' as const, scene: 'portrait' as const, variant: 3, params: [0, 4, 3, 0] as [number, number, number, number] };

/** CPU copy of the engine’s lift/gamma/gain formula, for the transfer diagram. */
function lgg(x: number, p: GradeParams): RGB {
  const l = liftVec(p.lift), g = gainVec(p.gain), e = gammaVec(p.gammaW);
  return [0, 1, 2].map((c) => {
    let y = x + l[c] * (1 - x);
    y *= g[c];
    return Math.max(0, Math.min(1, Math.sign(y) * Math.pow(Math.abs(y), e[c])));
  }) as RGB;
}

export function TransferDiagram({ p }: { p: GradeParams }) {
  const S = 220, pad = 10, W = S - 2 * pad;
  const N = 48;
  const pts = Array.from({ length: N + 1 }, (_, i) => lgg(i / N, p));
  const line = (c: number) => 'M' + pts.map((v, i) => `${pad + (i / N) * W},${pad + (1 - v[c]) * W}`).join(' L');
  return (
    <div>
      <svg viewBox={`0 0 ${S} ${S}`} className="w-full max-w-[260px] rounded-xl bg-[#0e0e0e] ring-1 ring-ink-700" role="img" aria-label="How lift, gamma and gain reshape each channel">
        <rect x={pad} y={pad} width={W} height={W} fill="none" stroke="#333" />
        <path d={`M${pad},${pad + W} L${pad + W},${pad}`} stroke="#3a3a3a" strokeDasharray="3 4" />
        <path d={line(0)} stroke="#ff5a5a" strokeWidth={1.6} fill="none" />
        <path d={line(1)} stroke="#55d36b" strokeWidth={1.6} fill="none" />
        <path d={line(2)} stroke="#5b8cff" strokeWidth={1.6} fill="none" />
      </svg>
      <div className="mt-2 flex h-6 overflow-hidden rounded-md">
        {pts.filter((_, i) => i % 2 === 0).map((v, i) => <div key={i} className="flex-1" style={{ background: rgbToHex(v) }} />)}
      </div>
      <p className="mt-1 text-[11px] text-ink-500">A neutral grey ramp after your wheels. Left = shadows, right = highlights.</p>
    </div>
  );
}

export default function LiftGammaGain({ level }: LevelProps) {
  return (
    <LessonShell
      level={level}
      observe={
        <CompareObserve
          shots={[
            { label: 'Neutral', source: portrait },
            { label: 'Split-toned', source: portrait, params: { lift: { x: 0.45, y: -0.35, m: 0 }, gain: { x: -0.25, y: 0.3, m: 0.05 } } },
          ]}
          question="What changed between these two portraits?"
          options={['The skin colour', 'The shadows and the highlights went different ways', 'The exposure', 'I can’t quite name it']}
          reveal={() => (
            <div className="space-y-2">
              <p>The shadows were pushed toward blue-teal and the highlights toward warm amber, while skin — which lives mostly in the midtones — barely moved. That is <b>split-toning</b> with lift and gain.</p>
              <p>It reads as “cinematic” because it mimics real light: warm sun on the bright side, cool sky in the shade. Done gently, the viewer feels it rather than sees it.</p>
            </div>
          )}
        />
      }
      experiment={<Experiment />}
      discover={
        <Concepts
          items={[
            { title: 'Lift', body: 'Raises or lowers the black point while white stays fixed. Its influence is strongest in the shadows and fades to nothing at white. Push the wheel toward a colour to tint the shadows.' },
            { title: 'Gamma', body: 'Bends the middle of the curve while black and white stay anchored — the colourist’s version of the power-law gamma you met earlier, per channel. Most skin and most of a scene live here.' },
            { title: 'Gain', body: 'Multiplies the signal: strongest at white, zero at black. Push toward amber for warm highlights; pull the master down to tame a hot sky.' },
            { title: 'They overlap', body: 'No control is perfectly isolated. A strong lift also tints the midtones; a strong gain reaches into them too. That is why colourists balance wheels against each other, then check skin.' },
            { title: 'Wheels follow the vectorscope', body: 'Each wheel is laid out like a vectorscope: red at the top-left, yellow left, blue right. Pushing the puck adds that colour without changing brightness; the ring below changes brightness only.' },
          ]}
        />
      }
      challenge={(ctx) => <Challenge ctx={ctx} />}
    />
  );
}

function Experiment() {
  const [p, setP] = useState<GradeParams>(() => defaultParams());
  return (
    <Workbench source={portrait} aspect={3 / 2} params={p} setParams={setP} panels={['wheels']} scopes={['parade', 'vectorscope']}
      sidebarTop={<div className="rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750"><Eyebrow className="mb-2">What the wheels do to each channel</Eyebrow><TransferDiagram p={p} /></div>}
      under={<Note>Drag the Lift puck toward blue and watch only the left end of the diagram move. Then push Gain toward amber. Where the curves cross is where the controls interact.</Note>} />
  );
}

const round: GradingRound = {
  id: 'split',
  label: 'Warm highlights, cool shadows',
  brief: 'Give this portrait a gentle cinematic split: warm the highlights, cool the shadows — and keep the skin natural. Measured from the brightest and darkest pixels, and from the skin on the vectorscope.',
  source: portrait,
  aspect: 3 / 2,
  panels: ['wheels'],
  scopes: ['vectorscope', 'parade'],
  hint: 'Start small: Lift toward blue/teal about a third of the way out, Gain toward amber a little less. If the face turns orange, nudge Gamma slightly toward blue.',
  live: (f) => {
    const hi = tonalColour(f, 'highlights'), lo = tonalColour(f, 'shadows'), sk = skinReport(f);
    return (
      <div className="space-y-1.5">
        <LiveMetric label="Highlights b* (warm +)" value={hi[2].toFixed(1)} ok={hi[2] >= 6} target="≥ +6" />
        <LiveMetric label="Shadows b* (cool −)" value={lo[2].toFixed(1)} ok={lo[2] <= -3} target="≤ −3" />
        <LiveMetric label="Skin vs skin line" value={`${sk.error.toFixed(1)}°`} ok={sk.error < 6} target="< 6°" />
      </div>
    );
  },
  evaluate: (f, _p, _d, ref) => {
    const hi = tonalColour(f, 'highlights'), lo = tonalColour(f, 'shadows'), sk = skinReport(f);
    const base = ref ? skinReport(ref) : sk;
    const baseHi = ref ? tonalColour(ref, 'highlights') : hi, baseLo = ref ? tonalColour(ref, 'shadows') : lo;
    const warm = rangeScore(hi[2] - baseHi[2], 5, 25, 8);
    const cool = rangeScore(baseLo[2] - lo[2], 3, 20, 6);
    const skinHue = errorToScore(sk.error, 4, 20);
    const satRatio = sk.sat / Math.max(1e-3, base.sat);
    const skinSat = rangeScore(satRatio, 0.8, 1.3, 0.5);
    return {
      criteria: [
        { label: 'Warm highlights', score: warm, weight: 2, detail: `Highlights b* moved ${(hi[2] - baseHi[2]).toFixed(1)} toward yellow (aim +5 to +25).` },
        { label: 'Cool shadows', score: cool, weight: 2, detail: `Shadows b* moved ${(lo[2] - baseLo[2]).toFixed(1)} (aim −3 or more toward blue).` },
        { label: 'Skin hue natural', score: skinHue, weight: 2, detail: `Skin sits ${sk.error.toFixed(1)}° from the skin-tone line.` },
        { label: 'Skin saturation natural', score: skinSat, weight: 1, detail: `Skin saturation ${Math.round(satRatio * 100)}% of the original.` },
      ],
      worked: [...(warm >= 85 && cool >= 85 ? ['A clear, controlled warm/cool split.'] : []), ...(skinHue >= 85 ? ['Skin stayed on the skin-tone line despite the split.'] : [])],
      improve: [
        ...(warm < 85 ? ['Push Gain further toward amber (or less, if it went past +25).'] : []),
        ...(cool < 85 ? ['Push Lift toward blue/teal to cool the shadows.'] : []),
        ...(skinHue < 85 ? ['The skin has drifted off the skin-tone line; counter it with a small Gamma move in the opposite direction.'] : []),
        ...(skinSat < 85 ? [satRatio > 1.3 ? 'Skin became too saturated — the warm gain is spilling into the face.' : 'Skin lost colour — ease off the cool push.'] : []),
      ],
      meta: { skinHueError: sk.error },
    };
  },
};

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  return (
    <GradingChallenge ctx={ctx} title="The cinematic split, done with restraint" rounds={[round]} subjective
      extraSidebar={null}
      why="Lift, gamma and gain are the oldest controls in colour grading — they come from telecine — and still the fastest way to shape a whole image by tonal range. The craft is in the restraint: a viewer should feel the warmth and depth without noticing a filter." />
  );
}
