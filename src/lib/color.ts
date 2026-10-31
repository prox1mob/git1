/**
 * Colour science utilities.
 *
 * Conventions used throughout The Visual Lab:
 *  - "rgb"   : sRGB-encoded (display) values in 0..1, the numbers you see in HEX codes.
 *  - "lin"   : linear-light sRGB / Rec.709 primaries, D65 white, 0..1 (or above 1 for HDR scene values).
 *  - "xyz"   : CIE 1931 XYZ, D65, Y of reference white = 1.
 *  - "lab"   : CIE L*a*b* (1976) relative to D65.
 *  - "oklab" : Björn Ottosson's Oklab (2020), a perceptual space with better hue uniformity than CIELAB.
 */

export type Vec3 = [number, number, number];
export type RGB = Vec3;
export type Mat3 = [number, number, number, number, number, number, number, number, number]; // row-major

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;
export const wrapHue = (h: number) => ((h % 360) + 360) % 360;
/** Signed shortest angular distance from a to b, in degrees (-180..180]. */
export const hueDelta = (a: number, b: number) => {
  let d = wrapHue(b) - wrapHue(a);
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
};

// ---------------------------------------------------------------- transfer functions

/** sRGB EOTF⁻¹ … i.e. decode an sRGB-encoded value to linear light (IEC 61966-2-1). */
export function srgbToLinear(c: number): number {
  const a = Math.abs(c);
  const v = a <= 0.04045 ? a / 12.92 : Math.pow((a + 0.055) / 1.055, 2.4);
  return c < 0 ? -v : v;
}
/** Encode linear light with the sRGB curve (piecewise: linear toe + 1/2.4 power). */
export function linearToSrgb(c: number): number {
  const a = Math.abs(c);
  const v = a <= 0.0031308 ? a * 12.92 : 1.055 * Math.pow(a, 1 / 2.4) - 0.055;
  return c < 0 ? -v : v;
}
export const rgbToLin = (c: RGB): Vec3 => [srgbToLinear(c[0]), srgbToLinear(c[1]), srgbToLinear(c[2])];
export const linToRgb = (c: Vec3): RGB => [linearToSrgb(c[0]), linearToSrgb(c[1]), linearToSrgb(c[2])];

/** ITU-R BT.709 camera OETF (scene light → video signal). */
export function rec709Oetf(l: number): number {
  return l < 0.018 ? 4.5 * l : 1.099 * Math.pow(l, 0.45) - 0.099;
}
/** ITU-R BT.1886 reference display EOTF with a zero black level (pure 2.4 power). */
export const bt1886Eotf = (v: number) => Math.pow(clamp01(v), 2.4);
export const pureGamma = (v: number, g: number) => Math.pow(clamp01(v), g);

// ---- Camera log curves (published transfer functions; gamut conversion intentionally omitted)

export type LogCurveId = 'slog3' | 'logc3' | 'vlog';
export const LOG_CURVES: Record<LogCurveId, { name: string; maker: string; encode: (x: number) => number; decode: (y: number) => number }> = {
  slog3: {
    name: 'S-Log3',
    maker: 'Sony',
    encode: (x) =>
      x >= 0.01125
        ? (420 + Math.log10((x + 0.01) / (0.18 + 0.01)) * 261.5) / 1023
        : (x * (171.2102946929 - 95) / 0.01125 + 95) / 1023,
    decode: (y) =>
      y >= 171.2102946929 / 1023
        ? Math.pow(10, (y * 1023 - 420) / 261.5) * (0.18 + 0.01) - 0.01
        : ((y * 1023 - 95) * 0.01125) / (171.2102946929 - 95),
  },
  logc3: {
    name: 'LogC3 (EI 800)',
    maker: 'ARRI',
    encode: (x) => (x > 0.010591 ? 0.24719 * Math.log10(5.555556 * x + 0.052272) + 0.385537 : 5.367655 * x + 0.092809),
    decode: (t) => (t > 5.367655 * 0.010591 + 0.092809 ? (Math.pow(10, (t - 0.385537) / 0.24719) - 0.052272) / 5.555556 : (t - 0.092809) / 5.367655),
  },
  vlog: {
    name: 'V-Log',
    maker: 'Panasonic',
    encode: (x) => (x < 0.01 ? 5.6 * x + 0.125 : 0.241514 * Math.log10(x + 0.00873) + 0.598206),
    decode: (y) => (y < 0.181 ? (y - 0.125) / 5.6 : Math.pow(10, (y - 0.598206) / 0.241514) - 0.00873),
  },
};

