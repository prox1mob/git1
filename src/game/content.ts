export type WorldId = 'w1' | 'w2' | 'w3' | 'w4' | 'w5';

export type SkillId =
  | 'perception' | 'mixing' | 'harmony' | 'accessibility' | 'psychology'
  | 'anatomy' | 'typefaces' | 'spacing' | 'hierarchy' | 'composition'
  | 'exposure' | 'tone' | 'whitebalance' | 'grading' | 'scopes' | 'science' | 'direction';

export const SKILLS: Record<SkillId, { label: string; group: string }> = {
  perception: { label: 'Colour perception', group: 'Colour' },
  mixing: { label: 'Colour mixing', group: 'Colour' },
  harmony: { label: 'Harmony & palettes', group: 'Colour' },
  accessibility: { label: 'Contrast & accessibility', group: 'Colour' },
  psychology: { label: 'Colour & emotion', group: 'Colour' },
  anatomy: { label: 'Letterform anatomy', group: 'Typography' },
  typefaces: { label: 'Typeface selection', group: 'Typography' },
  spacing: { label: 'Spacing & rhythm', group: 'Typography' },
  hierarchy: { label: 'Visual hierarchy', group: 'Typography' },
  composition: { label: 'Layout & composition', group: 'Typography' },
  exposure: { label: 'Exposure & dynamic range', group: 'Image' },
  tone: { label: 'Tone: gamma & curves', group: 'Image' },
  whitebalance: { label: 'White balance', group: 'Image' },
  grading: { label: 'Creative grading', group: 'Image' },
  scopes: { label: 'Reading scopes', group: 'Image' },
  science: { label: 'Colour science & signals', group: 'Image' },
  direction: { label: 'Art direction', group: 'Direction' },
};

export interface WorldDef {
  id: WorldId;
  number: string;
  title: string;
  subject: string;
  tagline: string;
  description: string;
  /** A tiny identity swatch for the world card, never used inside editing views. */
  swatch: string[];
  hero: { scene: string; variant?: number; frame?: [number, number, number] };
}

export const WORLDS: WorldDef[] = [
  {
    id: 'w1', number: '01', title: 'The Colour Laboratory', subject: 'Colour Theory & Visual Perception',
    tagline: 'See colour the way a colourist does.',
    description: 'Mix, measure and arrange colour. Learn why identical colours can look different, how palettes carry emotion, and how to make text everyone can read.',
    swatch: ['#e8622c', '#f0c45a', '#4c9a8a', '#2e3fd1'],
    hero: { scene: 'stilllife' },
  },
  {
    id: 'w2', number: '02', title: 'Typography Academy', subject: 'Typography & Editorial Design',
    tagline: 'Letters have anatomy, rhythm and voice.',
    description: 'Dissect letterforms, perform kerning surgery, build hierarchy and art-direct a magazine cover with real typefaces.',
    swatch: ['#f4f2ed', '#111111', '#b8432f', '#d9d4c7'],
    hero: { scene: 'portrait', variant: 2 },
  },
  {
    id: 'w3', number: '03', title: 'Photography Grading Lab', subject: 'Photography Colour Grading',
    tagline: 'Exposure, gamma, white balance, curves.',
    description: 'A real image-processing engine with live histograms. Control tone and colour in the right space, in the right order.',
    swatch: ['#d9a066', '#6b8fa3', '#2b2b2b', '#e9e2d0'],
    hero: { scene: 'coast' },
  },
  {
    id: 'w4', number: '04', title: 'Cinematic Grading Suite', subject: 'Cinematic Video Colour Grading',
    tagline: 'Signals, scopes, Log and look.',
    description: 'Play footage, read waveforms and vectorscopes, decode Log, match shots and build a coherent cinematic look.',
    swatch: ['#1d3b4f', '#e39a4f', '#c43d5a', '#0f1418'],
    hero: { scene: 'street' },
  },
  {
    id: 'w5', number: '05', title: 'Creative Director Studio', subject: 'Integrated Art Direction',
    tagline: 'Brief in. Campaign out.',
    description: 'Combine colour, type, grading and composition to answer real creative briefs — then curate your gallery.',
    swatch: ['#c9a96e', '#121212', '#e9e9e9', '#7a2e2e'],
    hero: { scene: 'sneaker' },
  },
];

export type LevelStatus = 'ready' | 'soon';

