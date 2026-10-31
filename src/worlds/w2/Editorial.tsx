import { useRef, useState } from 'react';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Badge, Button, Segmented } from '../../components/ui';
import { defaultParams } from '../../engine/params';
import type { LevelProps } from '../../game/registry';
import { useSaveToGallery } from '../../lib/gallery';
import { alignment, breathing, collisions, hierarchy, legibility, margins, readingOrder, subjectRespect } from '../shared/compRubrics';
import { Composer, exportComposition, type ComposerHandle, type Composition, type CompositionFacts, type TextLayer } from '../shared/Composer';

const PHOTO = { kind: 'scene' as const, scene: 'portrait' as const, variant: 4, params: [0, 2, 1, 0] as [number, number, number, number] };
const GRID = { cols: 12, margin: 36, gutter: 12 };
type Layout = 'top' | 'left' | 'full';
const RECTS: Record<Layout, [number, number, number, number]> = { top: [0, 0, 600, 400], left: [0, 0, 330, 750], full: [0, 0, 600, 750] };

const L = (id: string, role: TextLayer['role'], label: string, text: string, font: string, size: number, weight: number, x: number, y: number, w: number, extra: Partial<TextLayer> = {}): TextLayer =>
  ({ id, role, label, text, font, size, weight, color: '#151515', x, y, w, align: 'left', caps: false, tracking: 0, leading: 1.25, ...extra });

export const editorialLayers = (messy: boolean): TextLayer[] => messy ? [
  L('kicker', 'kicker', 'Kicker', 'Fashion · Autumn', 'inter', 10, 600, 250, 120, 160, { caps: true, tracking: 160, color: '#b8432f' }),
  L('headline', 'headline', 'Headline', 'The New Romantics', 'playfair', 44, 700, 120, 150, 330, { leading: 1 }),
  L('standfirst', 'standfirst', 'Standfirst', 'Crimson tailoring, soft light and a return to quiet glamour.', 'sourceserif', 15, 400, 20, 470, 260, { leading: 1.35 }),
  L('body', 'body', 'Body', 'This season the most interesting clothes whisper. Deep reds are cut close to the body, lit softly, and photographed with patience rather than flash. The result feels less like a campaign and more like a portrait — of a person, not a product.', 'sourceserif', 10.5, 400, 330, 560, 250, { leading: 1.5 }),
  L('caption', 'caption', 'Caption', 'Look 04: wool crêpe jacket, silk shell.', 'inter', 9, 400, 400, 330, 180, { color: '#151515' }),
] : [
  L('kicker', 'kicker', 'Kicker', 'Fashion · Autumn', 'inter', 10, 600, 36, 428, 200, { caps: true, tracking: 160, color: '#b8432f' }),
  L('headline', 'headline', 'Headline', 'The New Romantics', 'playfair', 52, 700, 36, 450, 400, { leading: 1 }),
  L('standfirst', 'standfirst', 'Standfirst', 'Crimson tailoring, soft light and a return to quiet glamour.', 'sourceserif', 16, 400, 36, 512, 300, { leading: 1.35 }),
  L('body', 'body', 'Body', 'This season the most interesting clothes whisper. Deep reds are cut close to the body, lit softly, and photographed with patience rather than flash. The result feels less like a campaign and more like a portrait — of a person, not a product.', 'sourceserif', 10.5, 400, 36, 580, 300, { leading: 1.5 }),
  L('caption', 'caption', 'Caption', 'Look 04: wool crêpe jacket, silk shell.', 'inter', 9, 400, 384, 580, 180),
];

export function editorialRubric(f: CompositionFacts) {
  return [legibility(f), subjectRespect(f), margins(f), alignment(f), collisions(f), hierarchy(f, 'headline', ['standfirst', 'body', 'caption'], 2), readingOrder(f, ['headline', 'standfirst', 'body']), breathing(f)];
}

