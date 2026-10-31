import { Concepts, LessonShell, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Note } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { errorToScore, rangeScore } from '../../lib/color';
import { castAdvice } from '../w3/WhiteBalance';
import { CompareObserve, FreeExperiment } from '../shared/GradingSteps';
import { frameLab, neutralReport, toneStats } from '../shared/measure';
import { GradingChallenge, LiveMetric, type GradingRound } from '../shared/Workbench';

const still = { kind: 'scene' as const, scene: 'stilllife' as const };
const CAP = { castTemp: 4200, castTint: 12, exposure: -0.9 };

export default function CorrectionVsGrading({ level }: LevelProps) {
  return (
    <LessonShell
      level={level}
      observe={
        <CompareObserve
          shots={[
            { label: 'Camera original', source: still, capture: CAP },
            { label: 'Corrected', source: still, capture: CAP, params: { temp: 4200, tint: 12, exposure: 0.9 } },
            { label: 'Graded', source: still, capture: CAP, params: { temp: 4200, tint: 12, exposure: 0.75, contrast: 0.2, gain: { x: -0.3, y: 0.28, m: 0 }, lift: { x: 0.3, y: -0.2, m: 0 }, saturation: 0.9 } },
          ]}
          question="Three versions of the same shot. What is different between the middle and the right one?"
          options={['The middle one is more correct', 'The right one has a mood', 'Both', 'I can’t tell them apart']}
          reveal={() => (
            <div className="space-y-2">
              <p><b>Correction</b> (middle) removes technical problems: the cast and the underexposure. The grey card is grey, the white is white. Nobody should notice it.</p>
              <p><b>Grading</b> (right) is a creative decision built on top: warmer highlights, cooler shadows, a touch more contrast. You are meant to <i>feel</i> it. Grade on a corrected image, or your look will inherit the cast.</p>
            </div>
          )}
        />
      }
      experiment={<FreeExperiment video scenes={[{ label: 'Still life clip', source: still, capture: CAP }]} panels={['wb', 'toneFull', 'wheels', 'colour']} scopes={['parade', 'vectorscope', 'waveform']} eyedropper
        notes={<Note>Work in two passes. First make the grey card neutral and correctly exposed (parade channels aligned, card near the middle of the waveform). Then, and only then, push the wheels for a look.</Note>} />}
      discover={
        <Concepts items={[
          { title: 'Correction', body: 'Technical repair: exposure, white balance, black and white levels, matching between cameras. The goal is a neutral, faithful starting point.' },
          { title: 'Grading', body: 'Creative interpretation: palette, contrast style, mood. It answers a story question — how should this moment feel?' },
          { title: 'Order matters', body: 'Correct first, grade second. A look applied to an uncorrected shot changes every time the footage changes. Applied to corrected footage, it travels consistently across a whole film.' },
          { title: 'Nodes and layers', body: 'Grading software keeps them separate: a correction node per shot, then a shared look node. Change either without breaking the other.' },
        ]} />
      }
      challenge={(ctx: ChallengeCtx) => <Challenge ctx={ctx} />}
    />
  );
}

const correct: GradingRound = {
  id: 'correct', label: 'Correct', source: still, capture: CAP, aspect: 3 / 2, video: true,
  panels: ['wb', 'toneFull'], scopes: ['parade', 'waveform'], eyedropper: true,
  brief: 'Pass one: correction only. Make the grey card neutral and place it at the middle of the tonal range (L* 45–55). No creative choices yet.',
  hint: 'Eyedropper on the grey card, then Exposure until the card sits near 45% on the waveform.',
  live: (f) => { const n = neutralReport(f); return <><LiveMetric label="Card chroma" value={`C* ${n.cardC.toFixed(1)}`} ok={n.cardC < 2} target="< 2" /><LiveMetric label="Card lightness" value={`L* ${n.cardL.toFixed(0)}`} ok={n.cardL >= 45 && n.cardL <= 55} target="45–55" /></>; },
  evaluate: (f) => {
    const n = neutralReport(f);
    const neu = errorToScore(n.cardC, 2, 15), ex = rangeScore(n.cardL, 45, 55, 12);
    return {
      criteria: [
        { label: 'Neutral balance', score: neu, weight: 2, detail: `Grey card C* ${n.cardC.toFixed(2)}.` },
        { label: 'Correct exposure', score: ex, weight: 2, detail: `Grey card L* ${n.cardL.toFixed(1)} (target 45–55).` },
      ],
      worked: neu >= 85 && ex >= 85 ? ['A clean, neutral, correctly exposed base.'] : [],
      improve: [...(neu < 85 ? [castAdvice(n.cardHue)] : []), ...(ex < 85 ? [n.cardL < 45 ? 'Still underexposed.' : 'Now overexposed.'] : [])],
      meta: { neutralChroma: n.cardC },
    };
  },
};

const grade: GradingRound = {
  id: 'grade', label: 'Grade', source: still, capture: CAP, aspect: 3 / 2, video: true,
  initial: { temp: 4200, tint: 12, exposure: 0.9 },
  panels: ['wb', 'toneFull', 'wheels', 'colour'], scopes: ['parade', 'vectorscope'],
  brief: 'Pass two: the correction is loaded for you. Now grade it as “late-afternoon warmth”: noticeably warmer overall, the grey card warm but still believable (C* 4–14), highlights intact.',
  hint: 'Warmth lives in the gain wheel (toward amber) more than in the white balance; keep the shadows slightly cool so it does not turn muddy.',
  evaluate: (f, _p, _d, ref) => {
    const fl = frameLab(f), fl0 = ref ? frameLab(ref) : fl, n = neutralReport(f), t = toneStats(f);
    const warm = rangeScore(fl.b - fl0.b, 4, 22, 5);
    const card = rangeScore(n.cardC, 4, 14, 6);
    const clip = errorToScore(t.clipHi * 100, 1, 8);
    return {
      criteria: [
        { label: 'Warm intent', score: warm, weight: 2, detail: `Average b* moved ${(fl.b - fl0.b).toFixed(1)} toward warm.` },
        { label: 'Believable', score: card, weight: 1, detail: `Grey card now C* ${n.cardC.toFixed(1)} — a deliberate tint, not a cast.` },
        { label: 'Highlights intact', score: clip, weight: 1, detail: `${(t.clipHi * 100).toFixed(1)}% clipped.` },
      ],
      worked: warm >= 85 ? ['The warmth reads as intent, built on a neutral base.'] : [],
      improve: warm < 85 ? ['Push the warmth further — the viewer should feel the late light.'] : card < 85 ? ['The grey card is drifting into “cast” territory; ease off.'] : [],
    };
  },
};

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  return <GradingChallenge ctx={ctx} title="Correct first, then grade" rounds={[correct, grade]} subjective
    why="Every professional pipeline separates the two jobs. Correction makes shots trustworthy and consistent; grading makes them meaningful. Mixing them is the most common reason amateur grades look inconsistent from shot to shot." />;
}
