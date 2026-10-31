import { Concepts, LessonShell, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Note } from '../../components/ui';
import type { Frame } from '../../engine/GradeEngine';
import { REGIONS } from '../../engine/scenes';
import type { GradeParams } from '../../engine/params';
import type { LevelProps } from '../../game/registry';
import { errorToScore, rangeScore } from '../../lib/color';
import { CompareObserve, FreeExperiment } from '../shared/GradingSteps';
import { frameLab, meanLch, skinReport, tonalColour, toneStats } from '../shared/measure';
import { GradingChallenge, type GradingRound, type RoundResult } from '../shared/Workbench';
import type { Criterion } from '../../components/lesson/LessonShell';

const raw = { kind: 'scene' as const, scene: 'portrait' as const, variant: 3, params: [3, 0, 0, 0] as [number, number, number, number] };
const CAPTURE = { exposure: -0.85, castTemp: 4700 };
const ALL: GradingRound['panels'] = ['wb', 'toneFull', 'wheels', 'curves', 'hsl', 'colour', 'film'];

function technical(f: Frame): { criteria: Criterion[]; improve: string[] } {
  const t = toneStats(f), sk = skinReport(f);
  const clip = errorToScore(t.clipHi * 100, 1, 10);
  const skin = errorToScore(sk.error, 8, 25);
  return {
    criteria: [
      { label: 'Technical · highlights intact', score: clip, weight: 0.75, detail: `${(t.clipHi * 100).toFixed(1)}% clipped.` },
      { label: 'Technical · skin believable', score: skin, weight: 0.75, detail: `Skin ${sk.error.toFixed(1)}° from the skin line.` },
    ],
    improve: [...(clip < 85 ? ['Highlights are clipping.'] : []), ...(skin < 85 ? ['Skin has left the believable range on the vectorscope.'] : [])],
  };
}

const look = (id: string, label: string, brief: string, creative: (f: Frame, p: GradeParams, ref: Frame) => { criteria: Criterion[]; worked: string[]; improve: string[] }): GradingRound => ({
  id, label, brief, source: raw, capture: CAPTURE, aspect: 3 / 2, panels: ALL, scopes: ['histogram', 'vectorscope', 'parade'],
  evaluate: (f, p, _d, ref): RoundResult => {
    const tech = technical(f);
    const c = creative(f, p, ref ?? f);
    return { criteria: [...tech.criteria, ...c.criteria], worked: c.worked, improve: [...tech.improve, ...c.improve] };
  },
});

const rounds: GradingRound[] = [
  look('natural', 'Natural editorial', 'Clean, honest, magazine-ready: neutral background, true skin, gentle contrast, nothing that announces itself.', (f) => {
    const bg = meanLch(f, REGIONS.portrait.backdrop), face = meanLch(f, REGIONS.portrait.forehead), t = toneStats(f), sk = skinReport(f);
    const crit = [
      { label: 'Look · neutral background', score: errorToScore(bg[1], 4, 20), weight: 1, detail: `Backdrop chroma C* ${bg[1].toFixed(1)}.` },
      { label: 'Look · true skin', score: errorToScore(sk.error, 4, 15), weight: 1, detail: `${sk.error.toFixed(1)}° from the line.` },
      { label: 'Look · face exposure', score: rangeScore(face[0], 58, 76, 8), weight: 1, detail: `Forehead L* ${face[0].toFixed(0)}.` },
      { label: 'Look · gentle contrast', score: rangeScore(t.std, 0.13, 0.24, 0.08), weight: 1, detail: `Luminance spread ${t.std.toFixed(3)}.` },
    ];
    return { criteria: crit, worked: crit[0].score >= 85 ? ['The white balance is clean — the grey wall is grey.'] : [], improve: crit[0].score < 85 ? ['Neutralise the backdrop first; editorial work starts from honest colour.'] : [] };
  }),
  look('moody', 'Cinematic & moody', 'Darker, heavier, cooler shadows, restrained colour. A still from a slow-burning drama.', (f, _p, ref) => {
    const t = toneStats(f), t0 = toneStats(ref), lo = tonalColour(f, 'shadows'), fl = frameLab(f), fl0 = frameLab(ref);
    const crit = [
      { label: 'Look · darker overall', score: rangeScore(t0.median - t.median, 0.06, 0.35, 0.08), weight: 1, detail: `Median ${Math.round(t0.median * 100)}% → ${Math.round(t.median * 100)}%.` },
      { label: 'Look · cool shadows', score: rangeScore(-lo[2], 2, 25, 5), weight: 1, detail: `Shadow b* ${lo[2].toFixed(1)}.` },
      { label: 'Look · restrained colour', score: rangeScore(fl0.C - fl.C, 1.5, 30, 3), weight: 1, detail: `Average chroma ${fl0.C.toFixed(1)} → ${fl.C.toFixed(1)}.` },
      { label: 'Look · more contrast', score: rangeScore(t.std / Math.max(1e-3, t0.std), 1.1, 1.8, 0.2), weight: 1, detail: `Spread ${t0.std.toFixed(3)} → ${t.std.toFixed(3)}.` },
    ];
    return { criteria: crit, worked: crit[1].score >= 85 ? ['Cool, deep shadows give the frame weight.'] : [], improve: crit[0].score < 85 ? ['Moody images usually sit lower — bring exposure or gamma down.'] : [] };
  }),
  look('film', 'Warm nostalgic film', 'Late-summer memory: warm, soft, lifted blacks, a touch of grain.', (f, p, ref) => {
    const t = toneStats(f), t0 = toneStats(ref), fl = frameLab(f), fl0 = frameLab(ref);
    const crit = [
      { label: 'Look · warm shift', score: rangeScore(fl.b - fl0.b, 4, 30, 6), weight: 1, detail: `Average b* ${fl0.b.toFixed(1)} → ${fl.b.toFixed(1)}.` },
      { label: 'Look · lifted blacks', score: rangeScore(t.p02, 0.06, 0.2, 0.06), weight: 1, detail: `Darkest 2% at ${Math.round(t.p02 * 100)}%.` },
      { label: 'Look · softer contrast', score: rangeScore(t.std / Math.max(1e-3, t0.std), 0.6, 0.92, 0.15), weight: 1, detail: `Spread ${t0.std.toFixed(3)} → ${t.std.toFixed(3)}.` },
      { label: 'Look · grain', score: p.grain >= 0.1 ? 100 : p.grain > 0 ? 60 : 0, weight: 0.5, detail: `Grain ${Math.round(p.grain * 100)}.` },
    ];
    return { criteria: crit, worked: crit[0].score >= 85 ? ['The warmth feels like late light, not a filter.'] : [], improve: crit[1].score < 85 ? ['Lift the black point (curve or Faded blacks) for the printed-film softness.'] : [] };
  }),
];

