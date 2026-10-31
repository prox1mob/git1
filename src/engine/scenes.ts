import type { SceneId } from './params';

export interface SceneMeta {
  id: SceneId;
  label: string;
  kind: string;
  aspect: number;
  description: string;
  variants?: string[];
  /** Default display roll-off; test patterns use a hard clip so values pass through exactly. */
  rolloff?: number;
}

export const SCENES: SceneMeta[] = [
  { id: 'coast', label: 'Coast at dusk', kind: 'Landscape', aspect: 3 / 2, description: 'A low sun, glittering water and hazy ridges. Huge dynamic range.' },
  { id: 'portrait', label: 'Studio portrait', kind: 'Portrait', aspect: 3 / 2, description: 'Head-and-shoulders portrait. Six complexions, four lighting set-ups.', variants: ['Very light', 'Light', 'Medium-light', 'Medium', 'Medium-deep', 'Deep'] },
  { id: 'facade', label: 'Modernist facade', kind: 'Architecture', aspect: 3 / 2, description: 'Golden-hour sun on limestone, cool shade, a red door.' },
  { id: 'street', label: 'Rain street, night', kind: 'Street / night', aspect: 16 / 9, description: 'Sodium lamps, neon and wet asphalt reflections.' },
  { id: 'stilllife', label: 'Still life + chart', kind: 'Reference', aspect: 3 / 2, description: 'Fruit, a ceramic cup, an 18% grey card and a 24-patch reference chart.' },
  { id: 'sneaker', label: 'Product: sneaker', kind: 'Product', aspect: 3 / 2, description: 'A luxury sneaker on a plinth. Four colourways.', variants: ['Bone & red', 'Noir & gold', 'Cobalt', 'Ivory on vermillion'] },
  { id: 'bars', label: 'Test pattern', kind: 'Test signal', aspect: 16 / 9, description: '75% colour bars and grey ramps.', rolloff: 0 },
];
export const sceneMeta = (id: SceneId) => SCENES.find((s) => s.id === id)!;

export const PORTRAIT_LIGHTS = ['Studio', 'Golden hour', 'Neon night', 'Window daylight'];
export const WARDROBE = ['Camel', 'Cobalt', 'Crimson', 'Black', 'Ivory', 'Forest'];

/** Reference chart and grey card, in scene coordinates (y up, scene height = 1). Shared with the shader. */
export const CHART_RECT: [number, number, number, number] = [-0.69, -0.45, -0.25, -0.16];
export const CARD_RECT: [number, number, number, number] = [-0.2, -0.33, -0.06, 0.06];

/** The 24 patches, sRGB 8-bit values as commonly published for this classic chart layout. */
export const CHART_PATCHES: { name: string; rgb: [number, number, number] }[] = [
  ['Dark skin', 115, 82, 68], ['Light skin', 194, 150, 130], ['Blue sky', 98, 122, 157], ['Foliage', 87, 108, 67], ['Blue flower', 133, 128, 177], ['Bluish green', 103, 189, 170],
  ['Orange', 214, 126, 44], ['Purplish blue', 80, 91, 166], ['Moderate red', 193, 90, 99], ['Purple', 94, 60, 108], ['Yellow green', 157, 188, 64], ['Orange yellow', 224, 163, 46],
  ['Blue', 56, 61, 150], ['Green', 70, 148, 73], ['Red', 175, 54, 60], ['Yellow', 231, 199, 31], ['Magenta', 187, 86, 149], ['Cyan', 8, 133, 161],
  ['White', 243, 243, 242], ['Neutral 8', 200, 200, 200], ['Neutral 6.5', 160, 160, 160], ['Neutral 5', 122, 122, 121], ['Neutral 3.5', 85, 85, 85], ['Black', 52, 52, 52],
].map(([name, r, g, b]) => ({ name: name as string, rgb: [r as number, g as number, b as number] }));

/** Rectangle in analysis-frame coordinates: u, v in 0..1 with v measured from the TOP. */
export interface UvRect { u0: number; v0: number; u1: number; v1: number }

/** Convert a rectangle in scene coordinates to top-down UV for a given aspect and framing. */
export function sceneRectToUv([x0, y0, x1, y1]: [number, number, number, number], aspect: number, frame: [number, number, number] = [0, 0, 1]): UvRect {
  const [fx, fy, z] = frame;
  const u = (x: number) => (x - fx) / z / aspect + 0.5;
  const v = (y: number) => 1 - ((y - fy) / z + 0.5);
  return { u0: u(x0), u1: u(x1), v0: v(y1), v1: v(y0) };
}
export const scenePointRect = (x: number, y: number, r: number): [number, number, number, number] => [x - r, y - r, x + r, y + r];

export function chartPatchRects(aspect: number, frame?: [number, number, number]): UvRect[] {
  const [x0, y0, x1, y1] = CHART_RECT;
  const out: UvRect[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const cx0 = x0 + ((col + 0.25) / 6) * (x1 - x0);
      const cx1 = x0 + ((col + 0.75) / 6) * (x1 - x0);
      const cy1 = y1 - ((row + 0.25) / 4) * (y1 - y0);
      const cy0 = y1 - ((row + 0.75) / 4) * (y1 - y0);
      out.push(sceneRectToUv([cx0, cy0, cx1, cy1], aspect, frame));
    }
  }
  return out;
}

/** Named sample regions (scene coordinates) used by lesson evaluators. */
export const REGIONS = {
  stilllife: {
    card: [CARD_RECT[0] + 0.02, CARD_RECT[1] + 0.03, CARD_RECT[2] - 0.02, CARD_RECT[3] - 0.03] as [number, number, number, number],
    orange: scenePointRect(0.25, -0.18, 0.03),
    lemon: scenePointRect(0.43, -0.23, 0.02),
    cup: scenePointRect(0.04, -0.18, 0.03),
    plum: scenePointRect(0.63, -0.29, 0.015),
    leaf: scenePointRect(0.264, -0.095, 0.006),
    wall: scenePointRect(0.2, 0.25, 0.06),
    table: scenePointRect(0.0, -0.4, 0.05),
  },
  portrait: {
    forehead: scenePointRect(0.0, 0.15, 0.008),
    cheekL: scenePointRect(-0.05, 0.075, 0.012),
    cheekR: scenePointRect(0.05, 0.075, 0.01),
    neck: scenePointRect(-0.015, -0.06, 0.012),
    backdrop: scenePointRect(-0.5, 0.3, 0.06),
    backdropR: scenePointRect(0.5, 0.25, 0.06),
    garment: scenePointRect(-0.18, -0.36, 0.04),
    hair: scenePointRect(-0.06, 0.205, 0.01),
  },
  coast: {
    skyHigh: scenePointRect(0.0, 0.4, 0.05),
    skyLow: scenePointRect(-0.3, 0.02, 0.02),
    sun: scenePointRect(0.2, -0.005, 0.012),
    sea: scenePointRect(-0.4, -0.25, 0.05),
    ridge: scenePointRect(-0.55, -0.02, 0.02),
  },
  street: {
    neon: scenePointRect(-0.27, 0.18, 0.04),
    wall: scenePointRect(-0.6, 0.0, 0.03),
    sky: scenePointRect(0.05, 0.4, 0.04),
    road: scenePointRect(0.1, -0.4, 0.05),
  },
  facade: {
    sunlit: scenePointRect(0.3, 0.05, 0.02),
    shade: scenePointRect(-0.6, 0.1, 0.03),
    sky: scenePointRect(-0.5, 0.42, 0.05),
    door: scenePointRect(0.16, -0.45, 0.01),
  },
} as const;
