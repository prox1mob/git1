import { useState, type CSSProperties, type ReactNode } from 'react';
import { GLOSSARY, type TermKey } from '../core/glossary';
import { updateSettings, useSettings, type Difficulty } from '../core/store';

/** A maths word. In Tamil–English mode it also shows the Tamil term. Tap for the meaning. */
export function T({ k, children, plural }: { k: TermKey; children?: ReactNode; plural?: boolean }) {
  const { tamil } = useSettings();
  const [open, setOpen] = useState(false);
  const g = GLOSSARY[k];
  const text = children ?? (plural ? `${g.en}s` : g.en);
  return (
    <span className={`term${open ? ' open' : ''}`} onClick={() => setOpen((o) => !o)} title={`${g.en}: ${g.plain}${tamil ? ` — ${g.ta} (${g.tr})` : ''}`}>
      <span className="term-en">{text}</span>
      {tamil && <span className="term-ta" lang="ta"> ({g.ta})</span>}
      {open && (
        <span className="term-pop" role="tooltip">
          <b>{g.en}</b> — {g.plain}
          {tamil && (
            <>
              <br />
              <span lang="ta">{g.ta}</span> <i>({g.tr})</i>
            </>
          )}
        </span>
      )}
    </span>
  );
}

interface SliderProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  onStart?: () => void;
  color?: string;
  format?: (v: number) => string;
  disabled?: boolean;
}

/** A large, touch-friendly slider. Calls onStart once per gesture (used for Undo checkpoints). */
export function Slider({ label, value, min, max, step = 1, unit = '', onChange, onStart, color, format, disabled }: SliderProps) {
  const shown = format ? format(value) : `${Number(value.toFixed(4))}${unit ? ` ${unit}` : ''}`;
  return (
    <label className="slider" style={color ? ({ '--accent': color } as CSSProperties) : undefined}>
      <span className="slider-top">
        <span className="slider-label">{label}</span>
        <span className="slider-value" style={color ? { color } : undefined}>{shown}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onPointerDown={onStart}
        onKeyDown={onStart}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function Stepper({ label, value, min, max, step = 1, onChange, unit }: {
  label: ReactNode; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <button className="btn icon" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label="decrease">−</button>
      <span className="stepper-value">{value}{unit ? ` ${unit}` : ''}</span>
      <button className="btn icon" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label="increase">+</button>
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`toggle${checked ? ' on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track"><span className="toggle-thumb" /></span>
      <span>{label}</span>
    </label>
  );
}

export function Segmented<V extends string | number>({ options, value, onChange, small }: {
  options: { value: V; label: ReactNode }[]; value: V; onChange: (v: V) => void; small?: boolean;
}) {
  return (
    <div className={`segmented${small ? ' small' : ''}`} role="radiogroup">
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Undo / Reset (+ optional extra buttons). */
export function ToolBar({ onUndo, canUndo, onReset, children }: {
  onUndo?: () => void; canUndo?: boolean; onReset?: () => void; children?: ReactNode;
}) {
  return (
    <div className="toolbar">
      {onUndo && <button className="btn" onClick={onUndo} disabled={!canUndo} title="Undo the last change">↶ Undo</button>}
      {onReset && <button className="btn" onClick={onReset} title="Start this tool again">⟲ Reset</button>}
      {children}
    </div>
  );
}

export function DifficultyPicker() {
  const { difficulty } = useSettings();
  return (
    <Segmented<Difficulty>
      small
      value={difficulty}
      onChange={(d) => updateSettings({ difficulty: d })}
      options={[
        { value: 'easy', label: 'Easy' },
        { value: 'normal', label: 'Normal' },
        { value: 'hard', label: 'Hard' },
      ]}
    />
  );
}

/** A live read-out: label + big number. */
export function Stat({ label, value, color, sub }: { label: ReactNode; value: ReactNode; color?: string; sub?: ReactNode }) {
  return (
    <div className="stat" style={color ? { borderColor: color } : undefined}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Stats({ children }: { children: ReactNode }) {
  return <div className="stats">{children}</div>;
}

export interface Sym {
  s: string;
  means: ReactNode;
  color?: string;
}

/**
 * A formula where every symbol is explained in plain words underneath.
 * parts: strings are operators/numbers, Sym objects are explained symbols.
 */
export function Formula({ parts, caption }: { parts: (string | Sym)[]; caption?: ReactNode }) {
  const syms = parts.filter((p): p is Sym => typeof p !== 'string');
  const seen = new Set<string>();
  return (
    <div className="formula">
      <div className="formula-main">
        {parts.map((p, i) =>
          typeof p === 'string' ? (
            <span key={i} className="formula-op">{p}</span>
          ) : (
            <span key={i} className="formula-sym" style={{ color: p.color }}>{p.s}</span>
          ),
        )}
      </div>
      <ul className="formula-legend">
        {syms
          .filter((s) => (seen.has(s.s) ? false : (seen.add(s.s), true)))
          .map((s) => (
            <li key={s.s}>
              <span className="formula-sym small" style={{ color: s.color }}>{s.s}</span> means {s.means}
            </li>
          ))}
      </ul>
      {caption && <div className="formula-caption">{caption}</div>}
    </div>
  );
}

/** Step-by-step arithmetic, one line per step. */
export function Steps({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ol>
  );
}

/** A two-column table of live numbers. */
export function NumberTable({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <table className="numtable">
      <tbody>
        {rows.map(([a, b], i) => (
          <tr key={i}>
            <th>{a}</th>
            <td>{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Note({ kind = 'info', children }: { kind?: 'info' | 'safety' | 'approx' | 'design'; children: ReactNode }) {
  const icon = { info: 'ℹ️', safety: '⚠️', approx: '≈', design: '✏️' }[kind];
  return (
    <div className={`note note-${kind}`}>
      <span className="note-icon" aria-hidden>{icon}</span>
      <div>{children}</div>
    </div>
  );
}

/** For anything electrical or load-bearing: a learning model is not an engineering check. */
export function SafetyNote({ children }: { children?: ReactNode }) {
  return (
    <Note kind="safety">
      <b>Learning exercise only.</b> {children ?? 'Real products that carry electricity or loads must be checked by a qualified engineer and tested against the relevant safety standards.'}
    </Note>
  );
}

/** "Where is this used in sketching / product design?" box. */
export function DesignLink({ children, title = 'In sketching & product design' }: { children: ReactNode; title?: string }) {
  return (
    <div className="design-link">
      <div className="design-link-title">✏️ {title}</div>
      <div>{children}</div>
    </div>
  );
}

export function Card({ title, children, className = '' }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {title && <h3 className="card-title">{title}</h3>}
      {children}
    </section>
  );
}
