import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { HSL_BANDS, IDENTITY_CURVE, wheelVector, type CurvePoint, type Curves, type GradeParams, type HslBand, type Wheel, bakeCurve } from '../../engine/params';
import { Segmented, Slider, cx } from '../ui';

type Set = (p: Partial<GradeParams>) => void;

// ------------------------------------------------------------------ colour wheel (lift / gamma / gain)

function wheelColour(x: number, y: number) {
  const v = wheelVector(x, y);
  const m = Math.max(...v.map(Math.abs)) || 1;
  return `rgb(${v.map((c) => Math.round(128 + (c / m) * 110)).join(',')})`;
}

export function ColourWheel({ label, value, onChange, size = 150, hint }: { label: string; value: Wheel; onChange: (w: Wheel) => void; size?: number; hint?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const N = Math.round(size * dpr);
    c.width = N; c.height = N;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i / N) * 2 - 1, y = 1 - (j / N) * 2;
      const r = Math.hypot(x, y);
      const k = (j * N + i) * 4;
      if (r > 1) { img.data[k + 3] = 0; continue; }
      const v = wheelVector(x, y);
      const m = Math.max(0.001, ...v.map(Math.abs));
      const s = Math.min(1, r) * 0.85;
      img.data[k] = 40 + (v[0] / m) * 70 * s + 30 * (1 - s);
      img.data[k + 1] = 40 + (v[1] / m) * 70 * s + 30 * (1 - s);
      img.data[k + 2] = 40 + (v[2] / m) * 70 * s + 30 * (1 - s);
      img.data[k] += 15; img.data[k + 1] += 15; img.data[k + 2] += 15;
      img.data[k + 3] = r > 0.98 ? Math.round(255 * (1 - r) / 0.02) : 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [size]);
  const from = (e: RPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - r.left) / r.width) * 2 - 1, y = 1 - ((e.clientY - r.top) / r.height) * 2;
    const d = Math.hypot(x, y);
    if (d > 1) { x /= d; y /= d; }
    // fine control: the outer half of the disc is reached with a gentle curve
    onChange({ ...value, x, y });
  };
  const key = (e: KeyboardEvent) => {
    const st = e.shiftKey ? 0.1 : 0.02;
    const map: Record<string, [number, number]> = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] };
    if (e.key === '0' || e.key === 'Delete') { onChange({ ...value, x: 0, y: 0 }); e.preventDefault(); return; }
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
    onChange({ ...value, x: Math.max(-1, Math.min(1, value.x + d[0])), y: Math.max(-1, Math.min(1, value.y + d[1])) });
  };
  const px = size / 2 + value.x * (size / 2), py = size / 2 - value.y * (size / 2);
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-300">{label}</p>
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label} colour wheel. Arrow keys move the puck, 0 resets.`}
        aria-valuetext={`x ${value.x.toFixed(2)}, y ${value.y.toFixed(2)}`}
        onKeyDown={key}
        onDoubleClick={() => onChange({ ...value, x: 0, y: 0 })}
        className="relative touch-none select-none rounded-full outline-offset-4"
        style={{ width: size, height: size }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); from(e); }}
        onPointerMove={(e) => { if (e.buttons) from(e); }}
      >
        <canvas ref={ref} className="h-full w-full rounded-full ring-1 ring-ink-600" style={{ width: size, height: size }} />
        <div className="pointer-events-none absolute inset-0 m-auto h-px w-full bg-white/10" />
        <div className="pointer-events-none absolute inset-0 m-auto h-full w-px bg-white/10" />
        <div className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.6)]" style={{ left: px, top: py, background: value.x || value.y ? wheelColour(value.x, value.y) : '#777' }} />
      </div>
      <div className="w-full max-w-[180px]">
        <Slider label="Master" value={value.m} min={-1} max={1} step={0.005} defaultValue={0} onChange={(m) => onChange({ ...value, m })} format={(v) => (v > 0 ? '+' : '') + v.toFixed(2)} />
      </div>
      {hint && <p className="max-w-[180px] text-center text-[11px] leading-snug text-ink-500">{hint}</p>}
    </div>
  );
}

export function WheelsPanel({ p, set, size = 140 }: { p: GradeParams; set: Set; size?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <ColourWheel label="Lift" value={p.lift} onChange={(lift) => set({ lift })} size={size} hint="Mostly shadows" />
      <ColourWheel label="Gamma" value={p.gammaW} onChange={(gammaW) => set({ gammaW })} size={size} hint="Mostly midtones" />
      <ColourWheel label="Gain" value={p.gain} onChange={(gain) => set({ gain })} size={size} hint="Mostly highlights" />
    </div>
  );
}

// ------------------------------------------------------------------ curves

type Ch = keyof Curves;
const CH_COLOUR: Record<Ch, string> = { master: '#ececec', r: '#ff5a5a', g: '#55d36b', b: '#5b8cff' };

export function CurveEditor({ curves, onChange, size = 280 }: { curves: Curves; onChange: (c: Curves) => void; size?: number }) {
  const [ch, setCh] = useState<Ch>('master');
  const [sel, setSel] = useState<number | null>(null);
  const drag = useRef<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const pad = 10, S = size - pad * 2;
  const pts = curves[ch];
  const set = (np: CurvePoint[]) => onChange({ ...curves, [ch]: np });
  const toXY = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, ((e.clientX - r.left) / r.width * size - pad) / S)), y: Math.min(1, Math.max(0, 1 - ((e.clientY - r.top) / r.height * size - pad) / S)) };
  };
  const down = (e: RPointerEvent<SVGSVGElement>) => {
    svg.current!.setPointerCapture(e.pointerId);
    const { x, y } = toXY(e);
    let best = -1, bd = 0.06;
    pts.forEach((p, i) => { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } });
    if (best < 0) {
      const np = [...pts, { x, y }].sort((a, b) => a.x - b.x);
      best = np.findIndex((p) => p.x === x && p.y === y);
      set(np);
    }
    drag.current = best;
    setSel(best);
  };
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    if (drag.current === null || !e.buttons) return;
    const i = drag.current;
    const { x, y } = toXY(e);
    const np = pts.map((p) => ({ ...p }));
    const isEnd = i === 0 || i === np.length - 1;
    const lo = i > 0 ? np[i - 1].x + 0.01 : 0, hi = i < np.length - 1 ? np[i + 1].x - 0.01 : 1;
    np[i] = { x: isEnd ? (i === 0 ? Math.min(x, hi) : Math.max(x, lo)) : Math.min(hi, Math.max(lo, x)), y };
    set(np);
  };
  const remove = (i: number) => {
    if (i <= 0 || i >= pts.length - 1) return;
    set(pts.filter((_, k) => k !== i));
    setSel(null);
  };
  const key = (e: KeyboardEvent) => {
    if (sel === null) return;
    const st = e.shiftKey ? 0.05 : 0.01;
    const np = pts.map((p) => ({ ...p }));
    const p = np[sel];
    if (!p) return;
    if (e.key === 'ArrowUp') p.y = Math.min(1, p.y + st);
    else if (e.key === 'ArrowDown') p.y = Math.max(0, p.y - st);
    else if (e.key === 'ArrowLeft') p.x = Math.max(sel > 0 ? np[sel - 1].x + 0.01 : 0, p.x - st);
    else if (e.key === 'ArrowRight') p.x = Math.min(sel < np.length - 1 ? np[sel + 1].x - 0.01 : 1, p.x + st);
    else if (e.key === 'Delete' || e.key === 'Backspace') { remove(sel); e.preventDefault(); return; }
    else if (e.key === 'Tab') { return; }
    else return;
    e.preventDefault();
    set(np);
  };
  const baked = bakeCurve(pts, 128);
  const path = 'M' + Array.from(baked).map((v, i) => `${pad + (i / 127) * S},${pad + (1 - Math.min(1, Math.max(0, v))) * S}`).join(' L');
  const others = (Object.keys(curves) as Ch[]).filter((c) => c !== ch);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Segmented size="sm" value={ch} onChange={(c) => { setCh(c); setSel(null); }} label="Curve channel"
          options={[{ value: 'master', label: 'RGB' }, { value: 'r', label: <span className="text-[#ff7a7a]">Red</span> }, { value: 'g', label: <span className="text-[#6fe083]">Green</span> }, { value: 'b', label: <span className="text-[#7fa6ff]">Blue</span> }]} />
        <button className="text-[12px] text-ink-400 hover:text-ink-50" onClick={() => { set([...IDENTITY_CURVE]); setSel(null); }}>Reset {ch === 'master' ? 'RGB' : ch.toUpperCase()}</button>
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${size} ${size}`}
        tabIndex={0}
        role="application"
        aria-label={`${ch} tone curve. Tap to add a point, drag to move, double-tap or Delete to remove. With a point selected, arrow keys move it.`}
        onKeyDown={key}
        className="w-full touch-none select-none rounded-xl bg-[#0e0e0e] ring-1 ring-ink-700 outline-offset-2"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => { drag.current = null; }}
      >
        {[0.25, 0.5, 0.75].map((v) => (
          <g key={v} stroke="#242424">
            <line x1={pad + v * S} y1={pad} x2={pad + v * S} y2={pad + S} />
            <line x1={pad} y1={pad + v * S} x2={pad + S} y2={pad + v * S} />
          </g>
        ))}
        <rect x={pad} y={pad} width={S} height={S} fill="none" stroke="#333" />
        <path d={`M${pad},${pad + S} L${pad + S},${pad}`} stroke="#3a3a3a" strokeDasharray="3 4" />
        {others.map((c) => {
          const b = bakeCurve(curves[c], 64);
          const iden = curves[c].length === 2 && curves[c][0].y === 0 && curves[c][1].y === 1 && curves[c][0].x === 0 && curves[c][1].x === 1;
          if (iden) return null;
          return <path key={c} d={'M' + Array.from(b).map((v, i) => `${pad + (i / 63) * S},${pad + (1 - v) * S}`).join(' L')} stroke={CH_COLOUR[c]} strokeOpacity={0.3} fill="none" />;
        })}
        <path d={path} stroke={CH_COLOUR[ch]} strokeWidth={2} fill="none" />
        {pts.map((p, i) => (
          <circle key={i} cx={pad + p.x * S} cy={pad + (1 - p.y) * S} r={sel === i ? 8 : 6.5} fill={sel === i ? CH_COLOUR[ch] : '#111'} stroke={CH_COLOUR[ch]} strokeWidth={2}
            onDoubleClick={(e) => { e.stopPropagation(); remove(i); }} />
        ))}
      </svg>
      <p className="mt-1.5 text-[11.5px] text-ink-500">Tap the curve to add a point · drag to shape · double-tap a point to delete it.</p>
    </div>
  );
}

