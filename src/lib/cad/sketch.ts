/**
 * A small 2D parametric sketch model with a numerical geometric-constraint solver.
 * Unknowns are point coordinates and circle radii. Constraints are residual equations
 * solved with Levenberg–Marquardt; degrees of freedom come from the Jacobian's rank.
 */
import type { Vec2 } from '../types';

export interface SPoint {
  id: string;
  x: number;
  y: number;
}
export interface SLine {
  id: string;
  kind: 'line';
  a: string;
  b: string;
}
export interface SCircle {
  id: string;
  kind: 'circle';
  c: string;
  r: number;
}
export interface SArc {
  id: string;
  kind: 'arc';
  c: string;
  a: string; // start (counter-clockwise to b)
  b: string;
}
export type SEntity = SLine | SCircle | SArc;

export type ConstraintType =
  | 'coincident'
  | 'horizontal'
  | 'vertical'
  | 'parallel'
  | 'perpendicular'
  | 'equal'
  | 'tangent'
  | 'concentric'
  | 'fix'
  | 'distance'
  | 'hdist'
  | 'vdist'
  | 'radius'
  | 'pointLine';

export interface Constraint {
  id: string;
  type: ConstraintType;
  refs: string[];
  value?: number;
  x?: number;
  y?: number;
}

export interface Sketch {
  points: SPoint[];
  entities: SEntity[];
  constraints: Constraint[];
}

export type SolveStatus = 'under' | 'full' | 'redundant' | 'conflict';
export interface SolveInfo {
  status: SolveStatus;
  dof: number;
  residual: number;
  determinedPoints: Set<string>;
  determinedCircles: Set<string>;
  equations: number;
  rank: number;
}

let n = 0;
export const sid = (p: string) => `${p}${Date.now().toString(36).slice(-4)}${(n++).toString(36)}`;

export const CONSTRAINT_LABEL: Record<ConstraintType, string> = {
  coincident: 'Coincident',
  horizontal: 'Horizontal',
  vertical: 'Vertical',
  parallel: 'Parallel',
  perpendicular: 'Perpendicular',
  equal: 'Equal',
  tangent: 'Tangent',
  concentric: 'Concentric',
  fix: 'Fixed (anchor)',
  distance: 'Distance',
  hdist: 'Horizontal distance',
  vdist: 'Vertical distance',
  radius: 'Radius',
  pointLine: 'Point–line distance',
};
export const CONSTRAINT_GLYPH: Record<ConstraintType, string> = {
  coincident: '●',
  horizontal: 'H',
  vertical: 'V',
  parallel: '∥',
  perpendicular: '⊥',
  equal: '=',
  tangent: 'T',
  concentric: '◎',
  fix: '⚓',
  distance: '↔',
  hdist: '↔',
  vdist: '↕',
  radius: 'R',
  pointLine: '↔',
};
export const isDimension = (t: ConstraintType) => t === 'distance' || t === 'hdist' || t === 'vdist' || t === 'radius' || t === 'pointLine';

/* -------------------------- residuals -------------------------- */

type Getter = { P: (id: string) => Vec2; R: (id: string) => number; E: (id: string) => SEntity | undefined };

function lineVec(g: Getter, l: SLine): [Vec2, Vec2] {
  const a = g.P(l.a),
    b = g.P(l.b);
  return [a, [b[0] - a[0], b[1] - a[1]]];
}
const len = (v: Vec2) => Math.hypot(v[0], v[1]) || 1e-9;

