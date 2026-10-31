import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ACHIEVEMENTS, LEVELS, levelById, rankFor, SKILLS, WORLDS, type SkillId, type WorldId } from '../game/content';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface LevelRecord {
  best: number;
  last: number;
  attempts: number;
  completed: boolean;
  history: number[];
  firstAt?: string;
}

export interface ProgressState {
  version: 1;
  xp: number;
  levels: Record<string, LevelRecord>;
  achievements: Record<string, string>;
  settings: { difficulty: Difficulty; freeExploration: boolean; showHints: boolean };
  daily: { lastDate?: string; streak: number; history: Record<string, number> };
  visited: WorldId[];
  lastLevel?: string;
  galleryCount: number;
  onboarded: boolean;
}

const KEY = 'visual-lab/progress/v1';

const initial = (): ProgressState => ({
  version: 1,
  xp: 0,
  levels: {},
  achievements: {},
  settings: { difficulty: 'beginner', freeExploration: false, showHints: true },
  daily: { streak: 0, history: {} },
  visited: [],
  galleryCount: 0,
  onboarded: false,
});

function storageAvailable(): boolean {
  try {
    const k = '__vl_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function load(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial();
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    const base = initial();
    return { ...base, ...parsed, settings: { ...base.settings, ...parsed.settings }, daily: { ...base.daily, ...parsed.daily } } as ProgressState;
  } catch {
    return initial();
  }
}

export interface ResultMeta { [k: string]: number | string | boolean | undefined }

export interface RecordOutcome {
  xpGained: number;
  newBest: boolean;
  previousBest: number;
  newAchievements: string[];
  rankUp: string | null;
}

export type AchievementEvent =
  | { kind: 'result'; levelId: string; score: number; meta?: ResultMeta; attempts: number }
  | { kind: 'visit' }
  | { kind: 'daily' }
  | { kind: 'gallery' };

function checkAchievements(s: ProgressState, ev: AchievementEvent): string[] {
  const has = (id: string) => !!s.achievements[id];
  const out: string[] = [];
  const award = (id: string, cond: boolean) => { if (cond && !has(id)) out.push(id); };
  if (ev.kind === 'result') {
    const m = ev.meta ?? {};
    award('first-light', true);
    award('perfectionist', ev.score >= 100);
    award('mistakes-are-data', ev.attempts >= 4);
    award('eagle-eye', typeof m.bestDeltaE === 'number' && m.bestDeltaE < 1);
    award('reading-order', ev.levelId === 'w2-5' && ev.score >= 90);
    award('midtone-mover', ev.levelId === 'w3-2' && ev.score >= 90);
    award('accessible', typeof m.contrast === 'number' && m.contrast >= 7);
    award('neutral-ground', typeof m.neutralChroma === 'number' && m.neutralChroma < 1.5);
    award('kerning-surgeon', ev.levelId === 'w2-3' && ev.score >= 95);
    award('no-clipping', m.noClipping === true);
    award('skin-line', typeof m.skinHueError === 'number' && m.skinHueError < 3);
    award('scope-reader', ev.levelId === 'w4-4' && ev.score >= 100);
    award('shot-matcher', typeof m.matchDeltaE === 'number' && m.matchDeltaE < 3);
    award('colourist', ev.levelId === 'w4-10');
    const done = (id: string) => s.levels[id]?.completed || id === ev.levelId;
    award('creative-director', LEVELS.filter((l) => l.world === 'w5').every((l) => done(l.id)));
    for (const w of ['w1', 'w2', 'w3', 'w4'] as const) {
      award(`world-${w[1]}`, LEVELS.filter((l) => l.world === w).every((l) => done(l.id)));
    }
  }
  if (ev.kind === 'visit') award('explorer', WORLDS.every((w) => s.visited.includes(w.id)));
  if (ev.kind === 'daily') {
    award('daily-3', s.daily.streak >= 3);
    award('daily-7', s.daily.streak >= 7);
  }
  if (ev.kind === 'gallery') award('curator', s.galleryCount >= 5);
  return out;
}

const DIFF_MULT: Record<Difficulty, number> = { beginner: 1, intermediate: 1.25, advanced: 1.5 };

interface Ctx {
  state: ProgressState;
  persistent: boolean;
  recordResult: (levelId: string, score: number, meta?: ResultMeta) => RecordOutcome;
  recordDaily: (dateKey: string, score: number) => RecordOutcome;
  visitWorld: (w: WorldId) => void;
  setLastLevel: (id: string) => void;
  setSettings: (s: Partial<ProgressState['settings']>) => void;
  bumpGallery: (delta: number) => void;
  completeOnboarding: () => void;
  reset: () => void;
  importState: (json: string) => boolean;
  mastery: (skill: SkillId) => number;
  isUnlocked: (levelId: string) => boolean;
  onAchievements: (fn: (ids: string[]) => void) => () => void;
}

