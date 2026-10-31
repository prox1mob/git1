import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { SketchText, SketchView, usePx } from '../../components/sketch/SketchView';
import { Stage3D } from '../../components/Stage3D';
import { Seg, Slider, Task } from '../../components/ui';
import { absTol, fmt } from '../../lib/math';
import { isSimple } from '../../lib/poly';
import { useSettings } from '../../store/progress';
import type { Feedback, LessonStep, Vec2 } from '../../lib/types';

const PRESETS: Record<string, Vec2[]> = {
  Bottle: [
    [0, 0],
    [30, 0],
    [32, 8],
    [32, 120],
    [24, 150],
    [12, 165],
    [12, 185],
    [0, 185],
  ],
  Knob: [
    [0, 0],
    [22, 0],
    [24, 4],
    [24, 14],
    [18, 20],
    [8, 22],
    [8, 32],
    [0, 32],
  ],
  Bowl: [
    [0, 0],
    [25, 0],
    [45, 30],
    [55, 60],
    [50, 60],
    [40, 33],
    [22, 6],
    [0, 6],
  ],
};

function Pt({ p, sel, onDown }: { p: Vec2; sel: boolean; onDown: (e: React.PointerEvent) => void }) {
  const r = usePx(sel ? 11 : 9);
  return <circle cx={p[0]} cy={p[1]} r={r} fill={sel ? '#f8961e' : '#0e141b'} stroke="#f8961e" strokeWidth={usePx(2)} onPointerDown={onDown} style={{ cursor: 'grab' }} />;
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'A revolve spins a half-profile around an axis. Bottles, knobs, wheels, cups and lamp shades are all revolved parts — and most are made on a lathe.', ta: 'Revolve ஒரு அரை-வடிவத்தை அச்சைச் சுற்றிச் சுழற்றுகிறது. பாட்டில், குமிழ், சக்கரம் — எல்லாம் revolve.' },
  { stage: 'TOUCH', text: 'Drag the profile points. Use “Revolve angle” to cut the part open and see its cross-section.', ta: 'வடிவப் புள்ளிகளை இழுங்கள். "Revolve angle" குறைத்துக் குறுக்குவெட்டைப் பாருங்கள்.' },
  { stage: 'UNDERSTAND', text: 'Rules: the profile must be closed, must never cross the axis (x ≥ 0), and should not intersect itself — otherwise the solid would be invalid.', ta: 'விதிகள்: வடிவம் மூடியிருக்க வேண்டும், அச்சைக் கடக்கக் கூடாது (x ≥ 0).' },
  { stage: 'BUILD', text: 'Challenge: make a bottle 200 mm tall with a Ø70 body and a Ø26 neck at the top, closed at the base.', ta: 'சவால்: 200 mm உயரம், Ø70 உடல், மேலே Ø26 கழுத்து கொண்ட பாட்டில்.' },
];