export default function Editorial({ level }: LevelProps) {
  return <LessonShell level={level}
    observe={<Observe />}
    experiment={<Workspace messy={false} />}
    discover={
      <Concepts items={[
        { title: 'The grid', body: 'Columns and margins give every element a place to align to. A 12-column grid can be divided into 2, 3, 4 or 6 — flexible, yet consistent.' },
        { title: 'Margins', body: 'The frame of empty space around the live area. Generous margins signal confidence and luxury; cramped ones feel cheap and nervous.' },
        { title: 'Alignment', body: 'Elements that share an edge feel related. Fewer, stronger alignment lines make a layout calm and readable.' },
        { title: 'Image and type', body: 'Text should never fight the subject: keep it off faces and busy detail, or give it enough contrast to sit on top with intent.' },
        { title: 'Negative space', body: 'Empty space is not wasted space. It gives the photograph room and tells the reader where to look.' },
      ]} />
    }
    challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

function Observe() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Workspace messy compact />
        <Workspace messy={false} compact />
      </div>
      <ObserveQuestion question="The same words and photograph. What makes the right page feel professionally designed?" options={['A shared left edge', 'Nothing covers the face', 'Clear size steps', 'All of these']}
        reveal={() => <p>All of these. On the right, every block hangs from the same left margin, the photograph keeps its subject clear, the headline is decisively larger than everything else, and there is breathing room. The left uses identical ingredients scattered without a system.</p>} />
    </div>
  );
}

function Workspace({ messy, compact }: { messy: boolean; compact?: boolean }) {
  const [layout, setLayout] = useState<Layout>('top');
  const [comp, setComp] = useState<Composition>(() => ({ width: 600, height: 750, bg: '#F4F2ED', grid: GRID, image: { source: PHOTO, rect: RECTS.top, params: defaultParams() }, layers: editorialLayers(messy) }));
  if (compact) return <Composer comp={comp} setComp={() => {}} viewOnly />;
  return (
    <div className="space-y-3">
      <Segmented value={layout} onChange={(l) => { setLayout(l); setComp({ ...comp, image: { ...comp.image!, rect: RECTS[l] } }); }} options={[{ value: 'top', label: 'Image on top' }, { value: 'left', label: 'Image left' }, { value: 'full', label: 'Full bleed' }]} />
      <Composer comp={comp} setComp={setComp} />
    </div>
  );
}

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const [layout, setLayout] = useState<Layout>('left');
  const [comp, setComp] = useState<Composition>(() => ({ width: 600, height: 750, bg: '#F4F2ED', grid: GRID, image: { source: PHOTO, rect: RECTS.left, params: defaultParams() }, layers: editorialLayers(true) }));
  const [facts, setFacts] = useState<CompositionFacts | null>(null);
  const handle = useRef<ComposerHandle | null>(null);
  const save = useSaveToGallery();
  const submit = () => {
    if (!facts) return;
    const criteria = editorialRubric(facts);
    ctx.submit({ score: weighted(criteria), criteria, subjective: true,
      worked: criteria.filter((c) => c.score >= 90).map((c) => `${c.label}: ${c.detail}`),
      improve: criteria.filter((c) => c.score < 75).map((c) => `${c.label}: ${c.detail}`),
      why: 'Editorial layouts are judged in a glance: is there an order, does the photograph breathe, can I read it? Grid, margins and alignment are the invisible tools that make the answer yes. The checks here are measured from your layout; the overall taste remains yours.' });
  };
  return (
    <div>
      <ChallengeBrief title="Lay out the fashion feature" aside={<Segmented size="sm" value={layout} onChange={(l) => { setLayout(l); setComp({ ...comp, image: { ...comp.image!, rect: RECTS[l] } }); }} options={[{ value: 'top', label: 'Top' }, { value: 'left', label: 'Left' }, { value: 'full', label: 'Full bleed' }]} />}>
        Arrange the headline, kicker, standfirst, body and caption around the photograph. Keep text off the model, inside the margins and aligned to the grid; give the headline authority; leave room to breathe.
      </ChallengeBrief>
      <Composer comp={comp} setComp={setComp} onFacts={setFacts} handleRef={handle} lockedText
        sidebarTop={
          <div className="space-y-3 rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
            {ctx.difficulty === 'beginner' && facts && <div className="flex flex-wrap gap-1.5">{editorialRubric(facts).map((c) => <Badge key={c.label} tone={c.score >= 85 ? 'ok' : c.score >= 50 ? 'warn' : 'bad'}>{c.label} {c.score}</Badge>)}</div>}
            <Hint>Pick one left edge (the margin, or the first column next to the image) and hang everything from it. Headline first, then standfirst directly below, then body.</Hint>
            <div className="flex flex-wrap gap-2"><Button variant="primary" size="sm" onClick={submit}>Submit layout</Button><Button size="sm" variant="ghost" onClick={async () => { const img = await exportComposition(comp, handle.current); if (img) await save({ title: 'The New Romantics — editorial', source: 'Editorial Composition', image: img }); }}>Save to gallery</Button></div>
          </div>
        } />
    </div>
  );
}
