import { useMemo, useState } from 'react';
import { GradeCanvas } from '../../components/grading/GradeCanvas';
import { Scope } from '../../components/grading/Scopes';
import { Concepts, LessonShell, ObserveQuestion, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Note, Segmented } from '../../components/ui';
import type { Frame } from '../../engine/GradeEngine';
import { defaultParams, type GradeParams } from '../../engine/params';
import { sceneMeta } from '../../engine/scenes';
import type { LevelProps } from '../../game/registry';
import { errorToScore, rangeScore } from '../../lib/color';
import { skinReport } from '../shared/measure';
import { GradingChallenge, LiveMetric, Workbench, type GradingRound } from '../shared/Workbench';

const portrait = (skin: number, light = 0, ward = 4, bg = 2) => ({ kind: 'scene' as const, scene: 'portrait' as const, variant: skin, params: [light, ward, bg, 0] as [number, number, number, number] });
const TONES = sceneMeta('portrait').variants!;

function Observe() {
  const [frames, setFrames] = useState<(Frame | null)[]>([null, null, null]);
  const params = useMemo(() => defaultParams(), []);
  const skins = [0, 3, 5];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        {skins.map((s, i) => (
          <figure key={s} className="space-y-2">
            <GradeCanvas source={portrait(s)} params={params} aspect={3 / 2} label={`${TONES[s]} complexion`} onAnalysis={(f) => setFrames((fs) => fs.map((x, k) => (k === i ? f : x)))} maxPixels={700_000} />
            <div className="mx-auto max-w-[200px]"><Scope frame={frames[i]} kind="vectorscope" zoom={2} /></div>
            <figcaption className="text-center text-[12px] text-ink-400">{TONES[s]}</figcaption>
          </figure>
        ))}
      </div>
      <ObserveQuestion
        question="Look at the dashed line on each vectorscope. What do you notice about where the skin lands?"
        options={['Each complexion points in a different direction', 'They all point along the same line', 'Darker skin sits closer to the centre', 'I can’t read these yet']}
        reveal={() => (
          <div className="space-y-2">
            <p>Across very different complexions, healthy skin points along almost the <b>same hue direction</b> — the “skin-tone line” at about 123°. What changes between complexions is mostly lightness and how far the trace extends (saturation), not its angle.</p>
            <p>That is why colourists use the line as a sanity check, and why “correcting” deeper skin toward lighter values is a mistake: the hue should be consistent, the lightness belongs to the person.</p>
          </div>
        )}
      />
    </div>
  );
}

function Experiment() {
  const [skin, setSkin] = useState(3);
  const [light, setLight] = useState(0);
  const [p, setP] = useState<GradeParams>(() => defaultParams());
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4">
        <Segmented value={skin} onChange={setSkin} label="Complexion" options={TONES.map((t, i) => ({ value: i, label: String(i + 1), title: t }))} />
        <Segmented value={light} onChange={setLight} label="Light" options={['Studio', 'Golden hour', 'Neon', 'Window'].map((t, i) => ({ value: i, label: t }))} />
      </div>
      <Workbench source={portrait(skin, light)} aspect={3 / 2} params={p} setParams={setP} panels={['wb', 'hsl', 'colour']} scopes={['vectorscope', 'parade']}
        under={<Note>Switch to Neon lighting: the skin trace swings toward magenta. Try to bring it back to the line with white balance first, then the orange and red HSL bands.</Note>} />
    </div>
  );
}

