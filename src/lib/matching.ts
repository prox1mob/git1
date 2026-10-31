import * as THREE from 'three';
import { objectBox, PRIM_LABEL, type SceneObject } from './shapes';
import { fmt, scoreFromError } from './math';
import type { Feedback, Vec3 } from './types';

export interface PairResult {
  t: SceneObject;
  u: SceneObject;
  typeOk: boolean;
  posErr: number;
  dPos: Vec3;
  sizeErr: number; // worst relative size error
  sizeT: Vec3;
  sizeU: Vec3;
  score: number;
}

function center(o: SceneObject): Vec3 {
  const b = objectBox(o);
  const c = new THREE.Vector3();
  b.getCenter(c);
  return [c.x, c.y, c.z];
}
function size(o: SceneObject): Vec3 {
  const b = objectBox(o);
  const s = new THREE.Vector3();
  b.getSize(s);
  return [s.x, s.y, s.z];
}

/**
 * Greedy matching of target parts to user parts using world bounding boxes.
 * Works for any orientation because it compares where material is, not raw parameters.
 */
export function matchParts(target: SceneObject[], user: SceneObject[], posTol: number, relTol: number) {
  const tc = target.map(center),
    ts = target.map(size);
  const uc = user.map(center),
    us = user.map(size);
  const cand: { i: number; j: number; cost: number }[] = [];
  target.forEach((t, i) =>
    user.forEach((u, j) => {
      const d = Math.hypot(tc[i][0] - uc[j][0], tc[i][1] - uc[j][1], tc[i][2] - uc[j][2]);
      const se = Math.max(...[0, 1, 2].map((k) => Math.abs(us[j][k] - ts[i][k]) / Math.max(ts[i][k], 1)));
      cand.push({ i, j, cost: d / Math.max(posTol, 1) + se * 4 + (t.type === u.type ? 0 : 6) });
    }),
  );
  cand.sort((a, b) => a.cost - b.cost);
  const usedT = new Set<number>(),
    usedU = new Set<number>();
  const pairs: PairResult[] = [];
  for (const c of cand) {
    if (usedT.has(c.i) || usedU.has(c.j)) continue;
    usedT.add(c.i);
    usedU.add(c.j);
    const t = target[c.i],
      u = user[c.j];
    const dPos: Vec3 = [tc[c.i][0] - uc[c.j][0], tc[c.i][1] - uc[c.j][1], tc[c.i][2] - uc[c.j][2]];
    const posErr = Math.hypot(...dPos);
    const sizeErr = Math.max(...[0, 1, 2].map((k) => Math.abs(us[c.j][k] - ts[c.i][k]) / Math.max(ts[c.i][k], 1)));
    const typeOk = t.type === u.type || (t.type === 'cylinder' && u.type === 'prism' && (u.dims.sides ?? 3) >= 12);
    const score = (typeOk ? 30 : 0) + 0.4 * scoreFromError(posErr, posTol) + 0.3 * scoreFromError(sizeErr, relTol);
    pairs.push({ t, u, typeOk, posErr, dPos, sizeErr, sizeT: ts[c.i], sizeU: us[c.j], score });
  }
  const missing = target.filter((_, i) => !usedT.has(i));
  const extra = user.filter((_, j) => !usedU.has(j));
  const base = target.length ? pairs.reduce((s, p) => s + p.score, 0) / target.length : 0;
  const score = Math.max(0, Math.round(base - Math.min(20, extra.length * 5)));
  return { pairs, missing, extra, score };
}

const axisWord = (d: Vec3, tol: number) =>
  (['X', 'Y', 'Z'] as const)
    .map((a, k) => (Math.abs(d[k]) > tol ? `${a} ${d[k] > 0 ? '+' : ''}${fmt(d[k])}` : null))
    .filter(Boolean)
    .join(', ');

export function matchFeedback(m: ReturnType<typeof matchParts>, posTol: number, relTol: number, why: string): Feedback {
  const correct: string[] = [];
  const issues: Feedback['issues'] = [];
  for (const p of m.pairs) {
    const name = p.t.name;
    const bits: string[] = [];
    if (!p.typeOk) bits.push(`used a ${PRIM_LABEL[p.u.type].toLowerCase()} instead of a ${PRIM_LABEL[p.t.type].toLowerCase()}`);
    if (p.posErr > posTol) bits.push(`move ${axisWord(p.dPos, posTol)} mm`);
    if (p.sizeErr > relTol)
      bits.push(
        `size is ${p.sizeU.map((v) => fmt(v)).join('×')} mm, target ${p.sizeT.map((v) => fmt(v)).join('×')} mm`,
      );
    if (!bits.length) correct.push(`${name}: right shape, position and size.`);
    else issues.push({ label: `${name}: ${bits[0]}.`, detail: bits.slice(1).join('; ') || undefined });
  }
  for (const t of m.missing) issues.push({ label: `${t.name} is missing.`, detail: `Add a ${PRIM_LABEL[t.type].toLowerCase()} for it.` });
  if (m.extra.length) issues.push({ label: `${m.extra.length} extra shape(s) not in the target.`, detail: 'Each extra shape costs 5 points (max 20).' });
  const worst = [...m.pairs].sort((a, b) => a.score - b.score)[0];
  return {
    score: m.score,
    correct,
    issues,
    why,
    suggestion: m.missing.length
      ? `Add the missing ${m.missing[0].name.toLowerCase()} first — every part counts equally.`
      : worst && worst.score < 95
        ? `Fix ${worst.t.name.toLowerCase()}: select it and type its exact position and size in the panel rather than dragging.`
        : 'Turn off the in-place ghost and rebuild it from the reference model alone.',
    canShowCorrection: m.score < 100,
  };
}
