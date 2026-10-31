import type { LevelProps } from '../../game/registry';
import { defaultParams, type GradeParams } from '../../engine/params';
import { errorToScore, hexToRgb, rangeScore, rgbToLch } from '../../lib/color';
import { fontById } from '../../lib/fonts';
import { chromaticHues, detectHarmony } from '../w1/palette';
import { alignment, breathing, collisions, colourRelationship, hierarchy, legibility, margins, subjectRespect } from '../shared/compRubrics';
import type { Composition, TextLayer } from '../shared/Composer';
import { Mission, rule, type MissionConfig } from './Mission';

const T = (id: string, role: TextLayer['role'], label: string, text: string, font: string, size: number, weight: number, x: number, y: number, w: number, extra: Partial<TextLayer> = {}): TextLayer =>
  ({ id, role, label, text, font, size, weight, color: '#151515', x, y, w, align: 'left', caps: false, tracking: 0, leading: 1.15, ...extra });
const GRID = { cols: 12, margin: 40, gutter: 12 };

/** How far the photograph's grade departs from neutral — a proxy for "intentional colour treatment". */
function gradeIntent(p: GradeParams) {
  const n = defaultParams();
  return Math.abs(p.temp - n.temp) / 1500 + Math.abs(p.contrast) * 2 + Math.abs(p.saturation - 1) * 2 + Math.abs(p.exposure) + p.fade + p.grain + Math.hypot(p.lift.x, p.lift.y) + Math.hypot(p.gain.x, p.gain.y) + Math.abs(p.vignette);
}
const fontTraits = (id: string) => fontById(id).traits;

// ------------------------------------------------------------------ Mission 1 — Luxury sneaker
const sneaker = (variant = 1) => ({ kind: 'scene' as const, scene: 'sneaker' as const, variant });
export const M1: MissionConfig = {
  galleryTitle: 'Corvo — Made slowly (campaign)',
  brief: {
    title: 'Luxury sneaker campaign', client: 'Corvo, Marche (Italy)',
    body: <p>Corvo has made dress shoes by hand since 1962. Their first sneaker launches in noir and gold. The campaign must feel like Corvo — slow, crafted, quietly expensive — not like a sports brand.</p>,
    deliverable: 'A 4:5 print and social advertisement with logo, headline, one line of copy and a call to action.',
    goals: ['The product is the hero and never covered', 'Premium restraint: few colours, generous space', 'Clear hierarchy: headline, copy, CTA', 'Every line legible'],
  },
  initial: () => ({ width: 600, height: 750, bg: '#E9E2D6', grid: GRID, image: { source: sneaker(1), rect: [0, 140, 600, 420], params: defaultParams({ saturation: 1.3, contrast: -0.2 }) }, layers: [
    T('logo', 'logo', 'Logo', 'CORVO', 'montserrat', 28, 800, 300, 40, 200, { color: '#C21F1F' }),
    T('h', 'headline', 'Headline', 'MADE SLOWLY!!', 'bebas', 40, 400, 120, 330, 380, { color: '#FFD000' }),
    T('copy', 'standfirst', 'Copy', 'Hand-lasted in Marche, Italy. The first Corvo sneaker.', 'abril', 22, 400, 40, 600, 360, { color: '#2E5BFF' }),
    T('cta', 'cta', 'Call to action', 'Shop now', 'inter', 22, 700, 380, 660, 180, { color: '#FF00AA' }),
  ] }),
  reference: () => ({ width: 600, height: 750, bg: '#121212', grid: GRID, image: { source: sneaker(1), rect: [0, 120, 600, 400], params: defaultParams({ exposure: -0.2, contrast: 0.15, vignette: 0.4 }) }, layers: [
    T('logo', 'logo', 'Logo', 'CORVO', 'bodoni', 22, 700, 40, 44, 520, { color: '#E8DCC2', align: 'center', tracking: 400 }),
    T('h', 'headline', 'Headline', 'Made slowly.', 'bodoni', 56, 400, 40, 548, 520, { color: '#F2EFE9', italic: true }),
    T('copy', 'standfirst', 'Copy', 'Hand-lasted in Marche, Italy. The first Corvo sneaker.', 'inter', 13, 400, 40, 624, 300, { color: '#BDB6AA', leading: 1.45 }),
    T('cta', 'cta', 'Call to action', 'Book a fitting →', 'inter', 12, 600, 400, 640, 160, { color: '#C8A96E', caps: true, tracking: 160, align: 'right' }),
  ] }),
  observe: { question: 'This is the studio’s reference. What makes it feel expensive rather than sporty?', options: ['The dark ground', 'Very few colours', 'Space around everything', 'Serif italic headline', 'All of these'], reveal: <p>All of these — and what is missing: no exclamation marks, no bright red, no shouting. Luxury communicates through restraint: one or two colours drawn from the product, generous space, refined type and a product that is never interrupted.</p> },
  concepts: [
    { title: 'The product is the hero', body: 'In product advertising everything serves the object: light it beautifully, give it space, never put type across it.' },
    { title: 'Restraint signals price', body: 'Fewer colours, more space, quieter type. Cheap brands shout because they compete on volume; premium brands whisper because they can.' },
    { title: 'Borrow colour from the product', body: 'Gold hardware, cream stitching, black leather: building the palette from the object makes the ad feel inevitable.' },
  ],
  hint: 'Try a dark background, the “Moody” grade, Bodoni or Playfair for the headline and a small, tracked CTA in the gold of the shoe. Keep everything off the shoe.',
  palette: ['#C8A96E', '#E8DCC2', '#121212'],
  rubric: (f, c) => {
    const chromatic = new Set(c.layers.map((l) => l.color.toUpperCase()).filter((h) => rgbToLch(hexToRgb(h)!)[1] > 15));
    const sat = c.image!.params.saturation;
    return [
      subjectRespect(f, ['headline', 'standfirst', 'cta', 'logo']),
      legibility(f),
      hierarchy(f, 'headline', ['standfirst', 'cta', 'logo'], 1.8),
      rule('Premium restraint', (chromatic.size <= 2 ? 100 : 100 - (chromatic.size - 2) * 30) * (sat <= 1.15 ? 1 : 0.7), `${chromatic.size} saturated text colour(s); photo saturation ${Math.round(sat * 100)}%.`, 2),
      breathing(f, 0.04, 0.22), margins(f), alignment(f, 2), colourRelationship(f),
    ];
  },
};

