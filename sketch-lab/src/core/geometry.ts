/** Small, dependency-free maths helpers shared by every tool. All angles in degrees unless named *Rad. */

export interface Vec {
  x: number;
  y: number;
}

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec) => a.x * b.y - a.y * b.x;
export const len = (a: Vec) => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpV = (a: Vec, b: Vec, t: number): Vec => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const snap = (x: number, step: number) => (step > 0 ? Math.round(x / step) * step : x);
export const snapV = (p: Vec, step: number): Vec => ({ x: snap(p.x, step), y: snap(p.y, step) });
export const degToRad = (d: number) => (d * Math.PI) / 180;
export const radToDeg = (r: number) => (r * 180) / Math.PI;

export function norm(a: Vec): Vec {
  const l = len(a);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

export function rotate(p: Vec, deg: number, about: Vec = { x: 0, y: 0 }): Vec {
  const r = degToRad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const d = sub(p, about);
  return { x: about.x + d.x * c - d.y * s, y: about.y + d.x * s + d.y * c };
}

/** Point at a given angle (maths convention: 0° = right, counter-clockwise positive) on screen where y grows downward. */
export function polar(center: Vec, r: number, deg: number): Vec {
  const a = degToRad(deg);
  return { x: center.x + r * Math.cos(a), y: center.y - r * Math.sin(a) };
}

/** Direction of a screen vector in maths convention (y up), 0..360. */
export function headingDeg(from: Vec, to: Vec): number {
  const a = radToDeg(Math.atan2(-(to.y - from.y), to.x - from.x));
  return (a + 360) % 360;
}

/** Counter-clockwise angle from ray (vertex→a) to ray (vertex→b), 0..360. */
export function ccwAngle(a: Vec, vertex: Vec, b: Vec): number {
  return (headingDeg(vertex, b) - headingDeg(vertex, a) + 360) % 360;
}

/** The smaller angle between rays vertex→a and vertex→b, 0..180. */
export function angleAt(a: Vec, vertex: Vec, b: Vec): number {
  const u = sub(a, vertex);
  const w = sub(b, vertex);
  const l = len(u) * len(w);
  if (l === 0) return 0;
  return radToDeg(Math.acos(clamp(dot(u, w) / l, -1, 1)));
}

/** Angle between two lines (not rays), 0..90. */
export function lineAngle(a1: Vec, a2: Vec, b1: Vec, b2: Vec): number {
  const t = angleAt(add(b1, sub(a2, a1)), b1, b2);
  return t > 90 ? 180 - t : t;
}

export function signedArea(pts: Vec[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/** Shoelace area of a simple polygon (always positive). */
export const polygonArea = (pts: Vec[]) => Math.abs(signedArea(pts));

export function perimeter(pts: Vec[], closed = true): number {
  let s = 0;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) s += dist(pts[i], pts[(i + 1) % pts.length]);
  return s;
}

export function sideLengths(pts: Vec[]): number[] {
  return pts.map((p, i) => dist(p, pts[(i + 1) % pts.length]));
}

/** Interior angle at every vertex of a simple polygon (handles reflex corners). */
export function interiorAngles(pts: Vec[]): number[] {
  const orient = Math.sign(signedArea(pts)) || 1;
  return pts.map((p, i) => {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const next = pts[(i + 1) % pts.length];
    const a = angleAt(prev, p, next);
    const turn = cross(sub(p, prev), sub(next, p));
    // In a convex corner the path turns the same way as the polygon's orientation.
    return Math.sign(turn) === orient || turn === 0 ? a : 360 - a;
  });
}

export function centroid(pts: Vec[]): Vec {
  const n = pts.length || 1;
  return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
}

export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 === 0) return dist(p, a);
  const t = clamp(dot(sub(p, a), ab) / l2, 0, 1);
  return dist(p, add(a, scale(ab, t)));
}

