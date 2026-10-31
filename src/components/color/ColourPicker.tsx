import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { clamp01, hexToRgb, hslToRgb, rgbToHex, rgbToHsl, to255, wrapHue, type RGB, type Vec3 } from '../../lib/color';
import { Segmented, Slider, cx } from '../ui';

/** An HSL wheel: angle = hue (red at 12 o'clock, clockwise), distance from centre = saturation, at the current lightness. */
export function HueWheel({ hsl, onChange, size = 220, label = 'Colour wheel' }: { hsl: Vec3; onChange: (h: Vec3) => void; size?: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [h, s, l] = hsl;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const N = Math.round(size * dpr);
    c.width = N;
    c.height = N;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(N, N);
    const R = N / 2;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const dx = x - R + 0.5, dy = y - R + 0.5;
        const d = Math.hypot(dx, dy) / R;
        const i = (y * N + x) * 4;
        if (d > 1) { img.data[i + 3] = 0; continue; }
        const hue = wrapHue((Math.atan2(dx, -dy) * 180) / Math.PI);
        const [r, g, b] = hslToRgb([hue, d, l]);
        img.data[i] = r * 255; img.data[i + 1] = g * 255; img.data[i + 2] = b * 255;
        img.data[i + 3] = d > 0.985 ? Math.round(255 * (1 - d) / 0.015) : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [l, size]);

  const fromPointer = (e: RPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
    const sat = Math.min(1, Math.hypot(dx, dy) / (r.width / 2));
    const hue = wrapHue((Math.atan2(dx, -dy) * 180) / Math.PI);
    onChange([hue, sat, l]);
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') onChange([wrapHue(h - step), s, l]);
    else if (e.key === 'ArrowRight') onChange([wrapHue(h + step), s, l]);
    else if (e.key === 'ArrowUp') onChange([h, clamp01(s + step / 100), l]);
    else if (e.key === 'ArrowDown') onChange([h, clamp01(s - step / 100), l]);
    else return;
    e.preventDefault();
  };
  const a = (h * Math.PI) / 180;
  const px = size / 2 + Math.sin(a) * s * (size / 2);
  const py = size / 2 - Math.cos(a) * s * (size / 2);
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={`${label}: hue ${Math.round(h)} degrees, saturation ${Math.round(s * 100)} percent. Arrow keys adjust.`}
      aria-valuenow={Math.round(h)}
      aria-valuemin={0}
      aria-valuemax={360}
      onKeyDown={onKey}
      className="relative shrink-0 touch-none select-none rounded-full outline-offset-4"
      style={{ width: size, height: size }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); }}
      onPointerMove={(e) => { if (e.buttons) fromPointer(e); }}
    >
      <canvas ref={ref} className="h-full w-full rounded-full" style={{ width: size, height: size }} />
      <div className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_2px_6px_rgba(0,0,0,0.5)]" style={{ left: px, top: py, background: rgbToHex(hslToRgb(hsl)) }} />
    </div>
  );
}

