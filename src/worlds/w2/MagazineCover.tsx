import { useRef, useState } from 'react';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx, type Criterion } from '../../components/lesson/LessonShell';
import { Badge, Button } from '../../components/ui';
import { defaultParams } from '../../engine/params';
import type { LevelProps } from '../../game/registry';
import { rangeScore } from '../../lib/color';
import { useSaveToGallery } from '../../lib/gallery';
import { alignment, collisions, colourRelationship, hierarchy, legibility, margins, subjectRespect } from '../shared/compRubrics';
import { Composer, exportComposition, type ComposerHandle, type Composition, type CompositionFacts, type TextLayer } from '../shared/Composer';

const PHOTO = { kind: 'scene' as const, scene: 'portrait' as const, variant: 3, params: [1, 3, 0, 0] as [number, number, number, number], frame: [0, 0.04, 0.82] as [number, number, number] };
const T = (id: string, role: TextLayer['role'], label: string, text: string, font: string, size: number, weight: number, x: number, y: number, w: number, extra: Partial<TextLayer> = {}): TextLayer =>
  ({ id, role, label, text, font, size, weight, color: '#FFFFFF', x, y, w, align: 'left', caps: false, tracking: 0, leading: 1.1, ...extra });

const MESSY: TextLayer[] = [
  T('mast', 'masthead', 'Masthead', 'ATLAS', 'inter', 46, 800, 360, 640, 220, { color: '#E8D9C4' }),
  T('main', 'headline', 'Main cover line', 'The Colour Issue', 'inter', 30, 700, 180, 210, 260, { color: '#F2C28C' }),
  T('l1', 'standfirst', 'Cover line 1', 'Why grey is the new gold', 'fraunces', 22, 600, 300, 330, 240),
  T('l2', 'standfirst', 'Cover line 2', '48 pages of autumn', 'fraunces', 24, 600, 20, 420, 200),
  T('l3', 'caption', 'Date & price', 'November · £6.50', 'inter', 11, 500, 260, 520, 160, { caps: true, tracking: 120 }),
];
const GOOD: TextLayer[] = [
  T('mast', 'masthead', 'Masthead', 'ATLAS', 'bodoni', 150, 700, 40, 36, 520, { align: 'center', tracking: 20, leading: 1 }),
  T('main', 'headline', 'Main cover line', 'The Colour Issue', 'playfair', 44, 700, 40, 560, 300, { leading: 1 }),
  T('l1', 'standfirst', 'Cover line 1', 'Why grey is the new gold', 'inter', 15, 500, 40, 660, 260),
  T('l2', 'standfirst', 'Cover line 2', '48 pages of autumn', 'inter', 15, 500, 40, 690, 260),
  T('l3', 'caption', 'Date & price', 'November · £6.50', 'inter', 10, 600, 420, 690, 140, { caps: true, tracking: 120, align: 'right' }),
];
const comp = (layers: TextLayer[], behind = false): Composition => ({ width: 600, height: 750, bg: '#111', grid: { cols: 12, margin: 36, gutter: 12 }, image: { source: PHOTO, rect: [0, 0, 600, 750], params: defaultParams(), behindHead: behind }, layers });

export function coverRubric(f: CompositionFacts): Criterion[] {
  const mast = f.layers.find((l) => l.layer.role === 'masthead');
  const top = mast ? rangeScore(mast.rect[1] / 750, 0, 0.18, 0.25) : 0;
  return [
    { label: 'Masthead commands the top', score: Math.round((top + (mast ? rangeScore(mast.layer.size, 110, 260, 70) : 0)) / 2), weight: 2, detail: mast ? `Masthead at ${Math.round(mast.rect[1])} from the top, ${mast.layer.size} units tall.` : 'No masthead.' },
    legibility(f, ['headline', 'standfirst', 'caption']),
    { ...legibility(f, ['masthead']), label: 'Masthead reads', weight: 1 },
    subjectRespect(f, ['headline', 'standfirst', 'caption']),
    hierarchy(f, 'headline', ['standfirst', 'caption'], 1.8),
    alignment(f, 2), collisions(f), margins(f), colourRelationship(f),
  ];
}

