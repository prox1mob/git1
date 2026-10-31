import { useState } from 'react';
import { ColourPicker } from '../../components/color/ColourPicker';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx, type Criterion } from '../../components/lesson/LessonShell';
import { Button, Segmented, Slider, Toggle } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { deltaE2000, hexToRgb, labToRgb, rgbToHex, rgbToLab, type RGB, type Vec3 } from '../../lib/color';

const hex = (h: string) => hexToRgb(h)!;

function Pair({ inner, innerB, s1, s2, bridge }: { inner: RGB; innerB?: RGB; s1: RGB; s2: RGB; bridge?: boolean }) {
  return (
    <div className="relative grid grid-cols-2 overflow-hidden rounded-xl" role="img" aria-label="Two inner squares on different surrounds">
      {[s1, s2].map((s, i) => (
        <div key={i} className="grid aspect-square place-items-center" style={{ background: rgbToHex(s) }}>
          <div className="h-[34%] w-[34%]" style={{ background: rgbToHex(i === 1 && innerB ? innerB : inner) }} />
        </div>
      ))}
      {bridge && <div className="absolute top-1/2 left-[33%] h-[8%] w-[34%] -translate-y-1/2" style={{ background: rgbToHex(inner) }} />}
    </div>
  );
}

export default function Simultaneous({ level }: LevelProps) {
  return <LessonShell level={level} observe={<Observe />} experiment={<Experiment />}
    discover={
      <Concepts items={[
        { title: 'Lightness induction', body: 'A colour on a dark surround looks lighter; on a light surround it looks darker. Your visual system judges by comparison, exaggerating differences at edges.' },
        { title: 'Colour induction', body: 'A surround pushes the colour inside toward its complement: grey on red looks slightly green, grey on green slightly pink. Josef Albers built a whole course on this.' },
        { title: 'Why designers care', body: 'The same brand colour looks different on a white website, a dark app and a kraft-paper box. Judge colours in context, and test them on every background they will meet.' },
        { title: 'Why colourists use grey', body: 'Grading suites and photo editors use neutral grey surroundings so the interface doesn’t shift how you see the image. That is why this lab’s chrome is strictly neutral.' },
      ]} />
    }
    challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

function Observe() {
  const [bridge, setBridge] = useState(false);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-3"><Pair inner={hex('#808080')} s1={hex('#111111')} s2={hex('#F0F0F0')} bridge={bridge} /><Toggle checked={bridge} onChange={setBridge} label="Connect the two squares" /></div>
      <ObserveQuestion question="Which inner square is lighter?" options={['The one on black', 'The one on white', 'They are the same']}
        reveal={() => <p>They are <b>identical</b> — both #808080. Turn on “connect” and the bridge shows a single, uniform grey. The black surround makes its square look lighter; the white surround makes its square look darker. Your eye doesn’t measure colour, it compares it.</p>} />
    </div>
  );
}

function Experiment() {
  const [inner, setInner] = useState<RGB>(hex('#8A8A8A'));
  const [s1, setS1] = useState<RGB>(hex('#C2412D'));
  const [s2, setS2] = useState<RGB>(hex('#2E8A5E'));
  const [edit, setEdit] = useState<'inner' | 's1' | 's2'>('inner');
  const [bridge, setBridge] = useState(false);
  const val = edit === 'inner' ? inner : edit === 's1' ? s1 : s2;
  const set = edit === 'inner' ? setInner : edit === 's1' ? setS1 : setS2;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-3"><Pair inner={inner} s1={s1} s2={s2} bridge={bridge} /><Toggle checked={bridge} onChange={setBridge} label="Connect the inner squares" /></div>
      <div className="space-y-3 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
        <Segmented value={edit} onChange={setEdit} options={[{ value: 'inner', label: 'Inner colour' }, { value: 's1', label: 'Left surround' }, { value: 's2', label: 'Right surround' }]} />
        <ColourPicker key={edit} value={val} onChange={set} wheelSize={170} />
        <p className="text-[12.5px] text-ink-400">Try a mid grey on red and green surrounds: the grey takes on a hint of each surround’s complement.</p>
      </div>
    </div>
  );
}

