import { useMemo, useRef, useState } from 'react';
import { SketchText, SketchView, usePx } from '../components/sketch/SketchView';
import { Stage3D } from '../components/Stage3D';
import { ObjectMesh } from '../components/three/ObjectMesh';
import { Seg, Slider, T, Toggle } from '../components/ui';
import { checkProfiles, circlePoly, rectPoly, simplify, area, perimeter, type Loop } from '../lib/poly';
import { makeObject, objectVolume, type SceneObject } from '../lib/shapes';
import { fmt, snap as snapTo, uid } from '../lib/math';
import { sendToEditor } from '../lib/storage';
import { navigate } from '../lib/router';
import { toolUnlocked, useProgress } from '../store/progress';
import { toast } from '../store/toast';
import type { Vec2 } from '../lib/types';

type Tool = 'poly' | 'free' | 'rect' | 'circle' | 'edit';

const STARTER: Loop[] = [
  {
    id: 'a',
    hole: false,
    pts: [
      [-40, 0],
      [40, 0],
      [40, 20],
      [10, 50],
      [-10, 50],
      [-40, 20],
    ],
  },
];

function Handle({ p, active, onDown }: { p: Vec2; active?: boolean; onDown: (e: React.PointerEvent) => void }) {
  const r = usePx(9);
  return <circle cx={p[0]} cy={p[1]} r={active ? r * 1.25 : r} fill={active ? '#f8961e' : '#0e141b'} stroke="#f8961e" strokeWidth={usePx(2)} onPointerDown={onDown} style={{ cursor: 'grab' }} />;
}

