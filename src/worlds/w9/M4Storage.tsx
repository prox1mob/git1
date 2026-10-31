import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Mission, type MissionConfig } from '../../components/Mission';
import { Stage3D } from '../../components/Stage3D';
import { CaptureHook } from '../../components/three/Capture';
import { Slider, Toggle } from '../../components/ui';
import { csgRaw } from '../../lib/shapes';
import { fmt } from '../../lib/math';

interface S {
  W: number;
  D: number;
  H: number;
  t: number;
  c: number; // skirt clearance
  sh: number; // skirt height
  st: number; // skirt wall
}
const INIT: S = { W: 95, D: 140, H: 90, t: 1.2, c: 0.05, sh: 2, st: 1.2 };

function boxGeo(s: S) {
  const outer = new THREE.BoxGeometry(s.W, s.H, s.D);
  outer.translate(0, s.H / 2, 0);
  const inner = new THREE.BoxGeometry(s.W - 2 * s.t, s.H, s.D - 2 * s.t);
  inner.translate(0, s.H / 2 + s.t, 0);
  const shell = csgRaw(outer, [inner], 'subtract');
  const sw = s.W - 2 * s.t - 2 * s.c,
    sd = s.D - 2 * s.t - 2 * s.c;
  const sk = new THREE.BoxGeometry(sw, s.sh, sd);
  sk.translate(0, -s.sh / 2 + 0.01, 0);
  const ski = new THREE.BoxGeometry(Math.max(1, sw - 2 * s.st), s.sh + 2, Math.max(1, sd - 2 * s.st));
  ski.translate(0, -s.sh / 2, 0);
  return csgRaw(csgRaw(shell, [sk], 'union'), [ski], 'subtract');
}

const near = (v: number, step: number) => Math.abs(v / step - Math.round(v / step)) * step <= 0.5;

export default function M4Storage() {
  const [s, setS] = useState<S>(INIT);
  const [explode, setExplode] = useState(true);
  const geo = useMemo(() => boxGeo(s), [s]);
  const set = (q: Partial<S>) => setS({ ...s, ...q });
  const checks = () => [
    { criterion: 'Footprint on a 50 mm grid (W and D multiples of 50)', ok: near(s.W, 50) && near(s.D, 50), note: `${s.W} × ${s.D} mm`, weight: 2 },
    { criterion: 'Walls ≥ 1.6 mm', ok: s.t >= 1.6, note: `${fmt(s.t, 1)} mm` },
    { criterion: 'Stacking skirt clearance 0.2–0.5 mm (FDM)', ok: s.c >= 0.2 && s.c <= 0.5, note: `${fmt(s.c, 2)} mm per side`, weight: 2 },
    { criterion: 'Skirt height 3–10 mm (locates without wasting depth)', ok: s.sh >= 3 && s.sh <= 10, note: `${fmt(s.sh, 1)} mm` },
    { criterion: 'Skirt wall ≥ 1.2 mm', ok: s.st >= 1.2 },
    { criterion: 'A stack of three fits a 300 mm shelf', ok: 3 * s.H <= 300, note: `${3 * s.H} mm` },
  ];
  const cfg: MissionConfig = useMemo(
    () => ({
      id: 'w9-l4',
      title: 'Modular Storage System',
      problem: 'A small workshop has screws, cables and tools in mismatched boxes that cannot be stacked and waste shelf space.',
      persona: 'Ravi, runs a phone-repair stall: needs boxes that stack firmly, combine side by side and print on a 220 mm printer.',
      constraints: ['Footprint on a 50 mm grid so boxes tile a shelf', 'Stacking skirt that slides into the box below with 0.2–0.5 mm clearance', 'Walls ≥ 1.6 mm', 'Three boxes stack within a 300 mm shelf'],
      research: [
        { text: 'A grid module lets different sizes tile without gaps.', relevant: true },
        { text: 'Printed parts come out slightly oversize, so mating parts need clearance.', relevant: true },
        { text: 'Labels help find things quickly.', relevant: true },
        { text: 'Screws are usually made of steel.', relevant: false },
      ],
      concepts: [
        { name: 'Stacking bins with skirt', desc: 'Each bin’s bottom skirt drops into the bin below.' },
        { name: 'Drawer cabinet', desc: 'A frame with sliding drawers (more parts, more tolerance work).' },
      ],
      starter: () => [],
      checks: () => [],
      selfChecks: ['Inside corners are easy to clean or have fillets', 'There is a place for a label', 'Stacked boxes can still be gripped and lifted'],
      custom: {
        viewport: (cap) => (
          <Stage3D fit={260} camera={[320, 300, 420]} target={[0, 140, 0]} env showViews={false} preserve>
            {[0, 1, 2].map((i) => (
              <mesh key={i} geometry={geo} position={[0, i * (s.H + (explode ? 40 : 0)), 0]} castShadow>
                <meshStandardMaterial color={['#4cc9f0', '#f8961e', '#90be6d'][i]} roughness={0.5} />
              </mesh>
            ))}
            <CaptureHook fnRef={cap} />
          </Stage3D>
        ),
        panel: (
          <div>
            <Slider label="Width W" value={s.W} min={40} max={200} step={1} unit="mm" onChange={(W) => set({ W })} />
            <Slider label="Depth D" value={s.D} min={40} max={200} step={1} unit="mm" onChange={(D) => set({ D })} />
            <Slider label="Height H" value={s.H} min={30} max={150} step={1} unit="mm" onChange={(H) => set({ H })} />
            <Slider label="Wall t" value={s.t} min={0.8} max={4} step={0.1} unit="mm" onChange={(t) => set({ t })} digits={1} />
            <Slider label="Skirt clearance c" value={s.c} min={0} max={1} step={0.05} unit="mm" onChange={(c) => set({ c })} digits={2} />
            <Slider label="Skirt height" value={s.sh} min={1} max={15} step={0.5} unit="mm" onChange={(sh) => set({ sh })} digits={1} />
            <Slider label="Skirt wall" value={s.st} min={0.6} max={3} step={0.1} unit="mm" onChange={(st) => set({ st })} digits={1} />
            <Toggle checked={explode} onChange={setExplode} label="Exploded stack" />
          </div>
        ),
        checks,
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, explode, geo],
  );
  return <Mission cfg={cfg} />;
}
