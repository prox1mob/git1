// All typefaces are bundled from Fontsource (SIL Open Font License), so lessons work offline
// and never depend on a font server. Each @font-face uses unicode-range, so browsers only
// download the subsets actually used.
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/inter/wght-italic.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '@fontsource-variable/playfair-display/wght.css';
import '@fontsource-variable/playfair-display/wght-italic.css';
import '@fontsource-variable/eb-garamond/wght.css';
import '@fontsource-variable/eb-garamond/wght-italic.css';
import '@fontsource-variable/source-serif-4/wght.css';
import '@fontsource-variable/fraunces/wght.css';
import '@fontsource-variable/bodoni-moda/wght.css';
import '@fontsource-variable/montserrat/wght.css';
import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource-variable/space-grotesk/wght.css';
import '@fontsource-variable/roboto-slab/wght.css';
import '@fontsource-variable/syne/wght.css';
import '@fontsource/arvo/400.css';
import '@fontsource/arvo/700.css';
import '@fontsource/abril-fatface/400.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';

export type TypeCategory = 'serif' | 'sans' | 'mono' | 'slab' | 'display';

export interface FontDef {
  id: string;
  label: string;
  /** CSS font-family stack. The first name is the bundled face. */
  css: string;
  category: TypeCategory;
  classification: string;
  weights: [number, number];
  /** Discrete weights only (static fonts). */
  steps?: number[];
  /** Intended use: text faces survive small sizes, display faces need size. */
  use: 'text' | 'display' | 'both';
  /** Curated personality coordinates, 0–1 (formal, warm, modern, loud). Opinions, not measurements. */
  traits: { formal: number; warm: number; modern: number; loud: number };
  note: string;
}

