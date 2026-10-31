import { useMemo } from 'react';
import * as THREE from 'three';
import { useEd, useEditorStore } from '../../store/editorStore';
import { DIM_LABELS, objectArea, objectSize, objectVolume, PRIM_LABEL, type PrimType, type SceneObject } from '../../lib/shapes';
import { MATERIALS, MATERIAL_CATEGORIES, materialById } from '../../lib/materials';
import { NumberField, Seg, Slider, Toggle } from '../ui';
import { DEG, fmt, fromUnit, toUnit, type LengthUnit } from '../../lib/math';
import { toolUnlocked, useProgress } from '../../store/progress';
import type { Vec3 } from '../../lib/types';
import { toast } from '../../store/toast';

const ICON: Partial<Record<PrimType, string>> = { box: '■', sphere: '●', cylinder: '▮', cone: '▲', prism: '⬟', torus: '◎', group: '▣', extrusion: '⬢', lathe: '⚱', csg: '⊖' };

export function AddPrimitiveButtons({ allowed }: { allowed?: PrimType[] }) {
  const add = useEd((s) => s.add);
  const progress = useProgress();
  const adv = toolUnlocked('adv-primitives', progress);
  const list: PrimType[] = allowed ?? ['box', 'sphere', 'cylinder', 'cone', 'prism', 'torus'];
  return (
    <>
      {list.map((t) => {
        const locked = !allowed && !adv && (t === 'cone' || t === 'prism' || t === 'torus');
        return (
          <button
            key={t}
            className="btn small"
            title={locked ? 'Unlocks after World 01 · Level 2' : `Add ${PRIM_LABEL[t]}`}
            onClick={() => (locked ? toast('🔒 Cone, prism and torus unlock after “The Shape Playground” (or turn on Explorer mode).') : add(t))}
            style={locked ? { opacity: 0.5 } : undefined}
          >
            {locked ? '🔒' : ICON[t]} {PRIM_LABEL[t].split(' ')[0]}
          </button>
        );
      })}
    </>
  );
}

