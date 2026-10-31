import { useEffect, useState, type ReactNode } from 'react';
import { markStage, useAppState } from '../core/store';

export const STAGES = [
  { key: 'see', label: 'See', icon: '👁', tip: 'Just look. Notice what is there.' },
  { key: 'touch', label: 'Touch', icon: '✋', tip: 'Grab something and move it.' },
  { key: 'experiment', label: 'Experiment', icon: '🧪', tip: 'Try a few things on purpose.' },
  { key: 'discover', label: 'Discover', icon: '💡', tip: 'What pattern did you notice?' },
  { key: 'understand', label: 'Understand', icon: '🧠', tip: 'Why does it work?' },
  { key: 'calculate', label: 'Calculate', icon: '🔢', tip: 'Now the symbols — each one explained.' },
  { key: 'apply', label: 'Apply', icon: '✏️', tip: 'Use it in a sketch or product.' },
] as const;

export type StageKey = (typeof STAGES)[number]['key'];
export const stageIndex = (k: StageKey) => STAGES.findIndex((s) => s.key === k);

interface LessonProps {
  id: string;
  title: ReactNode;
  /** The interactive tool. Always on screen. */
  tool: ReactNode;
  /** Sliders / buttons shown under the tool. */
  controls?: ReactNode;
  /** Guide text for each of the 7 stages. */
  stages: Record<StageKey, ReactNode>;
  /** Live numerical explanation of what the tool currently shows. */
  numbers: ReactNode;
  /** Optional controlled stage (lets a tool react to the current stage). */
  stage?: StageKey;
  onStage?: (s: StageKey) => void;
}

/**
 * Every lesson follows SEE → TOUCH → EXPERIMENT → DISCOVER → UNDERSTAND → CALCULATE → APPLY.
 * The tool stays visible the whole time; the side panel can switch between the
 * visual guide and a numbers view at any moment.
 */
export function Lesson({ id, title, tool, controls, stages, numbers, stage, onStage }: LessonProps) {
  const [own, setOwn] = useState<StageKey>('see');
  const current = stage ?? own;
  const setStage = (s: StageKey) => {
    setOwn(s);
    onStage?.(s);
  };
  const [tab, setTab] = useState<'guide' | 'numbers'>('guide');
  const idx = stageIndex(current);
  const seen = useAppState().stages[id] ?? [];

  useEffect(() => {
    markStage(id, idx);
  }, [id, idx]);

  return (
    <div className="lesson">
      <div className="lesson-stage">
        <h2 className="lesson-title">{title}</h2>
        <div className="tool-frame">{tool}</div>
        {controls && <div className="tool-controls">{controls}</div>}
      </div>
      <aside className="lesson-panel">
        <div className="panel-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'guide'} className={tab === 'guide' ? 'active' : ''} onClick={() => setTab('guide')}>
            👁 Visual guide
          </button>
          <button role="tab" aria-selected={tab === 'numbers'} className={tab === 'numbers' ? 'active' : ''} onClick={() => setTab('numbers')}>
            🔢 Numbers
          </button>
        </div>
        {tab === 'guide' ? (
          <>
            <ol className="stepper-chips" aria-label="lesson stages">
              {STAGES.map((s, i) => (
                <li key={s.key}>
                  <button
                    className={`chip${i === idx ? ' active' : ''}${seen.includes(i) ? ' seen' : ''}`}
                    onClick={() => setStage(s.key)}
                    title={s.tip}
                  >
                    <span aria-hidden>{s.icon}</span> {s.label}
                  </button>
                </li>
              ))}
            </ol>
            <div className="stage-head">
              <span className="stage-icon" aria-hidden>{STAGES[idx].icon}</span>
              <div>
                <div className="stage-name">{STAGES[idx].label}</div>
                <div className="stage-tip">{STAGES[idx].tip}</div>
              </div>
            </div>
            <div className="stage-body" key={current}>{stages[current]}</div>
            <div className="stage-nav">
              <button className="btn" disabled={idx === 0} onClick={() => setStage(STAGES[idx - 1].key)}>
                ← Back
              </button>
              {idx < STAGES.length - 1 ? (
                <button className="btn primary" onClick={() => setStage(STAGES[idx + 1].key)}>
                  Next: {STAGES[idx + 1].label} →
                </button>
              ) : (
                <span className="done-badge">✔ Lesson complete</span>
              )}
            </div>
          </>
        ) : (
          <div className="numbers-view">{numbers}</div>
        )}
      </aside>
    </div>
  );
}

/** Layout for challenges / free tools: tool on the left, a panel on the right. */
export function Workbench({ title, tool, controls, panel }: { title: ReactNode; tool: ReactNode; controls?: ReactNode; panel: ReactNode }) {
  return (
    <div className="lesson">
      <div className="lesson-stage">
        <h2 className="lesson-title">{title}</h2>
        <div className="tool-frame">{tool}</div>
        {controls && <div className="tool-controls">{controls}</div>}
      </div>
      <aside className="lesson-panel">{panel}</aside>
    </div>
  );
}
