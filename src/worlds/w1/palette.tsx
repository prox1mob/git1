import { useState, type ReactNode } from 'react';
import { ColourPicker } from '../../components/color/ColourPicker';
import { Badge, cx } from '../../components/ui';
import { contrastRatio, hexToRgb, hueDelta, rgbToHex, rgbToHsl, rgbToLch, wrapHue, type RGB } from '../../lib/color';

export type RoleId = 'background' | 'surface' | 'primary' | 'accent' | 'text';
export type Palette = Record<RoleId, RGB>;
export const ROLE_LABEL: Record<RoleId, string> = { background: 'Background', surface: 'Surface', primary: 'Primary', accent: 'Accent / CTA', text: 'Text' };
export const ROLES: RoleId[] = ['background', 'surface', 'primary', 'accent', 'text'];
/** How much of a typical layout each role covers — used to weight palette features. */
export const ROLE_AREA: Record<RoleId, number> = { background: 0.5, surface: 0.18, primary: 0.18, accent: 0.06, text: 0.08 };

export const pal = (hex: Record<RoleId, string>): Palette => Object.fromEntries(Object.entries(hex).map(([k, v]) => [k, hexToRgb(v)!])) as Palette;

// ------------------------------------------------------------------ harmony

export type Scheme = 'monochromatic' | 'analogous' | 'complementary' | 'split-complementary' | 'triadic' | 'free';
export const SCHEME_OFFSETS: Record<Exclude<Scheme, 'free'>, number[]> = {
  monochromatic: [0, 0, 0],
  analogous: [-30, 0, 30],
  complementary: [0, 180],
  'split-complementary': [0, 150, 210],
  triadic: [0, 120, 240],
};

/** Chromatic hues (HSL wheel) of the colours that actually carry colour. */
export function chromaticHues(colors: RGB[], minChroma = 12): number[] {
  return colors.filter((c) => rgbToLch(c)[1] >= minChroma).map((c) => rgbToHsl(c)[0]);
}

/** Smallest arc (degrees) containing all hues. */
export function hueSpan(hues: number[]): number {
  if (hues.length < 2) return 0;
  const s = [...hues].map(wrapHue).sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 0; i < s.length; i++) maxGap = Math.max(maxGap, (s[(i + 1) % s.length] - s[i] + 360) % 360 || (s.length === 1 ? 360 : 0));
  return 360 - maxGap;
}

/** Which classic scheme the hues best resemble, and how far off they are (degrees). */
export function detectHarmony(hues: number[]): { scheme: Scheme; error: number } {
  const u = hues.map(wrapHue);
  if (u.length <= 1) return { scheme: 'monochromatic', error: 0 };
  const span = hueSpan(u);
  if (span <= 20) return { scheme: 'monochromatic', error: Math.max(0, span - 10) };
  if (span <= 75) return { scheme: 'analogous', error: Math.max(0, span - 60) };
  // cluster hues within 25° of each other
  const clusters: number[] = [];
  for (const h of [...u].sort((a, b) => a - b)) if (!clusters.some((c) => Math.abs(hueDelta(c, h)) < 25)) clusters.push(h);
  if (clusters.length === 2) return { scheme: 'complementary', error: Math.abs(180 - Math.abs(hueDelta(clusters[0], clusters[1]))) };
  if (clusters.length >= 3) {
    const best: { scheme: Scheme; error: number }[] = [];
    for (const base of clusters) {
      for (const scheme of ['triadic', 'split-complementary'] as const) {
        const offs = SCHEME_OFFSETS[scheme];
        const err = clusters.reduce((acc, h) => acc + Math.min(...offs.map((o) => Math.abs(hueDelta(base + o, h)))), 0) / clusters.length;
        best.push({ scheme, error: err });
      }
    }
    best.sort((a, b) => a.error - b.error);
    return best[0];
  }
  return { scheme: 'free', error: 90 };
}

// ------------------------------------------------------------------ mood heuristic

export interface PaletteFeatures { warmth: number; saturation: number; lightness: number; contrast: number; spread: number; red: number }
export function features(p: Palette): PaletteFeatures {
  let w = 0, s = 0, l = 0, red = 0, tot = 0;
  const Ls: number[] = [];
  for (const r of ROLES) {
    const [L, C, h] = rgbToLch(p[r]);
    const a = ROLE_AREA[r];
    w += a * Math.cos(((h - 60) * Math.PI) / 180) * Math.min(1, C / 40);
    s += a * Math.min(1, C / 75);
    l += a * (L / 100);
    red += a * ((h < 45 || h > 340) && C > 30 ? 1 : 0);
    tot += a;
    Ls.push(L);
  }
  const hues = chromaticHues(ROLES.map((r) => p[r]));
  return { warmth: w / tot, saturation: s / tot, lightness: l / tot, contrast: (Math.max(...Ls) - Math.min(...Ls)) / 100, spread: Math.min(1, hueSpan(hues) / 180), red: red / tot };
}

