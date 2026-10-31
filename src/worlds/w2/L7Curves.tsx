import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { SketchText, SketchView, usePx } from '../../components/sketch/SketchView';
import { Stage3D } from '../../components/Stage3D';
import { Toggle } from '../../components/ui';
import { fmt, scoreFromError } from '../../lib/math';
import { useSettings } from '../../store/progress';
import type { Feedback, LessonStep, Vec2 } from '../../lib/types';

// 10 points: anchors at 0,3,6,9; handles between.
const START: Vec2[] = [
  [30, 0],
  [40, 20],
  [40, 50],
  [30, 70],
  [20, 90],
  [20, 110],
  [20, 125],
  [20, 140],
  [20, 150],
  [20, 160],
];
const TARGET: Vec2[] = [
  [28, 0],
  [50, 15],
  [55, 50],
  [42, 80],
  [30, 105],
  [14, 112],
  [14, 130],
  [14, 145],
  [22, 152],
  [26, 160],
];

const isAnchor = (i: number) => i % 3 === 0;

function bez(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
}
export function sampleChain(pts: Vec2[], n = 40): Vec2[] {
  const out: Vec2[] = [];
  for (let s = 0; s + 3 < pts.length; s += 3) for (let i = s === 0 ? 0 : 1; i <= n; i++) out.push(bez(pts[s], pts[s + 1], pts[s + 2], pts[s + 3], i / n));
  return out;
}
function radiusAt(poly: Vec2[], y: number) {
  for (let i = 0; i + 1 < poly.length; i++) {
    const [a, b] = [poly[i], poly[i + 1]];
    if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) return a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
  }
  return null;
}

function Pt({ p, anchor, onDown }: { p: Vec2; anchor: boolean; onDown: (e: React.PointerEvent) => void }) {
  const r = usePx(anchor ? 10 : 8);
  return anchor ? (
    <rect x={p[0] - r} y={p[1] - r} width={r * 2} height={r * 2} fill="#f8961e" stroke="#0e141b" strokeWidth={usePx(2)} onPointerDown={onDown} style={{ cursor: 'grab' }} />
  ) : (
    <circle cx={p[0]} cy={p[1]} r={r} fill="#0e141b" stroke="#4cc9f0" strokeWidth={usePx(2.5)} onPointerDown={onDown} style={{ cursor: 'grab' }} />
  );
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Product silhouettes — bottles, mice, car bodies — are made of smooth curves called splines. Here a curve made of three Bézier segments is spun around the axis to make a vase.', ta: 'பாட்டில், மவுஸ் போன்றவற்றின் வடிவங்கள் spline எனும் மென்மையான வளைவுகளால் ஆனவை.' },
  { stage: 'TOUCH', text: 'Squares are anchor points (the curve passes through them). Circles are control handles: they pull the curve without touching it.', ta: 'சதுரங்கள் = anchor புள்ளிகள் (வளைவு அவற்றின் வழியே செல்லும்). வட்டங்கள் = கட்டுப்பாட்டுக் கைப்பிடிகள்.' },
  { stage: 'UNDERSTAND', text: 'The line from an anchor to its handle is the tangent: the direction the curve leaves the point. When both handles of an anchor are in line, the join is smooth (G1). Otherwise you get a corner (G0).', ta: 'Anchor-இலிருந்து கைப்பிடிக்கான கோடு = tangent. இரு கைப்பிடிகளும் ஒரே கோட்டில் இருந்தால் இணைப்பு மென்மையானது (G1).' },
  { stage: 'BUILD', text: 'Match the dashed target silhouette as closely as possible. Keep “Smooth joins” on to keep tangents aligned.', ta: 'புள்ளிக்கோட்டு இலக்கு வடிவத்தைப் பொருத்துங்கள்.' },
];

