import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { isNative, saveNativeFile } from './native';
import { toast } from '../store/toast';

function visibleInTree(o: THREE.Object3D) {
  let c: THREE.Object3D | null = o;
  while (c) {
    if (!c.visible) return false;
    c = c.parent;
  }
  return true;
}

/** Copy only the solid meshes (no helper lines, labels or gizmos), with world transforms baked in. */
export function buildExportGroup(root: THREE.Object3D, onlyIds?: Set<string>) {
  root.updateMatrixWorld(true);
  const g = new THREE.Group();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !visibleInTree(m)) return;
    if (onlyIds && !hasAncestorId(m, onlyIds)) return;
    const copy = new THREE.Mesh(m.geometry, m.material);
    copy.name = (m.userData.objectId as string) ?? m.name;
    copy.applyMatrix4(m.matrixWorld);
    g.add(copy);
  });
  return g;
}
function hasAncestorId(o: THREE.Object3D, ids: Set<string>) {
  let c: THREE.Object3D | null = o;
  while (c) {
    if (ids.has(c.userData.objectId)) return true;
    c = c.parent;
  }
  return false;
}

/** Browser: normal file download. Android app: save to Documents and open the share sheet. */
export function download(blob: Blob, filename: string) {
  if (isNative) {
    saveNativeFile(blob, filename).catch((e) => toast(`Could not save ${filename}: ${(e as Error).message}`));
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const safe = (s: string) => s.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60) || 'model';

/** STL is unitless; slicers assume millimetres, which is what this lab uses. */
export function exportSTL(root: THREE.Object3D, name: string, onlyIds?: Set<string>) {
  const g = buildExportGroup(root, onlyIds);
  if (!g.children.length) throw new Error('Nothing to export');
  const data = new STLExporter().parse(g, { binary: true }) as DataView;
  download(new Blob([data.buffer as ArrayBuffer], { type: 'model/stl' }), `${safe(name)}.stl`);
  return triangleTotal(g);
}

/** glTF is defined in metres, so the millimetre scene is scaled by 0.001 for correct real-world size. */
export async function exportGLTF(root: THREE.Object3D, name: string, binary: boolean) {
  const g = buildExportGroup(root);
  if (!g.children.length) throw new Error('Nothing to export');
  const wrap = new THREE.Group();
  wrap.name = name;
  wrap.scale.setScalar(0.001);
  wrap.add(g);
  const res = await new GLTFExporter().parseAsync(wrap, { binary });
  if (binary) download(new Blob([res as ArrayBuffer], { type: 'model/gltf-binary' }), `${safe(name)}.glb`);
  else download(new Blob([JSON.stringify(res, null, 1)], { type: 'model/gltf+json' }), `${safe(name)}.gltf`);
}

export function triangleTotal(root: THREE.Object3D) {
  let n = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      const g = m.geometry;
      n += (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3;
    }
  });
  return Math.round(n);
}
