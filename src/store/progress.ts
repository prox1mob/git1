import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Difficulty, SkillId } from '../lib/types';
import { ALL_LEVELS, WORLDS, levelById } from '../worlds/meta';
import { READY } from '../worlds/ready';
import type { LengthUnit } from '../lib/math';

export const PASS_MARK = 70;

export interface LevelResult {
  best: number;
  first: number;
  last: number;
  attempts: number;
  completed: boolean;
  hintsUsed: number;
  completedAt?: string;
}

export interface Settings {
  difficulty: Difficulty;
  tamil: boolean;
  explorer: boolean;
  unit: LengthUnit;
  hints: boolean;
}

export interface Counters {
  exports: number;
  projectsSaved: number;
  physics: string[];
  noHintClears: number;
  sketches: number;
}

export interface RecordOutcome {
  xpGained: number;
  passed: boolean;
  firstClear: boolean;
  newBadges: string[];
  newTools: string[];
  improved: boolean;
}

interface ProgressState {
  xp: number;
  results: Record<string, LevelResult>;
  badges: string[];
  counters: Counters;
  settings: Settings;
  daily: Record<string, number>;
  lastLevel?: string;
  record: (levelId: string, score: number, hintsUsed: number) => RecordOutcome;
  recordDaily: (date: string, score: number) => RecordOutcome;
  bump: (key: 'exports' | 'projectsSaved' | 'sketches', by?: number) => string[];
  physicsDone: (id: string) => string[];
  setSettings: (s: Partial<Settings>) => void;
  setLast: (id: string) => void;
  reset: () => void;
}

const initial = {
  xp: 0,
  results: {} as Record<string, LevelResult>,
  badges: [] as string[],
  counters: { exports: 0, projectsSaved: 0, physics: [], noHintClears: 0, sketches: 0 } as Counters,
  settings: { difficulty: 'beginner', tamil: false, explorer: false, unit: 'mm', hints: true } as Settings,
  daily: {} as Record<string, number>,
};

/* ---------------- Ranks ---------------- */
export const RANKS = [
  { xp: 0, name: 'Apprentice', ta: 'பயிற்சியாளர்' },
  { xp: 300, name: 'Sketcher', ta: 'வரைவாளர்' },
  { xp: 800, name: 'Modeller', ta: 'மாடலர்' },
  { xp: 1600, name: 'Designer', ta: 'வடிவமைப்பாளர்' },
  { xp: 3000, name: 'Engineer', ta: 'பொறியாளர்' },
  { xp: 5000, name: 'Inventor', ta: 'கண்டுபிடிப்பாளர்' },
  { xp: 8000, name: 'Master Inventor', ta: 'முதன்மைக் கண்டுபிடிப்பாளர்' },
];
export function rankOf(xp: number) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const cur = RANKS[i];
  const next = RANKS[i + 1];
  return { ...cur, index: i, next, frac: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1 };
}

/* ---------------- Unlockable tools ---------------- */
export const TOOLS = [
  { id: 'adv-primitives', name: 'Cone, Prism & Torus primitives', where: 'Editor', requires: 'w1-l2' },
  { id: 'sketch3d', name: 'Sketch-to-3D Studio', where: 'Home', requires: 'w1-l3' },
  { id: 'lathe', name: 'Revolve (lathe) in Sketch-to-3D', where: 'Sketch-to-3D', requires: 'w3-l5' },
  { id: 'csg', name: 'Boolean tools (union / subtract / intersect)', where: 'Editor', requires: 'w3-l7' },
  { id: 'pbr', name: 'Advanced PBR material sliders', where: 'Editor', requires: 'w4-l1' },
] as const;
export type ToolId = (typeof TOOLS)[number]['id'];

export function toolUnlocked(id: ToolId, s: Pick<ProgressState, 'results' | 'settings'>) {
  const t = TOOLS.find((x) => x.id === id)!;
  return s.settings.explorer || !!s.results[t.requires]?.completed;
}

