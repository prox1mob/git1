import { CuboidCollider, BallCollider, Physics, RigidBody, useRevoluteJoint, type RapierRigidBody } from '@react-three/rapier';
import { Line } from '@react-three/drei';
import { useRef, useState, type ReactNode } from 'react';
import { Stage3D } from '../components/Stage3D';
import { Label } from '../components/three/ObjectMesh';
import { Seg, Slider, T } from '../components/ui';
import { navigate } from '../lib/router';
import { fmt, DEG } from '../lib/math';
import { useProgress, BADGES } from '../store/progress';
import { toast } from '../store/toast';

type Exp = 'gravity' | 'balance' | 'friction' | 'torque' | 'stack';
const EXPS: { id: Exp; name: string; ta: string }[] = [
  { id: 'gravity', name: 'Gravity & mass', ta: 'ஈர்ப்பு விசை & நிறை' },
  { id: 'balance', name: 'Centre of mass & balance', ta: 'நிறை மையம் & சமநிலை' },
  { id: 'friction', name: 'Friction on a ramp', ta: 'சாய்தளத்தில் உராய்வு' },
  { id: 'torque', name: 'Torque & leverage', ta: 'திருப்பு விசை' },
  { id: 'stack', name: 'Structure: stacking overhang', ta: 'அமைப்பு: அடுக்கு' },
];

function useRun(id: Exp) {
  return () => {
    const nb = useProgress.getState().physicsDone(id);
    for (const b of nb) toast(`${BADGES.find((x) => x.id === b)?.icon} Badge unlocked: ${BADGES.find((x) => x.id === b)?.name}`);
  };
}

function Floor({ friction = 0.8 }: { friction?: number }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[20, 0.05, 20]} position={[0, -0.05, 0]} friction={friction} />
    </RigidBody>
  );
}

/* ------------------------------ Gravity ------------------------------ */
function useGravity(): { panel: ReactNode; scene: ReactNode } {
  const [g, setG] = useState(9.81);
  const [h, setH] = useState(2);
  const [run, setRun] = useState(0);
  const [times, setTimes] = useState<{ heavy?: number; light?: number }>({});
  const t0 = useRef(0);
  const mark = useRun('gravity');
  const theory = Math.sqrt((2 * (h - 0.1)) / g);
  const panel = (
    <>
      <T en="Drop a 5 kg steel ball and a 0.1 kg plastic ball from the same height. Which lands first?" ta="5 kg எஃகுப் பந்தும் 0.1 kg பிளாஸ்டிக் பந்தும் ஒரே உயரத்திலிருந்து விழுகின்றன. எது முதலில் விழும்?" />
      <Seg value={String(g)} onChange={(v) => setG(parseFloat(v))} options={[{ v: '9.81', label: 'Earth' }, { v: '1.62', label: 'Moon' }, { v: '3.71', label: 'Mars' }, { v: '24.79', label: 'Jupiter' }]} />
      <Slider label="Drop height" value={h} min={0.5} max={4} step={0.1} unit="m" onChange={setH} />
      <button
        className="btn primary"
        onClick={() => {
          setTimes({});
          t0.current = performance.now();
          setRun((r) => r + 1);
          mark();
        }}
      >
        ▶ Drop both
      </button>
      <div className="kv">
        <span>Heavy ball landed</span>
        <span>{times.heavy != null ? `${fmt(times.heavy, 2)} s` : '—'}</span>
        <span>Light ball landed</span>
        <span>{times.light != null ? `${fmt(times.light, 2)} s` : '—'}</span>
        <span>Theory t = √(2h/g)</span>
        <span>{fmt(theory, 2)} s</span>
      </div>
      <div className="note">Without air resistance every object falls with the same acceleration g, whatever its mass. (Feathers fall slowly on Earth only because of air drag, which this demo ignores.)</div>
    </>
  );
  const scene = (
    <Physics gravity={[0, -g, 0]} key={`${run}-${g}-${h}`} paused={run === 0}>
      <Floor />
      <RigidBody colliders={false} position={[-0.4, h, 0]} onCollisionEnter={() => setTimes((t) => (t.heavy == null ? { ...t, heavy: (performance.now() - t0.current) / 1000 } : t))}>
        <BallCollider args={[0.1]} mass={5} restitution={0.1} />
        <mesh castShadow>
          <sphereGeometry args={[0.1, 32, 16]} />
          <meshStandardMaterial color="#b7bcc4" metalness={1} roughness={0.25} />
        </mesh>
      </RigidBody>
      <RigidBody colliders={false} position={[0.4, h, 0]} onCollisionEnter={() => setTimes((t) => (t.light == null ? { ...t, light: (performance.now() - t0.current) / 1000 } : t))}>
        <BallCollider args={[0.1]} mass={0.1} restitution={0.1} />
        <mesh castShadow>
          <sphereGeometry args={[0.1, 32, 16]} />
          <meshStandardMaterial color="#f8961e" roughness={0.6} />
        </mesh>
      </RigidBody>
      <Label position={[-0.4, h + 0.25, 0]}>5 kg</Label>
      <Label position={[0.4, h + 0.25, 0]}>0.1 kg</Label>
    </Physics>
  );
  return { panel, scene };
}

