import { Concepts, LessonShell, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Note } from '../../components/ui';
import { HSL_BANDS } from '../../engine/params';
import { REGIONS } from '../../engine/scenes';
import type { LevelProps } from '../../game/registry';
import { errorToScore, hueDelta, rangeScore } from '../../lib/color';
import { CompareObserve, FreeExperiment } from '../shared/GradingSteps';
import { dE, meanLab, meanLch } from '../shared/measure';
import { GradingChallenge, LiveMetric, type GradingRound } from '../shared/Workbench';

const facade = { kind: 'scene' as const, scene: 'facade' as const };
const still = { kind: 'scene' as const, scene: 'stilllife' as const };
const band = (id: string) => HSL_BANDS.findIndex((b) => b.id === id);

export default function HslMixer({ level }: LevelProps) {
  const sel = HSL_BANDS.map((b) => ({ h: 0, s: b.id === 'orange' ? 0.15 : -1, l: 0 }));
  return (
    <LessonShell
      level={level}
      observe={
        <CompareObserve
          shots={[{ label: 'Original', source: still }, { label: 'Selective', source: still, params: { hsl: sel } }]}
          question="Only one colour family survived on the right. How do you think that was done?"
          options={['Painted by hand', 'A mask around the orange', 'Every colour except orange was desaturated', 'No idea yet']}
          reveal={() => <p>No masks, no painting: the HSL mixer reduced saturation for seven of eight hue ranges and left orange alone. Because it selects by <i>colour</i>, not by position, everything orange — the fruit, the warm wood, part of the chart — keeps its colour.</p>}
        />
      }
      experiment={
        <FreeExperiment scenes={[{ label: 'Still life', source: still }, { label: 'Architecture', source: facade }, { label: 'Coast', source: { kind: 'scene', scene: 'coast' } }, { label: 'Portrait', source: { kind: 'scene', scene: 'portrait', variant: 2, params: [1, 1, 0, 0] } }]}
          panels={['hsl', 'colour']} scopes={['vectorscope']}
          notes={<Note tone="science">The mixer works in Oklab, a perceptual space: hue bands overlap smoothly so you never get hard edges, and neutrals (greys, whites) are protected because they have no hue to select.</Note>} />
      }
      discover={
        <Concepts
          items={[
            { title: 'Eight hue ranges', body: 'Red, orange, yellow, green, aqua, blue, purple and magenta. Each slider affects pixels whose hue falls in that range, fading smoothly into its neighbours.' },
            { title: 'Hue', body: 'Rotates a colour family toward its neighbours: yellow-green foliage toward green, cyan sky toward blue. Small moves look natural; large ones look stylised.' },
            { title: 'Saturation', body: 'Makes one family more or less intense. The classic move is muting distracting colours so the subject’s colour leads.' },
            { title: 'Luminance', body: 'Brightens or darkens one family. Darkening blue deepens skies; lightening orange brightens skin. Lightness edits are the ones most likely to create halos — go gently.' },
            { title: 'Selection by colour, not place', body: 'Every orange thing changes, wherever it is. If the subject shares a colour with the background, you need a mask instead — a different tool for a different job.' },
          ]}
        />
      }
      challenge={(ctx) => <Challenge ctx={ctx} />}
    />
  );
}

