import { makeObject, objectSize, type SceneObject } from '../../lib/shapes';
import { boxSize, byName, countCutters, cylDia, inside, insideEllipsoid, overlaps, sceneBox } from '../../lib/missionChecks';
import { fmt } from '../../lib/math';
import type { AutoCheck, MissionConfig } from '../../components/Mission';

const m = (c: string, opacity = 1) => ({ preset: 'abs', color: c, roughness: 0.45, metalness: 0, opacity });

/* ------------------------------- 1. Cable management ------------------------------- */
export const CABLE: MissionConfig = {
  id: 'w9-l1',
  title: 'Cable Management Device',
  problem: 'Charging cables keep sliding off the desk and falling behind it. Every evening the user crawls under the desk to fish them out.',
  persona: 'Priya, a student with a laptop charger (Ø6 mm cable), a phone cable (Ø3.5 mm) and earbud cable (Ø3 mm). Her desk edge is 18 mm thick.',
  constraints: ['Holds at least 3 cables in separate slots', 'Slots Ø6–8 mm so cables click in but can be pulled out', 'Footprint ≤ 80 × 60 mm, height ≤ 40 mm', 'Heavy/wide enough not to be dragged off by a cable'],
  research: [
    { text: 'Cables have different diameters (3–6 mm).', relevant: true },
    { text: 'Plugs are wider than cables, so a slot must let the cable — not the plug — pass.', relevant: true },
    { text: 'The user prefers blue.', relevant: false },
    { text: 'A tug on the cable pulls sideways on the holder.', relevant: true },
    { text: 'Desks are usually made of wood.', relevant: false },
  ],
  concepts: [
    { name: 'Weighted desk block', desc: 'A heavy low block with slots on top; cables drop in from above.' },
    { name: 'Edge clip', desc: 'A C-clip that grips the desk edge, with slots facing the user.' },
    { name: 'Adhesive comb', desc: 'A thin comb stuck to the desk with tape.' },
  ],
  starter: () => [makeObject('box', { name: 'Body', dims: { w: 70, h: 24, d: 40 }, position: [0, 12, 0], material: m('#4cc9f0') }), makeObject('cylinder', { name: 'Slot cutter', dims: { r: 3.5, h: 50 }, position: [-20, 24, 0], rotation: [Math.PI / 2, 0, 0], material: m('#f8961e') })],
  booleans: true,
  checks: (flat, all) => {
    const s = boxSize(sceneBox(flat));
    const slots = countCutters(all, (t) => t.type === 'cylinder' && cylDia(t) >= 6 - 0.01 && cylDia(t) <= 8 + 0.01);
    return [
      { criterion: 'At least 3 slots Ø6–8 mm (subtracted cylinders)', ok: Math.min(1, slots / 3), note: `${slots} found`, weight: 2 },
      { criterion: 'Footprint ≤ 80 × 60 mm', ok: s[0] <= 80 && s[2] <= 60, note: `${fmt(s[0])} × ${fmt(s[2])} mm` },
      { criterion: 'Height ≤ 40 mm', ok: s[1] <= 40 && s[1] > 0, note: `${fmt(s[1])} mm` },
      { criterion: 'Stable: width at least 1.2 × height', ok: s[0] >= 1.2 * s[1], note: `ratio ${fmt(s[0] / Math.max(1, s[1]), 2)}` },
    ];
  },
  selfChecks: ['Each slot opening is narrower than its plug, so cables cannot slip through', 'Slot spacing leaves room for fingers', 'Edges that touch hands are rounded or chamfered'],
  tips: ['Duplicate the slot cutter twice, move the copies, then subtract each from the body (select Body first, then the cutter).'],
};