export interface LevelDef {
  id: string;
  world: WorldId;
  n: number;
  title: string;
  summary: string;
  skills: SkillId[];
  minutes: number;
  xp: number;
  status: LevelStatus;
  /** Levels marked `mission` live in World 05 and may be unlocked by prerequisites. */
  requires?: string[];
}

/** Lessons that are implemented and playable. Everything else is clearly labelled "In development". */
export const READY = new Set<string>([
  'w1-1', 'w1-2', 'w1-3', 'w1-4', 'w1-5', 'w1-6', 'w1-7', 'w1-8',
  'w2-1', 'w2-2', 'w2-3', 'w2-4', 'w2-5', 'w2-6', 'w2-7', 'w2-8',
  'w3-1', 'w3-2', 'w3-3', 'w3-4', 'w3-5', 'w3-6', 'w3-7', 'w3-8', 'w3-9', 'w3-10',
  'w4-1', 'w4-2', 'w4-3', 'w4-4', 'w4-5', 'w4-6', 'w4-7', 'w4-8', 'w4-9', 'w4-10',
  'w5-1', 'w5-2', 'w5-3', 'w5-4', 'w5-5',
]);

const L = (world: WorldId, n: number, title: string, summary: string, skills: SkillId[], minutes = 6, _status: LevelStatus = 'soon', xp = 100, requires?: string[]): LevelDef => ({
  id: `${world}-${n}`, world, n, title, summary, skills, minutes, xp, status: READY.has(`${world}-${n}`) ? 'ready' : 'soon', requires,
});

