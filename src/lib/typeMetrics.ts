import { useEffect, useState } from 'react';
import { clampWeight, ensureFont, fontById, type FontDef } from './fonts';

/** Vertical metrics as fractions of the font size, measured from real glyph outlines on a canvas. */
export interface TypeMetrics { xHeight: number; capHeight: number; ascender: number; descender: number; strokeContrast: number; avgWidth: number }

const cache = new Map<string, TypeMetrics>();
const SIZE = 200;

function measure(f: FontDef, weight: number): TypeMetrics {
  const c = document.createElement('canvas');
  c.width = 400; c.height = 400;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const family = f.css;
  ctx.font = `${clampWeight(f, weight)} ${SIZE}px ${family}`;
  const up = (s: string) => ctx.measureText(s).actualBoundingBoxAscent / SIZE;
  const down = (s: string) => ctx.measureText(s).actualBoundingBoxDescent / SIZE;
  const isCaps = f.id === 'bebas';
  // Stroke contrast: rasterise an "o" and compare the side stroke with the top stroke.
  ctx.clearRect(0, 0, 400, 400);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(isCaps ? 'O' : 'o', 100, 300);
  const m = ctx.measureText(isCaps ? 'O' : 'o');
  const img = ctx.getImageData(0, 0, 400, 400).data;
  const at = (x: number, y: number) => img[(y * 400 + x) * 4 + 3] > 128;
  const top = Math.round(300 - m.actualBoundingBoxAscent), bottom = Math.round(300 + m.actualBoundingBoxDescent);
  const left = Math.round(100 - m.actualBoundingBoxLeft), right = Math.round(100 + m.actualBoundingBoxRight);
  const cy = Math.round((top + bottom) / 2), cx = Math.round((left + right) / 2);
  let side = 0; for (let x = left; x < cx; x++) if (at(x, cy)) side++; else if (side) break;
  let head = 0; for (let y = top; y < cy; y++) if (at(cx, y)) head++; else if (head) break;
  const sample = 'the quick brown fox jumps over a lazy dog';
  return {
    xHeight: isCaps ? up('H') : up('x'),
    capHeight: up('H'),
    ascender: isCaps ? up('H') : Math.max(up('d'), up('h'), up('l')),
    descender: isCaps ? 0 : Math.max(down('p'), down('g'), down('y')),
    strokeContrast: head > 0 ? side / head : 1,
    avgWidth: ctx.measureText(sample).width / sample.length / SIZE,
  };
}

/** Metrics for a font, after it has loaded. Returns null until ready. */
export function useTypeMetrics(fontId: string, weight = 400): TypeMetrics | null {
  const key = `${fontId}:${weight}`;
  const [m, setM] = useState<TypeMetrics | null>(() => cache.get(key) ?? null);
  useEffect(() => {
    let alive = true;
    const f = fontById(fontId);
    if (cache.has(key)) { setM(cache.get(key)!); return; }
    setM(null);
    ensureFont(f, weight, 'Hxpdgo').then(() => {
      if (!alive) return;
      const r = measure(f, weight);
      cache.set(key, r);
      setM(r);
    });
    return () => { alive = false; };
  }, [key, fontId, weight]);
  return m;
}

export async function getTypeMetrics(fontId: string, weight = 400): Promise<TypeMetrics> {
  const key = `${fontId}:${weight}`;
  if (cache.has(key)) return cache.get(key)!;
  const f = fontById(fontId);
  await ensureFont(f, weight, 'Hxpdgo');
  const r = measure(f, weight);
  cache.set(key, r);
  return r;
}

/** Horizontal positions of each glyph in a string, including the font's own kerning (canvas fontKerning). */
export function glyphPositions(text: string, f: FontDef, weight: number, size: number, kerning = true): { x: number; w: number }[] {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = `${clampWeight(f, weight)} ${size}px ${f.css}`;
  if ('fontKerning' in ctx) (ctx as CanvasRenderingContext2D & { fontKerning: string }).fontKerning = kerning ? 'normal' : 'none';
  const out: { x: number; w: number }[] = [];
  for (let i = 0; i < text.length; i++) {
    const upto = ctx.measureText(text.slice(0, i + 1)).width;
    const w = ctx.measureText(text[i]).width;
    out.push({ x: upto - w, w });
  }
  return out;
}