/* ------------------------------- 3. Computer mouse ------------------------------- */
const mouseParts = () => [
  makeObject('sphere', { name: 'Shell', dims: { r: 30 }, scale: [1.9, 0.62, 1.05], position: [0, 18.6, 0], material: m('#e9edf2', 0.3) }),
  makeObject('box', { name: 'PCB', dims: { w: 60, h: 1.6, d: 30 }, position: [0, 6, 0], material: m('#2e7d32') }),
  makeObject('cylinder', { name: 'Battery AA', dims: { r: 7.25, h: 50 }, position: [-10, 14, 0], rotation: [0, 0, Math.PI / 2], material: m('#f8961e') }),
  makeObject('box', { name: 'Sensor', dims: { w: 8, h: 4, d: 8 }, position: [20, 3, 0], material: m('#222') }),
  makeObject('box', { name: 'Left button', dims: { w: 30, h: 2, d: 16 }, position: [30, 32, -9], material: m('#577590') }),
  makeObject('box', { name: 'Right button', dims: { w: 30, h: 2, d: 16 }, position: [30, 32, 9], material: m('#577590') }),
];
export const MOUSE: MissionConfig = {
  id: 'w9-l3',
  title: 'Computer Mouse',
  problem: 'Office workers report wrist strain from a tiny travel mouse. Design a full-size, comfortable wireless mouse.',
  persona: 'Arun, 50th-percentile adult hand (≈ 190 mm long, 85 mm wide), uses a palm grip for 6+ hours a day.',
  constraints: ['Length 100–125 mm, width 55–70 mm, height 35–45 mm', 'PCB and AA battery fully inside the shell with ≥ 1.5 mm wall; the sensor sits in the base plate', 'Components do not overlap', 'Sensor near the bottom; buttons above the front of the shell'],
  research: [
    { text: 'A palm grip rests the whole hand on the mouse, so height and back curve matter most.', relevant: true },
    { text: 'The AA battery is the largest internal part and drives the height.', relevant: true },
    { text: 'Gamers like RGB lights.', relevant: false },
    { text: 'The optical sensor must be within ~3 mm of the desk surface.', relevant: true },
    { text: 'Most mice are black.', relevant: false },
  ],
  concepts: [
    { name: 'Classic ergonomic', desc: 'Right-handed hump that supports the palm.' },
    { name: 'Symmetric', desc: 'Ambidextrous dome, slightly less support, fits everyone.' },
    { name: 'Vertical', desc: 'Handshake posture reduces forearm twist — taller, needs more stability.' },
  ],
  starter: mouseParts,
  allowed: ['sphere', 'box', 'cylinder'],
  checks: (flat) => {
    const shell = byName(flat, 'Shell');
    if (!shell) return [{ criterion: 'Keep the part named “Shell”', ok: false }];
    const [L, H, W] = objectSize(shell);
    const comps = ['PCB', 'Battery AA'].map((n) => byName(flat, n)).filter(Boolean) as SceneObject[];
    const inOk = comps.filter((c) => insideEllipsoid(c, shell, 1.5));
    const sensor = byName(flat, 'Sensor');
    const all3 = [...comps, ...(sensor ? [sensor] : [])];
    let overlap = 0;
    for (let i = 0; i < all3.length; i++) for (let j = i + 1; j < all3.length; j++) if (overlaps(all3[i], all3[j])) overlap++;
    const buttons = ['Left button', 'Right button'].map((n) => byName(flat, n)).filter(Boolean) as SceneObject[];
    return [
      { criterion: 'Shell length 100–125 mm', ok: L >= 100 && L <= 125, note: `${fmt(L)} mm` },
      { criterion: 'Shell width 55–70 mm', ok: W >= 55 && W <= 70, note: `${fmt(W)} mm` },
      { criterion: 'Shell height 35–45 mm', ok: H >= 35 && H <= 45, note: `${fmt(H)} mm` },
      { criterion: 'PCB and battery inside the shell (1.5 mm wall)', ok: inOk.length / 2, note: comps.filter((c) => !inOk.includes(c)).map((c) => c.name).join(', ') || 'all inside', weight: 2 },
      { criterion: 'No overlapping components', ok: overlap === 0, note: `${overlap} clash(es)` },
      { criterion: 'Sensor within 3 mm of the desk, under the shell', ok: !!sensor && sensor.position[1] - objectSize(sensor)[1] / 2 <= 3 && Math.abs(sensor.position[0] - shell.position[0]) < L / 2 - 10 && Math.abs(sensor.position[2] - shell.position[2]) < W / 2 - 10 },
      { criterion: 'Buttons sit on the front top of the shell', ok: buttons.length === 2 && buttons.every((b) => b.position[0] > 0 && Math.abs(b.position[1] + objectSize(b)[1] / 2 - (shell.position[1] + H / 2)) < 6) },
    ];
  },
  selfChecks: ['The highest point supports the palm, not the fingers', 'Thumb and little finger have somewhere natural to rest', 'Silhouette looks balanced from the side'],
  tips: ['Change the shell’s scale factors (X = length, Y = height, Z = width) in the panel, then move the battery down until it fits.'],
};

