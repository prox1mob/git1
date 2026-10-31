import { normalize, projectionEdges, type Projection, type Vox } from '../lib/voxels';

export function ProjectionSvg({ p, size = 140, color = '#4cc9f0' }: { p: Projection; size?: number; color?: string }) {
  const c = Math.min((size - 16) / Math.max(p.w, p.h), 34);
  const W = p.w * c + 16,
    H = p.h * c + 16;
  const segs = projectionEdges(p);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ maxWidth: '100%' }}>
      <g transform="translate(8 8)">
        {p.cells.flatMap((row, r) =>
          row.map((d, col) => (d == null ? null : <rect key={`${r}-${col}`} x={col * c} y={r * c} width={c} height={c} fill={color} opacity={0.12 + 0.1 * d} />)),
        )}
        {segs.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1 * c} y1={y1 * c} x2={x2 * c} y2={y2 * c} stroke="#e8eef4" strokeWidth={2} strokeLinecap="round" />
        ))}
      </g>
    </svg>
  );
}

/** Isometric drawing of a voxel shape (painter's algorithm, hidden faces culled). */
export function IsoSvg({ vs, size = 150, color = [76, 201, 240] }: { vs: Vox[]; size?: number; color?: [number, number, number] }) {
  const n = normalize(vs);
  const has = new Set(n.map((v) => v.join(',')));
  const s = 1;
  const cx = Math.cos(Math.PI / 6),
    sy = Math.sin(Math.PI / 6);
  const P = (x: number, y: number, z: number) => [(x - z) * cx * s, -y * s + (x + z) * sy * s];
  const pts = n.flatMap(([x, y, z]) => [P(x, y, z), P(x + 1, y + 1, z + 1), P(x + 1, y, z), P(x, y, z + 1), P(x, y + 1, z), P(x + 1, y + 1, z), P(x, y + 1, z + 1)]);
  const minX = Math.min(...pts.map((p) => p[0])),
    maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1])),
    maxY = Math.max(...pts.map((p) => p[1]));
  const k = (size - 12) / Math.max(maxX - minX, maxY - minY);
  const T = (p: number[]) => `${((p[0] - minX) * k + 6).toFixed(1)},${((p[1] - minY) * k + 6).toFixed(1)}`;
  const shade = (f: number) => `rgb(${Math.round(color[0] * f)},${Math.round(color[1] * f)},${Math.round(color[2] * f)})`;
  const sorted = [...n].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]) || a[1] - b[1]);
  const W = (maxX - minX) * k + 12,
    H = (maxY - minY) * k + 12;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ maxWidth: '100%' }}>
      {sorted.map(([x, y, z]) => {
        const faces: { pts: number[][]; f: number }[] = [];
        if (!has.has(`${x},${y + 1},${z}`)) faces.push({ pts: [P(x, y + 1, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], f: 1 });
        if (!has.has(`${x + 1},${y},${z}`)) faces.push({ pts: [P(x + 1, y, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x + 1, y, z + 1)], f: 0.62 });
        if (!has.has(`${x},${y},${z + 1}`)) faces.push({ pts: [P(x, y, z + 1), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], f: 0.8 });
        return faces.map((fc, i) => <polygon key={`${x}${y}${z}${i}`} points={fc.pts.map(T).join(' ')} fill={shade(fc.f)} stroke="#0b0f14" strokeWidth={1.2} strokeLinejoin="round" />);
      })}
    </svg>
  );
}