/* ------------------------------ Balance ------------------------------ */
function useBalance(): { panel: ReactNode; scene: ReactNode } {
  const [tilt, setTilt] = useState(10);
  const [coreH, setCoreH] = useState(0.3);
  const [run, setRun] = useState(0);
  const mark = useRun('balance');
  const W = 0.2,
    H = 0.6;
  const shellM = 0.5,
    coreM = 3;
  const hcom = (shellM * (H / 2) + coreM * coreH) / (shellM + coreM);
  const crit = Math.atan(W / 2 / hcom) / DEG;
  const willTip = tilt > crit;
  const panel = (
    <>
      <T en="A tall bottle holds a heavy weight inside. Tilt the platform, move the weight, then release. It tips when the vertical line through its centre of mass falls outside its base." ta="சாய்த்து விடுங்கள். நிறை மையத்தின் வழியே செல்லும் செங்குத்துக் கோடு அடிப்பகுதிக்கு வெளியே சென்றால் பொருள் கவிழும்." />
      <Slider label="Platform tilt" value={tilt} min={0} max={40} step={1} unit="°" onChange={(v) => { setTilt(v); setRun(0); }} />
      <Slider label="Height of heavy weight" value={coreH} min={0.06} max={0.54} step={0.02} unit="m" onChange={(v) => { setCoreH(v); setRun(0); }} />
      <button className="btn primary" onClick={() => { setRun((r) => r + 1); mark(); }}>
        ▶ Release
      </button>
      <div className="kv">
        <span>Centre of mass height</span>
        <span>{fmt(hcom * 1000, 0)} mm</span>
        <span>Critical tilt atan((w/2)/h)</span>
        <span>{fmt(crit, 1)}°</span>
        <span>Prediction</span>
        <span style={{ color: willTip ? 'var(--bad)' : 'var(--good)' }}>{willTip ? 'tips over' : 'stays upright'}</span>
      </div>
      <div className="note">Design lesson: a low, wide centre of mass makes products stable — think of weighted bases on lamps, phone stands and drinking glasses.</div>
    </>
  );
  const a = -tilt * DEG;
  const scene = (
    <Physics key={`${run}-${tilt}-${coreH}`} paused={run === 0}>
      <Floor />
      <group rotation={[0, 0, a]} position={[0, 0.3, 0]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.6, 0.025, 0.4]} friction={1.5} />
          <mesh receiveShadow>
            <boxGeometry args={[1.2, 0.05, 0.8]} />
            <meshStandardMaterial color="#577590" />
          </mesh>
        </RigidBody>
      </group>
      <RigidBody colliders={false} position={[Math.sin(-a) * (H / 2 + 0.03), 0.3 + Math.cos(a) * (H / 2 + 0.03), 0]} rotation={[0, 0, a]} type={run === 0 ? 'fixed' : 'dynamic'}>
        <CuboidCollider args={[W / 2, H / 2, W / 2]} mass={shellM} friction={1.5} />
        <CuboidCollider args={[W / 2 - 0.01, 0.04, W / 2 - 0.01]} position={[0, coreH - H / 2, 0]} mass={coreM} sensor={false} />
        <mesh castShadow>
          <boxGeometry args={[W, H, W]} />
          <meshPhysicalMaterial color="#4cc9f0" transparent opacity={0.35} roughness={0.2} />
        </mesh>
        <mesh position={[0, coreH - H / 2, 0]}>
          <boxGeometry args={[W - 0.02, 0.08, W - 0.02]} />
          <meshStandardMaterial color="#b7bcc4" metalness={0.9} roughness={0.3} />
        </mesh>
        <mesh position={[0, hcom - H / 2, 0]}>
          <sphereGeometry args={[0.025, 16, 8]} />
          <meshBasicMaterial color="#ffd166" />
        </mesh>
        <Line points={[[0, hcom - H / 2, 0], [0, hcom - H / 2 - 0.8, 0]]} color="#ffd166" lineWidth={1.5} dashed dashSize={0.03} gapSize={0.02} />
      </RigidBody>
    </Physics>
  );
  return { panel, scene };
}

