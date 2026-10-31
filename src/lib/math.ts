import type { Difficulty, Vec3 } from './types';

export const DEG = Math.PI / 180;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const round = (v: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};
export const snap = (v: number, step: number) => (step > 0 ? Math.round(v / step) * step : v);
export const fmt = (v: number, d = 1) => {
  const r = round(v, d);
  return Object.is(r, -0) ? '0' : r.toLocaleString('en-US', { maximumFractionDigits: d });
};
export const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const normAngleDeg = (a: number) => {
  let x = a % 360;
  if (x > 180) x -= 360;
  if (x <= -180) x += 360;
  return x;
};
export const angleDiffDeg = (a: number, b: number) => Math.abs(normAngleDeg(a - b));

/** Relative tolerance for dimension checks by difficulty. */
export const relTol = (d: Difficulty) => (d === 'beginner' ? 0.08 : d === 'intermediate' ? 0.04 : 0.02);
/** Absolute positional tolerance in millimetres. */
export const absTol = (d: Difficulty) => (d === 'beginner' ? 4 : d === 'intermediate' ? 2 : 1);
/** Angular tolerance in degrees. */
export const angTol = (d: Difficulty) => (d === 'beginner' ? 6 : d === 'intermediate' ? 3 : 1.5);

/** 100 when error <= tol, decreasing linearly to 0 at 5*tol. */
export function scoreFromError(err: number, tol: number) {
  if (!isFinite(err)) return 0;
  if (err <= tol) return 100;
  return clamp(100 * (1 - (err - tol) / (4 * tol)), 0, 100);
}

export function mean(xs: number[]) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const uid = () => Math.random().toString(36).slice(2, 10);

export type LengthUnit = 'mm' | 'cm' | 'm' | 'in';
export const UNIT_TO_MM: Record<LengthUnit, number> = { mm: 1, cm: 10, m: 1000, in: 25.4 };
export const toUnit = (mm: number, u: LengthUnit) => mm / UNIT_TO_MM[u];
export const fromUnit = (v: number, u: LengthUnit) => v * UNIT_TO_MM[u];
export const fmtLen = (mm: number, u: LengthUnit = 'mm') => {
  const d = u === 'mm' ? 1 : u === 'cm' ? 2 : u === 'm' ? 4 : 3;
  return `${fmt(toUnit(mm, u), d)} ${u}`;
};
