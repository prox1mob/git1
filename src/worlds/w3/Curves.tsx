import { useState } from 'react';
import { Concepts, LessonShell, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Button, Eyebrow, Note } from '../../components/ui';
import { defaultParams, identityCurves, type Curves as CurvesT, type GradeParams } from '../../engine/params';
import type { LevelProps } from '../../game/registry';
import { errorToScore, rangeScore } from '../../lib/color';
import { CompareObserve } from '../shared/GradingSteps';
import { neutralReport, pct, toneStats } from '../shared/measure';
import { GradingChallenge, LiveMetric, Workbench, type GradingRound } from '../shared/Workbench';

const facade = { kind: 'scene' as const, scene: 'facade' as const };
const still = { kind: 'scene' as const, scene: 'stilllife' as const };
const portrait = { kind: 'scene' as const, scene: 'portrait' as const, variant: 1, params: [3, 0, 0, 0] as [number, number, number, number] };

const PRESETS: { label: string; curves: () => CurvesT }[] = [
  { label: 'S-curve', curves: () => ({ ...identityCurves(), master: [{ x: 0, y: 0 }, { x: 0.25, y: 0.18 }, { x: 0.75, y: 0.84 }, { x: 1, y: 1 }] }) },
  { label: 'Faded blacks', curves: () => ({ ...identityCurves(), master: [{ x: 0, y: 0.1 }, { x: 0.3, y: 0.3 }, { x: 1, y: 1 }] }) },
  { label: 'Highlight roll-off', curves: () => ({ ...identityCurves(), master: [{ x: 0, y: 0 }, { x: 0.65, y: 0.68 }, { x: 1, y: 0.9 }] }) },
  { label: 'Blue cast', curves: () => ({ ...identityCurves(), b: [{ x: 0, y: 0.05 }, { x: 0.5, y: 0.58 }, { x: 1, y: 1 }] }) },
  { label: 'Cross-process', curves: () => ({ master: [{ x: 0, y: 0 }, { x: 1, y: 1 }], r: [{ x: 0, y: 0 }, { x: 0.3, y: 0.24 }, { x: 0.7, y: 0.8 }, { x: 1, y: 1 }], g: [{ x: 0, y: 0.04 }, { x: 1, y: 0.98 }], b: [{ x: 0, y: 0.15 }, { x: 1, y: 0.85 }] }) },
];

