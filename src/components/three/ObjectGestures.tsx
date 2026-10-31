import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '../../lib/types';

export type DragAxis = 'x' | 'y' | 'z' | 'xz';

export interface TransformState {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

interface Props {
  enabled: boolean;
  axis: DragAxis;
  get: () => TransformState | null;
  onStart?: () => void;
  onChange: (t: TransformState) => void;
  onEnd?: () => void;
  snap?: number; // mm
  rotateSnapDeg?: number;
  allowMove?: boolean;
  allowRotate?: boolean;
  allowScale?: boolean;
  rotateAxis?: 'x' | 'y' | 'z';
  minScale?: number;
  maxScale?: number;
}

const AX: Record<'x' | 'y' | 'z', THREE.Vector3> = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

/**
 * Touch-first object manipulation. While enabled, the camera's orbit controls are paused and:
 *  - one finger (or mouse drag) moves the object along the chosen axis / ground plane,
 *  - two-finger pinch scales it, two-finger twist rotates it,
 *  - mouse wheel scales it.
 * Dragging uses exact ray / axis geometry, so the object stays under the finger.
 */
export function ObjectGestures(p: Props) {
  const { camera, gl, controls } = useThree();
  const ref = useRef(p);
  ref.current = p;

  useEffect(() => {
    const ctl = controls as unknown as { enabled: boolean } | null;
    if (ctl) ctl.enabled = !p.enabled;
    return () => {
      if (ctl) ctl.enabled = true;
    };
  }, [p.enabled, controls]);

  useEffect(() => {
    const el = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let start: TransformState | null = null;
    let startRayParam: THREE.Vector3 | number | null = null;
    let pinch0 = 0;
    let angle0 = 0;
    let mode: 'none' | 'move' | 'two' = 'none';
    const raycaster = new THREE.Raycaster();

    const ray = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray;
    };
    const axisParam = (r: THREE.Ray, origin: THREE.Vector3, dir: THREE.Vector3) => {
      // closest point between the ray and the axis line: returns t along axis
      const w0 = origin.clone().sub(r.origin);
      const a = dir.dot(dir),
        b = dir.dot(r.direction),
        c = r.direction.dot(r.direction),
        d = dir.dot(w0),
        e = r.direction.dot(w0);
      const den = a * c - b * b;
      if (Math.abs(den) < 1e-6) return null;
      return (b * e - c * d) / den;
    };
    const planeHit = (r: THREE.Ray, y: number) => {
      const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
      const out = new THREE.Vector3();
      return r.intersectPlane(pl, out) ? out : null;
    };
    const twoInfo = () => {
      const [a, b] = [...pointers.values()];
      return { dist: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(-(b.y - a.y), b.x - a.x) };
    };
    const begin = () => {
      start = ref.current.get();
      if (start) ref.current.onStart?.();
    };

    const down = (e: PointerEvent) => {
      if (!ref.current.enabled) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (pointers.size === 1) {
        begin();
        if (!start) return;
        mode = 'move';
        const r = ray(e.clientX, e.clientY);
        const o = new THREE.Vector3(...start.position);
        if (ref.current.axis === 'xz') startRayParam = planeHit(r, o.y);
        else startRayParam = axisParam(r, o, AX[ref.current.axis]);
      } else if (pointers.size === 2) {
        // restart as a two-finger gesture from the current state
        if (mode === 'move') ref.current.onEnd?.();
        begin();
        mode = 'two';
        const t = twoInfo();
        pinch0 = t.dist;
        angle0 = t.ang;
      }
    };
    const move = (e: PointerEvent) => {
      if (!ref.current.enabled || !pointers.has(e.pointerId) || !start) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const P = ref.current;
      if (mode === 'move' && pointers.size === 1 && P.allowMove !== false) {
        const r = ray(e.clientX, e.clientY);
        const o = new THREE.Vector3(...start.position);
        const pos = o.clone();
        if (P.axis === 'xz') {
          const h = planeHit(r, o.y);
          if (!h || !(startRayParam instanceof THREE.Vector3)) return;
          pos.add(h.sub(startRayParam));
          if (P.snap) {
            pos.x = Math.round(pos.x / P.snap) * P.snap;
            pos.z = Math.round(pos.z / P.snap) * P.snap;
          }
        } else {
          const t = axisParam(r, o, AX[P.axis]);
          if (t == null || typeof startRayParam !== 'number') return;
          let dt = t - startRayParam;
          const k = P.axis === 'x' ? 0 : P.axis === 'y' ? 1 : 2;
          let v = start.position[k] + dt;
          if (P.snap) v = Math.round(v / P.snap) * P.snap;
          dt = v - start.position[k];
          pos.add(AX[P.axis].clone().multiplyScalar(dt));
        }
        P.onChange({ ...start, position: [pos.x, pos.y, pos.z] });
      } else if (mode === 'two' && pointers.size === 2) {
        const t = twoInfo();
        let next = { ...start };
        if (P.allowScale !== false && pinch0 > 10) {
          const f = Math.min(P.maxScale ?? 20, Math.max(P.minScale ?? 0.05, t.dist / pinch0));
          next.scale = [start.scale[0] * f, start.scale[1] * f, start.scale[2] * f];
        }
        if (P.allowRotate !== false) {
          let da = t.ang - angle0;
          if (P.rotateSnapDeg) {
            const s = (P.rotateSnapDeg * Math.PI) / 180;
            da = Math.round(da / s) * s;
          }
          const k = P.rotateAxis === 'x' ? 0 : P.rotateAxis === 'z' ? 2 : 1;
          const rot = [...start.rotation] as Vec3;
          rot[k] = start.rotation[k] + da;
          next = { ...next, rotation: rot };
        }
        P.onChange(next);
      }
    };
    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        if (mode !== 'none' && start) ref.current.onEnd?.();
        mode = 'none';
        start = null;
      } else if (pointers.size === 1 && mode === 'two') {
        // finished the two-finger gesture; continue as a fresh one-finger move
        ref.current.onEnd?.();
        const [id, pt] = [...pointers.entries()][0];
        pointers.delete(id);
        down({ pointerId: id, clientX: pt.x, clientY: pt.y } as PointerEvent);
      }
    };
    const wheel = (e: WheelEvent) => {
      const P = ref.current;
      if (!P.enabled || P.allowScale === false) return;
      e.preventDefault();
      const s = P.get();
      if (!s) return;
      P.onStart?.();
      const f = Math.exp(-e.deltaY * 0.0015);
      const clampS = (v: number) => Math.min(P.maxScale ?? 20, Math.max(P.minScale ?? 0.05, v));
      P.onChange({ ...s, scale: [clampS(s.scale[0] * f), clampS(s.scale[1] * f), clampS(s.scale[2] * f)] });
      P.onEnd?.();
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [camera, gl]);

  return null;
}
