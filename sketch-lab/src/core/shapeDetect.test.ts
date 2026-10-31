import { describe, expect, it } from 'vitest';
import { detectShape, squareUp } from './shapeDetect';
import { interiorAngles, sideLengths, type Vec } from './geometry';

// deterministic pseudo-random wobble so tests are repeatable
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;

function wobble(pts: Vec[], amp: number): Vec[] {
  return pts.map((p) => ({ x: p.x + rnd() * amp, y: p.y + rnd() * amp }));
}

function polyStroke(corners: Vec[], perSide = 25, close = true): Vec[] {
  const out: Vec[] = [];
  const n = corners.length;
  for (let i = 0; i < (close ? n : n - 1); i++) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    for (let k = 0; k < perSide; k++) out.push({ x: a.x + ((b.x - a.x) * k) / perSide, y: a.y + ((b.y - a.y) * k) / perSide });
  }
  out.push(close ? { ...corners[0] } : { ...corners[n - 1] });
  return out;
}

const circle = (cx: number, cy: number, r: number, n = 80, sweep = 352) =>
  Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos((sweep * i * Math.PI) / 180 / (n - 1)), y: cy + r * Math.sin((sweep * i * Math.PI) / 180 / (n - 1)) }));

describe('detectShape', () => {
  it('recognises a wobbly circle', () => {
    for (const r of [40, 90, 150]) {
      const d = detectShape(wobble(circle(300, 250, r), r * 0.06));
      expect(d.kind).toBe('circle');
      expect(Math.abs(d.r! - r) / r).toBeLessThan(0.06);
    }
  });
  it('recognises rectangles and squares', () => {
    const rect = detectShape(wobble(polyStroke([{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 260 }, { x: 100, y: 260 }]), 5));
    expect(rect.kind).toBe('rectangle');
    const sq = detectShape(wobble(polyStroke([{ x: 100, y: 100 }, { x: 260, y: 100 }, { x: 260, y: 260 }, { x: 100, y: 260 }]), 4));
    expect(sq.kind).toBe('rectangle');
  });
  it('recognises a rotated rectangle', () => {
    const c = [{ x: 200, y: 100 }, { x: 400, y: 220 }, { x: 340, y: 320 }, { x: 140, y: 200 }];
    expect(detectShape(wobble(polyStroke(c), 4)).kind).toBe('rectangle');
  });
  it('recognises triangles', () => {
    const t = detectShape(wobble(polyStroke([{ x: 100, y: 300 }, { x: 400, y: 300 }, { x: 220, y: 80 }]), 5));
    expect(t.kind).toBe('triangle');
    const a = interiorAngles(t.pts).reduce((s, x) => s + x, 0);
    expect(a).toBeCloseTo(180, 0);
  });
  it('recognises a hexagon as a polygon, not a circle', () => {
    const hex = Array.from({ length: 6 }, (_, i) => ({ x: 300 + 120 * Math.cos((i * Math.PI) / 3), y: 250 + 120 * Math.sin((i * Math.PI) / 3) }));
    const d = detectShape(wobble(polyStroke(hex, 20), 3));
    expect(d.kind).toBe('polygon');
    expect(d.pts.length).toBe(6);
  });
  it('recognises lines and open curves', () => {
    expect(detectShape(wobble(polyStroke([{ x: 50, y: 50 }, { x: 450, y: 210 }], 40, false), 4)).kind).toBe('line');
    expect(detectShape(circle(300, 250, 100, 60, 180)).kind).toBe('freeform');
  });
  it('squareUp makes exact right angles and keeps size', () => {
    const q = squareUp([{ x: 100, y: 102 }, { x: 302, y: 98 }, { x: 299, y: 201 }, { x: 98, y: 199 }]);
    interiorAngles(q).forEach((a) => expect(a).toBeCloseTo(90, 5));
    const s = sideLengths(q);
    expect(s[0]).toBeCloseTo(201.5, 0);
    expect(s[1]).toBeCloseTo(100, 0);
  });
});
