import { Concepts, LessonShell, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Note } from '../../components/ui';
import { HSL_BANDS } from '../../engine/params';
import { REGIONS } from '../../engine/scenes';
import type { LevelProps } from '../../game/registry';
import { errorToScore, rangeScore } from '../../lib/color';
import { CompareObserve, FreeExperiment } from '../shared/GradingSteps';
import { frameLab, meanLch, skinReport, tonalColour } from '../shared/measure';
import { GradingChallenge, LiveMetric, type GradingRound } from '../shared/Workbench';

const portraitNeon = { kind: 'scene' as const, scene: 'portrait' as const, variant: 3, params: [2, 3, 0, 0] as [number, number, number, number] };
const portraitSun = { kind: 'scene' as const, scene: 'portrait' as const, variant: 2, params: [1, 4, 0, 0] as [number, number, number, number] };
const street = { kind: 'scene' as const, scene: 'street' as const };
const tealOrange = {
  lift: { x: 0.55, y: -0.45, m: 0 }, gain: { x: -0.45, y: 0.5, m: 0 }, saturation: 1.35,
  hsl: HSL_BANDS.map((b) => ({ h: b.id === 'green' || b.id === 'aqua' || b.id === 'blue' ? -0.4 : b.id === 'yellow' ? -0.5 : 0, s: b.id === 'orange' ? 0.4 : 0, l: 0 })),
};

export default function CinematicContrast({ level }: LevelProps) {
  return (
    <LessonShell
      level={level}
      observe={
        <CompareObserve
          shots={[
            { label: 'Golden hour, as shot', source: portraitSun },
            { label: '“Teal & orange” preset', source: portraitSun, params: tealOrange },
            { label: 'Neon night, as shot', source: portraitNeon },
          ]}
          question="A one-click ‘teal & orange’ preset was applied to the middle image. Did it make it more cinematic?"
          options={['Yes, much more', 'It looks forced', 'The right one already looks cinematic without it']}
          reveal={() => (
            <div className="space-y-2">
              <p>The preset pushed skin toward orange and the backdrop toward teal regardless of what was actually there, so the face looks fake. Meanwhile the neon frame looks cinematic <i>before any grading</i> — because the colour contrast was built by lighting and production design.</p>
              <p>Grading amplifies colour relationships that exist in the frame; it rarely invents good ones from nothing.</p>
            </div>
          )}
        />
      }
      experiment={<FreeExperiment video scenes={[{ label: 'Night street', source: street, aspect: 16 / 9 }, { label: 'Neon portrait', source: portraitNeon }, { label: 'Golden hour portrait', source: portraitSun }, { label: 'Teal & orange preset', source: portraitSun, initial: tealOrange }]} panels={['wheels', 'hsl', 'colour', 'film']} scopes={['vectorscope', 'parade']}
        notes={<Note>Load the “Teal & orange preset” image and try to rescue the skin. Then compare with the neon portrait: watch how its vectorscope already has two clean arms.</Note>} />}
      discover={
        <Concepts items={[
          { title: 'Warm/cool separation', body: 'Warm light on the subject, cool ambient elsewhere: the most common cinematic colour relationship because it mirrors real light — sun versus sky, tungsten versus moonlight.' },
          { title: 'Complementary palettes', body: 'Orange/teal is popular because skin is orange and its complement is teal. But red/green, yellow/violet and others work when the production design supports them.' },
          { title: 'Colour density', body: 'Rich, deep colours — saturated but not bright — feel “filmic”. Digital saturation boosts brightness and saturation together, which reads as cheap.' },
          { title: 'Saturation hierarchy', body: 'Decide which colour leads. Usually skin and one story colour are most saturated; the rest is held back so it doesn’t compete.' },
          { title: 'It starts on set', body: 'Lighting, wardrobe, locations and art direction create the palette. A colourist refines and unifies it. A preset can’t build relationships that aren’t in the frame.' },
        ]} />
      }
      challenge={(ctx: ChallengeCtx) => <Challenge ctx={ctx} />}
    />
  );
}

