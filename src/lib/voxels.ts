/** Integer voxel shapes ("polycubes") for spatial reasoning exercises. */
export type Vox = [number, number, number];
export type View = 'front' | 'top' | 'side';

export const vkey = (v: Vox) => v.join(',');

export function normalize(vs: Vox[]): Vox[] {
  const mn = [0, 1, 2].map((k) => Math.min(...vs.map((v) => v[k])));
  return vs
    .map((v) => [v[0] - mn[0], v[1] - mn[1], v[2] - mn[2]] as Vox)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
}
export const shapeKey = (vs: Vox[]) => normalize(vs).map(vkey).join(';');

/** Rotate by quarter turns about an axis, following the right-hand rule. */
export function rotate(vs: Vox[], axis: 'x' | 'y' | 'z', turns: number): Vox[] {
  let out = vs;
  const t = ((turns % 4) + 4) % 4;
  for (let i = 0; i < t; i++) {
    out = out.map(([x, y, z]) => {
      if (axis === 'x') return [x, -z, y] as Vox;
      if (axis === 'y') return [z, y, -x] as Vox;
      return [-y, x, z] as Vox;
    });
  }
  return normalize(out);
}
export function mirror(vs: Vox[], axis: 'x' | 'y' | 'z' = 'x'): Vox[] {
  const k = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  return normalize(vs.map((v) => v.map((c, i) => (i === k ? -c : c)) as Vox));
}

export function allRotations(vs: Vox[]): Vox[][] {
  const out = new Map<string, Vox[]>();
  let a = normalize(vs);
  for (let i = 0; i < 4; i++) {
    let b = a;
    for (let j = 0; j < 4; j++) {
      let c = b;
      for (let k = 0; k < 4; k++) {
        out.set(shapeKey(c), c);
        c = rotate(c, 'z', 1);
      }
      b = rotate(b, 'y', 1);
    }
    a = rotate(a, 'x', 1);
  }
  return [...out.values()];
}
export function sameUpToRotation(a: Vox[], b: Vox[]) {
  const kb = shapeKey(b);
  return allRotations(a).some((r) => shapeKey(r) === kb);
}

/** Random connected polycube inside a bounding box. */
export function randomPolycube(rand: () => number, n: number, bounds: Vox = [3, 3, 3]): Vox[] {
  const set = new Map<string, Vox>();
  const start: Vox = [0, 0, 0];
  set.set(vkey(start), start);
  const dirs: Vox[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  let guard = 0;
  while (set.size < n && guard++ < 1000) {
    const arr = [...set.values()];
    const base = arr[Math.floor(rand() * arr.length)];
    const d = dirs[Math.floor(rand() * 6)];
    const c: Vox = [base[0] + d[0], base[1] + d[1], base[2] + d[2]];
    if (c.some((v, i) => v < 0 || v >= bounds[i])) continue;
    if (c[1] > 0 && !set.has(vkey([c[0], c[1] - 1, c[2]])) && rand() < 0.7) continue; // prefer supported cubes
    set.set(vkey(c), c);
  }
  return normalize([...set.values()]);
}

export interface Projection {
  w: number;
  h: number;
  cells: (number | null)[][]; // [row][col] depth (larger = closer to viewer) or null
}

/** Orthographic projection with depth, in screen orientation (row 0 = top). */
export function project(vs: Vox[], view: View): Projection {
  const n = normalize(vs);
  const mx = [0, 1, 2].map((k) => Math.max(...n.map((v) => v[k])) + 1);
  let w: number, h: number;
  const map = (v: Vox): [number, number, number] => {
    // returns [col, row, depth]
    if (view === 'front') return [v[0], mx[1] - 1 - v[1], v[2]];
    if (view === 'top') return [v[0], v[2], v[1]];
    return [mx[2] - 1 - v[2], mx[1] - 1 - v[1], v[0]];
  };
  if (view === 'front') [w, h] = [mx[0], mx[1]];
  else if (view === 'top') [w, h] = [mx[0], mx[2]];
  else [w, h] = [mx[2], mx[1]];
  const cells: (number | null)[][] = Array.from({ length: h }, () => Array(w).fill(null));
  for (const v of n) {
    const [c, r, d] = map(v);
    if (cells[r][c] == null || d > (cells[r][c] as number)) cells[r][c] = d;
  }
  return { w, h, cells };
}
export const projKey = (p: Projection) => `${p.w}x${p.h}:` + p.cells.map((r) => r.map((c) => (c == null ? '.' : c)).join(',')).join('|');
/** Silhouette + depth-edge key; two drawings that look identical share a key. */
export function drawingKey(p: Projection) {
  const segs = projectionEdges(p)
    .map((s) => s.join(','))
    .sort();
  return `${p.w}x${p.h}|${segs.join(';')}`;
}
export function mirrorProjection(p: Projection): Projection {
  return { w: p.w, h: p.h, cells: p.cells.map((r) => [...r].reverse()) };
}

/** Visible edge segments (in cell units) where occupancy or depth changes. */
export function projectionEdges(p: Projection): [number, number, number, number][] {
  const segs: [number, number, number, number][] = [];
  const at = (r: number, c: number) => (r < 0 || c < 0 || r >= p.h || c >= p.w ? null : p.cells[r][c]);
  for (let r = 0; r <= p.h; r++)
    for (let c = 0; c < p.w; c++) {
      const a = at(r - 1, c),
        b = at(r, c);
      if (a !== b && (a != null || b != null)) segs.push([c, r, c + 1, r]);
    }
  for (let c = 0; c <= p.w; c++)
    for (let r = 0; r < p.h; r++) {
      const a = at(r, c - 1),
        b = at(r, c);
      if (a !== b && (a != null || b != null)) segs.push([c, r, c, r + 1]);
    }
  return segs;
}