export default function SketchStudio() {
  const progress = useProgress();
  const unlocked = toolUnlocked('sketch3d', progress);
  const latheOk = toolUnlocked('lathe', progress);
  const [loops, setLoops] = useState<Loop[]>(STARTER);
  const [history, setHistory] = useState<Loop[][]>([]);
  const [tool, setTool] = useState<Tool>('edit');
  const [holeMode, setHoleMode] = useState(false);
  const [draft, setDraft] = useState<Vec2[]>([]);
  const [drag, setDrag] = useState<{ loop: string; idx: number } | null>(null);
  const [depth, setDepth] = useState(20);
  const [bevel, setBevel] = useState(0);
  const [mode3d, setMode3d] = useState<'extrude' | 'revolve'>('extrude');
  const [snapOn, setSnapOn] = useState(true);
  const [plane, setPlane] = useState<'front' | 'floor'>('front');
  const start = useRef<Vec2 | null>(null);

  const check = useMemo(() => checkProfiles(loops), [loops]);
  const sn = (p: Vec2): Vec2 => (snapOn ? [snapTo(p[0], 1), snapTo(p[1], 1)] : p);
  const commit = (next: Loop[]) => {
    setHistory((h) => [...h.slice(-50), loops]);
    setLoops(next);
  };
  const addLoop = (pts: Vec2[]) => {
    if (pts.length < 3) return;
    commit([...loops, { id: uid(), pts, hole: holeMode }]);
  };

  const objects: SceneObject[] = useMemo(() => {
    if (!check.ok) return [];
    if (mode3d === 'revolve') {
      const o = check.solids[0].outline;
      if (o.some((p) => p[0] < -0.01)) return [];
      return [
        makeObject('lathe', {
          name: 'Revolved sketch',
          lathe: { profile: o.map((p) => [p[0], p[1]] as Vec2).concat([o[0]]), angle: 360, segments: 64 },
          material: { preset: 'abs', color: '#f8961e', roughness: 0.4, metalness: 0, opacity: 1 },
        }),
      ];
    }
    return check.solids.map((s, i) =>
      makeObject('extrusion', {
        name: `Sketch extrusion ${i + 1}`,
        extrusion: { outline: s.outline, holes: s.holes, depth, bevel },
        rotation: plane === 'floor' ? [-Math.PI / 2, 0, 0] : [0, 0, 0],
        position: plane === 'floor' ? [0, depth / 2, 0] : [0, 0, 0],
        material: { preset: 'abs', color: '#4cc9f0', roughness: 0.4, metalness: 0, opacity: 1 },
      }),
    );
  }, [check, depth, bevel, mode3d, plane]);

  const revolveBad = mode3d === 'revolve' && check.ok && check.solids[0].outline.some((p) => p[0] < -0.01);

  if (!unlocked) {
    return (
      <div className="page">
        <h2>🔒 Sketch-to-3D Studio</h2>
        <p className="muted">Unlocks after World 01 · Level 3 “Orthographic Views”, because reading flat views is the first step to drawing them. You can also enable Explorer mode in Settings.</p>
        <button className="btn primary" onClick={() => navigate('/level/w1-l3')}>
          Go to Orthographic Views
        </button>
      </div>
    );
  }

  const onDown = ({ pt }: { pt: Vec2 }) => {
    const p = sn(pt);
    if (tool === 'poly') {
      if (draft.length >= 3 && Math.hypot(p[0] - draft[0][0], p[1] - draft[0][1]) < 4) {
        addLoop(draft);
        setDraft([]);
      } else setDraft([...draft, p]);
    } else if (tool === 'free') {
      setDraft([pt]);
    } else if (tool === 'rect' || tool === 'circle') {
      start.current = p;
      setDraft([p, p]);
    }
  };
  const onMove = ({ pt }: { pt: Vec2 }) => {
    if (drag) {
      const p = sn(pt);
      setLoops((ls) => ls.map((l) => (l.id === drag.loop ? { ...l, pts: l.pts.map((q, i) => (i === drag.idx ? p : q)) } : l)));
      return;
    }
    if (tool === 'free' && draft.length) setDraft([...draft, pt]);
    else if ((tool === 'rect' || tool === 'circle') && start.current) setDraft([start.current, sn(pt)]);
  };
  const onUp = () => {
    if (drag) {
      setDrag(null);
      return;
    }
    if (tool === 'free' && draft.length > 4) {
      const closedGap = Math.hypot(draft[0][0] - draft[draft.length - 1][0], draft[0][1] - draft[draft.length - 1][1]);
      let pts = simplify(draft, 1.2);
      if (pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6) pts = pts.slice(0, -1);
      if (closedGap > Math.max(12, perimeter(draft, false) * 0.15)) toast('The stroke was not closed — it was closed automatically with a straight line. Start and end near the same point for a cleaner outline.');
      addLoop(pts.map(sn));
      setDraft([]);
    } else if (tool === 'rect' && start.current && draft.length === 2) {
      const [a, b] = draft;
      if (Math.abs(a[0] - b[0]) > 1 && Math.abs(a[1] - b[1]) > 1) addLoop(rectPoly(a[0], a[1], b[0], b[1]));
      setDraft([]);
      start.current = null;
    } else if (tool === 'circle' && start.current && draft.length === 2) {
      const [c, e] = draft;
      const r = Math.hypot(e[0] - c[0], e[1] - c[1]);
      if (r > 1) addLoop(circlePoly(c[0], c[1], r, 40));
      setDraft([]);
      start.current = null;
    } else if (tool === 'free') setDraft([]);
  };

  const undo = () => {
    if (!history.length) return;
    setLoops(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  };
  const send = () => {
    if (!objects.length) return toast('Fix the sketch first.');
    sendToEditor(objects);
    const b = useProgress.getState().bump('sketches');
    if (b.length) toast('✏️ Badge unlocked: Sketch to Solid');
    navigate('/editor');
  };
  const totalArea = check.ok ? check.solids.reduce((s, x) => s + area(x.outline) - x.holes.reduce((h, p) => h + area(p), 0), 0) : 0;
  const vol = objects.reduce((s, o) => s + objectVolume(o), 0);

  return (
    <div className="level">
      <div className="levelhead">
        <button className="btn small" onClick={() => navigate('/')}>
          ←
        </button>
        <h2>Sketch-to-3D Studio</h2>
        <div style={{ flex: 1 }} />
        <Seg
          value={tool}
          onChange={(t) => {
            setTool(t);
            setDraft([]);
          }}
          options={[
            { v: 'edit', label: '✋ Edit' },
            { v: 'poly', label: '⬠ Polygon' },
            { v: 'free', label: '✍ Freehand' },
            { v: 'rect', label: '▭ Rect' },
            { v: 'circle', label: '◯ Circle' },
          ]}
        />
        <button className={`btn small ${holeMode ? 'on' : ''}`} onClick={() => setHoleMode(!holeMode)} title="New shapes become holes">
          {holeMode ? '◌ Drawing holes' : '● Drawing solids'}
        </button>
        <button className="btn small" onClick={undo} disabled={!history.length}>
          ↶ Undo
        </button>
        <button className="btn small danger" onClick={() => commit([])}>
          Clear
        </button>
      </div>
      <div className="levelbody">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, display: 'flex', minHeight: 0, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 320px', display: 'flex', minHeight: 260, borderRight: '1px solid var(--border)' }}>
              <SketchView extent={80} center={[0, 25]} onDown={onDown} onMove={onMove} onUp={onUp}>
                {loops.map((l, li) => (
                  <g key={l.id}>
                    <polygon
                      points={l.pts.map((p) => p.join(',')).join(' ')}
                      fill={l.hole ? 'rgba(248,81,73,0.12)' : 'rgba(76,201,240,0.18)'}
                      stroke={check.ok ? (l.hole ? '#ff8a80' : '#4cc9f0') : '#f85149'}
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                      strokeDasharray={l.hole ? '6 4' : undefined}
                    />
                    <SketchText x={l.pts[0][0]} y={l.pts[0][1] + 4} color="#8d9aa8" size={11}>
                      {l.hole ? `hole ${li + 1}` : `shape ${li + 1}`}
                    </SketchText>
                    {tool === 'edit' &&
                      l.pts.map((p, i) => (
                        <Handle
                          key={i}
                          p={p}
                          active={drag?.loop === l.id && drag.idx === i}
                          onDown={(e) => {
                            e.stopPropagation();
                            (e.target as Element).setPointerCapture?.(e.pointerId);
                            setHistory((h) => [...h.slice(-50), loops]);
                            setDrag({ loop: l.id, idx: i });
                          }}
                        />
                      ))}
                  </g>
                ))}
                {draft.length > 0 && tool === 'rect' && draft.length === 2 && <polygon points={rectPoly(draft[0][0], draft[0][1], draft[1][0], draft[1][1]).map((p) => p.join(',')).join(' ')} fill="none" stroke="#f8961e" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
                {draft.length === 2 && tool === 'circle' && <circle cx={draft[0][0]} cy={draft[0][1]} r={Math.hypot(draft[1][0] - draft[0][0], draft[1][1] - draft[0][1])} fill="none" stroke="#f8961e" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
                {draft.length > 0 && (tool === 'poly' || tool === 'free') && <polyline points={draft.map((p) => p.join(',')).join(' ')} fill="none" stroke="#f8961e" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
                {tool === 'poly' && draft.length > 0 && <circle cx={draft[0][0]} cy={draft[0][1]} r={3} fill="#3fb950" />}
                {mode3d === 'revolve' && <line x1={0} y1={-500} x2={0} y2={500} stroke="#f8961e" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" strokeWidth={2} />}
              </SketchView>
            </div>
            <div style={{ flex: '1 1 320px', display: 'flex', minHeight: 260 }}>
              <Stage3D fit={130} camera={[140, 120, 230]} target={[0, 25, 0]} showViews={false} env axes={30}>
                {objects.map((o) => (
                  <ObjectMesh key={o.id} o={o} edges />
                ))}
              </Stage3D>
            </div>
          </div>
        </div>
        <aside className="side">
          <div className="stepcard">
            <div className="stagelbl">FROM 2D TO 3D</div>
            <T
              en="Industrial designers start with side views (elevations) and silhouettes. A closed outline + a depth = a solid. Edit the outline and the 3D model updates instantly — the sketch drives the geometry."
              ta="தொழில்துறை வடிவமைப்பாளர்கள் பக்கக் காட்சிகளிலிருந்து தொடங்குகிறார்கள். மூடிய வரைவு + ஆழம் = திடப்பொருள். வரைவை மாற்றினால் 3D உடனே மாறும்."
            />
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            {tool === 'poly' && 'Tap to place corners. Tap the green first point to close the shape.'}
            {tool === 'free' && 'Draw a closed loop with your finger or stylus. It is simplified into a clean polygon.'}
            {tool === 'rect' && 'Drag from one corner to the opposite corner.'}
            {tool === 'circle' && 'Drag from the centre outwards.'}
            {tool === 'edit' && 'Drag the orange corner points. Switch “Drawing holes” on to cut openings.'}
          </div>
          {check.ok ? (
            <div className="note" style={{ borderColor: '#2f6b3d', color: '#9fe3b1' }}>
              ✓ Valid closed profile{check.solids.length > 1 ? 's' : ''} · area {fmt(totalArea / 100, 1)} cm² · volume {fmt(vol / 1000, 1)} cm³
            </div>
          ) : (
            <div className="note warn">
              {check.errors.map((e, i) => (
                <div key={i}>⚠ {e}</div>
              ))}
            </div>
          )}
          <Toggle checked={snapOn} onChange={setSnapOn} label="Snap points to 1 mm" />
          <div className="field">
            <span className="lbl">3D operation</span>
            <Seg
              value={mode3d}
              onChange={(m) => {
                if (m === 'revolve' && !latheOk) return toast('🔒 Revolve unlocks after CAD Workshop · Revolve (or Explorer mode).');
                setMode3d(m);
              }}
              options={[
                { v: 'extrude', label: 'Extrude' },
                { v: 'revolve', label: `${latheOk ? '' : '🔒 '}Revolve` },
              ]}
            />
          </div>
          {mode3d === 'extrude' ? (
            <>
              <Slider label="Extrusion depth" value={depth} min={1} max={120} step={1} unit="mm" onChange={setDepth} />
              <Slider label="Edge rounding (bevel)" value={bevel} min={0} max={Math.min(8, depth / 2 - 0.5)} step={0.5} unit="mm" onChange={setBevel} />
              <div className="field">
                <span className="lbl">Place on</span>
                <Seg value={plane} onChange={setPlane} options={[{ v: 'front', label: 'Front plane (standing)' }, { v: 'floor', label: 'Floor (lying flat)' }]} />
              </div>
            </>
          ) : (
            <div className="note">{revolveBad ? '⚠ For a revolve, keep the whole outline on the right of the orange axis (X ≥ 0).' : 'The outline spins 360° around the orange Y axis — like a potter’s wheel.'}</div>
          )}
          <button className="btn primary" onClick={send} disabled={!objects.length}>
            Send to 3D editor →
          </button>
          <div className="note">
            <b>Honest limits:</b> this studio turns clean, closed outlines into extrusions and revolves. A freeform perspective sketch is ambiguous — many 3D shapes produce the same drawing — so real products are rebuilt manually from several views and sections.
          </div>
        </aside>
      </div>
    </div>
  );
}