/* ------------------------------ Friction ------------------------------ */
function useFriction(): { panel: ReactNode; scene: ReactNode } {
  const [angle, setAngle] = useState(20);
  const [mu, setMu] = useState(0.5);
  const [run, setRun] = useState(0);
  const mark = useRun('friction');
  const crit = Math.atan(mu) / DEG;
  const panel = (
    <>
      <T en="A block rests on a ramp. Gravity pulls it down the slope; friction resists. It slides when tan(angle) is greater than the friction coefficient μ." ta="சாய்தளத்தில் ஒரு கட்டை. tan(கோணம்) > μ ஆனால் அது நழுவும்." />
      <Slider label="Ramp angle" value={angle} min={0} max={50} step={1} unit="°" onChange={(v) => { setAngle(v); setRun(0); }} />
      <Slider label="Friction coefficient μ" value={mu} min={0.05} max={1.2} step={0.05} onChange={(v) => { setMu(v); setRun(0); }} />
      <div className="muted" style={{ fontSize: 12 }}>Typical μ: ice on ice 0.05 · steel on steel 0.6 · rubber on concrete 1.0</div>
      <button className="btn primary" onClick={() => { setRun((r) => r + 1); mark(); }}>
        ▶ Release block
      </button>
      <div className="kv">
        <span>tan({angle}°)</span>
        <span>{fmt(Math.tan(angle * DEG), 2)}</span>
        <span>Critical angle atan(μ)</span>
        <span>{fmt(crit, 1)}°</span>
        <span>Prediction</span>
        <span style={{ color: angle > crit ? 'var(--bad)' : 'var(--good)' }}>{angle > crit ? 'slides' : 'holds'}</span>
      </div>
      <div className="note">Simplification: the engine uses one friction coefficient. Real materials grip slightly harder before moving (static) than while sliding (kinetic).</div>
    </>
  );
  const a = angle * DEG;
  const L = 1.6;
  const scene = (
    <Physics key={`${run}-${angle}-${mu}`} paused={run === 0}>
      <Floor friction={mu} />
      <group position={[0, (Math.sin(a) * L) / 2 + 0.05, 0]} rotation={[0, 0, a]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[L / 2, 0.025, 0.3]} friction={mu} />
          <mesh receiveShadow>
            <boxGeometry args={[L, 0.05, 0.6]} />
            <meshStandardMaterial color="#b5838d" />
          </mesh>
        </RigidBody>
      </group>
      <RigidBody colliders={false} position={[Math.cos(a) * 0.4 - Math.sin(a) * 0.105, (Math.sin(a) * L) / 2 + 0.05 + Math.sin(a) * 0.4 + Math.cos(a) * 0.105, 0]} rotation={[0, 0, a]}>
        <CuboidCollider args={[0.1, 0.08, 0.1]} friction={mu} mass={1} />
        <mesh castShadow>
          <boxGeometry args={[0.2, 0.16, 0.2]} />
          <meshStandardMaterial color="#f8961e" />
        </mesh>
      </RigidBody>
    </Physics>
  );
  return { panel, scene };
}

