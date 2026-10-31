export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type SkillId =
  | 'spatial'
  | 'math'
  | 'cad'
  | 'materials'
  | 'mechanics'
  | 'design'
  | 'manufacturing'
  | 'visualisation'
  | 'invention';

export const SKILLS: { id: SkillId; name: string; ta: string }[] = [
  { id: 'spatial', name: 'Spatial thinking', ta: 'இடஞ்சார் சிந்தனை' },
  { id: 'math', name: 'Visual maths', ta: 'காட்சி கணிதம்' },
  { id: 'cad', name: 'CAD modelling', ta: 'CAD மாடலிங்' },
  { id: 'materials', name: 'Materials', ta: 'பொருட்கள்' },
  { id: 'mechanics', name: 'Mechanisms', ta: 'இயந்திர இயக்கம்' },
  { id: 'design', name: 'Product design', ta: 'பொருள் வடிவமைப்பு' },
  { id: 'manufacturing', name: 'Manufacturing', ta: 'உற்பத்தி' },
  { id: 'visualisation', name: 'Visualisation', ta: 'காட்சிப்படுத்தல்' },
  { id: 'invention', name: 'Invention', ta: 'கண்டுபிடிப்பு' },
];

/** Structured feedback returned by every challenge evaluation. */
export interface Feedback {
  score: number; // 0..100
  correct: string[];
  issues: { label: string; detail?: string }[];
  why: string;
  suggestion: string;
  /** When true, the level can render a visual correction in its viewport. */
  canShowCorrection?: boolean;
  /** Optional rubric rows for creative challenges (transparent scoring). */
  rubric?: { criterion: string; points: number; max: number; note?: string }[];
}

export type Stage = 'OBSERVE' | 'TOUCH' | 'EXPERIMENT' | 'UNDERSTAND' | 'BUILD' | 'TEST' | 'IMPROVE';
export const STAGES: Stage[] = ['OBSERVE', 'TOUCH', 'EXPERIMENT', 'UNDERSTAND', 'BUILD', 'TEST', 'IMPROVE'];

export interface LessonStep {
  stage: Stage;
  text: string;
  ta?: string;
}