// ------------------------------------------------------------------ HSL mixer

export function HslMixer({ hsl, onChange }: { hsl: HslBand[]; onChange: (h: HslBand[]) => void }) {
  const [mode, setMode] = useState<'h' | 's' | 'l'>('h');
  const label = { h: 'Hue', s: 'Saturation', l: 'Luminance' }[mode];
  return (
    <div>
      <Segmented size="sm" value={mode} onChange={setMode} label="HSL property" options={[{ value: 'h', label: 'Hue' }, { value: 's', label: 'Saturation' }, { value: 'l', label: 'Luminance' }]} />
      <div className="mt-3 space-y-2">
        {HSL_BANDS.map((b, i) => (
          <Slider
            key={b.id}
            label={<span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: b.swatch }} />{b.label}</span>}
            ariaLabel={`${b.label} ${label}`}
            value={hsl[i][mode]}
            min={-1}
            max={1}
            step={0.01}
            defaultValue={0}
            onChange={(v) => onChange(hsl.map((x, k) => (k === i ? { ...x, [mode]: v } : x)))}
            format={(v) => (mode === 'h' ? `${v >= 0 ? '+' : ''}${Math.round(v * 30)}°` : `${v >= 0 ? '+' : ''}${Math.round(v * 100)}`)}
            track={mode === 'h' ? `linear-gradient(to right, ${HSL_BANDS[(i + 7) % 8].swatch}, ${b.swatch}, ${HSL_BANDS[(i + 1) % 8].swatch})` : mode === 's' ? `linear-gradient(to right, #777, ${b.swatch})` : `linear-gradient(to right, #222, ${b.swatch}, #eee)`}
          />
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ basic panels

export const TEMP_TRACK = 'linear-gradient(to right, #3b6fd8, #9bb3d9, #d8d0c0, #e8b56a, #e38a2e)';
export const TINT_TRACK = 'linear-gradient(to right, #3fb34a, #a9c79a, #cdbfcd, #d58fd0, #c63fbf)';

export function WhiteBalancePanel({ p, set }: { p: GradeParams; set: Set }) {
  return (
    <div className="space-y-3">
      <Slider label="Temperature" value={Math.log(p.temp)} min={Math.log(2000)} max={Math.log(15000)} step={0.002} defaultValue={Math.log(6504)} track={TEMP_TRACK}
        onChange={(v) => set({ temp: Math.round(Math.exp(v)) })} format={(v) => `${Math.round(Math.exp(v))} K`}
        hint="The colour of light you tell the software the scene had. Lower = it compensates by cooling." />
      <Slider label="Tint" value={p.tint} min={-100} max={100} step={1} defaultValue={0} track={TINT_TRACK} onChange={(tint) => set({ tint })} format={(v) => (v > 0 ? `+${v}` : String(v))} />
    </div>
  );
}

export function TonePanel({ p, set, include = ['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks'] }: { p: GradeParams; set: Set; include?: ('exposure' | 'contrast' | 'highlights' | 'shadows' | 'whites' | 'blacks' | 'rolloff')[] }) {
  const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`;
  const all = {
    exposure: <Slider key="exposure" label="Exposure" value={p.exposure} min={-4} max={4} step={0.01} defaultValue={0} onChange={(exposure) => set({ exposure })} format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} EV`} />,
    contrast: <Slider key="contrast" label="Contrast" value={p.contrast} min={-1} max={1} step={0.01} defaultValue={0} onChange={(contrast) => set({ contrast })} format={pct} />,
    highlights: <Slider key="highlights" label="Highlights" value={p.highlights} min={-1} max={1} step={0.01} defaultValue={0} onChange={(highlights) => set({ highlights })} format={pct} />,
    shadows: <Slider key="shadows" label="Shadows" value={p.shadows} min={-1} max={1} step={0.01} defaultValue={0} onChange={(shadows) => set({ shadows })} format={pct} />,
    whites: <Slider key="whites" label="Whites" value={p.whites} min={-1} max={1} step={0.01} defaultValue={0} onChange={(whites) => set({ whites })} format={pct} />,
    blacks: <Slider key="blacks" label="Blacks" value={p.blacks} min={-1} max={1} step={0.01} defaultValue={0} onChange={(blacks) => set({ blacks })} format={pct} />,
    rolloff: <Slider key="rolloff" label="Highlight roll-off" value={p.rolloff} min={0} max={1} step={0.01} onChange={(rolloff) => set({ rolloff })} format={(v) => (v < 0.01 ? 'Hard clip' : `${Math.round(v * 100)}%`)} />,
  };
  return <div className="space-y-3">{include.map((k) => all[k])}</div>;
}

export function ColourPanel({ p, set }: { p: GradeParams; set: Set }) {
  return (
    <div className="space-y-3">
      <Slider label="Saturation" value={p.saturation} min={0} max={2} step={0.01} defaultValue={1} onChange={(saturation) => set({ saturation })} format={(v) => `${Math.round((v - 1) * 100) > 0 ? '+' : ''}${Math.round((v - 1) * 100)}`} track="linear-gradient(to right, #777, #c86a3c)" />
      <Slider label="Vibrance" value={p.vibrance} min={-1} max={1} step={0.01} defaultValue={0} onChange={(vibrance) => set({ vibrance })} format={(v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`} hint="Boosts muted colours more than vivid ones." />
    </div>
  );
}

export function FilmPanel({ p, set }: { p: GradeParams; set: Set }) {
  return (
    <div className="space-y-3">
      <Slider label="Colour density" value={p.density} min={0} max={1} step={0.01} defaultValue={0} onChange={(density) => set({ density })} format={(v) => `${Math.round(v * 100)}`} hint="Saturated colours get darker, like dye in film." />
      <Slider label="Halation" value={p.halation} min={0} max={1} step={0.01} defaultValue={0} onChange={(halation) => set({ halation })} format={(v) => `${Math.round(v * 100)}`} hint="Red glow around bright highlights." />
      <Slider label="Highlight roll-off" value={p.rolloff} min={0} max={1} step={0.01} onChange={(rolloff) => set({ rolloff })} format={(v) => (v < 0.01 ? 'Hard clip' : `${Math.round(v * 100)}%`)} />
      <Slider label="Faded blacks" value={p.fade} min={0} max={1} step={0.01} defaultValue={0} onChange={(fade) => set({ fade })} format={(v) => `${Math.round(v * 100)}`} />
      <Slider label="Grain amount" value={p.grain} min={0} max={1} step={0.01} defaultValue={0} onChange={(grain) => set({ grain })} format={(v) => `${Math.round(v * 100)}`} />
      <Slider label="Grain size" value={p.grainSize} min={0.8} max={4} step={0.05} defaultValue={1.6} onChange={(grainSize) => set({ grainSize })} format={(v) => `${v.toFixed(1)} px`} />
      <Slider label="Vignette" value={p.vignette} min={-1} max={1} step={0.01} defaultValue={0} onChange={(vignette) => set({ vignette })} format={(v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`} />
    </div>
  );
}

/** Collapsible section used in editing sidebars. */
export function ToolSection({ title, children, open: initial = true, locked, right }: { title: string; children: ReactNode; open?: boolean; locked?: string; right?: ReactNode }) {
  const [open, setOpen] = useState(initial);
  return (
    <section className="rounded-2xl bg-ink-850 ring-1 ring-ink-750">
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <button className="flex flex-1 items-center gap-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className={cx('text-ink-500 transition-transform', open && 'rotate-90')}>›</span>
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-300">{title}</span>
        </button>
        {right}
      </header>
      {open && <div className="px-4 pb-4">{locked ? <p className="text-[12.5px] text-ink-500">🔒 {locked}</p> : children}</div>}
    </section>
  );
}
