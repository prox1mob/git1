import { useEffect, useState, type ReactNode } from 'react';
import type * as THREE from 'three';
import { Stage3D, type ViewName } from '../Stage3D';
import { EditorScene } from './EditorScene';
import { AddPrimitiveButtons, EditorLights, EditToolbar } from './panels';
import { useEd, useEditorStore } from '../../store/editorStore';
import type { PrimType } from '../../lib/shapes';
import type { Vec3 } from '../../lib/types';

export function useEditorKeys() {
  const store = useEditorStore();
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      const s = store.getState();
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if ((e.ctrlKey || e.metaKey) && k === 'y') {
        e.preventDefault();
        s.redo();
      } else if ((e.ctrlKey || e.metaKey) && k === 'd') {
        e.preventDefault();
        s.duplicate();
      } else if (k === 'delete' || k === 'backspace') s.remove();
      else if (k === 'w') s.set({ mode: 'translate', touchMode: 'gizmo' });
      else if (k === 'e') s.set({ mode: 'rotate', touchMode: 'gizmo' });
      else if (k === 'r') s.set({ mode: 'scale', touchMode: 'gizmo' });
      else if (k === 'escape') s.select(null);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [store]);
}

interface Props {
  allowed?: PrimType[];
  booleans?: boolean;
  grouping?: boolean;
  children?: ReactNode;
  overlay?: ReactNode;
  fit?: number;
  camera?: Vec3;
  target?: Vec3;
  rootRef?: React.MutableRefObject<THREE.Group | null>;
  preserve?: boolean;
  axes?: boolean | number;
  toolbarExtra?: ReactNode;
}

/** A compact embeddable modelling workspace used inside levels. */
export function MiniEditor({ allowed, booleans, grouping = true, children, overlay, fit = 120, camera, target, rootRef, preserve, axes = 40, toolbarExtra }: Props) {
  const [view, setView] = useState<ViewName>('persp');
  const env = useEd((s) => s.light.env);
  const shadows = useEd((s) => s.light.shadows);
  useEditorKeys();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
      <div className="toolbar">
        <AddPrimitiveButtons allowed={allowed} />
        <span className="divider" />
        <EditToolbar booleans={booleans} grouping={grouping} />
        {toolbarExtra}
      </div>
      <Stage3D
        fit={fit}
        camera={camera ?? [fit * 0.9, fit * 0.8, fit * 1.2]}
        target={target}
        view={view}
        onViewChange={setView}
        axes={axes}
        env={env}
        shadows={shadows}
        lights={<EditorLights extent={fit * 1.5} />}
        overlay={overlay}
        preserve={preserve}
      >
        <EditorScene rootRef={rootRef}>{children}</EditorScene>
      </Stage3D>
    </div>
  );
}
