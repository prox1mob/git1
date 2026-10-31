import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { Slider, Toggle } from '../../components/ui';
import { extrusionGeometry } from '../../lib/shapes';
import { rectPoly, treatCorners } from '../../lib/poly';
import { fmt } from '../../lib/math';
import type { Feedback, LessonStep } from '../../lib/types';

interface P {
  W: number;
  H: number;
  R: number;
  e: number;
  split: number;
  grille: number;
  cA: string;
  cB: string;
}
const RATIOS = [1, 1.414, 1.5, 1.618, 2];
const lum = (h: string) => {
  const c = new THREE.Color(h);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};

function Clip() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);
  return null;
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Two products can work identically yet feel completely different. Refinement is about proportion, silhouette, surface transitions and balance.', ta: 'ஒரே மாதிரி வேலை செய்யும் இரு பொருட்கள் முற்றிலும் வேறுபட்டு உணரப்படலாம்.' },
  { stage: 'EXPERIMENT', text: 'Tune the speaker: proportions, corner and edge radii, the two-tone split line, grille size and colours. Toggle silhouette mode — the outline alone should already be recognisable and pleasing.', ta: 'விகிதம், ஆரங்கள், இரு-நிற பிரிகோடு, நிறங்களை மாற்றிப் பாருங்கள். Silhouette mode பயன்படுத்துங்கள்.' },
  { stage: 'UNDERSTAND', text: 'Common principles: harmonic proportions (1 : 1.5, 1 : 1.618…), one consistent family of radii, split lines placed deliberately (a third, a half), and enough contrast for colour-blocking to read.', ta: 'பொதுக் கொள்கைகள்: இசைவான விகிதங்கள், ஒத்த ஆரங்கள், திட்டமிட்ட பிரிகோடு, போதுமான வேறுபாடு.' },
  { stage: 'IMPROVE', text: 'The rubric checks these principles transparently. It cannot measure beauty — great designers sometimes break them on purpose.', ta: 'மதிப்பீடு கொள்கைகளை மட்டுமே சரிபார்க்கும்; அழகை அளக்க முடியாது.' },
];

