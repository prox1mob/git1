import { useRef, useState, type ReactNode } from 'react';
import { Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx, type ConceptItem, type Criterion } from '../../components/lesson/LessonShell';
import { Badge, Button, Eyebrow } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { useSaveToGallery } from '../../lib/gallery';
import { Composer, exportComposition, type ComposerHandle, type Composition, type CompositionFacts } from '../shared/Composer';

export interface MissionConfig {
  brief: { title: string; client: string; body: ReactNode; deliverable: string; goals: string[] };
  initial: () => Composition;
  reference: () => Composition;
  observe: { question: string; options: string[]; reveal: ReactNode };
  concepts: ConceptItem[];
  rubric: (f: CompositionFacts, c: Composition) => Criterion[];
  hint: ReactNode;
  palette?: string[];
  galleryTitle: string;
}

/** A World 05 mission: a client brief, the full composition studio, and transparent feedback against stated goals. */
export function Mission({ level, cfg }: LevelProps & { cfg: MissionConfig }) {
  return <LessonShell level={level}
    observe={
      <div className="space-y-5">
        <BriefCard cfg={cfg} />
        <div className="mx-auto max-w-md"><Composer comp={cfg.reference()} setComp={() => {}} viewOnly /></div>
        <ObserveQuestion question={cfg.observe.question} options={cfg.observe.options} reveal={() => cfg.observe.reveal} />
      </div>
    }
    experiment={<Free cfg={cfg} />}
    discover={<Concepts items={cfg.concepts} />}
    challenge={(ctx) => <Studio cfg={cfg} ctx={ctx} />} />;
}

function BriefCard({ cfg }: { cfg: MissionConfig }) {
  return (
    <div className="grid gap-5 rounded-2xl bg-ink-850 p-6 ring-1 ring-ink-750 md:grid-cols-[1.4fr_1fr]">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-signal">Creative brief · {cfg.brief.client}</p>
        <h2 className="mt-1 font-display text-[30px] leading-tight text-ink-50">{cfg.brief.title}</h2>
        <div className="mt-2 text-[14px] leading-relaxed text-ink-300">{cfg.brief.body}</div>
        <p className="mt-3 text-[13px] text-ink-400"><b className="text-ink-200">Deliverable:</b> {cfg.brief.deliverable}</p>
      </div>
      <div>
        <Eyebrow className="mb-2">Success looks like</Eyebrow>
        <ul className="space-y-1.5 text-[13.5px] text-ink-200">{cfg.brief.goals.map((g) => <li key={g}>— {g}</li>)}</ul>
      </div>
    </div>
  );
}

function Free({ cfg }: { cfg: MissionConfig }) {
  const [c, setC] = useState(cfg.reference);
  return <div className="space-y-4"><p className="text-[13.5px] text-ink-300">A finished reference layout from the studio. Take it apart: change the grade, the type and the placement to see what each decision contributes.</p><Composer comp={c} setComp={setC} palette={cfg.palette} /></div>;
}

function Studio({ cfg, ctx }: { cfg: MissionConfig; ctx: ChallengeCtx }) {
  const [c, setC] = useState(cfg.initial);
  const [facts, setFacts] = useState<CompositionFacts | null>(null);
  const handle = useRef<ComposerHandle | null>(null);
  const save = useSaveToGallery();
  const live = facts ? cfg.rubric(facts, c) : [];
  const submit = () => {
    if (!facts) return;
    const criteria = cfg.rubric(facts, c);
    ctx.submit({ score: weighted(criteria), criteria, subjective: true,
      worked: criteria.filter((x) => x.score >= 90).map((x) => `${x.label}: ${x.detail}`),
      improve: criteria.filter((x) => x.score < 75).map((x) => `${x.label}: ${x.detail}`),
      why: `This brief asked for: ${cfg.brief.goals.join('; ')}. Each goal is checked separately — measured where it can be (contrast, overlap, alignment, colour relationships), judged by a stated rule of thumb where it can’t. A creative director would also ask whether it is memorable; that part is yours.` });
  };
  return (
    <div className="space-y-4">
      <BriefCard cfg={cfg} />
      <Composer comp={c} setComp={setC} onFacts={setFacts} handleRef={handle} palette={cfg.palette}
        sidebarTop={
          <div className="space-y-3 rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
            {ctx.difficulty !== 'advanced' && <div className="flex flex-wrap gap-1.5">{live.map((x) => <Badge key={x.label} tone={x.score >= 85 ? 'ok' : x.score >= 50 ? 'warn' : 'bad'}>{x.label} {x.score}</Badge>)}</div>}
            <Hint>{cfg.hint}</Hint>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={submit}>Present to the client</Button>
              <Button size="sm" variant="ghost" onClick={async () => { const img = await exportComposition(c, handle.current); if (img) await save({ title: cfg.galleryTitle, source: 'Creative Director Studio', image: img, score: ctx.attempts.at(-1)?.score }); }}>Save to gallery</Button>
            </div>
          </div>
        } />
    </div>
  );
}

/** Score helper: one named rule, measured value, target window. */
export const rule = (label: string, score: number, detail: string, weight = 1): Criterion => ({ label, score: Math.round(Math.max(0, Math.min(100, score))), weight, detail });