// ------------------------------------------------------------------ Mission 2 — Movie poster
const street = { kind: 'scene' as const, scene: 'street' as const };
export const M2: MissionConfig = {
  galleryTitle: 'Neon Rain — film poster',
  brief: {
    title: 'Cinematic movie poster', client: 'Low Light Pictures',
    body: <p>“Neon Rain” is a slow-burn neo-noir: a night-shift taxi driver, a city that never dries. The poster must sell mood and genre at thumbnail size.</p>,
    deliverable: 'A 2:3 one-sheet with title, tagline, credit block and release date.',
    goals: ['An intentional grade that says noir', 'A title that dominates (≥ 2.2× everything else)', 'Legible type over the image', 'A credible poster structure'],
  },
  initial: () => ({ width: 600, height: 900, bg: '#0B0B0C', grid: GRID, image: { source: street, rect: [0, 0, 600, 900], params: defaultParams() }, layers: [
    T('title', 'headline', 'Title', 'Neon Rain', 'inter', 40, 600, 160, 420, 300, { color: '#FFFFFF' }),
    T('tag', 'standfirst', 'Tagline', 'The city never dries.', 'inter', 30, 400, 120, 480, 360, { color: '#FFFFFF' }),
    T('credits', 'body', 'Credit block', 'LOW LIGHT PICTURES PRESENTS A FILM BY MARA OKONKWO · STARRING JONAS REY · ISABEL QUINTO', 'inter', 9, 500, 40, 780, 520, { color: '#888888', caps: true, tracking: 80, leading: 1.4 }),
    T('date', 'caption', 'Release date', 'IN CINEMAS 14 FEBRUARY', 'inter', 12, 700, 40, 830, 300, { color: '#888888', caps: true, tracking: 200 }),
  ] }),
  reference: () => ({ width: 600, height: 900, bg: '#0B0B0C', grid: GRID, image: { source: street, rect: [0, 0, 600, 900], params: defaultParams({ exposure: -0.35, contrast: 0.4, temp: 8200, tint: -12, saturation: 0.9, lift: { x: 0.35, y: -0.25, m: -0.05 }, gain: { x: -0.1, y: 0.3, m: 0 }, halation: 0.45, grain: 0.25, vignette: 0.45 }) }, layers: [
    T('tag', 'standfirst', 'Tagline', 'The city never dries.', 'inter', 13, 500, 40, 60, 520, { color: '#E8E1D5', caps: true, tracking: 260, align: 'center' }),
    T('title', 'headline', 'Title', 'NEON RAIN', 'bebas', 132, 400, 40, 640, 520, { color: '#F2EEE6', align: 'center', tracking: 20, leading: 0.9 }),
    T('credits', 'body', 'Credit block', 'LOW LIGHT PICTURES PRESENTS A FILM BY MARA OKONKWO · STARRING JONAS REY · ISABEL QUINTO', 'bebas', 16, 400, 40, 790, 520, { color: '#A8A196', align: 'center', tracking: 60, leading: 1.1 }),
    T('date', 'caption', 'Release date', 'In cinemas 14 February', 'inter', 11, 700, 40, 836, 520, { color: '#E0457B', caps: true, tracking: 220, align: 'center' }),
  ] }),
  observe: { question: 'Before reading a word, what genre do you guess from the reference?', options: ['Romantic comedy', 'Thriller / noir', 'Documentary', 'Musical'], reveal: <p>Thriller or noir — from the grade alone: cold, contrasty, deep shadows, sodium and neon glowing through haze. Then a tall condensed title fixes the genre. Posters are read in that order: image mood, title, everything else.</p> },
  concepts: [
    { title: 'Grade first', body: 'The key art’s grade is the genre signal. Decide it before any type: cool and contrasty for thriller, warm and soft for romance, saturated for comedy.' },
    { title: 'The title is the logo', body: 'Film titles are designed like logotypes: big, consistent, often condensed so they fit tall formats.' },
    { title: 'The billing block', body: 'Credits in a tall, condensed face at the bottom are a convention audiences recognise instantly — it makes a poster look real.' },
  ],
  hint: 'Start with the “Moody” grade, then push temperature cooler. Make the title huge in a condensed face (Bebas Neue) near the bottom third, credits small below it.',
  palette: ['#E0457B', '#F2EEE6', '#7FD1FF'],
  rubric: (f, c) => {
    const intent = gradeIntent(c.image!.params);
    const p = c.image!.params;
    return [
      rule('Noir grade', Math.min(100, intent * 40) * (p.temp >= 6800 || p.lift.x > 0.1 ? 1 : 0.7) * (p.contrast > 0.05 ? 1 : 0.75), `Grade intensity ${intent.toFixed(2)}; temperature ${p.temp} K; contrast ${Math.round(p.contrast * 100)}.`, 2),
      hierarchy(f, 'headline', ['standfirst', 'body', 'caption'], 2.2),
      legibility(f), margins(f), alignment(f, 2), collisions(f),
    ];
  },
};