/* ------------------------------- 5. Compact camera ------------------------------- */
export const CAMERA: MissionConfig = {
  id: 'w9-l5',
  title: 'Compact Camera',
  problem: 'Travellers want a pocketable camera with a secure grip and a shutter that falls naturally under the index finger.',
  persona: 'Meena, travel photographer, shoots one-handed while walking, often with gloves.',
  constraints: ['Body no larger than 120 × 70 × 45 mm', 'Sensor directly behind the lens (aligned within 2 mm)', 'Battery inside the body', 'Grip on the right protrudes ≥ 8 mm in front', 'Shutter button on top, above the grip'],
  research: [
    { text: 'One-handed use means the grip and shutter must line up with the right hand.', relevant: true },
    { text: 'Gloves need larger, raised controls.', relevant: true },
    { text: 'The lens and sensor must share one optical axis.', relevant: true },
    { text: 'Camera bags come in many colours.', relevant: false },
  ],
  concepts: [
    { name: 'Rangefinder style', desc: 'Flat box, lens offset to the left, generous grip.' },
    { name: 'Rounded pebble', desc: 'Soft forms, lens centred, grip moulded into the body.' },
    { name: 'Rugged', desc: 'Thick rubber bumpers and oversized controls.' },
  ],
  starter: () => [
    makeObject('box', { name: 'Body', dims: { w: 110, h: 64, d: 34 }, position: [0, 32, 0], material: m('#c9ced6', 0.3) }),
    makeObject('cylinder', { name: 'Lens', dims: { r: 18, h: 22 }, position: [-10, 34, 26], rotation: [Math.PI / 2, 0, 0], material: m('#b7bcc4') }),
    makeObject('box', { name: 'Sensor', dims: { w: 24, h: 18, d: 3 }, position: [0, 30, 4], material: m('#2e7d32') }),
    makeObject('box', { name: 'Battery', dims: { w: 36, h: 52, d: 12 }, position: [36, 30, -6], material: m('#f8961e') }),
    makeObject('box', { name: 'Grip', dims: { w: 26, h: 56, d: 10 }, position: [40, 32, 18], material: m('#577590') }),
    makeObject('cylinder', { name: 'Shutter', dims: { r: 5, h: 5 }, position: [0, 66.5, 0], material: m('#f94144') }),
  ],
  allowed: ['box', 'cylinder', 'sphere'],
  checks: (flat) => {
    const body = byName(flat, 'Body'),
      lens = byName(flat, 'Lens'),
      sensor = byName(flat, 'Sensor'),
      bat = byName(flat, 'Battery'),
      grip = byName(flat, 'Grip'),
      sh = byName(flat, 'Shutter');
    if (!body) return [{ criterion: 'Keep the part named “Body”', ok: false }];
    const bs = objectSize(body);
    const front = body.position[2] + bs[2] / 2;
    return [
      { criterion: 'Body ≤ 120 × 70 × 45 mm', ok: bs[0] <= 120 && bs[1] <= 70 && bs[2] <= 45, note: bs.map((v) => fmt(v)).join(' × ') },
      { criterion: 'Sensor aligned behind the lens (≤ 2 mm)', ok: !!lens && !!sensor && Math.hypot(lens.position[0] - sensor.position[0], lens.position[1] - sensor.position[1]) <= 2 && sensor.position[2] < lens.position[2], note: lens && sensor ? `offset ${fmt(Math.hypot(lens.position[0] - sensor.position[0], lens.position[1] - sensor.position[1]), 1)} mm` : 'missing part', weight: 2 },
      { criterion: 'Battery inside the body', ok: !!bat && inside(bat, body, 0.5) },
      { criterion: 'Battery does not clash with the sensor', ok: !!bat && !!sensor && !overlaps(bat, sensor) },
      { criterion: 'Grip on the right, protruding ≥ 8 mm in front', ok: !!grip && grip.position[0] > 0 && grip.position[2] + objectSize(grip)[2] / 2 - front >= 8 },
      { criterion: 'Shutter on top, above the grip', ok: !!sh && !!grip && sh.position[1] >= body.position[1] + bs[1] / 2 && Math.abs(sh.position[0] - grip.position[0]) <= objectSize(grip)[0] / 2 + 2 },
    ];
  },
  selfChecks: ['Controls are big enough to press with gloves', 'The lens does not get in the way of the grip', 'The shape reads clearly as a camera from the front'],
  tips: ['Move the sensor so its X and Y match the lens; move the shutter so its X matches the grip.'],
};

