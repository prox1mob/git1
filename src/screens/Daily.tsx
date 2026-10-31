import { useMemo } from 'react';
import { BuildChallenge, type BuildTarget } from '../components/BuildChallenge';
import { makeObject, PALETTE, type PrimType, type SceneObject } from '../lib/shapes';
import { hashString, rng, todayKey } from '../lib/math';
import { useProgress } from '../store/progress';
import type { LessonStep } from '../lib/types';

/** Deterministic daily target: a stacked composition of 3–4 primitives with tidy dimensions. */
export function dailyTarget(date: string): BuildTarget {
  const rand = rng(hashString(date));
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const r5 = (a: number, b: number) => Math.round((a + rand() * (b - a)) / 5) * 5;
  const parts: SceneObject[] = [];
  const mat = (i: number) => ({ preset: 'abs', color: PALETTE[(i + Math.floor(rand() * 5)) % PALETTE.length], roughness: 0.45, metalness: 0, opacity: 1 });
  // base
  const baseType = pick<PrimType>(['box', 'cylinder']);
  const bh = r5(10, 20);
  const base = baseType === 'box' ? makeObject('box', { name: 'Base', dims: { w: r5(50, 80), h: bh, d: r5(40, 60) }, position: [0, bh / 2, 0], material: mat(0) }) : makeObject('cylinder', { name: 'Base', dims: { r: r5(25, 35), h: bh }, position: [0, bh / 2, 0], material: mat(0) });
  parts.push(base);
  let top = bh;
  const n = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) {
    const t = pick<PrimType>(['box', 'cylinder', 'sphere', 'cone']);
    const last = i === n - 1;
    const type: PrimType = !last && (t === 'cone' || t === 'sphere') ? 'cylinder' : t;
    if (type === 'box') {
      const h = r5(10, 30);
      parts.push(makeObject('box', { name: `Block ${i + 1}`, dims: { w: r5(15, 40), h, d: r5(15, 35) }, position: [0, top + h / 2, 0], material: mat(i + 1) }));
      top += h;
    } else if (type === 'cylinder') {
      const h = r5(10, 35);
      parts.push(makeObject('cylinder', { name: `Cylinder ${i + 1}`, dims: { r: r5(5, 15), h }, position: [0, top + h / 2, 0], material: mat(i + 1) }));
      top += h;
    } else if (type === 'sphere') {
      const r = r5(10, 15);
      parts.push(makeObject('sphere', { name: 'Sphere top', dims: { r }, position: [0, top + r, 0], material: mat(i + 1) }));
      top += 2 * r;
    } else {
      const h = r5(15, 30);
      parts.push(makeObject('cone', { name: 'Cone top', dims: { r: r5(10, 20), h }, position: [0, top + h / 2, 0], material: mat(i + 1) }));
      top += h;
    }
  }
  // a side feature offset on X
  if (rand() < 0.7) {
    const h = r5(15, 30);
    const x = baseType === 'box' ? (base.dims.w / 2) - 10 : base.dims.r - 8;
    parts.push(makeObject('cylinder', { name: 'Side post', dims: { r: 5, h }, position: [x, bh + h / 2, 0], material: mat(7) }));
  }
  return {
    name: `Daily build ${date}`,
    blurb: `Today’s target has ${parts.length} parts. Every dimension is a multiple of 5 mm. Match each part’s shape, size and position.`,
    parts,
  };
}

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'A new target appears every day. Study the reference on the left: count the parts and read their proportions.', ta: 'ஒவ்வொரு நாளும் புதிய இலக்கு. இடப்புற மாதிரியைப் பாருங்கள்.' },
  { stage: 'BUILD', text: 'Rebuild it on the ghost. Select a part and type its sizes; every dimension is a multiple of 5 mm.', ta: 'Ghost மீது மீண்டும் கட்டுங்கள். எல்லா அளவுகளும் 5 mm-இன் மடங்குகள்.' },
  { stage: 'TEST', text: 'Check your work. Your best score today counts towards XP and the Daily Practice badge.', ta: 'உங்கள் இன்றைய சிறந்த மதிப்பெண் XP-க்குக் கணக்கிடப்படும்.' },
];

export default function Daily() {
  const date = todayKey();
  const target = useMemo(() => dailyTarget(date), [date]);
  const recordDaily = useProgress((s) => s.recordDaily);
  const best = useProgress((s) => s.daily[date]);
  return (
    <BuildChallenge
      id={`daily-${date}`}
      title={`Daily 3D Challenge · ${date}${best != null ? ` · best ${best}` : ''}`}
      backTo="/"
      steps={steps}
      targets={[target]}
      recorder={(score) => recordDaily(date, score)}
      allowed={['box', 'sphere', 'cylinder', 'cone']}
      why="Short daily practice builds fluency: reading proportions, estimating sizes and placing parts precisely become automatic."
      hints={[{ en: 'Parts are stacked: each part’s bottom is the previous part’s top. Position = bottom + half the height.', ta: 'பாகங்கள் அடுக்கப்பட்டுள்ளன: நிலை = அடிப்பகுதி + பாதி உயரம்.' }]}
    />
  );
}
