import {
  angleAt, centroid, dist, distToSegment, fitCircle, interiorAngles, polygonArea, rdp, sideLengths, type Vec,
} from './geometry';

export type ShapeKind = 'line' | 'triangle' | 'rectangle' | 'quadrilateral' | 'polygon' | 'circle' | 'freeform';

export interface Detected {
  kind: ShapeKind;
  /** vertices for line / polygons; for circles the centre is pts[0] and r is set */
  pts: Vec[];
  r?: number;
  /** a short human explanation of why the detector chose this */
  reason: string;
}

/** Evenly resample a polyline by arc length. */
export function resample(pts: Vec[], n: number): Vec[] {
  if (pts.length < 2) return pts.slice();
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + dist(pts[i - 1], pts[i]));
  const total = lens[lens.length - 1];
  if (total === 0) return [pts[0]];
  const out: Vec[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const d = (total * k) / (n - 1);
    while (j < lens.length - 1 && lens[j] < d) j++;
    const seg = lens[j] - lens[j - 1] || 1;
    const t = (d - lens[j - 1]) / seg;
    out.push({ x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * t, y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * t });
  }
  return out;
}

function pathLength(p: Vec[]) {
  let s = 0;
  for (let i = 1; i < p.length; i++) s += dist(p[i - 1], p[i]);
  return s;
}

function bboxDiag(p: Vec[]) {
  const xs = p.map((q) => q.x);
  const ys = p.map((q) => q.y);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

/**
 * How concentrated the turning is: 0 for a smooth round loop, close to 1
 * when almost all the turning happens at a few sharp corners.
 */
export function cornerConcentration(loop: Vec[]): number {
  const n = loop.length;
  const turn: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = loop[(i - 2 + n) % n];
    const b = loop[i];
    const c = loop[(i + 2) % n];
    turn.push(180 - angleAt(a, b, c));
  }
  const total = turn.reduce((s, t) => s + t, 0) || 1;
  const mean = total / n;
  const sharp = turn.filter((t) => t > 2.2 * mean).reduce((s, t) => s + t, 0);
  return sharp / total;
}

/** Simplify a closed loop into its corner points. */
export function loopCorners(loop: Vec[], epsFrac = 0.045): Vec[] {
  const D = bboxDiag(loop);
  const c = centroid(loop);
  let start = 0;
  loop.forEach((p, i) => {
    if (dist(p, c) > dist(loop[start], c)) start = i;
  });
  const rot = [...loop.slice(start), ...loop.slice(0, start), loop[start]];
  let v = rdp(rot, D * epsFrac).slice(0, -1);
  // drop corners that are almost straight, and corners that are very close together
  let changed = true;
  while (changed && v.length > 3) {
    changed = false;
    for (let i = 0; i < v.length; i++) {
      const a = v[(i - 1 + v.length) % v.length];
      const b = v[i];
      const cc = v[(i + 1) % v.length];
      if (angleAt(a, b, cc) > 155 || dist(a, b) < D * 0.07) {
        v = v.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return v;
}

/** Fit an exact rectangle to four corner points (keeps the average side directions). */
export function squareUp(q: Vec[]): Vec[] {
  const c = centroid(q);
  const a1 = Math.atan2(q[1].y - q[0].y, q[1].x - q[0].x);
  const a2 = Math.atan2(q[2].y - q[3].y, q[2].x - q[3].x);
  const ang = Math.atan2(Math.sin(a1) + Math.sin(a2), Math.cos(a1) + Math.cos(a2));
  const w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2;
  const h = (dist(q[1], q[2]) + dist(q[0], q[3])) / 2;
  const u = { x: Math.cos(ang), y: Math.sin(ang) };
  const v = { x: -u.y, y: u.x };
  // make sure v points from side 0-1 towards side 3-2
  const toward = { x: q[3].x - q[0].x, y: q[3].y - q[0].y };
  const s = toward.x * v.x + toward.y * v.y >= 0 ? 1 : -1;
  const P = (i: number, j: number) => ({ x: c.x + u.x * (i * w) / 2 + v.x * s * (j * h) / 2, y: c.y + u.y * (i * w) / 2 + v.y * s * (j * h) / 2 });
  return [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)];
}

export function detectShape(stroke: Vec[]): Detected {
  const L = pathLength(stroke);
  const D = bboxDiag(stroke);
  if (stroke.length < 3 || L < 12) return { kind: 'freeform', pts: stroke.slice(), reason: 'Too short to recognise.' };
  const gap = dist(stroke[0], stroke[stroke.length - 1]);
  const closed = gap < Math.max(0.18 * D, 0.1 * L);
  if (!closed) {
    const a = stroke[0];
    const b = stroke[stroke.length - 1];
    const dev = Math.max(...stroke.map((p) => distToSegment(p, a, b)));
    if (dev < 0.07 * dist(a, b)) return { kind: 'line', pts: [a, b], reason: `Open stroke that stays within ${Math.round((100 * dev) / dist(a, b))}% of a straight line.` };
    return { kind: 'freeform', pts: resample(stroke, 60), reason: 'An open curve — not a straight line and not closed.' };
  }
  const loop = resample(stroke, 96).slice(0, -1);
  const fit = fitCircle(loop);
  const conc = cornerConcentration(loop);
  if (fit.error < 0.12 && conc < 0.45) {
    return { kind: 'circle', pts: [fit.c], r: fit.r, reason: `Closed and round: distance from the centre varies by only ${Math.round(fit.error * 100)}%, with no sharp corners.` };
  }
  const v = loopCorners(loop);
  if (v.length === 3) return { kind: 'triangle', pts: v, reason: 'Closed with 3 sharp corners.' };
  if (v.length === 4) {
    const ang = interiorAngles(v);
    const off = Math.max(...ang.map((a) => Math.abs(a - 90)));
    if (off < 14) return { kind: 'rectangle', pts: v, reason: `4 corners, all within ${Math.round(off)}° of a right angle.` };
    return { kind: 'quadrilateral', pts: v, reason: `4 corners, but some are ${Math.round(off)}° away from a right angle.` };
  }
  if (v.length >= 5 && v.length <= 10 && polygonArea(v) > 0) return { kind: 'polygon', pts: v, reason: `Closed with ${v.length} corners.` };
  if (fit.error < 0.18) return { kind: 'circle', pts: [fit.c], r: fit.r, reason: 'Roughly round (an oval or a wobbly circle).' };
  return { kind: 'freeform', pts: loop, reason: 'A closed free shape.' };
}

/** Triangle classification text. */
export function triangleType(pts: Vec[]): string {
  const s = sideLengths(pts);
  const a = interiorAngles(pts);
  const eq = (x: number, y: number) => Math.abs(x - y) / Math.max(x, y) < 0.06;
  const bySides = eq(s[0], s[1]) && eq(s[1], s[2]) ? 'equilateral' : eq(s[0], s[1]) || eq(s[1], s[2]) || eq(s[0], s[2]) ? 'isosceles' : 'scalene';
  const mx = Math.max(...a);
  const byAngle = Math.abs(mx - 90) < 4 ? 'right-angled' : mx > 90 ? 'obtuse' : 'acute';
  return `${byAngle}, ${bySides}`;
}