export function EditToolbar({ booleans = false, grouping = true }: { booleans?: boolean; grouping?: boolean }) {
  const store = useEditorStore();
  const s = useEd((x) => x);
  const progress = useProgress();
  const csgOk = toolUnlocked('csg', progress);
  const selObjs = s.objects.filter((o) => s.selected.includes(o.id));
  const sel = selObjs.length;
  const isGroup = sel === 1 && selObjs[0].type === 'group';
  const isCsg = sel === 1 && selObjs[0].type === 'csg';
  const bool = (op: 'union' | 'subtract' | 'intersect') => {
    if (!csgOk) return toast('🔒 Boolean tools unlock after CAD Workshop · Boolean Operations (or Explorer mode).');
    if (sel !== 2) return toast('Select exactly two objects (turn on Multi-select). The first one selected is kept, the second is the tool.');
    const id = store.getState().boolean(op);
    if (!id) toast('Both objects must be solids (not groups) at the same level of the hierarchy.');
  };
  return (
    <>
      <div className="seg">
        <button className={`btn small ${s.touchMode === 'gizmo' && s.mode === 'translate' ? 'on' : ''}`} onClick={() => s.set({ mode: 'translate', touchMode: 'gizmo' })} title="Move gizmo (W)">
          ✥ Move
        </button>
        <button className={`btn small ${s.touchMode === 'gizmo' && s.mode === 'rotate' ? 'on' : ''}`} onClick={() => s.set({ mode: 'rotate', touchMode: 'gizmo' })} title="Rotate gizmo (E)">
          ⟲ Rotate
        </button>
        <button className={`btn small ${s.touchMode === 'gizmo' && s.mode === 'scale' ? 'on' : ''}`} onClick={() => s.set({ mode: 'scale', touchMode: 'gizmo' })} title="Scale gizmo (R)">
          ⤢ Scale
        </button>
        <button className={`btn small ${s.touchMode === 'drag' ? 'on' : ''}`} onClick={() => s.set({ touchMode: s.touchMode === 'drag' ? 'gizmo' : 'drag' })} title="Touch gestures: drag to move, pinch to scale, twist to rotate">
          ☝ Gestures
        </button>
      </div>
      {s.touchMode === 'drag' && (
        <Seg
          value={s.dragAxis}
          onChange={(a) => s.set({ dragAxis: a })}
          options={[
            { v: 'xz', label: 'Floor' },
            { v: 'x', label: 'X', cls: 'x' },
            { v: 'y', label: 'Y', cls: 'y' },
            { v: 'z', label: 'Z', cls: 'z' },
          ]}
        />
      )}
      <button className={`btn small ${s.space === 'local' ? 'on' : ''}`} onClick={() => s.set({ space: s.space === 'world' ? 'local' : 'world' })} title="Gizmo axes: world or the object's own (local) axes">
        {s.space === 'world' ? '🌐 World' : '📦 Local'}
      </button>
      <button className={`btn small ${s.snap ? 'on' : ''}`} onClick={() => s.set({ snap: !s.snap })} title="Grid snapping">
        🧲 Snap {s.snap ? `${s.snapMove}mm/${s.snapRot}°` : 'off'}
      </button>
      <span className="divider" />
      <button className="btn small icon" onClick={s.undo} disabled={!s.past.length} title="Undo (Ctrl+Z)">
        ↶
      </button>
      <button className="btn small icon" onClick={s.redo} disabled={!s.future.length} title="Redo (Ctrl+Y)">
        ↷
      </button>
      <button className="btn small" onClick={() => s.duplicate()} disabled={!sel} title="Duplicate (Ctrl+D)">
        ⧉ Duplicate
      </button>
      <button className="btn small" onClick={() => s.remove()} disabled={!sel} title="Delete">
        🗑
      </button>
      <button className="btn small" onClick={() => s.dropToFloor()} disabled={!sel} title="Sit the selected objects on the floor (Y = 0)">
        ⤓ Floor
      </button>
      <button className={`btn small ${s.multi ? 'on' : ''}`} onClick={() => s.set({ multi: !s.multi })} title="Multi-select by tapping (or hold Shift)">
        ☑ Multi
      </button>
      {grouping && (
        <>
          <button className="btn small" disabled={sel < 2} onClick={() => !s.group() && toast('Grouped objects must share the same parent.')}>
            ▣ Group
          </button>
          <button className="btn small" disabled={!isGroup} onClick={s.ungroup}>
            Ungroup
          </button>
        </>
      )}
      {booleans && (
        <>
          <span className="divider" />
          <button className="btn small" onClick={() => bool('union')} title="Union: combine two solids">
            {csgOk ? '' : '🔒'}∪ Union
          </button>
          <button className="btn small" onClick={() => bool('subtract')} title="Subtract the second selected from the first">
            {csgOk ? '' : '🔒'}− Subtract
          </button>
          <button className="btn small" onClick={() => bool('intersect')} title="Keep only the overlap">
            {csgOk ? '' : '🔒'}∩ Intersect
          </button>
          <button className="btn small" disabled={!isCsg} onClick={s.splitBoolean} title="Undo a boolean non-destructively: get both solids back">
            Split
          </button>
        </>
      )}
    </>
  );
}

export function Hierarchy() {
  const objects = useEd((s) => s.objects);
  const selected = useEd((s) => s.selected);
  const select = useEd((s) => s.select);
  const update = useEd((s) => s.update);
  const rows: { o: SceneObject; depth: number }[] = [];
  const walk = (pid: string | null, depth: number) => {
    for (const o of objects.filter((x) => x.parentId === pid)) {
      rows.push({ o, depth });
      if (o.type === 'group') walk(o.id, depth + 1);
    }
  };
  walk(null, 0);
  if (!rows.length) return <p className="muted" style={{ fontSize: 13 }}>No objects yet. Add a shape from the toolbar.</p>;
  return (
    <div className="tree">
      {rows.map(({ o, depth }) => (
        <div key={o.id} className={`node ${selected.includes(o.id) ? 'sel' : ''}`} style={{ paddingLeft: 6 + depth * 16 }} onClick={(e) => select(o.id, e.shiftKey)}>
          <span style={{ width: 18, textAlign: 'center' }}>{ICON[o.type]}</span>
          <span className="nm">{o.name}</span>
          <button
            className="btn small icon ghost"
            title={o.visible ? 'Hide' : 'Show'}
            onClick={(e) => {
              e.stopPropagation();
              update(o.id, { visible: !o.visible });
            }}
          >
            {o.visible ? '👁' : '◌'}
          </button>
        </div>
      ))}
    </div>
  );
}

