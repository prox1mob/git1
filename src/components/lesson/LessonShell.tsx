import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { LEVELS, worldById, type LevelDef } from '../../game/content';
import { href, navigate } from '../../lib/router';
import { useProgress, type Difficulty, type RecordOutcome, type ResultMeta } from '../../state/progress';
import { Badge, Button, cx } from '../ui';
import { ScoreCard } from './ScoreCard';

export interface Criterion {
  label: string;
  /** 0–100 */
  score: number;
  weight: number;
  /** What was measured, in plain words, e.g. "ΔE2000 = 1.8". */
  detail?: string;
}

export interface ChallengeResult {
  score: number;
  criteria: Criterion[];
  worked: string[];
  improve: string[];
  why?: string;
  /** Subjective rubrics are flagged so we never pretend taste is perfectly measurable. */
  subjective?: boolean;
  meta?: ResultMeta;
  visual?: ReactNode;
  headline?: string;
}

export interface ChallengeCtx {
  submit: (r: ChallengeResult) => void;
  attempts: ChallengeResult[];
  refining: boolean;
  difficulty: Difficulty;
  active: boolean;
}

export const STEPS = ['observe', 'experiment', 'discover', 'challenge', 'feedback', 'refine'] as const;
export type Step = (typeof STEPS)[number];
const STEP_LABEL: Record<Step, string> = { observe: 'Observe', experiment: 'Experiment', discover: 'Discover', challenge: 'Challenge', feedback: 'Feedback', refine: 'Refine' };
const STEP_HINT: Record<Step, string> = {
  observe: 'Look first. What do you notice?',
  experiment: 'Play freely — nothing here is scored.',
  discover: 'The principle behind what you just saw.',
  challenge: 'Solve it on your own. Hints are optional.',
  feedback: 'What worked, what to improve, and why.',
  refine: 'Revise your work and compare the results.',
};

/** Combine weighted criteria into a 0–100 score. */
export function weighted(criteria: Criterion[]): number {
  const w = criteria.reduce((a, c) => a + c.weight, 0) || 1;
  return Math.round(criteria.reduce((a, c) => a + c.score * c.weight, 0) / w);
}

export function LessonShell({
  level, observe, experiment, discover, challenge, wide = true,
}: {
  level: LevelDef;
  observe: ReactNode;
  experiment: ReactNode;
  discover: ReactNode;
  challenge: (ctx: ChallengeCtx) => ReactNode;
  wide?: boolean;
}) {
  const { state, recordResult, setLastLevel } = useProgress();
  const [step, setStep] = useState<Step>('observe');
  const [visited, setVisited] = useState<Set<Step>>(() => new Set(['observe']));
  const [attempts, setAttempts] = useState<ChallengeResult[]>([]);
  const [outcome, setOutcome] = useState<RecordOutcome | null>(null);
  const world = worldById(level.world)!;

  useEffect(() => setLastLevel(level.id), [level.id, setLastLevel]);

  const go = (s: Step) => {
    setStep(s);
    setVisited((v) => new Set(v).add(s));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = (r: ChallengeResult) => {
    const res = { ...r, score: Math.max(0, Math.min(100, Math.round(r.score))) };
    setAttempts((a) => [...a, res]);
    setOutcome(recordResult(level.id, res.score, res.meta));
    go('feedback');
  };

  const next = useMemo(() => {
    const ls = LEVELS.filter((l) => l.status === 'ready');
    const i = ls.findIndex((l) => l.id === level.id);
    return ls[i + 1];
  }, [level.id]);

  const idx = STEPS.indexOf(step);
  const canGo = (s: Step) => (s === 'feedback' || s === 'refine' ? attempts.length > 0 : true);
  const challengeVisible = step === 'challenge' || step === 'refine';
  const ctx: ChallengeCtx = { submit, attempts, refining: step === 'refine' || attempts.length > 0, difficulty: state.settings.difficulty, active: challengeVisible };
  const record = state.levels[level.id];

  return (
    <div className={cx('mx-auto px-4 pb-28 sm:px-6', wide ? 'max-w-[1440px]' : 'max-w-5xl')}>
      <header className="pt-5 pb-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-400">
          <a href={href(`world/${world.id}`)} className="hover:text-ink-100">← World {world.number} · {world.title}</a>
          <span aria-hidden>·</span>
          <span>Level {level.n}</span>
          {record?.completed && <Badge tone="outline">Best {record.best}</Badge>}
          <Badge tone="outline" className="capitalize">{state.settings.difficulty}</Badge>
        </div>
        <h1 className="mt-1 font-display text-[34px] leading-[1.05] tracking-[-0.01em] text-ink-50 sm:text-[44px]">{level.title}</h1>
        <nav aria-label="Lesson steps" className="mt-4 -mx-1 flex gap-1 overflow-x-auto pb-1 vl-scroll">
          {STEPS.map((s, i) => {
            const enabled = canGo(s);
            const active = s === step;
            const done = visited.has(s) && !active;
            return (
              <button
                key={s}
                disabled={!enabled}
                onClick={() => go(s)}
                aria-current={active ? 'step' : undefined}
                className={cx(
                  'flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] transition-colors',
                  active ? 'bg-ink-100 text-ink-950' : enabled ? 'text-ink-300 hover:bg-ink-800 hover:text-ink-50' : 'text-ink-600',
                )}
              >
                <span className={cx('grid h-5 w-5 place-items-center rounded-full text-[10.5px] font-semibold', active ? 'bg-ink-950 text-ink-50' : done ? 'bg-ink-600 text-ink-100' : 'ring-1 ring-current')}>{i + 1}</span>
                {STEP_LABEL[s]}
              </button>
            );
          })}
        </nav>
        <p className="mt-2 text-[13px] text-ink-400">{STEP_HINT[step]}</p>
      </header>

      <main>
        {visited.has('observe') && <div hidden={step !== 'observe'} className="vl-fade">{observe}</div>}
        {visited.has('experiment') && <div hidden={step !== 'experiment'} className="vl-fade">{experiment}</div>}
        {visited.has('discover') && <div hidden={step !== 'discover'} className="vl-fade">{discover}</div>}
        {(visited.has('challenge') || visited.has('refine')) && (
          <div hidden={!challengeVisible} className="vl-fade">
            {step === 'refine' && attempts.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-ink-850 px-4 py-3 ring-1 ring-ink-700">
                <span className="text-[13px] text-ink-200">Refining. Previous score <b className="num text-ink-50">{attempts[attempts.length - 1].score}</b>. Your earlier work is kept — revise it, then resubmit to compare.</span>
              </div>
            )}
            {challenge(ctx)}
          </div>
        )}
        {step === 'feedback' && attempts.length > 0 && (
          <div className="vl-fade">
            <ScoreCard result={attempts[attempts.length - 1]} previous={attempts[attempts.length - 2]} history={attempts.map((a) => a.score)} outcome={outcome} />
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="primary" onClick={() => go('refine')}>Refine this work</Button>
              {next && <Button onClick={() => navigate(`play/${next.id}`)}>Next lesson: {next.title} →</Button>}
              <Button variant="ghost" onClick={() => navigate(`world/${world.id}`)}>Back to World {world.number}</Button>
            </div>
          </div>
        )}
      </main>

      <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-ink-900 via-ink-900/95 to-transparent pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className={cx('pointer-events-auto mx-auto flex items-center justify-between gap-3 px-4 sm:px-6', wide ? 'max-w-[1440px]' : 'max-w-5xl')}>
          <Button variant="ghost" disabled={idx === 0} onClick={() => go(STEPS[idx - 1])}>← {idx > 0 ? STEP_LABEL[STEPS[idx - 1]] : 'Back'}</Button>
          {step === 'challenge' || step === 'refine' ? (
            <span className="text-[12px] text-ink-400">Submit inside the challenge when you are ready.</span>
          ) : step === 'feedback' ? (
            <Button variant="primary" onClick={() => go('refine')}>Refine →</Button>
          ) : (
            <Button variant="primary" onClick={() => go(STEPS[idx + 1])}>{STEP_LABEL[STEPS[idx + 1]]} →</Button>
          )}
        </div>
      </footer>
    </div>
  );
}

