import { Concepts, LessonShell, type ChallengeCtx, type Criterion } from '../../components/lesson/LessonShell';
import { Note } from '../../components/ui';
import type { Frame } from '../../engine/GradeEngine';
import type { GradeParams } from '../../engine/params';
import type { LevelProps } from '../../game/registry';
import { rangeScore } from '../../lib/color';
import { CompareObserve, FreeExperiment } from '../shared/GradingSteps';
import { frameLab, tonalColour, toneStats } from '../shared/measure';
import { GradingChallenge, type GradingRound } from '../shared/Workbench';

const street = { kind: 'scene' as const, scene: 'street' as const };
const ALL: GradingRound['panels'] = ['toneFull', 'wb', 'wheels', 'curves', 'hsl', 'colour', 'film'];

type Rubric = (f: Frame, p: GradeParams, ref: Frame) => Criterion[];
const delta = (f: Frame, ref: Frame) => {
  const t = toneStats(f), t0 = toneStats(ref), l = frameLab(f), l0 = frameLab(ref);
  return { t, t0, l, l0, dMed: t.median - t0.median, dStd: t.std / Math.max(1e-3, t0.std), dC: l.C / Math.max(1, l0.C), db: l.b - l0.b, lo: tonalColour(f, 'shadows'), hi: tonalColour(f, 'highlights') };
};

const MOODS: { id: string; label: string; brief: string; rubric: Rubric }[] = [
  { id: 'suspense', label: 'Suspense', brief: 'Something is wrong on this street. Darker, harder contrast, cold or sickly colour, deep shadows that could hide anything.', rubric: (f, _p, r) => { const d = delta(f, r); return [
    { label: 'Darker', score: rangeScore(-d.dMed, 0.03, 0.3, 0.05), weight: 1, detail: `Median ${Math.round(d.t0.median * 100)}% → ${Math.round(d.t.median * 100)}%.` },
    { label: 'Harder contrast', score: rangeScore(d.dStd, 1.1, 2, 0.2), weight: 1, detail: `Contrast ×${d.dStd.toFixed(2)}.` },
    { label: 'Cold or sickly shadows', score: rangeScore(-d.lo[2] + Math.max(0, -d.lo[1]), 3, 60, 6), weight: 1, detail: `Shadow a*/b* ${d.lo[1].toFixed(1)} / ${d.lo[2].toFixed(1)}.` },
  ]; } },
  { id: 'romance', label: 'Romance', brief: 'Two people are about to meet. Warm, soft, glowing highlights, gentle contrast, flattering colour.', rubric: (f, p, r) => { const d = delta(f, r); return [
    { label: 'Warmer', score: rangeScore(d.db, 3, 30, 5), weight: 1, detail: `Average b* +${d.db.toFixed(1)}.` },
    { label: 'Softer contrast', score: rangeScore(d.dStd, 0.6, 0.95, 0.15), weight: 1, detail: `Contrast ×${d.dStd.toFixed(2)}.` },
    { label: 'Glow', score: p.halation > 0.15 || d.hi[0] > 70 ? 100 : 40, weight: 0.5, detail: `Halation ${Math.round(p.halation * 100)}, highlight L* ${d.hi[0].toFixed(0)}.` },
  ]; } },
  { id: 'loneliness', label: 'Loneliness', brief: 'One person, late, nobody else around. Cool, desaturated, empty — quiet rather than scary.', rubric: (f, _p, r) => { const d = delta(f, r); return [
    { label: 'Cooler', score: rangeScore(-d.db, 3, 30, 5), weight: 1, detail: `Average b* ${d.db.toFixed(1)}.` },
    { label: 'Desaturated', score: rangeScore(1 - d.dC, 0.2, 0.9, 0.15), weight: 1, detail: `Chroma ×${d.dC.toFixed(2)}.` },
    { label: 'Not harsh', score: rangeScore(d.dStd, 0.7, 1.1, 0.2), weight: 0.5, detail: `Contrast ×${d.dStd.toFixed(2)}.` },
  ]; } },
  { id: 'nostalgia', label: 'Nostalgia', brief: 'A memory of this street from years ago. Faded blacks, warm-amber cast, softer colour, grain.', rubric: (f, p, r) => { const d = delta(f, r); return [
    { label: 'Faded blacks', score: rangeScore(d.t.p02, 0.05, 0.2, 0.05), weight: 1, detail: `Darkest 2% at ${Math.round(d.t.p02 * 100)}%.` },
    { label: 'Warm-amber', score: rangeScore(d.db, 3, 30, 5), weight: 1, detail: `Average b* +${d.db.toFixed(1)}.` },
    { label: 'Grain', score: p.grain >= 0.1 ? 100 : 30, weight: 0.5, detail: `Grain ${Math.round(p.grain * 100)}.` },
  ]; } },
];