export function pointInPolygon(p: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Do segments p1p2 and p3p4 properly cross? */
export function segmentsCross(p1: Vec, p2: Vec, p3: Vec, p4: Vec): boolean {
  const d1 = cross(sub(p4, p3), sub(p1, p3));
  const d2 = cross(sub(p4, p3), sub(p2, p3));
  const d3 = cross(sub(p2, p1), sub(p3, p1));
  const d4 = cross(sub(p2, p1), sub(p4, p1));
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export function isSelfIntersecting(pts: Vec[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Intersection of infinite lines a1a2 and b1b2 (null when parallel). */
export function lineIntersection(a1: Vec, a2: Vec, b1: Vec, b2: Vec): Vec | null {
  const r = sub(a2, a1);
  const s = sub(b2, b1);
  const d = cross(r, s);
  if (Math.abs(d) < 1e-9) return null;
  const t = cross(sub(b1, a1), s) / d;
  return add(a1, scale(r, t));
}

/** Circle through three points (null when they are in a straight line). */
export function circleFrom3(a: Vec, b: Vec, c: Vec): { c: Vec; r: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const ux = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const uy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  const center = { x: ux, y: uy };
  return { c: center, r: dist(center, a) };
}

/** Least-squares circle fit (Kåsa method). */
export function fitCircle(pts: Vec[]): { c: Vec; r: number; error: number } {
  const m = centroid(pts);
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const p of pts) {
    const u = p.x - m.x;
    const w = p.y - m.y;
    suu += u * u; svv += w * w; suv += u * w;
    suuu += u * u * u; svvv += w * w * w; suvv += u * w * w; svuu += w * u * u;
  }
  const det = suu * svv - suv * suv;
  let c = m;
  if (Math.abs(det) > 1e-9) {
    const b1 = (suuu + suvv) / 2;
    const b2 = (svvv + svuu) / 2;
    c = { x: m.x + (b1 * svv - b2 * suv) / det, y: m.y + (suu * b2 - suv * b1) / det };
  }
  const radii = pts.map((p) => dist(p, c));
  const r = radii.reduce((s, x) => s + x, 0) / (radii.length || 1);
  const error = Math.sqrt(radii.reduce((s, x) => s + (x - r) ** 2, 0) / (radii.length || 1)) / (r || 1);
  return { c, r, error };
}

/** Ramer–Douglas–Peucker line simplification. */
export function rdp(pts: Vec[], eps: number): Vec[] {
  if (pts.length < 3) return pts.slice();
  let maxD = 0;
  let idx = 0;
  const a = pts[0];
  const b = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distToSegment(pts[i], a, b);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [a, b];
  const left = rdp(pts.slice(0, idx + 1), eps);
  const right = rdp(pts.slice(idx), eps);
  return [...left.slice(0, -1), ...right];
}

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function simplifyRatio(a: number, b: number): [number, number] {
  const g = gcd(a, b);
  return [Math.round(a) / g, Math.round(b) / g];
}

/** Friendly number formatting: rounds, trims trailing zeros, uses a real minus sign. */
export function fmt(n: number, dp = 1): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? '−∞' : '—';
  const r = Number(n.toFixed(dp));
  const s = (Object.is(r, -0) ? 0 : r).toLocaleString('en-US', { maximumFractionDigits: dp, useGrouping: false });
  return s.replace('-', '−');
}

export const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function pathFrom(pts: Vec[], closed = true): string {
  if (!pts.length) return '';
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + (closed ? ' Z' : '');
}

/** SVG arc path for an angle wedge (maths convention, start→end counter-clockwise). */
export function arcPath(c: Vec, r: number, startDeg: number, sweepDeg: number, wedge = false): string {
  const sweep = Math.max(-359.999, Math.min(359.999, sweepDeg));
  const p0 = polar(c, r, startDeg);
  const p1 = polar(c, r, startDeg + sweep);
  const large = Math.abs(sweep) > 180 ? 1 : 0;
  const dir = sweep >= 0 ? 0 : 1; // screen y is flipped, so CCW in maths = sweep-flag 0
  const arc = `M${p0.x} ${p0.y} A${r} ${r} 0 ${large} ${dir} ${p1.x} ${p1.y}`;
  return wedge ? `M${c.x} ${c.y} L${p0.x} ${p0.y} A${r} ${r} 0 ${large} ${dir} ${p1.x} ${p1.y} Z` : arc;
}