// ---------------------------------------------------------------- HEX / HSL / HSV

export function hexToRgb(hex: string): RGB | null {
  let h = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export const to255 = (v: number) => Math.round(clamp01(v) * 255);
export function rgbToHex(c: RGB): string {
  return '#' + c.map((v) => to255(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}
export const rgbCss = (c: RGB) => `rgb(${to255(c[0])} ${to255(c[1])} ${to255(c[2])})`;

/** HSL with h in degrees, s and l in 0..1. */
export function rgbToHsl([r, g, b]: RGB): Vec3 {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [wrapHue(h * 60), clamp01(s), l];
}
export function hslToRgb([h, s, l]: Vec3): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = wrapHue(h) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [clamp01(r + m), clamp01(g + m), clamp01(b + m)];
}
export function rgbToHsv([r, g, b]: RGB): Vec3 {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [wrapHue(h * 60), s, max];
}
export function hsvToRgb([h, s, v]: Vec3): RGB {
  const l = v * (1 - s / 2);
  const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return hslToRgb([h, sl, l]);
}

// ---------------------------------------------------------------- matrices

export const mat3Mul = (a: Mat3, b: Mat3): Mat3 => {
  const r = new Array(9).fill(0) as Mat3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
};
export const mat3Apply = (m: Mat3, v: Vec3): Vec3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
export function mat3Inv(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const k = 1 / det;
  return [A * k, -(b * i - c * h) * k, (b * f - c * e) * k, B * k, (a * i - c * g) * k, -(a * f - c * d) * k, C * k, -(a * h - b * g) * k, (a * e - b * d) * k];
}
export const IDENTITY3: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** Column-major copy for WebGL uniformMatrix3fv. */
export const mat3ToGl = (m: Mat3) => new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);

export const LIN_SRGB_TO_XYZ: Mat3 = [0.4124564, 0.3575761, 0.1804375, 0.2126729, 0.7151522, 0.072175, 0.0193339, 0.119192, 0.9503041];
export const XYZ_TO_LIN_SRGB: Mat3 = mat3Inv(LIN_SRGB_TO_XYZ);
const BRADFORD: Mat3 = [0.8951, 0.2664, -0.1614, -0.7502, 1.7135, 0.0367, 0.0389, -0.0685, 1.0296];
const BRADFORD_INV = mat3Inv(BRADFORD);

// ---------------------------------------------------------------- XYZ / Lab / LCh

export const D65: Vec3 = [0.95047, 1.0, 1.08883];
export const linToXyz = (c: Vec3) => mat3Apply(LIN_SRGB_TO_XYZ, c);
export const xyzToLin = (c: Vec3) => mat3Apply(XYZ_TO_LIN_SRGB, c);

const LAB_E = 216 / 24389;
const LAB_K = 24389 / 27;
export function xyzToLab([x, y, z]: Vec3, white: Vec3 = D65): Vec3 {
  const f = (t: number) => (t > LAB_E ? Math.cbrt(t) : (LAB_K * t + 16) / 116);
  const fx = f(x / white[0]), fy = f(y / white[1]), fz = f(z / white[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function labToXyz([L, a, b]: Vec3, white: Vec3 = D65): Vec3 {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (f: number) => (f ** 3 > LAB_E ? f ** 3 : (116 * f - 16) / LAB_K);
  return [inv(fx) * white[0], (L > LAB_K * LAB_E ? fy ** 3 : L / LAB_K) * white[1], inv(fz) * white[2]];
}
export const rgbToLab = (c: RGB) => xyzToLab(linToXyz(rgbToLin(c)));
export const labToRgb = (lab: Vec3): RGB => linToRgb(xyzToLin(labToXyz(lab)));
export function labToLch([L, a, b]: Vec3): Vec3 {
  return [L, Math.hypot(a, b), wrapHue(deg(Math.atan2(b, a)))];
}
export function lchToLab([L, C, h]: Vec3): Vec3 {
  return [L, C * Math.cos(rad(h)), C * Math.sin(rad(h))];
}
export const rgbToLch = (c: RGB) => labToLch(rgbToLab(c));
export const inGamut = (c: Vec3, eps = 1e-4) => c.every((v) => v >= -eps && v <= 1 + eps);

// ---------------------------------------------------------------- Oklab

export function linToOklab([r, g, b]: Vec3): Vec3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
export function oklabToLin([L, a, b]: Vec3): Vec3 {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
export const rgbToOklch = (c: RGB): Vec3 => {
  const [L, a, b] = linToOklab(rgbToLin(c));
  return [L, Math.hypot(a, b), wrapHue(deg(Math.atan2(b, a)))];
};
export const oklchToRgb = ([L, C, h]: Vec3): RGB => linToRgb(oklabToLin([L, C * Math.cos(rad(h)), C * Math.sin(rad(h))]));
/** Reduce chroma until an OkLCh colour fits inside the sRGB gamut (simple bisection). */
export function oklchToRgbGamut([L, C, h]: Vec3): RGB {
  let lo = 0, hi = C;
  const test = (c: number) => oklabToLin([L, c * Math.cos(rad(h)), c * Math.sin(rad(h))]);
  if (inGamut(test(C))) return linToRgb(test(C)).map(clamp01) as RGB;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(test(mid))) lo = mid; else hi = mid;
  }
  return linToRgb(test(lo)).map(clamp01) as RGB;
}

// ---------------------------------------------------------------- colour difference

export const deltaE76 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** CIEDE2000 colour difference (Sharma, Wu & Dalal 2005 implementation notes). */
export function deltaE2000(lab1: Vec3, lab2: Vec3, kL = 1, kC = 1, kH = 1): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hp = (b: number, a: number) => (b === 0 && a === 0 ? 0 : wrapHue(deg(Math.atan2(b, a))));
  const h1p = hp(b1, a1p), h2p = hp(b2, a2p);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));
  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp: number;
  if (C1p * C2p === 0) hbarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
  else hbarp = (h1p + h2p - 360) / 2;
  const T =
    1 - 0.17 * Math.cos(rad(hbarp - 30)) + 0.24 * Math.cos(rad(2 * hbarp)) + 0.32 * Math.cos(rad(3 * hbarp + 6)) - 0.2 * Math.cos(rad(4 * hbarp - 63));
  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;
  const l = dLp / (kL * Sl), c = dCp / (kC * Sc), h = dHp / (kH * Sh);
  return Math.sqrt(l * l + c * c + h * h + Rt * c * h);
}
export const deltaERgb = (a: RGB, b: RGB) => deltaE2000(rgbToLab(a), rgbToLab(b));

