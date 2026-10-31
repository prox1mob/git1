import { Concepts, LessonShell, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Note } from '../../components/ui';
import { REGIONS } from '../../engine/scenes';
import type { LevelProps } from '../../game/registry';
import { deltaE2000, errorToScore, rgbToLab } from '../../lib/color';
import { CompareObserve, FreeExperiment } from '../shared/GradingSteps';
import { meanLch, skinReport, toneStats } from '../shared/measure';
import { GradingChallenge, LiveMetric, type GradingRound } from '../shared/Workbench';

const window_ = (skin: number) => ({ kind: 'scene' as const, scene: 'portrait' as const, variant: skin, params: [3, 3, 0, 0] as [number, number, number, number] });

export default function PrimaryCorrection({ level }: LevelProps) {
  return (
    <LessonShell
      level={level}
      observe={
        <CompareObserve
          shots={[{ label: 'As shot', source: window_(2), capture: { castTemp: 3600, castTint: -18, exposure: -1.1 } }, { label: 'Reference', source: window_(2) }]}
          question="The left clip came off a camera with the wrong settings. What would you fix first?"
          options={['The colour', 'The brightness', 'The contrast', 'All at once']}
          reveal={() => <p>Colourists usually fix <b>exposure and contrast first</b> (levels on the waveform), then <b>balance</b> (white balance against a neutral, checked on the parade), then check <b>skin</b> on the vectorscope. Fixing in that order means each step doesn’t undo the last.</p>}
        />
      }
      experiment={<FreeExperiment video scenes={[{ label: 'Badly shot clip', source: window_(2), capture: { castTemp: 3600, castTint: -18, exposure: -1.1 } }]} panels={['wb', 'toneFull', 'wheels']} scopes={['waveform', 'parade', 'vectorscope']} eyedropper
        notes={<Note>The plaster wall behind the sitter is close to neutral — a useful reference on the parade.</Note>} />}
      discover={
        <Concepts items={[
          { title: 'Primaries', body: 'Whole-image corrections: exposure, contrast, white balance, lift/gamma/gain. “Secondaries” come later and target parts of the image.' },
          { title: 'Read the waveform', body: 'Blacks should sit just above 0%, highlights below 100%. A face typically lands around 50–70% depending on complexion and mood.' },
          { title: 'Balance on the parade', body: 'Anything that should be neutral — a grey wall, a white shirt — shows equal heights in R, G and B. Align them and the cast is gone.' },
          { title: 'Check skin last', body: 'After balancing, skin should sit on the vectorscope’s skin line. If it does not, the light itself was coloured — fix gently, not to the point of greying the face.' },
        ]} />
      }
      challenge={(ctx: ChallengeCtx) => <Challenge ctx={ctx} />}
    />
  );
}

const mk = (id: string, label: string, skin: number, capture: GradingRound['capture'], brief: string): GradingRound => ({
  id, label, source: window_(skin), capture, aspect: 3 / 2, video: true, brief,
  panels: ['wb', 'toneFull', 'wheels'], scopes: ['waveform', 'parade', 'vectorscope'], eyedropper: true,
  reference: { capture: {} },
  hint: 'Use the eyedropper on the wall, then set exposure so the wall and face match the clean reference levels.',
  live: (f) => { const w = meanLch(f, REGIONS.portrait.backdrop), s = skinReport(f); return <><LiveMetric label="Wall chroma" value={`C* ${w[1].toFixed(1)}`} ok={w[1] < 3} target="< 3" /><LiveMetric label="Skin off line" value={`${s.error.toFixed(1)}°`} ok={s.error < 6} target="< 6°" /></>; },
  evaluate: (f, _p, _d, ref) => {
    const w = meanLch(f, REGIONS.portrait.backdrop), s = skinReport(f), t = toneStats(f);
    const s0 = ref ? skinReport(ref) : s, w0 = ref ? meanLch(ref, REGIONS.portrait.backdrop) : w;
    const skinDE = deltaE2000(rgbToLab(s.rgb), rgbToLab(s0.rgb));
    const wallL = Math.abs(w[0] - w0[0]);
    return {
      criteria: [
        { label: 'Balance', score: errorToScore(Math.max(0, w[1] - w0[1] * 0.5), 2, 14), weight: 2, detail: `Wall chroma C* ${w[1].toFixed(1)} (clean capture ${w0[1].toFixed(1)}).` },
        { label: 'Exposure', score: errorToScore(wallL, 3, 18), weight: 2, detail: `Wall L* ${w[0].toFixed(0)} vs ${w0[0].toFixed(0)} in a clean capture.` },
        { label: 'Skin', score: errorToScore(skinDE, 3, 18), weight: 2, detail: `Skin ΔE00 ${skinDE.toFixed(1)} from the clean capture; ${s.error.toFixed(1)}° off the skin line.` },
        { label: 'Legal levels', score: errorToScore(Math.max(t.clipHi, t.clipLo) * 100, 1, 8), weight: 1, detail: `${(t.clipHi * 100).toFixed(1)}% clipped highlights, ${(t.clipLo * 100).toFixed(1)}% crushed blacks.` },
      ],
      worked: skinDE < 4 ? ['Skin matches a clean capture — the correction is invisible, as it should be.'] : [],
      improve: [...(w[1] > 4 ? ['The wall still carries a cast; align the parade on it.'] : []), ...(wallL > 4 ? ['Exposure is off compared with a clean capture.'] : [])],
      meta: { skinHueError: s.error },
    };
  },
});

const rounds = [
  mk('tungsten', 'Tungsten & dark', 2, { castTemp: 3600, castTint: -18, exposure: -1.1 }, 'Shot under household lamps with daylight balance and a stop under. Restore a clean, neutral, correctly exposed image.'),
  mk('shade', 'Blue shade & bright', 4, { castTemp: 10500, exposure: 0.8 }, 'Shot in open shade, overexposed by almost a stop. Correct it.'),
];

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  return <GradingChallenge ctx={ctx} title="Primary correction on two bad clips" rounds={rounds}
    intro="Scored against what a correctly set camera would have recorded: wall neutrality, exposure, skin colour and legal levels."
    why="Primary correction is most of a colourist’s working day. Fast, accurate primaries — guided by scopes, not just eyes on an uncalibrated screen — are what make the creative work possible." />;
}
