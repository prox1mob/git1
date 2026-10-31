import { describe, expect, it } from 'vitest';
import {
  contrastRatio, deltaE2000, hexToRgb, hslToRgb, rgbToHex, rgbToHsl, rgbToLab, srgbToLinear, linearToSrgb,
  whiteBalanceMatrix, castMatrix, mat3Apply, solveWhiteBalance, LOG_CURVES, linToOklab, oklabToLin, temperatureOf, labToRgb,
} from '../color';

describe('CIEDE2000 (Sharma 2005 test data)', () => {
  const pairs: [number[], number[], number][] = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.5, 0], [56, -27, -3], 31.903],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
    [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381],
  ];
  it.each(pairs)('%j vs %j', (a, b, expected) => {
    expect(deltaE2000(a as never, b as never)).toBeCloseTo(expected, 3);
  });
});

describe('conversions', () => {
  it('hex round trip', () => {
    expect(rgbToHex(hexToRgb('#3a7bd5')!)).toBe('#3A7BD5');
    expect(hexToRgb('#fff')).toEqual([1, 1, 1]);
    expect(hexToRgb('nope')).toBeNull();
  });
  it('hsl round trip', () => {
    const c = hexToRgb('#C0563A')!;
    const back = hslToRgb(rgbToHsl(c));
    back.forEach((v, i) => expect(v).toBeCloseTo(c[i], 6));
  });
  it('sRGB transfer round trip', () => {
    for (const v of [0, 0.002, 0.04, 0.18, 0.5, 1]) expect(srgbToLinear(linearToSrgb(v))).toBeCloseTo(v, 9);
  });
  it('white is L*100, mid grey ~L*53', () => {
    expect(rgbToLab([1, 1, 1])[0]).toBeCloseTo(100, 2);
    expect(rgbToLab([0.5, 0.5, 0.5])[0]).toBeCloseTo(53.39, 1);
  });
  it('Lab round trip', () => {
    const c = hexToRgb('#4C9A3A')!;
    labToRgb(rgbToLab(c)).forEach((v, i) => expect(v).toBeCloseTo(c[i], 5));
  });
  it('Oklab round trip and white', () => {
    expect(linToOklab([1, 1, 1])[0]).toBeCloseTo(1, 3);
    const v: [number, number, number] = [0.2, 0.5, 0.1];
    oklabToLin(linToOklab(v)).forEach((x, i) => expect(x).toBeCloseTo(v[i], 6));
  });
});

describe('WCAG', () => {
  it('black on white is 21:1', () => expect(contrastRatio([0, 0, 0], [1, 1, 1])).toBeCloseTo(21, 5));
  it('#777 on white is ~4.48', () => expect(contrastRatio(hexToRgb('#777777')!, [1, 1, 1])).toBeCloseTo(4.48, 2));
});

describe('white balance', () => {
  it('is identity at neutral', () => {
    const m = whiteBalanceMatrix(6504, 0);
    [1, 0, 0, 0, 1, 0, 0, 0, 1].forEach((v, i) => expect(m[i]).toBeCloseTo(v, 6));
  });
  it('low temperature setting cools the image', () => {
    const [r, , b] = mat3Apply(whiteBalanceMatrix(3200, 0), [0.5, 0.5, 0.5]);
    expect(b).toBeGreaterThan(r);
  });
  it('cast then matching correction is neutral', () => {
    const cast = mat3Apply(castMatrix(3200, 20), [0.18, 0.18, 0.18]);
    const fixed = mat3Apply(whiteBalanceMatrix(3200, 20), cast);
    fixed.forEach((v) => expect(v).toBeCloseTo(0.18, 6));
  });
  it('eyedropper solver recovers the cast', () => {
    const cast = mat3Apply(castMatrix(3800, -30), [0.18, 0.18, 0.18]);
    const s = solveWhiteBalance(cast);
    expect(Math.abs(s.temp - 3800)).toBeLessThan(120);
    expect(Math.abs(s.tint + 30)).toBeLessThan(4);
  });
});

describe('log curves', () => {
  it.each(Object.entries(LOG_CURVES))('%s round trips', (_, c) => {
    for (const x of [0, 0.005, 0.18, 1, 8]) expect(c.decode(c.encode(x))).toBeCloseTo(x, 5);
  });
  it('places 18% grey where the white papers say', () => {
    expect(LOG_CURVES.slog3.encode(0.18)).toBeCloseTo(420 / 1023, 4);
    expect(LOG_CURVES.logc3.encode(0.18)).toBeCloseTo(0.391, 2);
    expect(LOG_CURVES.vlog.encode(0.18)).toBeCloseTo(0.423, 2);
  });
});

describe('temperature classification', () => {
  it('works on obvious colours', () => {
    expect(temperatureOf(hexToRgb('#E8622C')!)).toBe('warm');
    expect(temperatureOf(hexToRgb('#2E5FD1')!)).toBe('cool');
    expect(temperatureOf(hexToRgb('#8C8C8A')!)).toBe('neutral');
  });
});
