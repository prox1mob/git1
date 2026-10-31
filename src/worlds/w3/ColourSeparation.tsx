import { Concepts, LessonShell, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Note } from '../../components/ui';
import { REGIONS } from '../../engine/scenes';
import type { LevelProps } from '../../game/registry';
import { errorToScore, hueDelta, rangeScore } from '../../lib/color';
import { CompareObserve, FreeExperiment } from '../shared/GradingSteps';
import { dE, meanLab, meanLch, skinReport, type Rect4 } from '../shared/measure';
import { GradingChallenge, LiveMetric, type GradingRound } from '../shared/Workbench';

const portrait = { kind: 'scene' as const, scene: 'portrait' as const, variant: 2, params: [0, 0, 1, 0] as [number, number, number, number] };
const sneaker = { kind: 'scene' as const, scene: 'sneaker' as const, variant: 0 };
const SNK_UPPER: Rect4 = [0.08, -0.155, 0.12, -0.135];
const SNK_BG: Rect4 = [-0.55, 0.25, -0.45, 0.35];

export default function ColourSeparation({ level }: LevelProps) {
  return (
    <LessonShell
      level={level}
      observe={
        <CompareObserve
          shots={[
            { label: 'Muddy', source: portrait, capture: { castTemp: 4600 } },
            { label: 'Separated', source: portrait, params: { lift: { x: 0.35, y: -0.3, m: 0 }, hsl: [{ h: 0, s: 0, l: 0 }, { h: 0, s: 0.1, l: 0.05 }, { h: 0, s: 0, l: 0 }, { h: 0, s: 0, l: 0 }, { h: 0.3, s: -0.2, l: 0 }, { h: 0, s: 0, l: 0 }, { h: 0, s: 0, l: 0 }, { h: 0, s: 0, l: 0 }] } },
          ]}
          question="In which portrait does the face come forward from the background?"
          options={['Muddy', 'Separated', 'Both equally']}
          reveal={() => <p>In the separated version the warm skin sits against a cooler, quieter background. Warm colours appear to advance and cool ones recede, and the eye goes to the region that differs most from its surroundings. No masks were used — just colour relationships.</p>}
        />
      }
      experiment={
        <FreeExperiment scenes={[{ label: 'Portrait', source: portrait }, { label: 'Product', source: sneaker }, { label: 'Coast', source: { kind: 'scene', scene: 'coast' } }]} panels={['wb', 'wheels', 'hsl']} scopes={['vectorscope']}
          notes={<Note>Try warming the skin with the orange band while cooling the background with Lift toward blue. Watch the vectorscope split into two distinct arms.</Note>} />
      }
      discover={
        <Concepts items={[
          { title: 'Warm advances, cool recedes', body: 'Atmosphere scatters blue light, so distant things look cooler and paler. Our perception reads warm, saturated colour as near, which makes it a powerful depth cue.' },
          { title: 'Complementary contrast', body: 'Opposites on the colour wheel — orange and teal, red and green, yellow and violet — make each other look more intense. Used on subject versus background they create instant separation.' },
          { title: 'Saturation hierarchy', body: 'The most saturated region usually wins attention. Mute the background a little and the subject leads without any change to the subject itself.' },
          { title: 'Luminance separation', body: 'Colour contrast works best with tonal contrast behind it. A face slightly brighter than its background reads more clearly than any hue trick alone.' },
        ]} />
      }
      challenge={(ctx: ChallengeCtx) => <Challenge ctx={ctx} />}
    />
  );
}

function separation(f: Parameters<GradingRound['evaluate']>[0], subject: Rect4, bg: Rect4) {
  const s = meanLch(f, subject), b = meanLch(f, bg);
  return { dE: dE(meanLab(f, subject), meanLab(f, bg)), hueGap: Math.abs(hueDelta(s[2], b[2])), sC: s[1], bC: b[1], dL: s[0] - b[0] };
}

