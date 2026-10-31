import { useMemo, useState } from 'react';
import { Mission, type MissionConfig } from '../../components/Mission';
import { Stage3D } from '../../components/Stage3D';
import { CaptureHook } from '../../components/three/Capture';
import { Seg, Slider } from '../../components/ui';
import { Stand, STAND_INIT, standRubric, type StandParams } from '../w5/L8MotionChallenge';
import { fmt } from '../../lib/math';

export default function M2PhoneStand() {
  const [p, setP] = useState<StandParams>(STAND_INIT);
  const [pose, setPose] = useState<'fold' | '0' | '1' | '2'>('1');
  const { rows, angles } = standRubric(p);
  const idx = pose === 'fold' ? -1 : parseInt(pose, 10);
  const theta = idx < 0 ? 2 : angles[idx] ?? 0;
  const set = (q: Partial<StandParams>) => setP({ ...p, ...q });
  const cfg: MissionConfig = useMemo(
    () => ({
      id: 'w9-l2',
      title: 'Adjustable Phone Stand',
      problem: 'People watch recipes and video calls on their phones at the kitchen counter and desk, propping the phone against whatever is nearby. It slides and falls.',
      persona: 'Lakshmi, home cook and remote worker: needs a low angle for typing replies and a steeper one for watching while standing.',
      constraints: ['Three viewing angles covering 50°–70°', 'Stable at every angle with a 180 g phone', 'Footprint ≤ 100 mm deep', 'Folds flat for a bag'],
      research: [
        { text: 'Standing users look down at a steeper screen angle than seated users.', relevant: true },
        { text: 'Tapping the screen pushes the phone backwards.', relevant: true },
        { text: 'Phone cases add 1–3 mm of thickness.', relevant: true },
        { text: 'Most phones have three cameras.', relevant: false },
      ],
      concepts: [
        { name: 'Kickstand with notches', desc: 'A hinged back plate propped by a leg that clicks into notches.' },
        { name: 'Folding Z-plate', desc: 'Three hinged plates that fold into a triangle.' },
      ],
      starter: () => [],
      checks: () => [],
      selfChecks: ['The lip holds a phone in a thick case', 'Notches are easy to switch with one hand', 'It looks good on a kitchen counter'],
      custom: {
        viewport: (cap) => (
          <Stage3D fit={150} camera={[-30, 120, 380]} target={[-40, 70, 0]} env showViews={false} preserve>
            <Stand p={p} theta={theta} legN={idx >= 0 ? p.n[idx] : 0} />
            <CaptureHook fnRef={cap} />
          </Stage3D>
        ),
        panel: (
          <div>
            <Seg value={pose} onChange={setPose} options={[{ v: 'fold', label: 'Folded' }, { v: '0', label: 'Notch 1' }, { v: '1', label: 'Notch 2' }, { v: '2', label: 'Notch 3' }]} />
            <Slider label="Base depth" value={p.D} min={40} max={140} step={1} unit="mm" onChange={(D) => set({ D })} />
            <Slider label="Back plate length" value={p.Ls} min={60} max={160} step={1} unit="mm" onChange={(Ls) => set({ Ls })} />
            <Slider label="Leg pivot distance" value={p.s} min={20} max={150} step={1} unit="mm" onChange={(s) => set({ s })} />
            <Slider label="Leg length" value={p.Lk} min={20} max={150} step={1} unit="mm" onChange={(Lk) => set({ Lk })} />
            {p.n.map((n, i) => (
              <Slider key={i} label={`Notch ${i + 1} → ${angles[i] == null ? 'impossible' : fmt(angles[i]!, 1) + '°'}`} value={n} min={10} max={140} step={1} unit="mm" onChange={(v) => set({ n: p.n.map((q, k) => (k === i ? v : q)) as [number, number, number] })} />
            ))}
          </div>
        ),
        checks: () => rows.map((r) => ({ criterion: r.criterion, ok: r.points / r.max, note: r.note, weight: r.max })),
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p, pose, theta],
  );
  return <Mission cfg={cfg} />;
}
