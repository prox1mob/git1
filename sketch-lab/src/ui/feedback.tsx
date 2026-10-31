import { useState, type ReactNode } from 'react';
import { completeChallenge, recordAttempt, useAppState } from '../core/store';
import { DifficultyPicker } from './kit';

/**
 * Beginner-friendly feedback, always in this order:
 * show the mistake → explain why → one small hint → retry → solution only on request.
 */
function MistakeBox({
  happened, why, hint, solution, onRetry, hintShown, setHintShown, solutionShown, setSolutionShown,
}: {
  happened: ReactNode; why?: ReactNode; hint?: ReactNode; solution?: ReactNode; onRetry: () => void;
  hintShown: boolean; setHintShown: (b: boolean) => void; solutionShown: boolean; setSolutionShown: (b: boolean) => void;
}) {
  return (
    <div className="mistake" role="status">
      <div className="mistake-row">
        <span className="mistake-tag">🔍 What happened</span>
        <div>{happened}</div>
      </div>
      {why && (
        <div className="mistake-row">
          <span className="mistake-tag">🧠 Why</span>
          <div>{why}</div>
        </div>
      )}
      {hint && hintShown && (
        <div className="mistake-row hint">
          <span className="mistake-tag">💡 Hint</span>
          <div>{hint}</div>
        </div>
      )}
      {solution && solutionShown && (
        <div className="mistake-row solution">
          <span className="mistake-tag">🧾 Solution</span>
          <div>{solution}</div>
        </div>
      )}
      <div className="mistake-actions">
        <button className="btn primary" onClick={onRetry}>↻ Try again</button>
        {hint && !hintShown && <button className="btn" onClick={() => setHintShown(true)}>💡 One small hint</button>}
        {solution && !solutionShown && (
          <button className="btn ghost" onClick={() => setSolutionShown(true)}>Show me the solution</button>
        )}
      </div>
    </div>
  );
}

export interface ChoiceOption {
  label: ReactNode;
  correct?: boolean;
  /** For a wrong option: why someone might pick it and why it does not work. For the right one: the explanation. */
  why?: ReactNode;
}

