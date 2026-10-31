import { useMemo, useState } from 'react';
import { fmt } from '../../../core/geometry';
import { useHistory } from '../../../core/history';
import { useSettings, type Difficulty } from '../../../core/store';
import { solveTruss } from '../../../core/truss';
import { Challenge, type CheckResult } from '../../../ui/feedback';
import { Note, SafetyNote, Stat, Stats, Toggle, ToolBar } from '../../../ui/kit';
import { Workbench } from '../../../ui/lesson';

const W = 800;
const SPAN = 8;
const ROWS = 3;
const S = 85;
const X = (x: number) => 60 + x * S;
const Y = (y: number) => 360 - y * S;

type Key = string; // "x,y"
type Member = [Key, Key];
const key = (x: number, y: number) => `${x},${y}`;
const parse = (k: Key) => k.split(',').map(Number) as [number, number];
const same = (a: Member, b: Member) => (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);

const DECK: Member[] = Array.from({ length: SPAN }, (_, i) => [key(i, 0), key(i + 1, 0)]);

function rules(d: Difficulty) {
  // Calibrated so a 2 m deep truss works, while too shallow (big chord forces) or
  // too tall (long members buckle) designs fail — the real trade-off.
  if (d === 'easy') return { loads: [2, 4, 6].map((x) => ({ x, kN: 6 })), tcap: 40, buck: 100, budget: Infinity };
  if (d === 'normal') return { loads: [2, 4, 6].map((x) => ({ x, kN: 10 })), tcap: 35, buck: 90, budget: Infinity };
  return { loads: [2, 3, 4, 5, 6].map((x) => ({ x, kN: 10 })), tcap: 50, buck: 150, budget: 34 };
}