/* ---------------- Badges ---------------- */
type BadgeState = Pick<ProgressState, 'results' | 'counters' | 'daily' | 'xp'>;
const done = (s: BadgeState, id: string) => !!s.results[id]?.completed;
const worldDone = (s: BadgeState, n: number) => {
  const ready = WORLDS[n - 1].levels.filter((l) => READY.has(l.id));
  return ready.length > 0 && ready.every((l) => done(s, l.id));
};
export const BADGES: { id: string; name: string; desc: string; icon: string; test: (s: BadgeState) => boolean }[] = [
  { id: 'first-steps', name: 'First Steps', desc: 'Complete your first challenge.', icon: '👣', test: (s) => Object.values(s.results).some((r) => r.completed) },
  { id: 'axis-master', name: 'Axis Master', desc: 'Score 90+ in Meet the 3D World.', icon: '🧭', test: (s) => (s.results['w1-l1']?.best ?? 0) >= 90 },
  { id: 'projectionist', name: 'Projectionist', desc: 'Score 90+ in Orthographic Views.', icon: '📐', test: (s) => (s.results['w1-l3']?.best ?? 0) >= 90 },
  { id: 'spatial-thinker', name: 'Spatial Thinker', desc: 'Complete every level of World 01.', icon: '🧊', test: (s) => worldDone(s, 1) },
  { id: 'mathematician', name: 'Visual Mathematician', desc: 'Complete every level of World 02.', icon: '📏', test: (s) => worldDone(s, 2) },
  { id: 'cad-cadet', name: 'CAD Cadet', desc: 'Complete three CAD Workshop levels.', icon: '🛠️', test: (s) => ['w3-l1', 'w3-l2', 'w3-l3', 'w3-l4', 'w3-l5', 'w3-l6', 'w3-l7', 'w3-l8', 'w3-l9', 'w3-l10'].filter((id) => done(s, id)).length >= 3 },
  { id: 'cad-master', name: 'CAD Master', desc: 'Pass the CAD Master Challenge.', icon: '🏗️', test: (s) => done(s, 'w3-l10') },
  { id: 'materialist', name: 'Material Scientist', desc: 'Complete every level of World 04.', icon: '🧪', test: (s) => worldDone(s, 4) },
  { id: 'mechanic', name: 'Mechanism Maker', desc: 'Complete four Mechanical Movement levels.', icon: '⚙️', test: (s) => WORLDS[4].levels.filter((l) => done(s, l.id)).length >= 4 },
  { id: 'maker', name: 'Maker', desc: 'Complete the Prototype Challenge.', icon: '🖨️', test: (s) => done(s, 'w7-l6') },
  { id: 'photographer', name: 'Product Photographer', desc: 'Complete the Product Advertisement challenge.', icon: '📸', test: (s) => done(s, 'w8-l3') },
  { id: 'inventor', name: 'Inventor', desc: "Complete any Inventor's Garage mission.", icon: '💡', test: (s) => WORLDS[8].levels.some((l) => done(s, l.id)) },
  { id: 'perfectionist', name: 'Perfectionist', desc: 'Score 100 on any challenge.', icon: '💯', test: (s) => Object.values(s.results).some((r) => r.best >= 100) },
  { id: 'independent', name: 'Independent Thinker', desc: 'Clear five challenges without hints.', icon: '🧠', test: (s) => s.counters.noHintClears >= 5 },
  { id: 'persistent', name: 'Persistent', desc: 'Pass a challenge after four or more attempts.', icon: '🔁', test: (s) => Object.values(s.results).some((r) => r.completed && r.attempts >= 4) },
  { id: 'improver', name: 'Iterative Improver', desc: 'Raise a score by 30+ points over your first attempt.', icon: '📈', test: (s) => Object.values(s.results).some((r) => r.best - r.first >= 30) },
  { id: 'daily-3', name: 'Daily Practice', desc: 'Complete three daily 3D challenges.', icon: '📅', test: (s) => Object.values(s.daily).filter((v) => v >= PASS_MARK).length >= 3 },
  { id: 'exporter', name: 'Ready for Reality', desc: 'Export a model as STL, GLB or glTF.', icon: '📦', test: (s) => s.counters.exports >= 1 },
  { id: 'collector', name: 'Collector', desc: 'Save three projects to your gallery.', icon: '🗂️', test: (s) => s.counters.projectsSaved >= 3 },
  { id: 'sketcher', name: 'Sketch to Solid', desc: 'Turn a sketch into a 3D object in the Sketch-to-3D Studio.', icon: '✏️', test: (s) => s.counters.sketches >= 1 },
  { id: 'physicist', name: 'Physicist', desc: 'Run every Visual Physics Lab experiment.', icon: '🍎', test: (s) => s.counters.physics.length >= 5 },
  { id: 'xp-1000', name: '1,000 XP', desc: 'Earn 1,000 experience points.', icon: '⭐', test: (s) => s.xp >= 1000 },
];

function newBadgesFor(s: BadgeState & { badges: string[] }) {
  return BADGES.filter((b) => !s.badges.includes(b.id) && b.test(s)).map((b) => b.id);
}