export default function MagazineCover({ level }: LevelProps) {
  return <LessonShell level={level}
    observe={
      <div className="space-y-5">
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><Composer comp={comp(MESSY)} setComp={() => {}} viewOnly /><Composer comp={comp(GOOD, true)} setComp={() => {}} viewOnly /></div>
        <ObserveQuestion question="Which cover would you notice on a crowded news-stand — and why?" options={['Left', 'Right — the masthead owns the top', 'Right — the face is clear', 'Right — the lines are ordered']}
          reveal={() => <p>The right one, for all three reasons. Its masthead fills the top and even tucks <i>behind</i> the model’s head — a classic trick that adds depth and confidence. The face is never covered, the main line clearly outranks the others, and everything hangs from one margin. The left has the same ingredients, randomly placed.</p>} />
      </div>
    }
    experiment={<Workbench layers={GOOD} behind />}
    discover={
      <Concepts items={[
        { title: 'The masthead', body: 'The magazine’s name, usually huge at the top so it reads from across a shop. It can sit behind the subject’s head — the subject “owns” the brand.' },
        { title: 'The cover star', body: 'The face sells the issue. Eyes and mouth must stay clear; type works around them.' },
        { title: 'Cover lines', body: 'One dominant main line and a few smaller supporting lines, often down one side. Hierarchy decides what a passer-by reads in two seconds.' },
        { title: 'Colour from the photo', body: 'Pick type colours from the image — a sweater, a lip, the light — or their complements. It makes the type feel part of the picture.' },
        { title: 'Legibility over the image', body: 'Type sits on a busy photograph. Check contrast where each line lands, not in the abstract.' },
      ]} />
    }
    challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

function Workbench({ layers, behind }: { layers: TextLayer[]; behind?: boolean }) {
  const [c, setC] = useState(() => comp(layers, behind));
  return <Composer comp={c} setComp={setC} />;
}

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const [c, setC] = useState(() => comp(MESSY));
  const [facts, setFacts] = useState<CompositionFacts | null>(null);
  const handle = useRef<ComposerHandle | null>(null);
  const save = useSaveToGallery();
  const submit = () => {
    if (!facts) return;
    const criteria = coverRubric(facts);
    ctx.submit({ score: weighted(criteria), criteria, subjective: true,
      worked: criteria.filter((x) => x.score >= 90).map((x) => `${x.label}: ${x.detail}`),
      improve: criteria.filter((x) => x.score < 75).map((x) => `${x.label}: ${x.detail}`),
      why: 'A cover is an advertisement for the magazine, judged in a second at a distance. Typography, hierarchy and the relationship between type and photograph do almost all of that work. Several checks here are measured on your actual layout; the overall taste is still judged by you.' });
  };
  return (
    <div>
      <ChallengeBrief title="Art-direct the November cover">
        Make a sophisticated fashion cover: a commanding masthead (try placing it behind the head), one main line, two supporting lines and the date. Keep the face clear, keep type legible on the photograph, and let colour relate to the image.
      </ChallengeBrief>
      <Composer comp={c} setComp={setC} onFacts={setFacts} handleRef={handle}
        sidebarTop={
          <div className="space-y-3 rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
            {ctx.difficulty === 'beginner' && facts && <div className="flex flex-wrap gap-1.5">{coverRubric(facts).map((x) => <Badge key={x.label} tone={x.score >= 85 ? 'ok' : x.score >= 50 ? 'warn' : 'bad'}>{x.label} {x.score}</Badge>)}</div>}
            <Hint>Masthead first: a high-contrast serif like Bodoni, 150+ units, centred at the top, then switch on “Masthead behind the subject”. Cover lines go in the lower third, away from the face.</Hint>
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="primary" onClick={submit}>Submit cover</Button><Button size="sm" variant="ghost" onClick={async () => { const img = await exportComposition(c, handle.current); if (img) await save({ title: 'ATLAS — November cover', source: 'Magazine Art Director', image: img }); }}>Save to gallery</Button></div>
          </div>
        } />
    </div>
  );
}