const rounds: GradingRound[] = [
  {
    id: 'street', label: 'Night street', source: street, aspect: 16 / 9, video: true, panels: ['wheels', 'hsl', 'colour', 'film'], scopes: ['vectorscope'],
    brief: 'Strengthen the existing warm/cool contrast: sodium-warm highlights against cool shadows, with density rather than raw saturation. Don’t let overall saturation explode.',
    hint: 'Lift toward blue for the shadows; Gain toward amber for the lamps; a little Density instead of Saturation.',
    live: (f) => { const hi = tonalColour(f, 'highlights'), lo = tonalColour(f, 'shadows'); return <><LiveMetric label="Highlight b*" value={hi[2].toFixed(1)} ok={hi[2] > 10} /><LiveMetric label="Shadow b*" value={lo[2].toFixed(1)} ok={lo[2] < -2} /></>; },
    evaluate: (f, p, _d, ref) => {
      const hi = tonalColour(f, 'highlights'), lo = tonalColour(f, 'shadows'), hi0 = ref ? tonalColour(ref, 'highlights') : hi, lo0 = ref ? tonalColour(ref, 'shadows') : lo;
      const split = (hi[2] - lo[2]) - (hi0[2] - lo0[2]);
      const fl = frameLab(f), fl0 = ref ? frameLab(ref) : fl;
      return {
        criteria: [
          { label: 'Warm/cool split increased', score: rangeScore(split, 6, 60, 8), weight: 2, detail: `Highlight–shadow b* gap grew by ${split.toFixed(1)}.` },
          { label: 'Cool shadows', score: rangeScore(-lo[2], 2, 40, 5), weight: 1, detail: `Shadow b* ${lo[2].toFixed(1)}.` },
          { label: 'Controlled saturation', score: rangeScore(fl.C / Math.max(1, fl0.C), 0.8, 1.35, 0.3), weight: 1, detail: `Average chroma ${fl0.C.toFixed(1)} → ${fl.C.toFixed(1)}${p.density > 0 ? `, density ${Math.round(p.density * 100)}` : ''}.` },
        ],
        worked: split >= 6 ? ['The frame now has a clear temperature structure.'] : [],
        improve: split < 6 ? ['Push lamps warmer and shadows cooler.'] : [],
      };
    },
  },
  {
    id: 'rescue', label: 'Rescue the preset', source: portraitSun, aspect: 3 / 2, video: true, initial: tealOrange, panels: ['wheels', 'hsl', 'colour'], scopes: ['vectorscope'],
    reference: { params: {} },
    brief: 'Someone applied a heavy teal & orange preset. Keep some of its warm/cool separation, but bring the skin back to believable (within 8° of the skin line, saturation within 30% of natural).',
    hint: 'Pull the orange saturation back and reduce the gain push. The vectorscope skin line is your referee.',
    live: (f) => { const s = skinReport(f); return <LiveMetric label="Skin off line" value={`${s.error.toFixed(1)}°`} ok={s.error < 8} target="< 8°" />; },
    evaluate: (f, _p, _d, ref) => {
      const s = skinReport(f), s0 = ref ? skinReport(ref) : s;
      const bg = meanLch(f, REGIONS.portrait.backdrop);
      const satR = s.C / Math.max(1, s0.C);
      return {
        criteria: [
          { label: 'Skin on the line', score: errorToScore(s.error, 6, 25), weight: 2, detail: `${s.error.toFixed(1)}° off.` },
          { label: 'Skin saturation natural', score: rangeScore(satR, 0.8, 1.3, 0.4), weight: 2, detail: `${Math.round(satR * 100)}% of the natural skin chroma.` },
          { label: 'Some separation kept', score: rangeScore(bg[1], 6, 60, 6), weight: 1, detail: `Backdrop chroma C* ${bg[1].toFixed(1)}.` },
        ],
        worked: s.error < 6 ? ['The face is human again.'] : [],
        improve: satR > 1.3 ? ['Skin is still over-cooked — reduce orange saturation.'] : [],
        meta: { skinHueError: s.error },
      };
    },
  },
];

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  return <GradingChallenge ctx={ctx} title="Colour contrast with taste" rounds={rounds} subjective
    why="Audiences read colour relationships long before they notice colours. A cinematic grade organises the frame into a hierarchy — warm against cool, rich against muted — without breaking the skin that the story depends on." />;
}