export const LEVELS: LevelDef[] = [
  // World 01
  L('w1', 1, 'The Colour Detective', 'Find the warm, cool and neutral colours hidden in three compositions.', ['perception'], 5),
  L('w1', 2, 'The Colour Mixer', 'Recreate target colours with hue, saturation, lightness, RGB and HEX. Scored with ΔE2000.', ['mixing', 'perception'], 7, 'ready', 120),
  L('w1', 3, 'Colour Harmony', 'Rotate harmony handles on a live wheel and watch an advertisement transform.', ['harmony'], 7),
  L('w1', 4, 'Colour Psychology', 'One composition, five moods. Explore how palette shifts feeling — and why context matters.', ['psychology'], 6),
  L('w1', 5, 'Contrast & Accessibility', 'Real WCAG contrast ratios. Fix failing brand colours without losing the brand.', ['accessibility'], 7),
  L('w1', 6, 'Simultaneous Contrast', 'Identical colours, different neighbours. Discover how surroundings rewrite colour.', ['perception'], 6),
  L('w1', 7, 'The Palette Architect', 'Four briefs: fashion, skincare, luxury shoe, tech. Build palettes that answer them.', ['harmony', 'psychology', 'accessibility'], 10, 'soon', 150),
  L('w1', 8, 'Master of Colour', 'A complex poster brief demanding harmony, contrast, hierarchy and atmosphere.', ['harmony', 'accessibility', 'psychology', 'direction'], 12, 'soon', 200),
  // World 02
  L('w2', 1, 'Anatomy of Letters', 'Touch letterforms to reveal baselines, x-heights, counters and stroke contrast.', ['anatomy'], 5),
  L('w2', 2, 'Typeface Families', 'Serif, sans, mono, slab and display: switch the voice of one composition.', ['typefaces'], 6),
  L('w2', 3, 'Kerning Surgery', 'Drag letters to fix badly spaced headlines. Compared with the type designer’s kerning.', ['spacing'], 7),
  L('w2', 4, 'Tracking & Leading', 'Tune letter- and line-spacing for body, labels and headlines with measurable targets.', ['spacing'], 6),
  L('w2', 5, 'Visual Hierarchy', 'Repair a broken magazine page until the reading order is unmistakable.', ['hierarchy', 'composition'], 8, 'ready', 140),
  L('w2', 6, 'Typeface Pairing', 'Combine headline and body faces; learn contrast versus conflict.', ['typefaces'], 6),
  L('w2', 7, 'Editorial Composition', 'Arrange type around a fashion photograph on a real grid.', ['composition', 'hierarchy'], 10, 'soon', 150),
  L('w2', 8, 'The Magazine Art Director', 'Design a fashion cover: masthead, cover lines, image and space.', ['composition', 'hierarchy', 'typefaces', 'direction'], 12, 'soon', 200),
  // World 03
  L('w3', 1, 'Exposure & Tonal Values', 'Exposure, contrast, highlights, shadows, whites and blacks — with a live histogram.', ['exposure'], 7),
  L('w3', 2, 'The Gamma Laboratory', 'Bend midtones with a power-law curve while black and white stay put.', ['tone', 'science'], 8, 'ready', 140),
  L('w3', 3, 'Dynamic Range', 'Rescue over- and under-exposed images and meet the limits of clipped data.', ['exposure'], 8),
  L('w3', 4, 'White Balance', 'Neutralise warm, cool, green and magenta casts against a measured grey card.', ['whitebalance'], 7),
  L('w3', 5, 'Lift, Gamma & Gain', 'Three colour wheels: warm highlights, cool shadows, natural skin.', ['grading', 'tone'], 9),
  L('w3', 6, 'RGB Curves', 'Draggable master and channel curves: S-curves, faded blacks and casts.', ['tone', 'grading'], 9),
  L('w3', 7, 'HSL Colour Mixer', 'Target one colour range without disturbing the rest.', ['grading'], 8),
  L('w3', 8, 'Skin Tone Laboratory', 'Natural skin across a range of complexions, checked on the vectorscope.', ['grading', 'whitebalance', 'scopes'], 9),
  L('w3', 9, 'Colour Separation', 'Use warm/cool and complementary contrast to separate subject from background.', ['grading', 'perception'], 8),
  L('w3', 10, 'Photography Master Challenge', 'One raw photograph, three looks: natural, moody, nostalgic film.', ['grading', 'exposure', 'tone', 'direction'], 15, 'soon', 250),
  // World 04
  L('w4', 1, 'Correction vs Grading', 'Neutralise first, then create intent. Feel the difference.', ['grading', 'whitebalance'], 7),
  L('w4', 2, 'Understanding Video Signals', 'Linear light, gamma encoding, Rec.709, Log, colour spaces and display transforms.', ['science'], 10),
  L('w4', 3, 'The Log Footage Mystery', 'Why Log looks flat, and why the right camera transform matters.', ['science'], 8),
  L('w4', 4, 'Professional Video Scopes', 'Waveform, RGB parade, vectorscope and histogram from real pixels.', ['scopes'], 9),
  L('w4', 5, 'Primary Colour Correction', 'Fix exposure, contrast and balance of a poorly shot clip.', ['grading', 'scopes', 'whitebalance'], 9),
  L('w4', 6, 'Cinematic Colour Contrast', 'Warm/cool separation, density and saturation hierarchy — beyond teal & orange.', ['grading'], 9),
  L('w4', 7, 'Shot Matching', 'Match two shots of the same scene using scopes.', ['scopes', 'grading'], 10),
  L('w4', 8, 'Film Emulation', 'Contrast, density, grain, halation and roll-off — and their limits.', ['grading', 'science'], 9),
  L('w4', 9, 'Mood & Narrative', 'Grade one scene for suspense, romance, loneliness and nostalgia.', ['grading', 'psychology'], 10),
  L('w4', 10, 'Become the Colourist', 'Correct, match and grade a three-shot sequence into one identity.', ['grading', 'scopes', 'direction'], 15, 'soon', 250),
  // World 05
  L('w5', 1, 'Luxury Sneaker Campaign', 'A premium footwear advertisement: colour, type, contrast and composition.', ['direction', 'composition', 'harmony'], 15, 'soon', 250, ['w1-2', 'w2-5']),
  L('w5', 2, 'Cinematic Movie Poster', 'Grade the key art and set a typographic hierarchy.', ['direction', 'grading', 'hierarchy'], 15, 'soon', 250, ['w2-5', 'w3-2']),
  L('w5', 3, 'Fashion Editorial', 'A spread combining photography, colour treatment, type and space.', ['direction', 'composition', 'grading'], 15, 'soon', 250, ['w2-5', 'w3-2']),
  L('w5', 4, 'Brand Identity', 'A visual identity for a fictional premium product.', ['direction', 'harmony', 'typefaces'], 15, 'soon', 250, ['w1-2', 'w2-5']),
  L('w5', 5, 'Short Film Art Direction', 'Palette, lighting mood, title type and shot-to-shot consistency.', ['direction', 'grading', 'typefaces'], 18, 'soon', 300, ['w3-2', 'w2-5']),
];

export const levelById = (id: string) => LEVELS.find((l) => l.id === id);
export const levelsOf = (w: WorldId) => LEVELS.filter((l) => l.world === w);
export const worldById = (id: string) => WORLDS.find((w) => w.id === id);

