import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fmt, randInt, type Vec } from '../../../core/geometry';
import { useHistory } from '../../../core/history';
import { useSettings, type Difficulty } from '../../../core/store';
import { Challenge, ChoiceQuiz, NumberQuiz, type CheckResult } from '../../../ui/feedback';
import { DesignLink, Formula, Note, NumberTable, Segmented, Slider, Stepper, Steps, T, Toggle, ToolBar } from '../../../ui/kit';
import { Lesson, Workbench, type StageKey } from '../../../ui/lesson';
import { toLocal } from '../../../ui/svg';

const W = 800;

/* ================================================================== */
/* Block board: drag blocks between zones                              */
/* ================================================================== */

interface Zone {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  cols: number;
}

interface Block {
  id: number;
  zone: string;
}

const CELL = 28;

function slot(z: Zone, k: number): Vec {
  return { x: z.x + 12 + (k % z.cols) * CELL + CELL / 2, y: z.y + 38 + Math.floor(k / z.cols) * CELL + CELL / 2 };
}

function BlockBoard({ zones, blocks, onChange, onStart, height, tapTo, showCounts = true, crossZone }: {
  zones: Zone[]; blocks: Block[]; onChange: (b: Block[]) => void; onStart: () => void; height: number;
  /** zone a tapped block jumps to (from any other zone) */
  tapTo?: (b: Block) => string | null;
  showCounts?: boolean;
  /** draw a cross over blocks in this zone (taken away) */
  crossZone?: string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: number; p: Vec; start: Vec; pointer: number } | null>(null);
  const zoneAt = (p: Vec) => zones.find((z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h);
  const counts = Object.fromEntries(zones.map((z) => [z.id, blocks.filter((b) => b.zone === z.id).length]));
  const positions = new Map<number, Vec>();
  for (const z of zones) blocks.filter((b) => b.zone === z.id).forEach((b, k) => positions.set(b.id, slot(z, k)));

  return (
    <svg
      ref={svg}
      className="tool"
      viewBox={`0 0 ${W} ${height}`}
      onPointerMove={(e) => {
        if (!drag || drag.pointer !== e.pointerId) return;
        setDrag({ ...drag, p: toLocal(svg.current as unknown as SVGGraphicsElement, e.clientX, e.clientY) });
      }}
      onPointerUp={(e) => {
        if (!drag || drag.pointer !== e.pointerId) return;
        const p = toLocal(svg.current as unknown as SVGGraphicsElement, e.clientX, e.clientY);
        const moved = Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 6;
        const b = blocks.find((x) => x.id === drag.id)!;
        let target: string | null | undefined = moved ? zoneAt(p)?.id : tapTo?.(b);
        if (target && target !== b.zone) {
          const cap = zones.find((z) => z.id === target)!;
          const max = cap.cols * Math.floor((cap.h - 44) / CELL);
          if (counts[target] >= max) target = null;
        }
        if (target && target !== b.zone) onChange([...blocks.filter((x) => x.id !== b.id), { ...b, zone: target }]);
        setDrag(null);
      }}
      onPointerCancel={() => setDrag(null)}
    >
      {zones.map((z) => (
        <g key={z.id}>
          <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={14} fill={`${z.color}14`} stroke={z.color} strokeWidth={2} strokeDasharray={z.id === 'bin' ? '6 5' : undefined} />
          <text x={z.x + 12} y={z.y + 24} className="svg-label" fill={z.color}>{z.label}{showCounts ? ` · ${counts[z.id]}` : ''}</text>
        </g>
      ))}
      {blocks.map((b) => {
        const isDrag = drag?.id === b.id;
        const p = isDrag ? drag.p : positions.get(b.id)!;
        const z = zones.find((x) => x.id === b.zone)!;
        return (
          <g
            key={b.id}
            transform={`translate(${p.x} ${p.y})`}
            style={{ cursor: 'grab', transition: isDrag ? 'none' : 'transform 0.25s' }}
            onPointerDown={(e) => {
              e.preventDefault();
              onStart();
              svg.current?.setPointerCapture(e.pointerId);
              const q = toLocal(svg.current as unknown as SVGGraphicsElement, e.clientX, e.clientY);
              setDrag({ id: b.id, p: q, start: q, pointer: e.pointerId });
            }}
          >
            <rect x={-11} y={-11} width={22} height={22} rx={5} fill={z.id === 'bin' ? '#ced4da' : z.color} stroke="#fff" strokeWidth={2} />
            {crossZone === z.id && <path d="M-8 -8 L8 8 M8 -8 L-8 8" stroke="#fff" strokeWidth={3} />}
          </g>
        );
      })}
    </svg>
  );
}

function makeBlocks(spec: Record<string, number>): Block[] {
  const out: Block[] = [];
  let id = 0;
  for (const [zone, n] of Object.entries(spec)) for (let i = 0; i < n; i++) out.push({ id: id++, zone });
  return out;
}

/* ---------------- number line with hops ---------------- */

function HopLine({ hops, max = 20, y = 70 }: { hops: { from: number; to: number; color: string; label?: string }[]; max?: number; y?: number }) {
  const x0 = 40;
  const x1 = 760;
  const X = (n: number) => x0 + ((x1 - x0) * n) / max;
  return (
    <svg className="tool" viewBox={`0 0 ${W} 110`}>
      <line x1={x0} y1={y} x2={x1} y2={y} stroke="#1f2a44" strokeWidth={2} />
      {Array.from({ length: max + 1 }, (_, k) => (
        <g key={k}>
          <line x1={X(k)} y1={y - (k % 5 ? 5 : 10)} x2={X(k)} y2={y + (k % 5 ? 5 : 10)} stroke="#1f2a44" strokeWidth={k % 5 ? 1 : 2} />
          <text x={X(k)} y={y + 26} fontSize={12} textAnchor="middle" fill="#495057">{k}</text>
        </g>
      ))}
      {hops.map((h, i) => {
        if (h.from === h.to) return null;
        const a = X(h.from);
        const b = X(h.to);
        const top = y - 18 - Math.min(40, Math.abs(b - a) / 4);
        return (
          <g key={i}>
            <path d={`M${a} ${y - 4} Q${(a + b) / 2} ${top - 10} ${b} ${y - 4}`} fill="none" stroke={h.color} strokeWidth={3} />
            <path d={`M${b} ${y - 4} l${a < b ? -9 : 9} -6 l0 10 Z`} fill={h.color} />
            {h.label && <text x={(a + b) / 2} y={top - 2} className="svg-label small" fill={h.color} textAnchor="middle">{h.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/* ================================================================== */
/* Adding & taking away                                                */
/* ================================================================== */

const ADD_ZONES = (mode: 'add' | 'sub'): Zone[] => [
  { id: 'a', label: mode === 'add' ? 'Pile A' : 'Still on the table', x: 20, y: 20, w: 172, h: 186, color: '#f08c00', cols: 5 },
  { id: 'b', label: mode === 'add' ? 'Pile B' : 'Taken away', x: 206, y: 20, w: 172, h: 186, color: mode === 'add' ? '#1c7ed6' : '#e5484d', cols: 5 },
  { id: 'bin', label: 'Spare blocks', x: 400, y: 20, w: 380, h: 186, color: '#868e96', cols: 13 },
];

function AddSubLesson() {
  const [mode, setMode] = useState<'add' | 'sub'>('add');
  const h = useHistory<Block[]>(() => makeBlocks({ a: 3, b: 4, bin: 13 }));
  const a = h.value.filter((b) => b.zone === 'a').length;
  const b = h.value.filter((b) => b.zone === 'b').length;
  const total = a + b;
  const tool = (
    <div>
      <BlockBoard zones={ADD_ZONES(mode)} blocks={h.value} onChange={h.set} onStart={h.checkpoint} height={226} crossZone={mode === 'sub' ? 'b' : undefined}
        tapTo={(blk) => (blk.zone === 'bin' ? 'a' : blk.zone === 'a' ? 'b' : 'bin')} />
      <HopLine hops={mode === 'add'
        ? [{ from: 0, to: a, color: '#f08c00', label: `${a}` }, { from: a, to: total, color: '#1c7ed6', label: `+ ${b}` }]
        : [{ from: 0, to: total, color: '#f08c00', label: `start ${total}` }, { from: total, to: a, color: '#e5484d', label: `− ${b}` }]} />
      <div className="big-eq" style={{ textAlign: 'center', paddingBottom: 10 }}>
        {mode === 'add' ? <><span style={{ color: '#f08c00' }}>{a}</span> + <span style={{ color: '#1c7ed6' }}>{b}</span> = {total}</> : <>{total} − <span style={{ color: '#e5484d' }}>{b}</span> = <span style={{ color: '#f08c00' }}>{a}</span></>}
      </div>
    </div>
  );
  const controls = (
    <>
      <Segmented value={mode} onChange={setMode} options={[{ value: 'add', label: '➕ Put together' }, { value: 'sub', label: '➖ Take away' }]} />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
      <span className="muted small">Drag blocks between the boxes, or tap a block to move it along.</span>
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>Two piles of blocks. Underneath, a <T k="numberLine" /> shows the same numbers as jumps.</p>,
    touch: <p>Drag a block from the spare box into Pile A or Pile B. Watch the jumps on the number line grow.</p>,
    experiment: (
      <ul>
        <li>Make 3 + 5. Then swap: make 5 + 3.</li>
        <li>Switch to <b>➖ Take away</b>. Move blocks into “Taken away”.</li>
        <li>Rows of 5 make counting easier: two full rows are 10.</li>
      </ul>
    ),
    discover: (
      <>
        <ChoiceQuiz
          question="Is 3 + 5 the same as 5 + 3?"
          options={[{ label: 'Yes — the total is the same', correct: true, why: 'Putting two piles together gives the same total whichever pile you count first.' }, { label: 'No', why: 'Build both: 8 blocks either way. The order of adding does not matter.' }]}
        />
        <ChoiceQuiz
          question="You had 9 blocks and took away 4. How can you check the answer 5?"
          options={[{ label: '5 + 4 should give back 9', correct: true, why: 'Taking away is the reverse of adding. Put the 4 back and you have 9 again.' }, { label: '9 + 4 should be 5', why: 'Adding makes more, not less. Try putting the taken blocks back.' }]}
        />
      </>
    ),
    understand: (
      <>
        <p><T k="addition" /> = putting groups together. On the number line: jump forward.</p>
        <p><T k="subtraction" /> = taking some away. On the number line: jump backward.</p>
        <p>They undo each other: + 4 then − 4 lands where you started.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'a', means: 'the first amount', color: '#f08c00' }, ' + ', { s: 'b', means: 'the amount added', color: '#1c7ed6' }, ' = total']} />
        <NumberQuiz question="A shelf needs 7 screws and the bracket needs 6 more. How many screws in total?" answer={13} hint="Make 7 + 6 with the blocks. Fill a row of 10 first."
          solution={<Steps steps={['7 + 3 = 10 (fill the ten)', '6 − 3 = 3 left over', '10 + 3 = 13']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>A parts list adds quantities: 4 legs + 4 feet + 8 screws.</li>
          <li>Measuring: a 120 mm part plus a 35 mm part = 155 mm overall length.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={mode === 'add'
      ? [['Pile A', `${a}`], ['Pile B', `${b}`], ['Together', `${a} + ${b} = ${total}`], ['Check by taking away', `${total} − ${b} = ${a}`]]
      : [['Started with', `${total}`], ['Taken away', `${b}`], ['Left', `${total} − ${b} = ${a}`], ['Check by adding back', `${a} + ${b} = ${total}`]]} />
  );
  return <Lesson id="l1-addsub" title="Adding & taking away" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Multiplying = equal groups                                          */
/* ================================================================== */

function plateZones(n: number, binLabel = 'Spare blocks'): Zone[] {
  const zones: Zone[] = [];
  for (let i = 0; i < n; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    zones.push({ id: `p${i}`, label: `Group ${i + 1}`, x: 20 + col * 190, y: 20 + row * 168, w: 178, h: 156, color: ['#f08c00', '#1c7ed6', '#2b8a3e', '#c2255c', '#7048e8', '#0c8599'][i], cols: 5 });
  }
  zones.push({ id: 'bin', label: binLabel, x: 600, y: 20, w: 180, h: n > 3 ? 324 : 156, color: '#868e96', cols: 5 });
  return zones;
}

function groupCounts(blocks: Block[], n: number) {
  return Array.from({ length: n }, (_, i) => blocks.filter((b) => b.zone === `p${i}`).length);
}

function ArrayDots({ rows, cols }: { rows: number; cols: number }) {
  const s = 22;
  return (
    <svg viewBox={`0 0 ${Math.max(1, cols) * s + 70} ${Math.max(1, rows) * s + 30}`} style={{ maxWidth: 360, width: '100%' }}>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => <rect key={`${r}-${c}`} x={40 + c * s} y={6 + r * s} width={s - 4} height={s - 4} rx={4} fill={['#f08c00', '#1c7ed6', '#2b8a3e', '#c2255c', '#7048e8', '#0c8599'][r]} />),
      )}
      {Array.from({ length: rows }, (_, r) => <text key={r} x={0} y={21 + r * s} fontSize={12} fill="#495057">row {r + 1}</text>)}
      <text x={40} y={rows * s + 24} fontSize={12} fill="#495057">{rows} rows × {cols} = {rows * cols} — a rectangle!</text>
    </svg>
  );
}

function MultiplyLesson() {
  const [groups, setGroups] = useState(3);
  const h = useHistory<Block[]>(() => makeBlocks({ p0: 4, p1: 4, p2: 2, bin: 20 }));
  const [array, setArray] = useState(false);
  const counts = groupCounts(h.value, groups);
  const equal = counts.every((c) => c === counts[0]) && counts[0] > 0;
  const each = counts[0];
  const total = counts.reduce((s, c) => s + c, 0);
  const setG = (g: number) => {
    setGroups(g);
    h.commit((bs) => bs.map((b) => (b.zone.startsWith('p') && Number(b.zone.slice(1)) >= g ? { ...b, zone: 'bin' } : b)));
  };
  const fill = (n: number) => h.commit(() => {
    const spec: Record<string, number> = {};
    for (let i = 0; i < groups; i++) spec[`p${i}`] = n;
    spec.bin = 30 - n * groups;
    return makeBlocks(spec);
  });
  const tool = (
    <div>
      <BlockBoard zones={plateZones(groups)} blocks={h.value} onChange={h.set} onStart={h.checkpoint} height={groups > 3 ? 360 : 192}
        tapTo={(b) => (b.zone === 'bin' ? `p${counts.indexOf(Math.min(...counts))}` : 'bin')} />
      <div style={{ padding: '4px 16px 12px', textAlign: 'center' }}>
        {equal ? (
          <div className="big-eq">{Array(groups).fill(each).join(' + ')} = <span style={{ color: '#1c7ed6' }}>{groups} × {each}</span> = {total}</div>
        ) : (
          <div className="big-eq" style={{ color: '#e5484d', fontSize: 18 }}>Groups of {counts.join(', ')} — not equal yet, so this is not “{groups} times” anything.</div>
        )}
        {array && equal && <ArrayDots rows={groups} cols={each} />}
      </div>
    </div>
  );
  const controls = (
    <>
      <Stepper label="Number of groups" value={groups} min={1} max={6} onChange={setG} />
      <Stepper label="Fill each group with" value={each} min={0} max={Math.floor(30 / groups)} onChange={fill} />
      <Toggle label="Show as rows (array)" checked={array} onChange={setArray} />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => { setGroups(3); h.reset(); }} />
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>Blocks sit in groups. When every group has the <b>same</b> number, we can count quickly with <T k="multiplication" />.</p>,
    touch: <p>Drag blocks between groups. Tap a spare block to drop it into the smallest group.</p>,
    experiment: (
      <ul>
        <li>Make 3 groups of 4. Read the line under the groups.</li>
        <li>Make the groups unequal. What does it say now?</li>
        <li>Turn on <b>Show as rows</b>: each group becomes a row.</li>
      </ul>
    ),
    discover: (
      <>
        <ChoiceQuiz
          question="3 groups of 4 and 4 groups of 3 — same total?"
          options={[{ label: 'Yes, both are 12', correct: true, why: 'Turn the rows picture on its side: 3 rows of 4 becomes 4 rows of 3. Same blocks.' }, { label: 'No', why: 'Build both and compare the totals.' }]}
        />
        <ChoiceQuiz
          question="Groups of 4, 4 and 2. Is that “3 × 4”?"
          options={[{ label: 'Yes — there are 3 groups', why: 'Multiplication only works when every group is the same size. 4 + 4 + 2 = 10, but 3 × 4 = 12.' }, { label: 'No — the groups must be equal', correct: true, why: 'Exactly. Equal groups are the whole idea.' }]}
        />
      </>
    ),
    understand: (
      <>
        <p><b>3 × 4</b> means “3 groups of 4” = 4 + 4 + 4. Multiplication is <b>quick repeated adding</b>.</p>
        <p>Equal groups in rows make a rectangle. That is why area = width × height (Level 2).</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'g', means: 'how many groups', color: '#1c7ed6' }, ' × ', { s: 'n', means: 'how many in each group', color: '#f08c00' }, ' = total']} />
        <NumberQuiz question="A stool has 3 legs. How many legs for 6 stools?" answer={18} hint="6 groups of 3: 3 + 3 + 3 + 3 + 3 + 3."
          diagnose={(x) => (x === 9 ? 'You added 6 + 3. There are 6 groups OF 3 — multiply.' : null)}
          solution={<Steps steps={['6 × 3', '= 3 + 3 + 3 + 3 + 3 + 3', '= 18 legs']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>An extension board with 4 sockets, each needing 3 screws: 4 × 3 = 12 screws.</li>
          <li>Packing: 6 rows of 8 bottles in a crate = 48.</li>
          <li>A keyboard is an array of keys: rows × keys per row.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <>
      <NumberTable rows={counts.map((c, i) => [`Group ${i + 1}`, `${c}`] as [ReactNode, ReactNode])} />
      <Steps steps={[`Add them: ${counts.join(' + ')} = ${total}`, equal ? `Equal groups, so ${groups} × ${each} = ${total}` : 'Not equal groups — multiplication does not apply yet.']} />
    </>
  );
  return <Lesson id="l1-multiply" title="Multiplying = equal groups" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Sharing equally (division)                                          */
/* ================================================================== */

function DivideLesson() {
  const [plates, setPlates] = useState(3);
  const [total, setTotal] = useState(14);
  const h = useHistory<Block[]>(() => makeBlocks({ bin: 14 }));
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearInterval(timer.current), []);
  const counts = groupCounts(h.value, plates);
  const left = h.value.filter((b) => b.zone === 'bin').length;
  const q = Math.floor(total / plates);
  const r = total % plates;
  const fair = counts.every((c) => c === counts[0]);
  const done = fair && left < plates;
  const restart = (n = total, p = plates) => {
    window.clearInterval(timer.current);
    h.commit(makeBlocks({ bin: n }));
    setTotal(n);
    setPlates(p);
  };
  const deal = () => {
    h.checkpoint();
    window.clearInterval(timer.current);
    let k = 0;
    timer.current = window.setInterval(() => {
      let stop = false;
      h.set((bs) => {
        const cs = groupCounts(bs, plates);
        const binBlocks = bs.filter((b) => b.zone === 'bin');
        const minC = Math.min(...cs);
        if (binBlocks.length < plates && cs.every((c) => c === minC)) {
          stop = true;
          return bs;
        }
        if (!binBlocks.length) {
          stop = true;
          return bs;
        }
        const target = cs.indexOf(minC);
        const moving = binBlocks[0];
        return [...bs.filter((b) => b.id !== moving.id), { ...moving, zone: `p${target}` }];
      });
      if (stop || ++k > 40) window.clearInterval(timer.current);
    }, 280);
  };
  const tool = (
    <div>
      <BlockBoard zones={plateZones(plates, 'To share')} blocks={h.value} onChange={h.set} onStart={h.checkpoint} height={plates > 3 ? 360 : 192}
        tapTo={(b) => (b.zone === 'bin' ? `p${counts.indexOf(Math.min(...counts))}` : 'bin')} />
      <div className="big-eq" style={{ textAlign: 'center', paddingBottom: 12 }}>
        {done ? <>{total} ÷ {plates} = <span style={{ color: '#2b8a3e' }}>{counts[0]}</span>{left ? <> remainder <span style={{ color: '#e5484d' }}>{left}</span></> : null}</> : <span className="muted">Share until every group is equal and you cannot give everyone one more…</span>}
      </div>
    </div>
  );
  const controls = (
    <>
      <Stepper label="Blocks to share" value={total} min={1} max={30} onChange={(n) => restart(n, plates)} />
      <Stepper label="Groups" value={plates} min={1} max={6} onChange={(p) => restart(total, p)} />
      <button className="btn primary" onClick={deal}>🃏 Deal one each, round and round</button>
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => restart()} />
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A pile of blocks to share fairly between groups — like dealing cards.</p>,
    touch: <p>Drag (or tap) blocks into the groups yourself, or press <b>🃏 Deal</b> to watch it happen.</p>,
    experiment: (
      <ul>
        <li>Share 12 blocks between 3 groups. Then between 4. Then 5.</li>
        <li>When are there blocks left over?</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz
        question="Share 14 blocks between 3 groups. What happens?"
        options={[{ label: 'Each gets 4, and 2 are left over', correct: true, why: '3 × 4 = 12, and 14 − 12 = 2 cannot be shared fairly. That is the remainder.' }, { label: 'Each gets 5', why: '3 groups of 5 would need 15 blocks — one more than we have.' }, { label: 'It is impossible', why: 'It is possible — there are just some blocks left over (a remainder).' }]}
      />
    ),
    understand: (
      <>
        <p><T k="division" /> = sharing into equal groups. It undoes multiplication: 12 ÷ 3 = 4 because 3 × 4 = 12.</p>
        <p>What cannot be shared fairly is the <T k="remainder" />.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'N', means: 'how many to share', color: '#868e96' }, ' ÷ ', { s: 'g', means: 'number of groups', color: '#1c7ed6' }, ' = ', { s: 'q', means: 'how many each group gets', color: '#2b8a3e' }, ' remainder ', { s: 'r', means: 'what is left over', color: '#e5484d' }]} caption="Check: q × g + r = N" />
        <NumberQuiz question="50 screws go into bags of 8. How many full bags?" answer={6} hint="How many groups of 8 fit into 50? 8, 16, 24…"
          diagnose={(x) => (x === 7 ? 'Seven bags would need 56 screws. Only full bags count.' : null)}
          solution={<Steps steps={['8 × 6 = 48', '50 − 48 = 2 left over', '6 full bags, remainder 2']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Spacing: share a length into equal gaps (Level 12 socket spacing).</li>
          <li>Batch production: 50 parts per sheet, 8 per box → 6 boxes + 2 spares.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['To share', `${total}`],
      ['Groups', `${plates}`],
      ['Each gets', `${q}`],
      ['Remainder', `${r}`],
      ['Check', `${q} × ${plates} + ${r} = ${q * plates + r}`],
      ['As a decimal', `${total} ÷ ${plates} = ${fmt(total / plates, 3)}`],
    ]} />
  );
  return <Lesson id="l1-divide" title="Sharing equally (division)" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Decimals & percentages                                              */
/* ================================================================== */

function HundredGrid({ on, onPaint, onStart }: { on: boolean[]; onPaint: (i: number, v: boolean) => void; onStart: () => void }) {
  const paint = useRef<boolean | null>(null);
  useEffect(() => {
    const up = () => (paint.current = null);
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);
  const s = 32;
  return (
    <g transform="translate(40 30)">
      {on.map((v, i) => {
        const c = i % 10;
        const r = Math.floor(i / 10);
        return (
          <rect key={i} x={c * s} y={r * s} width={s - 3} height={s - 3} rx={4} fill={v ? '#20c997' : '#f1f3f5'} stroke={c === 9 ? '#adb5bd' : 'none'} style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
              (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
              onStart();
              paint.current = !v;
              onPaint(i, !v);
            }}
            onPointerEnter={() => paint.current !== null && onPaint(i, paint.current)} />
        );
      })}
      {Array.from({ length: 10 }, (_, c) => <text key={c} x={c * s + 14} y={10 * s + 18} fontSize={11} textAnchor="middle" fill="#868e96">{c + 1}</text>)}
    </g>
  );
}

function PercentLesson() {
  const h = useHistory<boolean[]>(() => Array.from({ length: 100 }, (_, i) => (i % 10) * 10 + Math.floor(i / 10) < 35));
  const n = h.value.filter(Boolean).length;
  const setTo = (k: number) => h.set(Array.from({ length: 100 }, (_, i) => (i % 10) * 10 + Math.floor(i / 10) < k));
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 380`}>
      <HundredGrid on={h.value} onPaint={(i, v) => h.set((s) => s.map((x, j) => (j === i ? v : x)))} onStart={h.checkpoint} />
      <g transform="translate(420 40)">
        <text x={0} y={0} className="svg-label" fill="#495057">Battery</text>
        <rect x={0} y={14} width={300} height={90} rx={14} fill="none" stroke="#1f2a44" strokeWidth={4} />
        <rect x={300} y={44} width={14} height={30} rx={4} fill="#1f2a44" />
        <rect x={8} y={22} width={2.84 * n} height={74} rx={8} fill={n < 20 ? '#e5484d' : n < 50 ? '#fab005' : '#20c997'} />
        <text x={150} y={68} textAnchor="middle" className="svg-label big" fill="#1f2a44">{n}%</text>
        <text x={0} y={150} className="svg-label" fill="#495057">Tenths bar (each piece = 0.1)</text>
        {Array.from({ length: 10 }, (_, k) => (
          <rect key={k} x={k * 30} y={162} width={28} height={36} rx={3} fill={(k + 1) * 10 <= n ? '#20c997' : k * 10 < n ? '#96f2d7' : '#f1f3f5'} />
        ))}
        <text x={0} y={240} className="svg-label big" fill="#087f5b">{n}/100 = {fmt(n / 100, 2)} = {n}%</text>
      </g>
    </svg>
  );
  const controls = (
    <>
      <Slider label="Set the amount" value={n} min={0} max={100} unit="%" onStart={h.checkpoint} onChange={setTo} color="#20c997" />
      <div className="row">
        {[10, 25, 50, 75].map((k) => <button key={k} className="btn small" onClick={() => { h.checkpoint(); setTo(k); }}>{k}%</button>)}
        <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
      </div>
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A square made of exactly <b>100</b> small squares. Some are coloured. The battery shows the same amount.</p>,
    touch: <p>Tap or swipe squares to colour them. Or use the slider.</p>,
    experiment: (
      <ul>
        <li>Colour one whole column. How many squares is that? What does the tenths bar show?</li>
        <li>Colour exactly half. Then a quarter.</li>
        <li>Make the battery go red.</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz
        question="Half of the square is coloured. Which of these all mean the same thing?"
        options={[{ label: '1/2, 0.5 and 50%', correct: true, why: '50 out of 100 = 50/100 = 1/2 = 0.5 = 50%. Four ways of writing one amount.' }, { label: '1/2, 0.2 and 20%', why: 'Colour 20 squares — that is only a fifth.' }, { label: '50/100, 5.0 and 5%', why: '5% is just 5 squares. 0.5 (zero point five) is the decimal for a half.' }]}
      />
    ),
    understand: (
      <>
        <p><T k="percentage" /> means “out of 100”. 35% = 35 of the 100 squares.</p>
        <p>A <T k="decimal" /> uses tenths and hundredths: 0.35 = 3 tenths (columns) + 5 hundredths (squares).</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'p', means: 'the percentage', color: '#20c997' }, '% of ', { s: 'A', means: 'an amount', color: '#1c7ed6' }, ' = ', { s: 'p', means: '', color: '#20c997' }, ' ÷ 100 × ', { s: 'A', means: '', color: '#1c7ed6' }]} />
        <NumberQuiz question="A 4000 mAh battery is at 35%. How many mAh are left?" answer={1400} unit="mAh" hint="1% of 4000 is 40. Then 35 of those."
          diagnose={(x) => (x === 140 ? 'Check your zeros: 1% of 4000 is 40, not 4.' : x === 3965 ? 'You subtracted 35. Percent means “out of 100”, so divide by 100 first.' : null)}
          solution={<Steps steps={['35 ÷ 100 = 0.35', '0.35 × 4000 = 1400 mAh']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>3D-printing infill (e.g. 20%) sets how solid a part is inside.</li>
          <li>Material waste: if 15% of a sheet is offcuts, you use 85%.</li>
          <li>Tolerances are often given as ± a percentage.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['Coloured squares', `${n} out of 100`],
      ['Fraction', `${n}/100`],
      ['Decimal', `${n} ÷ 100 = ${fmt(n / 100, 2)}`],
      ['Tenths + hundredths', `${Math.floor(n / 10)} tenths + ${n % 10} hundredths`],
      ['Percentage', `${n}%`],
      ['Not coloured', `100 − ${n} = ${100 - n}%`],
    ]} />
  );
  return <Lesson id="l1-percent" title="Decimals & percentages" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Challenge: pack the parts                                           */
/* ================================================================== */

interface PackTarget {
  kind: 'groups' | 'share';
  g: number;
  n: number;
  total: number;
  item: string;
  text: string;
}

function packTarget(d: Difficulty): PackTarget {
  const items = [['legs', 'stools'], ['screws', 'brackets'], ['wheels', 'trolleys'], ['buttons', 'remotes']];
  const [item, thing] = items[randInt(0, items.length - 1)];
  if (d === 'hard') {
    const g = randInt(3, 5);
    const n = randInt(3, 5);
    const extra = randInt(1, g - 1);
    return { kind: 'share', g, n, total: g * n + extra, item, text: `Share ${g * n + extra} ${item} equally into ${g} boxes. Put the leftovers back in the spares.` };
  }
  const g = d === 'easy' ? randInt(2, 3) : randInt(3, 5);
  const n = d === 'easy' ? randInt(2, 4) : randInt(3, 6);
  return { kind: 'groups', g, n, total: g * n, item, text: `${g} ${thing} each need ${n} ${item}. Pack one box per ${thing.slice(0, -1)}.` };
}

function PackChallenge() {
  const { difficulty } = useSettings();
  const [target, setTarget] = useState(() => packTarget(difficulty));
  const binStart = target.kind === 'share' ? target.total : 30;
  const h = useHistory<Block[]>(() => makeBlocks({ bin: binStart }));
  const [answer, setAnswer] = useState('');
  const counts = groupCounts(h.value, target.g);
  const left = h.value.filter((b) => b.zone === 'bin').length;
  const fresh = () => {
    const t = packTarget(difficulty);
    setTarget(t);
    setAnswer('');
    h.reset(makeBlocks({ bin: t.kind === 'share' ? t.total : 30 }));
  };
  const check = (): CheckResult => {
    const wrongGroups = counts.map((c, i) => ({ c, i })).filter(({ c }) => c !== target.n);
    if (wrongGroups.length) {
      return {
        ok: false,
        happened: <>Box{wrongGroups.length > 1 ? 'es' : ''} {wrongGroups.map((w) => w.i + 1).join(', ')} {wrongGroups.length > 1 ? 'hold' : 'holds'} {wrongGroups.map((w) => w.c).join(', ')} {target.item} — {target.kind === 'share' ? 'the boxes are not equal yet' : `each box needs ${target.n}`}.</>,
        why: target.kind === 'share' ? 'Fair sharing means every box gets the same number. Give one to each box, round and round.' : `Every ${target.item.slice(0, -1)} group must be the same size: ${target.n}.`,
      };
    }
    const typed = Number(answer);
    const want = target.kind === 'share' ? left : target.total;
    if (answer.trim() === '' || typed !== want) {
      return {
        ok: false,
        happened: answer.trim() === '' ? 'The boxes are right — now type the number asked for.' : <>You typed <b>{answer}</b>.</>,
        why: target.kind === 'share' ? 'The leftovers are the blocks still in the spare box.' : `${target.g} boxes of ${target.n}: count them as ${Array(target.g).fill(target.n).join(' + ')}.`,
      };
    }
    return { ok: true, happened: target.kind === 'share' ? `${target.total} ÷ ${target.g} = ${target.n} remainder ${left}.` : `${target.g} × ${target.n} = ${target.total} ${target.item}.` };
  };
  const tool = <BlockBoard zones={plateZones(target.g, 'Spares')} blocks={h.value} onChange={h.set} onStart={h.checkpoint} height={target.g > 3 ? 360 : 192} tapTo={(b) => (b.zone === 'bin' ? `p${counts.indexOf(Math.min(...counts))}` : 'bin')} />;
  const panel = (
    <Challenge
      id="l1-challenge"
      title="Pack the parts"
      brief={<p>{target.text}</p>}
      check={check}
      onNewTarget={fresh}
      hint={target.kind === 'share' ? 'Deal one to each box, round and round, until you cannot give everyone another.' : `Put ${target.n} in the first box, then make the others match it.`}
      solution={<Steps steps={target.kind === 'share' ? [`${target.g} × ${target.n} = ${target.g * target.n}`, `${target.total} − ${target.g * target.n} = ${target.total - target.g * target.n} left over`] : [`${target.n} in each of ${target.g} boxes`, `${target.g} × ${target.n} = ${target.total}`]} />}
    >
      <div className="quiz-input" style={{ marginTop: 8 }}>
        <span>{target.kind === 'share' ? 'How many are left over?' : `How many ${target.item} in total?`}</span>
        <input inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="?" />
      </div>
      <Note>Boxes: {counts.join(' · ')} {target.kind === 'share' && `· spares ${left}`}</Note>
    </Challenge>
  );
  return <Workbench title="Challenge: pack the parts" tool={tool} controls={<ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />} panel={panel} />;
}

export default {
  'l1-addsub': AddSubLesson,
  'l1-multiply': MultiplyLesson,
  'l1-divide': DivideLesson,
  'l1-percent': PercentLesson,
  'l1-challenge': PackChallenge,
};

