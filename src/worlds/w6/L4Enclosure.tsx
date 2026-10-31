import { useMemo } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { MiniEditor } from '../../components/editor/MiniEditor';
import { Inspector } from '../../components/editor/panels';
import { Task } from '../../components/ui';
import { createEditorStore, EditorContext, flattenWorld } from '../../store/editorStore';
import { makeObject, objectSize, type SceneObject } from '../../lib/shapes';
import { byName, inside, overlaps } from '../../lib/missionChecks';
import type { Feedback, LessonStep } from '../../lib/types';

const m = (c: string, o = 1) => ({ preset: 'abs', color: c, roughness: 0.45, metalness: 0, opacity: o });
const start = (): SceneObject[] => [
  makeObject('box', { name: 'Housing', dims: { w: 70, h: 130, d: 34 }, position: [0, 65, 0], material: m('#e9edf2', 0.25) }),
  makeObject('box', { name: 'PCB', dims: { w: 56, h: 90, d: 1.6 }, position: [0, 70, 30], material: m('#2e7d32') }),
  makeObject('box', { name: 'Battery', dims: { w: 34, h: 50, d: 10 }, position: [40, 40, 0], material: m('#f8961e') }),
  makeObject('cylinder', { name: 'Camera', dims: { r: 7, h: 8 }, position: [0, 60, 10], rotation: [Math.PI / 2, 0, 0], material: m('#222') }),
  makeObject('cylinder', { name: 'Button', dims: { r: 10, h: 6 }, position: [0, 100, 18], rotation: [Math.PI / 2, 0, 0], material: m('#4cc9f0') }),
  makeObject('box', { name: 'Speaker', dims: { w: 20, h: 20, d: 6 }, position: [-20, 20, -40], material: m('#577590') }),
];

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Brief: a video doorbell. The translucent housing must hold a PCB, a battery, a camera, a speaker and a large button. Right now the parts are scattered and some stick out.', ta: 'சுருக்கம்: வீடியோ அழைப்புமணி. உறைக்குள் PCB, பேட்டரி, கேமரா, ஸ்பீக்கர், பொத்தான் இருக்க வேண்டும்.' },
  { stage: 'UNDERSTAND', text: 'Packaging is a 3D puzzle with rules: every part inside with a wall allowance, no collisions, user-facing parts (camera, button) at the front where people expect them, and the camera above the button so faces are filmed.', ta: 'பொதியிடல் விதிகள்: எல்லாம் உள்ளே, மோதல் இல்லை, கேமரா பொத்தானுக்கு மேல் முன்பக்கத்தில்.' },
  { stage: 'BUILD', text: 'Arrange the components. You may resize the housing, but keep it within 75 × 140 × 40 mm.', ta: 'கூறுகளை ஒழுங்குபடுத்துங்கள். உறை 75 × 140 × 40 mm-க்குள் இருக்க வேண்டும்.' },
];

export function packagingChecks(flat: SceneObject[]) {
  const H = byName(flat, 'Housing');
  if (!H) return [{ c: 'Keep the part named “Housing”', ok: false, note: '' }];
  const hs = objectSize(H);
  const names = ['PCB', 'Battery', 'Camera', 'Button', 'Speaker'];
  const parts = names.map((n) => byName(flat, n)).filter(Boolean) as SceneObject[];
  const out = parts.filter((p) => !inside(p, H, 1.5)).map((p) => p.name);
  const clashes: string[] = [];
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) if (overlaps(parts[i], parts[j])) clashes.push(`${parts[i].name}–${parts[j].name}`);
  const front = H.position[2] + hs[2] / 2;
  const cam = byName(flat, 'Camera'),
    btn = byName(flat, 'Button');
  const nearFront = (p?: SceneObject) => !!p && front - (p.position[2] + objectSize(p)[2] / 2) <= 4;
  return [
    { c: 'Housing within 75 × 140 × 40 mm', ok: hs[0] <= 75 && hs[1] <= 140 && hs[2] <= 40, note: hs.map((v) => Math.round(v)).join(' × ') },
    { c: 'All components inside the housing (1.5 mm wall)', ok: out.length === 0, note: out.join(', ') || 'all inside' },
    { c: 'No collisions between components', ok: clashes.length === 0, note: clashes.join(', ') || 'none' },
    { c: 'Camera and button within 4 mm of the front face', ok: nearFront(cam) && nearFront(btn), note: '' },
    { c: 'Camera above the button', ok: !!cam && !!btn && cam.position[1] > btn.position[1] + 10, note: '' },
  ];
}

export default function L4Enclosure() {
  const store = useMemo(() => createEditorStore({ objects: start(), snapMove: 1 }), []);
  const objects = store((s) => s.objects);
  const checks = packagingChecks(flattenWorld(objects));
  const evaluate = (): Feedback => ({
    score: Math.round((checks.filter((c) => c.ok).length / checks.length) * 100),
    correct: checks.filter((c) => c.ok).map((c) => c.c),
    issues: checks.filter((c) => !c.ok).map((c) => ({ label: c.c, detail: c.note })),
    why: 'Industrial designers and engineers negotiate space constantly: the outside form must stay attractive while everything inside fits, can be assembled and does its job. Packaging studies like this happen long before detailed CAD.',
    suggestion: 'Start with the biggest parts (PCB, battery), then place the user-facing parts against the front.',
    canShowCorrection: false,
  });
  return (
    <EditorContext.Provider value={store}>
      <LevelShell id="w6-l4" steps={steps} evaluate={evaluate} onRetry={() => store.getState().setObjects(start())} viewport={<MiniEditor allowed={['box', 'cylinder']} fit={150} />}>
        {checks.map((c, i) => (
          <Task key={i} ok={c.ok}>
            {c.c}
            {c.note && <div className="muted" style={{ fontSize: 12 }}>{c.note}</div>}
          </Task>
        ))}
        <div className="card" style={{ padding: 10 }}>
          <Inspector unit="mm" showMaterial={false} />
        </div>
      </LevelShell>
    </EditorContext.Provider>
  );
}
