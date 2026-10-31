import { Concepts, LessonShell, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Note } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { errorToScore, rangeScore } from '../../lib/color';
import { REGIONS } from '../../engine/scenes';
import { CompareObserve, FreeExperiment } from '../shared/GradingSteps';
import { meanLch, pct, toneStats } from '../shared/measure';
import { GradingChallenge, LiveMetric, type GradingRound } from '../shared/Workbench';

const coast = { kind: 'scene' as const, scene: 'coast' as const };
const street = { kind: 'scene' as const, scene: 'street' as const };
const OVER = { exposure: 2.3, clip: 1.0 };
const UNDER = { exposure: -3.2, clip: 1.0, noise: 1.3 };

export default function DynamicRange({ level }: LevelProps) {
  return (
    <LessonShell
      level={level}
      observe={
        <CompareObserve
          shots={[
            { label: 'Overexposed', source: coast, capture: OVER, caption: '+2.3 stops, sensor clips' },
            { label: 'Underexposed', source: coast, capture: UNDER, caption: '−3.2 stops, noisy sensor' },
          ]}
          question="Both frames are badly exposed. Which one do you think can be rescued better?"
          options={['The overexposed one', 'The underexposed one', 'Both equally', 'Neither']}
          reveal={() => (
            <div className="space-y-2">
              <p><b>Usually the underexposed one.</b> Its highlights were never clipped, so the sky’s colour and texture are still in the data — lifting it reveals them, at the cost of noise in the shadows.</p>
              <p>The overexposed frame lost information the moment the sensor filled up: every clipped pixel became the same maximum value. Pulling exposure down only turns that flat white into flat grey. You cannot recover data that was never recorded.</p>
            </div>
          )}
        />
      }
      experiment={
        <FreeExperiment
          scenes={[
            { label: 'Overexposed coast', source: coast, capture: OVER },
            { label: 'Underexposed coast', source: coast, capture: UNDER },
            { label: 'Underexposed night', source: street, capture: { exposure: -2.6, clip: 1, noise: 1.4 }, aspect: 16 / 9 },
            { label: 'Correct capture', source: coast },
          ]}
          panels={['toneFull']}
          scopes={['histogram', 'waveform']}
          showLost
          notes={<Note tone="science">The magenta stripes mark pixels the simulated sensor clipped at capture. No slider can bring their detail back — watch them stay flat as you pull exposure down.</Note>}
        />
      }
      discover={
        <Concepts
          items={[
            { title: 'Dynamic range', body: 'The span, in stops, between the darkest detail a camera records above noise and the brightest before it clips. Real scenes like a sunset can exceed it, forcing a choice.' },
            { title: 'Clipping is permanent', body: 'Once a sensor photosite is full, brighter light records the same value. Those pixels lose their texture and often their colour. Highlights are the one thing you must protect at capture.' },
            { title: 'Highlight recovery’s limits', body: '“Recovery” only works on data that is bright but not clipped — the soft roll-off zone. Clipped regions turn grey and flat when pulled down. Fixing them means retouching, not grading.' },
            { title: 'Shadows hide noise', body: 'Lifting underexposed shadows also lifts the sensor’s random noise and reveals coarse quantisation. A brighter capture would have had a cleaner signal in the same tones.' },
            { title: 'Expose for the highlights', body: 'Common practice with digital sensors: expose as bright as possible without clipping important highlights, then shape the shadows later. Film behaved the other way round.' },
          ]}
        />
      }
      challenge={(ctx) => <Challenge ctx={ctx} />}
    />
  );
}

