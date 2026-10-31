import * as THREE from 'three';
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';
import type { Vec2, Vec3 } from './types';

/** All dimensions are in millimetres. 1 scene unit = 1 mm. */
export type PrimType = 'box' | 'sphere' | 'cylinder' | 'cone' | 'prism' | 'torus' | 'extrusion' | 'lathe' | 'csg' | 'group';

export interface MaterialSpec {
  preset: string;
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
}

export interface ExtrusionParams {
  outline: Vec2[];
  holes: Vec2[][];
  depth: number;
  bevel: number;
}
export interface LatheParams {
  profile: Vec2[]; // (radius, height) pairs
  angle: number; // degrees
  segments: number;
}
export interface CsgParams {
  op: 'union' | 'subtract' | 'intersect';
  a: SceneObject;
  b: SceneObject;
}

export interface SceneObject {
  id: string;
  name: string;
  type: PrimType;
  parentId: string | null;
  position: Vec3;
  rotation: Vec3; // radians, XYZ euler
  scale: Vec3;
  /** Dimensional parameters by type: box {w,h,d}, sphere {r}, cylinder/cone {r,h}, prism {r,h,sides}, torus {R,r} */
  dims: Record<string, number>;
  extrusion?: ExtrusionParams;
  lathe?: LatheParams;
  csg?: CsgParams;
  material: MaterialSpec;
  visible: boolean;
}

export const DEFAULT_DIMS: Record<string, Record<string, number>> = {
  box: { w: 20, h: 20, d: 20 },
  sphere: { r: 10 },
  cylinder: { r: 10, h: 20 },
  cone: { r: 10, h: 20 },
  prism: { r: 10, h: 20, sides: 3 },
  torus: { R: 12, r: 4 },
  group: {},
  extrusion: {},
  lathe: {},
  csg: {},
};

export const PRIM_LABEL: Record<PrimType, string> = {
  box: 'Cube / Box',
  sphere: 'Sphere',
  cylinder: 'Cylinder',
  cone: 'Cone',
  prism: 'Prism',
  torus: 'Torus',
  extrusion: 'Extrusion',
  lathe: 'Revolve',
  csg: 'Boolean',
  group: 'Group',
};

export const DIM_LABELS: Record<string, string> = {
  w: 'Width (X)',
  h: 'Height (Y)',
  d: 'Depth (Z)',
  r: 'Radius',
  R: 'Ring radius',
  sides: 'Sides',
};

export const PALETTE = ['#4cc9f0', '#f8961e', '#90be6d', '#f94144', '#9b5de5', '#ffd166', '#43aa8b', '#e9edf2', '#577590', '#b5838d'];

export function defaultMaterial(color = '#4cc9f0'): MaterialSpec {
  return { preset: 'plastic', color, roughness: 0.45, metalness: 0, opacity: 1 };
}

let counter = 0;
export const newId = () => `o${Date.now().toString(36)}${(counter++).toString(36)}`;

export function makeObject(type: PrimType, partial: Partial<SceneObject> = {}): SceneObject {
  return {
    id: newId(),
    name: PRIM_LABEL[type],
    type,
    parentId: null,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    dims: { ...DEFAULT_DIMS[type] },
    material: defaultMaterial(),
    visible: true,
    ...partial,
  };
}

/** Height of the object's own geometry below its origin (so it can sit on the ground). */
export function baseOffset(o: SceneObject) {
  const d = o.dims;
  switch (o.type) {
    case 'box':
      return (d.h / 2) * o.scale[1];
    case 'sphere':
      return d.r * o.scale[1];
    case 'cylinder':
    case 'cone':
    case 'prism':
      return (d.h / 2) * o.scale[1];
    case 'torus':
      return d.r * o.scale[1];
    default:
      return 0;
  }
}

/* -------------------- Geometry -------------------- */

const geoCache = new Map<string, THREE.BufferGeometry>();

function shapeFromPoints(outline: Vec2[], holes: Vec2[][] = []) {
  const s = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return s;
}

export function extrusionGeometry(p: ExtrusionParams) {
  const bevel = Math.max(0, Math.min(p.bevel, p.depth / 2 - 0.01));
  const g = new THREE.ExtrudeGeometry(shapeFromPoints(p.outline, p.holes), {
    depth: Math.max(0.01, p.depth - 2 * bevel),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: bevel > 0 ? 4 : 0,
    curveSegments: 24,
  });
  // Extrude along +Z from z=0; centre it so the sketch plane is the mid-plane.
  g.translate(0, 0, bevel - p.depth / 2);
  g.computeVertexNormals();
  return g;
}

export function latheGeometry(p: LatheParams) {
  const pts = p.profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  const g = new THREE.LatheGeometry(pts, p.segments, 0, (p.angle * Math.PI) / 180);
  g.computeVertexNormals();
  return g;
}