export type Mood = 'calm' | 'excitement' | 'tension' | 'nostalgia' | 'elegance';
export const MOODS: Mood[] = ['calm', 'excitement', 'tension', 'nostalgia', 'elegance'];
const c01 = (x: number) => Math.max(0, Math.min(1, x));
/**
 * A deliberately simple, transparent model of common Western design conventions.
 * It is a teaching aid — culture, context, subject and lighting all change how colour feels.
 */
export function moodScores(p: Palette): Record<Mood, number> {
  const f = features(p);
  const warm = c01(f.warmth), cool = c01(-f.warmth);
  return {
    calm: Math.round(100 * c01(0.35 * (1 - f.saturation) + 0.25 * f.lightness + 0.2 * (1 - f.contrast) + 0.2 * (1 - warm) + 0.05 * cool)),
    excitement: Math.round(100 * c01(0.4 * f.saturation + 0.25 * warm + 0.2 * f.contrast + 0.15 * f.spread)),
    tension: Math.round(100 * c01(0.3 * f.contrast + 0.25 * (1 - f.lightness) + 0.3 * f.red + 0.15 * f.saturation)),
    nostalgia: Math.round(100 * c01(0.35 * (1 - Math.abs(f.saturation - 0.3) / 0.4) + 0.35 * warm + 0.3 * (1 - f.contrast * 0.8))),
    elegance: Math.round(100 * c01(0.3 * (1 - f.saturation) + 0.25 * f.contrast + 0.25 * (1 - f.spread) + 0.2 * Math.abs(f.lightness - 0.5) * 2)),
  };
}

