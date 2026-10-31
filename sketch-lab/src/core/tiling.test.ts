import { describe, expect, it } from 'vitest';
import { partition, rotateCells } from './tiling';

describe('partition', () => {
  it('always covers the tray exactly once', () => {
    for (const [c, r, p] of [[4, 3, 3], [5, 4, 5], [6, 5, 6]]) {
      for (let k = 0; k < 20; k++) {
        const pieces = partition(c, r, p);
        const seen = new Set<string>();
        for (const pc of pieces) for (const [x, y] of pc.cells) {
          const key = `${x + pc.home[0]},${y + pc.home[1]}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
        expect(seen.size).toBe(c * r);
        expect(pieces.every((pc) => pc.cells.length >= 2)).toBe(true);
      }
    }
  });
  it('rotating four times gives the same piece', () => {
    const L: [number, number][] = [[0, 0], [0, 1], [0, 2], [1, 2]];
    expect(rotateCells(rotateCells(rotateCells(rotateCells(L))))).toEqual(L);
    expect(rotateCells(L)).not.toEqual(L);
  });
});
