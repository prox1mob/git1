import { WORLDS } from '../worlds/meta';
import { READY } from '../worlds/ready';
import { navigate } from '../lib/router';

type St = 'done' | 'partial' | 'planned';
const FEATURES: { area: string; items: [string, St, string?][] }[] = [
  {
    area: 'Interactive 3D editor',
    items: [
      ['Orbit / pan / zoom camera (touch, mouse)', 'done'],
      ['Front, top, side (orthographic) and perspective views', 'done'],
      ['Selection, move / rotate / scale gizmos', 'done'],
      ['Touch gestures: drag to move, pinch to scale, twist to rotate', 'done'],
      ['Primitive creation: box, sphere, cylinder, cone, prism, torus', 'done'],
      ['Duplicate, delete, group / ungroup, object hierarchy', 'done'],
      ['Undo / redo (100 steps)', 'done'],
      ['Grid snapping (move, rotate, scale)', 'done'],
      ['Numerical position, rotation and dimensions with unit selection', 'done'],
      ['Material presets and PBR sliders', 'done'],
      ['Basic lighting controls (sun direction, intensity, ambient, shadows)', 'done'],
      ['Non-destructive Boolean union / subtract / intersect (three-bvh-csg mesh booleans)', 'done'],
      ['Save / load projects locally (IndexedDB), versions, thumbnails', 'done'],
      ['Export GLB, glTF, binary STL', 'done'],
      ['STEP export', 'planned', 'Requires a B-rep CAD kernel (e.g. OpenCascade). Not included: meshes cannot be turned into true STEP solids.'],
      ['Stylus input', 'partial', 'Pen works through standard pointer events (sketching, dragging); pressure is not used.'],
    ],
  },
  {
    area: 'Sketch-to-3D',
    items: [
      ['Draw polygon profiles by tapping, or freehand with finger / stylus (auto-simplified)', 'done'],
      ['Closed-profile and self-intersection validation', 'done'],
      ['Holes (inner profiles) and live extrusion', 'done'],
      ['Edit sketch vertices and watch the 3D model update', 'done'],
      ['Revolve (lathe) from the sketch (unlockable)', 'done'],
      ['Automatic reconstruction of freeform perspective sketches', 'planned', 'Ambiguous by nature; manual modelling is required.'],
    ],
  },
  {
    area: 'Engineering & simulation',
    items: [
      ['2D geometric constraint solver with DOF, conflict and redundancy analysis', 'done'],
      ['Mesh Booleans, patterns, parametric feature history', 'done', 'Mesh-based (three-bvh-csg), not a B-rep kernel: no edge-by-edge fillets or STEP.'],
      ['Involute gear generation with correct meshing', 'done'],
      ['Rigid-body physics demos (Rapier): gravity, balance, friction, torque, stacking', 'done', 'Simplified teaching models, clearly labelled.'],
      ['3D-print analysis: overhangs, supports, slicing, infill, watertightness', 'done', 'Geometric checks only; validate with your machine and slicer.'],
      ['Finite-element stress analysis', 'planned', 'Beam formulas are used instead; FEA would need a solver library.'],
    ],
  },
  {
    area: 'Game systems',
    items: [
      ['XP, ranks and level progression', 'done'],
      ['Beginner / Intermediate / Advanced tolerances', 'done'],
      ['Structured feedback after every challenge (correct, incorrect, why, visual correction, suggestion)', 'done'],
      ['Optional hints (+20% XP for hint-free clears)', 'done'],
      ['Achievement badges and skill radar', 'done'],
      ['Unlockable tools', 'done'],
      ['Daily 3D challenge (seeded by date)', 'done'],
      ['Personal gallery with before / after comparison', 'done'],
      ['Project portfolio (printable)', 'done'],
      ['Optional Tamil explanations', 'done'],
      ['Cloud sync / accounts', 'planned', 'Progress is stored on this device only.'],
      ['Offline install cache (service worker)', 'planned', 'The app runs without a network once loaded, but is not yet cached for a cold offline start.'],
    ],
  },
];

export default function Status() {
  const total = WORLDS.reduce((s, w) => s + w.levels.length, 0);
  const ready = WORLDS.reduce((s, w) => s + w.levels.filter((l) => READY.has(l.id)).length, 0);
  return (
    <div className="page">
      <button className="btn small" onClick={() => navigate('/')}>
        ← Home
      </button>
      <h1 style={{ marginTop: 12 }}>Build status</h1>
      <p className="muted">
        Everything marked <span className="tag done">done</span> is implemented and works. <span className="tag planned">planned</span> items are designed but not built, and are never shown as working buttons. {ready}/{total} levels are playable.
      </p>
      <div className="grid cols-2">
        {WORLDS.map((w) => {
          const r = w.levels.filter((l) => READY.has(l.id)).length;
          return (
            <div className="card" key={w.n}>
              <b>
                World {String(w.n).padStart(2, '0')} · {w.title}
              </b>{' '}
              <span className={`tag ${r === w.levels.length ? 'ready' : r ? 'partial' : 'planned'}`}>
                {r}/{w.levels.length}
              </span>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
                {w.levels.map((l) => (
                  <li key={l.id} className={READY.has(l.id) ? '' : 'muted'}>
                    {l.title} {READY.has(l.id) ? '✓' : '— planned'}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {FEATURES.map((f) => (
        <div key={f.area}>
          <h2 style={{ marginTop: 20 }}>{f.area}</h2>
          <div className="card">
            {f.items.map(([name, st, note]) => (
              <div key={name} style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                <span className={`tag ${st === 'done' ? 'done' : st}`} style={{ alignSelf: 'flex-start', minWidth: 64, textAlign: 'center' }}>
                  {st}
                </span>
                <span>
                  {name}
                  {note && <div className="muted" style={{ fontSize: 12 }}>{note}</div>}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <h2 style={{ marginTop: 20 }}>Performance limits</h2>
      <div className="card muted" style={{ fontSize: 14 }}>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>The editor is designed for up to ~150 objects; the triangle count is shown in the status bar. Above ~500k triangles, mid-range Android tablets will slow down.</li>
          <li>Boolean operations are mesh-based (BVH CSG). They are exact for closed primitives but can take a second or more on dense meshes and may fail on non-watertight input.</li>
          <li>Physics demos use the Rapier rigid-body engine with simplified materials. They teach intuition and are not engineering validation.</li>
          <li>Storage uses the browser (IndexedDB / localStorage). Clearing site data erases projects — export important models.</li>
        </ul>
      </div>
    </div>
  );
}