const ProgressContext = createContext<Ctx | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const persistent = useMemo(storageAvailable, []);
  const [state, setState] = useState<ProgressState>(() => (persistent ? load() : initial()));
  const ref = useRef(state);
  ref.current = state;
  const listeners = useRef(new Set<(ids: string[]) => void>());

  useEffect(() => {
    if (!persistent) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota or private mode: progress stays in memory */
    }
  }, [state, persistent]);

  const commit = useCallback((next: ProgressState, ev: AchievementEvent | null): string[] => {
    let ids: string[] = [];
    if (ev) {
      ids = checkAchievements(next, ev);
      if (ids.length) {
        const now = new Date().toISOString();
        next = { ...next, achievements: { ...next.achievements, ...Object.fromEntries(ids.map((i) => [i, now])) }, xp: next.xp + ids.length * 25 };
      }
    }
    ref.current = next;
    setState(next);
    if (ids.length) queueMicrotask(() => listeners.current.forEach((fn) => fn(ids)));
    return ids;
  }, []);

  const recordResult = useCallback((levelId: string, rawScore: number, meta?: ResultMeta): RecordOutcome => {
    const s = ref.current;
    const level = levelById(levelId);
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));
    const prev = s.levels[levelId];
    const previousBest = prev?.best ?? 0;
    const base = level?.xp ?? 100;
    const mult = DIFF_MULT[s.settings.difficulty];
    // XP rewards first completion, improvement, and simply practising — never subtracts.
    let xp = 10; // practice XP for every attempt
    if (!prev?.completed) xp += Math.round((base * mult * score) / 100);
    else if (score > previousBest) xp += Math.round((base * mult * (score - previousBest)) / 100);
    const rec: LevelRecord = {
      best: Math.max(previousBest, score),
      last: score,
      attempts: (prev?.attempts ?? 0) + 1,
      completed: true,
      history: [...(prev?.history ?? []), score].slice(-12),
      firstAt: prev?.firstAt ?? new Date().toISOString(),
    };
    const beforeRank = rankFor(s.xp).title;
    const next: ProgressState = { ...s, xp: s.xp + xp, levels: { ...s.levels, [levelId]: rec }, lastLevel: levelId };
    const newAchievements = commit(next, { kind: 'result', levelId, score, meta, attempts: rec.attempts });
    const afterRank = rankFor(ref.current.xp).title;
    return { xpGained: xp + newAchievements.length * 25, newBest: score > previousBest, previousBest, newAchievements, rankUp: afterRank !== beforeRank ? afterRank : null };
  }, [commit]);

  const recordDaily = useCallback((dateKey: string, score: number): RecordOutcome => {
    const s = ref.current;
    const already = s.daily.history[dateKey] !== undefined;
    const yesterday = new Date(dateKey + 'T12:00:00');
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = yesterday.toISOString().slice(0, 10);
    const streak = already ? s.daily.streak : s.daily.lastDate === yKey ? s.daily.streak + 1 : 1;
    const xp = already ? 10 : 120 + Math.min(streak, 7) * 10;
    const beforeRank = rankFor(s.xp).title;
    const next: ProgressState = {
      ...s,
      xp: s.xp + xp,
      daily: { lastDate: dateKey, streak, history: { ...s.daily.history, [dateKey]: Math.max(score, s.daily.history[dateKey] ?? 0) } },
    };
    const newAchievements = commit(next, { kind: 'daily' });
    const afterRank = rankFor(ref.current.xp).title;
    return { xpGained: xp + newAchievements.length * 25, newBest: !already, previousBest: s.daily.history[dateKey] ?? 0, newAchievements, rankUp: afterRank !== beforeRank ? afterRank : null };
  }, [commit]);

  const visitWorld = useCallback((w: WorldId) => {
    const s = ref.current;
    if (s.visited.includes(w)) return;
    commit({ ...s, visited: [...s.visited, w] }, { kind: 'visit' });
  }, [commit]);

  const setLastLevel = useCallback((id: string) => {
    if (ref.current.lastLevel !== id) commit({ ...ref.current, lastLevel: id }, null);
  }, [commit]);
  const setSettings = useCallback((p: Partial<ProgressState['settings']>) => {
    commit({ ...ref.current, settings: { ...ref.current.settings, ...p } }, null);
  }, [commit]);
  const bumpGallery = useCallback((d: number) => {
    const s = ref.current;
    commit({ ...s, galleryCount: Math.max(0, s.galleryCount + d) }, d > 0 ? { kind: 'gallery' } : null);
  }, [commit]);
  const completeOnboarding = useCallback(() => commit({ ...ref.current, onboarded: true }, null), [commit]);
  const reset = useCallback(() => commit({ ...initial(), onboarded: true }, null), [commit]);
  const importState = useCallback((json: string) => {
    try {
      const p = JSON.parse(json) as ProgressState;
      if (p.version !== 1 || typeof p.xp !== 'number') return false;
      commit({ ...initial(), ...p }, null);
      return true;
    } catch {
      return false;
    }
  }, [commit]);

  const mastery = useCallback((skill: SkillId) => {
    const ls = LEVELS.filter((l) => l.skills.includes(skill) && l.status === 'ready');
    if (!ls.length) return 0;
    return Math.round(ls.reduce((a, l) => a + (state.levels[l.id]?.best ?? 0), 0) / ls.length);
  }, [state.levels]);

  const isUnlocked = useCallback((levelId: string) => {
    const l = levelById(levelId);
    if (!l?.requires || state.settings.freeExploration) return true;
    return l.requires.every((r) => state.levels[r]?.completed);
  }, [state.levels, state.settings.freeExploration]);

  const onAchievements = useCallback((fn: (ids: string[]) => void) => {
    listeners.current.add(fn);
    return () => { listeners.current.delete(fn); };
  }, []);

  const value = useMemo<Ctx>(() => ({
    state, persistent, recordResult, recordDaily, visitWorld, setLastLevel, setSettings, bumpGallery, completeOnboarding, reset, importState, mastery, isUnlocked, onAchievements,
  }), [state, persistent, recordResult, recordDaily, visitWorld, setLastLevel, setSettings, bumpGallery, completeOnboarding, reset, importState, mastery, isUnlocked, onAchievements]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const c = useContext(ProgressContext);
  if (!c) throw new Error('useProgress outside provider');
  return c;
}

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);
export const skillLabel = (s: SkillId) => SKILLS[s].label;
