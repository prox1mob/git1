import { Edges, Line } from '@react-three/drei';
import { useMemo, useState } from 'react';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D, type ViewName } from '../../components/Stage3D';
import { ObjectGestures } from '../../components/three/ObjectGestures';
import { rng } from '../../lib/math';
import type { Feedback, LessonStep, Vec3 } from '../../lib/types';
import { vkey, type Vox } from '../../lib/voxels';
import { Seg } from '../../components/ui';

const S = 15;
const BOX: Vox = [3, 2, 3];
const COLORS = ['#4cc9f0', '#f8961e', '#90be6d', '#f94144', '#9b5de5', '#ffd166'];

interface Piece {
  cells: Vox[]; // relative to pivot (0,0,0)
  off: Vox; // grid offset of pivot
  sol: { cells: Vox[]; off: Vox };
  color: string;
}

const rot = (c: Vox, axis: 'x' | 'y' | 'z'): Vox => {
  const [x, y, z] = c;
  if (axis === 'x') return [x, -z, y];
  if (axis === 'y') return [z, y, -x];
  return [-y, x, z];
};

function generate(seed: number): Piece[] {
  const rand = rng(seed);
  for (let attempt = 0; attempt < 200; attempt++) {
    const all: Vox[] = [];
    for (let x = 0; x < BOX[0]; x++) for (let y = 0; y < BOX[1]; y++) for (let z = 0; z < BOX[2]; z++) all.push([x, y, z]);
    const k = 5;
    const owner = new Map<string, number>();
    const seeds = [...all].sort(() => rand() - 0.5).slice(0, k);
    seeds.forEach((s, i) => owner.set(vkey(s), i));
    let changed = true;
    while (owner.size < all.length && changed) {
      changed = false;
      for (const c of [...all].sort(() => rand() - 0.5)) {
        if (owner.has(vkey(c))) continue;
        const nb = [
          [1, 0, 0],
          [-1, 0, 0],
          [0, 1, 0],
          [0, -1, 0],
          [0, 0, 1],
          [0, 0, -1],
        ]
          .map((d) => owner.get(vkey([c[0] + d[0], c[1] + d[1], c[2] + d[2]])))
          .filter((v): v is number => v != null);
        if (nb.length) {
          const sizes = nb.map((i) => [...owner.values()].filter((v) => v === i).length);
          const best = nb[sizes.indexOf(Math.min(...sizes))];
          owner.set(vkey(c), best);
          changed = true;
        }
      }
    }
    const groups: Vox[][] = Array.from({ length: k }, () => []);
    for (const c of all) groups[owner.get(vkey(c))!].push(c);
    if (groups.some((g) => g.length < 2 || g.length > 5)) continue;
    let slot = -9;
    return groups.map((g, i) => {
      const pivot = g[0];
      const rel = g.map((c) => [c[0] - pivot[0], c[1] - pivot[1], c[2] - pivot[2]] as Vox);
      let cells = rel;
      const turns = Math.floor(rand() * 4);
      const axis = (['x', 'y', 'z'] as const)[Math.floor(rand() * 3)];
      for (let t = 0; t < turns; t++) cells = cells.map((c) => rot(c, axis));
      const mn = [0, 1, 2].map((d) => Math.min(...cells.map((c) => c[d])));
      const mxx = Math.max(...cells.map((c) => c[0])) - mn[0];
      const off: Vox = [slot - mn[0], -mn[1], 5 - mn[2] + (i % 2) * 0];
      slot += mxx + 2;
      return { cells, off, sol: { cells: rel, off: pivot }, color: COLORS[i % COLORS.length] };
    });
  }
  return [];
}

const worldOf = (c: Vox): Vec3 => [(c[0] + 0.5) * S - (BOX[0] * S) / 2, (c[1] + 0.5) * S, (c[2] + 0.5) * S - (BOX[2] * S) / 2];
const absCells = (p: { cells: Vox[]; off: Vox }) => p.cells.map((c) => [c[0] + p.off[0], c[1] + p.off[1], c[2] + p.off[2]] as Vox);
const inside = (c: Vox) => c.every((v, i) => v >= 0 && v < BOX[i]);

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'The wireframe is a 45 × 30 × 45 mm box. Five pieces lie on the floor. Together they fill the box exactly — no gaps, no overlaps.', ta: 'Wireframe பெட்டி 45 × 30 × 45 mm. ஐந்து துண்டுகள் சேர்ந்து அதை முழுமையாக நிரப்பும்.' },
  { stage: 'UNDERSTAND', text: 'Volume is conserved: 18 small cubes fit in the box, and the pieces contain exactly 18 cubes. Every piece must therefore end up inside, and any overlap means a gap elsewhere.', ta: 'கனஅளவு மாறாது: பெட்டியில் 18 சிறு cube-கள்; துண்டுகளிலும் சரியாக 18. Overlap இருந்தால் வேறெங்கோ இடைவெளி இருக்கும்.' },
  { stage: 'EXPERIMENT', text: 'Tap a piece (or pick it in the list). Move it one cell at a time, rotate it 90° about X, Y or Z, or switch to "☝ Drag" to slide it across the floor. Red cubes overlap.', ta: 'ஒரு துண்டைத் தட்டித் தேர்ந்தெடுங்கள். நகர்த்துங்கள், 90° சுழற்றுங்கள். சிவப்பு = overlap.' },
  { stage: 'BUILD', text: 'Fill the box. Hint: place the biggest, most awkward pieces first, and use the Top view to see the footprint.', ta: 'பெரிய, சிக்கலான துண்டுகளை முதலில் வையுங்கள். Top view பயன்படுத்துங்கள்.' },
];

