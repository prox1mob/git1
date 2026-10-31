import { createContext, useContext } from 'react';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import * as THREE from 'three';
import { bakeScale, getGeometry, makeObject, newId, objectMatrix, PALETTE, baseOffset, type PrimType, type SceneObject } from '../lib/shapes';
import type { Vec3 } from '../lib/types';
import type { DragAxis } from '../components/three/ObjectGestures';

export type GizmoMode = 'translate' | 'rotate' | 'scale';

export interface LightSettings {
  azimuth: number; // deg
  elevation: number; // deg
  intensity: number;
  ambient: number;
  shadows: boolean;
  env: boolean;
}

export interface EditorState {
  objects: SceneObject[];
  selected: string[];
  past: SceneObject[][];
  future: SceneObject[][];
  mode: GizmoMode;
  space: 'world' | 'local';
  snap: boolean;
  snapMove: number;
  snapRot: number;
  touchMode: 'gizmo' | 'drag';
  dragAxis: DragAxis;
  multi: boolean;
  showDims: boolean;
  light: LightSettings;
  stats: { duplicates: number; rotations: number; adds: number };

  checkpoint: () => void;
  setObjects: (objs: SceneObject[], record?: boolean) => void;
  add: (type: PrimType, partial?: Partial<SceneObject>) => string;
  addObject: (o: SceneObject, record?: boolean) => void;
  update: (id: string, patch: Partial<SceneObject>, record?: boolean) => void;
  updateLive: (id: string, patch: Partial<SceneObject>) => void;
  remove: (ids?: string[]) => void;
  duplicate: (ids?: string[]) => void;
  select: (id: string | null, additive?: boolean) => void;
  group: () => string | null;
  ungroup: () => void;
  boolean: (op: 'union' | 'subtract' | 'intersect') => string | null;
  splitBoolean: () => void;
  dropToFloor: () => void;
  undo: () => void;
  redo: () => void;
  set: (p: Partial<EditorState>) => void;
  setLight: (p: Partial<LightSettings>) => void;
}

const MAX_HISTORY = 100;

export function descendants(objs: SceneObject[], id: string): string[] {
  const out: string[] = [];
  const walk = (pid: string) => {
    for (const o of objs) if (o.parentId === pid) {
      out.push(o.id);
      walk(o.id);
    }
  };
  walk(id);
  return out;
}

export function worldMatrix(objs: SceneObject[], o: SceneObject): THREE.Matrix4 {
  const m = objectMatrix(o);
  let p = o.parentId ? objs.find((x) => x.id === o.parentId) : undefined;
  while (p) {
    m.premultiply(objectMatrix(p));
    p = p.parentId ? objs.find((x) => x.id === p!.parentId) : undefined;
  }
  return m;
}

function decompose(m: THREE.Matrix4): Pick<SceneObject, 'position' | 'rotation' | 'scale'> {
  const p = new THREE.Vector3(),
    q = new THREE.Quaternion(),
    s = new THREE.Vector3();
  m.decompose(p, q, s);
  const e = new THREE.Euler().setFromQuaternion(q);
  return { position: [p.x, p.y, p.z], rotation: [e.x, e.y, e.z], scale: [s.x, s.y, s.z] };
}

/** Leaf objects (non-groups) with world transforms baked in; useful for evaluation and export. */
export function flattenWorld(objs: SceneObject[]): SceneObject[] {
  return objs
    .filter((o) => o.type !== 'group' && o.visible)
    .map((o) => ({ ...o, parentId: null, ...decompose(worldMatrix(objs, o)) }));
}

