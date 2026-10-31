import { describe, expect, it } from 'vitest';
import { buildBase } from './L10Master';

describe('enclosure base', () => {
  it('keeps the left wall with a port hole', () => {
    const p = { L: 56, W: 36, H: 20, t: 1.2, r: 1, pw: 8, ph: 3, py: 6, bosses: false };
    const g = buildBase(p);
    const pos = g.attributes.position;
    let left = 0, right = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      if (x < -p.L / 2 + p.t + 0.01) left++;
      if (x > p.L / 2 - p.t - 0.01) right++;
    }
    expect(left).toBeGreaterThan(20);
  });
});
