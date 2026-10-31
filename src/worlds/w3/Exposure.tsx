import { Concepts, LessonShell } from '../../components/lesson/LessonShell';
import { Note } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { errorToScore, rangeScore } from '../../lib/color';
import { CompareObserve, FreeExperiment } from '../shared/GradingSteps';
import { meanLch, pct, toneStats } from '../shared/measure';
import { GradingChallenge, LiveMetric, type GradingRound } from '../shared/Workbench';
import { REGIONS } from '../../engine/scenes';

const facade = { kind: 'scene' as const, scene: 'facade' as const };
const portrait = (light = 3) => ({ kind: 'scene' as const, scene: 'portrait' as const, variant: 2, params: [light, 4, 0, 0] as [number, number, number, number] });

export default function Exposure({ level }: LevelProps) {
  return (
    <LessonShell
      level={level}
      observe={
        <CompareObserve
          shots={[
            { label: 'A', source: facade, capture: { exposure: -1.6 } },
            { label: 'B', source: facade },
            { label: 'C', source: facade, capture: { exposure: 1.6 } },
          ]}
          question="Three exposures of the same building. Which one feels right — and why?"
          options={['A — moody and rich', 'B — balanced', 'C — bright and airy', 'It depends what I want to say']}
          reveal={(i) => (
            <div className="space-y-2">
              <p>{i === 3 ? 'Exactly the professional answer.' : 'A reasonable instinct.'} B places the stone near the middle of the tonal range and keeps detail in the sky and the shade. A hides the shadows; C bleaches the sunlit stone toward white.</p>
              <p>“Correct” exposure is a technical starting point — detail where you need it, nothing important clipped. After that, darker or brighter is a creative choice. A histogram tells you the facts; your intent decides what to do with them.</p>
            </div>
          )}
        />
      }
      experiment={
        <FreeExperiment
          scenes={[
            { label: 'Architecture', source: facade },
            { label: 'Portrait', source: portrait() },
            { label: 'Coast at dusk', source: { kind: 'scene', scene: 'coast' } },
            { label: 'Night street', source: { kind: 'scene', scene: 'street' }, aspect: 16 / 9 },
          ]}
          panels={['toneFull']}
          scopes={['histogram', 'waveform']}
          notes={<Note>Turn on <b>Clipping warning</b> under the image: red marks pure white (data lost), blue marks pure black. Then drag Exposure and watch the histogram slide while its shape stays the same — exposure multiplies all light equally.</Note>}
        />
      }
      discover={
        <Concepts
          items={[
            { title: 'Exposure', body: 'How much light was captured, counted in stops. +1 stop doubles the light, −1 halves it. Here it is applied in linear light, before anything else, exactly like changing the camera’s exposure.' },
            { title: 'The histogram', body: 'A bar chart of how many pixels sit at each brightness, from black (left) to white (right). A pile-up against either wall means clipping: detail that has become pure black or white.' },
            { title: 'Contrast', body: 'The distance between darks and lights. We scale it around 18% grey, so the middle stays put while shadows sink and highlights rise. Low contrast feels soft; high contrast feels graphic.' },
            { title: 'Highlights & shadows', body: 'Targeted lifts or cuts to the bright and dark ranges only. Highlights −: pull back a bright sky. Shadows +: open up a face in shade. They protect the middle.' },
            { title: 'Whites & blacks', body: 'Set the very ends of the range: how close the brightest point gets to pure white and the darkest to pure black. Useful for “punch”, and for avoiding accidental clipping.' },
            { title: 'Brightness is not exposure', body: 'Brightening an already-encoded image is not the same maths as more light. That is why order matters in this engine: exposure first, display transform later.' },
          ]}
        />
      }
      challenge={(ctx) => <Challenge ctx={ctx} />}
    />
  );
}

