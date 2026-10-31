import type { ComponentType } from 'react';

export type TopicKind = 'lesson' | 'challenge';

export interface TopicMeta {
  id: string;
  title: string;
  kind: TopicKind;
  /** marks the four "start here" experiences */
  priority?: boolean;
}

export type TopicModule = { default: Record<string, ComponentType> };

export interface LevelMeta {
  n: number;
  title: string;
  tagline: string;
  icon: string;
  color: string;
  /** maths → sketching connection shown on the map */
  sketchLink: string;
  topics: TopicMeta[];
  load: () => Promise<TopicModule>;
}

export const LEVELS: LevelMeta[] = [
  {
    n: 1, title: 'Number Sense', icon: '🔢', color: '#f08c00',
    tagline: 'Blocks, groups and number lines',
    sketchLink: 'Counting parts, sharing material, battery percentages',
    topics: [
      { id: 'l1-addsub', title: 'Adding & taking away', kind: 'lesson' },
      { id: 'l1-multiply', title: 'Multiplying = equal groups', kind: 'lesson' },
      { id: 'l1-divide', title: 'Sharing equally (division)', kind: 'lesson' },
      { id: 'l1-percent', title: 'Decimals & percentages', kind: 'lesson' },
      { id: 'l1-challenge', title: 'Challenge: pack the parts', kind: 'challenge' },
    ],
    load: () => import('./levels/L01Numbers'),
  },
  {
    n: 2, title: 'The Geometry Playground', icon: '🔷', color: '#1c7ed6',
    tagline: 'Drag corners, watch measurements change',
    sketchLink: 'Geometry → constructing product shapes',
    topics: [
      { id: 'l2-rectangle', title: 'Rectangle: area & perimeter', kind: 'lesson', priority: true },
      { id: 'l2-lines', title: 'Points, lines, parallel & perpendicular', kind: 'lesson' },
      { id: 'l2-shapes', title: 'Triangles & polygons', kind: 'lesson' },
      { id: 'l2-circle', title: 'Circles', kind: 'lesson' },
      { id: 'l2-symmetry', title: 'Symmetry mirror', kind: 'lesson' },
      { id: 'l2-challenge', title: 'Challenge: rectangle of a set area', kind: 'challenge' },
    ],
    load: () => import('./levels/L02Geometry'),
  },
  {
    n: 3, title: 'The Angle Laboratory', icon: '📐', color: '#7048e8',
    tagline: 'Protractors, turns, hinges and arms',
    sketchLink: 'Angles → perspective and mechanisms',
    topics: [
      { id: 'l3-protractor', title: 'The interactive protractor', kind: 'lesson', priority: true },
      { id: 'l3-radians', title: 'Degrees & radians', kind: 'lesson' },
      { id: 'l3-world', title: 'Angles in real products', kind: 'lesson' },
      { id: 'l3-arm', title: 'Challenge: position the mechanical arm', kind: 'challenge' },
    ],
    load: () => import('./levels/L03Angles'),
  },
  {
    n: 4, title: 'Fractions, Ratios & Proportions', icon: '🍕', color: '#e8590c',
    tagline: 'Equal parts and fair comparisons',
    sketchLink: 'Ratios → drawing accurate proportions',
    topics: [
      { id: 'l4-fractions', title: 'Fraction visualiser', kind: 'lesson', priority: true },
      { id: 'l4-equal', title: 'Are the parts equal?', kind: 'lesson' },
      { id: 'l4-ratio', title: 'Ratios by resizing', kind: 'lesson' },
      { id: 'l4-scale', title: 'Challenge: scale a product sketch', kind: 'challenge' },
    ],
    load: () => import('./levels/L04Fractions'),
  },
  {
    n: 5, title: 'The Measurement Studio', icon: '📏', color: '#2b8a3e',
    tagline: 'Millimetres, rulers and scale drawings',
    sketchLink: 'Accurate dimensions → parts that fit',
    topics: [
      { id: 'l5-units', title: 'mm, cm and m', kind: 'lesson' },
      { id: 'l5-ruler', title: 'Virtual ruler & screen calibration', kind: 'lesson' },
      { id: 'l5-scale', title: 'Scale drawings', kind: 'lesson' },
      { id: 'l5-phone', title: 'Challenge: draw a smartphone to size', kind: 'challenge' },
    ],
    load: () => import('./levels/L05Measurement'),
  },
  {
    n: 6, title: 'Algebra Without Fear', icon: '⚖️', color: '#c2255c',
    tagline: 'Letters are just adjustable numbers',
    sketchLink: 'Variables → parametric designs',
    topics: [
      { id: 'l6-variables', title: 'Variables are sliders', kind: 'lesson' },
      { id: 'l6-patterns', title: 'Patterns become expressions', kind: 'lesson' },
      { id: 'l6-balance', title: 'The balance scale', kind: 'lesson' },
      { id: 'l6-challenge', title: 'Challenge: balance the mystery', kind: 'challenge' },
    ],
    load: () => import('./levels/L06Algebra'),
  },
  {
    n: 7, title: 'Coordinate Geometry', icon: '📍', color: '#0c8599',
    tagline: 'Every point has an address',
    sketchLink: 'Coordinates → digital drawing and CAD',
    topics: [
      { id: 'l7-grid', title: 'The X–Y grid', kind: 'lesson' },
      { id: 'l7-distance', title: 'Distance & midpoint', kind: 'lesson' },
      { id: 'l7-slope', title: 'Slope & straight lines', kind: 'lesson' },
      { id: 'l7-challenge', title: 'Challenge: plot the product', kind: 'challenge' },
    ],
    load: () => import('./levels/L07Coordinates'),
  },
  {
    n: 8, title: 'Trigonometry Through Movement', icon: '🌀', color: '#5f3dc4',
    tagline: 'Turning circles and triangle shadows',
    sketchLink: 'Trig → slopes, heights and component positions',
    topics: [
      { id: 'l8-unitcircle', title: 'Unit-circle explorer', kind: 'lesson' },
      { id: 'l8-triangle', title: 'Right-triangle ratios', kind: 'lesson' },
      { id: 'l8-apply', title: 'Heights, ramps & bolt circles', kind: 'lesson' },
      { id: 'l8-challenge', title: 'Challenge: measure the tower', kind: 'challenge' },
    ],
    load: () => import('./levels/L08Trig'),
  },
  {
    n: 9, title: 'Three-Dimensional Geometry', icon: '🧊', color: '#1971c2',
    tagline: 'Rotate, slice and fill solids',
    sketchLink: 'Volume → containers and enclosures',
    topics: [
      { id: 'l9-cube', title: '3D cube explorer', kind: 'lesson', priority: true },
      { id: 'l9-solids', title: 'Solids gallery', kind: 'lesson' },
      { id: 'l9-volume', title: 'Volume builder', kind: 'lesson' },
      { id: 'l9-sections', title: 'Cross-sections', kind: 'lesson' },
      { id: 'l9-container', title: 'Challenge: storage container', kind: 'challenge' },
    ],
    load: () => import('./levels/L09Solids'),
  },
  {
    n: 10, title: 'Perspective Mathematics', icon: '🛤️', color: '#d6336c',
    tagline: 'How 3D becomes a 2D sketch',
    sketchLink: 'Projection → believable sketches',
    topics: [
      { id: 'l10-camera', title: 'Camera & projection', kind: 'lesson' },
      { id: 'l10-vp', title: 'Horizon & vanishing points', kind: 'lesson' },
      { id: 'l10-challenge', title: 'Challenge: two-point box', kind: 'challenge' },
    ],
    load: () => import('./levels/L10Perspective'),
  },
  {
    n: 11, title: 'Curves & Product Forms', icon: '〰️', color: '#099268',
    tagline: 'Arcs, tangents and Bézier curves',
    sketchLink: 'Curves → ergonomic product profiles',
    topics: [
      { id: 'l11-arcs', title: 'Arcs, tangents & fillets', kind: 'lesson' },
      { id: 'l11-bezier', title: 'Bézier curve editor', kind: 'lesson' },
      { id: 'l11-challenge', title: 'Challenge: mouse & sneaker profiles', kind: 'challenge' },
    ],
    load: () => import('./levels/L11Curves'),
  },
  {
    n: 12, title: 'Applied Product Design Maths', icon: '🛠️', color: '#495057',
    tagline: 'Real briefs, real numbers',
    sketchLink: 'Everything together',
    topics: [
      { id: 'l12-sockets', title: 'Extension board socket spacing', kind: 'challenge' },
      { id: 'l12-box', title: 'Storage box with a set capacity', kind: 'challenge' },
      { id: 'l12-camera', title: 'Camera body at scale', kind: 'challenge' },
      { id: 'l12-stand', title: 'Adjustable desk stand angle', kind: 'challenge' },
      { id: 'l12-gears', title: 'A simple rotating mechanism', kind: 'challenge' },
      { id: 'l12-enclosure', title: 'Symmetrical product enclosure', kind: 'challenge' },
      { id: 'l12-material', title: 'Prototype material estimate', kind: 'challenge' },
    ],
    load: () => import('./levels/L12Applied'),
  },
];

