import { Edges, Line } from '@react-three/drei';
import { forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { SafeHtml } from './SafeHtml';
import { getGeometry, type MaterialSpec, type SceneObject } from '../../lib/shapes';
import { materialById, proceduralTexture } from '../../lib/materials';
import type { Vec3 } from '../../lib/types';
import { fmt } from '../../lib/math';
import type { ThreeEvent } from '@react-three/fiber';

export function PbrMaterial({ spec, ghost, highlight, side }: { spec: MaterialSpec; ghost?: boolean; highlight?: boolean; side?: THREE.Side }) {
  const preset = materialById(spec.preset);
  const map = preset?.texture ? proceduralTexture(preset.texture) : undefined;
  const transmission = preset?.transmission ?? 0;
  if (ghost) {
    return <meshStandardMaterial color={spec.color} transparent opacity={0.22} depthWrite={false} roughness={0.6} side={side} />;
  }
  return (
    <meshPhysicalMaterial
      color={spec.color}
      roughness={spec.roughness}
      metalness={spec.metalness}
      transparent={spec.opacity < 1 || transmission > 0}
      opacity={spec.opacity}
      transmission={transmission}
      thickness={transmission > 0 ? 8 : 0}
      ior={1.5}
      clearcoat={preset?.clearcoat ?? 0}
      clearcoatRoughness={0.15}
      sheen={preset?.sheen ?? 0}
      sheenColor={spec.color}
      map={preset?.texture === 'brushed' ? undefined : map}
      roughnessMap={preset?.texture === 'brushed' ? map : undefined}
      emissive={highlight ? '#1f6f8f' : '#000000'}
      emissiveIntensity={highlight ? 0.45 : 0}
      side={side}
    />
  );
}

interface MeshProps {
  o: SceneObject;
  selected?: boolean;
  ghost?: boolean;
  edges?: boolean;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  castShadow?: boolean;
  children?: React.ReactNode;
}

/** Renders one SceneObject (non-group) with its transform. */
export const ObjectMesh = forwardRef<THREE.Mesh, MeshProps>(function ObjectMesh({ o, selected, ghost, edges, onPointerDown, onClick, castShadow = true, children }, ref) {
  const geo = useMemo(() => getGeometry(o), [o]);
  return (
    <mesh
      ref={ref}
      geometry={geo}
      position={o.position}
      rotation={o.rotation}
      scale={o.scale}
      visible={o.visible}
      castShadow={castShadow && !ghost}
      receiveShadow={!ghost}
      onPointerDown={onPointerDown}
      onClick={onClick}
      userData={{ objectId: o.id }}
    >
      <PbrMaterial spec={o.material} ghost={ghost} highlight={selected} side={o.type === 'lathe' && (o.lathe?.angle ?? 360) < 360 ? THREE.DoubleSide : undefined} />
      {(selected || edges) && <Edges threshold={20} color={selected ? '#9ff0ff' : '#0b0f14'} />}
      {children}
    </mesh>
  );
});

/** A translucent ghost outline used for targets. */
export function Ghost({ o, color = '#ffd166', wire = true }: { o: SceneObject; color?: string; wire?: boolean }) {
  const geo = useMemo(() => getGeometry(o), [o]);
  return (
    <mesh geometry={geo} position={o.position} rotation={o.rotation} scale={o.scale} raycast={() => null}>
      <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} />
      {wire && <Edges threshold={15} color={color} />}
    </mesh>
  );
}

/** Dimension lines along X, Y and Z of an axis-aligned box. */
export function DimensionLines({ box, color = '#e8eef4', unit = 'mm', offset = 6 }: { box: THREE.Box3; color?: string; unit?: string; offset?: number }) {
  const { min, max } = box;
  const s = new THREE.Vector3();
  box.getSize(s);
  const o = offset;
  const yb = min.y;
  const items: { a: Vec3; b: Vec3; ext: [Vec3, Vec3][]; label: string; c: string }[] = [
    {
      a: [min.x, yb, max.z + o],
      b: [max.x, yb, max.z + o],
      ext: [
        [[min.x, yb, max.z], [min.x, yb, max.z + o * 1.3]],
        [[max.x, yb, max.z], [max.x, yb, max.z + o * 1.3]],
      ],
      label: `${fmt(s.x)} ${unit}`,
      c: '#ff8a8a',
    },
    {
      a: [max.x + o, min.y, max.z],
      b: [max.x + o, max.y, max.z],
      ext: [
        [[max.x, min.y, max.z], [max.x + o * 1.3, min.y, max.z]],
        [[max.x, max.y, max.z], [max.x + o * 1.3, max.y, max.z]],
      ],
      label: `${fmt(s.y)} ${unit}`,
      c: '#8ae68a',
    },
    {
      a: [max.x + o, yb, min.z],
      b: [max.x + o, yb, max.z],
      ext: [
        [[max.x, yb, min.z], [max.x + o * 1.3, yb, min.z]],
        [[max.x, yb, max.z], [max.x + o * 1.3, yb, max.z]],
      ],
      label: `${fmt(s.z)} ${unit}`,
      c: '#8ab4ff',
    },
  ];
  return (
    <group>
      {items.map((it, i) => (
        <group key={i}>
          <Line points={[it.a, it.b]} color={it.c} lineWidth={1.5} />
          {it.ext.map((e, j) => (
            <Line key={j} points={e} color={color} lineWidth={0.8} transparent opacity={0.6} />
          ))}
          <SafeHtml position={[(it.a[0] + it.b[0]) / 2, (it.a[1] + it.b[1]) / 2, (it.a[2] + it.b[2]) / 2]} center zIndexRange={[3, 0]}>
            <div className="hud mono" style={{ padding: '1px 6px', fontSize: 12, color: it.c, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
              {it.label}
            </div>
          </SafeHtml>
        </group>
      ))}
    </group>
  );
}

export function Label({ position, children, color = '#e8eef4', size = 12 }: { position: Vec3; children: React.ReactNode; color?: string; size?: number }) {
  return (
    <SafeHtml position={position} center zIndexRange={[3, 0]}>
      <div className="hud" style={{ padding: '1px 6px', fontSize: size, color, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
        {children}
      </div>
    </SafeHtml>
  );
}

/** Dashed guides from a point to the three coordinate planes/axes. */
export function CoordinateGuides({ p }: { p: Vec3 }) {
  const [x, y, z] = p;
  return (
    <group>
      <Line points={[[x, y, z], [x, 0, z]]} color="#5bd75b" lineWidth={1} dashed dashSize={2} gapSize={1.5} />
      <Line points={[[x, 0, z], [x, 0, 0]]} color="#4d8dff" lineWidth={1} dashed dashSize={2} gapSize={1.5} />
      <Line points={[[x, 0, z], [0, 0, z]]} color="#ff5f5f" lineWidth={1} dashed dashSize={2} gapSize={1.5} />
      <mesh position={[x, 0, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 2, 24]} />
        <meshBasicMaterial color="#e8eef4" />
      </mesh>
    </group>
  );
}

export function Arrow3D({ from, to, color = '#ffd166', width = 2 }: { from: Vec3; to: Vec3; color?: string; width?: number }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 0.5) return null;
  dir.normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const head = Math.min(6, len * 0.3);
  const tip = b.clone().sub(dir.clone().multiplyScalar(head / 2));
  return (
    <group>
      <Line points={[from, b.clone().sub(dir.clone().multiplyScalar(head)).toArray() as Vec3]} color={color} lineWidth={width} />
      <mesh position={tip} quaternion={q}>
        <coneGeometry args={[head * 0.35, head, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
