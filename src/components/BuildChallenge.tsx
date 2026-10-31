import { useMemo, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { LevelShell, type Hint } from './LevelShell';
import { MiniEditor } from './editor/MiniEditor';
import { Hierarchy, Inspector } from './editor/panels';
import { Arrow3D, Ghost, Label, ObjectMesh } from './three/ObjectMesh';
import { Toggle } from './ui';
import { createEditorStore, EditorContext, flattenWorld } from '../store/editorStore';
import { objectBox, type PrimType, type SceneObject } from '../lib/shapes';
import { matchFeedback, matchParts } from '../lib/matching';
import { absTol, relTol } from '../lib/math';
import { useSettings, type RecordOutcome } from '../store/progress';
import type { Feedback, LessonStep, Vec3 } from '../lib/types';

export interface BuildTarget {
  name: string;
  blurb: string;
  parts: SceneObject[];
}

interface Props {
  id: string;
  steps: LessonStep[];
  targets: BuildTarget[];
  allowed?: PrimType[];
  why: string;
  hints?: Hint[];
  recorder?: (score: number, hints: number) => RecordOutcome;
  title?: ReactNode;
  backTo?: string;
  drawing?: (t: BuildTarget) => ReactNode;
  ghostDefault?: boolean;
  showReference?: boolean;
  fit?: number;
}

const centre = (o: SceneObject): Vec3 => {
  const c = new THREE.Vector3();
  objectBox(o).getCenter(c);
  return [c.x, c.y, c.z];
};

export function BuildChallenge({ id, steps, targets, allowed, why, hints, recorder, title, backTo, drawing, ghostDefault = true, showReference = true, fit = 140 }: Props) {
  const store = useMemo(() => createEditorStore({ snapMove: 1, snapRot: 15 }), []);
  const objects = store((s) => s.objects);
  const settings = useSettings();
  const [ti, setTi] = useState(0);
  const [ghost, setGhost] = useState(ghostDefault && settings.difficulty !== 'advanced');
  const [corr, setCorr] = useState(false);
  const target = targets[ti];
  const pt = absTol(settings.difficulty) * 1.5;
  const rt = relTol(settings.difficulty) * 1.5;
  const refX = -(fit * 1.1);

  const evaluate = (): Feedback | string => {
    const user = flattenWorld(objects);
    if (!user.length) return 'Add some shapes first.';
    const m = matchParts(target.parts, user, pt, rt);
    return matchFeedback(m, pt, rt, why);
  };

  const m = corr ? matchParts(target.parts, flattenWorld(objects), pt, rt) : null;

  return (
    <EditorContext.Provider value={store}>
      <LevelShell
        id={id}
        title={title}
        backTo={backTo}
        recorder={recorder}
        steps={steps}
        viewport={
          <MiniEditor allowed={allowed} fit={fit} camera={[fit * 0.2, fit * 0.9, fit * 1.6]} target={[showReference ? refX / 2 : 0, fit * 0.25, 0]}>
            {showReference && (
              <group position={[refX, 0, 0]}>
                {target.parts.map((p) => (
                  <ObjectMesh key={p.id} o={{ ...p, material: { ...p.material, opacity: 0.85 } }} castShadow={false} edges />
                ))}
                <Label position={[0, -6, 30]} color="#ffd166">
                  Reference: {target.name}
                </Label>
              </group>
            )}
            {(ghost || corr) && target.parts.map((p) => <Ghost key={p.id} o={p} color={corr && m?.missing.includes(p) ? '#f85149' : '#ffd166'} />)}
            {m?.pairs.map((p) => (p.posErr > pt ? <Arrow3D key={p.t.id} from={centre(p.u)} to={centre(p.t)} /> : null))}
          </MiniEditor>
        }
        evaluate={evaluate}
        onCorrection={setCorr}
        onRetry={() => store.getState().setObjects([])}
        hints={hints}
      >
        {targets.length > 1 && (
          <div className="field">
            <label>Target</label>
            <select
              value={ti}
              onChange={(e) => {
                setTi(parseInt(e.target.value, 10));
                setCorr(false);
              }}
            >
              {targets.map((t, i) => (
                <option key={t.name} value={i}>
                  {t.name} ({t.parts.length} parts)
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="note">{target.blurb}</div>
        {drawing?.(target)}
        <Toggle checked={ghost} onChange={setGhost} label="Show target ghost in place" />
        <div className="card" style={{ padding: 10 }}>
          <h3>Selected</h3>
          <Inspector unit="mm" showMaterial={false} />
        </div>
        <details>
          <summary className="muted" style={{ cursor: 'pointer' }}>
            Objects ({objects.length})
          </summary>
          <Hierarchy />
        </details>
      </LevelShell>
    </EditorContext.Provider>
  );
}