export const FONTS: FontDef[] = [
  { id: 'playfair', label: 'Playfair Display', css: '"Playfair Display Variable", "Playfair Display", Georgia, serif', category: 'serif', classification: 'Transitional / Didone-influenced display serif', weights: [400, 900], use: 'display', traits: { formal: 0.85, warm: 0.5, modern: 0.35, loud: 0.55 }, note: 'High stroke contrast and ball terminals: fashion, editorial headlines.' },
  { id: 'garamond', label: 'EB Garamond', css: '"EB Garamond Variable", "EB Garamond", Garamond, Georgia, serif', category: 'serif', classification: 'Old-style (Garalde) serif', weights: [400, 800], use: 'both', traits: { formal: 0.8, warm: 0.8, modern: 0.1, loud: 0.15 }, note: 'Calligraphic, diagonal stress, small x-height: literary and classical.' },
  { id: 'sourceserif', label: 'Source Serif 4', css: '"Source Serif 4 Variable", "Source Serif 4", Georgia, serif', category: 'serif', classification: 'Transitional text serif', weights: [200, 900], use: 'text', traits: { formal: 0.65, warm: 0.6, modern: 0.5, loud: 0.2 }, note: 'Sturdy, generous x-height: long-form reading on screen.' },
  { id: 'fraunces', label: 'Fraunces', css: '"Fraunces Variable", Fraunces, Georgia, serif', category: 'serif', classification: 'Soft "wonky" old-style display serif', weights: [100, 900], use: 'both', traits: { formal: 0.45, warm: 0.95, modern: 0.55, loud: 0.5 }, note: 'Soft, characterful and warm: food, hospitality, lifestyle.' },
  { id: 'bodoni', label: 'Bodoni Moda', css: '"Bodoni Moda Variable", "Bodoni Moda", Didot, serif', category: 'serif', classification: 'Didone (modern) serif', weights: [400, 900], use: 'display', traits: { formal: 0.95, warm: 0.25, modern: 0.4, loud: 0.6 }, note: 'Extreme contrast, hairline serifs: luxury mastheads. Fragile when small.' },
  { id: 'inter', label: 'Inter', css: '"Inter Variable", Inter, system-ui, sans-serif', category: 'sans', classification: 'Neo-grotesque sans', weights: [100, 900], use: 'both', traits: { formal: 0.55, warm: 0.35, modern: 0.85, loud: 0.3 }, note: 'Neutral and engineered for screens: interfaces, wayfinding.' },
  { id: 'dmsans', label: 'DM Sans', css: '"DM Sans Variable", "DM Sans", system-ui, sans-serif', category: 'sans', classification: 'Geometric sans (low contrast)', weights: [100, 1000], use: 'both', traits: { formal: 0.4, warm: 0.55, modern: 0.8, loud: 0.3 }, note: 'Friendly circles and clean joins: products, brands.' },
  { id: 'montserrat', label: 'Montserrat', css: '"Montserrat Variable", Montserrat, system-ui, sans-serif', category: 'sans', classification: 'Geometric sans (wide)', weights: [100, 900], use: 'both', traits: { formal: 0.45, warm: 0.45, modern: 0.75, loud: 0.55 }, note: 'Wide and confident, inspired by urban signage.' },
  { id: 'spacegrotesk', label: 'Space Grotesk', css: '"Space Grotesk Variable", "Space Grotesk", system-ui, sans-serif', category: 'sans', classification: 'Grotesque with mono-derived quirks', weights: [300, 700], use: 'both', traits: { formal: 0.35, warm: 0.3, modern: 0.95, loud: 0.5 }, note: 'Technical character: tech, science, startups.' },
  { id: 'jetbrains', label: 'JetBrains Mono', css: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace', category: 'mono', classification: 'Monospaced sans', weights: [100, 800], use: 'text', traits: { formal: 0.4, warm: 0.2, modern: 0.9, loud: 0.3 }, note: 'Every glyph the same width: code, data, technical labels.' },
  { id: 'plexmono', label: 'IBM Plex Mono', css: '"IBM Plex Mono", ui-monospace, monospace', category: 'mono', classification: 'Monospaced grotesque', weights: [400, 600], steps: [400, 600], use: 'text', traits: { formal: 0.55, warm: 0.4, modern: 0.75, loud: 0.3 }, note: 'Corporate-engineering voice with slab-like details.' },
  { id: 'robotoslab', label: 'Roboto Slab', css: '"Roboto Slab Variable", "Roboto Slab", Rockwell, serif', category: 'slab', classification: 'Slab serif (geometric)', weights: [100, 900], use: 'both', traits: { formal: 0.45, warm: 0.5, modern: 0.6, loud: 0.5 }, note: 'Block serifs feel sturdy and mechanical.' },
  { id: 'arvo', label: 'Arvo', css: 'Arvo, Rockwell, serif', category: 'slab', classification: 'Geometric slab serif', weights: [400, 700], steps: [400, 700], use: 'both', traits: { formal: 0.35, warm: 0.6, modern: 0.45, loud: 0.55 }, note: 'Typewriter-ish warmth: craft, coffee, workwear.' },
  { id: 'abril', label: 'Abril Fatface', css: '"Abril Fatface", "Bodoni Moda Variable", serif', category: 'display', classification: 'Fat-face Didone (display)', weights: [400, 400], steps: [400], use: 'display', traits: { formal: 0.6, warm: 0.55, modern: 0.3, loud: 0.95 }, note: 'Heavy, theatrical, Victorian poster energy.' },
  { id: 'bebas', label: 'Bebas Neue', css: '"Bebas Neue", Impact, sans-serif', category: 'display', classification: 'Condensed all-caps display sans', weights: [400, 400], steps: [400], use: 'display', traits: { formal: 0.35, warm: 0.25, modern: 0.7, loud: 0.9 }, note: 'Tall capitals only: posters, sport, cinema titles.' },
  { id: 'syne', label: 'Syne', css: '"Syne Variable", Syne, sans-serif', category: 'display', classification: 'Expressive extended grotesque', weights: [400, 800], use: 'display', traits: { formal: 0.2, warm: 0.4, modern: 0.95, loud: 0.85 }, note: 'Avant-garde, art-gallery attitude.' },
];

export const fontById = (id: string) => FONTS.find((f) => f.id === id) ?? FONTS[0];
export const clampWeight = (f: FontDef, w: number) => {
  if (f.steps) return f.steps.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a));
  return Math.min(f.weights[1], Math.max(f.weights[0], w));
};

/** Wait for a face to be ready before measuring it on a canvas. Never rejects. */
export async function ensureFont(f: FontDef, weight = 400, sample = 'Hxgpdo'): Promise<boolean> {
  if (typeof document === 'undefined' || !('fonts' in document)) return false;
  const family = f.css.split(',')[0].trim();
  try {
    const faces = await document.fonts.load(`${clampWeight(f, weight)} 64px ${family}`, sample);
    return faces.length > 0;
  } catch {
    return false;
  }
}
