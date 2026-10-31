import { describe, expect, it } from 'vitest';
import { pensThatFit } from './ProductEngineer';

describe('pensThatFit', () => {
  it('counts pens packed in a circle', () => {
    expect(pensThatFit(10).n).toBe(1);
    expect(pensThatFit(9).n).toBe(0);
    const firstTen = [30, 32, 34, 36, 38, 40, 42, 44, 46].find((d) => pensThatFit(d).n >= 10);
    console.log('smallest diameter for 10 pens:', firstTen, [30, 34, 38, 42, 46].map((d) => `${d}:${pensThatFit(d).n}`).join(' '));
    expect(firstTen).toBeDefined();
    // a feasible design exists: 10 pens, 2 mm wall, 80 mm tall, under 40 cm³
    const D = firstTen!;
    const Ro = D / 2 + 2;
    const material = (Math.PI * (Ro * Ro - (D / 2) ** 2) * 80 + Math.PI * Ro * Ro * 2) / 1000;
    expect(material).toBeLessThan(40);
  });
});
