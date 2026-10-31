import { Studio } from './Studio';
import type { LessonStep } from '../../lib/types';

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'The camera starts with a 24 mm wide-angle lens, very close. Notice how the bottle looks stretched and its top looks small.', ta: 'கேமரா 24 mm wide-angle லென்ஸுடன் மிக அருகில் உள்ளது. பாட்டில் நீண்டு தோன்றுவதைக் கவனியுங்கள்.' },
  { stage: 'EXPERIMENT', text: 'Raise the focal length and pinch to move the camera back. Longer lenses flatten perspective, so products keep their true proportions.', ta: 'Focal length-ஐ அதிகரித்து கேமராவைப் பின்னால் நகர்த்துங்கள்.' },
  { stage: 'UNDERSTAND', text: 'Framing: leave breathing room around the product, keep it fully in frame, and place it deliberately — centred for calm, on a thirds line for energy.', ta: 'Framing: பொருளைச் சுற்றி இடம் விடுங்கள்; மையத்தில் அல்லது மூன்றில்-ஒரு கோட்டில் வையுங்கள்.' },
  { stage: 'BUILD', text: 'Frame a catalogue shot: 50–135 mm lens, product filling 25–60 % of the frame, placed on a thirds line or centred.', ta: 'Catalogue படம்: 50–135 mm, பொருள் 25–60 % இடம், மூன்றில்-ஒரு கோடு அல்லது மையம்.' },
];

export default function L1Camera() {
  return <Studio id="w8-l1" mode="camera" steps={steps} />;
}
