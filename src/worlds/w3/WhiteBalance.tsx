import { Concepts, LessonShell, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Note } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { errorToScore } from '../../lib/color';
import { CompareObserve, FreeExperiment } from '../shared/GradingSteps';
import { neutralReport } from '../shared/measure';
import { GradingChallenge, LiveMetric, type GradingRound } from '../shared/Workbench';

const still = { kind: 'scene' as const, scene: 'stilllife' as const };
const CASTS = [
  { id: 'warm', label: 'Tungsten warm', capture: { castTemp: 3100 }, note: 'Lit by household bulbs, camera set to daylight.' },
  { id: 'cool', label: 'Shade cool', capture: { castTemp: 10500 }, note: 'Open shade under a blue sky.' },
  { id: 'green', label: 'Fluorescent green', capture: { castTemp: 5200, castTint: 45 }, note: 'Old office fluorescent tubes.' },
  { id: 'magenta', label: 'LED magenta', capture: { castTemp: 6000, castTint: -40 }, note: 'A cheap LED panel with a pink spike.' },
];

export default function WhiteBalance({ level }: LevelProps) {
  return (
    <LessonShell
      level={level}
      observe={
        <CompareObserve
          shots={[{ label: 'A', source: still, capture: CASTS[0].capture }, { label: 'B', source: still }]}
          question="The same still life, the same objects. Which one shows the colours as they really are?"
          options={['A', 'B', 'Hard to say until I look at the grey card']}
          reveal={(i) => (
            <div className="space-y-2">
              <p>{i === 2 ? 'That is how a professional answers.' : 'B is neutral; A carries a strong orange cast.'} Your eye adapts to the light around you, so in the room A might have looked “normal”. A camera does not adapt — it records the light’s colour.</p>
              <p>The grey card and the bottom row of the chart are known to be neutral. If they are tinted in the photograph, everything else is tinted by the same amount. That is what you correct.</p>
            </div>
          )}
        />
      }
      experiment={
        <FreeExperiment
          scenes={CASTS.map((c) => ({ label: c.label, source: still, capture: c.capture }))}
          panels={['wb', 'exposure']}
          scopes={['parade', 'vectorscope']}
          eyedropper
          notes={<Note>Try the <b>WB eyedropper</b> on the grey card. Then watch the RGB parade: on a neutral grey the three channels line up at the same height.</Note>}
        />
      }
      discover={
        <Concepts
          items={[
            { title: 'Colour temperature', body: 'Light sources sit along a line from warm (candle ≈ 1900 K, tungsten ≈ 3200 K) to cool (overcast ≈ 6500 K, shade 8000 K+). Kelvin describes where on that line the light falls.' },
            { title: 'Why the slider looks backwards', body: 'The temperature slider describes the light you are compensating for. Tell the software “it was 3200 K” and it adds blue to cancel the orange. Lower numbers produce a cooler result.' },
            { title: 'Tint', body: 'Many modern lights are off the warm–cool line: fluorescents lean green, cheap LEDs lean magenta. Tint moves perpendicular to temperature to cancel those casts.' },
            { title: 'Reference neutrals', body: 'A grey card reflects all wavelengths equally. Measure it, make it neutral, and the whole image is corrected. Without one, look for paper, concrete or a white shirt — carefully.' },
            { title: 'How the engine does it', body: 'Not by tinting pixels, but by chromatic adaptation: a Bradford transform in linear light, the same family of maths the eye’s adaptation is modelled with. Hence it stays natural across all tones.' },
          ]}
        />
      }
      challenge={(ctx) => <Challenge ctx={ctx} />}
    />
  );
}

export function castAdvice(h: number) {
  if (h >= 30 && h < 90) return 'It leans warm (orange/amber) — lower the temperature.';
  if (h >= 90 && h < 130) return 'It leans yellow-green — lower the temperature a little and move tint toward magenta.';
  if (h >= 130 && h < 200) return 'It leans green — move tint toward magenta.';
  if (h >= 200 && h < 320) return 'It leans cool (blue) — raise the temperature.';
  return 'It leans magenta/pink — move tint toward green.';
}

const rounds: GradingRound[] = CASTS.map((c) => ({
  id: c.id,
  label: c.label,
  brief: `${c.note} Neutralise the grey card and the chart’s greyscale row. Measured as residual chroma C*ab — 0 is perfectly neutral.`,
  source: still,
  capture: c.capture,
  aspect: 3 / 2,
  panels: ['wb'],
  scopes: ['parade', 'vectorscope'],
  eyedropper: true,
  hint: 'Look at the RGB parade over the grey card: the channel that sticks up is the cast. Temperature fixes blue/amber; Tint fixes green/magenta.',
  live: (f) => {
    const n = neutralReport(f);
    return <LiveMetric label="Grey card chroma" value={`C* ${n.cardC.toFixed(1)}`} ok={n.cardC < 2} target="< 2" />;
  },
  evaluate: (f, _p, d) => {
    const n = neutralReport(f);
    const full = d === 'advanced' ? 1 : d === 'intermediate' ? 1.5 : 2;
    const card = errorToScore(n.cardC, full, 18);
    const greys = errorToScore(n.greysC, full + 0.5, 18);
    return {
      criteria: [
        { label: 'Grey card neutral', score: card, weight: 2, detail: `Residual chroma C* ${n.cardC.toFixed(2)} (hue ${n.cardHue.toFixed(0)}°).` },
        { label: 'Greyscale row neutral', score: greys, weight: 1, detail: `Average C* across five grey patches ${n.greysC.toFixed(2)}.` },
      ],
      worked: card >= 90 ? [`Neutral to within C* ${n.cardC.toFixed(1)} — invisible to most viewers.`] : [],
      improve: card < 90 ? [`The grey card still carries C* ${n.cardC.toFixed(1)} of colour around hue ${n.cardHue.toFixed(0)}°. ${castAdvice(n.cardHue)}`] : [],
      meta: { neutralChroma: n.cardC },
    };
  },
}));

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  return (
    <GradingChallenge ctx={ctx} title="Four casts, one grey card" intro="Each round was lit by a different light source while the camera stayed on daylight balance." rounds={rounds}
      why="White balance is the first correction in every professional workflow because every later decision — skin, mood, palette — depends on it. Neutral first, then creative." />
  );
}