export function HexInput({ value, onChange, className }: { value: RGB; onChange: (c: RGB) => void; className?: string }) {
  const hex = rgbToHex(value);
  const [text, setText] = useState(hex);
  useEffect(() => setText(hex), [hex]);
  const ok = !!hexToRgb(text);
  return (
    <label className={cx('flex items-center gap-2 text-[13px] text-ink-300', className)}>
      HEX
      <input
        value={text}
        spellCheck={false}
        maxLength={7}
        onChange={(e) => { setText(e.target.value); const c = hexToRgb(e.target.value); if (c && /^#?[0-9a-f]{6}$/i.test(e.target.value.trim())) onChange(c); }}
        onBlur={() => { const c = hexToRgb(text); if (c) onChange(c); else setText(hex); }}
        className={cx('h-10 w-[7.5rem] rounded-lg bg-ink-800 px-3 font-mono text-[14px] uppercase text-ink-50 ring-1 outline-none focus:ring-ink-300', ok ? 'ring-ink-650' : 'ring-bad')}
        aria-label="Hexadecimal colour"
      />
    </label>
  );
}

const hueTrack = 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)';

/** Full colour picker: wheel, lightness, HSL or RGB sliders and HEX entry. Keeps hue stable at zero saturation. */
export function ColourPicker({ value, onChange, wheelSize = 220, layout = 'row', modes = ['hsl', 'rgb'] }: {
  value: RGB; onChange: (c: RGB) => void; wheelSize?: number; layout?: 'row' | 'column'; modes?: ('hsl' | 'rgb')[];
}) {
  const [hsl, setHsl] = useState<Vec3>(() => rgbToHsl(value));
  const [mode, setMode] = useState<'hsl' | 'rgb'>(modes[0]);
  const lastHex = useRef(rgbToHex(value));
  useEffect(() => {
    const hx = rgbToHex(value);
    if (hx !== lastHex.current) {
      lastHex.current = hx;
      const n = rgbToHsl(value);
      setHsl((old) => (n[1] < 0.005 ? [old[0], n[1], n[2]] : n));
    }
  }, [value]);
  const setFromHsl = (n: Vec3) => {
    setHsl(n);
    const rgb = hslToRgb(n);
    lastHex.current = rgbToHex(rgb);
    onChange(rgb);
  };
  const setFromRgb = (rgb: RGB) => {
    const n = rgbToHsl(rgb);
    setHsl((old) => (n[1] < 0.005 ? [old[0], n[1], n[2]] : n));
    lastHex.current = rgbToHex(rgb);
    onChange(rgb);
  };
  const [h, s, l] = hsl;
  const pure = rgbToHex(hslToRgb([h, s, 0.5]));
  const r255 = value.map(to255);
  return (
    <div className={cx('flex gap-5', layout === 'row' ? 'flex-col sm:flex-row sm:items-start' : 'flex-col')}>
      <div className="flex flex-col items-center gap-3">
        <HueWheel hsl={hsl} onChange={setFromHsl} size={wheelSize} />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <Slider label="Lightness" value={l} min={0} max={1} step={0.001} onChange={(v) => setFromHsl([h, s, v])} format={(v) => `${Math.round(v * 100)}%`} track={`linear-gradient(to right, #000, ${pure}, #fff)`} />
        {modes.length > 1 && <Segmented size="sm" value={mode} onChange={setMode} options={modes.map((m) => ({ value: m, label: m.toUpperCase() }))} label="Slider mode" />}
        {mode === 'hsl' ? (
          <>
            <Slider label="Hue" value={h} min={0} max={359.9} step={0.5} onChange={(v) => setFromHsl([v, s, l])} format={(v) => `${Math.round(v)}°`} track={hueTrack} />
            <Slider label="Saturation" value={s} min={0} max={1} step={0.001} onChange={(v) => setFromHsl([h, v, l])} format={(v) => `${Math.round(v * 100)}%`} track={`linear-gradient(to right, ${rgbToHex(hslToRgb([h, 0, l]))}, ${rgbToHex(hslToRgb([h, 1, l]))})`} />
          </>
        ) : (
          (['Red', 'Green', 'Blue'] as const).map((name, i) => (
            <Slider key={name} label={name} value={r255[i]} min={0} max={255} step={1} format={(v) => String(Math.round(v))}
              track={`linear-gradient(to right, ${rgbToHex(value.map((c, j) => (j === i ? 0 : c)) as RGB)}, ${rgbToHex(value.map((c, j) => (j === i ? 1 : c)) as RGB)})`}
              onChange={(v) => setFromRgb(value.map((c, j) => (j === i ? v / 255 : c)) as RGB)} />
          ))
        )}
        <HexInput value={value} onChange={setFromRgb} />
      </div>
    </div>
  );
}