const rounds: GradingRound[] = [
  {
    id: 'over',
    label: 'Overexposed sunset',
    brief: 'Pull this frame back into a believable dusk. Bring the sea and sky out of white, keep some sparkle — and accept that the sun’s core was clipped at capture.',
    source: coast, capture: OVER, aspect: 3 / 2, panels: ['toneFull'], scopes: ['histogram', 'waveform'], showLost: true,
    hint: 'Exposure down first, then Highlights down. The sun and its reflection were clipped by the sensor; aim to restore everything else.',
    live: (f) => {
      const t = toneStats(f);
      const sky = meanLch(f, REGIONS.coast.skyHigh);
      return (
        <div className="space-y-1.5">
          <LiveMetric label="Clipped in output" value={pct(t.clipHi)} ok={t.clipHi < 0.02} target="< 2%" />
          <LiveMetric label="Upper sky" value={`L* ${sky[0].toFixed(0)}`} ok={sky[0] < 75} target="< 75" />
          <LiveMetric label="Median" value={pct(t.median, 0)} ok={t.median > 0.25 && t.median < 0.6} target="25–60%" />
        </div>
      );
    },
    evaluate: (f) => {
      const t = toneStats(f);
      const sky = meanLch(f, REGIONS.coast.skyHigh);
      const sea = meanLch(f, REGIONS.coast.sea);
      const clip = errorToScore(t.clipHi * 100, 2, 20);
      const skyS = rangeScore(sky[0], 20, 75, 25);
      const mid = rangeScore(t.median, 0.25, 0.6, 0.3);
      const seaS = rangeScore(sea[0], 15, 70, 25);
      return {
        criteria: [
          { label: 'Highlights restored', score: clip, weight: 2, detail: `${pct(t.clipHi)} of the frame still pure white (the sun's core cannot recover).` },
          { label: 'Sky has tone again', score: skyS, weight: 1, detail: `Upper sky L* ${sky[0].toFixed(0)}.` },
          { label: 'Sea has tone again', score: seaS, weight: 1, detail: `Sea L* ${sea[0].toFixed(0)}.` },
          { label: 'Believable dusk balance', score: mid, weight: 1, detail: `Median ${pct(t.median, 0)}.` },
        ],
        worked: clip >= 85 ? ['Everything recoverable has been recovered.'] : [],
        improve: [
          ...(clip < 85 ? ['Large areas are still white — bring exposure and highlights further down.'] : []),
          'Notice the flat grey patch where the sun was clipped: that is the limit of recovery, not a mistake in your grade.',
        ],
      };
    },
  },
  {
    id: 'under',
    label: 'Underexposed night',
    brief: 'This street was shot far too dark. Open it up so the scene reads — but keep it a night: deep shadows, glowing lights, and no blown neon.',
    source: street, capture: { exposure: -2.6, clip: 1, noise: 1.4 }, aspect: 16 / 9, panels: ['toneFull'], scopes: ['histogram', 'waveform'],
    hint: 'Raise Exposure about two stops, then Shadows. If the neon turns white, Highlights down. Night images should keep a low median.',
    live: (f) => {
      const t = toneStats(f);
      return (
        <div className="space-y-1.5">
          <LiveMetric label="Median" value={pct(t.median, 0)} ok={t.median > 0.12 && t.median < 0.35} target="12–35%" />
          <LiveMetric label="Crushed black" value={pct(t.clipLo)} ok={t.clipLo < 0.05} target="< 5%" />
          <LiveMetric label="Clipped highlights" value={pct(t.clipHi)} ok={t.clipHi < 0.01} target="< 1%" />
        </div>
      );
    },
    evaluate: (f) => {
      const t = toneStats(f);
      const neon = meanLch(f, REGIONS.street.neon, 16 / 9);
      const mid = rangeScore(t.median, 0.12, 0.35, 0.2);
      const lo = errorToScore(t.clipLo * 100, 5, 40);
      const hi = errorToScore(t.clipHi * 100, 1, 8);
      return {
        criteria: [
          { label: 'Scene opened up', score: mid, weight: 2, detail: `Median luminance ${pct(t.median, 0)} (night: 12–35%).` },
          { label: 'Shadows not crushed', score: lo, weight: 1, detail: `${pct(t.clipLo)} pure black.` },
          { label: 'Lights not blown', score: hi, weight: 1, detail: `${pct(t.clipHi)} clipped; neon region L* ${neon[0].toFixed(0)}.` },
        ],
        worked: mid >= 85 ? ['It reads as a night street — visible, but still dark.'] : [],
        improve: [
          ...(mid < 85 ? [t.median < 0.12 ? 'Still too dark to read — raise exposure or shadows.' : 'It now looks like dusk or day; keep night images darker.'] : []),
          'Look closely at the shadows: the grain you see is sensor noise made visible by lifting. A brighter capture would have avoided it.',
        ],
      };
    },
  },
];

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  return (
    <GradingChallenge ctx={ctx} title="Rescue two badly exposed frames" intro="Scored on the rendered result. The goal is the best image the data allows — not a miracle." rounds={rounds}
      why="Knowing what is recoverable changes how you shoot and how you grade. A colourist who understands clipping stops fighting flat white patches and starts planning around them — or asks for a reshoot." />
  );
}
