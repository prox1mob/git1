import type { SkillId } from '../lib/types';

export interface LevelMeta {
  id: string;
  world: number;
  n: number;
  title: string;
  ta: string;
  summary: string;
  skill: SkillId;
  xp: number;
}

export interface WorldMeta {
  n: number;
  title: string;
  ta: string;
  goal: string;
  phase: number;
  color: string;
  skill: SkillId;
  levels: LevelMeta[];
}

type L = [title: string, ta: string, summary: string, xp?: number];

function world(n: number, title: string, ta: string, goal: string, phase: number, color: string, skill: SkillId, levels: L[]): WorldMeta {
  return {
    n,
    title,
    ta,
    goal,
    phase,
    color,
    skill,
    levels: levels.map(([t, tta, s, xp], i) => ({
      id: `w${n}-l${i + 1}`,
      world: n,
      n: i + 1,
      title: t,
      ta: tta,
      summary: s,
      skill,
      xp: xp ?? 100 + i * 10,
    })),
  };
}

export const WORLDS: WorldMeta[] = [
  world(1, 'The Spatial Thinking Lab', 'இடஞ்சார் சிந்தனை ஆய்வகம்', 'Develop the ability to think in three dimensions.', 1, '#4cc9f0', 'spatial', [
    ['Meet the 3D World', '3D உலகை அறிவோம்', 'X, Y and Z axes. Move a cube along each axis with touch gestures.'],
    ['The Shape Playground', 'வடிவ விளையாட்டு மைதானம்', 'Cubes, spheres, cylinders, cones and prisms: rotate, resize, duplicate, reposition.'],
    ['Orthographic Views', 'ஆர்த்தோகிராஃபிக் காட்சிகள்', 'Front, top and side projections of a 3D object.'],
    ['Mental Rotation', 'மனச் சுழற்சி', 'Predict how an object looks after rotation, then verify.'],
    ['Build from Primitives', 'அடிப்படை வடிவங்களால் கட்டு', 'Recreate a target object using simple shapes.', 150],
    ['Spatial Puzzle', 'இடப் புதிர்', 'Fit 3D pieces into a limited volume without overlap.', 160],
  ]),
  world(2, 'Visual Mathematics for 3D Design', '3D வடிவமைப்புக்கான காட்சி கணிதம்', 'Understand the mathematics behind three-dimensional objects.', 2, '#90be6d', 'math', [
    ['Dimensions and Units', 'அளவுகளும் அலகுகளும்', 'Millimetres, centimetres, metres and scale.'],
    ['Coordinates', 'ஆயத்தொலைவுகள்', 'Position objects with X, Y, Z coordinates.'],
    ['Angles and Rotation', 'கோணங்களும் சுழற்சியும்', 'Degrees, radians and rotation about each axis.'],
    ['Surface Area and Volume', 'பரப்பளவும் கனஅளவும்', 'Live formulas while you resize cubes, cylinders and spheres.'],
    ['Ratios and Proportions', 'விகிதங்களும் விகிதாசாரமும்', 'Scale objects while preserving proportions.'],
    ['Geometry and Trigonometry', 'வடிவியலும் முக்கோணவியலும்', 'Sine, cosine, tangent and Pythagoras with interactive ramps.'],
    ['Curves and Splines', 'வளைவுகளும் ஸ்ப்ளைன்களும்', 'Bézier control points shape a product silhouette.'],
    ['Transformations', 'உருமாற்றங்கள்', 'Translation, rotation, scaling, local vs world, matrices.'],
    ['The Geometry Challenge', 'வடிவியல் சவால்', 'Recreate a dimensioned object accurately.', 180],
  ]),
  world(3, 'The CAD Workshop', 'CAD பணிமனை', 'Learn parametric 3D modelling.', 3, '#f8961e', 'cad', [
    ['Sketching on a Plane', 'தளத்தில் வரைதல்', 'Lines, rectangles, circles and arcs on a chosen plane.'],
    ['Dimensions', 'பரிமாணங்கள்', 'Editable dimensions that drive the sketch.'],
    ['Constraints', 'கட்டுப்பாடுகள்', 'Under-, fully- and over-constrained sketches with a real solver.'],
    ['Extrusion', 'வெளித்தள்ளல்', 'Turn a closed sketch into a solid.'],
    ['Revolve', 'சுழற்றி உருவாக்கல்', 'Spin a profile around an axis: bottles and knobs.'],
    ['Fillets and Chamfers', 'ஃபில்லெட் மற்றும் சாம்ஃபர்', 'Rounded and bevelled edges.'],
    ['Boolean Operations', 'பூலியன் செயல்பாடுகள்', 'Union, subtract and intersect solids.'],
    ['Patterns and Mirroring', 'அமைப்புகளும் பிரதிபலிப்பும்', 'Linear and circular hole patterns, mirrored features.'],
    ['Parametric Design', 'அளவுருசார் வடிவமைப்பு', 'Edit the feature history and watch the model rebuild.'],
    ['CAD Master Challenge', 'CAD முதன்மை சவால்', 'Model a functional electronics enclosure.', 220],
  ]),
  world(4, 'Materials and Surfaces', 'பொருட்களும் மேற்பரப்புகளும்', 'Understand how physical materials influence product design.', 4, '#b5838d', 'materials', [
    ['The Material Lab', 'பொருள் ஆய்வகம்', 'Apply materials; tune colour, roughness, metalness and transparency.'],
    ['Engineering Properties', 'பொறியியல் பண்புகள்', 'Stiffness, strength, density and heat through simplified demos.'],
    ['Material Selection Challenge', 'பொருள் தேர்வு சவால்', 'Choose the right material for each product requirement.', 160],
  ]),
  world(5, 'Mechanical Movement Lab', 'இயந்திர இயக்க ஆய்வகம்', 'Understand how physical mechanisms work.', 4, '#577590', 'mechanics', [
    ['Hinges', 'கீல்கள்', 'Rotational joints and limits.'],
    ['Sliders', 'நழுவிகள்', 'Linear constraints and travel limits.'],
    ['Gears', 'பற்சக்கரங்கள்', 'Involute gears: tooth counts, direction and speed ratio.'],
    ['Levers', 'நெம்புகோல்கள்', 'Pivot position, effort and mechanical advantage.'],
    ['Springs', 'சுருள்வில்கள்', "Stiffness, compression and Hooke's law."],
    ['Linkages', 'இணைப்புகள்', 'A four-bar linkage and its coupler curve.'],
    ['Assembly Constraints', 'இணைப்புக் கட்டுப்பாடுகள்', 'Mates remove degrees of freedom.'],
    ['Motion Challenge', 'இயக்க சவால்', 'Design a folding, adjustable phone stand.', 200],
  ]),
  world(6, 'Product Design Studio', 'பொருள் வடிவமைப்பு ஸ்டுடியோ', 'Turn practical problems into useful product concepts.', 5, '#43aa8b', 'design', [
    ['Form Exploration', 'வடிவ ஆய்வு', 'Create multiple variants of one product.'],
    ['Ergonomics', 'பணிச்சூழலியல்', 'Grip size across hand percentiles.'],
    ['Product Architecture', 'பொருள் கட்டமைப்பு', 'Break an object into functional components.'],
    ['Enclosure Design', 'உறை வடிவமைப்பு', 'Package components inside a housing.'],
    ['Design for Assembly', 'இணைப்புக்கான வடிவமைப்பு', 'Assembly order and part-count reduction.'],
    ['Exploded Views', 'பிரித்துக் காட்டும் காட்சி', 'Separate an assembly to show relationships.'],
    ['Aesthetic Refinement', 'அழகியல் மேம்பாடு', 'Proportion, silhouette and visual balance.'],
    ['Product Design Challenge', 'பொருள் வடிவமைப்பு சவால்', 'A desk accessory from an original brief.', 220],
  ]),
  world(7, 'Manufacturing and 3D Printing', 'உற்பத்தியும் 3D அச்சிடலும்', 'Understand how a digital design becomes a physical object.', 5, '#f94144', 'manufacturing', [
    ['Manufacturing Methods', 'உற்பத்தி முறைகள்', 'Printing, moulding, CNC, sheet metal and casting.'],
    ['3D Printing Basics', '3D அச்சிடல் அடிப்படைகள்', 'Orientation, overhangs, supports and layers.'],
    ['Tolerances and Fits', 'அனுமதிப்பிழைகளும் பொருத்தங்களும்', 'Peg-and-hole clearances.'],
    ['Design for Manufacturing', 'உற்பத்திக்கான வடிவமைப்பு', 'Find and fix geometry problems.'],
    ['Slicing', 'அடுக்குகளாக வெட்டுதல்', 'How a model becomes printable layers.'],
    ['Prototype Challenge', 'முன்மாதிரி சவால்', 'Check, orient and export a part for printing.', 200],
  ]),
  world(8, 'Rendering and Visualisation', 'ரெண்டரிங் மற்றும் காட்சிப்படுத்தல்', 'Present 3D product concepts professionally.', 6, '#9b5de5', 'visualisation', [
    ['Camera and Composition', 'கேமரா மற்றும் அமைப்பு', 'Focal length, perspective and framing.'],
    ['Studio Lighting', 'ஸ்டுடியோ ஒளியமைப்பு', 'Key, fill and rim lights; soft and hard shadows.'],
    ['Product Advertisement', 'பொருள் விளம்பரம்', 'Compose a professional product shot.', 180],
  ]),
  world(9, "The Inventor's Garage", 'கண்டுபிடிப்பாளர் பட்டறை', 'Apply everything to solve real-world problems.', 6, '#ffd166', 'invention', [
    ['Cable Management Device', 'கேபிள் ஒழுங்கமைப்பான்', 'Organise charging cables.', 250],
    ['Adjustable Phone Stand', 'சரிசெய்யக்கூடிய ஃபோன் ஸ்டாண்ட்', 'A folding mechanism with multiple angles.', 250],
    ['Computer Mouse', 'கணினி மவுஸ்', 'Ergonomic form and internal packaging.', 250],
    ['Modular Storage System', 'கூறுநிலை சேமிப்பு அமைப்பு', 'Stackable boxes with clearances.', 250],
    ['Compact Camera', 'சிறிய கேமரா', 'Housing, grip, controls and components.', 250],
    ['Footwear Concept', 'காலணி கருத்துரு', 'Shoe last, sole and upper concept.', 250],
    ['Original Invention', 'சொந்தக் கண்டுபிடிப்பு', 'Your own problem, from concept to presentation.', 300],
  ]),
];

export const ALL_LEVELS: LevelMeta[] = WORLDS.flatMap((w) => w.levels);
export const levelById = (id: string) => ALL_LEVELS.find((l) => l.id === id);
export const worldOf = (id: string) => WORLDS.find((w) => w.levels.some((l) => l.id === id));
