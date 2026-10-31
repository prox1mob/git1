import { useEffect, useState, type ReactNode } from 'react';
import { useSettings } from '../store/progress';
import { fmt } from '../lib/math';

/** Bilingual text: English, with optional Tamil shown when the setting is on. */
export function T({ en, ta, inline }: { en: ReactNode; ta?: ReactNode; inline?: boolean }) {
  const { tamil } = useSettings();
  if (inline) return <>{en}{tamil && ta ? <span className="muted"> · {ta}</span> : null}</>;
  return (
    <>
      <div>{en}</div>
      {tamil && ta ? <div className="ta" lang="ta">{ta}</div> : null}
    </>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit = '',
  digits,
  disabled,
  onCommit,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
  digits?: number;
  disabled?: boolean;
  onCommit?: () => void;
}) {
  const d = digits ?? (step >= 1 ? 0 : step >= 0.1 ? 1 : 2);
  return (
    <div className="slider">
      <div className="lbl">
        <span>{label}</span>
        <b>
          {fmt(value, d)}
          {unit && ` ${unit}`}
        </b>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
    </div>
  );
}

/** Numeric input that only commits valid numbers (on blur / Enter). */
export function NumberField({
  value,
  onChange,
  step = 1,
  min,
  max,
  digits = 2,
  label,
  axis,
  unit,
  width,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  digits?: number;
  label?: ReactNode;
  axis?: 'x' | 'y' | 'z';
  unit?: string;
  width?: number;
}) {
  const [text, setText] = useState(fmt(value, digits).replace(/,/g, ''));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(fmt(value, digits).replace(/,/g, ''));
  }, [value, digits, focus]);
  const commit = () => {
    const v = parseFloat(text);
    if (isFinite(v)) {
      let c = v;
      if (min != null) c = Math.max(min, c);
      if (max != null) c = Math.min(max, c);
      onChange(c);
      setText(fmt(c, digits).replace(/,/g, ''));
    } else setText(fmt(value, digits).replace(/,/g, ''));
  };
  const color = axis === 'x' ? 'var(--x)' : axis === 'y' ? 'var(--y)' : axis === 'z' ? 'var(--z)' : undefined;
  return (
    <label className="numrow" style={{ width }}>
      {axis && (
        <span className="axis" style={{ color }}>
          {axis.toUpperCase()}
        </span>
      )}
      {label && <span className="lbl" style={{ minWidth: 70 }}>{label}</span>}
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={text}
        onFocus={() => setFocus(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setFocus(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        style={{ borderColor: color }}
      />
      {unit && <span className="muted" style={{ fontSize: 12 }}>{unit}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Seg<T extends string>({ value, options, onChange, small = true }: { value: T; options: { v: T; label: ReactNode; cls?: string }[]; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.v} className={`btn ${small ? 'small' : ''} ${o.cls ?? ''} ${value === o.v ? 'on' : ''}`} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ScoreRing({ score, size = 74 }: { score: number; size?: number }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const color = score >= 90 ? 'var(--good)' : score >= 70 ? 'var(--accent)' : score >= 40 ? 'var(--warn)' : 'var(--bad)';
  return (
    <svg className="ring" viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#2a3644" strokeWidth={7} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={7}
        fill="none"
        strokeDasharray={`${(c * score) / 100} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fill="#e8eef4" fontSize={size * 0.28} fontWeight={800}>
        {Math.round(score)}
      </text>
    </svg>
  );
}

export function Task({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div className={`task ${ok ? 'ok' : ''}`}>
      <span className="dot">{ok ? '✓' : ''}</span>
      <span>{children}</span>
    </div>
  );
}

export function Stars({ score }: { score: number }) {
  const n = score >= 95 ? 3 : score >= 80 ? 2 : score >= 70 ? 1 : 0;
  return <span className="stars">{'★'.repeat(n)}{'☆'.repeat(3 - n)}</span>;
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