/* ------------------------------ Torque ------------------------------ */
function Seesaw({ mL, dL, mR, dR, released }: { mL: number; dL: number; mR: number; dR: number; released: boolean }) {
  const base = useRef<RapierRigidBody>(null!);
  const plank = useRef<RapierRigidBody>(null!);
  useRevoluteJoint(base, plank, [
    [0, 0.5, 0],
    [0, 0, 0],
    [0, 0, 1],
  ]);
  return (
    <>
      <RigidBody ref={base} type="fixed" colliders={false}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <coneGeometry args={[0.18, 0.5, 3]} />
          <meshStandardMaterial color="#577590" />
        </mesh>
      </RigidBody>
      <RigidBody ref={plank} colliders={false} position={[0, 0.5, 0]} type={released ? 'dynamic' : 'fixed'}>
        <CuboidCollider args={[1, 0.025, 0.15]} mass={1} />
        <CuboidCollider args={[0.07, 0.07, 0.07]} position={[-dL, 0.095, 0]} mass={mL} />
        <CuboidCollider args={[0.07, 0.07, 0.07]} position={[dR, 0.095, 0]} mass={mR} />
        <mesh castShadow>
          <boxGeometry args={[2, 0.05, 0.3]} />
          <meshStandardMaterial color="#d8b779" />
        </mesh>
        {[
          [-dL, mL, '#4cc9f0'],
          [dR, mR, '#f94144'],
        ].map(([x, m, c]) => (
          <mesh key={c as string} position={[x as number, 0.025 + 0.035 * Math.cbrt(m as number) + 0.035, 0]} castShadow>
            <boxGeometry args={[0.07 * Math.cbrt(m as number) + 0.06, 0.07 * Math.cbrt(m as number) + 0.06, 0.14]} />
            <meshStandardMaterial color={c as string} />
          </mesh>
        ))}
      </RigidBody>
    </>
  );
}
function useTorque(): { panel: ReactNode; scene: ReactNode } {
  const [mL, setML] = useState(4);
  const [dL, setDL] = useState(0.5);
  const [mR, setMR] = useState(2);
  const [dR, setDR] = useState(0.5);
  const [run, setRun] = useState(0);
  const mark = useRun('torque');
  const tL = mL * 9.81 * dL,
    tR = mR * 9.81 * dR;
  const panel = (
    <>
      <T en="Torque = force × distance from the pivot. A small mass far from the pivot can balance a big mass close to it." ta="திருப்பு விசை = விசை × சுழல்மையத்திலிருந்து தூரம். தொலைவில் உள்ள சிறிய நிறை, அருகில் உள்ள பெரிய நிறையைச் சமன் செய்யும்." />
      <Slider label="Left (blue) mass" value={mL} min={0.5} max={10} step={0.5} unit="kg" onChange={(v) => { setML(v); setRun(0); }} />
      <Slider label="Left distance" value={dL} min={0.1} max={0.95} step={0.05} unit="m" onChange={(v) => { setDL(v); setRun(0); }} />
      <Slider label="Right (red) mass" value={mR} min={0.5} max={10} step={0.5} unit="kg" onChange={(v) => { setMR(v); setRun(0); }} />
      <Slider label="Right distance" value={dR} min={0.1} max={0.95} step={0.05} unit="m" onChange={(v) => { setDR(v); setRun(0); }} />
      <button className="btn primary" onClick={() => { setRun((r) => r + 1); mark(); }}>
        ▶ Release seesaw
      </button>
      <div className="formula">τ left = {fmt(mL, 1)} × 9.81 × {fmt(dL, 2)} = {fmt(tL, 1)} N·m</div>
      <div className="formula">τ right = {fmt(mR, 1)} × 9.81 × {fmt(dR, 2)} = {fmt(tR, 1)} N·m</div>
      <div className="muted">{Math.abs(tL - tR) < 0.5 ? '≈ Balanced — the seesaw should stay level.' : tL > tR ? 'Left side wins: it will tip left.' : 'Right side wins: it will tip right.'}</div>
    </>
  );
  const scene = (
    <Physics key={`${run}`}>
      <Floor />
      <Seesaw mL={mL} dL={dL} mR={mR} dR={dR} released={run > 0} />
    </Physics>
  );
  return { panel, scene };
}

