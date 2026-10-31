import { Studio } from './Studio';
import type { LessonStep } from '../../lib/types';

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'The product is lit flat from above and the front — it looks dull, with a hard shadow and no shape.', ta: 'பொருள் மேலிருந்தும் முன்னிருந்தும் தட்டையாக ஒளிர்கிறது — வடிவம் தெரியவில்லை.' },
  { stage: 'UNDERSTAND', text: 'Three-point lighting: a KEY light (main, high and to one side) sculpts the form; a FILL light on the other side softens the shadows; a RIM light behind outlines the edges against the background.', ta: 'மூன்று-புள்ளி ஒளி: key (முதன்மை), fill (நிழலை மென்மையாக்கும்), rim (பின்னால் விளிம்பைக் காட்டும்).' },
  { stage: 'EXPERIMENT', text: 'Bigger light sources give softer shadows. The key-to-fill ratio sets contrast: 2 : 1 is gentle, 4 : 1 is dramatic.', ta: 'பெரிய ஒளி மூலம் = மென்மையான நிழல். Key : fill விகிதம் contrast-ஐ அமைக்கிறது.' },
  { stage: 'BUILD', text: 'Light the product with a proper three-point setup and soft shadows.', ta: 'முறையான மூன்று-புள்ளி ஒளி அமைப்புடன் ஒளியூட்டுங்கள்.' },
];

export default function L2Lighting() {
  return <Studio id="w8-l2" mode="light" steps={steps} />;
}
