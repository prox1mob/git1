import { useEffect, useMemo, useRef, useState } from 'react';
import type * as THREE from 'three';
import { Stage3D, type ViewName } from '../../components/Stage3D';
import { EditorScene } from '../../components/editor/EditorScene';
import { AddPrimitiveButtons, EditorLights, EditToolbar, Hierarchy, Inspector, LightPanel } from '../../components/editor/panels';
import { useEditorKeys } from '../../components/editor/MiniEditor';
import { CaptureHook, type CaptureFn } from '../../components/three/Capture';
import { Modal, Seg } from '../../components/ui';
import { createEditorStore, EditorContext, useEd } from '../../store/editorStore';
import { getGeometry, triangleCount, type SceneObject } from '../../lib/shapes';
import { exportGLTF, exportSTL } from '../../lib/export';
import { getProject, listProjects, saveVersion, takeIncoming, type Project } from '../../lib/storage';
import { navigate } from '../../lib/router';
import { toast } from '../../store/toast';
import { toolUnlocked, useProgress } from '../../store/progress';
import { BADGES } from '../../store/progress';
import { fmt, type LengthUnit } from '../../lib/math';

const AUTOSAVE = 'the-3d-lab-editor-autosave';
const MAX_OBJECTS = 150;

function announce(badges: string[]) {
  for (const b of badges) {
    const bd = BADGES.find((x) => x.id === b);
    if (bd) toast(`${bd.icon} Badge unlocked: ${bd.name}`);
  }
}