/* ------------------------------ Stacking ------------------------------ */
function useStack(): { panel: ReactNode; scene: ReactNode } {
  const N = 4;
  const L = 0.4;
  const [off, setOff] = useState([0.1, 0.08, 0.05, 0.04]);
  const [run, setRun] = useState(0);
  const mark = useRun('stack');
  // block i centre relative to table edge (x=0): table occupies x <= 0
  const xs: number[] = [];
  let x = -L / 2;
  for (let i = 0; i < N; i++) {
    x += off[i];
    xs.push(x);
  }
  // stability: CoM of blocks k..N-1 must be over support (k=0 → table edge 0; else block k-1 right edge)
  const checks = xs.map((_, k) => {
    const com = xs.slice(k).reduce((s, v) => s + v, 0) / (N - k);
    const edge = k === 0 ? 0 : xs[k - 1] + L / 2;
    return { com, edge, ok: com <= edge };
  });
  const stable = checks.every((c) => c.ok);
  const overhang = xs[N - 1] + L / 2;
  const panel = (
    <>
      <T en="Stack four 400 mm blocks so the top one sticks out past the table edge as far as possible. Each sub-stack is stable only if its centre of mass is above the block (or table) beneath it." ta="மேசை விளிம்பைத் தாண்டி அதிகம் நீட்டியிருக்கும்படி நான்கு கட்டைகளை அடுக்குங்கள். ஒவ்வொரு மேல் அடுக்கின் நிறை மையமும் கீழுள்ள கட்டையின் மேல் இருக்க வேண்டும்." />
      {off.map((o, i) => (
        <Slider key={i} label={`Block ${i + 1} shift`} value={o} min={0} max={0.25} step={0.005} unit="m" onChange={(v) => { setOff(off.map((q, j) => (j === i ? v : q))); setRun(0); }} />
      ))}
      <button className="btn primary" onClick={() => { setRun((r) => r + 1); mark(); }}>
        ▶ Release stack
      </button>
      <div className="kv">
        <span>Top-block overhang</span>
        <span>{fmt(overhang * 1000, 0)} mm</span>
        <span>Prediction</span>
        <span style={{ color: stable ? 'var(--good)' : 'var(--bad)' }}>{stable ? 'stands' : `falls at level ${checks.findIndex((c) => !c.ok) + 1}`}</span>
      </div>
      <div className="note">The best possible shifts follow L/2, L/4, L/6, L/8 from the top down (the “harmonic stack”): 200, 100, 67, 50 mm. Try it! Real structures add safety margins because loads and materials vary.</div>
    </>
  );
  const scene = (
    <Physics key={`${run}`}>
      <Floor />
      <RigidBody type="fixed" colliders={false} position={[-0.6, 0.35, 0]}>
        <CuboidCollider args={[0.6, 0.35, 0.4]} friction={0.9} />
        <mesh receiveShadow castShadow>
          <boxGeometry args={[1.2, 0.7, 0.8]} />
          <meshStandardMaterial color="#577590" />
        </mesh>
      </RigidBody>
      {xs.map((bx, i) => (
        <RigidBody key={i} colliders={false} position={[bx, 0.7 + 0.05 + i * 0.1, 0]} type={run > 0 ? 'dynamic' : 'fixed'}>
          <CuboidCollider args={[L / 2, 0.05, 0.1]} mass={1} friction={0.9} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={[L, 0.1, 0.2]} />
            <meshStandardMaterial color={checks[i].ok ? ['#4cc9f0', '#90be6d', '#f8961e', '#9b5de5'][i] : '#f85149'} />
          </mesh>
        </RigidBody>
      ))}
    </Physics>
  );
  return { panel, scene };
}

export default function PhysicsLab() {
  const [exp, setExp] = useState<Exp>('gravity');
  const all = { gravity: useGravity(), balance: useBalance(), friction: useFriction(), torque: useTorque(), stack: useStack() };
  const cur = all[exp];
  const done = useProgress((s) => s.counters.physics);
  const tamil = useProgress((s) => s.settings.tamil);
  const meta = EXPS.find((e) => e.id === exp)!;
  return (
    <div className="level">
      <div className="levelhead">
        <button className="btn small" onClick={() => navigate('/')}>
          ←
        </button>
        <h2>Visual Physics Lab</h2>
        <span className="tag partial">Simplified rigid-body simulation · Rapier engine</span>
        <div style={{ flex: 1 }} />
        <div className="btnrow">
          {EXPS.map((e) => (
            <button key={e.id} className={`btn small ${exp === e.id ? 'on' : ''}`} onClick={() => setExp(e.id)}>
              {done.includes(e.id) ? '✓ ' : ''}
              {e.name}
            </button>
          ))}
        </div>
      </div>
      <div className="levelbody">
        <Stage3D fit={2.2} camera={[2.4, 2.3, 5.2]} target={[0, 0.9, 0]} gridSize={0.1} showViews={false}>
          <group key={exp}>{cur.scene}</group>
        </Stage3D>
        <aside className="side">
          <h3>
            {meta.name}
            {tamil && <span className="muted" lang="ta"> · {meta.ta}</span>}
          </h3>
          {cur.panel}
          <div className="note warn">
            These are simplified rigid-body demonstrations for building intuition (no air resistance, rigid materials, a single friction coefficient). They are not engineering validation.
          </div>
        </aside>
      </div>
    </div>
  );
}