export default function L5Revolve() {
  const { difficulty } = useSettings();
  const tol = absTol(difficulty);
  const [pts, setPts] = useState<Vec2[]>(PRESETS.Bottle);
  const [sel, setSel] = useState<number | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [angle, setAngle] = useState(360);
  const [preset, setPreset] = useState('Bottle');
  const [corr, setCorr] = useState(false);
  const crosses = pts.some((p) => p[0] < -0.01);
  const simple = isSimple(pts);
  const valid = !crosses && simple && pts.length >= 3;

  const geo = useMemo(() => {
    if (!valid) return null;
    const prof = [...pts, pts[0]].map(([x, y]) => new THREE.Vector2(Math.max(0, x), y));
    const g = new THREE.LatheGeometry(prof, 72, 0, (angle * Math.PI) / 180);
    g.computeVertexNormals();
    return g;
  }, [pts, angle, valid]);

  const H = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
  const R = Math.max(...pts.map((p) => p[0]));
  const topPts = pts.filter((p) => p[1] > Math.max(...pts.map((q) => q[1])) - 1 && p[0] > 0.5);
  const neck = topPts.length ? Math.max(...topPts.map((p) => p[0])) : 0;
  const baseClosed = pts.some((p) => Math.abs(p[0]) < 0.5 && Math.abs(p[1] - Math.min(...pts.map((q) => q[1]))) < 0.5);
  const checks: [boolean, string, string][] = [
    [valid, 'Valid closed profile', crosses ? 'The profile crosses the axis (x < 0).' : 'The profile intersects itself.'],
    [Math.abs(H - 200) <= tol, 'Height 200 mm', `Height ${fmt(H)} mm`],
    [Math.abs(R * 2 - 70) <= tol, 'Body Ø70 mm', `Widest diameter Ø${fmt(R * 2)} mm`],
    [Math.abs(neck * 2 - 26) <= tol, 'Neck Ø26 mm at the top', `Neck at the top is Ø${fmt(neck * 2)} mm`],
    [baseClosed, 'Base closed on the axis', 'The base does not reach the axis — the bottle would have a hole in the bottom.'],
  ];

  const evaluate = (): Feedback => ({
    score: Math.round((checks.filter((c) => c[0]).length / checks.length) * 100),
    correct: checks.filter((c) => c[0]).map((c) => c[1]),
    issues: checks.filter((c) => !c[0]).map((c) => ({ label: c[2] })),
    why: 'Revolved features are exact and easy to manufacture: one profile defines the whole shape, and a lathe or a blow-mould reproduces it. Diameters (Ø) on a drawing are twice the radius in your profile.',
    suggestion: 'Remember the profile uses radius: Ø70 means x = 35, Ø26 means x = 13. Put the top points at y = 200.',
    canShowCorrection: true,
  });

  return (
    <LevelShell
      id="w3-l5"
      steps={steps}
      evaluate={evaluate}
      onCorrection={setCorr}
      onRetry={() => setPts(PRESETS.Bottle)}
      hints={[{ en: 'Move the two top points to (13, 200) and (0, 200), and the body points to x = 35.', ta: 'மேல் புள்ளிகளை (13, 200), (0, 200)-க்கு நகர்த்துங்கள்; உடல் புள்ளிகள் x = 35.' }]}
      viewport={
        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px', display: 'flex', minHeight: 260 }}>
            <SketchView extent={90} center={[40, 100]} onMove={({ pt }) => drag != null && setPts(pts.map((p, i) => (i === drag ? [Math.round(pt[0]), Math.round(pt[1])] : p)))} onUp={() => setDrag(null)}>
              <line x1={0} y1={-20} x2={0} y2={260} stroke="#f8961e" strokeDasharray="6 4" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              {corr && <polyline points="0,0 35,0 35,150 13,185 13,200 0,200" fill="none" stroke="#ffd166" strokeDasharray="5 4" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
              <polygon points={pts.map((p) => p.join(',')).join(' ')} fill={valid ? 'rgba(76,201,240,0.18)' : 'rgba(248,81,73,0.2)'} stroke={valid ? '#4cc9f0' : '#f85149'} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
              {pts.map((p, i) => (
                <Pt
                  key={i}
                  p={p}
                  sel={sel === i}
                  onDown={(e) => {
                    e.stopPropagation();
                    setSel(i);
                    setDrag(i);
                  }}
                />
              ))}
              {sel != null && (
                <SketchText x={pts[sel][0] + 4} y={pts[sel][1] + 6} anchor="start" color="#f8961e">
                  {`(${pts[sel][0]}, ${pts[sel][1]})`}
                </SketchText>
              )}
              <SketchText x={-3} y={240} anchor="end" color="#f8961e">
                axis
              </SketchText>
            </SketchView>
          </div>
          <div style={{ flex: '1 1 260px', display: 'flex', minHeight: 260 }}>
            <Stage3D fit={150} camera={[200, 180, 260]} target={[0, 90, 0]} showViews={false} env>
              {geo && (
                <mesh geometry={geo} castShadow>
                  <meshPhysicalMaterial color="#90be6d" roughness={0.2} clearcoat={0.6} side={THREE.DoubleSide} />
                </mesh>
              )}
            </Stage3D>
          </div>
        </div>
      }
    >
      <div className="field">
        <span className="lbl">Start from a preset</span>
        <Seg value={preset} onChange={(p) => { setPreset(p); setPts(PRESETS[p]); setSel(null); }} options={Object.keys(PRESETS).map((k) => ({ v: k, label: k }))} />
      </div>
      <Slider label="Revolve angle" value={angle} min={10} max={360} step={5} unit="°" onChange={setAngle} />
      <div className="btnrow">
        <button className="btn small" disabled={sel == null} onClick={() => { if (sel == null) return; const a = pts[sel], b = pts[(sel + 1) % pts.length]; const n = [...pts]; n.splice(sel + 1, 0, [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)]); setPts(n); setSel(sel + 1); }}>
          ＋ Add point after selected
        </button>
        <button className="btn small" disabled={sel == null || pts.length <= 3} onClick={() => { if (sel == null) return; setPts(pts.filter((_, i) => i !== sel)); setSel(null); }}>
          − Delete point
        </button>
      </div>
      <div className="card" style={{ padding: 10 }}>
        {checks.map((c, i) => (
          <Task key={i} ok={c[0]}>
            {c[1]} {!c[0] && <span className="muted">· {c[2]}</span>}
          </Task>
        ))}
      </div>
    </LevelShell>
  );
}