/* ------------------------------- 6. Footwear ------------------------------- */
export const SHOE: MissionConfig = {
  id: 'w9-l6',
  title: 'Footwear Concept',
  problem: 'A running club wants a concept for an everyday trainer for EU size 42 with a gentle heel-to-toe drop.',
  persona: 'Karthik, EU 42 (foot ≈ 265 mm long, ≈ 100 mm wide), runs 20 km a week on roads.',
  constraints: ['Last (foot form) length = foot + 10–15 mm toe allowance', 'Sole length ≥ last length + 5 mm, width 95–110 mm', 'Heel stack 25–35 mm, forefoot 15–25 mm (drop 6–12 mm)', 'Upper covers the last'],
  research: [
    { text: 'Toes need room to spread: the last is longer than the foot.', relevant: true },
    { text: 'Heel-to-toe drop changes how the foot strikes the ground.', relevant: true },
    { text: 'Shoes are sold in boxes.', relevant: false },
    { text: 'The midsole stack absorbs impact; too much makes it unstable.', relevant: true },
  ],
  concepts: [
    { name: 'Cushioned daily trainer', desc: 'Moderate stack, wide base, 8–10 mm drop.' },
    { name: 'Minimal', desc: 'Low stack, flexible, smaller drop.' },
    { name: 'Max-cushion', desc: 'High stack with a wide base for stability.' },
  ],
  starter: () => [
    makeObject('sphere', { name: 'Last', dims: { r: 50 }, scale: [2.6, 0.7, 0.95], position: [0, 60, 0], material: m('#d8b779') }),
    makeObject('box', { name: 'Heel sole', dims: { w: 110, h: 20, d: 90 }, position: [-80, 10, 0], material: m('#e9edf2') }),
    makeObject('box', { name: 'Forefoot sole', dims: { w: 170, h: 20, d: 100 }, position: [55, 10, 0], material: m('#e9edf2') }),
    makeObject('sphere', { name: 'Upper', dims: { r: 52 }, scale: [2.6, 0.8, 1.0], position: [0, 64, 0], material: m('#f94144', 0.6) }),
  ],
  allowed: ['sphere', 'box', 'cylinder'],
  fit: 220,
  checks: (flat) => {
    const last = byName(flat, 'Last'),
      heel = byName(flat, 'Heel sole'),
      fore = byName(flat, 'Forefoot sole'),
      up = byName(flat, 'Upper');
    if (!last || !heel || !fore) return [{ criterion: 'Keep the parts named Last, Heel sole and Forefoot sole', ok: false }];
    const Ll = objectSize(last)[0];
    const sole = sceneBox([heel, fore]);
    const ss = boxSize(sole);
    const hs = objectSize(heel)[1],
      fs = objectSize(fore)[1];
    return [
      { criterion: 'Last length 275–280 mm (265 + 10–15)', ok: Ll >= 275 && Ll <= 280, note: `${fmt(Ll)} mm`, weight: 2 },
      { criterion: 'Sole length ≥ last + 5 mm', ok: ss[0] >= Ll + 5, note: `${fmt(ss[0])} mm` },
      { criterion: 'Sole width 95–110 mm', ok: ss[2] >= 95 && ss[2] <= 110, note: `${fmt(ss[2])} mm` },
      { criterion: 'Heel stack 25–35 mm', ok: hs >= 25 && hs <= 35, note: `${fmt(hs)} mm` },
      { criterion: 'Forefoot stack 15–25 mm', ok: fs >= 15 && fs <= 25, note: `${fmt(fs)} mm` },
      { criterion: 'Drop 6–12 mm', ok: hs - fs >= 6 && hs - fs <= 12, note: `${fmt(hs - fs)} mm` },
      { criterion: 'Upper covers the last', ok: !!up && objectSize(up).every((v, i) => v >= objectSize(last)[i]) },
    ];
  },
  selfChecks: ['The sole is wider under the forefoot than under the arch', 'The toe is raised slightly (toe spring) to help rolling', 'Proportions read as a running shoe from the side'],
  disclaimer: 'Concept only: production footwear needs specialised last-making and pattern software, wear trials, and material and biomechanics testing.',
  tips: ['Set the Last’s scale X so 2 × 50 × scaleX = 278 mm (scaleX ≈ 2.78).'],
};

