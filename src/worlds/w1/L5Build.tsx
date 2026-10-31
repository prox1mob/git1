import { BuildChallenge, type BuildTarget } from '../../components/BuildChallenge';
import { makeObject } from '../../lib/shapes';
import type { LessonStep } from '../../lib/types';

const m = (c: string) => ({ preset: 'abs', color: c, roughness: 0.45, metalness: 0, opacity: 1 });

export const W1_TARGETS: BuildTarget[] = [
  {
    name: 'Desk lamp',
    blurb: 'A round base (Ø50 × 6 mm), a thin stem (Ø6 × 60 mm) and a cone shade (Ø40 × 25 mm) sitting on top of the stem.',
    parts: [
      makeObject('cylinder', { name: 'Base', position: [0, 3, 0], dims: { r: 25, h: 6 }, material: m('#577590') }),
      makeObject('cylinder', { name: 'Stem', position: [0, 36, 0], dims: { r: 3, h: 60 }, material: m('#e9edf2') }),
      makeObject('cone', { name: 'Shade', position: [0, 78.5, 0], dims: { r: 20, h: 25 }, material: m('#f8961e') }),
    ],
  },
  {
    name: 'Side table',
    blurb: 'A 80 × 6 × 50 mm top resting on four Ø6 legs, 44 mm tall, inset 6 mm from each corner.',
    parts: [
      makeObject('box', { name: 'Table top', position: [0, 47, 0], dims: { w: 80, h: 6, d: 50 }, material: m('#b5838d') }),
      ...([[-34, -19], [34, -19], [-34, 19], [34, 19]] as const).map(([x, z], i) => makeObject('cylinder', { name: `Leg ${i + 1}`, position: [x, 22, z], dims: { r: 3, h: 44 }, material: m('#e9edf2') })),
    ],
  },
  {
    name: 'Toy rocket',
    blurb: 'A Ø20 × 60 mm body standing on fins, a 20 mm tall nose cone, and two crossed fin plates (30 × 14 × 2 mm).',
    parts: [
      makeObject('cylinder', { name: 'Body', position: [0, 30, 0], dims: { r: 10, h: 60 }, material: m('#e9edf2') }),
      makeObject('cone', { name: 'Nose cone', position: [0, 70, 0], dims: { r: 10, h: 20 }, material: m('#f94144') }),
      makeObject('box', { name: 'Fin plate X', position: [0, 7, 0], dims: { w: 34, h: 14, d: 2 }, material: m('#4cc9f0') }),
      makeObject('box', { name: 'Fin plate Z', position: [0, 7, 0], dims: { w: 2, h: 14, d: 34 }, material: m('#4cc9f0') }),
    ],
  },
];

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'On the left is a reference object made only of primitives. Orbit around it: how many shapes? which kinds? how big?', ta: 'இடப்புறம் primitives-களால் ஆன ஒரு மாதிரிப் பொருள் உள்ளது. எத்தனை வடிவங்கள்? எந்த வகை? எவ்வளவு பெரியவை?' },
  { stage: 'UNDERSTAND', text: 'Decompose before you build: list each part, its shape, its size and where it sits. Things that "sit on" each other share a face: the top of one is the bottom of the next.', ta: 'கட்டுவதற்கு முன் பிரித்துப் பாருங்கள்: ஒவ்வொரு பாகமும் என்ன வடிவம், என்ன அளவு, எங்கே இருக்கிறது?' },
  { stage: 'BUILD', text: 'Rebuild it on the yellow ghost. Add shapes, then type exact sizes and positions in the panel. Snapping is set to 1 mm.', ta: 'மஞ்சள் ghost மீது மீண்டும் கட்டுங்கள். அளவுகளையும் நிலைகளையும் panel-இல் டைப் செய்யுங்கள்.' },
  { stage: 'TEST', text: 'Check your work: each part is scored on shape type, position and size. Extra shapes cost points.', ta: 'ஒவ்வொரு பாகமும் வடிவம், நிலை, அளவு அடிப்படையில் மதிப்பிடப்படும்.' },
  { stage: 'IMPROVE', text: 'Use "Show correction" to see arrows from your parts to where they should be. Then try another target from the list.', ta: '"Show correction" அம்புகள் சரியான இடத்தைக் காட்டும்.' },
];

export default function L5Build() {
  return (
    <BuildChallenge
      id="w1-l5"
      steps={steps}
      targets={W1_TARGETS}
      allowed={['box', 'sphere', 'cylinder', 'cone', 'prism']}
      why="Breaking complex objects into simple volumes is how designers block out products, how CAD models are planned feature by feature, and how engineers estimate weight and cost early."
      hints={[
        { en: 'A cylinder’s position is its centre. A 60 mm stem whose bottom is at Y = 6 has its centre at Y = 6 + 30 = 36.', ta: 'Cylinder-இன் நிலை அதன் மையம். கீழ்ப்பகுதி Y = 6 என்றால், மையம் Y = 36.' },
        { en: 'Build one part, then use Duplicate for repeated parts like legs — only the position changes.', ta: 'கால்கள் போன்ற மீண்டும் வரும் பாகங்களுக்கு Duplicate பயன்படுத்துங்கள்.' },
      ]}
    />
  );
}
