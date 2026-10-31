import { regionMean, toneStats, vectorscopeAngle, SKIN_LINE_DEG } from '../../engine/analysis';
import type { Frame } from '../../engine/GradeEngine';
import { chartPatchRects, REGIONS, sceneRectToUv, type UvRect } from '../../engine/scenes';
import { deltaE2000, hueDelta, rgbToLab, rgbToLch, type RGB, type Vec3 } from '../../lib/color';

export type Rect4 = [number, number, number, number];
export const uv = (r: Rect4, aspect = 3 / 2, frame?: [number, number, number]): UvRect => sceneRectToUv(r, aspect, frame);
export const meanRgb = (f: Frame, r: Rect4, aspect = 3 / 2, frame?: [number, number, number]): RGB => regionMean(f, uv(r, aspect, frame));
export const meanLab = (f: Frame, r: Rect4, aspect = 3 / 2, frame?: [number, number, number]): Vec3 => rgbToLab(meanRgb(f, r, aspect, frame));
export const meanLch = (f: Frame, r: Rect4, aspect = 3 / 2, frame?: [number, number, number]): Vec3 => rgbToLch(meanRgb(f, r, aspect, frame));
export const dE = (a: Vec3, b: Vec3) => deltaE2000(a, b);

/** Neutral error of the still-life reference: grey card and the five lighter greyscale patches. */
export function neutralReport(f: Frame, aspect = 3 / 2) {
  const card = meanLch(f, REGIONS.stilllife.card, aspect);
  const rects = chartPatchRects(aspect);
  const greys = [18, 19, 20, 21, 22].map((i) => rgbToLch(regionMean(f, rects[i])));
  const avgC = greys.reduce((a, g) => a + g[1], 0) / greys.length;
  return { cardC: card[1], cardL: card[0], cardHue: card[2], greysC: avgC, whiteL: greys[0][0] };
}

/** Where a skin sample sits on the vectorscope relative to the skin-tone line. */
export function skinReport(f: Frame, aspect = 3 / 2, frame?: [number, number, number]) {
  const samples = [REGIONS.portrait.forehead, REGIONS.portrait.cheekL, REGIONS.portrait.neck].map((r) => meanRgb(f, r, aspect, frame));
  const avg: RGB = [0, 1, 2].map((i) => samples.reduce((a, s) => a + s[i], 0) / samples.length) as RGB;
  const v = vectorscopeAngle(avg);
  const lch = rgbToLch(avg);
  return { rgb: avg, angle: v.angle, sat: v.sat, error: Math.abs(hueDelta(SKIN_LINE_DEG, v.angle)), L: lch[0], C: lch[1] };
}

/** Mean CIELAB of the brightest / darkest fraction of pixels (tonal-range colour). */
export function tonalColour(f: Frame, range: 'highlights' | 'shadows', fraction = 0.12): Vec3 {
  const d = f.data;
  const lum: number[] = [];
  for (let i = 0; i < d.length; i += 4) lum.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
  const sorted = [...lum].sort((a, b) => a - b);
  const n = sorted.length;
  const lo = range === 'highlights' ? sorted[Math.floor(n * (1 - fraction))] : sorted[Math.floor(n * 0.02)];
  const hi = range === 'highlights' ? sorted[Math.floor(n * 0.995)] : sorted[Math.floor(n * fraction)];
  let r = 0, g = 0, b = 0, k = 0;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    if (lum[j] >= lo && lum[j] <= hi) { r += d[i]; g += d[i + 1]; b += d[i + 2]; k++; }
  }
  k = Math.max(1, k);
  return rgbToLab([r / k / 255, g / k / 255, b / k / 255]);
}

export { toneStats };
export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

/** Average CIELAB over the frame (sampled), for overall colour tendencies of a look. */
export function frameLab(f: Frame, step = 3) {
  step = Math.max(1, Math.floor(step) || 3);
  let L = 0, a = 0, b = 0, C = 0, n = 0;
  for (let y = 0; y < f.height; y += step) for (let x = 0; x < f.width; x += step) {
    const i = (y * f.width + x) * 4;
    const lab = rgbToLab([f.data[i] / 255, f.data[i + 1] / 255, f.data[i + 2] / 255]);
    L += lab[0]; a += lab[1]; b += lab[2]; C += Math.hypot(lab[1], lab[2]); n++;
  }
  return { L: L / n, a: a / n, b: b / n, C: C / n };
}