/** "Ask me what I notice": any answer is valid; the reveal explains what most viewers see. */
export function ObserveQuestion({ question, options, reveal, className }: { question: ReactNode; options: string[]; reveal: (choice: number) => ReactNode; className?: string }) {
  const [choice, setChoice] = useState<number | null>(null);
  return (
    <div className={cx('rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750', className)}>
      <p className="font-display text-[22px] leading-snug text-ink-50">{question}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((o, i) => (
          <button
            key={o}
            onClick={() => setChoice(i)}
            className={cx('min-h-11 rounded-full px-4 py-2 text-left text-[13.5px] ring-1 transition-colors', choice === i ? 'bg-ink-100 text-ink-950 ring-ink-100' : 'text-ink-200 ring-ink-600 hover:ring-ink-300')}
          >
            {o}
          </button>
        ))}
      </div>
      {choice !== null && <div className="vl-rise mt-4 border-t border-ink-700 pt-4 text-[14px] leading-relaxed text-ink-200">{reveal(choice)}</div>}
    </div>
  );
}

export interface ConceptItem { title: string; body: ReactNode; visual?: ReactNode }
/** Discover step: short concept cards (aim for under 60 words each). */
export function Concepts({ items, footer }: { items: ConceptItem[]; footer?: ReactNode }) {
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((c, i) => (
          <article key={c.title} className="vl-rise flex flex-col overflow-hidden rounded-2xl bg-ink-850 ring-1 ring-ink-750" style={{ animationDelay: `${i * 60}ms` }}>
            {c.visual && <div className="border-b border-ink-750 bg-ink-800">{c.visual}</div>}
            <div className="p-5">
              <p className="font-mono text-[11px] text-ink-500">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="mt-1 font-display text-[24px] leading-tight text-ink-50">{c.title}</h3>
              <div className="mt-2 text-[14px] leading-relaxed text-ink-300">{c.body}</div>
            </div>
          </article>
        ))}
      </div>
      {footer && <div className="mt-6">{footer}</div>}
    </div>
  );
}

export function Hint({ children, label = 'Show a hint' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const { state } = useProgress();
  if (!state.settings.showHints) return null;
  return (
    <div className="text-[13px]">
      {open ? (
        <div className="vl-fade rounded-xl bg-ink-800 px-3.5 py-2.5 leading-relaxed text-ink-200 ring-1 ring-ink-700">
          <span className="mr-1 font-semibold text-ink-50">Hint.</span>
          {children}
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="text-ink-400 underline-offset-4 hover:text-ink-100 hover:underline">{label} — no penalty</button>
      )}
    </div>
  );
}

export function ChallengeBrief({ title, children, aside }: { title: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-ink-850 px-5 py-4 ring-1 ring-ink-750">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-signal">The brief</p>
        <h2 className="mt-1 font-display text-[24px] leading-tight text-ink-50">{title}</h2>
        <div className="mt-1.5 text-[14px] leading-relaxed text-ink-300">{children}</div>
      </div>
      {aside}
    </div>
  );
}