function residuals(sk: Sketch, g: Getter, out: number[]) {
  for (const c of sk.constraints) {
    const r = c.refs;
    switch (c.type) {
      case 'coincident': {
        const p = g.P(r[0]),
          q = g.P(r[1]);
        out.push(p[0] - q[0], p[1] - q[1]);
        break;
      }
      case 'horizontal':
      case 'vertical': {
        const l = g.E(r[0]) as SLine;
        const a = g.P(l.a),
          b = g.P(l.b);
        out.push(c.type === 'horizontal' ? a[1] - b[1] : a[0] - b[0]);
        break;
      }
      case 'parallel':
      case 'perpendicular': {
        const [, d1] = lineVec(g, g.E(r[0]) as SLine);
        const [, d2] = lineVec(g, g.E(r[1]) as SLine);
        const L = Math.sqrt(len(d1) * len(d2));
        const v = c.type === 'parallel' ? d1[0] * d2[1] - d1[1] * d2[0] : d1[0] * d2[0] + d1[1] * d2[1];
        out.push(v / L);
        break;
      }
      case 'equal': {
        const e1 = g.E(r[0])!,
          e2 = g.E(r[1])!;
        if (e1.kind === 'line' && e2.kind === 'line') out.push(len(lineVec(g, e1)[1]) - len(lineVec(g, e2)[1]));
        else out.push(radiusOf(g, e1) - radiusOf(g, e2));
        break;
      }
      case 'tangent': {
        const l = g.E(r[0]) as SLine;
        const ce = g.E(r[1])!;
        const [a, d] = lineVec(g, l);
        const cc = g.P(centerOf(ce));
        const dist = Math.abs((cc[0] - a[0]) * d[1] - (cc[1] - a[1]) * d[0]) / len(d);
        out.push(dist - radiusOf(g, ce));
        break;
      }
      case 'concentric': {
        const p = g.P(centerOf(g.E(r[0])!)),
          q = g.P(centerOf(g.E(r[1])!));
        out.push(p[0] - q[0], p[1] - q[1]);
        break;
      }
      case 'fix': {
        const p = g.P(r[0]);
        out.push(p[0] - (c.x ?? 0), p[1] - (c.y ?? 0));
        break;
      }
      case 'distance': {
        const p = g.P(r[0]),
          q = g.P(r[1]);
        out.push(Math.hypot(p[0] - q[0], p[1] - q[1]) - (c.value ?? 0));
        break;
      }
      case 'hdist': {
        out.push(g.P(r[1])[0] - g.P(r[0])[0] - (c.value ?? 0));
        break;
      }
      case 'vdist': {
        out.push(g.P(r[1])[1] - g.P(r[0])[1] - (c.value ?? 0));
        break;
      }
      case 'radius': {
        out.push(radiusOf(g, g.E(r[0])!) - (c.value ?? 0));
        break;
      }
      case 'pointLine': {
        const p = g.P(r[0]);
        const [a, d] = lineVec(g, g.E(r[1]) as SLine);
        out.push(Math.abs((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / len(d) - (c.value ?? 0));
        break;
      }
    }
  }
  // implicit: arc endpoints lie on the same circle
  for (const e of sk.entities)
    if (e.kind === 'arc') {
      const c = g.P(e.c),
        a = g.P(e.a),
        b = g.P(e.b);
      out.push(Math.hypot(a[0] - c[0], a[1] - c[1]) - Math.hypot(b[0] - c[0], b[1] - c[1]));
    }
}
function centerOf(e: SEntity) {
  return e.kind === 'circle' || e.kind === 'arc' ? e.c : e.a;
}
function radiusOf(g: Getter, e: SEntity) {
  if (e.kind === 'circle') return g.R(e.id);
  if (e.kind === 'arc') {
    const c = g.P(e.c),
      a = g.P(e.a);
    return Math.hypot(a[0] - c[0], a[1] - c[1]);
  }
  return len(lineVec(g, e)[1]);
}

/* -------------------------- linear algebra -------------------------- */

function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-14) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Row-reduce a copy of J; returns rank, pivot columns and the reduced matrix. */
function rref(J: number[][], ncols: number, tol = 1e-7) {
  const M = J.map((r) => [...r]);
  const pivots: number[] = [];
  let row = 0;
  for (let c = 0; c < ncols && row < M.length; c++) {
    let p = row;
    for (let r = row + 1; r < M.length; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < tol) continue;
    [M[row], M[p]] = [M[p], M[row]];
    const piv = M[row][c];
    for (let k = 0; k < ncols; k++) M[row][k] /= piv;
    for (let r = 0; r < M.length; r++) {
      if (r === row) continue;
      const f = M[r][c];
      if (Math.abs(f) > 0) for (let k = 0; k < ncols; k++) M[r][k] -= f * M[row][k];
    }
    pivots.push(c);
    row++;
  }
  return { rank: pivots.length, pivots, M };
}

/* -------------------------- solver -------------------------- */

interface VarMap {
  names: string[]; // e.g. "p:id:x", "r:id"
  get: (x: number[]) => Getter;
}

function buildVars(sk: Sketch, frozen?: Set<string>): { vars: VarMap; x0: number[] } {
  const names: string[] = [];
  const x0: number[] = [];
  const idx = new Map<string, number>();
  for (const p of sk.points) {
    if (frozen?.has(p.id)) continue;
    idx.set(`${p.id}:x`, names.length);
    names.push(`p:${p.id}:x`);
    x0.push(p.x);
    idx.set(`${p.id}:y`, names.length);
    names.push(`p:${p.id}:y`);
    x0.push(p.y);
  }
  for (const e of sk.entities)
    if (e.kind === 'circle') {
      idx.set(`${e.id}:r`, names.length);
      names.push(`r:${e.id}`);
      x0.push(e.r);
    }
  const pmap = new Map(sk.points.map((p) => [p.id, p]));
  const emap = new Map(sk.entities.map((e) => [e.id, e]));
  return {
    x0,
    vars: {
      names,
      get: (x) => ({
        P: (id) => {
          const ix = idx.get(`${id}:x`);
          if (ix == null) {
            const p = pmap.get(id)!;
            return [p.x, p.y];
          }
          return [x[ix], x[ix + 1]];
        },
        R: (id) => {
          const ir = idx.get(`${id}:r`);
          return ir == null ? (emap.get(id) as SCircle).r : x[ir];
        },
        E: (id) => emap.get(id),
      }),
    },
  };
}

function evalF(sk: Sketch, vars: VarMap, x: number[], extra?: (g: Getter, out: number[]) => void) {
  const out: number[] = [];
  const g = vars.get(x);
  residuals(sk, g, out);
  extra?.(g, out);
  return out;
}

function jacobian(sk: Sketch, vars: VarMap, x: number[], f0: number[], extra?: (g: Getter, out: number[]) => void) {
  const J: number[][] = f0.map(() => new Array(x.length).fill(0));
  for (let j = 0; j < x.length; j++) {
    const h = 1e-6 * Math.max(1, Math.abs(x[j]));
    const xp = [...x];
    xp[j] += h;
    const fp = evalF(sk, vars, xp, extra);
    for (let i = 0; i < f0.length; i++) J[i][j] = (fp[i] - f0[i]) / h;
  }
  return J;
}

function levenberg(sk: Sketch, vars: VarMap, x0: number[], extra?: (g: Getter, out: number[]) => void, iters = 120) {
  let x = [...x0];
  let f = evalF(sk, vars, x, extra);
  let cost = f.reduce((s, v) => s + v * v, 0);
  let lambda = 1e-3;
  for (let it = 0; it < iters && cost > 1e-16; it++) {
    const J = jacobian(sk, vars, x, f, extra);
    const n = x.length;
    const JtJ: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const Jtf = new Array(n).fill(0);
    for (let i = 0; i < f.length; i++) {
      const Ji = J[i];
      for (let a = 0; a < n; a++) {
        if (!Ji[a]) continue;
        Jtf[a] += Ji[a] * f[i];
        for (let b = 0; b < n; b++) JtJ[a][b] += Ji[a] * Ji[b];
      }
    }
    let improved = false;
    for (let tries = 0; tries < 8; tries++) {
      const A = JtJ.map((row, a) => row.map((v, b) => (a === b ? v + lambda * (1 + v) : v)));
      const dx = solveLinear(A, Jtf.map((v) => -v));
      if (!dx) {
        lambda *= 10;
        continue;
      }
      const xn = x.map((v, i) => v + dx[i]);
      const fn = evalF(sk, vars, xn, extra);
      const cn = fn.reduce((s, v) => s + v * v, 0);
      if (cn < cost) {
        x = xn;
        f = fn;
        cost = cn;
        lambda = Math.max(1e-9, lambda / 4);
        improved = true;
        break;
      }
      lambda *= 8;
    }
    if (!improved) break;
  }
  return { x, cost };
}

function apply(sk: Sketch, vars: VarMap, x: number[]): Sketch {
  const g = vars.get(x);
  return {
    ...sk,
    points: sk.points.map((p) => {
      const [px, py] = g.P(p.id);
      return { ...p, x: px, y: py };
    }),
    entities: sk.entities.map((e) => (e.kind === 'circle' ? { ...e, r: Math.max(0.1, g.R(e.id)) } : e)),
  };
}

export function analyse(sk: Sketch): SolveInfo {
  const { vars, x0 } = buildVars(sk);
  const f = evalF(sk, vars, x0);
  const residual = Math.sqrt(f.reduce((s, v) => s + v * v, 0));
  const nv = x0.length;
  if (!f.length) {
    return { status: nv ? 'under' : 'full', dof: nv, residual, determinedPoints: new Set(), determinedCircles: new Set(), equations: 0, rank: 0 };
  }
  const J = jacobian(sk, vars, x0, f);
  const { rank, pivots, M } = rref(J, nv, 1e-6);
  const dof = nv - rank;
  const free = [...Array(nv).keys()].filter((c) => !pivots.includes(c));
  const determined = new Set<number>();
  pivots.forEach((c, row) => {
    if (free.every((fc) => Math.abs(M[row][fc]) < 1e-6)) determined.add(c);
  });
  const determinedPoints = new Set<string>();
  const determinedCircles = new Set<string>();
  vars.names.forEach((nm, i) => {
    if (!determined.has(i)) return;
    const [k, id, ax] = nm.split(':');
    if (k === 'p' && ax === 'x' && determined.has(i + 1)) determinedPoints.add(id);
    if (k === 'r') determinedCircles.add(id);
  });
  const status: SolveStatus = residual > 1e-3 ? 'conflict' : f.length > rank ? 'redundant' : dof === 0 ? 'full' : 'under';
  return { status, dof, residual, determinedPoints, determinedCircles, equations: f.length, rank };
}

/** Solve all constraints, starting from the current geometry (so it moves as little as possible). */
export function solve(sk: Sketch): Sketch {
  if (!sk.constraints.length && !sk.entities.some((e) => e.kind === 'arc')) return sk;
  const { vars, x0 } = buildVars(sk);
  const { x } = levenberg(sk, vars, x0);
  return apply(sk, vars, x);
}

/** Drag a point towards a target while keeping all constraints satisfied when possible. */
export function dragSolve(sk: Sketch, pid: string, target: Vec2): Sketch {
  const moved: Sketch = { ...sk, points: sk.points.map((p) => (p.id === pid ? { ...p, x: target[0], y: target[1] } : p)) };
  // 1) treat the dragged point as fixed at the cursor
  const hard = buildVars(moved, new Set([pid]));
  const r1 = levenberg(moved, hard.vars, hard.x0);
  if (r1.cost < 1e-8) return apply(moved, hard.vars, r1.x);
  // 2) otherwise get as close as the constraints allow (soft pull)
  const soft = buildVars(sk);
  const pull = (g: Getter, out: number[]) => {
    const p = g.P(pid);
    out.push((p[0] - target[0]) * 0.05, (p[1] - target[1]) * 0.05);
  };
  const r2 = levenberg(sk, soft.vars, soft.x0, pull);
  const res = apply(sk, soft.vars, r2.x);
  return solve(res);
}

/* -------------------------- measurement helpers -------------------------- */

export function pointOf(sk: Sketch, id: string): Vec2 {
  const p = sk.points.find((q) => q.id === id)!;
  return [p.x, p.y];
}
export function lineLength(sk: Sketch, l: SLine) {
  const a = pointOf(sk, l.a),
    b = pointOf(sk, l.b);
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}
export function radiusOfEntity(sk: Sketch, e: SEntity) {
  if (e.kind === 'circle') return e.r;
  if (e.kind === 'arc') {
    const c = pointOf(sk, e.c),
      a = pointOf(sk, e.a);
    return Math.hypot(a[0] - c[0], a[1] - c[1]);
  }
  return lineLength(sk, e);
}
export function pointLineDistance(p: Vec2, a: Vec2, b: Vec2) {
  const d: Vec2 = [b[0] - a[0], b[1] - a[1]];
  return Math.abs((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / len(d);
}

/** Current measured value for a dimension constraint (used when the user adds one). */
export function measure(sk: Sketch, type: ConstraintType, refs: string[]): number {
  const E = (id: string) => sk.entities.find((e) => e.id === id)!;
  switch (type) {
    case 'distance': {
      const a = pointOf(sk, refs[0]),
        b = pointOf(sk, refs[1]);
      return Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    case 'hdist':
      return pointOf(sk, refs[1])[0] - pointOf(sk, refs[0])[0];
    case 'vdist':
      return pointOf(sk, refs[1])[1] - pointOf(sk, refs[0])[1];
    case 'radius':
      return radiusOfEntity(sk, E(refs[0]));
    case 'pointLine': {
      const l = E(refs[1]) as SLine;
      return pointLineDistance(pointOf(sk, refs[0]), pointOf(sk, l.a), pointOf(sk, l.b));
    }
    default:
      return 0;
  }
}

/* -------------------------- builders -------------------------- */

export function emptySketch(): Sketch {
  return { points: [], entities: [], constraints: [] };
}
export function addPoint(sk: Sketch, x: number, y: number): [Sketch, string] {
  const id = sid('p');
  return [{ ...sk, points: [...sk.points, { id, x, y }] }, id];
}
export function addLine(sk: Sketch, a: string, b: string): [Sketch, string] {
  const id = sid('l');
  return [{ ...sk, entities: [...sk.entities, { id, kind: 'line', a, b }] }, id];
}
export function addRect(sk: Sketch, x1: number, y1: number, x2: number, y2: number): Sketch {
  let s = sk;
  const ids: string[] = [];
  for (const [x, y] of [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ]) {
    const [s2, id] = addPoint(s, x, y);
    s = s2;
    ids.push(id);
  }
  const lines: string[] = [];
  for (let i = 0; i < 4; i++) {
    const [s2, id] = addLine(s, ids[i], ids[(i + 1) % 4]);
    s = s2;
    lines.push(id);
  }
  return {
    ...s,
    constraints: [
      ...s.constraints,
      { id: sid('c'), type: 'horizontal', refs: [lines[0]] },
      { id: sid('c'), type: 'horizontal', refs: [lines[2]] },
      { id: sid('c'), type: 'vertical', refs: [lines[1]] },
      { id: sid('c'), type: 'vertical', refs: [lines[3]] },
    ],
  };
}
export function addCircle(sk: Sketch, x: number, y: number, r: number): [Sketch, string] {
  const [s, c] = addPoint(sk, x, y);
  const id = sid('c');
  return [{ ...s, entities: [...s.entities, { id, kind: 'circle', c, r }] }, id];
}
export function addArc(sk: Sketch, c: Vec2, a: Vec2, b: Vec2): Sketch {
  let s = sk;
  const ids: string[] = [];
  const r = Math.hypot(a[0] - c[0], a[1] - c[1]);
  const ang = Math.atan2(b[1] - c[1], b[0] - c[0]);
  for (const p of [c, a, [c[0] + r * Math.cos(ang), c[1] + r * Math.sin(ang)] as Vec2]) {
    const [s2, id] = addPoint(s, p[0], p[1]);
    s = s2;
    ids.push(id);
  }
  return { ...s, entities: [...s.entities, { id: sid('a'), kind: 'arc', c: ids[0], a: ids[1], b: ids[2] }] };
}
export function removeEntity(sk: Sketch, id: string): Sketch {
  const e = sk.entities.find((x) => x.id === id);
  if (!e) return sk;
  const entities = sk.entities.filter((x) => x.id !== id);
  const used = new Set(entities.flatMap((x) => (x.kind === 'line' ? [x.a, x.b] : x.kind === 'circle' ? [x.c] : [x.c, x.a, x.b])));
  const points = sk.points.filter((p) => used.has(p.id));
  const alive = new Set([...points.map((p) => p.id), ...entities.map((x) => x.id)]);
  return { points, entities, constraints: sk.constraints.filter((c) => c.refs.every((r) => alive.has(r))) };
}

/* -------------------------- closed loops for extrusion -------------------------- */

export function arcPoints(sk: Sketch, e: SArc, segs = 24): Vec2[] {
  const c = pointOf(sk, e.c),
    a = pointOf(sk, e.a),
    b = pointOf(sk, e.b);
  const r = Math.hypot(a[0] - c[0], a[1] - c[1]);
  const a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
  let a1 = Math.atan2(b[1] - c[1], b[0] - c[0]);
  while (a1 <= a0) a1 += Math.PI * 2;
  return Array.from({ length: segs + 1 }, (_, i) => {
    const t = a0 + ((a1 - a0) * i) / segs;
    return [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)] as Vec2;
  });
}

/** Extract closed loops from lines/arcs (shared or coincident endpoints) and circles. */
export function closedLoops(sk: Sketch): { loops: Vec2[][]; openEnds: number } {
  // union-find over coincident points
  const parent = new Map(sk.points.map((p) => [p.id, p.id]));
  const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!));
  for (const c of sk.constraints) if (c.type === 'coincident') parent.set(find(c.refs[0]), find(c.refs[1]));
  // also merge points that are at the same location (within 1e-3 mm)
  for (let i = 0; i < sk.points.length; i++)
    for (let j = i + 1; j < sk.points.length; j++) {
      const a = sk.points[i],
        b = sk.points[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-3) parent.set(find(a.id), find(b.id));
    }
  type Edge = { id: string; u: string; v: string; pts: Vec2[] };
  const edges: Edge[] = [];
  for (const e of sk.entities) {
    if (e.kind === 'line') edges.push({ id: e.id, u: find(e.a), v: find(e.b), pts: [pointOf(sk, e.a), pointOf(sk, e.b)] });
    if (e.kind === 'arc') edges.push({ id: e.id, u: find(e.a), v: find(e.b), pts: arcPoints(sk, e) });
  }
  const adj = new Map<string, Edge[]>();
  for (const e of edges) {
    adj.set(e.u, [...(adj.get(e.u) ?? []), e]);
    adj.set(e.v, [...(adj.get(e.v) ?? []), e]);
  }
  const used = new Set<string>();
  const loops: Vec2[][] = [];
  let openEnds = 0;
  for (const [, es] of adj) if (es.length === 1) openEnds++;
  for (const start of edges) {
    if (used.has(start.id)) continue;
    // walk
    const pts: Vec2[] = [];
    let cur = start;
    let at = start.u;
    let ok = true;
    const seen = new Set<string>();
    while (true) {
      seen.add(cur.id);
      const forward = cur.u === at;
      const seq = forward ? cur.pts : [...cur.pts].reverse();
      pts.push(...seq.slice(0, -1));
      at = forward ? cur.v : cur.u;
      const nexts = (adj.get(at) ?? []).filter((e) => e.id !== cur.id);
      if ((adj.get(at) ?? []).length !== 2) {
        ok = false;
        break;
      }
      const nx = nexts[0];
      if (nx.id === start.id) break;
      if (seen.has(nx.id)) {
        ok = false;
        break;
      }
      cur = nx;
    }
    seen.forEach((s) => used.add(s));
    if (ok && pts.length >= 3) loops.push(pts);
  }
  for (const e of sk.entities)
    if (e.kind === 'circle') {
      const c = pointOf(sk, e.c);
      loops.push(Array.from({ length: 48 }, (_, i) => [c[0] + e.r * Math.cos((i / 48) * Math.PI * 2), c[1] + e.r * Math.sin((i / 48) * Math.PI * 2)] as Vec2));
    }
  return { loops, openEnds };
}