const rounds: GradingRound[] = [
  {
    id: 'flat',
    label: 'Rescue a flat, dark file',
    brief: 'A junior shot this facade a stop and a half under, and a previous edit flattened the contrast. Use the full tonal range — deep shadows to bright stone — without clipping either end.',
    source: facade,
    capture: { exposure: -1.4 },
    aspect: 3 / 2,
    initial: { contrast: -0.45 },
    panels: ['toneFull'],
    scopes: ['histogram', 'waveform'],
    hint: 'Raise exposure until the sunlit stone sits around three-quarters up the histogram, then add contrast. Check the clipping warning before you submit.',
    live: (f) => {
      const t = toneStats(f);
      return (
        <div className="space-y-1.5">
          <LiveMetric label="Highlights clipped" value={pct(t.clipHi)} ok={t.clipHi < 0.005} target="< 0.5%" />
          <LiveMetric label="Shadows clipped" value={pct(t.clipLo)} ok={t.clipLo < 0.005} target="< 0.5%" />
          <LiveMetric label="Darkest 2%" value={pct(t.p02, 0)} ok={t.p02 <= 0.1} target="≤ 10%" />
          <LiveMetric label="Brightest 2%" value={pct(t.p98, 0)} ok={t.p98 >= 0.85} target="≥ 85%" />
        </div>
      );
    },
    evaluate: (f) => {
      const t = toneStats(f);
      const clip = errorToScore(Math.max(t.clipHi, t.clipLo) * 100, 0.5, 8);
      const range = Math.round((rangeScore(t.p02, 0, 0.1, 0.1) + rangeScore(t.p98, 0.85, 0.99, 0.2)) / 2);
      const mid = rangeScore(t.median, 0.38, 0.62, 0.15);
      const worked: string[] = [], improve: string[] = [];
      if (clip === 100) worked.push('No meaningful clipping at either end.'); else improve.push(`Clipping: ${pct(t.clipHi)} highlights, ${pct(t.clipLo)} shadows. Pull back exposure, whites or blacks.`);
      if (range >= 85) worked.push('The image now uses the full range from near-black to near-white.'); else improve.push(`Tonal range runs from ${pct(t.p02, 0)} to ${pct(t.p98, 0)}. Aim for under 10% and over 85% — add contrast or adjust whites/blacks.`);
      if (mid < 85) improve.push(`Midtones sit at ${pct(t.median, 0)}; aim for 38–62% for a balanced exposure.`);
      return {
        criteria: [
          { label: 'No clipping', score: clip, weight: 1, detail: `${pct(t.clipHi)} highlights, ${pct(t.clipLo)} shadows clipped.` },
          { label: 'Full tonal range', score: range, weight: 3, detail: `Darkest 2% at ${pct(t.p02, 0)}, brightest 2% at ${pct(t.p98, 0)}.` },
          { label: 'Balanced midtones', score: mid, weight: 1, detail: `Median luminance ${pct(t.median, 0)}.` },
        ],
        worked,
        improve,
        meta: { noClipping: t.clipHi < 0.001 && t.clipLo < 0.001 && range >= 85 },
      };
    },
  },
  {
    id: 'airy',
    label: 'An airy high-key portrait',
    brief: 'The client wants a bright, airy “morning light” portrait. Lift the image so the face sits around L* 72–82 while the skin keeps its detail — no clipped highlights on the face.',
    source: portrait(3),
    capture: { exposure: -0.6 },
    aspect: 3 / 2,
    panels: ['toneFull'],
    scopes: ['histogram', 'waveform'],
    hint: 'High-key means bright mids and highlights, not blown-out ones. Try exposure up, then highlights down a little to keep texture on the forehead.',
    live: (f) => {
      const face = meanLch(f, REGIONS.portrait.forehead);
      const t = toneStats(f);
      return (
        <div className="space-y-1.5">
          <LiveMetric label="Face lightness" value={`L* ${face[0].toFixed(0)}`} ok={face[0] >= 72 && face[0] <= 82} target="72–82" />
          <LiveMetric label="Highlights clipped" value={pct(t.clipHi)} ok={t.clipHi < 0.01} target="< 1%" />
        </div>
      );
    },
    evaluate: (f) => {
      const face = meanLch(f, REGIONS.portrait.forehead);
      const t = toneStats(f);
      const L = rangeScore(face[0], 72, 82, 9);
      const clip = errorToScore(t.clipHi * 100, 1, 10);
      const key = rangeScore(t.median, 0.6, 0.85, 0.15);
      return {
        criteria: [
          { label: 'Face lightness', score: L, weight: 2, detail: `Forehead L* ${face[0].toFixed(1)} (target 72–82).` },
          { label: 'Highlight detail kept', score: clip, weight: 1, detail: `${pct(t.clipHi)} of pixels clipped.` },
          { label: 'High-key overall', score: key, weight: 1, detail: `Median luminance ${pct(t.median, 0)} (aim 60–85%).` },
        ],
        worked: [...(L >= 85 ? ['The face sits in a luminous, high-key range.'] : []), ...(clip >= 90 ? ['Skin texture survives — nothing important clipped.'] : [])],
        improve: [...(L < 85 ? [face[0] < 72 ? 'The face is still too dark for high-key — raise exposure or shadows.' : 'The face is pushing past L* 82 — highlights or exposure down a touch.'] : []), ...(clip < 90 ? ['Clipping is eating highlight detail; use Highlights or Whites to pull it back.'] : [])],
      };
    },
  },
];

function Challenge({ ctx }: { ctx: Parameters<typeof GradingChallenge>[0]['ctx'] }) {
  return (
    <GradingChallenge
      ctx={ctx}
      title="Two exposure problems from a real shoot"
      intro="Scored from the rendered pixels: clipping, tonal range and where key tones land. Use the histogram — that is what it is for."
      rounds={rounds}
      why="A histogram cannot tell you whether an image is good, but it can tell you whether you have thrown information away. Professionals protect the data first (no accidental clipping, full range available), then make the creative call — bright, dark, soft or hard."
    />
  );
}
