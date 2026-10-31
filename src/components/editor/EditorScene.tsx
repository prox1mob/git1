import { TransformControls } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { ObjectMesh, DimensionLines } from '../three/ObjectMesh';
import { ObjectGestures } from '../three/ObjectGestures';
import { bakeScale, type SceneObject } from '../../lib/shapes';
import { useEd, useEditorStore, worldMatrix } from '../../store/editorStore';
import { DEG } from '../../lib/math';
import type { Vec3 } from '../../lib/types';

/** Registry of rendered Object3Ds by object id, shared by the scene, gizmo and exporters. */
export type ObjMap = Map<string, THREE.Object3D>;

interface Props {
  /** Optional ref receiving the root group that contains only user objects (for export / thumbnails). */
  rootRef?: React.MutableRefObject<THREE.Group | null>;
  children?: ReactNode;
  editable?: boolean;
}

export function EditorScene({ rootRef, children, editable = true }: Props) {
  const store = useEditorStore();
  const objects = useEd((s) => s.objects);
  const selected = useEd((s) => s.selected);
  const mode = useEd((s) => s.mode);
  const space = useEd((s) => s.space);
  const snap = useEd((s) => s.snap);
  const snapMove = useEd((s) => s.snapMove);
  const snapRot = useEd((s) => s.snapRot);
  const touchMode = useEd((s) => s.touchMode);
  const dragAxis = useEd((s) => s.dragAxis);
  const showDims = useEd((s) => s.showDims);
  const map = useRef<ObjMap>(new Map());
  const [, force] = useState(0);
  const lastGizmo = useRef(0);
  const root = useRef<THREE.Group>(null);
  const { size } = useThree();

  useEffect(() => {
    if (rootRef) rootRef.current = root.current;
  });

  const single = selected.length === 1 ? objects.find((o) => o.id === selected[0]) : undefined;
  const target = single ? map.current.get(single.id) : undefined;
  useEffect(() => {
    // the target object may mount after the selection changes; re-render once so the gizmo can attach
    if (single && !map.current.get(single.id)) requestAnimationFrame(() => force((n) => n + 1));
  }, [single]);

  const onPick = (e: ThreeEvent<PointerEvent>, id: string) => {
    if (!editable) return;
    e.stopPropagation();
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const s = store.getState();
    // select the outermost group first; tapping again drills into the group
    const chain: string[] = [];
    let cur = s.objects.find((o) => o.id === id);
    while (cur) {
      chain.unshift(cur.id);
      cur = cur.parentId ? s.objects.find((o) => o.id === cur!.parentId) : undefined;
    }
    const selIdx = chain.findIndex((c) => s.selected.includes(c));
    const pick = selIdx >= 0 && selIdx < chain.length - 1 ? chain[selIdx + 1] : chain[0];
    s.select(pick, e.nativeEvent.shiftKey || e.nativeEvent.ctrlKey || e.nativeEvent.metaKey);
  };

  const dimsBox = useMemo(() => {
    if (!showDims || !single) return null;
    const box = new THREE.Box3();
    const leaves = collectLeaves(objects, single);
    for (const l of leaves) {
      const g = map.current.get(l.id) as THREE.Mesh | undefined;
      const geo = g?.geometry;
      if (!geo) continue;
      if (!geo.boundingBox) geo.computeBoundingBox();
      box.union(geo.boundingBox!.clone().applyMatrix4(worldMatrix(objects, l)));
    }
    return box.isEmpty() ? null : box;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, single, showDims, map.current.size]);

  const commitTransform = () => {
    const s = store.getState();
    const o = s.objects.find((x) => x.id === s.selected[0]);
    if (!o) return;
    if (s.mode === 'scale') s.updateLive(o.id, bakeScale(o));
  };

  return (
    <>
      <group ref={root} name="user-objects">
        <Tree objects={objects} parentId={null} selected={selected} map={map.current} onPick={onPick} />
      </group>
      {children}
      {dimsBox && <DimensionLines box={dimsBox} />}
      {editable && single && target && touchMode === 'gizmo' && (
        <TransformControls
          object={target}
          mode={mode}
          space={space}
          size={size.width < 700 ? 1.3 : 1}
          translationSnap={snap ? snapMove : null}
          rotationSnap={snap ? snapRot * DEG : null}
          scaleSnap={snap ? 0.05 : null}
          onMouseDown={() => {
            lastGizmo.current = performance.now();
            store.getState().checkpoint();
          }}
          onMouseUp={() => {
            lastGizmo.current = performance.now();
            commitTransform();
          }}
          onObjectChange={() => {
            const t = target;
            store.getState().updateLive(single.id, {
              position: [t.position.x, t.position.y, t.position.z],
              rotation: [t.rotation.x, t.rotation.y, t.rotation.z],
              scale: [t.scale.x, t.scale.y, t.scale.z],
            });
          }}
        />
      )}
      {editable && single && touchMode === 'drag' && (
        <ObjectGestures
          enabled
          axis={dragAxis}
          snap={snap ? snapMove : 0}
          rotateSnapDeg={snap ? snapRot : 0}
          get={() => {
            const o = store.getState().objects.find((x) => x.id === single.id);
            return o ? { position: o.position, rotation: o.rotation, scale: o.scale } : null;
          }}
          onStart={() => store.getState().checkpoint()}
          onChange={(t) => store.getState().updateLive(single.id, { position: t.position, rotation: t.rotation, scale: t.scale })}
          onEnd={commitTransform}
        />
      )}
      <MissHandler lastGizmo={lastGizmo} />
    </>
  );
}

