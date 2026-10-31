import { describe, expect, it } from 'vitest';
import { href, parseHash } from './router';

describe('router', () => {
  it('round-trips routes as plain hash names', () => {
    const h = href('math', 'level', 3, 'l3-protractor');
    expect(h).toBe('#math--level--3--l3-protractor');
    expect(/^#[A-Za-z0-9-]+$/.test(h)).toBe(true);
    expect(parseHash(h)).toEqual(['math', 'level', '3', 'l3-protractor']);
  });
  it('still reads the old #/path form', () => {
    expect(parseHash('#/math/puzzles/fit')).toEqual(['math', 'puzzles', 'fit']);
    expect(parseHash('')).toEqual([]);
  });
});
