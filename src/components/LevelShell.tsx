import { useState, type ReactNode } from 'react';
import type { Feedback, LessonStep } from '../lib/types';
import { STAGES } from '../lib/types';
import { levelById, WORLDS } from '../worlds/meta';
import { READY } from '../worlds/ready';
import { useProgress, PASS_MARK, BADGES, TOOLS, type RecordOutcome } from '../store/progress';
import { navigate } from '../lib/router';
import { ScoreRing, T } from './ui';
import { toast } from '../store/toast';

export interface Hint {
  en: string;
  ta?: string;
}

interface Props {
  id: string;
  steps: LessonStep[];
  viewport: ReactNode;
  children?: ReactNode;
  hints?: Hint[];
  evaluate?: () => Feedback | string;
  checkLabel?: string;
  onCorrection?: (on: boolean) => void;
  onRetry?: () => void;
  /** Custom recorder, e.g. for the daily challenge. */
  recorder?: (score: number, hints: number) => RecordOutcome;
  title?: ReactNode;
  backTo?: string;
}

export function nextLevelId(id: string) {
  const l = levelById(id);
  if (!l) return null;
  const w = WORLDS[l.world - 1];
  const nxt = w.levels.slice(l.n).find((x) => READY.has(x.id));
  return nxt?.id ?? null;
}