// ------------------------------------------------------------------ Mission 3 — Fashion editorial spread
const model = { kind: 'scene' as const, scene: 'portrait' as const, variant: 5, params: [3, 2, 2, 0] as [number, number, number, number] };
export const M3: MissionConfig = {
  galleryTitle: 'Still Life in Crimson — spread',
  brief: {
    title: 'Fashion editorial spread', client: 'ATLAS magazine',
    body: <p>An opening spread for the story “Still Life in Crimson”: one photograph, a headline, a standfirst and a short introduction. The colour treatment should feel deliberate and painterly.</p>,
    deliverable: 'A two-page spread (2:1.25): photograph across the left page, type on the right.',
    goals: ['A deliberate colour treatment of the photograph', 'Type aligned to the grid inside the margins', 'Generous negative space', 'Readable, well-ordered text'],
  },
  initial: () => ({ width: 1200, height: 750, bg: '#F4F2ED', grid: { cols: 12, margin: 48, gutter: 16 }, image: { source: model, rect: [0, 0, 600, 750], params: defaultParams() }, layers: [
    T('h', 'headline', 'Headline', 'Still Life in Crimson', 'inter', 30, 700, 700, 380, 300),
    T('s', 'standfirst', 'Standfirst', 'Six looks photographed like paintings: slow, warm and deliberately quiet.', 'inter', 22, 400, 640, 120, 500),
    T('b', 'body', 'Introduction', 'There is a kind of fashion photography that asks you to hurry. This is the other kind. Shot in the late afternoon in a single room, with a single window and a single colour, these images borrow their patience from Dutch still lifes.', 'inter', 11, 400, 900, 560, 260, { leading: 1.5 }),
    T('c', 'caption', 'Credit', 'Photography Ama Mensah · Styling Leo Park', 'inter', 9, 500, 640, 700, 300, { caps: true, tracking: 100 }),
  ] }),
  reference: () => ({ width: 1200, height: 750, bg: '#F4F2ED', grid: { cols: 12, margin: 48, gutter: 16 }, image: { source: model, rect: [0, 0, 600, 750], params: defaultParams({ temp: 5400, contrast: 0.1, fade: 0.35, density: 0.3, gain: { x: -0.2, y: 0.18, m: 0 }, grain: 0.2 }) }, layers: [
    T('h', 'headline', 'Headline', 'Still Life in Crimson', 'playfair', 64, 700, 668, 220, 460, { leading: 0.98, color: '#7A1F2B' }),
    T('s', 'standfirst', 'Standfirst', 'Six looks photographed like paintings: slow, warm and deliberately quiet.', 'sourceserif', 19, 400, 668, 380, 380, { leading: 1.35 }),
    T('b', 'body', 'Introduction', 'There is a kind of fashion photography that asks you to hurry. This is the other kind. Shot in the late afternoon in a single room, with a single window and a single colour, these images borrow their patience from Dutch still lifes.', 'sourceserif', 11, 400, 668, 480, 300, { leading: 1.55 }),
    T('c', 'caption', 'Credit', 'Photography Ama Mensah · Styling Leo Park', 'inter', 8, 600, 668, 680, 300, { caps: true, tracking: 140, color: '#6b6b6b' }),
  ] }),
  observe: { question: 'In the reference spread, where does the colour of the headline come from?', options: ['A random accent', 'The model’s clothing', 'The background'], reveal: <p>From the crimson garment in the photograph — picked, darkened slightly, and reused in the headline. It ties the type to the picture across the gutter. The photograph’s warm, faded grade and the paper-coloured page do the rest.</p> },
  concepts: [
    { title: 'The spread is one canvas', body: 'Two pages read together. Picture on one side, words on the other is a classic opening because each page gets one job.' },
    { title: 'Colour treatment', body: 'A consistent grade across a story (warm and faded, cool and crisp…) is part of the editorial voice, as much as the typeface.' },
    { title: 'Ragged right, generous space', body: 'Left-aligned text with a ragged right edge reads naturally; wide margins make the spread feel considered.' },
  ],
  hint: 'Try the “Warm film” grade. Set the headline in Playfair, large, on the right page’s left margin, and stack standfirst and introduction below it on the same edge.',
  palette: ['#7A1F2B', '#151515', '#6b6b6b'],
  rubric: (f, c) => [
    rule('Deliberate colour treatment', Math.min(100, gradeIntent(c.image!.params) * 45), `Grade intensity ${gradeIntent(c.image!.params).toFixed(2)} (a natural, untouched photo scores low).`, 2),
    legibility(f), alignment(f, 1), margins(f), collisions(f), breathing(f, 0.04, 0.25),
    hierarchy(f, 'headline', ['standfirst', 'body', 'caption'], 2), colourRelationship(f),
  ],
};