function MissHandler({ lastGizmo }: { lastGizmo: React.MutableRefObject<number> }) {
  const store = useEditorStore();
  const { gl } = useThree();
  useEffect(() => {
    // Deselect when tapping empty space (but not right after using the gizmo, or after an orbit drag).
    let down: { x: number; y: number; t: number } | null = null;
    const el = gl.domElement;
    const d = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY, t: performance.now() });
    const u = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 400;
      down = null;
      if (moved > 6 || !quick || performance.now() - lastGizmo.current < 350) return;
      // let mesh handlers run first
      setTimeout(() => {
        if ((window as unknown as { __picked?: number }).__picked && performance.now() - (window as unknown as { __picked: number }).__picked < 100) return;
        const s = store.getState();
        if (s.touchMode === 'drag') return;
        if (!s.multi) s.select(null);
      }, 0);
    };
    el.addEventListener('pointerdown', d);
    el.addEventListener('pointerup', u);
    return () => {
      el.removeEventListener('pointerdown', d);
      el.removeEventListener('pointerup', u);
    };
  }, [gl, store, lastGizmo]);
  return null;
}

function collectLeaves(objs: SceneObject[], o: SceneObject): SceneObject[] {
  if (o.type !== 'group') return [o];
  return objs.filter((x) => x.parentId === o.id).flatMap((c) => collectLeaves(objs, c));
}

function Tree({ objects, parentId, selected, map, onPick }: { objects: SceneObject[]; parentId: string | null; selected: string[]; map: ObjMap; onPick: (e: ThreeEvent<PointerEvent>, id: string) => void }) {
  return (
    <>
      {objects
        .filter((o) => o.parentId === parentId)
        .map((o) =>
          o.type === 'group' ? (
            <GroupNode key={o.id} o={o} ref={(r) => setRef(map, o.id, r)}>
              <Tree objects={objects} parentId={o.id} selected={selected} map={map} onPick={onPick} />
            </GroupNode>
          ) : (
            <ObjectMesh
              key={o.id}
              o={o}
              selected={selected.includes(o.id) || isAncestorSelected(objects, o, selected)}
              ref={(r) => setRef(map, o.id, r)}
              onPointerDown={(e) => {
                (window as unknown as { __picked: number }).__picked = performance.now();
                onPick(e, o.id);
              }}
            />
          ),
        )}
    </>
  );
}

function isAncestorSelected(objs: SceneObject[], o: SceneObject, sel: string[]) {
  let p = o.parentId;
  while (p) {
    if (sel.includes(p)) return true;
    p = objs.find((x) => x.id === p)?.parentId ?? null;
  }
  return false;
}

function setRef(map: ObjMap, id: string, r: THREE.Object3D | null) {
  if (r) map.set(id, r);
  else map.delete(id);
}

const GroupNode = forwardRef<THREE.Group, { o: SceneObject; children: ReactNode }>(function GroupNode({ o, children }, ref) {
  return (
    <group ref={ref} position={o.position as Vec3} rotation={o.rotation as Vec3} scale={o.scale as Vec3} visible={o.visible} userData={{ objectId: o.id }}>
      {children}
    </group>
  );
});
