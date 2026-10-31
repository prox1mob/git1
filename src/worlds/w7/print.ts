import * as THREE from 'three';
import { csgRaw } from '../../lib/shapes';
import { bake, infillLines, loopLength, overhangs, placeOnBed, sliceAt } from '../../lib/meshAnalysis';

/** A T-shaped bracket with a hole: overhangs in some orientations, none in others. */
export function bracketGeometry() {
  const post = new THREE.BoxGeometry(14, 36, 20);
  post.translate(0, 18, 0);
  const bar = new THREE.BoxGeometry(60, 10, 20);
  bar.translate(0, 41, 0);
  const foot = new THREE.BoxGeometry(34, 6, 20);
  foot.translate(0, 3, 0);
  let g = csgRaw(post, [bar, foot], 'union');
  const hole = new THREE.CylinderGeometry(4, 4, 30, 24);
  hole.rotateX(Math.PI / 2);
  hole.translate(-21, 41, 0);
  const hole2 = hole.clone();
  hole2.translate(42, 0, 0);
  g = csgRaw(g, [hole, hole2], 'subtract');
  return g;
}

export const ORIENTATIONS: { name: string; euler: [number, number, number] }[] = [
  { name: 'Upright (as designed)', euler: [0, 0, 0] },
  { name: 'Upside down', euler: [Math.PI, 0, 0] },
  { name: 'Lying on its back', euler: [-Math.PI / 2, 0, 0] },
  { name: 'Lying on its front', euler: [Math.PI / 2, 0, 0] },
  { name: 'On its left side', euler: [0, 0, Math.PI / 2] },
  { name: 'On its right side', euler: [0, 0, -Math.PI / 2] },
];

export function oriented(base: THREE.BufferGeometry, euler: [number, number, number]) {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...euler));
  return placeOnBed(bake(base, m));
}

export interface PrintEstimate {
  layers: number;
  minutes: number;
  supportVolume: number;
  overhangArea: number;
  height: number;
  filament: number; // grams
}

/** Simplified print-time model from real slices: 2 walls at 40 mm/s, infill at 60 mm/s, 2 s per layer change. */
export function estimate(g: THREE.BufferGeometry, layer: number, infillPct: number): PrintEstimate {
  g.computeBoundingBox();
  const H = g.boundingBox!.max.y;
  const layers = Math.max(1, Math.ceil(H / layer));
  let seconds = 0;
  let pathLen = 0;
  const spacing = infillPct > 0 ? 0.45 / (infillPct / 100) : 0;
  const stride = Math.max(1, Math.floor(layers / 80)); // sample long prints
  for (let i = 0; i < layers; i += stride) {
    const loops = sliceAt(g, (i + 0.5) * layer);
    const per = loops.reduce((s, l) => s + loopLength(l), 0) * 2;
    const inf = spacing ? infillLines(loops, spacing).reduce((s, [a, b]) => s + Math.hypot(b[0] - a[0], b[1] - a[1]), 0) : 0;
    seconds += (per / 40 + inf / 60 + 2) * stride;
    pathLen += (per + inf) * stride;
  }
  const ov = overhangs(g);
  const supportLen = (ov.supportVolume * 0.15) / (0.45 * layer);
  seconds += supportLen / 60;
  const filament = ((pathLen + supportLen) * 0.45 * layer * 1.24) / 1000;
  return { layers, minutes: seconds / 60, supportVolume: ov.supportVolume, overhangArea: ov.overhangArea, height: H, filament };
}
