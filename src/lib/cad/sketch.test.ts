import { describe, expect, it } from 'vitest';
import { addCircle, addRect, analyse, closedLoops, dragSolve, solve, sid, type Sketch } from './sketch';

function rect(): Sketch {
  return addRect({ points: [], entities: [], constraints: [] }, 0, 0, 55, 37);
}

describe('constraint solver', () => {
  it('reports degrees of freedom for an unconstrained rectangle', () => {
    const info = analyse(rect());
    // 8 coordinates, 4 H/V equations -> 4 DOF (x, y position + width + height)
    expect(info.dof).toBe(4);
    expect(info.status).toBe('under');
  });

  it('becomes fully constrained with an anchor and two dimensions', () => {
    let s = rect();
    const [p0, p1, , p3] = s.points;
    s = {
      ...s,
      constraints: [
        ...s.constraints,
        { id: sid('c'), type: 'fix', refs: [p0.id], x: 0, y: 0 },
        { id: sid('c'), type: 'hdist', refs: [p0.id, p1.id], value: 60 },
        { id: sid('c'), type: 'vdist', refs: [p0.id, p3.id], value: 40 },
      ],
    };
    s = solve(s);
    const info = analyse(s);
    expect(info.status).toBe('full');
    expect(info.dof).toBe(0);
    expect(s.points[2].x).toBeCloseTo(60, 4);
    expect(s.points[2].y).toBeCloseTo(40, 4);
    expect(info.determinedPoints.size).toBe(4);
  });

  it('detects conflicting dimensions', () => {
    let s = rect();
    const [p0, p1, p2] = s.points;
    const l0 = s.entities[0].id;
    const l2 = s.entities[2].id;
    s = {
      ...s,
      constraints: [
        ...s.constraints,
        { id: sid('c'), type: 'hdist', refs: [p0.id, p1.id], value: 60 },
        { id: sid('c'), type: 'equal', refs: [l0, l2] },
        { id: sid('c'), type: 'distance', refs: [p2.id, p1.id], value: 20 },
        { id: sid('c'), type: 'vdist', refs: [p1.id, p2.id], value: 30 },
      ],
    };
    s = solve(s);
    expect(analyse(s).status).toBe('conflict');
  });

  it('solves tangency between a line and a circle', () => {
    let s = rect();
    let cid: string;
    [s, cid] = addCircle(s, 20, 30, 5);
    const top = s.entities[2].id;
    s = {
      ...s,
      constraints: [...s.constraints, { id: sid('c'), type: 'tangent', refs: [top, cid] }, { id: sid('c'), type: 'radius', refs: [cid], value: 8 }],
    };
    s = solve(s);
    const c = s.points.find((p) => p.id === (s.entities.find((e) => e.id === cid) as { c: string }).c)!;
    const topY = s.points[2].y;
    expect(Math.abs(Math.abs(topY - c.y) - 8)).toBeLessThan(1e-4);
  });

  it('keeps constraints while dragging', () => {
    let s = rect();
    s = dragSolve(s, s.points[2].id, [80, 50]);
    expect(s.points[1].y).toBeCloseTo(s.points[0].y, 5);
    expect(s.points[2].x).toBeCloseTo(s.points[1].x, 5);
    expect(s.points[2].x).toBeCloseTo(80, 3);
  });

  it('finds closed loops including circles', () => {
    let s = rect();
    [s] = addCircle(s, 20, 20, 5);
    const { loops, openEnds } = closedLoops(s);
    expect(loops.length).toBe(2);
    expect(openEnds).toBe(0);
  });
});