export function LevelShell({ id, steps, viewport, children, hints = [], evaluate, checkLabel = 'Check my work', onCorrection, onRetry, recorder, title, backTo }: Props) {
  const meta = levelById(id);
  const settings = useProgress((s) => s.settings);
  const result = useProgress((s) => s.results[id]);
  const record = useProgress((s) => s.record);
  const [step, setStep] = useState(0);
  const [hintN, setHintN] = useState(0);
  const [hintsThisAttempt, setHintsThisAttempt] = useState(0);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [outcome, setOutcome] = useState<RecordOutcome | null>(null);
  const [corr, setCorr] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const cur = steps[Math.min(step, steps.length - 1)];
  const stageIdx = STAGES.indexOf(cur?.stage ?? 'OBSERVE');

  const check = () => {
    if (!evaluate) return;
    const r = evaluate();
    if (typeof r === 'string') {
      toast(r);
      return;
    }
    const o = recorder ? recorder(r.score, hintsThisAttempt) : record(id, r.score, hintsThisAttempt);
    setFb(r);
    setOutcome(o);
    setCorr(false);
    setMinimised(false);
    onCorrection?.(false);
    setHintsThisAttempt(0);
  };
  const close = () => {
    setFb(null);
    setCorr(false);
    onCorrection?.(false);
  };
  const toggleCorr = () => {
    const v = !corr;
    setCorr(v);
    onCorrection?.(v);
    if (v) setMinimised(true);
  };
  const next = nextLevelId(id);
  const back = backTo ?? (meta ? `/world/${meta.world}` : '/');

  return (
    <div className="level">
      <div className="levelhead">
        <button className="btn small" onClick={() => navigate(back)} aria-label="Back">
          ←
        </button>
        <div style={{ minWidth: 0 }}>
          <div className="muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>
            {meta ? `WORLD ${String(meta.world).padStart(2, '0')} · LEVEL ${meta.n}` : 'CHALLENGE'}
          </div>
          <h2>
            {title ?? meta?.title}
            {settings.tamil && meta && (
              <span className="muted" style={{ fontWeight: 500, fontSize: 13 }} lang="ta">
                {' '}
                · {meta.ta}
              </span>
            )}
          </h2>
        </div>
        <div style={{ flex: 1 }} />
        <div className="stages" aria-label="Learning sequence">
          {STAGES.map((s, i) => (
            <span key={s} className={`stage ${i === stageIdx ? 'on' : i < stageIdx ? 'done' : ''}`}>
              {s}
            </span>
          ))}
        </div>
        {result && (
          <span className="tag" title="Best score">
            Best {result.best}
          </span>
        )}
      </div>
      <div className="levelbody">
        <div className="viewport" style={{ display: 'flex' }}>
          {viewport}
          {fb && (
            <div className="feedback dock card" role="dialog" aria-label="Feedback">
              <FeedbackView
                fb={fb}
                outcome={outcome}
                minimised={minimised}
                onToggleMin={() => setMinimised(!minimised)}
                corr={corr}
                onCorr={fb.canShowCorrection ? toggleCorr : undefined}
                onClose={close}
                onRetry={() => {
                  close();
                  onRetry?.();
                }}
                canRestart={!!onRetry}
                onNext={next ? () => navigate(`/level/${next}`) : () => navigate(back)}
                nextLabel={next ? 'Next level →' : 'Back to world'}
                first={result?.first}
                best={result?.best}
              />
            </div>
          )}
        </div>
        <aside className="side">
          {cur && (
            <div className="stepcard">
              <div className="stepnav" style={{ marginBottom: 4 }}>
                <span className="stagelbl">
                  {cur.stage} · {step + 1}/{steps.length}
                </span>
                <span className="btnrow">
                  <button className="btn small" disabled={step === 0} onClick={() => setStep(step - 1)} aria-label="Previous step">
                    ‹
                  </button>
                  <button className="btn small" disabled={step >= steps.length - 1} onClick={() => setStep(step + 1)} aria-label="Next step">
                    ›
                  </button>
                </span>
              </div>
              <T en={cur.text} ta={cur.ta} />
            </div>
          )}
          {children}
          {settings.hints && hints.length > 0 && (
            <div>
              {hints.slice(0, hintN).map((h, i) => (
                <div key={i} className="note">
                  💡 <T en={h.en} ta={h.ta} />
                </div>
              ))}
              {hintN < hints.length && (
                <button
                  className="btn small ghost"
                  onClick={() => {
                    setHintN(hintN + 1);
                    setHintsThisAttempt((n) => n + 1);
                  }}
                >
                  💡 Show a hint ({hints.length - hintN} left)
                </button>
              )}
            </div>
          )}
          {evaluate && (
            <button className="btn primary" onClick={check} style={{ position: 'sticky', bottom: 0 }}>
              ✔ {checkLabel}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function FeedbackView({
  fb,
  outcome,
  minimised,
  onToggleMin,
  corr,
  onCorr,
  onClose,
  onRetry,
  canRestart,
  onNext,
  nextLabel,
  first,
  best,
}: {
  fb: Feedback;
  outcome: RecordOutcome | null;
  minimised: boolean;
  onToggleMin: () => void;
  corr: boolean;
  onCorr?: () => void;
  onClose: () => void;
  onRetry: () => void;
  canRestart: boolean;
  onNext: () => void;
  nextLabel: string;
  first?: number;
  best?: number;
}) {
  const passed = fb.score >= PASS_MARK;
  return (
    <div className="feedback">
      <div className="score">
        <ScoreRing score={fb.score} size={minimised ? 48 : 74} />
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0 }}>{passed ? (fb.score >= 95 ? 'Excellent work!' : 'Challenge passed!') : 'Not yet — you are close'}</h3>
          <div className="muted" style={{ fontSize: 13 }}>
            {outcome && outcome.xpGained > 0 ? `+${outcome.xpGained} XP · ` : ''}
            {first != null && best != null && `First attempt ${first} → best ${best}`}
          </div>
        </div>
        <button className="btn small" onClick={onToggleMin}>
          {minimised ? 'Expand' : 'Minimise'}
        </button>
      </div>
      {!minimised && (
        <>
          {outcome && (outcome.newBadges.length > 0 || outcome.newTools.length > 0) && (
            <div style={{ margin: '8px 0' }}>
              {outcome.newBadges.map((b) => {
                const bd = BADGES.find((x) => x.id === b);
                return (
                  <span key={b} className="badge-pop">
                    {bd?.icon} Badge: {bd?.name}
                  </span>
                );
              })}
              {outcome.newTools.map((t) => (
                <span key={t} className="badge-pop">
                  🔓 Unlocked: {TOOLS.find((x) => x.id === t)?.name}
                </span>
              ))}
            </div>
          )}
          {fb.rubric && (
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', margin: '8px 0' }}>
              <thead>
                <tr className="muted">
                  <th style={{ textAlign: 'left' }}>Rubric criterion</th>
                  <th style={{ textAlign: 'right' }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {fb.rubric.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '4px 0' }}>
                      {r.criterion}
                      {r.note && <div className="muted" style={{ fontSize: 12 }}>{r.note}</div>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {Math.round(r.points)}/{r.max}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {fb.correct.length > 0 && (
            <>
              <h4 style={{ marginTop: 10 }}>What you built correctly</h4>
              <ul className="fb-list good">
                {fb.correct.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </>
          )}
          {fb.issues.length > 0 && (
            <>
              <h4>What needs fixing</h4>
              <ul className="fb-list bad">
                {fb.issues.map((c, i) => (
                  <li key={i}>
                    {c.label}
                    {c.detail && <small className="muted">{c.detail}</small>}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h4>Why it matters</h4>
          <p style={{ fontSize: 14 }}>{fb.why}</p>
          <h4>One improvement to try</h4>
          <p style={{ fontSize: 14 }}>👉 {fb.suggestion}</p>
        </>
      )}
      <div className="btnrow" style={{ marginTop: 8 }}>
        {onCorr && (
          <button className={`btn small ${corr ? 'on' : ''}`} onClick={onCorr}>
            {corr ? 'Hide correction' : '👁 Show correction'}
          </button>
        )}
        <button className="btn small" onClick={onClose}>
          Keep improving
        </button>
        {canRestart && (
          <button className="btn small" onClick={onRetry}>
            ↺ Start over
          </button>
        )}
        {passed && (
          <button className="btn small primary" onClick={onNext}>
            {nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}