export default function L7Curves() {
  const { difficulty } = useSettings();
  const [pts, setPts] = useState<Vec2[]>(START);
  const [smooth, setSmooth] = useState(true);
  const [drag, setDrag] = useState<number | null>(null);
  const [corr, setCorr] = useState(false);
  const curve = useMemo(() => sampleChain(pts), [pts]);
  const target = useMemo(() => sampleChain(TARGET), []);
  const tolMm = difficulty === 'beginner' ? 4 : difficulty === 'intermediate' ? 2.5 : 1.5;

  const geo = useMemo(() => {
    const prof = [new THREE.Vector2(0, 0), ...curve.map(([x, y]) => new THREE.Vector2(Math.max(0, x), y))];
    const g = new THREE.LatheGeometry(prof, 64);
    g.computeVertexNormals();
    return g;
  }, [curve]);

  const moveTo = (i: number, p: Vec2) => {
    setPts((cur) => {
      const n = cur.map((q) => [...q] as Vec2);
      const d: Vec2 = [p[0] - cur[i][0], p[1] - cur[i][1]];
      if (isAnchor(i)) {
        if (i === 0) p = [p[0], 0];
        if (i === n.length - 1) p = [p[0], 160];
        const dd: Vec2 = [p[0] - cur[i][0], p[1] - cur[i][1]];
        n[i] = [Math.max(0, p[0]), p[1]];
        if (i - 1 >= 0) n[i - 1] = [n[i - 1][0] + dd[0], n[i - 1][1] + dd[1]];
        if (i + 1 < n.length) n[i + 1] = [n[i + 1][0] + dd[0], n[i + 1][1] + dd[1]];
      } else {
        n[i] = [cur[i][0] + d[0], cur[i][1] + d[1]];
        const a = i % 3 === 1 ? i - 1 : i + 1;
        const o = i % 3 === 1 ? i - 2 : i + 2;
        if (smooth && o > 0 && o < n.length - 1) {
          const v: Vec2 = [n[a][0] - n[i][0], n[a][1] - n[i][1]];
          const L = Math.hypot(v[0], v[1]) || 1;
          const lo = Math.hypot(n[o][0] - n[a][0], n[o][1] - n[a][1]);
          n[o] = [n[a][0] + (v[0] / L) * lo, n[a][1] + (v[1] / L) * lo];
        }
      }
      return n;
    });
  };

  const joins = [3, 6].map((a) => {
    const u: Vec2 = [pts[a][0] - pts[a - 1][0], pts[a][1] - pts[a - 1][1]];
    const v: Vec2 = [pts[a + 1][0] - pts[a][0], pts[a + 1][1] - pts[a][1]];
    const ang = Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])) * (180 / Math.PI);
    return ang < 3 ? 'G1 smooth' : `G0 corner (${fmt(ang, 0)}°)`;
  });

  const evaluate = (): Feedback => {
    const errs: number[] = [];
    let worst = { y: 0, e: 0 };
    for (let y = 4; y <= 156; y += 4) {
      const ru = radiusAt(curve, y),
        rt = radiusAt(target, y);
      if (rt == null) continue;
      const e = ru == null ? 30 : Math.abs(ru - rt);
      errs.push(e);
      if (e > worst.e) worst = { y, e };
    }
    const mean = errs.reduce((s, e) => s + e, 0) / errs.length;
    const smoothOk = joins.every((j) => j.startsWith('G1'));
    const score = Math.round(scoreFromError(mean, tolMm) * 0.85 + (smoothOk ? 15 : 0));
    return {
      score,
      correct: [mean <= tolMm ? `Average deviation ${fmt(mean, 2)} mm — a close match.` : '', smoothOk ? 'Both joins are tangent-continuous (G1) — no visible kinks.' : ''].filter(Boolean),
      issues: [
        ...(mean > tolMm ? [{ label: `Average deviation ${fmt(mean, 2)} mm (aim for ≤ ${tolMm} mm).`, detail: `Largest gap is ${fmt(worst.e, 1)} mm at height ${worst.y} mm.` }] : []),
        ...(smoothOk ? [] : [{ label: 'At least one join has a corner.', detail: 'Turn on “Smooth joins” and re-drag a handle at that anchor.' }]),
      ],
      why: 'Splines are how designers control flowing forms with only a few points. Tangent continuity decides whether reflections run smoothly over a surface — a G0 kink shows up as a visible crease on a glossy product.',
      suggestion: `Work from the biggest gap: around ${worst.y} mm height. Move the nearest anchor first, then fine-tune its handles.`,
      canShowCorrection: true,
    };
  };

  return (
    <LevelShell
      id="w2-l7"
      steps={steps}
      evaluate={evaluate}
      onCorrection={setCorr}
      hints={[{ en: 'The target is widest (≈55 mm) about a third of the way up and narrowest at the neck (≈14 mm).', ta: 'இலக்கு மூன்றில் ஒரு பங்கு உயரத்தில் மிக அகலமாக (≈55 mm) உள்ளது.' }]}
      viewport={
        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', display: 'flex', minHeight: 260 }}>
            <SketchView extent={70} center={[30, 80]} grid={10} onMove={({ pt }) => drag != null && moveTo(drag, pt)} onUp={() => setDrag(null)}>
              <line x1={0} y1={-10} x2={0} y2={180} stroke="#f8961e" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
              <polyline points={target.map((p) => p.join(',')).join(' ')} fill="none" stroke={corr ? '#ffd166' : '#8d9aa8'} strokeWidth={corr ? 3 : 2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
              <polyline points={curve.map((p) => p.join(',')).join(' ')} fill="none" stroke="#4cc9f0" strokeWidth={3} vectorEffect="non-scaling-stroke" />
              {[0, 3, 6].map((s) => (
                <g key={s}>
                  <line x1={pts[s][0]} y1={pts[s][1]} x2={pts[s + 1][0]} y2={pts[s + 1][1]} stroke="#4cc9f0" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
                  <line x1={pts[s + 3][0]} y1={pts[s + 3][1]} x2={pts[s + 2][0]} y2={pts[s + 2][1]} stroke="#4cc9f0" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
                </g>
              ))}
              {pts.map((p, i) => (
                <Pt key={i} p={p} anchor={isAnchor(i)} onDown={(e) => { e.stopPropagation(); setDrag(i); }} />
              ))}
              <SketchText x={-4} y={170} anchor="end" color="#f8961e">axis</SketchText>
            </SketchView>
          </div>
          <div style={{ flex: '1 1 260px', display: 'flex', minHeight: 260 }}>
            <Stage3D fit={130} camera={[150, 160, 220]} target={[0, 80, 0]} showViews={false} env>
              <mesh geometry={geo} castShadow>
                <meshPhysicalMaterial color="#4cc9f0" roughness={0.12} clearcoat={1} side={THREE.DoubleSide} />
              </mesh>
            </Stage3D>
          </div>
        </div>
      }
    >
      <Toggle checked={smooth} onChange={setSmooth} label="Smooth joins (mirror handle direction — G1)" />
      <div className="kv">
        <span>Join at anchor 2</span>
        <span>{joins[0]}</span>
        <span>Join at anchor 3</span>
        <span>{joins[1]}</span>
      </div>
      <div className="note">Bézier formula for one segment: B(t) = (1−t)³P₀ + 3(1−t)²tP₁ + 3(1−t)t²P₂ + t³P₃, with t from 0 to 1. You never need to compute it by hand — but it explains why handles pull without touching.</div>
      <button className="btn small" onClick={() => setPts(START)}>
        ↺ Reset curve
      </button>
    </LevelShell>
  );
}
