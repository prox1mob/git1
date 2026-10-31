import { castMatrix, IDENTITY3, solveWhiteBalance, whiteBalanceMatrix, type Mat3, type Vec3 } from '../lib/color';

/** A colour wheel's state: puck position in the unit disc plus a master (luminance) ring value. */
export interface Wheel { x: number; y: number; m: number }
export interface CurvePoint { x: number; y: number }
export interface Curves { master: CurvePoint[]; r: CurvePoint[]; g: CurvePoint[]; b: CurvePoint[] }
export interface HslBand { h: number; s: number; l: number }

export const HSL_BANDS = [
  { id: 'red', label: 'Red', hue: 29, swatch: '#e2453c' },
  { id: 'orange', label: 'Orange', hue: 60, swatch: '#ec8a3a' },
  { id: 'yellow', label: 'Yellow', hue: 105, swatch: '#e6cf3a' },
  { id: 'green', label: 'Green', hue: 142, swatch: '#4fb04a' },
  { id: 'aqua', label: 'Aqua', hue: 195, swatch: '#3fbfc4' },
  { id: 'blue', label: 'Blue', hue: 255, swatch: '#3d6fe0' },
  { id: 'purple', label: 'Purple', hue: 295, swatch: '#8c4fd6' },
  { id: 'magenta', label: 'Magenta', hue: 330, swatch: '#d64fb0' },
] as const;

/**
 * Every adjustment the engine understands. Processing order (see grade.ts):
 *  scene-linear: white balance → exposure → halation → vignette → log contrast → highlights/shadows
 *  display transform: per-channel shoulder (roll-off) → sRGB encode
 *  display-referred: whites/blacks → power gamma → lift/gamma/gain → curves → Oklab HSL/saturation/density → fade → grain
 */
export interface GradeParams {
  temp: number; // assumed scene illuminant, K
  tint: number; // -100..100 (+ = light was greener, so the fix adds magenta)
  exposure: number; // stops
  contrast: number; // -1..1, log-space contrast around 18% grey
  highlights: number; // -1..1
  shadows: number; // -1..1
  whites: number; // -1..1
  blacks: number; // -1..1
  rolloff: number; // 0 = hard clip, 1 = very soft highlight shoulder
  gamma: number; // pure power-law γ applied to display values: out = in^(1/γ)
  lift: Wheel;
  gammaW: Wheel;
  gain: Wheel;
  curves: Curves;
  hsl: HslBand[];
  saturation: number; // multiplier, 1 = unchanged
  vibrance: number; // -1..1
  density: number; // 0..1 subtractive colour density (film-like)
  halation: number; // 0..1
  grain: number; // 0..1
  grainSize: number; // px
  vignette: number; // -1..1
  fade: number; // 0..1 lifted blacks
}