interface Round { id: string; title: string; a: string; s1: string; s2: string }
const ROUNDS: Round[] = [
  { id: 'value', title: 'Grey on black vs white', a: '#7E7E7E', s1: '#151515', s2: '#EDEDED' },
  { id: 'hue', title: 'Grey on red vs green', a: '#8C8C8C', s1: '#C0392B', s2: '#27AE60' },
  { id: 'warm', title: 'Ochre on yellow vs blue', a: '#C08A3E', s1: '#F1D04B', s2: '#2C4FA8' },
];
// Simple induction model: perceived = actual + k·(actual − surround). Matching ⇒ B ≈ A + k/(1+k)·(S2 − S1).
const K: Vec3 = [0.14, 0.12, 0.12];
const predicted = (r: Round): Vec3 => { const a = rgbToLab(hex(r.a)), s1 = rgbToLab(hex(r.s1)), s2 = rgbToLab(hex(r.s2)); return [0, 1, 2].map((i) => a[i] + K[i] * (s2[i] - s1[i])) as Vec3; };

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const [i, setI] = useState(0);
  const [labs, setLabs] = useState<Vec3[]>(() => ROUNDS.map((r) => rgbToLab(hex(r.a))));
  const r = ROUNDS[i];
  const b = labToRgb(labs[i]).map((v) => Math.min(1, Math.max(0, v))) as RGB;
  const setL = (k: number, v: number) => setLabs((all) => all.map((x, j) => (j === i ? (x.map((y, m) => (m === k ? v : y)) as Vec3) : x)));
  const submit = () => {
    const criteria: Criterion[] = ROUNDS.map((rd, k) => {
      const A = rgbToLab(hex(rd.a)), B = labs[k], P = predicted(rd);
      const du: Vec3 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], dp: Vec3 = [P[0] - A[0], P[1] - A[1], P[2] - A[2]];
      const nu = Math.hypot(...du), np = Math.hypot(...dp);
      const cos = nu < 0.8 ? 0 : (du[0] * dp[0] + du[1] * dp[1] + du[2] * dp[2]) / (nu * np);
      const ratio = nu / np;
      const score = nu < 0.8 ? 20 : Math.round(100 * Math.max(0, Math.min(1, (cos + 0.1) / 0.95)) * (ratio > 0.3 && ratio < 3 ? 1 : 0.6));
      return { label: rd.title, score, weight: 1, detail: `You changed the right square by ΔE00 ${deltaE2000(A, B).toFixed(1)} (model predicts ≈ ${deltaE2000(A, P).toFixed(1)}); direction agreement ${Math.round(Math.max(0, cos) * 100)}%.` };
    });
    ctx.submit({
      score: weighted(criteria), criteria, subjective: true,
      worked: criteria.filter((c) => c.score >= 80).map((c) => `${c.label}: you compensated in the direction the surround pushes perception.`),
      improve: criteria.filter((c) => c.score < 80).map((c) => `${c.label}: to look identical, the right square must actually shift toward the right surround (its lightness or hue), cancelling the induction.`),
      why: 'This is Josef Albers’ classic exercise. There is no perfect answer — perception varies between people, screens and rooms — so it is scored against a simple induction model: does your correction point the way the surround pushes the eye?',
      visual: <div className="grid gap-3 sm:grid-cols-3">{ROUNDS.map((rd, k) => <Pair key={rd.id} inner={hex(rd.a)} innerB={labToRgb(labs[k]).map((v) => Math.min(1, Math.max(0, v))) as RGB} s1={hex(rd.s1)} s2={hex(rd.s2)} />)}</div>,
    });
  };
  return (
    <div>
      <ChallengeBrief title="Make two different colours look the same" aside={<div className="flex flex-wrap gap-2">{ROUNDS.map((rd, k) => <Button key={rd.id} size="sm" variant={k === i ? 'primary' : 'secondary'} onClick={() => setI(k)}>{k + 1}. {rd.title}</Button>)}</div>}>
        The left inner square is fixed. Adjust the right one until the two <i>look</i> identical in their surrounds. They will not be identical in numbers — that is the point.
      </ChallengeBrief>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Pair inner={hex(r.a)} innerB={b} s1={hex(r.s1)} s2={hex(r.s2)} />
        <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <Slider label="Lightness L*" value={labs[i][0]} min={0} max={100} step={0.2} onChange={(v) => setL(0, v)} format={(v) => v.toFixed(1)} track="linear-gradient(to right,#000,#fff)" />
          <Slider label="Green ← a* → Red" value={labs[i][1]} min={-40} max={40} step={0.2} onChange={(v) => setL(1, v)} format={(v) => v.toFixed(1)} track="linear-gradient(to right,#2e9e5e,#888,#c0392b)" />
          <Slider label="Blue ← b* → Yellow" value={labs[i][2]} min={-40} max={50} step={0.2} onChange={(v) => setL(2, v)} format={(v) => v.toFixed(1)} track="linear-gradient(to right,#2c4fa8,#888,#e6c53a)" />
          <p className="font-mono text-[12px] text-ink-400">Left {r.a} · Right {rgbToHex(b)}</p>
          <Hint>Squint and look at the two inner squares only. If the right one looks darker than the left, it needs to be physically lighter.</Hint>
          <Button variant="primary" onClick={submit}>Submit all three</Button>
        </div>
      </div>
    </div>
  );
}