const rounds: GradingRound[] = [
  {
    id: 'sky', label: 'Deepen the sky', source: facade, aspect: 3 / 2, panels: ['hsl'], scopes: ['vectorscope'],
    brief: 'Make the sky a deeper, richer blue — at least 5 L* darker and 4 C* more saturated — without changing the sunlit stone or the red door.',
    hint: 'Blue luminance down, blue saturation up. Check the stone: it is warm, so the blue band should leave it alone.',
    live: (f) => { const s = meanLch(f, REGIONS.facade.sky); return <LiveMetric label="Sky L* / C*" value={`${s[0].toFixed(0)} / ${s[1].toFixed(0)}`} ok={false} />; },
    evaluate: (f, _p, _d, ref) => {
      const s = meanLch(f, REGIONS.facade.sky), s0 = ref ? meanLch(ref, REGIONS.facade.sky) : s;
      const dark = rangeScore(s0[0] - s[0], 5, 30, 6), rich = rangeScore(s[1] - s0[1], 4, 40, 6);
      const stone = ref ? dE(meanLab(f, REGIONS.facade.sunlit), meanLab(ref, REGIONS.facade.sunlit)) : 0;
      const door = ref ? dE(meanLab(f, REGIONS.facade.door), meanLab(ref, REGIONS.facade.door)) : 0;
      const keep = errorToScore(Math.max(stone, door), 2.5, 15);
      return {
        criteria: [
          { label: 'Sky darker', score: dark, weight: 1, detail: `Sky L* ${s0[0].toFixed(0)} → ${s[0].toFixed(0)}.` },
          { label: 'Sky richer', score: rich, weight: 1, detail: `Sky C* ${s0[1].toFixed(0)} → ${s[1].toFixed(0)}.` },
          { label: 'Stone & door untouched', score: keep, weight: 2, detail: `ΔE00 stone ${stone.toFixed(1)}, door ${door.toFixed(1)}.` },
        ],
        worked: keep >= 85 ? ['A targeted change: the warm tones did not move.'] : [],
        improve: [...(keep < 85 ? ['Something outside the blues moved — check you only touched the blue (and maybe aqua) sliders.'] : []), ...(dark < 85 || rich < 85 ? ['Push blue luminance down and blue saturation up a little further.'] : [])],
      };
    },
  },
  {
    id: 'selective', label: 'Keep only the orange', source: still, aspect: 3 / 2, panels: ['hsl'], scopes: ['vectorscope'],
    brief: 'Mute everything except the orange: the cup, the plum and the leaves should lose at least 60% of their chroma; the orange keeps at least 85%.',
    hint: 'Saturation tab: pull every slider except orange (and maybe red) to the left.',
    evaluate: (f, _p, _d, ref) => {
      const C = (r: [number, number, number, number], fr = f) => meanLch(fr, r)[1];
      const keep = ref ? C(REGIONS.stilllife.orange) / Math.max(1, C(REGIONS.stilllife.orange, ref)) : 1;
      const others = (['cup', 'plum', 'leaf'] as const).map((k) => (ref ? C(REGIONS.stilllife[k]) / Math.max(1, C(REGIONS.stilllife[k], ref)) : 1));
      const muted = others.reduce((a, b) => a + b, 0) / others.length;
      const k = rangeScore(keep, 0.85, 1.4, 0.4), m = rangeScore(muted, 0, 0.4, 0.4);
      return {
        criteria: [
          { label: 'Orange keeps its colour', score: k, weight: 1, detail: `Orange chroma ${Math.round(keep * 100)}% of original.` },
          { label: 'Everything else muted', score: m, weight: 2, detail: `Cup, plum and leaves average ${Math.round(muted * 100)}% of original chroma.` },
        ],
        worked: m >= 85 ? ['Classic selective colour, done entirely by hue.'] : [],
        improve: m < 85 ? ['Some colours are still too strong — check blue (cup), purple/magenta (plum) and green/yellow (leaves).'] : [],
      };
    },
  },
  {
    id: 'teal', label: 'Leaves toward teal', source: still, aspect: 3 / 2, panels: ['hsl'], scopes: ['vectorscope'],
    brief: 'Art direction wants cooler foliage: rotate the leaves’ hue 15–45° toward teal while the orange stays within ΔE 4.',
    hint: 'Hue tab: move the green (and a little yellow) slider to the right.',
    evaluate: (f, _p, _d, ref) => {
      const h = meanLch(f, REGIONS.stilllife.leaf)[2], h0 = ref ? meanLch(ref, REGIONS.stilllife.leaf)[2] : h;
      const shift = hueDelta(h0, h);
      const s = rangeScore(shift, 15, 45, 15);
      const orange = ref ? dE(meanLab(f, REGIONS.stilllife.orange), meanLab(ref, REGIONS.stilllife.orange)) : 0;
      const o = errorToScore(orange, 4, 15);
      return {
        criteria: [
          { label: 'Leaves rotated toward teal', score: s, weight: 2, detail: `Leaf hue moved ${shift.toFixed(0)}° (aim +15° to +45°).` },
          { label: 'Orange unchanged', score: o, weight: 1, detail: `Orange ΔE00 ${orange.toFixed(1)}.` },
        ],
        worked: s >= 85 ? ['The foliage cools convincingly.'] : [],
        improve: s < 85 ? [shift < 15 ? 'Rotate green further toward aqua.' : 'Too far — the leaves look artificial.'] : [],
      };
    },
  },
];

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  return <GradingChallenge ctx={ctx} title="Precision colour, three ways" rounds={rounds} intro={`Only the HSL mixer is available. Bands used here: ${['blue', 'orange', 'green'].map((b) => HSL_BANDS[band(b)].label).join(', ')} and their neighbours.`}
    why="Selective colour work is how photographers direct attention and build a recognisable palette: a signature sky, a muted background, a consistent skin rendering. The skill is knowing which band a colour really lives in." />;
}
