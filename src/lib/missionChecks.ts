import * as THREE from 'three';
import { objectBox, objectSize, type SceneObject } from './shapes';
import type { Vec3 } from './types';

export function sceneBox(flat: SceneObject[]) {
  const b = new THREE.Box3();
  for (const o of flat) b.union(objectBox(o));
  return b;
}
export function boxSize(b: THREE.Box3): Vec3 {
  if (b.isEmpty()) return [0, 0, 0];
  const s = new THREE.Vector3();
  b.getSize(s);
  return [s.x, s.y, s.z];
}
export const byName = (flat: SceneObject[], name: string) => flat.find((o) => o.name.toLowerCase() === name.toLowerCase());

/** Count tool solids that were subtracted (at any depth of the Boolean tree) and satisfy a predicate. */
export function countCutters(objs: SceneObject[], pred: (tool: SceneObject) => boolean): number {
  let n = 0;
  const walk = (o: SceneObject) => {
    if (o.type !== 'csg' || !o.csg) return;
    if (o.csg.op === 'subtract' && pred(o.csg.b)) n++;
    walk(o.csg.a);
    walk(o.csg.b);
  };
  objs.forEach(walk);
  return n;
}

export const cylDia = (o: SceneObject) => (o.type === 'cylinder' ? 2 * o.dims.r * Math.abs(o.scale[0]) : 0);

export function inside(inner: SceneObject, outer: SceneObject, margin = 0) {
  const a = objectBox(inner),
    b = objectBox(outer).expandByScalar(-margin);
  return b.containsBox(a);
}
/** Inside an ellipsoid shell (a sphere primitive with non-uniform scale), checking all bounding-box corners. */
export function insideEllipsoid(inner: SceneObject, shell: SceneObject, margin = 0) {
  const s = objectSize(shell).map((v) => v / 2 - margin);
  const c = shell.position;
  const b = objectBox(inner);
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) if (((x - c[0]) / s[0]) ** 2 + ((y - c[1]) / s[1]) ** 2 + ((z - c[2]) / s[2]) ** 2 > 1) return false;
  return true;
}
export function overlaps(a: SceneObject, b: SceneObject, slack = 0.2) {
  return objectBox(a).expandByScalar(-slack).intersectsBox(objectBox(b).expandByScalar(-slack));
}