export function ChoiceQuiz({ question, options, hint, solution, onPick }: {
  question: ReactNode; options: ChoiceOption[]; hint?: ReactNode; solution?: ReactNode;
  onPick?: (index: number, correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [solutionShown, setSolutionShown] = useState(false);
  const choose = (i: number) => {
    if (solved) return;
    setPicked(i);
    const ok = !!options[i].correct;
    if (ok) setSolved(true);
    onPick?.(i, ok);
  };
  const p = picked !== null ? options[picked] : null;
  return (
    <div className="quiz">
      <div className="quiz-q">{question}</div>
      <div className="quiz-options">
        {options.map((o, i) => (
          <button
            key={i}
            className={`quiz-opt${picked === i ? (o.correct ? ' right' : ' wrong') : ''}${solved && o.correct ? ' right' : ''}`}
            onClick={() => choose(i)}
            disabled={solved && picked !== i && !o.correct}
          >
            {o.label}
          </button>
        ))}
      </div>
      {p && p.correct && <div className="praise">✅ Yes! {p.why}</div>}
      {p && !p.correct && (
        <MistakeBox
          happened={<>You chose <b>{p.label}</b>.</>}
          why={p.why}
          hint={hint}
          solution={solution}
          onRetry={() => setPicked(null)}
          hintShown={hintShown}
          setHintShown={setHintShown}
          solutionShown={solutionShown}
          setSolutionShown={setSolutionShown}
        />
      )}
    </div>
  );
}

/** Type a number. diagnose() can recognise common mistakes (e.g. "that's the perimeter, not the area"). */
export function NumberQuiz({ question, answer, tolerance = 0.01, unit, hint, solution, diagnose }: {
  question: ReactNode; answer: number; tolerance?: number; unit?: string; hint?: ReactNode; solution?: ReactNode;
  diagnose?: (v: number) => ReactNode | null | undefined;
}) {
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'right' | 'wrong'>('idle');
  const [hintShown, setHintShown] = useState(false);
  const [solutionShown, setSolutionShown] = useState(false);
  const val = Number(text.replace(',', '.').replace('−', '-'));
  const check = () => {
    if (text.trim() === '' || Number.isNaN(val)) return;
    setState(Math.abs(val - answer) <= tolerance ? 'right' : 'wrong');
  };
  const diag = state === 'wrong' ? diagnose?.(val) : null;
  return (
    <div className="quiz">
      <div className="quiz-q">{question}</div>
      <div className="quiz-input">
        <input
          inputMode="decimal"
          value={text}
          placeholder="your answer"
          onChange={(e) => {
            setText(e.target.value);
            if (state !== 'idle') setState('idle');
          }}
          onKeyDown={(e) => e.key === 'Enter' && check()}
        />
        {unit && <span className="unit">{unit}</span>}
        <button className="btn primary" onClick={check}>Check</button>
      </div>
      {state === 'right' && <div className="praise">✅ Correct — {text} {unit}.</div>}
      {state === 'wrong' && (
        <MistakeBox
          happened={<>You entered <b>{text}{unit ? ` ${unit}` : ''}</b>. {val > answer ? 'That is too big.' : 'That is too small.'}</>}
          why={diag ?? undefined}
          hint={hint}
          solution={solution}
          onRetry={() => setState('idle')}
          hintShown={hintShown}
          setHintShown={setHintShown}
          solutionShown={solutionShown}
          setSolutionShown={setSolutionShown}
        />
      )}
    </div>
  );
}

export interface CheckResult {
  ok: boolean;
  /** What the learner can see went wrong (the tool should also highlight it). */
  happened?: ReactNode;
  why?: ReactNode;
}

/**
 * A design challenge. check() inspects the live tool state.
 * Stars: ★★★ first time without help, ★★ with a hint or a few tries, ★ after seeing the solution.
 */
export function Challenge({ id, title, brief, check, hint, solution, onResult, onNewTarget, children }: {
  id: string; title: ReactNode; brief: ReactNode; check: () => CheckResult; hint?: ReactNode; solution?: ReactNode;
  onResult?: (r: CheckResult | null) => void; onNewTarget?: () => void; children?: ReactNode;
}) {
  const rec = useAppState().challenges[id];
  const [result, setResult] = useState<CheckResult | null>(null);
  const [tries, setTries] = useState(0);
  const [hintShown, setHintShown] = useState(false);
  const [solutionShown, setSolutionShown] = useState(false);
  const [stars, setStars] = useState(0);

  const run = () => {
    const r = check();
    const n = tries + 1;
    setTries(n);
    recordAttempt(id);
    setResult(r);
    onResult?.(r);
    if (r.ok) {
      const s = solutionShown ? 1 : hintShown || n > 2 ? 2 : 3;
      setStars(s);
      completeChallenge(id, s);
    }
  };
  const retry = () => {
    setResult(null);
    onResult?.(null);
  };
  const fresh = () => {
    retry();
    setTries(0);
    setHintShown(false);
    setSolutionShown(false);
    setStars(0);
    onNewTarget?.();
  };

  return (
    <div className="challenge">
      <div className="challenge-head">
        <span className="challenge-badge">🏁 Challenge</span>
        {rec?.done && <span className="stars" title="best result">{'★'.repeat(rec.stars)}{'☆'.repeat(3 - rec.stars)}</span>}
      </div>
      <h3 className="challenge-title">{title}</h3>
      <div className="challenge-brief">{brief}</div>
      {onNewTarget && (
        <div className="challenge-diff">
          <span>Difficulty</span> <DifficultyPicker />
          <button className="btn small" onClick={fresh}>🎲 New target</button>
        </div>
      )}
      {children}
      {!result && (
        <div className="challenge-actions">
          <button className="btn primary big" onClick={run}>✔ Check my design</button>
          {hint && !hintShown && <button className="btn" onClick={() => setHintShown(true)}>💡 Hint</button>}
        </div>
      )}
      {!result && hintShown && hint && <div className="mistake-row hint standalone"><span className="mistake-tag">💡 Hint</span><div>{hint}</div></div>}
      {result?.ok && (
        <div className="success">
          <div className="success-stars">{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</div>
          <div><b>Brilliant — challenge complete!</b></div>
          {result.happened && <div>{result.happened}</div>}
          {result.why && <div className="muted">{result.why}</div>}
          <div className="mistake-actions">
            <button className="btn" onClick={retry}>Keep experimenting</button>
            {onNewTarget && <button className="btn primary" onClick={fresh}>🎲 Try a new target</button>}
          </div>
        </div>
      )}
      {result && !result.ok && (
        <MistakeBox
          happened={result.happened ?? 'Not there yet.'}
          why={result.why}
          hint={hint}
          solution={solution}
          onRetry={retry}
          hintShown={hintShown}
          setHintShown={setHintShown}
          solutionShown={solutionShown}
          setSolutionShown={setSolutionShown}
        />
      )}
    </div>
  );
}