/** Rough, widely-quoted interpretation bands for ΔE2000. Viewing conditions change these. */
export function describeDeltaE(dE: number): string {
  if (dE < 1) return 'Imperceptible to most people';
  if (dE < 2) return 'Visible only on close inspection';
  if (dE < 3.5) return 'Visible at a glance to a trained eye';
  if (dE < 5) return 'A clear difference';
  if (dE < 10) return 'Related, but clearly different colours';
  return 'Different colours';
}

// ---------------------------------------------------------------- WCAG contrast

/** WCAG 2.x relative luminance (uses the sRGB decode curve). */
export function relativeLuminance(c: RGB): number {
  const [r, g, b] = rgbToLin(c.map(clamp01) as RGB);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
export interface WcagResult { ratio: number; aaNormal: boolean; aaLarge: boolean; aaaNormal: boolean; aaaLarge: boolean; nonText: boolean }
export function wcag(fg: RGB, bg: RGB): WcagResult {
  const ratio = contrastRatio(fg, bg);
  return { ratio, aaNormal: ratio >= 4.5, aaLarge: ratio >= 3, aaaNormal: ratio >= 7, aaaLarge: ratio >= 4.5, nonText: ratio >= 3 };
}

// ---------------------------------------------------------------- correlated colour temperature & white balance

/** Planckian locus chromaticity (Kim et al. / Kang 2002 cubic approximation), valid 1667–25000 K. */
export function cctToXy(T: number): [number, number] {
  const t = clamp(T, 1667, 25000);
  const x =
    t <= 4000
      ? -0.2661239e9 / t ** 3 - 0.2343589e6 / t ** 2 + 0.8776956e3 / t + 0.17991
      : -3.0258469e9 / t ** 3 + 2.1070379e6 / t ** 2 + 0.2226347e3 / t + 0.24039;
  const y =
    t <= 2222
      ? -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683
      : t <= 4000
        ? -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867
        : 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483;
  return [x, y];
}
const xyToUv = (x: number, y: number) => {
  const d = -2 * x + 12 * y + 3;
  return [(4 * x) / d, (6 * y) / d] as [number, number];
};
const uvToXy = (u: number, v: number) => {
  const d = 2 * u - 8 * v + 4;
  return [(3 * u) / d, (2 * v) / d] as [number, number];
};
/** White point for a colour temperature and a tint (tint ±100 ≈ ±0.02 Δuv; positive = greener light). */
export function whitePointXyz(T: number, tint: number): Vec3 {
  const [x0, y0] = cctToXy(T);
  const [u0, v0] = xyToUv(x0, y0);
  const [x1, y1] = cctToXy(T * 1.01);
  const [u1, v1] = xyToUv(x1, y1);
  let nx = -(v1 - v0), ny = u1 - u0;
  const len = Math.hypot(nx, ny) || 1;
  nx /= len; ny /= len;
  if (ny < 0) { nx = -nx; ny = -ny; } // orient toward +v (green)
  const duv = (tint / 100) * 0.02;
  const [x, y] = uvToXy(u0 + nx * duv, v0 + ny * duv);
  return [x / y, 1, (1 - x - y) / y];
}
export const NEUTRAL_TEMP = 6504;
/**
 * White-balance correction matrix (linear sRGB → linear sRGB), Bradford chromatic adaptation
 * from the assumed scene illuminant (T, tint) to the reference white (6504 K on the same locus model).
 * Lowering T tells the software "the light was warmer", so it cools the image — exactly like Lightroom/Camera Raw.
 */
export function whiteBalanceMatrix(T: number, tint: number): Mat3 {
  const src = whitePointXyz(T, tint);
  const dst = whitePointXyz(NEUTRAL_TEMP, 0);
  const ls = mat3Apply(BRADFORD, src), ld = mat3Apply(BRADFORD, dst);
  const D: Mat3 = [ld[0] / ls[0], 0, 0, 0, ld[1] / ls[1], 0, 0, 0, ld[2] / ls[2]];
  const cat = mat3Mul(BRADFORD_INV, mat3Mul(D, BRADFORD));
  return mat3Mul(XYZ_TO_LIN_SRGB, mat3Mul(cat, LIN_SRGB_TO_XYZ));
}
/** The colour cast a camera would record if the light were (T, tint) but the camera assumed daylight. */
export const castMatrix = (T: number, tint: number) => mat3Inv(whiteBalanceMatrix(T, tint));

/** Find the temperature/tint that makes a linear sample neutral (used by the white-balance eyedropper). */
export function solveWhiteBalance(sample: Vec3): { temp: number; tint: number } {
  const err = (T: number, tint: number) => {
    const [r, g, b] = mat3Apply(whiteBalanceMatrix(T, tint), sample);
    const s = (r + g + b) / 3 || 1e-6;
    return ((r - s) / s) ** 2 + ((g - s) / s) ** 2 + ((b - s) / s) ** 2;
  };
  let best = { temp: NEUTRAL_TEMP, tint: 0, e: Infinity };
  for (let lt = Math.log(2000); lt <= Math.log(15000); lt += 0.04) {
    for (let tn = -100; tn <= 100; tn += 5) {
      const e = err(Math.exp(lt), tn);
      if (e < best.e) best = { temp: Math.exp(lt), tint: tn, e };
    }
  }
  let step = { t: 0.03, n: 4 };
  for (let it = 0; it < 40; it++) {
    let improved = false;
    for (const [dt, dn] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const T = Math.exp(Math.log(best.temp) + dt * step.t);
      const n = clamp(best.tint + dn * step.n, -100, 100);
      const e = err(T, n);
      if (e < best.e) { best = { temp: T, tint: n, e }; improved = true; }
    }
    if (!improved) step = { t: step.t / 2, n: step.n / 2 };
  }
  return { temp: Math.round(clamp(best.temp, 2000, 15000)), tint: Math.round(best.tint) };
}

// ---------------------------------------------------------------- perception helpers

/** Broad hue-family names on the CIELAB hue circle (degrees). */
const LAB_HUE_NAMES: [number, string][] = [
  [0, 'pink-red'], [25, 'red'], [50, 'orange'], [75, 'amber'], [95, 'yellow'], [120, 'yellow-green'], [150, 'green'],
  [190, 'teal'], [225, 'cyan-blue'], [265, 'blue'], [295, 'violet'], [325, 'magenta'], [350, 'pink'],
];
export function hueName(labHue: number): string {
  const h = wrapHue(labHue);
  let best = LAB_HUE_NAMES[0];
  let bd = 999;
  for (const e of LAB_HUE_NAMES) {
    const d = Math.abs(hueDelta(e[0], h));
    if (d < bd) { bd = d; best = e; }
  }
  return best[1];
}

/** Warm / cool / neutral classification based on CIELAB chroma and hue angle. */
export type Temperature = 'warm' | 'cool' | 'neutral';
export function temperatureOf(c: RGB): Temperature {
  const [, C, h] = rgbToLch(c);
  if (C < 12) return 'neutral';
  // reds, oranges, yellows and warm pinks ≈ 0–100° and 330–360°; greens→blues→violets ≈ 140–310°
  if (h < 105 || h >= 335) return 'warm';
  if (h >= 140 && h < 310) return 'cool';
  // yellow-greens and magentas sit on the fence: decide by which side they lean toward
  return h < 140 ? (h < 120 ? 'warm' : 'cool') : h < 322 ? 'cool' : 'warm';
}

export interface DiffDiagnosis { dE: number; dL: number; dC: number; dH: number; notes: string[] }
/** Human-readable diagnosis of how `actual` differs from `target`. */
export function diagnoseDifference(target: RGB, actual: RGB): DiffDiagnosis {
  const lt = rgbToLab(target), la = rgbToLab(actual);
  const [Lt, Ct, ht] = labToLch(lt);
  const [La, Ca, ha] = labToLch(la);
  const dE = deltaE2000(lt, la);
  const dL = La - Lt, dC = Ca - Ct, dH = hueDelta(ht, ha);
  const notes: string[] = [];
  if (Math.abs(dL) >= 1.5) notes.push(dL > 0 ? `About ${Math.abs(dL).toFixed(0)} L* too light — lower the lightness.` : `About ${Math.abs(dL).toFixed(0)} L* too dark — raise the lightness.`);
  if (Math.abs(dC) >= 2.5) notes.push(dC > 0 ? 'Too saturated (too much chroma) — pull saturation back.' : 'Not saturated enough — the target is more vivid.');
  if (Ct > 8 && Ca > 4 && Math.abs(dH) >= 3) {
    const toward = hueName(ha + Math.sign(dH) * 25);
    const back = hueName(ht - Math.sign(dH) * 25);
    notes.push(`Hue leans ${Math.abs(dH).toFixed(0)}° toward ${toward}; rotate back toward ${back}.`);
  }
  if (!notes.length) notes.push('Lightness, chroma and hue are all very close.');
  return { dE, dL, dC, dH, notes };
}

/** Maps a measured error onto a 0–100 score: full marks up to `full`, zero at `zero`, eased in between. */
export function errorToScore(err: number, full: number, zero: number): number {
  if (err <= full) return 100;
  if (err >= zero) return 0;
  const t = (err - full) / (zero - full);
  return Math.round(100 * (1 - t) ** 1.25);
}
/** Score how close a value is to a target range. */
export function rangeScore(v: number, lo: number, hi: number, falloff: number): number {
  if (v >= lo && v <= hi) return 100;
  const d = v < lo ? lo - v : v - hi;
  return Math.round(100 * Math.max(0, 1 - d / falloff));
}