/* ------------------------------- 7. Original invention ------------------------------- */
export const ORIGINAL: MissionConfig = {
  id: 'w9-l7',
  title: 'Original Invention',
  problem: 'Find a real, everyday problem — at home, school or work — and invent a physical product that solves it. Write it in the concept tab.',
  persona: 'You choose. Describe one real person (age, situation, what annoys them) in your concept.',
  constraints: ['Fits within a 200 mm cube', 'At least 3 distinct parts or features', 'Uses at least one Boolean cut or a hole', 'Printable: every part ≥ 1.2 mm'],
  research: [
    { text: 'Watch someone experience the problem instead of guessing.', relevant: true },
    { text: 'Check what existing products do and where they fail.', relevant: true },
    { text: 'More features always make a better product.', relevant: false },
    { text: 'Write the problem as one sentence before sketching solutions.', relevant: true },
  ],
  concepts: [{ name: 'Start from a sketch', desc: 'Use the Sketch-to-3D studio for the main outline, then refine here.' }],
  starter: () => [],
  booleans: true,
  fit: 200,
  checks: (flat, all) => {
    const s = boxSize(sceneBox(flat));
    const cuts = countCutters(all, () => true);
    const thin = flat.filter((o) => Math.min(...objectSize(o)) < 1.2);
    return [
      { criterion: 'Fits within a 200 mm cube', ok: flat.length > 0 && s.every((v) => v <= 200), note: s.map((v) => fmt(v)).join(' × ') },
      { criterion: 'At least 3 parts or features', ok: Math.min(1, (flat.length + cuts) / 3), note: `${flat.length} parts, ${cuts} cuts` },
      { criterion: 'At least one Boolean cut', ok: cuts >= 1 },
      { criterion: 'Every part ≥ 1.2 mm', ok: flat.length > 0 && !thin.length, note: thin.map((o) => o.name).join(', ') || 'ok' },
    ];
  },
  selfChecks: ['I described a specific person and their problem', 'My design solves that problem better than the obvious alternative', 'I know what I would test first with a printed prototype', 'I considered material and manufacturing method'],
};

export type { AutoCheck };