/** Build (uncached) geometry for one object in its local frame (scale not applied). */
export function buildGeometry(o: SceneObject): THREE.BufferGeometry {
  const d = o.dims;
  switch (o.type) {
    case 'box':
      return new THREE.BoxGeometry(d.w, d.h, d.d);
    case 'sphere':
      return new THREE.SphereGeometry(d.r, 40, 24);
    case 'cylinder':
      return new THREE.CylinderGeometry(d.r, d.r, d.h, 40, 1);
    case 'cone':
      return new THREE.ConeGeometry(d.r, d.h, 40, 1);
    case 'prism': {
      const g = new THREE.CylinderGeometry(d.r, d.r, d.h, Math.round(d.sides || 3), 1);
      return g;
    }
    case 'torus':
      return new THREE.TorusGeometry(d.R, d.r, 20, 48);
    case 'extrusion':
      return extrusionGeometry(o.extrusion!);
    case 'lathe':
      return latheGeometry(o.lathe!);
    case 'csg':
      return csgGeometry(o.csg!);
    default:
      return new THREE.BufferGeometry();
  }
}

export function geometryKey(o: SceneObject): string {
  return JSON.stringify([o.type, o.dims, o.extrusion, o.lathe, o.csg ? csgKey(o.csg) : null]);
}
function csgKey(c: CsgParams): unknown {
  return [c.op, geometryKey(c.a), c.a.position, c.a.rotation, c.a.scale, geometryKey(c.b), c.b.position, c.b.rotation, c.b.scale];
}

/** Cached geometry; do not dispose the returned object. */
export function getGeometry(o: SceneObject): THREE.BufferGeometry {
  const k = geometryKey(o);
  let g = geoCache.get(k);
  if (!g) {
    g = buildGeometry(o);
    if (geoCache.size > 300) {
      const first = geoCache.keys().next().value as string;
      geoCache.get(first)?.dispose();
      geoCache.delete(first);
    }
    geoCache.set(k, g);
  }
  return g;
}

/* -------------------- CSG -------------------- */
const evaluator = new Evaluator();
evaluator.useGroups = false;
evaluator.attributes = ['position', 'normal'];

function toBrush(o: SceneObject) {
  const g = getGeometry(o).clone();
  if (g.index) {
    const ng = g.toNonIndexed();
    g.dispose();
    for (const k of Object.keys(ng.attributes)) if (k !== 'position' && k !== 'normal') ng.deleteAttribute(k);
    const b = new Brush(ng);
    applyTransform(b, o);
    return b;
  }
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const b = new Brush(g);
  applyTransform(b, o);
  return b;
}
function applyTransform(obj: THREE.Object3D, o: SceneObject) {
  obj.position.set(...o.position);
  obj.rotation.set(...o.rotation);
  obj.scale.set(...o.scale);
  obj.updateMatrixWorld(true);
}

export function csgGeometry(c: CsgParams): THREE.BufferGeometry {
  const op = c.op === 'union' ? ADDITION : c.op === 'subtract' ? SUBTRACTION : INTERSECTION;
  try {
    const a = toBrush(c.a);
    const b = toBrush(c.b);
    const r = evaluator.evaluate(a, b, op);
    const g = r.geometry;
    g.computeVertexNormals();
    return g;
  } catch (e) {
    console.warn('CSG failed', e);
    return new THREE.BufferGeometry();
  }
}

/** Generic CSG on raw geometries (already positioned in a shared frame). */
export function csgRaw(base: THREE.BufferGeometry, tools: THREE.BufferGeometry[], op: 'union' | 'subtract' | 'intersect' = 'subtract') {
  const prep = (g0: THREE.BufferGeometry) => {
    let g = g0.index ? g0.toNonIndexed() : g0.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    return new Brush(g);
  };
  const o = op === 'union' ? ADDITION : op === 'subtract' ? SUBTRACTION : INTERSECTION;
  let cur = prep(base);
  cur.updateMatrixWorld();
  for (const t of tools) {
    const b = prep(t);
    b.updateMatrixWorld();
    cur = evaluator.evaluate(cur, b, o);
  }
  cur.geometry.computeVertexNormals();
  return cur.geometry;
}

/* -------------------- Measurements -------------------- */

export function analyticVolume(o: SceneObject): number | null {
  const d = o.dims;
  const [sx, sy, sz] = o.scale;
  const s = Math.abs(sx * sy * sz);
  switch (o.type) {
    case 'box':
      return d.w * d.h * d.d * s;
    case 'sphere':
      return (4 / 3) * Math.PI * d.r ** 3 * s;
    case 'cylinder':
      return Math.PI * d.r ** 2 * d.h * s;
    case 'cone':
      return (Math.PI * d.r ** 2 * d.h * s) / 3;
    case 'prism': {
      const n = Math.round(d.sides || 3);
      const area = 0.5 * n * d.r * d.r * Math.sin((2 * Math.PI) / n);
      return area * d.h * s;
    }
    case 'torus':
      return 2 * Math.PI * Math.PI * d.R * d.r * d.r * s;
    default:
      return null;
  }
}

