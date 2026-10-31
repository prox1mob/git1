import { Studio } from './Studio';
import type { LessonStep } from '../../lib/types';

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Brief: create a hero image for the product’s launch page. Pick the product, its colour and a background.', ta: 'சுருக்கம்: வெளியீட்டுப் பக்கத்துக்கான முதன்மைப் படம் உருவாக்குங்கள்.' },
  { stage: 'UNDERSTAND', text: 'Colour harmony: the product must stand out from the background — use contrast in lightness, or complementary colours. Keep the tagline short so the product remains the hero.', ta: 'பொருள் பின்னணியிலிருந்து தனித்துத் தெரிய வேண்டும். Tagline சுருக்கமாக இருக்கட்டும்.' },
  { stage: 'BUILD', text: 'Combine everything: lens, framing, three-point light, soft shadow, contrast and a tagline. Take a photo — it is saved to your portfolio with its rubric.', ta: 'எல்லாவற்றையும் இணைத்து படம் எடுங்கள் — portfolio-வில் சேமிக்கப்படும்.' },
  { stage: 'IMPROVE', text: 'The rubric checks technique only. Whether the image is beautiful is your call — try two different moods and compare them.', ta: 'மதிப்பீடு நுட்பத்தை மட்டுமே சரிபார்க்கிறது. அழகு உங்கள் முடிவு.' },
];

export default function L3Advert() {
  return <Studio id="w8-l3" mode="ad" steps={steps} />;
}