export default function L7Aesthetic() {
  const [p, setP] = useState<P>({ W: 130, H: 100, R: 4, e: 3, split: 0.8, grille: 0.3, cA: '#577590', cB: '#5b6f8f' });
  const [sil, setSil] = useState(false);
  const [silUsed, setSilUsed] = useState(false);
  const set = (q: Partial<P>) => setP({ ...p, ...q });
  const geo = useMemo(() => {
    const o = treatCorners(rectPoly(-p.W / 2, 0, p.W / 2, p.H), Math.max(0.01, p.R), 'fillet', 10);
    return extrusionGeometry({ outline: o, holes: [], depth: 60, bevel: Math.min(p.e, 29), bevelSegs: 5 });
  }, [p.W, p.H, p.R, p.e]);
  const y = p.H * p.split;
  const below = useMemo(() => [new THREE.Plane(new THREE.Vector3(0, -1, 0), y)], [y]);
  const above = useMemo(() => [new THREE.Plane(new THREE.Vector3(0, 1, 0), -y)], [y]);

  const ratio = Math.max(p.W, p.H) / Math.min(p.W, p.H);
  const nearRatio = RATIOS.find((r) => Math.abs(ratio - r) / r <= 0.03);
  const minDim = Math.min(p.W, p.H);
  const nearSplit = [1 / 3, 1 / 2, 2 / 3].find((s) => Math.abs(p.split - s) <= 0.03);
  const contrast = Math.abs(lum(p.cA) - lum(p.cB));

  const evaluate = (): Feedback => {
    const rubric = [
      { criterion: 'Harmonic proportion (1:1, 1:1.414, 1:1.5, 1:1.618 or 1:2, ±3 %)', points: nearRatio ? 20 : 0, max: 20, note: `ratio 1 : ${fmt(ratio, 3)}${nearRatio ? ` ≈ 1 : ${nearRatio}` : ''}` },
      { criterion: 'Radius family: corner radius 10–45 % of the smaller side, edge radius ≤ 40 % of corner radius', points: p.R >= 0.1 * minDim && p.R <= 0.45 * minDim && p.e <= 0.4 * p.R ? 20 : 0, max: 20, note: `corner ${fmt(p.R)} mm, edge ${fmt(p.e)} mm` },
      { criterion: 'Split line placed deliberately (⅓, ½ or ⅔ of the height)', points: nearSplit ? 20 : 0, max: 20, note: `at ${fmt(p.split * 100, 0)} %` },
      { criterion: 'Colour blocking reads clearly (luminance contrast ≥ 0.15) or is deliberately one colour', points: contrast >= 0.15 || contrast < 0.005 ? 15 : 0, max: 15, note: `contrast ${fmt(contrast, 2)}` },
      { criterion: 'Grille 40–70 % of the smaller side — a strong focal point', points: p.grille >= 0.4 && p.grille <= 0.7 ? 10 : 0, max: 10 },
      { criterion: 'Silhouette checked', points: silUsed ? 15 : 0, max: 15 },
    ];
    const bad = rubric.filter((r) => r.points < r.max);
    return {
      score: Math.round(rubric.reduce((s, r) => s + r.points, 0)),
      correct: rubric.filter((r) => r.points >= r.max).map((r) => r.criterion),
      issues: bad.map((r) => ({ label: r.criterion, detail: r.note })),
      why: 'Refinement is where a functional object becomes a desirable product. These principles are tools that usually help — they are not a formula, and the rubric never claims one design is objectively perfect.',
      suggestion: bad.length ? `Try: ${bad[0].criterion.split('(')[0].trim().toLowerCase()}.` : 'Make a second version that deliberately breaks one principle and compare them side by side.',
      rubric,
    };
  };

  const mat = (c: string, clip: THREE.Plane[]) => (sil ? <meshBasicMaterial color="#0b0f14" clippingPlanes={clip} /> : <meshPhysicalMaterial color={c} roughness={0.55} sheen={0.4} clippingPlanes={clip} />);
  return (
    <LevelShell
      id="w6-l7"
      steps={steps}
      evaluate={evaluate}
      viewport={
        <Stage3D fit={130} camera={[60, 90, 300]} target={[0, 50, 0]} env={!sil} showViews={false} background={sil ? '#f4f1e8' : undefined} grid={!sil}>
          <Clip />
          <mesh geometry={geo} position={[0, 0, 0]} castShadow>
            {mat(p.cA, below)}
          </mesh>
          <mesh geometry={geo} position={[0, 0, 0]} castShadow>
            {mat(p.cB, above)}
          </mesh>
          {!sil && (
            <mesh position={[0, p.H * Math.min(p.split, 1) * 0.5 + (p.split >= 0.95 ? 0 : 0), 30.5]}>
              <circleGeometry args={[(minDim * p.grille) / 2, 48]} />
              <meshStandardMaterial color="#1e2126" roughness={0.9} />
            </mesh>
          )}
        </Stage3D>
      }
    >
      <Slider label="Width" value={p.W} min={60} max={220} step={1} unit="mm" onChange={(W) => set({ W })} />
      <Slider label="Height" value={p.H} min={60} max={220} step={1} unit="mm" onChange={(H) => set({ H })} />
      <div className="muted" style={{ fontSize: 12 }}>
        Proportion 1 : {fmt(ratio, 3)} {nearRatio ? `≈ 1 : ${nearRatio}` : ''}
      </div>
      <Slider label="Corner radius" value={p.R} min={0} max={Math.floor(minDim / 2) - 1} step={1} unit="mm" onChange={(R) => set({ R })} />
      <Slider label="Edge radius" value={p.e} min={0} max={12} step={0.5} unit="mm" onChange={(e) => set({ e })} digits={1} />
      <Slider label="Split line height" value={p.split} min={0.1} max={1} step={0.01} onChange={(split) => set({ split })} digits={2} />
      <Slider label="Grille size" value={p.grille} min={0.2} max={0.9} step={0.01} onChange={(grille) => set({ grille })} digits={2} />
      <div className="numrow">
        <span className="lbl">Lower</span>
        <input type="color" value={p.cA} onChange={(e) => set({ cA: e.target.value })} />
        <span className="lbl">Upper</span>
        <input type="color" value={p.cB} onChange={(e) => set({ cB: e.target.value })} />
      </div>
      <Toggle checked={sil} onChange={(v) => { setSil(v); if (v) setSilUsed(true); }} label="Silhouette mode" />
    </LevelShell>
  );
}
