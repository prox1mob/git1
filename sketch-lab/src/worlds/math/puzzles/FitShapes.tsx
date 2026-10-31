import { useRef, useState } from 'react';
import { randInt } from '../../../core/geometry';
import { useHistory } from '../../../core/history';
import { useSettings, type Difficulty } from '../../../core/store';
import { partition, rotateCells, type Cell, type PieceDef } from '../../../core/tiling';
import { Challenge, type CheckResult } from '../../../ui/feedback';
import { DesignLink, Stat, Stats, ToolBar } from '../../../ui/kit';
import { Workbench } from '../../../ui/lesson';
import { useSvgDrag } from '../../../ui/svg';

const C = 46;
const OX = 30;
const OY = 60;
const W = 800;
const H = 540;
const COLORS = ['#ff922b', '#4dabf7', '#69db7c', '#f783ac', '#ffd43b', '#9775fa', '#3bc9db', '#ff8787'];

interface Piece {
  cells: Cell[];
  x: number;
  y: number;
}

function setup(d: Difficulty) {
  const [cols, rows, n] = d === 'easy' ? [4, 3, 3] : d === 'normal' ? [5, 4, 5] : [6, 5, 7];
  const defs = partition(cols, rows, n, Math.random, 2, d === 'hard' ? 6 : 7);
  const startX = cols + 1;
  const maxX = (W - OX) / C - 0.2;
  let px = startX;
  let py = -0.6;
  let rowH = 0;
  const pieces: Piece[] = defs.map((def) => {
    let cells = def.cells;
    for (let r = randInt(0, 3); r > 0; r--) cells = rotateCells(cells);
    const w = Math.max(...cells.map((c) => c[0])) + 1;
    const h = Math.max(...cells.map((c) => c[1])) + 1;
    if (px + w > maxX) {
      px = startX;
      py += rowH + 0.4;
      rowH = 0;
    }
    const p = { cells, x: px, y: py };
    px += w + 0.4;
    rowH = Math.max(rowH, h);
    return p;
  });
  return { cols, rows, defs, pieces };
}

function PieceView({ p, i, onMove, onDrop, onStart, onTap, bad }: {
  p: Piece; i: number; onMove: (x: number, y: number) => void; onDrop: () => void; onStart: () => void; onTap: () => void; bad: Set<string>;
}) {
  const start = useRef({ x: p.x, y: p.y });
  const moved = useRef(false);
  const drag = useSvgDrag({
    onStart: () => {
      start.current = { x: p.x, y: p.y };
      moved.current = false;
      onStart();
    },
    onMove: (q, s) => {
      const dx = (q.x - s.x) / C;
      const dy = (q.y - s.y) / C;
      if (Math.abs(dx) + Math.abs(dy) > 0.12) moved.current = true;
      onMove(start.current.x + dx, start.current.y + dy);
    },
    onEnd: () => (moved.current ? onDrop() : onTap()),
  });
  return (
    <g transform={`translate(${OX + p.x * C} ${OY + p.y * C})`} style={{ cursor: 'grab' }} {...drag}>
      {p.cells.map(([cx, cy], k) => {
        const gx = Math.round(p.x) + cx;
        const gy = Math.round(p.y) + cy;
        const isBad = bad.has(`${gx},${gy}`);
        return <rect key={k} x={cx * C + 2} y={cy * C + 2} width={C - 4} height={C - 4} rx={6} fill={COLORS[i % COLORS.length]} stroke={isBad ? '#e5484d' : '#fff'} strokeWidth={isBad ? 4 : 2} />;
      })}
      <text x={p.cells[0][0] * C + C / 2} y={p.cells[0][1] * C + C / 2 + 5} textAnchor="middle" fontSize={13} fontWeight={800} fill="#fff" pointerEvents="none">{p.cells.length}</text>
    </g>
  );
}

