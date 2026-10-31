import type { Vec2 } from './types';

export function signedArea(p: Vec2[]) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i],
      [x2, y2] = p[(i + 1) % p.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}
export const area = (p: Vec2[]) => Math.abs(signedArea(p));

export function perimeter(p: Vec2[], closed = true) {
  let s = 0;
  const n = closed ? p.length : p.length - 1;
  for (let i = 0; i < n; i++) s += Math.hypot(p[(i + 1) % p.length][0] - p[i][0], p[(i + 1) % p.length][1] - p[i][1]);
  return s;
}

function orient(a: Vec2, b: Vec2, c: Vec2) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
export function segmentsIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2) {
  const d1 = orient(p3, p4, p1),
    d2 = orient(p3, p4, p2),
    d3 = orient(p1, p2, p3),
    d4 = orient(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** True when no two non-adjacent edges of the closed polygon cross. */
export function isSimple(p: Vec2[]) {
  const n = p.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsIntersect(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return false;
    }
  return true;
}

export function polygonsCross(a: Vec2[], b: Vec2[]) {
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) if (segmentsIntersect(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
  return false;
}

export function pointInPolygon(pt: Vec2, poly: Vec2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Ramer–Douglas–Peucker simplification of an open polyline. */
export function simplify(pts: Vec2[], eps: number): Vec2[] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = -1,
    dmax = 0;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / L;
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }
  if (dmax > eps) {
    const l = simplify(pts.slice(0, idx + 1), eps);
    const r = simplify(pts.slice(idx), eps);
    return [...l.slice(0, -1), ...r];
  }
  return [a, b];
}

export function circlePoly(cx: number, cy: number, r: number, n = 48): Vec2[] {
  return Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * Math.sin((i / n) * Math.PI * 2)] as Vec2);
}
export function rectPoly(x1: number, y1: number, x2: number, y2: number): Vec2[] {
  const [a, b] = [Math.min(x1, x2), Math.max(x1, x2)];
  const [c, d] = [Math.min(y1, y2), Math.max(y1, y2)];
  return [
    [a, c],
    [b, c],
    [b, d],
    [a, d],
  ];
}

/** Round (fillet) or cut (chamfer) every corner of a polygon by size s. */
export function treatCorners(p: Vec2[], s: number, kind: 'fillet' | 'chamfer', segs = 6): Vec2[] {
  if (s <= 0) return p;
  const n = p.length;
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = p[(i - 1 + n) % n],
      cur = p[i],
      next = p[(i + 1) % n];
    const v1 = [prev[0] - cur[0], prev[1] - cur[1]],
      v2 = [next[0] - cur[0], next[1] - cur[1]];
    const l1 = Math.hypot(v1[0], v1[1]),
      l2 = Math.hypot(v2[0], v2[1]);
    const u1 = [v1[0] / l1, v1[1] / l1],
      u2 = [v2[0] / l2, v2[1] / l2];
    const ang = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1])));
    if (ang > Math.PI - 0.01) {
      out.push(cur);
      continue;
    }
    // tangent distance for a fillet of radius s; chamfer uses s as the setback directly
    let t = kind === 'fillet' ? s / Math.tan(ang / 2) : s;
    t = Math.min(t, l1 * 0.49, l2 * 0.49);
    const a: Vec2 = [cur[0] + u1[0] * t, cur[1] + u1[1] * t];
    const b: Vec2 = [cur[0] + u2[0] * t, cur[1] + u2[1] * t];
    if (kind === 'chamfer') {
      out.push(a, b);
      continue;
    }
    const r = t * Math.tan(ang / 2);
    const bis = [u1[0] + u2[0], u1[1] + u2[1]];
    const bl = Math.hypot(bis[0], bis[1]);
    const dc = r / Math.sin(ang / 2);
    const c = [cur[0] + (bis[0] / bl) * dc, cur[1] + (bis[1] / bl) * dc];
    let a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
    let a1 = Math.atan2(b[1] - c[1], b[0] - c[0]);
    let d = a1 - a0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    a1 = a0 + d;
    for (let k = 0; k <= segs; k++) {
      const th = a0 + ((a1 - a0) * k) / segs;
      out.push([c[0] + r * Math.cos(th), c[1] + r * Math.sin(th)]);
    }
    a0 = 0;
  }
  return out;
}

export interface Loop {
  id: string;
  pts: Vec2[];
  hole: boolean;
}

export interface ProfileCheck {
  ok: boolean;
  errors: string[];
  solids: { outline: Vec2[]; holes: Vec2[][] }[];
}

/** Validate closed loops and organise them into outlines with holes. */
export function checkProfiles(loops: Loop[]): ProfileCheck {
  const errors: string[] = [];
  const outers = loops.filter((l) => !l.hole);
  const holes = loops.filter((l) => l.hole);
  loops.forEach((l, i) => {
    if (l.pts.length < 3) errors.push(`Shape ${i + 1} needs at least 3 points.`);
    else if (!isSimple(l.pts)) errors.push(`Shape ${i + 1} crosses itself — a solid can’t have a self-intersecting outline.`);
    else if (area(l.pts) < 1) errors.push(`Shape ${i + 1} has almost no area.`);
  });
  if (!outers.length) errors.push('Draw at least one outer profile.');
  const solids = outers.map((o) => ({ outline: o.pts, holes: [] as Vec2[][] }));
  for (const h of holes) {
    const idx = outers.findIndex((o) => h.pts.every((p) => pointInPolygon(p, o.pts)) && !polygonsCross(h.pts, o.pts));
    if (idx < 0) errors.push('A hole must lie completely inside an outer profile without touching its edge.');
    else solids[idx].holes.push(h.pts);
  }
  for (let i = 0; i < holes.length; i++)
    for (let j = i + 1; j < holes.length; j++)
      if (polygonsCross(holes[i].pts, holes[j].pts) || pointInPolygon(holes[i].pts[0], holes[j].pts)) errors.push('Two holes overlap — merge them into one.');
  for (let i = 0; i < outers.length; i++)
    for (let j = i + 1; j < outers.length; j++)
      if (polygonsCross(outers[i].pts, outers[j].pts)) errors.push('Two outer profiles overlap. Use separate, non-touching outlines or make one a hole.');
  return { ok: errors.length === 0, errors, solids };
}