function EditorInner({ projectId }: { projectId?: string }) {
  const store = useEd((s) => s);
  const objects = store.objects;
  const progress = useProgress();
  const [view, setView] = useState<ViewName>('persp');
  const [tab, setTab] = useState<'props' | 'objects' | 'light' | 'project'>('props');
  const [project, setProject] = useState<{ id?: string; name: string }>({ name: 'Untitled model' });
  const [openList, setOpenList] = useState<Project[] | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [unit, setUnit] = useState<LengthUnit>(progress.settings.unit);
  const rootRef = useRef<THREE.Group | null>(null);
  const capture = useRef<CaptureFn | null>(null);
  const loaded = useRef(false);
  useEditorKeys();

  // Load: project param > incoming sketch > autosave
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    (async () => {
      if (projectId) {
        const p = await getProject(projectId);
        if (p) {
          store.setObjects(p.versions[p.versions.length - 1].objects, false);
          setProject({ id: p.id, name: p.name });
          return;
        }
      }
      const raw = localStorage.getItem(AUTOSAVE);
      if (raw) {
        try {
          const a = JSON.parse(raw) as { objects: SceneObject[]; project?: { id?: string; name: string } };
          store.setObjects(a.objects, false);
          if (a.project) setProject(a.project);
        } catch {
          /* ignore corrupt autosave */
        }
      }
      const inc = takeIncoming();
      if (inc?.length) {
        for (const o of inc) store.addObject(o);
        toast('Sketch added to the scene ✏️→🧊');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(AUTOSAVE, JSON.stringify({ objects, project })), 400);
    return () => clearTimeout(t);
  }, [objects, project]);

  const tris = useMemo(() => objects.filter((o) => o.type !== 'group').reduce((s, o) => s + triangleCount(getGeometry(o)), 0), [objects]);

  const save = async () => {
    const thumb = capture.current?.(360) ?? '';
    const note = prompt('Note for this version (what changed?)', project.id ? 'Improved version' : 'First version');
    if (note === null) return;
    const p = await saveVersion({ id: project.id, name: project.name, source: 'editor', objects, thumb, note });
    setProject({ id: p.id, name: p.name });
    if (p.versions.length === 1) announce(useProgress.getState().bump('projectsSaved'));
    toast(`💾 Saved “${p.name}” · version ${p.versions.length}`);
  };
  const doExport = async (kind: 'stl' | 'stl-sel' | 'glb' | 'gltf') => {
    if (!rootRef.current) return;
    try {
      if (kind === 'stl') exportSTL(rootRef.current, project.name);
      else if (kind === 'stl-sel') {
        if (!store.selected.length) return toast('Select the parts to export first.');
        exportSTL(rootRef.current, `${project.name}-selection`, new Set(store.selected));
      } else await exportGLTF(rootRef.current, project.name, kind === 'glb');
      announce(useProgress.getState().bump('exports'));
      setExportOpen(false);
      toast('📦 Export ready — check your downloads.');
    } catch (e) {
      toast(`Export failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="editor">
      <div className="toolbar">
        <AddPrimitiveButtons />
        <button className="btn small" onClick={() => navigate('/sketch')} title="Draw a 2D profile and extrude it">
          {toolUnlocked('sketch3d', progress) ? '✏️' : '🔒'} Sketch→3D
        </button>
        <span className="divider" />
        <EditToolbar booleans />
        <span className="divider" />
        <button className="btn small" onClick={save}>
          💾 Save
        </button>
        <button className="btn small" onClick={async () => setOpenList(await listProjects())}>
          📂 Open
        </button>
        <button className="btn small" onClick={() => setExportOpen(true)}>
          ⬇ Export
        </button>
      </div>
      <div className="levelbody">
        <Stage3D
          fit={150}
          view={view}
          onViewChange={setView}
          env={store.light.env}
          shadows={store.light.shadows}
          lights={<EditorLights extent={250} />}
          axes={50}
          overlay={
            <div className="overlay-bl">
              <div className="hud mono" style={{ fontSize: 12, borderColor: objects.length > MAX_OBJECTS || tris > 500000 ? 'var(--warn)' : undefined }}>
                {objects.length} objects · {tris.toLocaleString()} triangles · 1 grid cell = 10 mm
                {(objects.length > MAX_OBJECTS || tris > 500000) && ' · ⚠ above the recommended limit for tablets'}
              </div>
            </div>
          }
        >
          <EditorScene rootRef={rootRef} />
          <CaptureHook fnRef={capture} />
        </Stage3D>
        <aside className="side">
          <div className="tabs">
            {(
              [
                ['props', 'Properties'],
                ['objects', 'Objects'],
                ['light', 'Lighting'],
                ['project', 'Project'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>
          {tab === 'props' && (
            <>
              <div className="btnrow">
                <span className="lbl">Units</span>
                <Seg value={unit} onChange={setUnit} options={[{ v: 'mm', label: 'mm' }, { v: 'cm', label: 'cm' }, { v: 'm', label: 'm' }, { v: 'in', label: 'in' }]} />
              </div>
              <Inspector unit={unit} />
            </>
          )}
          {tab === 'objects' && (
            <>
              <Hierarchy />
              <p className="muted" style={{ fontSize: 12 }}>
                Tap to select; Shift-tap or “☑ Multi” to select several. Tapping an object inside a group selects the group first, a second tap selects the part.
              </p>
            </>
          )}
          {tab === 'light' && <LightPanel />}
          {tab === 'project' && (
            <div>
              <div className="field">
                <label>Project name</label>
                <input type="text" value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} />
              </div>
              <div className="btnrow">
                <button className="btn small" onClick={save}>
                  💾 Save version
                </button>
                <button
                  className="btn small"
                  onClick={() => {
                    if (objects.length && !confirm('Start a new empty model? Unsaved changes stay in undo history only until you leave.')) return;
                    store.setObjects([]);
                    setProject({ name: 'Untitled model' });
                  }}
                >
                  ✚ New
                </button>
                <button className="btn small" onClick={() => navigate('/gallery')}>
                  🖼️ Gallery
                </button>
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                {project.id ? 'Saved projects keep up to 20 versions with thumbnails, so you can compare before and after in the Gallery.' : 'Not saved yet. Work is auto-saved on this device, but saving creates a version in your Gallery.'}
              </p>
              <div className="note">
                <b>About file formats.</b> STL and glTF/GLB contain triangle meshes. STEP files need a boundary-representation CAD kernel, which this lab does not include — so STEP export is not offered.
              </div>
              <div className="kv">
                <span>Objects</span>
                <span>{objects.length}</span>
                <span>Triangles</span>
                <span>{tris.toLocaleString()}</span>
                <span>Recommended max</span>
                <span>{MAX_OBJECTS} objects / 500k tris</span>
              </div>
            </div>
          )}
        </aside>
      </div>

      {openList && (
        <Modal onClose={() => setOpenList(null)}>
          <h3>Open a saved model</h3>
          {openList.length === 0 && <p className="muted">No saved models yet.</p>}
          <div className="grid cols-3">
            {openList.map((p) => (
              <div
                key={p.id}
                className="card hover"
                onClick={() => {
                  const v = p.versions[p.versions.length - 1];
                  store.setObjects(v.objects);
                  setProject({ id: p.id, name: p.name });
                  setOpenList(null);
                }}
              >
                {p.versions.at(-1)?.thumb && <img src={p.versions.at(-1)!.thumb} alt="" style={{ width: '100%', borderRadius: 8 }} />}
                <b>{p.name}</b>
                <div className="muted" style={{ fontSize: 12 }}>
                  {p.versions.length} versions · {new Date(p.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
          <button className="btn" style={{ marginTop: 10 }} onClick={() => setOpenList(null)}>
            Close
          </button>
        </Modal>
      )}
      {exportOpen && (
        <Modal onClose={() => setExportOpen(false)}>
          <h3>Export “{project.name}”</h3>
          <div className="grid" style={{ gap: 8 }}>
            <button className="btn" onClick={() => doExport('stl')}>
              STL (binary, millimetres) — for 3D printing
            </button>
            <button className="btn" onClick={() => doExport('stl-sel')} disabled={!store.selected.length}>
              STL of the selection only
            </button>
            <button className="btn" onClick={() => doExport('glb')}>
              GLB — compact glTF with materials (metres)
            </button>
            <button className="btn" onClick={() => doExport('gltf')}>
              glTF (JSON) — readable glTF with materials (metres)
            </button>
          </div>
          <div className="note" style={{ marginTop: 10 }}>
            Exports {fmt(tris, 0)} triangles. STL has no colour or units; slicers assume millimetres. STEP is not available because it requires a true solid-modelling (B-rep) kernel. Before printing, check walls, overhangs and fit in World 07.
          </div>
          <button className="btn small" onClick={() => setExportOpen(false)}>
            Close
          </button>
        </Modal>
      )}
    </div>
  );
}

export default function Editor({ projectId }: { projectId?: string }) {
  const store = useMemo(() => createEditorStore({ snapMove: 5 }), []);
  return (
    <EditorContext.Provider value={store}>
      <EditorInner projectId={projectId} />
    </EditorContext.Provider>
  );
}