const rounds: GradingRound[] = MOODS.map((m) => ({
  id: m.id, label: m.label, brief: m.brief, source: street, aspect: 16 / 9, video: true, panels: ALL, scopes: ['vectorscope', 'histogram'],
  evaluate: (f, p, _d, ref) => {
    const criteria = m.rubric(f, p, ref ?? f);
    const low = criteria.filter((c) => c.score < 70).map((c) => c.label.toLowerCase());
    return { criteria, worked: low.length === 0 ? ['Every convention for this mood is present.'] : [], improve: low.length ? [`Conventionally ${m.label.toLowerCase()} also leans on: ${low.join(', ')}.`] : [] };
  },
}));

export default function MoodNarrative({ level }: LevelProps) {
  return (
    <LessonShell
      level={level}
      observe={
        <CompareObserve
          shots={[
            { label: 'One', source: street, aspect: 16 / 9, params: { exposure: -0.4, contrast: 0.45, temp: 9000, tint: -20, saturation: 0.7 } },
            { label: 'Two', source: street, aspect: 16 / 9, params: { exposure: 0.3, contrast: -0.25, temp: 4800, halation: 0.6, fade: 0.4, grain: 0.4 } },
          ]}
          question="Same street, same instant. What is about to happen in each?"
          options={['One: danger. Two: a memory or a meeting', 'The opposite', 'Nothing different']}
          reveal={() => <p>Most people read the cold, contrasty version as threatening and the warm, soft, glowing one as tender or remembered. Nothing in the content changed — only tone and colour. These associations are learned conventions from cinema and culture; they are strong, but not universal.</p>}
        />
      }
      experiment={<FreeExperiment video scenes={[{ label: 'Night street', source: street, aspect: 16 / 9 }]} panels={ALL} scopes={['vectorscope', 'histogram']} notes={<Note>Grade freely. Try the same scene at four emotional temperatures and notice which controls carry the most feeling: usually contrast and colour temperature, then saturation.</Note>} />}
      discover={
        <Concepts items={[
          { title: 'Tone carries tension', body: 'Hard contrast and deep shadows hide information — the viewer feels uncertainty. Soft contrast reveals everything — the viewer relaxes.' },
          { title: 'Temperature carries warmth (literally)', body: 'Warm palettes read as intimacy, comfort, the past. Cool palettes read as distance, isolation, the clinical or the night.' },
          { title: 'Saturation carries energy', body: 'Rich colour feels alive and present; desaturation feels drained, melancholic or documentary.' },
          { title: 'Texture carries time', body: 'Grain, halation and faded blacks evoke film stock — and therefore memory, nostalgia, or a particular era.' },
          { title: 'Conventions, not laws', body: 'These links come from decades of films. Context, culture and story can invert them — a warm, golden horror film is unsettling precisely because it breaks the rule.' },
        ]} />
      }
      challenge={(ctx: ChallengeCtx) => (
        <GradingChallenge ctx={ctx} title="Four moods, one scene" rounds={rounds} subjective saveAs="Mood & narrative"
          intro="Each mood is scored against a transparent rubric of genre conventions (darker? warmer? softer?). They are tendencies, not truths — a great colourist can break them on purpose."
          why="Directors talk in feelings, not numbers. Translating ‘make it feel lonely’ into contrast, temperature and saturation decisions — consistently — is the colourist’s real craft." />
      )}
    />
  );
}