export function Inspector({ unit: unitProp, showMaterial = true }: { unit?: LengthUnit; showMaterial?: boolean }) {
  const store = useEditorStore();
  const objects = useEd((s) => s.objects);
  const selected = useEd((s) => s.selected);
  const progress = useProgress();
  const unit = unitProp ?? progress.settings.unit;
  const pbr = toolUnlocked('pbr', progress);
  const o = selected.length === 1 ? objects.find((x) => x.id === selected[0]) : undefined;
  const stats = useMemo(() => {
    if (!o || o.type === 'group') return null;
    try {
      return { v: objectVolume(o), a: objectArea(o), size: objectSize(o) };
    } catch {
      return null;
    }
  }, [o]);
  if (selected.length > 1) return <p className="muted">{selected.length} objects selected. Group them, duplicate them or (two solids) combine them with a Boolean.</p>;
  if (!o) return <p className="muted" style={{ fontSize: 13 }}>Tap an object to select it. Its position, rotation, dimensions and material appear here.</p>;
  const up = (p: Partial<SceneObject>) => store.getState().update(o.id, p);
  const step = unit === 'mm' ? 1 : unit === 'cm' ? 0.1 : unit === 'm' ? 0.001 : 0.05;
  const dg = unit === 'mm' ? 1 : unit === 'cm' ? 2 : unit === 'm' ? 4 : 3;
  const setAxis = (key: 'position' | 'rotation' | 'scale', i: number, v: number) => {
    const arr = [...o[key]] as Vec3;
    arr[i] = v;
    up({ [key]: arr });
  };
  const preset = materialById(o.material.preset);
  return (
    <div>
      <div className="field">
        <label>Name</label>
        <input type="text" value={o.name} onChange={(e) => store.getState().update(o.id, { name: e.target.value }, false)} />
      </div>
      <div className="lbl">
        {PRIM_LABEL[o.type]} · position ({unit})
      </div>
      {(['x', 'y', 'z'] as const).map((a, i) => (
        <NumberField key={a} axis={a} value={toUnit(o.position[i], unit)} step={step} digits={dg} onChange={(v) => setAxis('position', i, fromUnit(v, unit))} />
      ))}
      <div className="lbl" style={{ marginTop: 6 }}>
        Rotation (degrees)
      </div>
      {(['x', 'y', 'z'] as const).map((a, i) => (
        <NumberField key={a} axis={a} value={o.rotation[i] / DEG} step={5} digits={1} onChange={(v) => setAxis('rotation', i, v * DEG)} />
      ))}
      {o.type !== 'group' && Object.keys(o.dims).length > 0 && (
        <>
          <div className="lbl" style={{ marginTop: 6 }}>
            Dimensions ({unit})
          </div>
          {Object.entries(o.dims).map(([k, v]) =>
            k === 'sides' ? (
              <NumberField key={k} label={DIM_LABELS[k]} value={v} step={1} min={3} max={12} digits={0} onChange={(x) => up({ dims: { ...o.dims, sides: Math.round(x) } })} />
            ) : (
              <NumberField key={k} label={DIM_LABELS[k] ?? k} value={toUnit(v * (k === 'w' ? o.scale[0] : k === 'h' ? o.scale[1] : k === 'd' ? o.scale[2] : o.scale[0]), unit)} step={step} min={toUnit(0.5, unit)} digits={dg} onChange={(x) => up({ dims: { ...o.dims, [k]: fromUnit(x, unit) / (k === 'w' ? o.scale[0] : k === 'h' ? o.scale[1] : k === 'd' ? o.scale[2] : o.scale[0]) } })} />
            ),
          )}
        </>
      )}
      {(o.type === 'group' || o.scale.some((s) => Math.abs(s - 1) > 1e-6)) && (
        <>
          <div className="lbl" style={{ marginTop: 6 }}>
            Scale factor
          </div>
          {(['x', 'y', 'z'] as const).map((a, i) => (
            <NumberField key={a} axis={a} value={o.scale[i]} step={0.1} min={0.01} digits={3} onChange={(v) => setAxis('scale', i, v)} />
          ))}
        </>
      )}
      {stats && (
        <div className="kv" style={{ marginTop: 8 }}>
          <span>Size W×H×D</span>
          <span>
            {stats.size.map((v) => fmt(toUnit(v, unit), dg)).join(' × ')} {unit}
          </span>
          <span>Volume</span>
          <span>{fmt(stats.v / 1000, 2)} cm³</span>
          <span>Surface area</span>
          <span>{fmt(stats.a / 100, 2)} cm²</span>
        </div>
      )}
      {showMaterial && o.type !== 'group' && (
        <>
          <hr className="sep" />
          <div className="field">
            <label>Material</label>
            <select
              value={o.material.preset}
              onChange={(e) => {
                const m = materialById(e.target.value)!;
                up({ material: { preset: m.id, color: m.color, roughness: m.roughness, metalness: m.metalness, opacity: 1 } });
              }}
            >
              {MATERIAL_CATEGORIES.map((c) => (
                <optgroup key={c} label={c}>
                  {MATERIALS.filter((m) => m.category === c).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="numrow">
            <input type="color" value={o.material.color} onChange={(e) => store.getState().update(o.id, { material: { ...o.material, color: e.target.value } }, false)} onBlur={() => store.getState().checkpoint()} />
            <span className="muted" style={{ fontSize: 12 }}>
              {preset?.eng.notes}
            </span>
          </div>
          {pbr ? (
            <div style={{ marginTop: 6 }}>
              <Slider label="Roughness" value={o.material.roughness} min={0} max={1} step={0.01} onChange={(v) => store.getState().update(o.id, { material: { ...o.material, roughness: v } }, false)} />
              <Slider label="Metalness" value={o.material.metalness} min={0} max={1} step={0.01} onChange={(v) => store.getState().update(o.id, { material: { ...o.material, metalness: v } }, false)} />
              <Slider label="Opacity" value={o.material.opacity} min={0.1} max={1} step={0.01} onChange={(v) => store.getState().update(o.id, { material: { ...o.material, opacity: v } }, false)} />
            </div>
          ) : (
            <div className="note">🔒 Roughness / metalness / opacity sliders unlock after World 04 · The Material Lab.</div>
          )}
        </>
      )}
    </div>
  );
}

export function LightPanel() {
  const light = useEd((s) => s.light);
  const setLight = useEd((s) => s.setLight);
  return (
    <div>
      <Slider label="Sun direction (azimuth)" value={light.azimuth} min={0} max={360} step={1} unit="°" onChange={(v) => setLight({ azimuth: v })} />
      <Slider label="Sun height (elevation)" value={light.elevation} min={5} max={90} step={1} unit="°" onChange={(v) => setLight({ elevation: v })} />
      <Slider label="Sun intensity" value={light.intensity} min={0} max={6} step={0.1} onChange={(v) => setLight({ intensity: v })} />
      <Slider label="Ambient (sky) light" value={light.ambient} min={0} max={3} step={0.05} onChange={(v) => setLight({ ambient: v })} />
      <Toggle checked={light.shadows} onChange={(v) => setLight({ shadows: v })} label="Cast shadows" />
      <Toggle checked={light.env} onChange={(v) => setLight({ env: v })} label="Studio reflections (environment)" />
    </div>
  );
}

export function EditorLights({ extent = 200 }: { extent?: number }) {
  const light = useEd((s) => s.light);
  const az = light.azimuth * DEG,
    el = light.elevation * DEG;
  const d = extent * 1.5;
  const pos = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(d);
  return (
    <>
      <hemisphereLight args={['#dfefff', '#1a1f26', light.ambient]} />
      <directionalLight
        position={pos}
        intensity={light.intensity}
        castShadow={light.shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={1}
        shadow-camera-far={extent * 6}
        shadow-bias={-0.0004}
      />
    </>
  );
}