export const W0: Wheel = { x: 0, y: 0, m: 0 };
export const IDENTITY_CURVE: CurvePoint[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
export const identityCurves = (): Curves => ({ master: [...IDENTITY_CURVE], r: [...IDENTITY_CURVE], g: [...IDENTITY_CURVE], b: [...IDENTITY_CURVE] });

export const defaultParams = (over: Partial<GradeParams> = {}): GradeParams => ({
  temp: 6504, tint: 0, exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  rolloff: 0.5, gamma: 1,
  lift: { ...W0 }, gammaW: { ...W0 }, gain: { ...W0 },
  curves: identityCurves(),
  hsl: HSL_BANDS.map(() => ({ h: 0, s: 0, l: 0 })),
  saturation: 1, vibrance: 0, density: 0, halation: 0, grain: 0, grainSize: 1.6, vignette: 0, fade: 0,
  ...over,
});

/** The "problem" baked into the captured footage: a cast, an exposure error, sensor clipping or noise. */
export interface CaptureSpec {
  exposure?: number;
  castTemp?: number;
  castTint?: number;
  clip?: number;
  noise?: number;
}

export type SourceSpec =
  | { kind: 'scene'; scene: SceneId; variant?: number; params?: [number, number, number, number]; frame?: [number, number, number] }
  | { kind: 'image'; image: TexImageSource; key: string }
  | { kind: 'video'; video: HTMLVideoElement; key: string };

export type SceneId = 'coast' | 'portrait' | 'street' | 'facade' | 'stilllife' | 'sneaker' | 'bars';

export interface SignalSpec {
  /** Simulate a camera that recorded Log: encode with `logSrc`, then view raw or decode with `logDst`. */
  log?: { src: 0 | 1 | 2; dst: 0 | 1 | 2; viewRaw: boolean };
  /** Teaching aid: 1 = show linear light with no encoding, 2 = encode twice. */
  debugTransfer?: 0 | 1 | 2;
}

export interface ViewSpec {
  mode: 'graded' | 'before' | 'split';
  split: number;
  clipWarn: boolean;
  showLost: boolean;
  signal?: SignalSpec;
}
export const defaultView = (over: Partial<ViewSpec> = {}): ViewSpec => ({ mode: 'graded', split: 0.5, clipWarn: false, showLost: false, ...over });

// ---------------------------------------------------------------- derived values

/** Luminance-neutral RGB direction for a wheel puck, oriented like a Rec.709 vectorscope. */
export function wheelVector(x: number, y: number): Vec3 {
  const cb = 0.5 * x, cr = 0.5 * y;
  return [1.5748 * cr, -0.1873 * cb - 0.4681 * cr, 1.8556 * cb];
}
export function liftVec(w: Wheel): Vec3 {
  const v = wheelVector(w.x, w.y);
  return v.map((c) => w.m * 0.2 + c * 0.16) as Vec3;
}
export function gainVec(w: Wheel): Vec3 {
  const v = wheelVector(w.x, w.y);
  return v.map((c) => 1 + w.m * 0.6 + c * 0.38) as Vec3;
}
export function gammaVec(w: Wheel): Vec3 {
  const v = wheelVector(w.x, w.y);
  return v.map((c) => Math.pow(2, -(w.m * 0.9 + c * 0.55))) as Vec3;
}
export const contrastFactor = (c: number) => Math.pow(2, c * 0.85);
export const kneeFor = (rolloff: number) => 1 - 0.55 * Math.max(0, Math.min(1, rolloff));

export function captureMatrix(c: CaptureSpec): Mat3 {
  if (c.castTemp === undefined && c.castTint === undefined) return IDENTITY3;
  return castMatrix(c.castTemp ?? 6504, c.castTint ?? 0);
}
export const wbMatrix = (p: GradeParams) => whiteBalanceMatrix(p.temp, p.tint);

/** Monotone cubic (Fritsch–Carlson) interpolation through curve points → n samples. */
export function bakeCurve(pts: CurvePoint[], n = 1024): Float32Array {
  const p = [...pts].sort((a, b) => a.x - b.x);
  const out = new Float32Array(n);
  if (p.length < 2) { for (let i = 0; i < n; i++) out[i] = i / (n - 1); return out; }
  const k = p.length;
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < k - 1; i++) {
    dx.push(Math.max(1e-6, p[i + 1].x - p[i].x));
    m.push((p[i + 1].y - p[i].y) / dx[i]);
  }
  const t: number[] = new Array(k);
  t[0] = m[0];
  t[k - 1] = m[k - 2];
  for (let i = 1; i < k - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < k - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) { const tau = 3 / Math.sqrt(s); t[i] = tau * a * m[i]; t[i + 1] = tau * b * m[i]; }
  }
  let seg = 0;
  for (let j = 0; j < n; j++) {
    const x = j / (n - 1);
    if (x <= p[0].x) { out[j] = p[0].y; continue; }
    if (x >= p[k - 1].x) { out[j] = p[k - 1].y; continue; }
    while (seg < k - 2 && x > p[seg + 1].x) seg++;
    const h = dx[seg];
    const s = (x - p[seg].x) / h;
    const s2 = s * s, s3 = s2 * s;
    out[j] = (2 * s3 - 3 * s2 + 1) * p[seg].y + (s3 - 2 * s2 + s) * h * t[seg] + (-2 * s3 + 3 * s2) * p[seg + 1].y + (s3 - s2) * h * t[seg + 1];
  }
  return out;
}
export const isIdentityCurve = (pts: CurvePoint[]) => pts.length === 2 && pts[0].x === 0 && pts[0].y === 0 && pts[1].x === 1 && pts[1].y === 1;
export const curvesActive = (c: Curves) => !(isIdentityCurve(c.master) && isIdentityCurve(c.r) && isIdentityCurve(c.g) && isIdentityCurve(c.b));
export const colorActive = (p: GradeParams) => p.saturation !== 1 || p.vibrance !== 0 || p.density !== 0 || p.hsl.some((b) => b.h || b.s || b.l);

/** Deep-ish clone so lessons can store snapshots of params safely. */
export const cloneParams = (p: GradeParams): GradeParams => JSON.parse(JSON.stringify(p));

/** White-balance eyedropper: the temperature/tint that makes a sampled scene-linear colour neutral. */
export const solveWbFromSample = (s: Vec3) => solveWhiteBalance(s);
