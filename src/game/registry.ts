import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { LevelDef } from './content';

export interface LevelProps { level: LevelDef }
type LevelComponent = LazyExoticComponent<ComponentType<LevelProps>>;

/** Level id → lazily loaded lesson. Only levels with status 'ready' in content.ts are routed here. */
export const LEVEL_COMPONENTS: Record<string, LevelComponent> = {
  'w1-1': lazy(() => import('../worlds/w1/ColourDetective')),
  'w1-2': lazy(() => import('../worlds/w1/ColourMixer')),
  'w1-3': lazy(() => import('../worlds/w1/Harmony')),
  'w1-4': lazy(() => import('../worlds/w1/Psychology')),
  'w1-5': lazy(() => import('../worlds/w1/Contrast')),
  'w1-6': lazy(() => import('../worlds/w1/Simultaneous')),
  'w1-7': lazy(() => import('../worlds/w1/PaletteArchitect')),
  'w1-8': lazy(() => import('../worlds/w1/MasterOfColour')),
  'w2-1': lazy(() => import('../worlds/w2/Anatomy')),
  'w2-2': lazy(() => import('../worlds/w2/Families')),
  'w2-3': lazy(() => import('../worlds/w2/Kerning')),
  'w2-4': lazy(() => import('../worlds/w2/TrackingLeading')),
  'w2-5': lazy(() => import('../worlds/w2/HierarchyPuzzle')),
  'w2-6': lazy(() => import('../worlds/w2/Pairing')),
  'w2-7': lazy(() => import('../worlds/w2/Editorial')),
  'w2-8': lazy(() => import('../worlds/w2/MagazineCover')),
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
  'w4-1': lazy(() => import('../worlds/w4/CorrectionVsGrading')),
  'w4-2': lazy(() => import('../worlds/w4/Signals')),
  'w4-3': lazy(() => import('../worlds/w4/LogMystery')),
  'w4-4': lazy(() => import('../worlds/w4/Scopes')),
  'w4-5': lazy(() => import('../worlds/w4/PrimaryCorrection')),
  'w4-6': lazy(() => import('../worlds/w4/CinematicContrast')),
  'w4-7': lazy(() => import('../worlds/w4/ShotMatching')),
  'w4-8': lazy(() => import('../worlds/w4/FilmEmulation')),
  'w4-9': lazy(() => import('../worlds/w4/MoodNarrative')),
  'w4-10': lazy(() => import('../worlds/w4/Colourist')),
};
