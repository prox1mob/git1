import type { RecordOutcome } from '../../state/progress';
import { achievementById } from '../../state/progress';
import { Badge, Meter, cx } from '../ui';
import type { ChallengeResult } from './LessonShell';

function verdict(score: number) {
  if (score >= 95) return 'Exceptional';
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 50) return 'Getting there';
  return 'A useful first draft';
}

export function ScoreCard({ result, previous, history, outcome }: { result: ChallengeResult; previous?: ChallengeResult; history: number[]; outcome: RecordOutcome | null }) {
  const delta = previous ? result.score - previous.score : null;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
      <div className="vl-rise rounded-2xl bg-ink-850 p-6 ring-1 ring-ink-750">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">Score</p>
        <div className="mt-1 flex items-end gap-3">
          <span className="num font-display text-[96px] leading-[0.85] text-ink-50">{result.score}</span>
          <span className="mb-2 text-ink-400">/ 100</span>
        </div>
        <p className="mt-2 text-[15px] text-ink-100">{result.headline ?? verdict(result.score)}</p>
        {delta !== null && (
          <p className={cx('mt-1 text-[13px]', delta > 0 ? 'text-ok' : delta < 0 ? 'text-warn' : 'text-ink-400')}>
            {delta > 0 ? `+${delta} since your last attempt` : delta < 0 ? `${delta} since your last attempt — experimenting is how you learn` : 'Same as your last attempt'}
          </p>
        )}
        {history.length > 1 && (
          <div className="mt-4">
            <p className="mb-1 text-[11px] text-ink-500">Attempts</p>
            <div className="flex h-12 items-end gap-1">
              {history.map((h, i) => (
                <div key={i} className={cx('w-4 rounded-sm', i === history.length - 1 ? 'bg-ink-100' : 'bg-ink-600')} style={{ height: `${Math.max(6, h)}%` }} title={`Attempt ${i + 1}: ${h}`} />
              ))}
            </div>
          </div>
        )}
        {outcome && (
          <div className="mt-5 space-y-2 border-t border-ink-700 pt-4 text-[13px]">
            <p className="text-ink-200"><span className="num font-semibold text-signal">+{outcome.xpGained} XP</span>{outcome.newBest && outcome.previousBest > 0 ? ' · new personal best' : ''}</p>
            {outcome.rankUp && <p className="text-ink-50">Promoted to <b>{outcome.rankUp}</b>.</p>}
            {outcome.newAchievements.map((id) => {
              const a = achievementById(id);
              return a ? <p key={id} className="text-ink-200"><Badge tone="signal">{a.glyph}</Badge> {a.title}</p> : null;
            })}
          </div>
        )}
        {result.subjective && (
          <p className="mt-4 rounded-xl bg-ink-800 px-3 py-2 text-[12px] leading-relaxed text-ink-300">
            Part of this score uses a transparent rubric, not a ruler. Taste can’t be measured perfectly — treat the numbers as a conversation with an art director, not a verdict.
          </p>
        )}
      </div>

      <div className="space-y-5">
        {result.visual && <div className="vl-rise rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">{result.visual}</div>}
        <div className="vl-rise rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">How it was measured</p>
          <ul className="mt-3 space-y-3.5">
            {result.criteria.map((c) => {
              const prev = previous?.criteria.find((p) => p.label === c.label);
              const d = prev ? Math.round(c.score - prev.score) : 0;
              return (
                <li key={c.label}>
                  <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                    <span className="text-ink-100">{c.label} <span className="text-[11px] text-ink-500">×{c.weight}</span></span>
                    <span className="num font-mono text-[12px] text-ink-300">
                      {Math.round(c.score)}
                      {prev && d !== 0 && <span className={cx('ml-1.5', d > 0 ? 'text-ok' : 'text-warn')}>{d > 0 ? `+${d}` : d}</span>}
                    </span>
                  </div>
                  <Meter value={c.score} className="mt-1.5" />
                  {c.detail && <p className="mt-1 text-[12px] text-ink-400">{c.detail}</p>}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="vl-rise rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ok">What worked</p>
            <ul className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-ink-200">
              {(result.worked.length ? result.worked : ['You submitted a complete attempt — that is the first step.']).map((w) => <li key={w}>— {w}</li>)}
            </ul>
          </div>
          <div className="vl-rise rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-warn">What to improve</p>
            <ul className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-ink-200">
              {(result.improve.length ? result.improve : ['Nothing essential. Try a harder difficulty or a bolder idea.']).map((w) => <li key={w}>— {w}</li>)}
            </ul>
          </div>
        </div>
        {result.why && (
          <div className="vl-rise rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">Why it matters</p>
            <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-200">{result.why}</p>
          </div>
        )}
      </div>
    </div>
  );
}
