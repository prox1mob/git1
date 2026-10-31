/**
 * A tiny 2D pin-jointed truss solver (direct stiffness method).
 * Simplified teaching model: straight members, pinned joints, small deflections,
 * every member equally stiff. Not an engineering design tool.
 */
export interface TNode { x: number; y: number }
export interface TMember { a: number; b: number }
export interface Support { node: number; fx: boolean; fy: boolean }
export interface Load { node: number; fx: number; fy: number }

export type TrussResult =
  | { ok: true; u: number[]; forces: number[] }
  | { ok: false; reason: 'mechanism' | 'empty' };

export function solveTruss(nodes: TNode[], members: TMember[], supports: Support[], loads: Load[], EA = 1e4): TrussResult {
  const n = nodes.length * 2;
  if (!members.length || !n) return { ok: false, reason: 'empty' };
  const K = Array.from({ length: n }, () => new Float64Array(n));
  const geo = members.map(({ a, b }) => {
    const dx = nodes[b].x - nodes[a].x;
    const dy = nodes[b].y - nodes[a].y;
    const L = Math.hypot(dx, dy);
    return { c: dx / L, s: dy / L, L };
  });
  members.forEach(({ a, b }, i) => {
    const { c, s, L } = geo[i];
    const k = EA / L;
    const m = [c * c, c * s, s * s];
    const local = [
      [m[0], m[1], -m[0], -m[1]],
      [m[1], m[2], -m[1], -m[2]],
      [-m[0], -m[1], m[0], m[1]],
      [-m[1], -m[2], m[1], m[2]],
    ];
    const dof = [2 * a, 2 * a + 1, 2 * b, 2 * b + 1];
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) K[dof[r]][dof[q]] += k * local[r][q];
  });
  const f = new Float64Array(n);
  loads.forEach((l) => {
    f[2 * l.node] += l.fx;
    f[2 * l.node + 1] += l.fy;
  });
  const fixed = new Set<number>();
  supports.forEach((s) => {
    if (s.fx) fixed.add(2 * s.node);
    if (s.fy) fixed.add(2 * s.node + 1);
  });
  const free = Array.from({ length: n }, (_, i) => i).filter((i) => !fixed.has(i));
  const m = free.length;
  const A = free.map((r) => [...free.map((q) => K[r][q]), f[r]]);
  const scale = Math.max(1e-12, ...free.map((r) => Math.abs(K[r][r])));
  for (let col = 0; col < m; col++) {
    let piv = col;
    for (let r = col + 1; r < m; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-9 * scale) return { ok: false, reason: 'mechanism' };
    [A[col], A[piv]] = [A[piv], A[col]];
    for (let r = 0; r < m; r++) {
      if (r === col) continue;
      const k = A[r][col] / A[col][col];
      if (k === 0) continue;
      for (let q = col; q <= m; q++) A[r][q] -= k * A[col][q];
    }
  }
  const u = new Array(n).fill(0);
  free.forEach((dof, i) => (u[dof] = A[i][m] / A[i][i]));
  const forces = members.map(({ a, b }, i) => {
    const { c, s, L } = geo[i];
    return (EA / L) * (c * (u[2 * b] - u[2 * a]) + s * (u[2 * b + 1] - u[2 * a + 1]));
  });
  return { ok: true, u, forces };
}