export function MoodBars({ p, highlight }: { p: Palette; highlight?: Mood }) {
  const m = moodScores(p);
  return (
    <ul className="space-y-2">
      {MOODS.map((k) => (
        <li key={k}>
          <div className="flex justify-between text-[12.5px]"><span className={cx('capitalize', k === highlight ? 'text-ink-50' : 'text-ink-300')}>{k}</span><span className="num font-mono text-[11.5px] text-ink-400">{m[k]}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700"><div className={cx('h-full rounded-full', k === highlight ? 'bg-ink-50' : 'bg-ink-400')} style={{ width: `${m[k]}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ editor

export function PaletteEditor({ palette, onChange, roles = ROLES, extra }: { palette: Palette; onChange: (p: Palette) => void; roles?: RoleId[]; extra?: ReactNode }) {
  const [sel, setSel] = useState<RoleId>(roles[0]);
  const textOnBg = contrastRatio(palette.text, palette.background);
  const accentOnBg = contrastRatio(palette.accent, palette.background);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-2">
        {roles.map((r) => (
          <button key={r} onClick={() => setSel(r)} className={cx('overflow-hidden rounded-xl text-left ring-2 transition', sel === r ? 'ring-ink-100' : 'ring-transparent hover:ring-ink-600')} aria-pressed={sel === r}>
            <div className="h-14" style={{ background: rgbToHex(palette[r]) }} />
            <div className="bg-ink-800 px-1.5 py-1"><p className="truncate text-[10.5px] text-ink-200">{ROLE_LABEL[r]}</p><p className="font-mono text-[10px] text-ink-500">{rgbToHex(palette[r])}</p></div>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-[12px]">
        <Badge tone={textOnBg >= 4.5 ? 'ok' : 'bad'}>Text/background {textOnBg.toFixed(2)}:1</Badge>
        <Badge tone={accentOnBg >= 3 ? 'ok' : 'bad'}>Accent/background {accentOnBg.toFixed(2)}:1</Badge>
      </div>
      <ColourPicker value={palette[sel]} onChange={(c) => onChange({ ...palette, [sel]: c })} wheelSize={170} />
      {extra}
    </div>
  );
}

// ------------------------------------------------------------------ the advertisement

export type Product = 'headphones' | 'bottle' | 'shoe' | 'device' | 'garment' | 'poster';

function ProductArt({ kind, p }: { kind: Product; p: Palette }) {
  const prim = rgbToHex(p.primary), acc = rgbToHex(p.accent), surf = rgbToHex(p.surface), txt = rgbToHex(p.text);
  switch (kind) {
    case 'bottle':
      return (<g><rect x="250" y="120" width="70" height="40" rx="8" fill={acc} /><rect x="225" y="155" width="120" height="220" rx="26" fill={prim} /><rect x="240" y="230" width="90" height="70" rx="6" fill={surf} /><rect x="252" y="250" width="66" height="5" rx="2" fill={txt} opacity=".7" /><rect x="262" y="262" width="46" height="4" rx="2" fill={txt} opacity=".5" /></g>);
    case 'shoe':
      return (<g><path d="M150 330 Q160 260 230 255 L300 250 Q330 215 365 215 Q400 220 410 260 L420 310 Q430 335 405 340 L170 345 Q145 345 150 330 Z" fill={prim} /><path d="M150 335 L420 330 Q432 342 420 352 L165 356 Q145 352 150 335 Z" fill={surf} /><path d="M300 252 Q335 280 380 268" stroke={acc} strokeWidth="12" fill="none" strokeLinecap="round" /></g>);
    case 'device':
      return (<g><rect x="210" y="130" width="150" height="250" rx="24" fill={prim} /><rect x="222" y="148" width="126" height="214" rx="14" fill={surf} /><circle cx="285" cy="230" r="34" fill={acc} /><rect x="250" y="290" width="70" height="8" rx="4" fill={txt} opacity=".6" /></g>);
    case 'garment':
      return (<g><path d="M200 150 L250 130 Q285 160 320 130 L370 150 L410 210 L375 230 L360 210 L360 380 L210 380 L210 210 L195 230 L160 210 Z" fill={prim} /><path d="M250 130 Q285 175 320 130" stroke={acc} strokeWidth="8" fill="none" /><rect x="210" y="300" width="150" height="10" fill={acc} /></g>);
    case 'poster':
      return (<g><circle cx="285" cy="250" r="120" fill={prim} /><circle cx="330" cy="215" r="55" fill={acc} /><rect x="160" y="330" width="250" height="40" fill={surf} /></g>);
    default:
      return (<g><path d="M200 260 Q200 160 285 160 Q370 160 370 260" stroke={prim} strokeWidth="22" fill="none" strokeLinecap="round" /><rect x="178" y="245" width="52" height="95" rx="22" fill={prim} /><rect x="340" y="245" width="52" height="95" rx="22" fill={prim} /><rect x="188" y="262" width="32" height="60" rx="14" fill={acc} /><rect x="350" y="262" width="32" height="60" rx="14" fill={acc} /></g>);
  }
}

export interface AdCopy { brand: string; headline: string; sub: string; cta: string }
export function AdPreview({ p, product = 'headphones', copy, className }: { p: Palette; product?: Product; copy: AdCopy; className?: string }) {
  const bg = rgbToHex(p.background), txt = rgbToHex(p.text), acc = rgbToHex(p.accent), surf = rgbToHex(p.surface);
  const ctaText = contrastRatio([1, 1, 1], p.accent) >= contrastRatio([0.07, 0.07, 0.07], p.accent) ? '#ffffff' : '#111111';
  return (
    <svg viewBox="0 0 570 720" className={cx('w-full rounded-xl shadow-2xl shadow-black/40', className)} role="img" aria-label={`Advertisement for ${copy.brand} in the current palette`}>
      <rect width="570" height="720" fill={bg} />
      <circle cx="285" cy="255" r="175" fill={surf} />
      <ProductArt kind={product} p={p} />
      <text x="48" y="64" fill={txt} fontFamily="Inter Variable, sans-serif" fontSize="14" fontWeight="700" letterSpacing="4">{copy.brand.toUpperCase()}</text>
      <text x="48" y="520" fill={txt} fontFamily="Playfair Display Variable, serif" fontSize="46" fontWeight="700">{copy.headline}</text>
      <text x="48" y="560" fill={txt} fontFamily="Inter Variable, sans-serif" fontSize="17" opacity="0.85">{copy.sub}</text>
      <rect x="48" y="600" width={copy.cta.length * 10 + 56} height="54" rx="27" fill={acc} />
      <text x={48 + (copy.cta.length * 10 + 56) / 2} y="633" textAnchor="middle" fill={ctaText} fontFamily="Inter Variable, sans-serif" fontSize="16" fontWeight="600">{copy.cta}</text>
    </svg>
  );
}

/** Build a palette from hues: background muted/light, primary mid, accent vivid, text dark. */
export function paletteFromHues(hues: number[], opts: { dark?: boolean; mono?: boolean } = {}): Palette {
  const [h0, h1 = h0, h2 = h1] = hues;
  const hsl = (h: number, s: number, l: number): RGB => {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((wrapHue(h) / 60) % 2) - 1));
    const m = l - c / 2;
    const k = Math.floor(wrapHue(h) / 60);
    const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][k % 6];
    return [r + m, g + m, b + m];
  };
  if (opts.mono) return { background: hsl(h0, 0.35, opts.dark ? 0.12 : 0.93), surface: hsl(h0, 0.4, opts.dark ? 0.22 : 0.82), primary: hsl(h0, 0.55, 0.45), accent: hsl(h0, 0.75, opts.dark ? 0.62 : 0.32), text: hsl(h0, 0.3, opts.dark ? 0.94 : 0.12) };
  return {
    background: hsl(h0, 0.35, opts.dark ? 0.12 : 0.92),
    surface: hsl(h0, 0.45, opts.dark ? 0.2 : 0.8),
    primary: hsl(h1, 0.6, 0.45),
    accent: hsl(h2, 0.85, 0.52),
    text: hsl(h0, 0.25, opts.dark ? 0.94 : 0.12),
  };
}
