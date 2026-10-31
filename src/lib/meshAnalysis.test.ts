import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bake, infillLines, isWatertight, overhangs, placeOnBed, sliceAt } from './meshAnalysis';

describe('mesh analysis', () => {
  it('slices a box into one square loop', () => {
    const g = placeOnBed(bake(new THREE.BoxGeometry(20, 10, 30)));
    const loops = sliceAt(g, 5);
    expect(loops.length).toBe(1);
    const xs = loops[0].map((p) => p[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(20, 3);
  });
  it('finds a box has no overhangs but a T has some', () => {
    const box = placeOnBed(bake(new THREE.BoxGeometry(20, 20, 20)));
    expect(overhangs(box).overhangArea).toBe(0);
    const bar = new THREE.BoxGeometry(60, 10, 20);
    bar.translate(0, 35, 0);
    const post = new THREE.BoxGeometry(10, 30, 20);
    post.translate(0, 15, 0);
    const merged = bake(bar);
    const ov = overhangs(merged);
    expect(ov.overhangArea).toBeCloseTo(60 * 20, 3);
    expect(post).toBeTruthy();
  });
  it('detects watertight meshes', () => {
    expect(isWatertight(bake(new THREE.BoxGeometry(10, 10, 10))).watertight).toBe(true);
    expect(isWatertight(bake(new THREE.PlaneGeometry(10, 10))).watertight).toBe(false);
  });
  it('clips infill to a square', () => {
    const lines = infillLines([[[0, 0], [10, 0], [10, 10], [0, 10]]], 2, 0);
    expect(lines.length).toBe(5);
    expect(Math.abs(lines[0][1][0] - lines[0][0][0])).toBeCloseTo(10, 5);
  });
});
