import { deltaE2000, hueDelta, rgbToLab, rgbToLch, type RGB } from '../lib/color';
import type { Frame } from './GradeEngine';
import type { UvRect } from './scenes';

export interface Histogram { r: Uint32Array; g: Uint32Array; b: Uint32Array; y: Uint32Array; total: number }

export function histogram(f: Frame): Histogram {
  const r = new Uint32Array(256), g = new Uint32Array(256), b = new Uint32Array(256), y = new Uint32Array(256);
  const d = f.data;
  for (let i = 0; i < d.length; i += 4) {
    r[d[i]]++; g[d[i + 1]]++; b[d[i + 2]]++;
    y[Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])]++;
  }
  return { r, g, b, y, total: d.length / 4 };
}

export interface ToneStats {
  /** Fraction of pixels with any channel at 255 (clipped highlights). */
  clipHi: number;
  /** Fraction of pixels with every channel at ≤ 2 (crushed shadows). */
  clipLo: number;
  mean: number;
  median: number;
  p02: number;
  p98: number;
  std: number;
}

export function toneStats(f: Frame): ToneStats {
  const d = f.data;
  const n = d.length / 4;
  let hi = 0, lo = 0, sum = 0, sum2 = 0;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const R = d[i], G = d[i + 1], B = d[i + 2];
    if (R >= 255 || G >= 255 || B >= 255) hi++;
    if (R <= 2 && G <= 2 && B <= 2) lo++;
    const Y = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255;
    sum += Y;
    sum2 += Y * Y;
    hist[Math.round(Y * 255)]++;
  }
  const pct = (q: number) => {
    let acc = 0;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= q * n) return i / 255; }
    return 1;
  };
  const mean = sum / n;
  return { clipHi: hi / n, clipLo: lo / n, mean, median: pct(0.5), p02: pct(0.02), p98: pct(0.98), std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)) };
}

/** Mean display-encoded colour (0..1) inside a top-down UV rectangle. */
export function regionMean(f: Frame, r: UvRect): RGB {
  const x0 = Math.max(0, Math.floor(r.u0 * f.width)), x1 = Math.min(f.width - 1, Math.ceil(r.u1 * f.width));
  const y0 = Math.max(0, Math.floor(r.v0 * f.height)), y1 = Math.min(f.height - 1, Math.ceil(r.v1 * f.height));
  let R = 0, G = 0, B = 0, n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * f.width + x) * 4;
    R += f.data[i]; G += f.data[i + 1]; B += f.data[i + 2]; n++;
  }
  n = Math.max(1, n);
  return [R / n / 255, G / n / 255, B / n / 255];
}

/** Mean ΔE2000 between two equally sized frames (sampled every `step` pixels). Grain is averaged out by a 2×2 box. */
export function meanDeltaE(a: Frame, b: Frame, step = 3): number {
  if (a.width !== b.width || a.height !== b.height) return NaN;
  let s = 0, n = 0;
  const px = (f: Frame, x: number, y: number): RGB => {
    let R = 0, G = 0, B = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const i = (Math.min(f.height - 1, y + dy) * f.width + Math.min(f.width - 1, x + dx)) * 4;
      R += f.data[i]; G += f.data[i + 1]; B += f.data[i + 2];
    }
    return [R / 1020, G / 1020, B / 1020];
  };
  for (let y = 0; y < a.height; y += step) for (let x = 0; x < a.width; x += step) {
    s += deltaE2000(rgbToLab(px(a, x, y)), rgbToLab(px(b, x, y)));
    n++;
  }
  return s / Math.max(1, n);
}

/** Rec.709 Y'CbCr of display-encoded RGB (0..1). */
export const ycbcr = (r: number, g: number, b: number) => {
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [y, (b - y) / 1.8556, (r - y) / 1.5748] as const;
};

/** Hue angle on a vectorscope (degrees, counter-clockwise from +Cb) and saturation (vector length). */
export function vectorscopeAngle(c: RGB) {
  const [, cb, cr] = ycbcr(c[0], c[1], c[2]);
  return { angle: ((Math.atan2(cr, cb) * 180) / Math.PI + 360) % 360, sat: Math.hypot(cb, cr) };
}
/** The skin-tone ("I") line sits at ~123° on a Rec.709 vectorscope, for every complexion. */
export const SKIN_LINE_DEG = 123;

/** Simple ΔE + hue report for a region compared with a target colour. */
export function compareColour(actual: RGB, target: RGB) {
  const la = rgbToLab(actual), lt = rgbToLab(target);
  const [La, Ca, ha] = rgbToLch(actual);
  const [Lt, Ct, ht] = rgbToLch(target);
  return { dE: deltaE2000(lt, la), dL: La - Lt, dC: Ca - Ct, dH: hueDelta(ht, ha) };
}

/** Chroma (C*ab) of a supposedly neutral region: 0 = perfectly neutral. */
export const neutralChroma = (c: RGB) => rgbToLch(c)[1];
