import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '../../lib/types';

/**
 * A draggable handle constrained to a line (through `position`, along `dir`).
 * Reports the signed distance moved since the drag started. Works with touch, pen and mouse.
 */
export function AxisHandle({
  position,
  dir,
  color = '#f8961e',
  size = 3.5,
  onStart,
  onDrag,
  onEnd,
  shape = 'sphere',
}: {
  position: Vec3;
  dir: Vec3;
  color?: string;
  size?: number;
  onStart?: () => void;
  onDrag: (delta: number) => void;
  onEnd?: () => void;
  shape?: 'sphere' | 'arrow';
}) {
  const { camera, controls, gl } = useThree();
  const [hover, setHover] = useState(false);
  const st = useRef<{ origin: THREE.Vector3; t0: number; id: number } | null>(null);
  const d = new THREE.Vector3(...dir).normalize();

  const param = (clientX: number, clientY: number, origin: THREE.Vector3) => {
    const r = gl.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
    const R = ray.ray;
    const w0 = origin.clone().sub(R.origin);
    const b = d.dot(R.direction),
      c = R.direction.dot(R.direction),
      dd = d.dot(w0),
      e = R.direction.dot(w0);
    const den = c - b * b;
    if (Math.abs(den) < 1e-6) return null;
    return (b * e - c * dd) / den;
  };

  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const origin = new THREE.Vector3(...position);
    const t0 = param(e.clientX, e.clientY, origin);
    if (t0 == null) return;
    st.current = { origin, t0, id: e.pointerId };
    const ctl = controls as unknown as { enabled: boolean } | null;
    if (ctl) ctl.enabled = false;
    onStart?.();
    const move = (ev: PointerEvent) => {
      if (!st.current || ev.pointerId !== st.current.id) return;
      const t = param(ev.clientX, ev.clientY, st.current.origin);
      if (t != null) onDrag(t - st.current.t0);
    };
    const up = (ev: PointerEvent) => {
      if (!st.current || ev.pointerId !== st.current.id) return;
      st.current = null;
      if (ctl) ctl.enabled = true;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      onEnd?.();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  return (
    <group position={position} quaternion={q}>
      {/* generous invisible hit area for fingers */}
      <mesh onPointerDown={down} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <sphereGeometry args={[size * 2.2, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {shape === 'sphere' ? (
        <mesh>
          <sphereGeometry args={[size * (hover ? 1.25 : 1), 20, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hover ? 0.6 : 0.25} />
        </mesh>
      ) : (
        <>
          <mesh position={[0, size * 0.6, 0]}>
            <coneGeometry args={[size * (hover ? 1.2 : 1), size * 2.2, 16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hover ? 0.6 : 0.25} />
          </mesh>
          <mesh position={[0, -size * 0.8, 0]}>
            <cylinderGeometry args={[size * 0.3, size * 0.3, size * 1.6, 8]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </>
      )}
    </group>
  );
}