export const PRIORITY: { level: number; topic: string; blurb: string }[] = [
  { level: 3, topic: 'l3-protractor', blurb: 'Rotate lines, measure with a real protractor' },
  { level: 2, topic: 'l2-rectangle', blurb: 'Drag corners — live area & perimeter' },
  { level: 4, topic: 'l4-fractions', blurb: 'Cut shapes into equal parts' },
  { level: 9, topic: 'l9-cube', blurb: 'Spin, fill and unfold a 3D cube' },
];

export interface PuzzleMeta {
  id: string;
  title: string;
  icon: string;
  blurb: string;
  load: () => Promise<{ default: ComponentType }>;
}

export const PUZZLES: PuzzleMeta[] = [
  { id: 'fit', title: 'Fit the Shapes', icon: '🧩', blurb: 'Pack every piece into the tray — area, rotation, spatial reasoning', load: () => import('./puzzles/FitShapes') },
  { id: 'bridge', title: 'Build the Bridge', icon: '🌉', blurb: 'Triangles, symmetry and load paths (simplified simulation)', load: () => import('./puzzles/BuildBridge') },
  { id: 'perspective', title: 'Perfect Perspective', icon: '🎯', blurb: 'Find the vanishing points of a box, then sketch your own', load: () => import('./puzzles/PerfectPerspective') },
  { id: 'engineer', title: 'The Product Engineer', icon: '🧑‍🔧', blurb: 'Meet every constraint in a design brief', load: () => import('./puzzles/ProductEngineer') },
  { id: 'curve', title: 'Curve Master', icon: '🖱️', blurb: 'Bend Bézier curves to match a product silhouette', load: () => import('./puzzles/CurveMaster') },
];