export function analyticArea(o: SceneObject): number | null {
  const d = o.dims;
  const uniform = Math.abs(o.scale[0] - o.scale[1]) < 1e-6 && Math.abs(o.scale[1] - o.scale[2]) < 1e-6;
  if (!uniform) return null;
  const k = o.scale[0] ** 2;
  switch (o.type) {
    case 'box':
      return 2 * (d.w * d.h + d.w * d.d + d.h * d.d) * k;
    case 'sphere':
      return 4 * Math.PI * d.r ** 2 * k;
    case 'cylinder':
      return (2 * Math.PI * d.r * d.h + 2 * Math.PI * d.r ** 2) * k;
    case 'cone':
      return (Math.PI * d.r * Math.hypot(d.r, d.h) + Math.PI * d.r ** 2) * k;
    case 'torus':
      return 4 * Math.PI * Math.PI * d.R * d.r * k;
    default:
      return null;
  }
}

/** Signed-tetrahedron volume and triangle area from a mesh geometry (with an optional matrix). */
export function meshVolumeArea(g: THREE.BufferGeometry, m?: THREE.Matrix4) {
  const pos = g.attributes.position;
  if (!pos) return { volume: 0, area: 0 };
  const idx = g.index;
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  const ab = new THREE.Vector3(),
    ac = new THREE.Vector3();
  let vol = 0,
    area = 0;
  const n = idx ? idx.count : pos.count;
  for (let i = 0; i < n; i += 3) {
    const i0 = idx ? idx.getX(i) : i,
      i1 = idx ? idx.getX(i + 1) : i + 1,
      i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    if (m) {
      a.applyMatrix4(m);
      b.applyMatrix4(m);
      c.applyMatrix4(m);
    }
    vol += a.dot(ab.copy(b).cross(c)) / 6;
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    area += ab.cross(ac).length() / 2;
  }
  return { volume: Math.abs(vol), area };
}

export function objectMatrix(o: SceneObject) {
  return new THREE.Matrix4().compose(new THREE.Vector3(...o.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation)), new THREE.Vector3(...o.scale));
}

export function objectVolume(o: SceneObject) {
  const a = analyticVolume(o);
  if (a != null) return a;
  const s = new THREE.Matrix4().makeScale(...o.scale);
  return meshVolumeArea(getGeometry(o), s).volume;
}
export function objectArea(o: SceneObject) {
  const a = analyticArea(o);
  if (a != null) return a;
  const s = new THREE.Matrix4().makeScale(...o.scale);
  return meshVolumeArea(getGeometry(o), s).area;
}

/** World-space bounding box of an object (ignores parents). */
export function objectBox(o: SceneObject, parentMatrix?: THREE.Matrix4) {
  const g = getGeometry(o);
  if (!g.boundingBox) g.computeBoundingBox();
  const m = objectMatrix(o);
  if (parentMatrix) m.premultiply(parentMatrix);
  return g.boundingBox!.clone().applyMatrix4(m);
}

/** Size of the object along its own axes, in mm (scale applied). */
export function objectSize(o: SceneObject): Vec3 {
  const g = getGeometry(o);
  if (!g.boundingBox) g.computeBoundingBox();
  const s = new THREE.Vector3();
  g.boundingBox!.getSize(s);
  return [s.x * Math.abs(o.scale[0]), s.y * Math.abs(o.scale[1]), s.z * Math.abs(o.scale[2])];
}

export function triangleCount(g: THREE.BufferGeometry) {
  return Math.round((g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3);
}

/** Merge scale into dimensional params where it is lossless (keeps dims meaningful). */
export function bakeScale(o: SceneObject): SceneObject {
  const [sx, sy, sz] = o.scale;
  const d = { ...o.dims };
  const eq = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  switch (o.type) {
    case 'box':
      d.w *= Math.abs(sx);
      d.h *= Math.abs(sy);
      d.d *= Math.abs(sz);
      return { ...o, dims: d, scale: [1, 1, 1] };
    case 'sphere':
      if (eq(sx, sy) && eq(sy, sz)) return { ...o, dims: { r: d.r * Math.abs(sx) }, scale: [1, 1, 1] };
      return o;
    case 'cylinder':
    case 'cone':
    case 'prism':
      if (eq(sx, sz)) return { ...o, dims: { ...d, r: d.r * Math.abs(sx), h: d.h * Math.abs(sy) }, scale: [1, 1, 1] };
      return o;
    case 'torus':
      if (eq(sx, sy) && eq(sy, sz)) return { ...o, dims: { R: d.R * Math.abs(sx), r: d.r * Math.abs(sx) }, scale: [1, 1, 1] };
      return o;
    default:
      return o;
  }
}
