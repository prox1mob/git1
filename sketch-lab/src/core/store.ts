import { useSyncExternalStore } from 'react';

/**
 * One small global store for settings + learning progress.
 * Saved to localStorage when it is available (it may be blocked in some
 * embedded browsers, so every access is guarded and the game keeps working
 * in memory).
 */

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Settings {
  tamil: boolean;
  difficulty: Difficulty;
  /** Screen calibration: how many CSS pixels make one real millimetre. null = not calibrated. */
  pxPerMm: number | null;
}

export interface ChallengeRecord {
  done: boolean;
  stars: number;
  attempts: number;
  at: number;
}

export interface AppState {
  settings: Settings;
  /** topicId -> list of stage indexes the learner has opened */
  stages: Record<string, number[]>;
  challenges: Record<string, ChallengeRecord>;
  lastRoute: string;
}

const KEY = 'sketchlab.v1';

const DEFAULT: AppState = {
  settings: { tamil: false, difficulty: 'normal', pxPerMm: null },
  stages: {},
  challenges: {},
  lastRoute: '',
};

function load(): AppState {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...structuredClone(DEFAULT),
      ...parsed,
      settings: { ...DEFAULT.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT);
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function save() {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — progress lives in memory only */
  }
}

function emit(next: AppState) {
  state = next;
  save();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getState() {
  return state;
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useSettings(): Settings {
  return useAppState().settings;
}

export function updateSettings(patch: Partial<Settings>) {
  emit({ ...state, settings: { ...state.settings, ...patch } });
}

export function markStage(topicId: string, stage: number) {
  const seen = state.stages[topicId] ?? [];
  if (seen.includes(stage)) return;
  emit({ ...state, stages: { ...state.stages, [topicId]: [...seen, stage].sort((a, b) => a - b) } });
}

export function recordAttempt(id: string) {
  const prev = state.challenges[id] ?? { done: false, stars: 0, attempts: 0, at: 0 };
  emit({ ...state, challenges: { ...state.challenges, [id]: { ...prev, attempts: prev.attempts + 1 } } });
}

export function completeChallenge(id: string, stars: number) {
  const prev = state.challenges[id] ?? { done: false, stars: 0, attempts: 0, at: 0 };
  emit({
    ...state,
    challenges: {
      ...state.challenges,
      [id]: { done: true, stars: Math.max(prev.stars, stars), attempts: prev.attempts, at: Date.now() },
    },
  });
}

export function setLastRoute(route: string) {
  if (state.lastRoute === route) return;
  state = { ...state, lastRoute: route };
  save();
}

export function resetProgress() {
  emit({ ...structuredClone(DEFAULT), settings: state.settings });
}

export function storageAvailable(): boolean {
  try {
    const k = '__sketchlab_probe__';
    globalThis.localStorage.setItem(k, '1');
    globalThis.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}
