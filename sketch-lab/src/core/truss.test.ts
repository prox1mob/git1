import { describe, expect, it } from 'vitest';
import { solveTruss } from './truss';

describe('solveTruss', () => {
  it('solves a simple triangle (tension below, compression above)', () => {
    const r = solveTruss(
      [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }],
      [{ a: 0, b: 1 }, { a: 0, b: 2 }, { a: 1, b: 2 }],
      [{ node: 0, fx: true, fy: true }, { node: 1, fx: false, fy: true }],
      [{ node: 2, fx: 0, fy: -10 }],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.forces[0]).toBeCloseTo(5, 6);
    expect(r.forces[1]).toBeCloseTo(-10 / Math.SQRT2, 6);
    expect(r.forces[2]).toBeCloseTo(-10 / Math.SQRT2, 6);
  });
  it('detects a mechanism (a square with no diagonal)', () => {
    const r = solveTruss(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
      [{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 }, { a: 3, b: 0 }],
      [{ node: 0, fx: true, fy: true }, { node: 1, fx: false, fy: true }],
      [{ node: 2, fx: 0, fy: -10 }],
    );
    expect(r.ok).toBe(false);
  });
  it('a diagonal makes the square rigid', () => {
    const r = solveTruss(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
      [{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 }, { a: 3, b: 0 }, { a: 0, b: 2 }],
      [{ node: 0, fx: true, fy: true }, { node: 1, fx: false, fy: true }],
      [{ node: 2, fx: 0, fy: -10 }],
    );
    expect(r.ok).toBe(true);
  });
});
