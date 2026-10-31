import { Line } from '@react-three/drei';
import { useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Label } from '../../components/three/ObjectMesh';
import { Slider, Task, Toggle } from '../../components/ui';
import { FLASHLIGHT, PartMesh } from './flashlight';
import { fmt } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'An exploded view pulls an assembly apart along its assembly direction so every part — and how it fits — is visible. It is used in manuals, patents and pitch decks.', ta: 'Exploded view ஒவ்வொரு பாகத்தையும் அது எப்படிப் பொருந்துகிறது என்பதையும் காட்டும்.' },
  { stage: 'EXPERIMENT', text: 'Give each part its own offset along the torch axis, then use the master slider to animate the explosion. Turn on labels with leader lines.', ta: 'ஒவ்வொரு பாகத்துக்கும் தனி விலகல் கொடுத்து, master slider-ஆல் விரியுங்கள்.' },
  { stage: 'BUILD', text: 'Create a clear exploded view: at full explosion no parts overlap, the assembly order is kept (no part jumps past its neighbour), and the whole view stays under 400 mm tall.', ta: 'தெளிவான exploded view: மேலொன்று இல்லை, வரிசை மாறவில்லை, 400 mm-க்குள்.' },
];

export default function L6Exploded() {
  const [off, setOff] = useState<number[]>(FLASHLIGHT.map(() => 0));
  const [t, setT] = useState(1);
  const [labels, setLabels] = useState(true);
  const ys = FLASHLIGHT.map((p, i) => p.y0 + off[i] * t);
  const full = FLASHLIGHT.map((p, i) => ({ lo: p.y0 + off[i], hi: p.y0 + off[i] + p.h, p }));
  const sorted = [...full].sort((a, b) => a.lo - b.lo);
  let overlaps = 0;
  for (let i = 0; i + 1 < sorted.length; i++) if (sorted[i + 1].lo < sorted[i].hi - 0.1) overlaps++;
  const orderKept = FLASHLIGHT.every((p, i) => FLASHLIGHT.every((q, j) => !(p.y0 < q.y0 && full[i].lo > full[j].lo)));
  const height = Math.max(...full.map((f) => f.hi)) - Math.min(...full.map((f) => f.lo));

  const evaluate = (): Feedback => {
    const checks: [boolean, string, string][] = [
      [overlaps === 0, 'No overlapping parts at full explosion', `${overlaps} overlap(s) remain`],
      [orderKept, 'Assembly order preserved', 'A part has jumped past a neighbour — it reads as the wrong assembly order'],
      [height <= 400, `Compact: ${fmt(height)} mm tall`, `${fmt(height)} mm tall — over 400 mm`],
      [labels, 'Labelled with leader lines', 'Turn on labels'],
    ];
    return {
      score: Math.round((checks.filter((c) => c[0]).length / 4) * 100),
      correct: checks.filter((c) => c[0]).map((c) => c[1]),
      issues: checks.filter((c) => !c[0]).map((c) => ({ label: c[2] })),
      why: 'A good exploded view is an instruction: it shows what goes where and in what order, without hiding anything. It is also a design check — awkward explosions often reveal awkward assembly.',
      suggestion: 'Explode from the inside out: parts deeper inside the assembly need larger offsets.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w6-l6"
      steps={steps}
      evaluate={evaluate}
      viewport={
        <Stage3D fit={200} camera={[220, 200, 320]} target={[0, 140, 0]} env showViews={false}>
          {FLASHLIGHT.map((p, i) => (
            <PartMesh key={p.id} p={p} y={ys[i]} />
          ))}
          {labels &&
            FLASHLIGHT.map((p, i) => (
              <group key={p.id}>
                <Line points={[[p.r, ys[i] + p.h / 2, 0], [70, ys[i] + p.h / 2, 0]]} color="#8d9aa8" lineWidth={1} />
                <Label position={[100, ys[i] + p.h / 2, 0]} size={11}>
                  {p.name}
                </Label>
              </group>
            ))}
        </Stage3D>
      }
    >
      <Slider label="Explode (animate)" value={t} min={0} max={1} step={0.01} onChange={setT} digits={2} />
      <Toggle checked={labels} onChange={setLabels} label="Labels with leader lines" />
      <div className="lbl">Offset per part along the axis</div>
      {FLASHLIGHT.map((p, i) => (
        <Slider key={p.id} label={p.name} value={off[i]} min={0} max={300} step={1} unit="mm" onChange={(v) => setOff(off.map((o, k) => (k === i ? v : o)))} />
      ))}
      <Task ok={overlaps === 0}>No overlaps ({overlaps})</Task>
      <Task ok={orderKept}>Order kept</Task>
      <Task ok={height <= 400}>Height {fmt(height)} mm ≤ 400</Task>
    </LevelShell>
  );
}
