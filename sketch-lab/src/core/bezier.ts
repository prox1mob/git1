import { add, dist, lerpV, scale, sub, type Vec } from './geometry';

/** One anchor of a Bézier path with its incoming and outgoing handles. */
export interface BNode {
  p: Vec;
  hin: Vec;
  hout: Vec;
}

export type Cubic = [Vec, Vec, Vec, Vec];

export function segments(nodes: BNode[]): Cubic[] {
  const out: Cubic[] = [];
  for (let i = 0; i < nodes.length - 1; i++) out.push([nodes[i].p, nodes[i].hout, nodes[i + 1].hin, nodes[i + 1].p]);
  return out;
}

export function point(c: Cubic, t: number): Vec {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const d = 3 * u * t * t;
  const e = t * t * t;
  return { x: a * c[0].x + b * c[1].x + d * c[2].x + e * c[3].x, y: a * c[0].y + b * c[1].y + d * c[2].y + e * c[3].y };
}

export function deriv(c: Cubic, t: number): Vec {
  const u = 1 - t;
  const p = (k: 'x' | 'y') => 3 * u * u * (c[1][k] - c[0][k]) + 6 * u * t * (c[2][k] - c[1][k]) + 3 * t * t * (c[3][k] - c[2][k]);
  return { x: p('x'), y: p('y') };
}

export function deriv2(c: Cubic, t: number): Vec {
  const p = (k: 'x' | 'y') => 6 * (1 - t) * (c[2][k] - 2 * c[1][k] + c[0][k]) + 6 * t * (c[3][k] - 2 * c[2][k] + c[1][k]);
  return { x: p('x'), y: p('y') };
}

/** Signed curvature κ = (x'y'' − y'x'') / |B'|³. 1/κ is the radius of the circle that fits best there. */
export function curvature(c: Cubic, t: number): number {
  const d1 = deriv(c, t);
  const d2 = deriv2(c, t);
  const s = Math.hypot(d1.x, d1.y);
  if (s < 1e-9) return 0;
  return (d1.x * d2.y - d1.y * d2.x) / (s * s * s);
}

/** All intermediate points of de Casteljau's construction at parameter t. */
export function casteljau(c: Cubic, t: number): Vec[][] {
  const levels: Vec[][] = [c.slice()];
  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1];
    const next: Vec[] = [];
    for (let i = 0; i < prev.length - 1; i++) next.push(lerpV(prev[i], prev[i + 1], t));
    levels.push(next);
  }
  return levels;
}

export function pathD(nodes: BNode[], closed = false): string {
  if (!nodes.length) return '';
  let d = `M${nodes[0].p.x} ${nodes[0].p.y}`;
  for (const [, c1, c2, p] of segments(nodes)) d += ` C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p.x} ${p.y}`;
  if (closed && nodes.length > 1) {
    const a = nodes[nodes.length - 1];
    const b = nodes[0];
    d += ` C${a.hout.x} ${a.hout.y} ${b.hin.x} ${b.hin.y} ${b.p.x} ${b.p.y} Z`;
  }
  return d;
}

export function sample(nodes: BNode[], perSeg = 40): Vec[] {
  const pts: Vec[] = [];
  segments(nodes).forEach((c, i) => {
    for (let k = i ? 1 : 0; k <= perSeg; k++) pts.push(point(c, k / perSeg));
  });
  return pts;
}

export type Continuity = 'G0' | 'G1' | 'C1' | 'G2';

/** How smoothly two segments join at interior node i. */
export function jointContinuity(nodes: BNode[], i: number): { level: Continuity; kinkDeg: number; curvA: number; curvB: number } {
  const n = nodes[i];
  const a = sub(n.p, n.hin);
  const b = sub(n.hout, n.p);
  const la = Math.hypot(a.x, a.y);
  const lb = Math.hypot(b.x, b.y);
  const cos = la && lb ? (a.x * b.x + a.y * b.y) / (la * lb) : 1;
  const kinkDeg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  const segs = segments(nodes);
  const curvA = curvature(segs[i - 1], 1);
  const curvB = curvature(segs[i], 0);
  let level: Continuity = 'G0';
  if (kinkDeg < 2) {
    level = Math.abs(la - lb) / Math.max(la, lb, 1e-9) < 0.05 ? 'C1' : 'G1';
    const big = Math.max(Math.abs(curvA), Math.abs(curvB), 1e-9);
    if (Math.abs(curvA - curvB) / big < 0.1) level = 'G2';
  }
  return { level, kinkDeg, curvA, curvB };
}

/** Make the handles of node i collinear (G1); keep lengths unless `equal`. */
export function smoothNode(n: BNode, moved: 'hin' | 'hout', equal: boolean): BNode {
  const fixed = moved === 'hin' ? 'hout' : 'hin';
  const v = sub(n[moved], n.p);
  const L = Math.hypot(v.x, v.y) || 1;
  const keep = equal ? L : dist(n[fixed], n.p);
  return { ...n, [fixed]: add(n.p, scale(v, -keep / L)) };
}

/** Average closest-point distance from every point of A to the polyline B. */
export function meanDistance(A: Vec[], B: Vec[]): { mean: number; max: number; at: number } {
  let sum = 0;
  let max = 0;
  let at = 0;
  A.forEach((p, i) => {
    let best = Infinity;
    for (const q of B) best = Math.min(best, (p.x - q.x) ** 2 + (p.y - q.y) ** 2);
    const d = Math.sqrt(best);
    sum += d;
    if (d > max) {
      max = d;
      at = i;
    }
  });
  return { mean: sum / (A.length || 1), max, at };
}