// ------------------------------------------------------------------ Mission 4 — Brand identity
const ceramics = { kind: 'scene' as const, scene: 'stilllife' as const, frame: [0.22, -0.12, 0.62] as [number, number, number] };
const swatch = (id: string, x: number, color: string): TextLayer => T(id, 'logo', `Palette ${id.slice(-1)}`, '■', 'inter', 96, 400, x, 600, 100, { color, leading: 1, align: 'center' });
export const M4: MissionConfig = {
  galleryTitle: 'Ōra — brand identity board',
  brief: {
    title: 'Brand identity', client: 'Ōra small-batch ceramics',
    body: <p>Ōra makes stoneware cups and bowls in small batches, sold online and in three concept stores. They need a first identity: wordmark, tagline and a four-colour palette that feels crafted, calm and premium.</p>,
    deliverable: 'An identity board: mood photograph, wordmark, tagline and four palette chips.',
    goals: ['A wordmark typeface that feels crafted and premium', 'A coherent four-colour palette drawn from the photograph', 'Clear, legible hierarchy', 'Structure: aligned and inside the margins'],
  },
  initial: () => ({ width: 800, height: 750, bg: '#FFFFFF', grid: { cols: 12, margin: 48, gutter: 14 }, image: { source: ceramics, rect: [400, 48, 352, 480], params: defaultParams() }, layers: [
    T('logo', 'headline', 'Wordmark', 'Ōra', 'bebas', 60, 400, 60, 120, 300, { color: '#1E90FF' }),
    T('tag', 'standfirst', 'Tagline', 'CERAMICS!', 'syne', 30, 800, 60, 260, 300, { color: '#FF3B30' }),
    swatch('s1', 48, '#FF3B30'), swatch('s2', 160, '#1E90FF'), swatch('s3', 272, '#34C759'), swatch('s4', 384, '#FFCC00'),
  ] }),
  reference: () => ({ width: 800, height: 750, bg: '#F1ECE4', grid: { cols: 12, margin: 48, gutter: 14 }, image: { source: ceramics, rect: [400, 48, 352, 480], params: defaultParams({ temp: 5900, fade: 0.25, saturation: 0.85 }) }, layers: [
    T('logo', 'headline', 'Wordmark', 'Ōra', 'fraunces', 120, 500, 48, 150, 320, { color: '#3B2A22', leading: 1 }),
    T('tag', 'standfirst', 'Tagline', 'Small-batch stoneware, thrown slowly.', 'sourceserif', 18, 400, 48, 320, 300, { color: '#5E4B3F', leading: 1.35 }),
    swatch('s1', 48, '#3B2A22'), swatch('s2', 160, '#B8603A'), swatch('s3', 272, '#D9C8B0'), swatch('s4', 384, '#5E6F5A'),
  ] }),
  observe: { question: 'Where do you think the palette of the reference board came from?', options: ['From colour theory alone', 'From the photograph', 'From competitors'], reveal: <p>From the photograph — the dark clay, the terracotta glaze, the pale wall and the sage of the leaves. An identity palette that already exists in the product’s world feels honest, and it guarantees that brand graphics and photography will sit well together.</p> },
  concepts: [
    { title: 'Wordmark', body: 'A name set in a carefully chosen typeface — often customised. Its personality should match the product: warm serif for craft, precise sans for tech.' },
    { title: 'A palette with roles', body: 'Usually one dark (text), one light (ground), one brand colour and one supporting accent. Four is plenty.' },
    { title: 'From the product outward', body: 'Look at the materials. Their colours and textures make the most convincing identity.' },
  ],
  hint: 'Use a warm, soft serif (Fraunces, Garamond) for “Ōra”. Pick the four chips from the photograph: dark clay, terracotta, pale wall, leaf green. Set the background to a warm off-white.',
  palette: ['#3B2A22', '#B8603A', '#D9C8B0', '#5E6F5A', '#F1ECE4'],
  rubric: (f, c) => {
    const logo = c.layers.find((l) => l.id === 'logo')!;
    const t = fontTraits(logo.font);
    const chips = c.layers.filter((l) => l.id.startsWith('s')).map((l) => hexToRgb(l.color)!);
    const hues = chromaticHues(chips);
    const h = detectHarmony(hues);
    const chroma = Math.max(...chips.map((x) => rgbToLch(x)[1]));
    const hasNeutral = chips.some((x) => rgbToLch(x)[1] < 15);
    return [
      rule('Crafted, premium wordmark', 100 - Math.hypot(t.formal - 0.7, t.warm - 0.8, t.loud - 0.4) * 140, `${fontById(logo.font).label}: formal ${t.formal}, warm ${t.warm}, loud ${t.loud} (curated traits).`, 2),
      rule('Palette coherence', (hues.length < 2 ? 85 : h.scheme === 'free' ? 30 : errorToScore(h.error, 15, 60)) * (hasNeutral ? 1 : 0.75), `Chips read as ${hues.length < 2 ? 'mostly neutral' : h.scheme}${hasNeutral ? ', with a neutral' : ', no neutral'}.`, 2),
      rule('Calm, not loud', rangeScore(chroma, 0, 55, 40), `Most saturated chip C* ${chroma.toFixed(0)}.`),
      colourRelationship(f), legibility(f, ['headline', 'standfirst']), margins(f), alignment(f, 2),
    ];
  },
};

export const Mission1 = ({ level }: LevelProps) => <Mission level={level} cfg={M1} />;
export const Mission2 = ({ level }: LevelProps) => <Mission level={level} cfg={M2} />;
export const Mission3 = ({ level }: LevelProps) => <Mission level={level} cfg={M3} />;
export const Mission4 = ({ level }: LevelProps) => <Mission level={level} cfg={M4} />;

export type { Composition };