export function createEditorStore(init: Partial<Pick<EditorState, 'objects' | 'snap' | 'snapMove' | 'snapRot' | 'touchMode' | 'mode' | 'showDims'>> = {}) {
  return create<EditorState>()((set, get) => {
    const push = () => {
      const s = get();
      set({ past: [...s.past.slice(-MAX_HISTORY + 1), s.objects], future: [] });
    };
    return {
      objects: init.objects ?? [],
      selected: [],
      past: [],
      future: [],
      mode: init.mode ?? 'translate',
      space: 'world',
      snap: init.snap ?? true,
      snapMove: init.snapMove ?? 5,
      snapRot: init.snapRot ?? 15,
      touchMode: init.touchMode ?? 'gizmo',
      dragAxis: 'xz',
      multi: false,
      showDims: init.showDims ?? true,
      light: { azimuth: 40, elevation: 55, intensity: 2.2, ambient: 0.9, shadows: true, env: true },
      stats: { duplicates: 0, rotations: 0, adds: 0 },

      checkpoint: push,
      setObjects(objs, record = true) {
        if (record) push();
        set({ objects: objs, selected: get().selected.filter((id) => objs.some((o) => o.id === id)) });
      },
      add(type, partial = {}) {
        push();
        const n = get().objects.filter((o) => o.type === type).length;
        const color = PALETTE[get().objects.length % PALETTE.length];
        const o = makeObject(type, { name: `${type[0].toUpperCase()}${type.slice(1)} ${n + 1}`, ...partial });
        if (!partial.material) o.material = { ...o.material, color };
        if (!partial.position) o.position = [0, baseOffset(o), 0];
        set({ objects: [...get().objects, o], selected: [o.id], stats: { ...get().stats, adds: get().stats.adds + 1 } });
        return o.id;
      },
      addObject(o, record = true) {
        if (record) push();
        set({ objects: [...get().objects, o], selected: [o.id] });
      },
      update(id, patch, record = true) {
        if (record) push();
        const prev = get().objects.find((o) => o.id === id);
        const rotated = !!patch.rotation && !!prev && patch.rotation.some((v, i) => Math.abs(v - prev.rotation[i]) > 1e-6);
        set({
          objects: get().objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
          stats: rotated ? { ...get().stats, rotations: get().stats.rotations + 1 } : get().stats,
        });
      },
      updateLive(id, patch) {
        get().update(id, patch, false);
      },
      remove(ids) {
        const s = get();
        const sel = ids ?? s.selected;
        if (!sel.length) return;
        push();
        const all = new Set(sel.flatMap((id) => [id, ...descendants(s.objects, id)]));
        set({ objects: s.objects.filter((o) => !all.has(o.id)), selected: [] });
      },
      duplicate(ids) {
        const s = get();
        const sel = ids ?? s.selected;
        if (!sel.length) return;
        push();
        const clones: SceneObject[] = [];
        const newSel: string[] = [];
        const cloneTree = (o: SceneObject, parentId: string | null, offset: boolean) => {
          const c: SceneObject = JSON.parse(JSON.stringify(o));
          c.id = newId();
          c.parentId = parentId;
          c.name = offset ? `${o.name} copy` : o.name;
          if (offset) c.position = [o.position[0] + s.snapMove * 2, o.position[1], o.position[2] + s.snapMove * 2] as Vec3;
          clones.push(c);
          for (const ch of s.objects.filter((x) => x.parentId === o.id)) cloneTree(ch, c.id, false);
          return c.id;
        };
        for (const id of sel) {
          const o = s.objects.find((x) => x.id === id);
          if (o) newSel.push(cloneTree(o, o.parentId, true));
        }
        set({ objects: [...s.objects, ...clones], selected: newSel, stats: { ...s.stats, duplicates: s.stats.duplicates + newSel.length } });
      },
      select(id, additive) {
        const s = get();
        if (id == null) return set({ selected: [] });
        if (additive || s.multi) {
          set({ selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id] });
        } else set({ selected: [id] });
      },
      group() {
        const s = get();
        const sel = s.objects.filter((o) => s.selected.includes(o.id));
        if (sel.length < 2) return null;
        const parent = sel[0].parentId;
        if (!sel.every((o) => o.parentId === parent)) return null;
        push();
        const c = sel.reduce((a, o) => [a[0] + o.position[0], a[1] + o.position[1], a[2] + o.position[2]], [0, 0, 0]).map((v) => v / sel.length) as Vec3;
        const g = makeObject('group', { name: `Group ${s.objects.filter((o) => o.type === 'group').length + 1}`, parentId: parent, position: c });
        const ids = new Set(sel.map((o) => o.id));
        const objects = s.objects.map((o) =>
          ids.has(o.id) ? { ...o, parentId: g.id, position: [o.position[0] - c[0], o.position[1] - c[1], o.position[2] - c[2]] as Vec3 } : o,
        );
        set({ objects: [...objects, g], selected: [g.id] });
        return g.id;
      },
      ungroup() {
        const s = get();
        const g = s.objects.find((o) => o.id === s.selected[0] && o.type === 'group');
        if (!g) return;
        push();
        const gm = objectMatrix(g);
        const kids: string[] = [];
        const objects = s.objects
          .filter((o) => o.id !== g.id)
          .map((o) => {
            if (o.parentId !== g.id) return o;
            kids.push(o.id);
            const m = objectMatrix(o).premultiply(gm);
            return { ...o, parentId: g.parentId, ...decompose(m) };
          });
        set({ objects, selected: kids });
      },
      boolean(op) {
        const s = get();
        if (s.selected.length !== 2) return null;
        const [a, b] = s.selected.map((id) => s.objects.find((o) => o.id === id)!);
        if (!a || !b || a.type === 'group' || b.type === 'group' || a.parentId !== b.parentId) return null;
        push();
        const sym = op === 'union' ? '∪' : op === 'subtract' ? '−' : '∩';
        const o = makeObject('csg', {
          name: `${a.name} ${sym} ${b.name}`,
          parentId: a.parentId,
          csg: { op, a: { ...a, parentId: null }, b: { ...b, parentId: null } },
          material: a.material,
        });
        set({ objects: [...s.objects.filter((x) => x.id !== a.id && x.id !== b.id), o], selected: [o.id] });
        return o.id;
      },
      splitBoolean() {
        const s = get();
        const o = s.objects.find((x) => x.id === s.selected[0] && x.type === 'csg');
        if (!o?.csg) return;
        push();
        const m = objectMatrix(o);
        const restore = (c: SceneObject) => ({ ...c, id: newId(), parentId: o.parentId, ...decompose(objectMatrix(c).premultiply(m)) });
        const a = restore(o.csg.a),
          b = restore(o.csg.b);
        set({ objects: [...s.objects.filter((x) => x.id !== o.id), a, b], selected: [a.id, b.id] });
      },
      dropToFloor() {
        const s = get();
        if (!s.selected.length) return;
        push();
        const objs = s.objects.map((o) => {
          if (!s.selected.includes(o.id) || o.parentId) return o;
          const leaves = [o, ...descendants(s.objects, o.id).map((id) => s.objects.find((x) => x.id === id)!)].filter((x) => x.type !== 'group');
          let minY = Infinity;
          for (const l of leaves) {
            const box = geomBox(l).clone().applyMatrix4(worldMatrix(s.objects, l));
            minY = Math.min(minY, box.min.y);
          }
          if (!isFinite(minY)) return o;
          return { ...o, position: [o.position[0], o.position[1] - minY, o.position[2]] as Vec3 };
        });
        set({ objects: objs });
      },
      undo() {
        const s = get();
        if (!s.past.length) return;
        const prev = s.past[s.past.length - 1];
        set({ objects: prev, past: s.past.slice(0, -1), future: [s.objects, ...s.future], selected: s.selected.filter((id) => prev.some((o) => o.id === id)) });
      },
      redo() {
        const s = get();
        if (!s.future.length) return;
        const nxt = s.future[0];
        set({ objects: nxt, future: s.future.slice(1), past: [...s.past, s.objects], selected: s.selected.filter((id) => nxt.some((o) => o.id === id)) });
      },
      set(p) {
        set(p);
      },
      setLight(p) {
        set({ light: { ...get().light, ...p } });
      },
    };
  });
}

function geomBox(o: SceneObject) {
  const g = getGeometry(o);
  if (!g.boundingBox) g.computeBoundingBox();
  return g.boundingBox!;
}

export type EditorStore = UseBoundStore<StoreApi<EditorState>>;
export const EditorContext = createContext<EditorStore | null>(null);
export function useEditorStore(): EditorStore {
  const s = useContext(EditorContext);
  if (!s) throw new Error('EditorContext missing');
  return s;
}
export function useEd<T>(sel: (s: EditorState) => T): T {
  return useEditorStore()(sel);
}

/** Lightweight bake helper exposed for gizmo end events. */
export function bakeIfPossible(o: SceneObject): SceneObject {
  return bakeScale(o);
}
