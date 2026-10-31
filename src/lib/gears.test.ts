import { describe, expect, it } from 'vitest';
import { gearGeom, gearOutline, meshAngle, phaseAt } from './gears';

describe('involute gears', () => {
  it('has the right radii', () => {
    const g = gearGeom(20, 3);
    expect(g.r).toBe(30);
    expect(g.ra).toBe(33);
    expect(g.rf).toBeCloseTo(26.25);
  });
  it('produces an outline between root and tip radius', () => {
    const pts = gearOutline(12, 2);
    const rs = pts.map(([x, y]) => Math.hypot(x, y));
    expect(Math.max(...rs)).toBeCloseTo(14, 5);
    expect(Math.min(...rs)).toBeCloseTo(12 - 2.5, 5);
  });
  it('meshes a tooth into a gap and stays meshed while turning', () => {
    const z1 = 15, z2 = 32;
    const t2 = meshAngle(0, 0, z1, z2);
    for (const d of [0, 0.1, 0.37, 1.2]) {
      const th1 = d, th2 = t2 - (z1 / z2) * d;
      const s = phaseAt(0, th1, z1) + phaseAt(Math.PI, th2, z2);
      expect(Math.abs(((s % 1) + 1) % 1 - 0.5)).toBeLessThan(1e-9);
    }
  });
});