export default function L6Puzzle() {
  const [seed, setSeed] = useState(() => Date.now() % 100000);
  const initial = useMemo(() => generate(seed), [seed]);
  const [pieces, setPieces] = useState<Piece[]>(initial);
  const [sel, setSel] = useState(0);
  const [view, setView] = useState<ViewName>('persp');
  const [mode, setMode] = useState<'buttons' | 'drag'>('buttons');
  const [corr, setCorr] = useState(false);
  const [moves, setMoves] = useState(0);

  const counts = new Map<string, number>();
  pieces.forEach((p) => absCells(p).forEach((c) => counts.set(vkey(c), (counts.get(vkey(c)) ?? 0) + 1)));
  const total = BOX[0] * BOX[1] * BOX[2];
  const filled = [...counts.entries()].filter(([k, n]) => n === 1 && inside(k.split(',').map(Number) as Vox)).length;
  const overlaps = [...counts.values()].filter((n) => n > 1).length;
  const solved = filled === total && overlaps === 0;

  const update = (i: number, f: (p: Piece) => Piece) => {
    setPieces((ps) => ps.map((p, j) => (j === i ? f(p) : p)));
    setMoves((m) => m + 1);
  };
  const move = (d: Vox) =>
    update(sel, (p) => {
      const off: Vox = [p.off[0] + d[0], p.off[1] + d[1], p.off[2] + d[2]];
      const minY = Math.min(...p.cells.map((c) => c[1] + off[1]));
      if (minY < 0) return p;
      return { ...p, off };
    });
  const turn = (axis: 'x' | 'y' | 'z') =>
    update(sel, (p) => {
      const cells = p.cells.map((c) => rot(c, axis));
      const minY = Math.min(...cells.map((c) => c[1] + p.off[1]));
      return { ...p, cells, off: minY < 0 ? [p.off[0], p.off[1] - minY, p.off[2]] : p.off };
    });

  const evaluate = (): Feedback => {
    const outside = pieces.filter((p) => absCells(p).some((c) => !inside(c))).length;
    const score = Math.max(0, Math.round((filled / total) * 100 - overlaps * 5));
    const correct: string[] = [];
    if (filled) correct.push(`${filled} of ${total} cells are filled cleanly.`);
    if (overlaps === 0) correct.push('No pieces overlap.');
    if (solved) correct.push(`Solved in ${moves} moves.`);
    const issues: Feedback['issues'] = [];
    if (overlaps) issues.push({ label: `${overlaps} cell(s) are occupied by two pieces.`, detail: 'Two solids can never share space — in an assembly this is a collision.' });
    if (outside) issues.push({ label: `${outside} piece(s) are fully or partly outside the box.` });
    if (total - filled - overlaps > 0 && !solved) issues.push({ label: `${total - filled} cell(s) of the box are still empty.` });
    return {
      score,
      correct,
      issues,
      why: 'Packing parts into a limited volume is everyday engineering: batteries and circuit boards inside a phone, parts on a 3D printer bed, boxes in a shipping container. Geometric constraints (no overlap, must fit) drive the whole layout.',
      suggestion: solved ? 'Try a new puzzle and aim for fewer moves: plan each piece’s final orientation before you move it.' : 'Start with the piece that has the fewest ways to fit (usually the largest or most twisted) and place it in a corner.',
      canShowCorrection: !solved,
    };
  };

  const p = pieces[sel];
  return (
    <LevelShell
      id="w1-l6"
      steps={steps}
      evaluate={evaluate}
      onCorrection={setCorr}
      onRetry={() => {
        const s = Date.now() % 100000;
        setSeed(s);
        setPieces(generate(s));
        setSel(0);
        setMoves(0);
      }}
      hints={[{ en: 'The box is only two cells tall. Any piece that is three cells long must lie flat.', ta: 'பெட்டி இரண்டு cell உயரம் மட்டுமே. மூன்று cell நீளமுள்ள துண்டு படுக்கையாக இருக்க வேண்டும்.' }]}
      viewport={
        <Stage3D
          fit={140}
          camera={[70, 170, 230]}
          target={[0, 10, 20]}
          view={view}
          onViewChange={setView}
          overlay={
            <div className="overlay-tl">
              <div className="hud">
                Filled {filled}/{total} · overlaps {overlaps} {solved && '· 🎉 Solved!'}
              </div>
            </div>
          }
        >
          <mesh position={[0, (BOX[1] * S) / 2, 0]}>
            <boxGeometry args={[BOX[0] * S, BOX[1] * S, BOX[2] * S]} />
            <meshBasicMaterial transparent opacity={0.04} color="#ffffff" depthWrite={false} />
            <Edges color={solved ? '#3fb950' : '#e8eef4'} />
          </mesh>
          {Array.from({ length: BOX[0] + 1 }, (_, i) => (
            <Line key={`gx${i}`} points={[[i * S - (BOX[0] * S) / 2, 0.2, -(BOX[2] * S) / 2], [i * S - (BOX[0] * S) / 2, 0.2, (BOX[2] * S) / 2]]} color="#35506b" lineWidth={1} />
          ))}
          {Array.from({ length: BOX[2] + 1 }, (_, i) => (
            <Line key={`gz${i}`} points={[[-(BOX[0] * S) / 2, 0.2, i * S - (BOX[2] * S) / 2], [(BOX[0] * S) / 2, 0.2, i * S - (BOX[2] * S) / 2]]} color="#35506b" lineWidth={1} />
          ))}
          {pieces.map((pc, i) =>
            absCells(pc).map((c) => {
              const over = (counts.get(vkey(c)) ?? 0) > 1;
              return (
                <mesh
                  key={`${i}-${vkey(c)}`}
                  position={worldOf(c)}
                  castShadow
                  onPointerDown={(e) => {
                    if (mode === 'drag') return;
                    e.stopPropagation();
                    setSel(i);
                  }}
                >
                  <boxGeometry args={[S - 0.6, S - 0.6, S - 0.6]} />
                  <meshStandardMaterial color={over ? '#f85149' : pc.color} emissive={i === sel ? '#ffffff' : '#000000'} emissiveIntensity={i === sel ? 0.18 : 0} roughness={0.5} />
                  <Edges color={i === sel ? '#ffffff' : '#0b0f14'} />
                </mesh>
              );
            }),
          )}
          {corr &&
            pieces.map((pc, i) =>
              absCells(pc.sol).map((c) => (
                <mesh key={`s${i}-${vkey(c)}`} position={worldOf(c)}>
                  <boxGeometry args={[S - 2, S - 2, S - 2]} />
                  <meshBasicMaterial color={pc.color} transparent opacity={0.35} depthWrite={false} />
                </mesh>
              )),
            )}
          {mode === 'drag' && p && (
            <ObjectGestures
              enabled
              axis="xz"
              snap={S}
              allowRotate={false}
              allowScale={false}
              get={() => ({ position: [pieces[sel].off[0] * S, 0, pieces[sel].off[2] * S], rotation: [0, 0, 0], scale: [1, 1, 1] })}
              onChange={(t) =>
                setPieces((ps) => ps.map((q, j) => (j === sel ? { ...q, off: [Math.round(t.position[0] / S), q.off[1], Math.round(t.position[2] / S)] } : q)))
              }
              onEnd={() => setMoves((m) => m + 1)}
            />
          )}
        </Stage3D>
      }
    >
      <div>
        <div className="lbl">Pieces</div>
        <div className="btnrow">
          {pieces.map((pc, i) => (
            <button key={i} className={`btn small ${i === sel ? 'on' : ''}`} onClick={() => setSel(i)} style={{ borderLeft: `6px solid ${pc.color}` }}>
              {i + 1} · {pc.cells.length} cubes
            </button>
          ))}
        </div>
      </div>
      <Seg value={mode} onChange={setMode} options={[{ v: 'buttons', label: 'Tap to select' }, { v: 'drag', label: '☝ Drag on floor' }]} />
      <div>
        <div className="lbl">Move selected piece (one cell = 15 mm)</div>
        <div className="btnrow">
          <button className="btn small x" onClick={() => move([-1, 0, 0])}>−X</button>
          <button className="btn small x" onClick={() => move([1, 0, 0])}>+X</button>
          <button className="btn small y" onClick={() => move([0, -1, 0])}>−Y</button>
          <button className="btn small y" onClick={() => move([0, 1, 0])}>+Y</button>
          <button className="btn small z" onClick={() => move([0, 0, -1])}>−Z</button>
          <button className="btn small z" onClick={() => move([0, 0, 1])}>+Z</button>
        </div>
      </div>
      <div>
        <div className="lbl">Rotate selected piece 90°</div>
        <div className="btnrow">
          <button className="btn small x" onClick={() => turn('x')}>⟲ X</button>
          <button className="btn small y" onClick={() => turn('y')}>⟲ Y</button>
          <button className="btn small z" onClick={() => turn('z')}>⟲ Z</button>
        </div>
      </div>
      <div className="muted" style={{ fontSize: 13 }}>Moves: {moves}</div>
    </LevelShell>
  );
}
