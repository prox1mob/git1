import { Line } from '@react-three/drei';
import { arcPoints, pointOf, type Sketch } from '../../lib/cad/sketch';
import type { Vec2, Vec3 } from '../../lib/types';

export type PlaneName = 'front' | 'top' | 'right';

export const PLANE_INFO: Record<PlaneName, { label: string; axes: string; color: string }> = {
  front: { label: 'Front plane (XY)', axes: 'X right, Y up', color: '#4d8dff' },
  top: { label: 'Top plane (XZ)', axes: 'X right, Z towards you (drawn as −Y on screen)', color: '#5bd75b' },
  right: { label: 'Right plane (YZ)', axes: 'Z left, Y up', color: '#ff5f5f' },
};

/** Map sketch (u, v) coordinates onto a 3D plane. */
export function toPlane(plane: PlaneName, [u, v]: Vec2, offset = 0): Vec3 {
  if (plane === 'front') return [u, v, offset];
  if (plane === 'top') return [u, offset, -v];
  return [offset, v, -u];
}

export function PlaneQuad({ plane, size = 140, active, onPick }: { plane: PlaneName; size?: number; active?: boolean; onPick?: () => void }) {
  const rot: Vec3 = plane === 'front' ? [0, 0, 0] : plane === 'top' ? [-Math.PI / 2, 0, 0] : [0, Math.PI / 2, 0];
  return (
    <mesh rotation={rot} onClick={(e) => { e.stopPropagation(); onPick?.(); }}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial color={PLANE_INFO[plane].color} transparent opacity={active ? 0.16 : 0.05} side={2} depthWrite={false} />
    </mesh>
  );
}

export function SketchOnPlane({ sketch, plane, color = '#f8961e' }: { sketch: Sketch; plane: PlaneName; color?: string }) {
  return (
    <group>
      {sketch.entities.map((e) => {
        let pts: Vec2[];
        if (e.kind === 'line') pts = [pointOf(sketch, e.a), pointOf(sketch, e.b)];
        else if (e.kind === 'arc') pts = arcPoints(sketch, e);
        else {
          const c = pointOf(sketch, e.c);
          pts = Array.from({ length: 49 }, (_, i) => [c[0] + e.r * Math.cos((i / 48) * Math.PI * 2), c[1] + e.r * Math.sin((i / 48) * Math.PI * 2)] as Vec2);
        }
        return <Line key={e.id} points={pts.map((p) => toPlane(plane, p, 0.2))} color={color} lineWidth={2.5} />;
      })}
    </group>
  );
}
