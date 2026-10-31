import { Edges } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';

export type Role = 'Power' | 'Light source' | 'Optics' | 'Control' | 'Structure' | 'Sealing';
export interface FPart {
  id: string;
  name: string;
  role: Role;
  y0: number; // bottom (assembled), mm along the axis
  h: number;
  r: number;
  color: string;
  kind: 'cyl' | 'ring' | 'cone' | 'disc';
}

/** A simple torch assembly along the Y axis. */
export const FLASHLIGHT: FPart[] = [
  { id: 'tail', name: 'Tail cap', role: 'Structure', y0: 0, h: 14, r: 15, color: '#577590', kind: 'cyl' },
  { id: 'switch', name: 'Push switch', role: 'Control', y0: 12, h: 6, r: 8, color: '#f94144', kind: 'cyl' },
  { id: 'battery', name: '18650 battery', role: 'Power', y0: 18, h: 65, r: 9, color: '#f8961e', kind: 'cyl' },
  { id: 'body', name: 'Body tube', role: 'Structure', y0: 12, h: 80, r: 13, color: '#b7bcc4', kind: 'ring' },
  { id: 'oring', name: 'O-ring', role: 'Sealing', y0: 90, h: 2, r: 14, color: '#1e2126', kind: 'ring' },
  { id: 'driver', name: 'LED driver board', role: 'Power', y0: 86, h: 3, r: 12, color: '#2e7d32', kind: 'disc' },
  { id: 'led', name: 'LED', role: 'Light source', y0: 90, h: 3, r: 5, color: '#ffd166', kind: 'cyl' },
  { id: 'reflector', name: 'Reflector', role: 'Optics', y0: 92, h: 20, r: 17, color: '#e9edf2', kind: 'cone' },
  { id: 'lens', name: 'Glass lens', role: 'Optics', y0: 112, h: 3, r: 18, color: '#a8dadc', kind: 'disc' },
  { id: 'bezel', name: 'Bezel (head ring)', role: 'Structure', y0: 108, h: 10, r: 19, color: '#577590', kind: 'ring' },
];

export function PartMesh({ p, y, selected, onPick, opacity = 1 }: { p: FPart; y: number; selected?: boolean; onPick?: (e: ThreeEvent<MouseEvent>) => void; opacity?: number }) {
  const mat = <meshStandardMaterial color={p.color} metalness={p.kind === 'ring' || p.kind === 'cone' ? 0.6 : 0.2} roughness={0.35} transparent={opacity < 1 || p.id === 'lens'} opacity={p.id === 'lens' ? 0.5 : opacity} emissive={selected ? '#1f6f8f' : '#000'} emissiveIntensity={selected ? 0.6 : 0} />;
  return (
    <group position={[0, y + p.h / 2, 0]} onClick={onPick}>
      {p.kind === 'ring' ? (
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[p.r - 1, p.id === 'oring' ? 1 : 1.6, 12, 48]} />
          {mat}
        </mesh>
      ) : p.kind === 'cone' ? (
        <mesh castShadow>
          <cylinderGeometry args={[p.r, 6, p.h, 40, 1, true]} />
          {mat}
        </mesh>
      ) : (
        <mesh castShadow>
          <cylinderGeometry args={[p.r, p.r, p.h, 40]} />
          {mat}
          {selected && <Edges color="#9ff0ff" />}
        </mesh>
      )}
      {p.id === 'body' && (
        <mesh>
          <cylinderGeometry args={[p.r, p.r, p.h, 40, 1, true]} />
          <meshStandardMaterial color={p.color} metalness={0.7} roughness={0.3} transparent opacity={0.25 * opacity} side={2} />
        </mesh>
      )}
    </group>
  );
}
