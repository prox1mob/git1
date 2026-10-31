import { Mission, type MissionConfig } from '../../components/Mission';
import { makeObject, objectSize } from '../../lib/shapes';
import { boxSize, countCutters, cylDia, sceneBox } from '../../lib/missionChecks';
import { fmt } from '../../lib/math';

const DESK: MissionConfig = {
  id: 'w6-l8',
  title: 'Desk Accessory Challenge',
  problem: 'A shared hot-desk has no home for pens and phones: they end up scattered, the phone gets knocked off, and the desk looks messy for the next person.',
  persona: 'A co-working space with many short-stay users. The accessory stays on the desk; people use it for a day at a time.',
  constraints: ['Footprint ≤ 150 × 100 mm, height ≤ 120 mm', 'Holds at least 4 pens in round holes Ø10–14 mm', 'A phone slot 10–16 mm wide', 'Stable: base at least 0.8 × its height wide'],
  research: [
    { text: 'Short-stay users want obvious places for things — no learning.', relevant: true },
    { text: 'Phones are often in thick cases (up to 13 mm).', relevant: true },
    { text: 'Most pens are 8–12 mm in diameter.', relevant: true },
    { text: 'Hot-desks are usually white.', relevant: false },
    { text: 'The accessory must be easy to wipe clean between users.', relevant: true },
  ],
  concepts: [
    { name: 'Monolith block', desc: 'One sculpted block with holes and a slot.' },
    { name: 'Tiered stand', desc: 'Pens at the back, phone at the front, stepped like a stage.' },
    { name: 'Modular tray', desc: 'Separate pieces that can be rearranged.' },
  ],
  starter: () => [makeObject('box', { name: 'Block', dims: { w: 120, h: 60, d: 80 }, position: [0, 30, 0], material: { preset: 'oak', color: '#a9784a', roughness: 0.75, metalness: 0, opacity: 1 } })],
  booleans: true,
  fit: 160,
  checks: (flat, all) => {
    const s = boxSize(sceneBox(flat));
    const pens = countCutters(all, (t) => t.type === 'cylinder' && cylDia(t) >= 10 - 0.01 && cylDia(t) <= 14 + 0.01);
    const slots = countCutters(all, (t) => t.type === 'box' && (() => { const d = objectSize(t); const m = Math.min(...d); return m >= 10 - 0.01 && m <= 16 + 0.01; })());
    return [
      { criterion: 'Footprint ≤ 150 × 100 mm', ok: s[0] <= 150 && s[2] <= 100 && s[0] > 0, note: `${fmt(s[0])} × ${fmt(s[2])} mm` },
      { criterion: 'Height ≤ 120 mm', ok: s[1] <= 120 && s[1] > 0, note: `${fmt(s[1])} mm` },
      { criterion: '≥ 4 pen holes Ø10–14 mm', ok: Math.min(1, pens / 4), note: `${pens} found`, weight: 2 },
      { criterion: 'Phone slot 10–16 mm wide', ok: slots >= 1, note: `${slots} found`, weight: 2 },
      { criterion: 'Stable proportions (width ≥ 0.8 × height)', ok: s[0] >= 0.8 * s[1] },
    ];
  },
  selfChecks: ['A first-time user instantly understands where things go', 'The phone sits at a readable angle or upright without wobbling', 'No dirt-trapping crevices; easy to wipe', 'The form suits a professional workspace'],
  tips: ['Make a cylinder Ø12, height 70, duplicate it 3 times, place them in a row, then subtract each from the block. A thin box (12 mm thick) makes the phone slot.'],
};

export default function L8Challenge() {
  return <Mission cfg={DESK} />;
}
