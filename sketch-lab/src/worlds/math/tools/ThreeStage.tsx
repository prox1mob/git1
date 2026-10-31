import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface ThreeCtx {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  /** move the camera to look from a direction, keeping the distance */
  view: (dir: [number, number, number]) => void;
}

/**
 * A Three.js canvas with orbit controls that work with mouse, touch (one finger
 * rotates, two fingers pinch-zoom) and stylus. `setup` runs once and may return
 * a cleanup function. `onFrame` runs every animation frame.
 */
export function ThreeStage({ setup, onFrame, hint = 'drag to rotate · pinch or scroll to zoom', camPos = [7, 6, 9], aspect = 16 / 10 }: {
  setup: (ctx: ThreeCtx) => void | (() => void);
  onFrame?: (ctx: ThreeCtx, dt: number) => void;
  hint?: string;
  camPos?: [number, number, number];
  aspect?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor('#f8f9fc');
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 500);
    camera.position.set(...camPos);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 60;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa5c4, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(6, 10, 7);
    scene.add(sun);
    const view = (dir: [number, number, number]) => {
      const d = camera.position.distanceTo(controls.target);
      const v = new THREE.Vector3(...dir).normalize().multiplyScalar(d);
      camera.position.copy(controls.target).add(v);
      controls.update();
    };
    const ctx: ThreeCtx = { scene, camera, renderer, controls, view };
    const cleanup = setup(ctx);

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      controls.update();
      frameRef.current?.(ctx, dt);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cleanup?.();
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
          (x as THREE.MeshStandardMaterial).map?.dispose();
          x.dispose();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) {
    return <div className="three-host" style={{ display: 'grid', placeItems: 'center', padding: 20 }}>3D needs WebGL, which this browser has turned off. The numbers panel still works.</div>;
  }
  return (
    <div className="three-host" ref={host} style={{ aspectRatio: String(aspect) }}>
      <div className="three-hint">{hint}</div>
    </div>
  );
}

/** Remove and dispose everything inside a group. */
export function clearGroup(g: THREE.Object3D) {
  for (const child of [...g.children]) {
    child.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
        (x as THREE.MeshStandardMaterial).map?.dispose();
        x.dispose();
      });
    });
    g.remove(child);
  }
}

/** A canvas texture with an n × n grid — makes face area countable. */
export function gridTexture(cols: number, rows: number, color: string, line = '#1f2a44') {
  const c = document.createElement('canvas');
  const px = 64;
  c.width = Math.max(64, Math.min(1024, Math.round(cols * px)));
  c.height = Math.max(64, Math.min(1024, Math.round(rows * px)));
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = line;
  g.globalAlpha = 0.35;
  g.lineWidth = 2;
  for (let i = 1; i < cols; i++) {
    const x = (i / cols) * c.width;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, c.height);
    g.stroke();
  }
  for (let j = 1; j < rows; j++) {
    const y = (j / rows) * c.height;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(c.width, y);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.lineWidth = 6;
  g.strokeRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Text label sprite (always faces the camera). */
export function labelSprite(text: string, color = '#1f2a44', size = 0.6) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = 'bold 44px system-ui, sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 24;
  c.width = w;
  c.height = 64;
  g.font = font;
  g.fillStyle = 'rgba(255,255,255,0.88)';
  g.beginPath();
  g.roundRect(0, 4, w, 56, 12);
  g.fill();
  g.fillStyle = color;
  g.textBaseline = 'middle';
  g.fillText(text, 12, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set((size * w) / 64, size, 1);
  s.renderOrder = 10;
  return s;
}
