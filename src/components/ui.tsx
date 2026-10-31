import { useId, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'quiet';
export function Button({ variant = 'secondary', size = 'md', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-ink-50 text-ink-950 hover:bg-white disabled:bg-ink-600 disabled:text-ink-400',
    secondary: 'bg-ink-750 text-ink-100 hover:bg-ink-700 border border-ink-650 disabled:opacity-40',
    ghost: 'text-ink-200 hover:text-ink-50 hover:bg-ink-800 disabled:opacity-40',
    quiet: 'text-ink-300 hover:text-ink-50 underline-offset-4 hover:underline disabled:opacity-40',
  };
  const s = { sm: 'h-9 px-3 text-[13px]', md: 'h-11 px-4 text-sm', lg: 'h-13 px-6 text-[15px]' }[size];
  return (
    <button {...rest} className={cx('inline-flex select-none items-center justify-center gap-2 rounded-full font-medium tracking-[-0.005em] transition-colors', v[variant], s, className)}>
      {children}
    </button>
  );
}

export function Slider({
  label, value, min, max, step = 0.01, onChange, defaultValue, format, track, hint, disabled, className, ariaLabel,
}: {
  label: ReactNode; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
  defaultValue?: number; format?: (v: number) => string; track?: string; hint?: ReactNode; disabled?: boolean; className?: string; ariaLabel?: string;
}) {
  const id = useId();
  const changed = defaultValue !== undefined && Math.abs(value - defaultValue) > step / 2;
  return (
    <div className={cx('group', disabled && 'opacity-40', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] text-ink-200" onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}>
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          {changed && (
            <button type="button" aria-label={`Reset ${typeof label === 'string' ? label : ''}`} title="Reset" onClick={() => onChange(defaultValue!)} className="h-6 w-6 rounded-full text-[13px] text-ink-400 hover:bg-ink-700 hover:text-ink-100">
              ↺
            </button>
          )}
          <span className="num min-w-[3.5rem] text-right font-mono text-[12px] text-ink-300">{format ? format(value) : value.toFixed(2)}</span>
        </div>
      </div>
      <input
        id={id}
        type="range"
        className="vl-range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        style={track ? ({ '--track': track } as CSSProperties) : undefined}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {hint && <p className="-mt-1 text-[11.5px] leading-snug text-ink-400">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, size = 'md', className, label }: {
  options: { value: T; label: ReactNode; title?: string }[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md'; className?: string; label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex flex-wrap rounded-full bg-ink-800 p-1 ring-1 ring-ink-700', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-full px-3 font-medium transition-colors',
            size === 'sm' ? 'h-8 text-[12px]' : 'h-9 text-[13px]',
            o.value === value ? 'bg-ink-100 text-ink-950' : 'text-ink-300 hover:text-ink-50',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Panel({ title, children, className, actions, tone = 'default' }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode; tone?: 'default' | 'flat' }) {
  return (
    <section className={cx('rounded-2xl', tone === 'default' ? 'bg-ink-850 ring-1 ring-ink-750' : '', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-1">
          {title && <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">{title}</h3>}
          {actions}
        </header>
      )}
      <div className="p-4 pt-2">{children}</div>
    </section>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'signal' | 'outline'; className?: string }) {
  const t = {
    neutral: 'bg-ink-700 text-ink-200',
    ok: 'bg-ok/15 text-ok',
    warn: 'bg-warn/15 text-warn',
    bad: 'bg-bad/15 text-bad',
    signal: 'bg-signal/15 text-signal',
    outline: 'ring-1 ring-ink-600 text-ink-300',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', t, className)}>{children}</span>;
}

export function Toggle({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; className?: string }) {
  return (
    <label className={cx('inline-flex cursor-pointer select-none items-center gap-2.5 text-[13px] text-ink-200', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-6 w-10 rounded-full transition-colors', checked ? 'bg-ink-100' : 'bg-ink-600')}
      >
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full transition-all', checked ? 'left-[18px] bg-ink-950' : 'left-0.5 bg-ink-300')} />
      </button>
      {label}
    </label>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400', className)}>{children}</p>;
}

export function Note({ children, tone = 'info', className }: { children: ReactNode; tone?: 'info' | 'caution' | 'science'; className?: string }) {
  const t = { info: 'border-ink-600', caution: 'border-warn/60', science: 'border-[#8fb3ff]/60' }[tone];
  const label = { info: 'Note', caution: 'Approximation', science: 'Under the hood' }[tone];
  return (
    <aside className={cx('border-l-2 pl-3 text-[12.5px] leading-relaxed text-ink-300', t, className)}>
      <span className="mr-1.5 font-semibold text-ink-200">{label}.</span>
      {children}
    </aside>
  );
}

export function Meter({ value, max = 100, className, tone }: { value: number; max?: number; className?: string; tone?: 'ok' | 'warn' | 'bad' | 'neutral' }) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  const t = tone ?? (pct >= 80 ? 'ok' : pct >= 50 ? 'warn' : 'bad');
  const c = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', neutral: 'bg-ink-200' }[t];
  return (
    <div className={cx('h-1.5 overflow-hidden rounded-full bg-ink-700', className)}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', c)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-ink-600 bg-ink-800 px-1.5 py-0.5 font-mono text-[11px] text-ink-300">{children}</kbd>;
}

export function Swatch({ color, size = 28, className, title }: { color: string; size?: number; className?: string; title?: string }) {
  return <span title={title ?? color} className={cx('inline-block shrink-0 rounded-md ring-1 ring-white/10', className)} style={{ background: color, width: size, height: size }} />;
}

export function ProgressRing({ value, size = 44, stroke = 3, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2b2b2b" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e9e9e9" strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} strokeLinecap="round" className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[11px] text-ink-200">{children}</div>
    </div>
  );
}