export const RANKS = [
  { xp: 0, title: 'Apprentice' },
  { xp: 300, title: 'Studio Assistant' },
  { xp: 800, title: 'Junior Designer' },
  { xp: 1600, title: 'Designer' },
  { xp: 3000, title: 'Senior Designer' },
  { xp: 5000, title: 'Art Director' },
  { xp: 8000, title: 'Creative Director' },
  { xp: 12000, title: 'Master of the Lab' },
];
export function rankFor(xp: number) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const cur = RANKS[i], next = RANKS[i + 1];
  return { index: i, title: cur.title, floor: cur.xp, next: next?.xp ?? null, nextTitle: next?.title ?? null, progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1 };
}

export interface AchievementDef { id: string; title: string; description: string; glyph: string }
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-light', title: 'First Light', description: 'Complete your first challenge.', glyph: '◐' },
  { id: 'eagle-eye', title: 'Eagle Eye', description: 'Match a colour to within ΔE2000 1.0.', glyph: '◎' },
  { id: 'mistakes-are-data', title: 'Mistakes Are Data', description: 'Refine a challenge three times. Iteration is the job.', glyph: '↻' },
  { id: 'perfectionist', title: 'Perfectionist', description: 'Score 100 on any challenge.', glyph: '✦' },
  { id: 'reading-order', title: 'Reading Order', description: 'Score 90+ in Visual Hierarchy.', glyph: '≡' },
  { id: 'midtone-mover', title: 'Midtone Mover', description: 'Score 90+ in the Gamma Laboratory.', glyph: 'γ' },
  { id: 'accessible', title: 'Accessible by Design', description: 'Reach AAA contrast (7:1) in a challenge.', glyph: 'Aa' },
  { id: 'neutral-ground', title: 'Neutral Ground', description: 'Neutralise a grey card to under 1.5 C*.', glyph: '▢' },
  { id: 'kerning-surgeon', title: 'Kerning Surgeon', description: 'Score 95+ in Kerning Surgery.', glyph: 'AV' },
  { id: 'no-clipping', title: 'Histogram Whisperer', description: 'Full tonal range with no clipping.', glyph: '▁▃▅' },
  { id: 'skin-line', title: 'On the Line', description: 'Bring skin within 3° of the skin-tone line.', glyph: '⟋' },
  { id: 'scope-reader', title: 'Scope Reader', description: 'Diagnose every image from scopes alone.', glyph: '∿' },
  { id: 'shot-matcher', title: 'Shot Matcher', description: 'Match two shots within ΔE 3.', glyph: '⇄' },
  { id: 'colourist', title: 'The Colourist', description: 'Complete Become the Colourist.', glyph: '◑' },
  { id: 'creative-director', title: 'Creative Director', description: 'Complete all five studio missions.', glyph: '★' },
  { id: 'explorer', title: 'Explorer', description: 'Visit all five worlds.', glyph: '⌖' },
  { id: 'daily-3', title: 'Three-Day Habit', description: 'Complete the daily challenge three days running.', glyph: '3' },
  { id: 'daily-7', title: 'Studio Rhythm', description: 'A seven-day daily challenge streak.', glyph: '7' },
  { id: 'curator', title: 'Curator', description: 'Save five works to your gallery.', glyph: '▤' },
  { id: 'world-1', title: 'Colour Laboratory Graduate', description: 'Complete every lesson in World 01.', glyph: '01' },
  { id: 'world-2', title: 'Typography Academy Graduate', description: 'Complete every lesson in World 02.', glyph: '02' },
  { id: 'world-3', title: 'Grading Lab Graduate', description: 'Complete every lesson in World 03.', glyph: '03' },
  { id: 'world-4', title: 'Cinema Suite Graduate', description: 'Complete every lesson in World 04.', glyph: '04' },
];

/** Sandbox tools unlock through demonstrated skill (or Free Exploration mode). */
export const SANDBOX_TOOLS: { id: string; label: string; unlockedBy: string | null }[] = [
  { id: 'basic', label: 'Exposure & white balance', unlockedBy: null },
  { id: 'gamma', label: 'Gamma', unlockedBy: 'w3-2' },
  { id: 'wheels', label: 'Lift / Gamma / Gain wheels', unlockedBy: 'w3-5' },
  { id: 'curves', label: 'RGB curves', unlockedBy: 'w3-6' },
  { id: 'hsl', label: 'HSL mixer', unlockedBy: 'w3-7' },
  { id: 'scopes', label: 'Waveform, parade & vectorscope', unlockedBy: 'w4-4' },
  { id: 'film', label: 'Film emulation', unlockedBy: 'w4-8' },
];
