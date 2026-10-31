import { Edges } from '@react-three/drei';
import { normalize, type Vox } from '../../lib/voxels';

export const VOX = 15;

export function voxelCenter(vs: Vox[]): [number, number, number] {
  const n = normalize(vs);
  const mx = [0, 1, 2].map((k) => Math.max(...n.map((v) => v[k])) + 1);
  return [(mx[0] * VOX) / 2, (mx[1] * VOX) / 2, (mx[2] * VOX) / 2];
}

/** Renders a voxel shape centred on X/Z, sitting on y = lift. */
export function Voxels({ vs, color = '#4cc9f0', lift = 0, opacity = 1, edges = true }: { vs: Vox[]; color?: string; lift?: number; opacity?: number; edges?: boolean }) {
  const n = normalize(vs);
  const c = voxelCenter(vs);
  return (
    <group position={[-c[0], lift, -c[2]]}>
      {n.map(([x, y, z]) => (
        <mesh key={`${x},${y},${z}`} position={[(x + 0.5) * VOX, (y + 0.5) * VOX, (z + 0.5) * VOX]} castShadow receiveShadow>
          <boxGeometry args={[VOX, VOX, VOX]} />
          <meshStandardMaterial color={color} roughness={0.45} transparent={opacity < 1} opacity={opacity} />
          {edges && <Edges color="#0b0f14" />}
        </mesh>
      ))}
    </group>
  );
}
