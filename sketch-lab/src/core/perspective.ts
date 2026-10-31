import type { Vec } from './geometry';

/** A pin-hole camera that looks horizontally (no pitch), so the horizon is the row v0. */
export interface Cam {
  x: number;
  y: number; // eye height
  z: number;
  /** degrees; 0 = looking along +Z, positive turns towards +X */
  yaw: number;
  /** focal length in screen pixels */
  f: number;
  u0: number;
  v0: number;
}

export interface P3 {
  x: number;
  y: number;
  z: number;
}

const rad = (d: number) => (d * Math.PI) / 180;

/** World point → camera coordinates (x right, y up, z forward). */
export function toCam(c: Cam, p: P3): P3 {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const dz = p.z - c.z;
  const s = Math.sin(rad(c.yaw));
  const k = Math.cos(rad(c.yaw));
  return { x: dx * k - dz * s, y: dy, z: dx * s + dz * k };
}

/** Perspective projection: u = u0 + f·x/z, v = v0 − f·y/z. Null when behind the camera. */
export function project(c: Cam, p: P3, near = 0.05): Vec | null {
  const q = toCam(c, p);
  if (q.z <= near) return null;
  return { x: c.u0 + (c.f * q.x) / q.z, y: c.v0 - (c.f * q.y) / q.z };
}

/** Project a 3D segment, clipping the part that is behind the camera. */
export function projectSegment(c: Cam, a: P3, b: P3, near = 0.05): [Vec, Vec] | null {
  let p = toCam(c, a);
  let q = toCam(c, b);
  if (p.z <= near && q.z <= near) return null;
  if (p.z <= near || q.z <= near) {
    const t = (near - p.z) / (q.z - p.z);
    const m = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: near };
    if (p.z <= near) p = m;
    else q = m;
  }
  const s = (r: P3): Vec => ({ x: c.u0 + (c.f * r.x) / r.z, y: c.v0 - (c.f * r.y) / r.z });
  return [s(p), s(q)];
}

/** Where all lines with direction `dir` appear to meet. Null when the direction is parallel to the picture. */
export function vanishingPoint(c: Cam, dir: P3): Vec | null {
  const s = Math.sin(rad(c.yaw));
  const k = Math.cos(rad(c.yaw));
  const x = dir.x * k - dir.z * s;
  const z = dir.x * s + dir.z * k;
  if (Math.abs(z) < 1e-6) return null;
  const sign = z > 0 ? 1 : -1;
  return { x: c.u0 + (c.f * x * sign) / Math.abs(z), y: c.v0 - (c.f * dir.y * sign) / Math.abs(z) };
}

/** 8 corners of a box standing on the ground, centred at (cx, cz), turned by yaw degrees. */
export function boxCorners(cx: number, cz: number, w: number, h: number, d: number, yaw: number, y0 = 0): P3[] {
  const s = Math.sin(rad(yaw));
  const k = Math.cos(rad(yaw));
  const out: P3[] = [];
  for (const ly of [y0, y0 + h])
    for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]])
      out.push({ x: cx + lx * k + lz * s, y: ly, z: cz - lx * s + lz * k });
  return out;
}

/** Index pairs for the 12 edges of boxCorners(). */
export const BOX_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/** The two horizontal edge directions of a box turned by yaw. */
export function boxDirections(yaw: number): [P3, P3] {
  const s = Math.sin(rad(yaw));
  const k = Math.cos(rad(yaw));
  return [{ x: k, y: 0, z: -s }, { x: s, y: 0, z: k }];
}
