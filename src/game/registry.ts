import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { LevelDef } from './content';

export interface LevelProps { level: LevelDef }
type LevelComponent = LazyExoticComponent<ComponentType<LevelProps>>;

/** Level id → lazily loaded lesson. Only levels with status 'ready' in content.ts are routed here. */
export const LEVEL_COMPONENTS: Record<string, LevelComponent> = {
  'w1-2': lazy(() => import('../worlds/w1/ColourMixer')),
  'w2-5': lazy(() => import('../worlds/w2/HierarchyPuzzle')),
  'w3-1': lazy(() => import('../worlds/w3/Exposure')),
  'w3-2': lazy(() => import('../worlds/w3/GammaLab')),
  'w3-3': lazy(() => import('../worlds/w3/DynamicRange')),
  'w3-4': lazy(() => import('../worlds/w3/WhiteBalance')),
  'w3-5': lazy(() => import('../worlds/w3/LiftGammaGain')),
  'w3-6': lazy(() => import('../worlds/w3/Curves')),
  'w3-7': lazy(() => import('../worlds/w3/HslMixer')),
  'w3-8': lazy(() => import('../worlds/w3/SkinTone')),
  'w3-9': lazy(() => import('../worlds/w3/ColourSeparation')),
  'w3-10': lazy(() => import('../worlds/w3/MasterChallenge')),
};