export default function MasterChallenge({ level }: LevelProps) {
  return (
    <LessonShell
      level={level}
      observe={
        <CompareObserve
          shots={[
            { label: 'Editorial', source: raw, params: { temp: 5600, exposure: 0.5, contrast: 0.05 } },
            { label: 'Moody', source: raw, params: { temp: 5600, exposure: 0.1, contrast: 0.3, saturation: 0.75, lift: { x: 0.4, y: -0.25, m: -0.1 }, gammaW: { x: 0, y: 0, m: -0.2 } } },
            { label: 'Nostalgic', source: raw, params: { temp: 4800, exposure: 0.55, contrast: -0.15, fade: 0.6, grain: 0.35, gain: { x: -0.3, y: 0.25, m: 0 } } },
          ]}
          question="One photograph, three readings. Which one would you put on a magazine cover, which in a film, which in a family album?"
          options={['I see three different stories', 'They look nearly the same', 'Only one feels right']}
          reveal={() => <p>Same pixels, three intents. Grading is interpretation: the technical work (exposure, white balance, skin) makes the image trustworthy; the creative work tells the viewer how to feel about it. In this challenge we score those two separately.</p>}
        />
      }
      experiment={<FreeExperiment scenes={[{ label: 'The raw portrait', source: raw, capture: CAPTURE }]} panels={ALL} scopes={['histogram', 'vectorscope', 'parade']} eyedropper notes={<Note>Every tool you have learned is unlocked here. Work in order: balance → exposure → contrast → colour → finishing.</Note>} />}
      discover={
        <Concepts items={[
          { title: 'Correct, then create', body: 'Neutral balance and sound exposure first. A look built on a cast or a clipped highlight will fall apart the moment it is printed or viewed on another screen.' },
          { title: 'A look is a set of decisions', body: 'Where does the black sit? How warm are the highlights? How saturated is the background? Name each decision and you can repeat the look across a whole series.' },
          { title: 'Technical vs creative', body: 'Technical quality is measurable: clipping, skin hue, neutrality. Creative success depends on intent — we measure tendencies against a brief and say so honestly.' },
        ]} />
      }
      challenge={(ctx: ChallengeCtx) => (
        <GradingChallenge ctx={ctx} title="One raw photograph, three looks" rounds={rounds} subjective saveAs="Photography master challenge"
          intro="Each look is scored twice: technical quality (measured) and how well it matches its brief (a transparent rubric of measurable tendencies). Save the looks you like to your gallery."
          why="Professional photographers deliver the same shoot in several treatments — for web, print, campaign, archive. Being able to switch intent deliberately, while keeping the technical foundation intact, is the core skill of grading." />
      )}
    />
  );
}
