import * as THREE from 'three';
import type { Vec2 } from './types';

/** Copy a geometry with a matrix applied, non-indexed (positions only). */
export function bake(g: THREE.BufferGeometry, m?: THREE.Matrix4) {
  const out = (g.index ? g.toNonIndexed() : g.clone()) as THREE.BufferGeometry;
  if (m) out.applyMatrix4(m);
  for (const k of Object.keys(out.attributes)) if (k !== 'position') out.deleteAttribute(k);
  out.computeVertexNormals();
  out.computeBoundingBox();
  return out;
}

/** Translate so the lowest point sits on y = 0 and the part is centred on X/Z. */
export function placeOnBed(g: THREE.BufferGeometry) {
  g.computeBoundingBox();
  const b = g.boundingBox!;
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.computeBoundingBox();
  return g;
}

export interface OverhangInfo {
  overhangArea: number;
  supportVolume: number;
  totalArea: number;
  colors: Float32Array;
}

/**
 * Faces whose normal points downward more steeply than the critical angle (from vertical)
 * need support, unless they rest on the build plate.
 */
export function overhangs(g: THREE.BufferGeometry, criticalDeg = 45): OverhangInfo {
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    n = new THREE.Vector3(),
    e1 = new THREE.Vector3(),
    e2 = new THREE.Vector3();
  const limit = -Math.sin((criticalDeg * Math.PI) / 180);
  let overhangArea = 0,
    supportVolume = 0,
    totalArea = 0;
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    e1.subVectors(b, a);
    e2.subVectors(c, a);
    n.crossVectors(e1, e2);
    const area = n.length() / 2;
    totalArea += area;
    n.normalize();
    const cy = (a.y + b.y + c.y) / 3;
    const over = n.y < limit && cy > 0.3;
    if (over) {
      overhangArea += area;
      supportVolume += area * Math.abs(n.y) * cy;
    }
    const col = over ? [0.97, 0.32, 0.29] : [0.83, 0.86, 0.9];
    for (let k = 0; k < 3; k++) colors.set(col, (i + k) * 3);
  }
  return { overhangArea, supportVolume, totalArea, colors };
}

/** Intersect a triangle mesh with the horizontal plane y = h and join the segments into loops (X–Z). */
export function sliceAt(g: THREE.BufferGeometry, h: number): Vec2[][] {
  const pos = g.attributes.position;
  const segs: [Vec2, Vec2][] = [];
  const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let i = 0; i < pos.count; i += 3) {
    for (let k = 0; k < 3; k++) p[k].fromBufferAttribute(pos, i + k);
    const pts: Vec2[] = [];
    for (let k = 0; k < 3; k++) {
      const u = p[k],
        v = p[(k + 1) % 3];
      const du = u.y - h,
        dv = v.y - h;
      if ((du < 0 && dv >= 0) || (du >= 0 && dv < 0)) {
        const t = du / (du - dv);
        pts.push([u.x + (v.x - u.x) * t, u.z + (v.z - u.z) * t]);
      }
    }
    if (pts.length === 2) segs.push([pts[0], pts[1]]);
  }
  // join segments by matching endpoints
  const key = (q: Vec2) => `${Math.round(q[0] * 1000)},${Math.round(q[1] * 1000)}`;
  const byStart = new Map<string, number[]>();
  segs.forEach((s, i) => {
    for (const e of [s[0], s[1]]) {
      const k = key(e);
      byStart.set(k, [...(byStart.get(k) ?? []), i]);
    }
  });
  const used = new Set<number>();
  const loops: Vec2[][] = [];
  for (let i = 0; i < segs.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const loop: Vec2[] = [segs[i][0], segs[i][1]];
    let end = segs[i][1];
    for (let guard = 0; guard < segs.length; guard++) {
      const cand = (byStart.get(key(end)) ?? []).find((j) => !used.has(j));
      if (cand == null) break;
      used.add(cand);
      const s = segs[cand];
      end = key(s[0]) === key(end) ? s[1] : s[0];
      if (key(end) === key(loop[0])) break;
      loop.push(end);
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

/** Infill scan lines (angle in degrees, spacing in mm) clipped to loops with the even–odd rule. */
export function infillLines(loops: Vec2[][], spacing: number, angleDeg = 45): [Vec2, Vec2][] {
  if (!loops.length || spacing <= 0) return [];
  const a = (angleDeg * Math.PI) / 180;
  const ca = Math.cos(a),
    sa = Math.sin(a);
  const rot = (p: Vec2): Vec2 => [p[0] * ca + p[1] * sa, -p[0] * sa + p[1] * ca];
  const unrot = (p: Vec2): Vec2 => [p[0] * ca - p[1] * sa, p[0] * sa + p[1] * ca];
  const R = loops.map((l) => l.map(rot));
  const ys = R.flat().map((p) => p[1]);
  const y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const out: [Vec2, Vec2][] = [];
  for (let y = Math.ceil(y0 / spacing) * spacing; y <= y1; y += spacing) {
    const xs: number[] = [];
    for (const l of R)
      for (let i = 0; i < l.length; i++) {
        const p = l[i],
          q = l[(i + 1) % l.length];
        if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y)) xs.push(p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
      }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) out.push([unrot([xs[i], y]), unrot([xs[i + 1], y])]);
  }
  return out;
}

export const loopLength = (l: Vec2[]) => l.reduce((s, p, i) => s + Math.hypot(l[(i + 1) % l.length][0] - p[0], l[(i + 1) % l.length][1] - p[1]), 0);

/** Every edge shared by exactly two triangles → closed (watertight) surface. */
export function isWatertight(g: THREE.BufferGeometry) {
  const pos = g.attributes.position;
  const vk = (i: number) => `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
  const edges = new Map<string, number>();
  for (let i = 0; i < pos.count; i += 3) {
    const k = [vk(i), vk(i + 1), vk(i + 2)];
    if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) continue;
    for (let e = 0; e < 3; e++) {
      const x = k[e],
        y = k[(e + 1) % 3];
      const id = x < y ? `${x}|${y}` : `${y}|${x}`;
      edges.set(id, (edges.get(id) ?? 0) + 1);
    }
  }
  let open = 0;
  for (const n of edges.values()) if (n !== 2) open++;
  return { watertight: open === 0, openEdges: open, edges: edges.size };
}
