/** Cut a cols × rows tray into random connected pieces (so the puzzle is always solvable). */
export type Cell = [number, number];

export interface PieceDef {
  cells: Cell[]; // normalised so min x = min y = 0
  home: Cell; // where its top-left sits in the solution
}

export function normalise(cells: Cell[]): { cells: Cell[]; dx: number; dy: number } {
  const dx = Math.min(...cells.map((c) => c[0]));
  const dy = Math.min(...cells.map((c) => c[1]));
  return { cells: cells.map(([x, y]) => [x - dx, y - dy] as Cell).sort((a, b) => a[1] - b[1] || a[0] - b[0]), dx, dy };
}

/** Rotate a piece 90° clockwise (in screen coordinates). */
export function rotateCells(cells: Cell[]): Cell[] {
  return normalise(cells.map(([x, y]) => [-y, x] as Cell)).cells;
}

export function partition(cols: number, rows: number, pieces: number, rand: () => number = Math.random, minSize = 2, maxSize = 7): PieceDef[] {
  for (let attempt = 0; attempt < 400; attempt++) {
    const owner: number[] = new Array(cols * rows).fill(-1);
    const all = Array.from({ length: cols * rows }, (_, i) => i);
    const seeds: number[] = [];
    while (seeds.length < pieces) {
      const s = all[Math.floor(rand() * all.length)];
      if (!seeds.includes(s)) seeds.push(s);
    }
    seeds.forEach((s, i) => (owner[s] = i));
    const sizes = new Array(pieces).fill(1);
    let left = cols * rows - pieces;
    let stuck = 0;
    while (left > 0 && stuck < 5000) {
      const p = Math.floor(rand() * pieces);
      if (sizes[p] >= maxSize) {
        stuck++;
        continue;
      }
      const frontier: number[] = [];
      owner.forEach((o, i) => {
        if (o !== p) return;
        const x = i % cols;
        const y = Math.floor(i / cols);
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && owner[ny * cols + nx] === -1) frontier.push(ny * cols + nx);
        }
      });
      if (!frontier.length) {
        stuck++;
        continue;
      }
      owner[frontier[Math.floor(rand() * frontier.length)]] = p;
      sizes[p]++;
      left--;
    }
    if (left > 0 || sizes.some((s) => s < minSize)) continue;
    return Array.from({ length: pieces }, (_, p) => {
      const cells: Cell[] = [];
      owner.forEach((o, i) => o === p && cells.push([i % cols, Math.floor(i / cols)]));
      const n = normalise(cells);
      return { cells: n.cells, home: [n.dx, n.dy] as Cell };
    });
  }
  throw new Error('could not partition');
}