const rounds: GradingRound[] = [
  {
    id: 'portrait', label: 'Portrait', source: portrait, capture: { castTemp: 4600 }, aspect: 3 / 2, panels: ['wb', 'wheels', 'hsl'], scopes: ['vectorscope'],
    brief: 'The face and the warm backdrop melt together. Separate them: increase the colour difference between skin and background, keep skin natural (within 8° of the skin line) and make the face the most saturated area.',
    hint: 'Neutralise the cast a little, then cool the backdrop with Lift or the orange/red bands’ hue toward magenta… and check the skin still sits on the line.',
    live: (f) => { const x = separation(f, REGIONS.portrait.cheekL, REGIONS.portrait.backdrop); return <><LiveMetric label="Skin ↔ background ΔE" value={x.dE.toFixed(1)} ok={x.dE >= 20} target="≥ 20" /><LiveMetric label="Hue gap" value={`${x.hueGap.toFixed(0)}°`} ok={x.hueGap >= 60} target="≥ 60°" /></>; },
    evaluate: (f, _p, _d, ref) => {
      const x = separation(f, REGIONS.portrait.cheekL, REGIONS.portrait.backdrop);
      const x0 = ref ? separation(ref, REGIONS.portrait.cheekL, REGIONS.portrait.backdrop) : x;
      const sk = skinReport(f);
      return {
        criteria: [
          { label: 'Colour separation', score: rangeScore(x.dE, 20, 80, 14), weight: 2, detail: `Skin ↔ background ΔE00 ${x0.dE.toFixed(1)} → ${x.dE.toFixed(1)}.` },
          { label: 'Hue contrast', score: rangeScore(x.hueGap, 60, 180, 50), weight: 1, detail: `Hue gap ${x.hueGap.toFixed(0)}°.` },
          { label: 'Subject leads in saturation', score: rangeScore(x.sC - x.bC, 2, 80, 10), weight: 1, detail: `Skin C* ${x.sC.toFixed(0)} vs background C* ${x.bC.toFixed(0)}.` },
          { label: 'Skin stays natural', score: errorToScore(sk.error, 8, 25), weight: 2, detail: `Skin ${sk.error.toFixed(1)}° from the skin line.` },
        ],
        worked: x.dE >= 20 ? ['The face now reads clearly against the background.'] : [],
        improve: [...(x.dE < 20 ? ['Push the background further away in hue — cool it, or mute it.'] : []), ...(sk.error >= 8 ? ['Watch the skin: it has drifted off the skin-tone line.'] : [])],
        meta: { skinHueError: sk.error },
      };
    },
  },
  {
    id: 'product', label: 'Product', source: sneaker, capture: { castTemp: 9000 }, aspect: 3 / 2, panels: ['wb', 'wheels', 'hsl'], scopes: ['vectorscope'],
    brief: 'The red accents on this sneaker are getting lost in a cold, bluish wash. Make the red panels pop against the backdrop while keeping the white leather believably white.',
    hint: 'Warm the white balance until the white sole looks white, then lift the red band’s saturation.',
    evaluate: (f) => {
      const red: Rect4 = [-0.22, -0.172, -0.18, -0.156];
      const r = meanLch(f, red), b = meanLch(f, SNK_BG), u = meanLch(f, SNK_UPPER);
      const gap = dE(meanLab(f, red), meanLab(f, SNK_BG));
      return {
        criteria: [
          { label: 'Accent separation', score: rangeScore(gap, 30, 100, 20), weight: 2, detail: `Red panel ↔ backdrop ΔE00 ${gap.toFixed(1)}.` },
          { label: 'Accent saturation', score: rangeScore(r[1], 35, 120, 20), weight: 1, detail: `Red panel C* ${r[1].toFixed(0)} (backdrop C* ${b[1].toFixed(0)}).` },
          { label: 'White leather stays white', score: errorToScore(u[1], 6, 25), weight: 2, detail: `Upper chroma C* ${u[1].toFixed(1)}.` },
        ],
        worked: gap >= 30 ? ['The accent colour now owns the frame.'] : [],
        improve: u[1] >= 6 ? ['The white leather carries a tint — fix white balance before boosting colour.'] : [],
      };
    },
  },
];

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  return <GradingChallenge ctx={ctx} title="Make the subject step forward" rounds={rounds} subjective
    why="Separation is how photographers guide the eye without cropping or retouching. Warm against cool, saturated against muted, light against dark: the same relationships power film posters, fashion campaigns and product photography." />;
}