export default function Curves({ level }: LevelProps) {
  return (
    <LessonShell
      level={level}
      observe={
        <CompareObserve
          shots={[
            { label: 'Linear', source: portrait },
            { label: 'Curved', source: portrait, params: { curves: { ...identityCurves(), master: [{ x: 0, y: 0.07 }, { x: 0.28, y: 0.22 }, { x: 0.75, y: 0.82 }, { x: 1, y: 0.96 }], b: [{ x: 0, y: 0.06 }, { x: 1, y: 0.97 }] } } },
          ]}
          question="The right-hand version has a single curve applied. What do you notice about its darkest and brightest parts?"
          options={['The blacks look lifted and soft', 'It is simply darker', 'The colours are more saturated', 'More contrast in the middle']}
          reveal={() => (
            <p>Several things at once — that is the power of curves. The middle got more contrast (an S-shape), the black point was raised into a soft matte, the whites were pulled just below pure white, and a little blue was added to the shadows only. One tool, four decisions, each placed precisely by brightness.</p>
          )}
        />
      }
      experiment={<Experiment />}
      discover={
        <Concepts
          items={[
            { title: 'Input → output', body: 'The horizontal axis is the brightness going in, the vertical is what comes out. A straight diagonal changes nothing. Raise a point and every pixel of that brightness gets brighter.' },
            { title: 'S-curve', body: 'Darken the shadows and brighten the highlights: the steeper middle means more midtone contrast. Steepness is contrast; flatness is compression.' },
            { title: 'Faded blacks', body: 'Lift the left end off the floor and the darkest black becomes charcoal. It softens an image and recalls printed film and matte paper.' },
            { title: 'Highlight roll-off', body: 'Bend the top end down so the brightest values approach white gently instead of slamming into it. Skin and skies keep their texture.' },
            { title: 'Channel curves', body: 'Red, green and blue curves add or remove that colour at specific brightness levels — blue in the shadows only, warmth in the highlights only, or a cast removed where a grey should be grey.' },
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
    <Workbench source={facade} aspect={3 / 2} params={p} setParams={setP} panels={['curves']} scopes={['histogram', 'parade']}
      sidebarTop={
        <div className="rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
          <Eyebrow className="mb-2">Classic shapes</Eyebrow>
          <div className="flex flex-wrap gap-2">{PRESETS.map((pr) => <Button key={pr.label} size="sm" onClick={() => setP({ ...p, curves: pr.curves() })}>{pr.label}</Button>)}</div>
        </div>
      }
      under={<Note>Load a preset, then switch the channel tabs to see which curves it used. The faint lines show the other channels so you never lose track.</Note>} />
  );
}

const rounds: GradingRound[] = [
  {
    id: 's', label: 'S-curve without clipping', source: facade, aspect: 3 / 2, panels: ['curves'], scopes: ['histogram'],
    brief: 'Add at least 25% more midtone contrast (measured as luminance spread) with the RGB curve — without clipping either end.',
    hint: 'Two points: one at about 25% pulled down, one at about 75% pushed up. Keep the end points where they are.',
    live: (f) => { const t = toneStats(f); return <><LiveMetric label="Luminance spread" value={t.std.toFixed(3)} ok={false} /><LiveMetric label="Clipped" value={pct(Math.max(t.clipHi, t.clipLo))} ok={Math.max(t.clipHi, t.clipLo) < 0.005} target="< 0.5%" /></>; },
    evaluate: (f, _p, _d, ref) => {
      const t = toneStats(f), b = ref ? toneStats(ref) : t;
      const gain = t.std / Math.max(1e-3, b.std) - 1;
      const c = rangeScore(gain, 0.25, 0.8, 0.3);
      const clip = errorToScore(Math.max(t.clipHi, t.clipLo) * 100, 0.5, 6);
      return {
        criteria: [
          { label: 'More midtone contrast', score: c, weight: 2, detail: `Luminance spread changed by ${Math.round(gain * 100)}% (aim +25% to +80%).` },
          { label: 'No clipping', score: clip, weight: 1, detail: `${pct(t.clipHi)} highlights, ${pct(t.clipLo)} shadows clipped.` },
        ],
        worked: c >= 85 ? ['A punchy S-curve that keeps both ends intact.'] : [],
        improve: c < 85 ? [gain < 0.25 ? 'Make the S steeper in the middle.' : 'That is a lot — contrast this strong posterises skies and skin.'] : [],
      };
    },
  },
  {
    id: 'matte', label: 'Faded film blacks', source: portrait, aspect: 3 / 2, panels: ['curves'], scopes: ['histogram', 'waveform'],
    brief: 'Give this portrait a soft matte finish: lift the darkest tones to between 7% and 16% while keeping highlights bright (98th percentile above 80%).',
    hint: 'Drag the bottom-left end point straight up. Add a midpoint if the whole image starts looking washed out.',
    live: (f) => { const t = toneStats(f); return <><LiveMetric label="Darkest 2%" value={pct(t.p02, 0)} ok={t.p02 >= 0.07 && t.p02 <= 0.16} target="7–16%" /><LiveMetric label="Brightest 2%" value={pct(t.p98, 0)} ok={t.p98 >= 0.8} target="≥ 80%" /></>; },
    evaluate: (f) => {
      const t = toneStats(f);
      const black = rangeScore(t.p02, 0.07, 0.16, 0.08);
      const white = rangeScore(t.p98, 0.8, 1, 0.2);
      return {
        criteria: [
          { label: 'Lifted black point', score: black, weight: 2, detail: `Darkest 2% now at ${pct(t.p02, 0)}.` },
          { label: 'Highlights stay bright', score: white, weight: 1, detail: `Brightest 2% at ${pct(t.p98, 0)}.` },
        ],
        worked: black >= 85 ? ['A believable matte black — soft, not grey.'] : [],
        improve: black < 85 ? [t.p02 < 0.07 ? 'Lift the black end a little more.' : 'Too much lift — it is turning grey and flat.'] : [],
      };
    },
  },
  {
    id: 'cast', label: 'Remove a cast with curves', source: still, capture: { castTemp: 4100, castTint: 15 }, aspect: 3 / 2, panels: ['curves'], scopes: ['parade'],
    brief: 'No white-balance slider allowed. Use the red, green and blue curves to make the grey card neutral.',
    hint: 'On the parade, the grey card is a flat bar in each channel. Pull down the channel that is too high (or lift the low one) at that brightness.',
    live: (f) => { const n = neutralReport(f); return <LiveMetric label="Grey card chroma" value={`C* ${n.cardC.toFixed(1)}`} ok={n.cardC < 2.5} target="< 2.5" />; },
    evaluate: (f) => {
      const n = neutralReport(f);
      const s = errorToScore(n.cardC, 2, 16);
      const g = errorToScore(n.greysC, 3, 18);
      return {
        criteria: [
          { label: 'Grey card neutral', score: s, weight: 2, detail: `Residual chroma C* ${n.cardC.toFixed(2)}.` },
          { label: 'Greyscale row neutral', score: g, weight: 1, detail: `Average grey-patch chroma ${n.greysC.toFixed(2)} — curves can fix one tone more easily than all of them.` },
        ],
        worked: s >= 85 ? ['Grey is grey again, using nothing but channel curves.'] : [],
        improve: s < 85 ? ['The card still carries a cast. Compare the R, G and B heights on the parade at the card’s level.'] : [],
        meta: { neutralChroma: n.cardC },
      };
    },
  },
];

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  return <GradingChallenge ctx={ctx} title="Three jobs for one tool" rounds={rounds}
    why="Curves are the most precise tonal tool there is: every brightness level can be addressed separately in every channel. Most ‘looks’ you admire are, underneath, a handful of well-placed curve points." />;
}
