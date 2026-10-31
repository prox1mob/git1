import type { Criterion } from '../../components/lesson/LessonShell';
import { errorToScore, hexToRgb, hueDelta, rangeScore, rgbToHsl, rgbToLch } from '../../lib/color';
import type { CompositionFacts, Role } from './Composer';

const of = (f: CompositionFacts, role: Role) => f.layers.filter((l) => l.layer.role === role);
const need = (size: number) => (size >= 24 ? 3 : 4.5);

export function legibility(f: CompositionFacts, roles?: Role[]): Criterion {
  const ls = f.layers.filter((l) => !roles || roles.includes(l.layer.role));
  const worst = ls.reduce((w, l) => Math.min(w, l.contrast / need(l.layer.size)), 9);
  const bad = ls.filter((l) => l.contrast < need(l.layer.size)).map((l) => `${l.layer.label} ${l.contrast.toFixed(1)}:1`);
  return { label: 'Legibility', score: errorToScore(Math.max(0, 1 - worst) * 100, 0, 60), weight: 2, detail: bad.length ? `Below target: ${bad.join(', ')}.` : 'Every text layer meets its contrast target (4.5:1 small, 3:1 large) against what is behind it.' };
}

export function subjectRespect(f: CompositionFacts, roles: Role[] = ['headline', 'standfirst', 'body', 'caption', 'cta', 'kicker']): Criterion {
  const worst = Math.max(0, ...f.layers.filter((l) => roles.includes(l.layer.role)).map((l) => l.subjectOverlap));
  return { label: 'Subject respected', score: errorToScore(worst * 100, 4, 40), weight: 2, detail: `The most-overlapping text block covers ${(worst * 100).toFixed(0)}% subject.` };
}

export function margins(f: CompositionFacts): Criterion {
  const out = f.layers.filter((l) => l.outsideMargin);
  return { label: 'Margins', score: Math.round(100 * (1 - out.length / Math.max(1, f.layers.length))), weight: 1, detail: out.length ? `Outside the live area: ${out.map((l) => l.layer.label).join(', ')}.` : 'Everything sits inside the live area.' };
}

export function alignment(f: CompositionFacts, ideal = 2): Criterion {
  return { label: 'Alignment', score: f.leftEdges <= ideal ? 100 : Math.max(0, 100 - (f.leftEdges - ideal) * 22), weight: 1, detail: `${f.leftEdges} distinct left edges among left-aligned layers (fewer = stronger structure).` };
}

export function collisions(f: CompositionFacts): Criterion {
  return { label: 'No collisions', score: f.overlaps === 0 ? 100 : Math.max(0, 100 - f.overlaps * 35), weight: 1, detail: f.overlaps ? `${f.overlaps} pair(s) of text blocks overlap.` : 'No text blocks overlap.' };
}

export function hierarchy(f: CompositionFacts, top: Role, next: Role[], ratio = 1.6): Criterion {
  const t = of(f, top)[0]?.layer;
  const others = f.layers.filter((l) => next.includes(l.layer.role)).map((l) => l.layer);
  if (!t || !others.length) return { label: 'Hierarchy', score: 50, weight: 2, detail: 'Missing layers.' };
  const biggest = Math.max(...others.map((o) => o.size));
  const r = t.size / biggest;
  return { label: 'Hierarchy', score: rangeScore(r, ratio, 20, ratio - 0.8), weight: 2, detail: `${t.label} is ${r.toFixed(2)}× the next biggest text (aim ≥ ${ratio}×).` };
}

export function breathing(f: CompositionFacts, lo = 0.06, hi = 0.35): Criterion {
  return { label: 'Negative space', score: rangeScore(f.coverage, lo, hi, 0.15), weight: 1, detail: `Text covers ${(f.coverage * 100).toFixed(0)}% of the page (aim ${Math.round(lo * 100)}–${Math.round(hi * 100)}%).` };
}

export function readingOrder(f: CompositionFacts, order: Role[]): Criterion {
  const ys = order.map((r) => of(f, r)[0]?.layer.y ?? Infinity);
  let ok = 0;
  for (let i = 1; i < ys.length; i++) if (ys[i] >= ys[i - 1]) ok++;
  return { label: 'Reading order', score: Math.round((ok / Math.max(1, ys.length - 1)) * 100), weight: 1, detail: `${order.join(' → ')} read top to bottom in ${ok} of ${ys.length - 1} steps.` };
}

/** Do the chosen accent text colours relate to the photograph's dominant hue? */
export function colourRelationship(f: CompositionFacts): Criterion {
  if (!f.imageDominant) return { label: 'Colour relationship', score: 70, weight: 1, detail: 'No photograph to relate to.' };
  const imgHue = rgbToHsl(f.imageDominant)[0];
  const accents = f.layers.map((l) => hexToRgb(l.layer.color)!).filter((c) => rgbToLch(c)[1] > 15);
  if (!accents.length) return { label: 'Colour relationship', score: 85, weight: 1, detail: 'Neutral type (black/white) — always safe, rarely memorable.' };
  const fits = accents.map((c) => { const d = Math.abs(hueDelta(imgHue, rgbToHsl(c)[0])); return Math.min(d, Math.abs(180 - d)) < 35; });
  const share = fits.filter(Boolean).length / fits.length;
  return { label: 'Colour relationship', score: Math.round(55 + 45 * share), weight: 1, detail: `${fits.filter(Boolean).length} of ${fits.length} coloured text layers are analogous or complementary to the photograph's dominant hue (${Math.round(imgHue)}°).` };
}