/* ---------------- Locks ---------------- */
export function worldUnlocked(n: number, s: Pick<ProgressState, "results" | "settings">): boolean {
  if (n === 1 || s.settings.explorer) return true;
  const prev = WORLDS[n - 2].levels.filter((l) => READY.has(l.id));
  if (prev.length === 0) return worldUnlocked(n - 1, s);
  const doneCount = prev.filter((l) => s.results[l.id]?.completed).length;
  return doneCount >= Math.ceil(prev.length / 2) && worldUnlocked(n - 1, s);
}
export function levelUnlocked(id: string, s: Pick<ProgressState, 'results' | 'settings'>) {
  const l = levelById(id);
  if (!l || !READY.has(id)) return false;
  if (!worldUnlocked(l.world, s)) return false;
  if (s.settings.explorer || l.n === 1) return true;
  const w = WORLDS[l.world - 1];
  const prev = w.levels[l.n - 2];
  return !READY.has(prev.id) || !!s.results[prev.id]?.completed || !!s.results[id];
}

export function skillScores(results: Record<string, LevelResult>) {
  const out: Partial<Record<SkillId, { score: number; max: number }>> = {};
  for (const l of ALL_LEVELS) {
    if (!READY.has(l.id)) continue;
    const o = (out[l.skill] ??= { score: 0, max: 0 });
    o.max += 100;
    o.score += results[l.id]?.best ?? 0;
  }
  return out;
}

const toolsUnlockedNow = (s: Pick<ProgressState, 'results' | 'settings'>) => TOOLS.filter((t) => toolUnlocked(t.id, s)).map((t) => t.id as string);

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...initial,
      record(levelId, score, hintsUsed) {
        const s = get();
        const meta = levelById(levelId);
        const prev = s.results[levelId];
        const sc = Math.round(Math.max(0, Math.min(100, score)));
        const prevBest = prev?.best ?? 0;
        const passed = sc >= PASS_MARK;
        const firstClear = passed && !prev?.completed;
        let xpGained = 0;
        const base = meta?.xp ?? 100;
        if (sc > prevBest) xpGained += Math.round((base * (sc - prevBest)) / 100);
        if (firstClear && hintsUsed === 0) xpGained += Math.round(base * 0.2);
        const toolsBefore = toolsUnlockedNow(s);
        const result: LevelResult = {
          best: Math.max(prevBest, sc),
          first: prev ? prev.first : sc,
          last: sc,
          attempts: (prev?.attempts ?? 0) + 1,
          completed: !!prev?.completed || passed,
          hintsUsed: (prev?.hintsUsed ?? 0) + hintsUsed,
          completedAt: prev?.completedAt ?? (passed ? new Date().toISOString() : undefined),
        };
        const counters = { ...s.counters, noHintClears: s.counters.noHintClears + (firstClear && hintsUsed === 0 ? 1 : 0) };
        const next = { ...s, xp: s.xp + xpGained, results: { ...s.results, [levelId]: result }, counters };
        const newBadges = newBadgesFor(next);
        const newTools = toolsUnlockedNow(next).filter((t) => !toolsBefore.includes(t));
        set({ xp: next.xp, results: next.results, counters, badges: [...s.badges, ...newBadges], lastLevel: levelId });
        return { xpGained, passed, firstClear, newBadges, newTools, improved: sc > prevBest };
      },
      recordDaily(date, score) {
        const s = get();
        const prev = s.daily[date] ?? 0;
        const sc = Math.round(score);
        const xpGained = sc > prev ? Math.round((80 * (sc - prev)) / 100) : 0;
        const next = { ...s, xp: s.xp + xpGained, daily: { ...s.daily, [date]: Math.max(prev, sc) } };
        const newBadges = newBadgesFor(next);
        set({ xp: next.xp, daily: next.daily, badges: [...s.badges, ...newBadges] });
        return { xpGained, passed: sc >= PASS_MARK, firstClear: prev < PASS_MARK && sc >= PASS_MARK, newBadges, newTools: [], improved: sc > prev };
      },
      bump(key, by = 1) {
        const s = get();
        const counters = { ...s.counters, [key]: s.counters[key] + by };
        const newBadges = newBadgesFor({ ...s, counters });
        set({ counters, badges: [...s.badges, ...newBadges] });
        return newBadges;
      },
      physicsDone(id) {
        const s = get();
        if (s.counters.physics.includes(id)) return [];
        const counters = { ...s.counters, physics: [...s.counters.physics, id] };
        const newBadges = newBadgesFor({ ...s, counters });
        set({ counters, badges: [...s.badges, ...newBadges] });
        return newBadges;
      },
      setSettings(p) {
        set({ settings: { ...get().settings, ...p } });
      },
      setLast(id) {
        set({ lastLevel: id });
      },
      reset() {
        set({ ...initial, lastLevel: undefined });
      },
    }),
    { name: 'the-3d-lab-progress', version: 1 },
  ),
);

export const useSettings = () => useProgress((s) => s.settings);
