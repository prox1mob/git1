import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { LevelDef } from './content';

export interface LevelProps { level: LevelDef }
type LevelComponent = LazyExoticComponent<ComponentType<LevelProps>>;

/** Level id → lazily loaded lesson. Only levels with status 'ready' in content.ts are routed here. */
export const LEVEL_COMPONENTS: Record<string, LevelComponent> = {
  'w1-2': lazy(() => import('../worlds/w1/ColourMixer')),
  'w2-5': lazy(() => import('../worlds/w2/HierarchyPuzzle')),
  'w3-2': lazy(() => import('../worlds/w3/GammaLab')),
};
