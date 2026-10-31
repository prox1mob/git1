/**
 * The Sketch Lab world registry. Each world is a self-contained module with its
 * own route. New worlds are added here; nothing in an existing world needs to change.
 */
export interface WorldMeta {
  n: number;
  route: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  blurb: string;
}

export const WORLDS: WorldMeta[] = [
  {
    n: 8,
    route: 'math',
    title: 'The Math Playground',
    subtitle: 'Visual Mathematics & Geometry',
    icon: '📐',
    color: '#3b5bdb',
    blurb: 'Angles, fractions, 3D solids, perspective and curves — learned by moving things, then used to design real products.',
  },
];
