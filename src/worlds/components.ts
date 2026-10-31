import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/** Only levels listed here are playable. Everything else in meta.ts is shown as "Planned". */
export const LEVEL_COMPONENTS: Record<string, LazyExoticComponent<ComponentType>> = {
  'w1-l1': lazy(() => import('./w1/L1Axes')),
  'w1-l2': lazy(() => import('./w1/L2Shapes')),
  'w1-l3': lazy(() => import('./w1/L3Ortho')),
  'w1-l4': lazy(() => import('./w1/L4Rotation')),
  'w1-l5': lazy(() => import('./w1/L5Build')),
  'w1-l6': lazy(() => import('./w1/L6Puzzle')),
};