export default function BuildBridge() {
  const { difficulty } = useSettings();
  const R = rules(difficulty);
  const h = useHistory<Member[]>([]);
  const [pick, setPick] = useState<Key | null>(null);
  const [selMember, setSelMember] = useState<number | null>(null);
  const [showDeflect, setShowDeflect] = useState(true);
  const all = useMemo(() => [...DECK, ...h.value], [h.value]);

  const analysis = useMemo(() => {
    const keys = Array.from(new Set(all.flat()));
    const idx = new Map(keys.map((k, i) => [k, i]));
    const nodes = keys.map((k) => {
      const [x, y] = parse(k);
      return { x, y };
    });
    const members = all.map(([a, b]) => ({ a: idx.get(a)!, b: idx.get(b)! }));
    const res = solveTruss(
      nodes,
      members,
      [{ node: idx.get(key(0, 0))!, fx: true, fy: true }, { node: idx.get(key(SPAN, 0))!, fx: false, fy: true }],
      R.loads.map((l) => ({ node: idx.get(key(l.x, 0))!, fx: 0, fy: -l.kN })),
    );
    const lengths = all.map(([a, b]) => {
      const [ax, ay] = parse(a);
      const [bx, by] = parse(b);
      return Math.hypot(bx - ax, by - ay);
    });
    const caps = lengths.map((L) => ({ t: R.tcap, c: Math.min(R.tcap, R.buck / (L * L)) }));
    const usage = res.ok ? res.forces.map((f, i) => (f >= 0 ? f / caps[i].t : -f / caps[i].c)) : [];
    return { res, idx, lengths, caps, usage, nodes };
  }, [all, R.tcap, R.buck, R.loads]);

  const steel = analysis.lengths.reduce((s, x) => s + x, 0);
  const extraSteel = analysis.lengths.slice(DECK.length).reduce((s, x) => s + x, 0);
  const symmetric = h.value.every(([a, b]) => {
    const [ax, ay] = parse(a);
    const [bx, by] = parse(b);
    return h.value.some((m) => same(m, [key(SPAN - ax, ay), key(SPAN - bx, by)]));
  });
  const maxU = analysis.usage.length ? Math.max(...analysis.usage) : 0;

  const tapNode = (k: Key) => {
    setSelMember(null);
    if (!pick) return setPick(k);
    if (pick === k) return setPick(null);
    const m: Member = [pick, k];
    if (!all.some((x) => same(x, m))) h.commit((s) => [...s, m]);
    setPick(k);
  };

  const defl = (k: Key) => {
    const [x, y] = parse(k);
    if (!analysis.res.ok || !showDeflect) return { x: X(x), y: Y(y) };
    const i = analysis.idx.get(k)!;
    const umax = Math.max(1e-9, ...analysis.res.u.map(Math.abs));
    const s = 18 / umax;
    return { x: X(x) + analysis.res.u[2 * i] * s, y: Y(y) - analysis.res.u[2 * i + 1] * s };
  };

  const tool = (
    <div style={{ position: 'relative' }}>
      <svg className="tool" viewBox={`0 0 ${W} 470`}>
        <rect x={0} y={Y(0) + 26} width={X(0) + 10} height={90} fill="#ced4da" />
        <rect x={X(SPAN) - 10} y={Y(0) + 26} width={W - X(SPAN) + 10} height={90} fill="#ced4da" />
        <path d={`M${X(0) + 10} ${Y(0) + 26} Q${X(SPAN / 2)} ${Y(0) + 150} ${X(SPAN) - 10} ${Y(0) + 26}`} fill="#a5d8ff" opacity={0.5} />
        <path d={`M${X(0)} ${Y(0) + 4} l-16 22 h32 Z`} fill="#495057" />
        <path d={`M${X(SPAN)} ${Y(0) + 4} l-16 22 h32 Z`} fill="#495057" />
        <circle cx={X(SPAN) - 8} cy={Y(0) + 30} r={4} fill="#495057" />
        <circle cx={X(SPAN) + 8} cy={Y(0) + 30} r={4} fill="#495057" />
        {Array.from({ length: SPAN + 1 }, (_, x) => Array.from({ length: ROWS + 1 }, (_, y) => (
          <circle key={key(x, y)} cx={X(x)} cy={Y(y)} r={pick === key(x, y) ? 11 : 6} fill={pick === key(x, y) ? '#f08c00' : '#dee2e6'} stroke="#868e96"
            style={{ cursor: 'pointer' }} onPointerDown={() => tapNode(key(x, y))} />
        )))}
        {all.map((m, i) => {
          const u = analysis.usage[i];
          const f = analysis.res.ok ? analysis.res.forces[i] : 0;
          const over = u !== undefined && u > 1;
          const color = !analysis.res.ok ? '#868e96' : Math.abs(f) < 1e-6 ? '#adb5bd' : f > 0 ? '#1c7ed6' : '#e8590c';
          const a = defl(m[0]);
          const b = defl(m[1]);
          const isDeck = i < DECK.length;
          return (
            <g key={i} onPointerDown={() => { if (!isDeck) { setSelMember(i); setPick(null); } }} style={{ cursor: isDeck ? 'default' : 'pointer' }}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={22} />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={isDeck ? 9 : 3 + 6 * Math.min(1.2, u ?? 0)} strokeLinecap="round" strokeDasharray={over ? '8 5' : undefined} opacity={selMember === i ? 0.6 : 1} />
              {over && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 8} textAnchor="middle" className="svg-label small" fill="#e5484d">{fmt(u * 100, 0)}%</text>}
              {selMember === i && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#212529" strokeWidth={2} strokeDasharray="2 4" />}
            </g>
          );
        })}
        {R.loads.map((l) => (
          <g key={l.x} pointerEvents="none">
            <line x1={X(l.x)} y1={Y(0) + 8} x2={X(l.x)} y2={Y(0) + 34} stroke="#7048e8" strokeWidth={2} />
            <rect x={X(l.x) - 22} y={Y(0) + 34} width={44} height={22} rx={4} fill="#7048e8" />
            <text x={X(l.x)} y={Y(0) + 50} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">{l.kN} kN</text>
            <line x1={X(l.x)} y1={Y(0) + 58} x2={X(l.x)} y2={Y(0) + 80} stroke="#7048e8" strokeWidth={3} />
            <path d={`M${X(l.x)} ${Y(0) + 90} l-7 -12 h14 Z`} fill="#7048e8" />
          </g>
        ))}
      </svg>
      <div className="overlay-badge">
        {!analysis.res.ok ? '⚠ Wobbly! This frame can fold — add triangles.' : `Most loaded member: ${fmt(maxU * 100, 0)}% of its strength`}
      </div>
      <div className="overlay-badge right" style={{ top: 'auto', bottom: 10 }}>Simplified simulation · <span style={{ color: '#1c7ed6' }}>blue = pulled (tension)</span> · <span style={{ color: '#e8590c' }}>orange = squashed (compression)</span></div>
    </div>
  );

  const check = (): CheckResult => {
    if (!analysis.res.ok) return { ok: false, happened: 'The bridge folds up like a hinged box — it is a mechanism.', why: 'Squares and long open shapes can change shape. Triangles cannot: add diagonals so every panel is a triangle.' };
    const bad = analysis.usage.map((u, i) => ({ u, i })).filter((x) => x.u > 1);
    if (bad.length) {
      const comp = bad.filter((b) => analysis.res.ok && analysis.res.forces[b.i] < 0).length;
      return {
        ok: false,
        happened: `${bad.length} member${bad.length > 1 ? 's are' : ' is'} overloaded (dashed, up to ${fmt(Math.max(...bad.map((b) => b.u)) * 100, 0)}%).`,
        why: comp ? 'Long members that are squashed buckle easily (strength falls with length²). Use shorter compression members, or make the bridge deeper so forces are smaller.' : 'The pulled members carry too much: a deeper truss (taller triangles) spreads the load.',
      };
    }
    if (extraSteel > R.budget) return { ok: false, happened: `It holds, but uses ${fmt(extraSteel, 1)} m of steel above the deck — the budget is ${R.budget} m.`, why: 'Remove members that carry almost nothing (thin grey lines).' };
    return { ok: true, happened: `It holds! Steel used: ${fmt(extraSteel, 1)} m. Busiest member at ${fmt(maxU * 100, 0)}%.`, why: symmetric ? 'And it is symmetrical — loads share evenly between both supports.' : 'Try a symmetrical version — the left and right halves will share the work evenly.' };
  };

  const panel = (
    <Challenge
      id="puzzle-bridge"
      title="Build the Bridge"
      brief={
        <>
          <p>Trucks cross the 8 m road deck (purple arrows). Tap one joint, then another, to add a steel member. Make the bridge stiff and strong{R.budget < Infinity ? `, using at most ${R.budget} m of steel above the deck` : ''}.</p>
          <SafetyNote>This is a simplified teaching simulation (pinned joints, equal members, simple buckling rule). Real bridges and load-bearing products need qualified engineers and proper analysis.</SafetyNote>
        </>
      }
      check={check}
      hint="Start with triangles: from each deck joint, go up to a joint above, then down to the next deck joint. Then join the top joints."
      solution={<>
        <p>A <b>Warren truss</b> two squares deep: zig-zag diagonals up to joints at height 2 above x = 1, 3, 5, 7, a top chord joining them, and a vertical under each top joint so the deck joints cannot sag.</p>
        <button className="btn small" onClick={() => h.commit(() => {
          const m: Member[] = [];
          for (let x = 1; x <= 7; x += 2) m.push([key(x - 1, 0), key(x, 2)], [key(x, 2), key(x + 1, 0)], [key(x, 0), key(x, 2)]);
          for (let x = 1; x < 7; x += 2) m.push([key(x, 2), key(x + 2, 2)]);
          return m;
        })}>Build the example</button>
      </>}
    >
      <Stats>
        <Stat label="steel above deck" value={`${fmt(extraSteel, 1)} m`} sub={`total ${fmt(steel, 1)} m`} />
        <Stat label="symmetry" value={symmetric ? '✔ mirror' : '—'} color={symmetric ? '#2b8a3e' : undefined} />
        <Stat label="members" value={all.length} />
      </Stats>
      {selMember !== null && selMember >= DECK.length && (
        <div className="toolbar">
          <span>Member {fmt(analysis.lengths[selMember], 2)} m · {analysis.res.ok ? `${fmt(analysis.res.forces[selMember], 1)} kN` : '—'}</span>
          <button className="btn small danger" style={{ marginTop: 0 }} onClick={() => { h.commit((s) => s.filter((_, i) => i !== selMember - DECK.length)); setSelMember(null); }}>Delete member</button>
        </div>
      )}
      <Note>Strength rule (simplified): every member can be pulled with {R.tcap} kN. A member being squashed can take only {R.buck} ÷ length² kN (max {R.tcap}) — long thin parts buckle.</Note>
    </Challenge>
  );
  const controls = (
    <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => { h.reset([]); setPick(null); setSelMember(null); }}>
      <Toggle label="Show bending (exaggerated)" checked={showDeflect} onChange={setShowDeflect} />
    </ToolBar>
  );
  return <Workbench title="Build the Bridge" tool={tool} controls={controls} panel={panel} />;
}