export default function FitShapes() {
  const { difficulty } = useSettings();
  const [game, setGame] = useState(() => setup(difficulty));
  const h = useHistory<Piece[]>(game.pieces);
  const [ghost, setGhost] = useState(false);
  const { cols, rows } = game;
  const pieces = h.value;

  const occupancy = new Map<string, number>();
  let outside = 0;
  let placed = 0;
  pieces.forEach((p) => {
    let inTray = 0;
    p.cells.forEach(([cx, cy]) => {
      const gx = Math.round(p.x) + cx;
      const gy = Math.round(p.y) + cy;
      if (gx >= 0 && gy >= 0 && gx < cols && gy < rows) {
        inTray++;
        occupancy.set(`${gx},${gy}`, (occupancy.get(`${gx},${gy}`) ?? 0) + 1);
      }
    });
    if (inTray === p.cells.length) placed++;
    else if (inTray > 0) outside++;
  });
  const bad = new Set([...occupancy.entries()].filter(([, n]) => n > 1).map(([k]) => k));
  const covered = occupancy.size;
  const total = pieces.reduce((s, p) => s + p.cells.length, 0);

  const fresh = () => {
    const g = setup(difficulty);
    setGame(g);
    h.reset(g.pieces);
    setGhost(false);
  };

  const check = (): CheckResult => {
    if (bad.size) return { ok: false, happened: `${bad.size} square${bad.size > 1 ? 's are' : ' is'} covered twice (red outlines).`, why: 'Pieces cannot overlap. The tray has exactly enough room for every piece — any overlap means a gap somewhere else.' };
    if (outside) return { ok: false, happened: `${outside} piece${outside > 1 ? 's stick' : ' sticks'} out over the edge of the tray.`, why: 'Every square of every piece must be inside the tray.' };
    if (placed < pieces.length) return { ok: false, happened: `${pieces.length - placed} piece${pieces.length - placed > 1 ? 's are' : ' is'} still waiting outside. ${cols * rows - covered} empty squares left.`, why: `The tray holds ${cols * rows} squares and the pieces add up to ${total}, so every piece must go in with no gaps.` };
    return { ok: true, happened: `All ${pieces.length} pieces fit — ${cols} × ${rows} = ${cols * rows} squares, no gaps, no overlaps.`, why: 'Packing engineers do this with products in boxes and parts on sheets of material.' };
  };

  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} ${H}`}>
      <text x={OX} y={OY - 14} className="svg-label" fill="#495057">Tray {cols} × {rows} = {cols * rows} squares</text>
      <text x={OX + (cols + 1) * C} y={OY - 14} className="svg-label" fill="#868e96">Pieces (number = its area)</text>
      <rect x={OX} y={OY} width={cols * C} height={rows * C} fill="#f1f3f5" stroke="#495057" strokeWidth={3} rx={4} />
      {Array.from({ length: cols * rows }, (_, i) => (
        <rect key={i} x={OX + (i % cols) * C + 2} y={OY + Math.floor(i / cols) * C + 2} width={C - 4} height={C - 4} rx={6} fill="none" stroke="#dee2e6" strokeDasharray="4 4" />
      ))}
      {ghost && game.defs.map((d: PieceDef, i) => d.cells.map(([cx, cy], k) => (
        <rect key={`${i}-${k}`} x={OX + (d.home[0] + cx) * C + 6} y={OY + (d.home[1] + cy) * C + 6} width={C - 12} height={C - 12} rx={4} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth={3} strokeDasharray="5 3" />
      )))}
      {pieces.map((p, i) => (
        <PieceView key={i} p={p} i={i} bad={bad} onStart={h.checkpoint}
          onMove={(x, y) => h.set((s) => s.map((q, j) => (j === i ? { ...q, x, y } : q)))}
          onDrop={() => h.set((s) => s.map((q, j) => (j === i ? { ...q, x: Math.round(q.x), y: Math.round(q.y) } : q)))}
          onTap={() => h.set((s) => s.map((q, j) => (j === i ? { ...q, cells: rotateCells(q.cells) } : q)))} />
      ))}
      <text x={OX} y={H - 16} fontSize={13} fill="#868e96">Drag to move · tap a piece to rotate it 90°</text>
    </svg>
  );
  const panel = (
    <Challenge
      id="puzzle-fit"
      title="Fit the Shapes"
      brief={<p>Pack every piece into the tray. Tap a piece to turn it. No overlaps, nothing sticking out.</p>}
      check={check}
      onNewTarget={fresh}
      hint="Count first: tray area = pieces' total area, so there can be no gaps. Put the biggest or most awkward piece in a corner first."
      solution={<><p>One arrangement is outlined in the tray (pieces may need turning to match).</p><button className="btn small" onClick={() => setGhost(true)}>Show the outlines</button></>}
    >
      <Stats>
        <Stat label="tray area" value={`${cols * rows}`} sub={`${cols} × ${rows}`} />
        <Stat label="pieces' area" value={`${total}`} sub={pieces.map((p) => p.cells.length).join(' + ')} />
        <Stat label="covered" value={`${covered}/${cols * rows}`} color={covered === cols * rows && !bad.size ? '#2b8a3e' : undefined} />
      </Stats>
      <DesignLink>Fitting parts on a sheet (nesting) saves material; fitting products in a carton saves shipping space. Both start with area: total of the parts vs space available.</DesignLink>
    </Challenge>
  );
  return <Workbench title="Fit the Shapes" tool={tool} controls={<ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset(game.pieces)} />} panel={panel} />;
}