export interface ToolMeta {
  id: string;
  title: string;
  icon: string;
  level: number;
  topic: string;
}

/** The toolbox: every working tool, and the lesson where it lives. */
export const TOOLS: ToolMeta[] = [
  { id: 'shapes', title: 'Draggable shapes', icon: '🔷', level: 2, topic: 'l2-shapes' },
  { id: 'protractor', title: 'Interactive protractor', icon: '📐', level: 3, topic: 'l3-protractor' },
  { id: 'ruler', title: 'Virtual ruler', icon: '📏', level: 5, topic: 'l5-ruler' },
  { id: 'grid', title: 'Coordinate grid', icon: '📍', level: 7, topic: 'l7-grid' },
  { id: 'fraction', title: 'Fraction visualiser', icon: '🍕', level: 4, topic: 'l4-fractions' },
  { id: 'balance', title: 'Equation balance scale', icon: '⚖️', level: 6, topic: 'l6-balance' },
  { id: 'graph', title: 'Interactive graphs', icon: '📈', level: 7, topic: 'l7-slope' },
  { id: 'viewer3d', title: '3D object viewer', icon: '🧊', level: 9, topic: 'l9-solids' },
  { id: 'unitcircle', title: 'Unit-circle explorer', icon: '🌀', level: 8, topic: 'l8-unitcircle' },
  { id: 'bezier', title: 'Bézier curve editor', icon: '〰️', level: 11, topic: 'l11-bezier' },
  { id: 'perspective', title: 'Perspective grid', icon: '🛤️', level: 10, topic: 'l10-vp' },
  { id: 'areavolume', title: 'Area & volume visualiser', icon: '🧱', level: 9, topic: 'l9-volume' },
];

export const allTopics = () => LEVELS.flatMap((l) => l.topics.map((t) => ({ ...t, level: l.n })));
