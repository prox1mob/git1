import { useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { CadSketch, useSketchHistory, type CadTool } from '../../components/sketch/CadSketch';
import { PLANE_INFO, PlaneQuad, SketchOnPlane, type PlaneName } from '../../components/sketch/SketchPlane3D';
import { Seg, Task } from '../../components/ui';
import { analyse, closedLoops, emptySketch, removeEntity } from '../../lib/cad/sketch';
import type { Feedback, LessonStep } from '../../lib/types';

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Every CAD model starts with a flat sketch drawn on a plane. Three planes meet at the origin: Front (XY), Top (XZ) and Right (YZ).', ta: 'ஒவ்வொரு CAD மாதிரியும் ஒரு தளத்தில் வரையப்பட்ட தட்டையான வரைவில் தொடங்குகிறது.' },
  { stage: 'TOUCH', text: 'Tap a plane in the 3D view (or use the buttons) to choose where to sketch. Your drawing appears on that plane in 3D.', ta: '3D காட்சியில் ஒரு தளத்தைத் தட்டித் தேர்ந்தெடுங்கள்.' },
  { stage: 'EXPERIMENT', text: 'Line: tap corners one by one; tap an existing point to close the shape. Rectangle and circle: drag. Arc: tap centre, start, then end (counter-clockwise).', ta: 'Line: மூலைகளைத் தட்டுங்கள். Rectangle, circle: இழுங்கள். Arc: மையம், தொடக்கம், முடிவு.' },
  { stage: 'UNDERSTAND', text: 'Nearly horizontal or vertical lines snap and get an H or V constraint automatically — that is CAD “design intent”. Blue lines can still move; white ones are fully defined.', ta: 'கிட்டத்தட்ட கிடைமட்ட/செங்குத்துக் கோடுகள் தானாக H அல்லது V கட்டுப்பாடு பெறும்.' },
  { stage: 'BUILD', text: 'Task: on the TOP plane, sketch a rectangle, a circle, an arc and a closed triangle made with the line tool.', ta: 'பணி: TOP தளத்தில் ஒரு செவ்வகம், வட்டம், வில், மற்றும் மூடிய முக்கோணம் வரையுங்கள்.' },
];

export default function L1Sketch() {
  const h = useSketchHistory(emptySketch());
  const [tool, setTool] = useState<CadTool>('rect');
  const [plane, setPlane] = useState<PlaneName>('front');
  const [sel, setSel] = useState<string[]>([]);
  const info = analyse(h.sk);
  const { loops } = closedLoops(h.sk);
  const lineLoops = loops.filter((l) => l.length !== 48);
  const hasRect = lineLoops.some((l) => l.length === 4);
  const hasTri = lineLoops.some((l) => l.length === 3);
  const hasCircle = h.sk.entities.some((e) => e.kind === 'circle');
  const hasArc = h.sk.entities.some((e) => e.kind === 'arc');
  const onTop = plane === 'top';

  const evaluate = (): Feedback => {
    const checks: [boolean, string, string][] = [
      [onTop, 'Sketching on the Top plane.', `You are on the ${PLANE_INFO[plane].label}. The task asks for the Top plane (XZ) — the floor.`],
      [hasRect, 'Closed rectangle.', 'No closed four-sided shape yet — use the Rect tool.'],
      [hasCircle, 'Circle.', 'No circle yet.'],
      [hasArc, 'Arc.', 'No arc yet — tap centre, start, end.'],
      [hasTri, 'Closed triangle made of three lines.', 'No closed three-sided shape — with the Line tool, tap three corners, then tap the first point again.'],
    ];
    return {
      score: Math.round((checks.filter((c) => c[0]).length / checks.length) * 100),
      correct: checks.filter((c) => c[0]).map((c) => c[1]),
      issues: checks.filter((c) => !c[0]).map((c) => ({ label: c[2] })),
      why: 'Choosing the right sketch plane decides which way a part will grow when you extrude it: a sketch on the Top plane grows upward, on the Front plane it grows towards you. Closed shapes are what become solids.',
      suggestion: hasTri ? 'Rotate the 3D view and confirm the sketch lies flat on the floor (Top plane).' : 'To close a shape with the Line tool, finish by tapping exactly on your first point — it turns into a closed loop.',
      canShowCorrection: false,
    };
  };

  return (
    <LevelShell
      id="w3-l1"
      steps={steps}
      evaluate={evaluate}
      onRetry={() => h.reset(emptySketch())}
      hints={[{ en: 'Change the plane first (button “Top”), then draw. Changing the plane later keeps the drawing but moves it onto the new plane.', ta: 'முதலில் தளத்தை மாற்றுங்கள் (Top), பிறகு வரையுங்கள்.' }]}
      viewport={
        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', display: 'flex', minHeight: 260, flexDirection: 'column' }}>
            <div className="toolbar">
              <Seg
                value={tool}
                onChange={(t) => setTool(t)}
                options={[
                  { v: 'select', label: '✋ Select' },
                  { v: 'line', label: '╱ Line' },
                  { v: 'rect', label: '▭ Rect' },
                  { v: 'circle', label: '◯ Circle' },
                  { v: 'arc', label: '◠ Arc' },
                ]}
              />
              <button className="btn small icon" onClick={h.undo} disabled={!h.canUndo} title="Undo">
                ↶
              </button>
              <button className="btn small icon" onClick={h.redo} disabled={!h.canRedo} title="Redo">
                ↷
              </button>
              <button className="btn small" disabled={!sel.some((id) => h.sk.entities.some((e) => e.id === id))} onClick={() => { let s = h.sk; sel.forEach((id) => (s = removeEntity(s, id))); h.change(s, true); setSel([]); }}>
                🗑
              </button>
            </div>
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              <CadSketch sketch={h.sk} onChange={h.change} tool={tool} selection={sel} onSelect={setSel} info={info} extent={80} center={[0, 0]} />
            </div>
          </div>
          <div style={{ flex: '1 1 260px', display: 'flex', minHeight: 240 }}>
            <Stage3D fit={110} camera={[150, 130, 180]} showViews={false} axes={70} grid={false} shadows={false}>
              {(['front', 'top', 'right'] as PlaneName[]).map((p) => (
                <PlaneQuad key={p} plane={p} active={p === plane} onPick={() => setPlane(p)} />
              ))}
              <SketchOnPlane sketch={h.sk} plane={plane} />
            </Stage3D>
          </div>
        </div>
      }
    >
      <div>
        <div className="lbl">Sketch plane</div>
        <Seg value={plane} onChange={setPlane} options={[{ v: 'front', label: 'Front XY' }, { v: 'top', label: 'Top XZ' }, { v: 'right', label: 'Right YZ' }]} />
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {PLANE_INFO[plane].label}: {PLANE_INFO[plane].axes}
        </div>
      </div>
      <div className="card" style={{ padding: 10 }}>
        <Task ok={onTop}>Use the Top plane</Task>
        <Task ok={hasRect}>A rectangle</Task>
        <Task ok={hasCircle}>A circle</Task>
        <Task ok={hasArc}>An arc</Task>
        <Task ok={hasTri}>A closed triangle with the Line tool</Task>
      </div>
      <div className="muted" style={{ fontSize: 13 }}>
        {h.sk.entities.length} shapes · {h.sk.points.length} points · {h.sk.constraints.length} automatic constraints
      </div>
    </LevelShell>
  );
}
