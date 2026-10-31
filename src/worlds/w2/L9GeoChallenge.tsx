import { BuildChallenge, type BuildTarget } from '../../components/BuildChallenge';
import { makeObject, objectBox, type SceneObject } from '../../lib/shapes';
import { fmt } from '../../lib/math';
import type { LessonStep } from '../../lib/types';
import * as THREE from 'three';

const m = (c: string) => ({ preset: 'alu', color: c, roughness: 0.35, metalness: 0.6, opacity: 1 });

const TARGETS: BuildTarget[] = [
  {
    name: 'L-bracket with boss',
    blurb: 'Read the drawing: all dimensions in mm. The base sits on the floor, the upright stands on the left end of the base, and a round boss sits on the base.',
    parts: [
      makeObject('box', { name: 'Base plate', position: [0, 5, 0], dims: { w: 70, h: 10, d: 40 }, material: m('#c9ced6') }),
      makeObject('box', { name: 'Upright', position: [-30, 30, 0], dims: { w: 10, h: 40, d: 40 }, material: m('#b7bcc4') }),
      makeObject('cylinder', { name: 'Boss', position: [15, 16, 0], dims: { r: 8, h: 12 }, material: m('#d4a64a') }),
    ],
  },
  {
    name: 'Stepped shaft',
    blurb: 'A turned shaft standing upright: three coaxial cylinders, largest at the bottom. Diameters and lengths are on the drawing.',
    parts: [
      makeObject('cylinder', { name: 'Flange Ø50', position: [0, 5, 0], dims: { r: 25, h: 10 }, material: m('#c9ced6') }),
      makeObject('cylinder', { name: 'Shaft Ø24', position: [0, 25, 0], dims: { r: 12, h: 30 }, material: m('#b7bcc4') }),
      makeObject('cylinder', { name: 'Pin Ø12', position: [0, 50, 0], dims: { r: 6, h: 20 }, material: m('#d4a64a') }),
    ],
  },
];

/** A simple dimensioned front view (X–Y) generated from the target parts. */
function Drawing({ parts }: { parts: SceneObject[] }) {
  const boxes = parts.map((p) => objectBox(p));
  const all = boxes.reduce((a, b) => a.union(b), new THREE.Box3());
  const W = 300,
    H = 200,
    pad = 34;
  const sx = (W - pad * 2) / Math.max(all.max.x - all.min.x, 1);
  const sy = (H - pad * 2) / Math.max(all.max.y - all.min.y, 1);
  const k = Math.min(sx, sy);
  const X = (x: number) => pad + (x - all.min.x) * k;
  const Y = (y: number) => H - pad - (y - all.min.y) * k;
  return (
    <div>
      <div className="lbl">Drawing — front view (X → right, Y ↑), mm</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ background: '#f4f1e8', borderRadius: 8 }}>
        {parts.map((p, i) => {
          const b = boxes[i];
          return (
            <g key={p.id}>
              <rect x={X(b.min.x)} y={Y(b.max.y)} width={(b.max.x - b.min.x) * k} height={(b.max.y - b.min.y) * k} fill="none" stroke="#1b2430" strokeWidth={1.5} />
              {p.type === 'cylinder' && <line x1={X((b.min.x + b.max.x) / 2)} x2={X((b.min.x + b.max.x) / 2)} y1={Y(b.max.y) - 6} y2={Y(b.min.y) + 6} stroke="#1b2430" strokeDasharray="8 3 2 3" strokeWidth={0.8} />}
              <text x={X(b.max.x) + 3} y={Y((b.min.y + b.max.y) / 2)} fontSize={9} fill="#1b2430" dominantBaseline="middle">
                {p.type === 'cylinder' ? `Ø${fmt(p.dims.r * 2)} × ${fmt(p.dims.h)}` : `${fmt(p.dims.w)} × ${fmt(p.dims.h)} × ${fmt(p.dims.d)}`}
              </text>
            </g>
          );
        })}
        <line x1={X(all.min.x)} x2={X(all.max.x)} y1={H - 12} y2={H - 12} stroke="#a33" />
        <text x={(X(all.min.x) + X(all.max.x)) / 2} y={H - 3} fontSize={9} textAnchor="middle" fill="#a33">
          {fmt(all.max.x - all.min.x)}
        </text>
        <line x1={12} x2={12} y1={Y(all.min.y)} y2={Y(all.max.y)} stroke="#a33" />
        <text x={8} y={(Y(all.min.y) + Y(all.max.y)) / 2} fontSize={9} fill="#a33" transform={`rotate(-90 8 ${(Y(all.min.y) + Y(all.max.y)) / 2})`} textAnchor="middle">
          {fmt(all.max.y - all.min.y)}
        </text>
        {parts.map((p, i) => {
          const b = boxes[i];
          return (
            <text key={i} x={X(b.min.x) + 2} y={Y(b.max.y) - 3} fontSize={8} fill="#555">
              {p.name}: x {fmt(b.min.x)}…{fmt(b.max.x)}, y {fmt(b.min.y)}…{fmt(b.max.y)}
            </text>
          );
        })}
      </svg>
      <div className="muted" style={{ fontSize: 12 }}>All parts are centred on Z = 0. Positions in the editor are part centres.</div>
    </div>
  );
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'This is a real drawing task: no ghost, just dimensions. Read every number before building.', ta: 'இது உண்மையான வரைபடப் பணி: ghost இல்லை, அளவுகள் மட்டுமே.' },
  { stage: 'UNDERSTAND', text: 'Convert edges into centres: a part from x = −35 to −25 has its centre at −30 and is 10 wide. Height: centre Y = bottom + half height.', ta: 'விளிம்புகளை மையங்களாக மாற்றுங்கள்: x = −35 முதல் −25 என்றால் மையம் −30.' },
  { stage: 'BUILD', text: 'Build the part with primitives, typing exact dimensions and positions.', ta: 'சரியான அளவுகளை டைப் செய்து பாகத்தைக் கட்டுங்கள்.' },
  { stage: 'TEST', text: 'Check: each feature is scored on type, position and size. Then try the second drawing.', ta: 'ஒவ்வொரு பகுதியும் வகை, நிலை, அளவு அடிப்படையில் மதிப்பிடப்படும்.' },
];

export default function L9GeoChallenge() {
  return (
    <BuildChallenge
      id="w2-l9"
      steps={steps}
      targets={TARGETS}
      allowed={['box', 'cylinder', 'sphere', 'cone']}
      ghostDefault={false}
      drawing={(t) => <Drawing parts={t.parts} />}
      why="Drawings are a contract: a machinist builds exactly what the numbers say. Turning edge positions into centre coordinates — and checking proportions — is the core skill of recreating any dimensioned part."
      hints={[{ en: 'The upright spans x = −35…−25 and y = 10…50, so its centre is (−30, 30, 0).', ta: 'நிமிர்ந்த பகுதி x = −35…−25, y = 10…50; மையம் (−30, 30, 0).' }]}
    />
  );
}