const truth = (skin: number) => ({ source: portrait(skin), capture: {} });
const mk = (id: string, label: string, skin: number, capture: GradingRound['capture'], initial: Partial<GradeParams>, brief: string): GradingRound => ({
  id, label, brief, source: portrait(skin), capture, initial, aspect: 3 / 2, panels: ['wb', 'hsl', 'colour'], scopes: ['vectorscope', 'parade'],
  reference: truth(skin),
  hint: 'Zoom the vectorscope ×2. Get the white balance close first; then use the orange band (hue and saturation) to land the skin on the dashed line.',
  live: (f) => { const s = skinReport(f); return <><LiveMetric label="Off the skin line" value={`${s.error.toFixed(1)}°`} ok={s.error < 5} target="< 5°" /><LiveMetric label="Skin L*" value={s.L.toFixed(0)} ok={false} /></>; },
  evaluate: (f, _p, _d, ref) => {
    const s = skinReport(f), t = ref ? skinReport(ref) : s;
    const hue = errorToScore(s.error, 3, 20);
    const satR = s.C / Math.max(1, t.C);
    const sat = rangeScore(satR, 0.82, 1.2, 0.4);
    const dL = s.L - t.L;
    const light = errorToScore(Math.abs(dL), 3, 15);
    return {
      criteria: [
        { label: 'Hue on the skin line', score: hue, weight: 2, detail: `${s.error.toFixed(1)}° from 123°.` },
        { label: 'Natural saturation', score: sat, weight: 1, detail: `Skin chroma ${Math.round(satR * 100)}% of the true complexion.` },
        { label: 'Complexion respected', score: light, weight: 1, detail: `Lightness ${dL >= 0 ? '+' : ''}${dL.toFixed(1)} L* vs. the person’s true skin.` },
      ],
      worked: [...(hue >= 85 ? ['Skin sits on the line — healthy, believable colour.'] : []), ...(light >= 85 ? ['You kept the person’s real lightness.'] : [])],
      improve: [
        ...(hue < 85 ? ['The skin is off the line; fix the overall cast first, then fine-tune with the orange band.'] : []),
        ...(sat < 85 ? [satR > 1.2 ? 'Skin is over-saturated — it reads as sunburn or make-up.' : 'Skin looks grey or ill; restore some saturation.'] : []),
        ...(light < 85 ? [dL > 0 ? 'The skin was lightened. Do not “correct” a complexion toward lighter — match the person.' : 'The skin got darker than the person’s real complexion.'] : []),
      ],
      meta: { skinHueError: s.error },
    };
  },
});

const rounds: GradingRound[] = [
  mk('green', 'Green spill', 1, { castTint: 38, castTemp: 5800 }, {}, 'Shot beside a sunlit hedge: green bounce light has contaminated a light complexion.'),
  mk('magenta', 'LED magenta', 3, { castTint: -36, castTemp: 6800 }, {}, 'A cheap LED key has pushed this medium complexion toward magenta.'),
  mk('oversat', 'Over-cooked', 5, { castTemp: 5200 }, { saturation: 1.55 }, 'A previous editor cranked saturation on this deep complexion and the light was warm. Make it natural.'),
];

export default function SkinTone({ level }: LevelProps) {
  return (
    <LessonShell level={level} observe={<Observe />} experiment={<Experiment />}
      discover={
        <Concepts items={[
          { title: 'One line, every complexion', body: 'On a Rec.709 vectorscope, skin of all complexions clusters along a line around 123°, between red and yellow. Blood under skin gives it a consistent hue; melanin mostly changes lightness and saturation.' },
          { title: 'Colour contamination', body: 'Skin picks up colour from its surroundings: green from grass, magenta from LEDs, blue from shade. Correct the light first, then the remaining skin-specific shift.' },
          { title: 'Saturation', body: 'Under-saturated skin looks ill or grey; over-saturated skin looks orange or sunburnt. Deeper complexions often carry rich colour — don’t flatten it.' },
          { title: 'Respect the person', body: 'Never “correct” a complexion toward lighter. The goal is natural rendering of the individual — the vectorscope checks hue; your judgement protects identity.' },
          { title: 'The orange band', body: 'In the HSL mixer, most skin lives in the orange range with some red. Small hue moves there shift skin toward or away from the line; saturation controls its intensity.' },
        ]} />
      }
      challenge={(ctx: ChallengeCtx) => (
        <GradingChallenge ctx={ctx} title="Three complexions, three contaminations" rounds={rounds}
          intro="Measured against the person’s true colour under clean light: hue on the vectorscope, saturation, and lightness. The lightness check exists to stop anyone ‘correcting’ a complexion."
          why="Skin is the colour viewers judge most harshly — we are experts at reading faces. Natural, consistent skin across every complexion is a mark of professional work, and of respect for the people in front of the camera." />
      )}
    />
  );
}
