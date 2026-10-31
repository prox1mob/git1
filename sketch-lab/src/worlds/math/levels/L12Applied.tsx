import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clamp, distToSegment, fmt, pick, pointInPolygon, polygonArea, perimeter, radToDeg, randInt, snap, type Vec } from '../../../core/geometry';
import { useHistory } from '../../../core/history';
import { useSettings, type Difficulty } from '../../../core/store';
import { Challenge, type CheckResult } from '../../../ui/feedback';
import { DesignLink, Note, SafetyNote, Segmented, Slider, Stat, Stats, Steps, Toggle, ToolBar } from '../../../ui/kit';
import { Workbench } from '../../../ui/lesson';
import { DimLine, GridLines, Handle, SvgDefs } from '../../../ui/svg';
import { ContainerDesigner } from './L09Solids';

const W = 800;

function Checklist({ items }: { items: { ok: boolean; text: ReactNode }[] }) {
  return (
    <ul className="checklist">
      {items.map((it, i) => (
        <li key={i}><span className={it.ok ? 'ok' : 'no'}>{it.ok ? '✓' : '✗'}</span> {it.text}</li>
      ))}
    </ul>
  );
}

function fromChecklist(items: { ok: boolean; text: ReactNode }[], okText: ReactNode, why: ReactNode): CheckResult {
  if (items.every((i) => i.ok)) return { ok: true, happened: okText };
  return { ok: false, happened: <Checklist items={items} />, why };
}

/* ================================================================== */
/* 1. Extension board socket spacing                                   */
/* ================================================================== */

function socketTask(d: Difficulty) {
  const n = d === 'easy' ? 3 : d === 'normal' ? 4 : 5;
  return { n, s: pick([40, 42, 45]), m: pick([15, 18, 20]), L: d === 'hard' ? 0 : pick([260, 280, 300, 320]) + (n - 3) * 60, gmin: 20, findLength: d === 'hard' };
}

function SocketsProject() {
  const { difficulty } = useSettings();
  const [task, setTask] = useState(() => socketTask(difficulty));
  const initial = (t: ReturnType<typeof socketTask>) => ({ L: t.L || 360, xs: Array.from({ length: t.n }, (_, i) => 30 + i * (t.s + 12)) });
  const h = useHistory(() => initial(task));
  const { L, xs } = h.value;
  const k = 680 / Math.max(L, 300);
  const ox = 60;
  const gaps = xs.slice(1).map((x, i) => x - (xs[i] + task.s));
  const left = xs[0];
  const right = L - (xs[xs.length - 1] + task.s);
  const ideal = task.findLength ? task.gmin : (L - 2 * task.m - task.n * task.s) / (task.n - 1);
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 300`}>
      <SvgDefs />
      <rect x={ox} y={90} width={L * k} height={90} rx={14} fill="#f8f9fa" stroke="#495057" strokeWidth={3} />
      <rect x={ox + L * k - 4} y={124} width={60} height={14} fill="#343a40" />
      {xs.map((x, i) => (
        <g key={i}>
          <rect x={ox + x * k} y={102} width={task.s * k} height={66} rx={8} fill="#fff" stroke="#868e96" strokeWidth={2} />
          <circle cx={ox + (x + task.s * 0.32) * k} cy={128} r={4} fill="#495057" />
          <circle cx={ox + (x + task.s * 0.68) * k} cy={128} r={4} fill="#495057" />
          <circle cx={ox + (x + task.s / 2) * k} cy={150} r={4} fill="#495057" />
          <Handle x={ox + (x + task.s / 2) * k} y={215} shape="diamond" r={8} onStart={h.checkpoint} title={`socket ${i + 1}`}
            onDrag={(p) => h.set((st) => ({ ...st, xs: st.xs.map((v, j) => (j === i ? clamp(snap((p.x - ox) / k - task.s / 2, 0.5), 0, st.L - task.s) : v)) }))} />
        </g>
      ))}
      <DimLine a={{ x: ox, y: 90 }} b={{ x: ox + L * k, y: 90 }} offset={-22} label={`board ${fmt(L, 1)} mm`} color="#1f2a44" />
      <DimLine a={{ x: ox, y: 180 }} b={{ x: ox + left * k, y: 180 }} offset={22} label={fmt(left, 1)} color="#c2255c" error={Math.abs(left - task.m) > 1} />
      {gaps.map((g, i) => (
        <DimLine key={i} a={{ x: ox + (xs[i] + task.s) * k, y: 180 }} b={{ x: ox + xs[i + 1] * k, y: 180 }} offset={22} label={fmt(g, 1)} color="#1c7ed6" error={g < task.gmin || Math.abs(g - ideal) > 1} />
      ))}
      <DimLine a={{ x: ox + (L - right) * k, y: 180 }} b={{ x: ox + L * k, y: 180 }} offset={22} label={fmt(right, 1)} color="#c2255c" error={Math.abs(right - task.m) > 1} />
      <text x={ox} y={270} fontSize={12} fill="#868e96">Drag the ◆ under each socket. All sizes in mm.</text>
    </svg>
  );
  const check = () => {
    const items = [
      { ok: Math.abs(left - task.m) <= 1 && Math.abs(right - task.m) <= 1, text: <>End margins {fmt(left, 1)} and {fmt(right, 1)} mm — need {task.m} mm each</> },
      { ok: gaps.every((g) => Math.abs(g - gaps[0]) <= 1), text: <>Gaps equal: {gaps.map((g) => fmt(g, 1)).join(', ')} mm</> },
      { ok: gaps.every((g) => g >= task.gmin - 0.01), text: <>Every gap at least {task.gmin} mm so plugs and adapters fit</> },
      ...(task.findLength ? [{ ok: Math.abs(L - (2 * task.m + task.n * task.s + (task.n - 1) * task.gmin)) <= 1, text: <>Board as short as possible ({fmt(L, 1)} mm)</> }] : []),
    ];
    return fromChecklist(items, `Equal ${fmt(gaps[0], 1)} mm gaps, ${task.m} mm margins.`, 'Total length = 2 × margin + n × socket width + (n − 1) × gap. Work out the gap first, then place each socket.');
  };
  const panel = (
    <Challenge
      id="l12-sockets"
      title="Extension board socket spacing"
      brief={
        <>
          <p>Place <span className="target">{task.n} sockets</span> ({task.s} mm wide) on a {task.findLength ? <>board that is <b>as short as possible</b></> : <span className="target">{task.L} mm</span>} board with <span className="target">{task.m} mm</span> at each end and <b>equal</b> gaps of at least {task.gmin} mm.</p>
          <SafetyNote>Real extension boards must meet electrical safety standards (for example IEC 60884 or your national standard), current ratings and creepage distances, and be certified. This is geometry practice only.</SafetyNote>
        </>
      }
      check={check}
      onNewTarget={() => { const t = socketTask(difficulty); setTask(t); h.reset(initial(t)); }}
      hint={task.findLength ? 'Use the minimum gap. Length = 2 × margin + n × width + (n − 1) × gap.' : 'Space left for gaps = length − 2 × margin − n × socket width. Share it among (n − 1) gaps.'}
      solution={<Steps steps={task.findLength
        ? [`L = 2 × ${task.m} + ${task.n} × ${task.s} + ${task.n - 1} × ${task.gmin} = ${2 * task.m + task.n * task.s + (task.n - 1) * task.gmin} mm`, 'Socket k starts at margin + k × (width + gap)']
        : [`space for gaps = ${task.L} − 2 × ${task.m} − ${task.n} × ${task.s} = ${task.L - 2 * task.m - task.n * task.s} mm`, `gap = ${task.L - 2 * task.m - task.n * task.s} ÷ ${task.n - 1} = ${fmt(ideal, 2)} mm`, `socket k starts at ${task.m} + k × (${task.s} + ${fmt(ideal, 2)}) mm`]} />}
    >
      {task.findLength && <Slider label="Board length" value={L} min={200} max={500} step={0.5} unit="mm" onStart={h.checkpoint} onChange={(x) => h.set((st) => ({ ...st, L: x }))} />}
    </Challenge>
  );
  return <Workbench title="Extension board socket spacing" tool={tool} controls={<ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />} panel={panel} />;
}

/* ================================================================== */
/* 2. Storage box with a set capacity                                  */
/* ================================================================== */

function BoxProject() {
  return (
    <ContainerDesigner
      id="l12-box"
      title="Storage box with a set capacity"
      fixedTarget={{ ml: 6000, t: 3, tol: 0.02 }}
      intro={<DesignLink title="Brief">A shoe-storage box must hold 6 litres. Walls are injection-moulded at 3 mm. Keep it under 300 mm in every direction.</DesignLink>}
    />
  );
}

/* ================================================================== */
/* 3. Camera body at scale                                             */
/* ================================================================== */

const CAM_SCALES = [{ label: '1:5', k: 0.2 }, { label: '1:2', k: 0.5 }, { label: '1:1', k: 1 }, { label: '2:1', k: 2 }];

function cameraTask(d: Difficulty) {
  const body = { w: randInt(10, 16) * 10, h: randInt(7, 11) * 10, d: randInt(5, 8) * 10, lens: randInt(3, 6) * 10, lensD: 0 };
  body.lensD = Math.min(body.h - 10, randInt(5, 7) * 10);
  const paper = d === 'easy' ? { name: 'A3', w: 420, h: 297 } : pick([{ name: 'A4', w: 297, h: 210 }, { name: 'A3', w: 420, h: 297 }]);
  return { body, paper, margin: 20, gap: 20 };
}

function CameraProject() {
  const { difficulty } = useSettings();
  const [task, setTask] = useState(() => cameraTask(difficulty));
  const [si, setSi] = useState(0);
  const [typed, setTyped] = useState('');
  const { body, paper } = task;
  const sc = CAM_SCALES[si];
  const needW = (body.w + body.d + body.lens) * sc.k + task.gap;
  const needH = body.h * sc.k;
  const availW = paper.w - 2 * task.margin;
  const availH = paper.h - 2 * task.margin;
  const fits = (k: number) => (body.w + body.d + body.lens) * k + task.gap <= availW && body.h * k <= availH;
  const best = [...CAM_SCALES].reverse().find((s) => fits(s.k));
  const P = Math.min(720 / paper.w, 420 / paper.h);
  const ox = 40;
  const oy = 20;
  const fx = ox + task.margin * P;
  const fy = oy + task.margin * P;
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 460`}>
      <rect x={ox} y={oy} width={paper.w * P} height={paper.h * P} fill="#fff" stroke="#adb5bd" />
      <rect x={fx} y={fy} width={availW * P} height={availH * P} fill="none" stroke="#dee2e6" strokeDasharray="4 4" />
      <text x={ox + 6} y={oy + 14} fontSize={11} fill="#868e96">{paper.name} {paper.w} × {paper.h} mm — 20 mm margins</text>
      <clipPath id="campaper"><rect x={ox} y={oy} width={paper.w * P} height={paper.h * P} /></clipPath>
      <g clipPath="url(#campaper)" stroke={fits(sc.k) ? '#1f2a44' : '#e5484d'} strokeWidth={2} fill="#f1f3f5">
        <rect x={fx} y={fy + 10} width={body.w * sc.k * P} height={body.h * sc.k * P} rx={6} />
        <circle cx={fx + (body.w * sc.k * P) / 2} cy={fy + 10 + (body.h * sc.k * P) / 2} r={(body.lensD / 2) * sc.k * P} fill="#dee2e6" />
        <circle cx={fx + (body.w * sc.k * P) / 2} cy={fy + 10 + (body.h * sc.k * P) / 2} r={(body.lensD / 4) * sc.k * P} fill="#495057" />
        <g transform={`translate(${fx + body.w * sc.k * P + task.gap * P} ${fy + 10})`}>
          <rect x={0} y={0} width={body.d * sc.k * P} height={body.h * sc.k * P} rx={4} />
          <rect x={body.d * sc.k * P} y={((body.h - body.lensD) / 2) * sc.k * P} width={body.lens * sc.k * P} height={body.lensD * sc.k * P} />
        </g>
      </g>
      <text x={fx} y={fy + body.h * sc.k * P + 30} fontSize={12} fill="#495057">FRONT VIEW</text>
      <text x={fx + body.w * sc.k * P + task.gap * P} y={fy + body.h * sc.k * P + 30} fontSize={12} fill="#495057">SIDE VIEW</text>
      <rect x={ox + paper.w * P - 110} y={oy + paper.h * P - 34} width={110} height={34} fill="#f8f9fa" stroke="#868e96" />
      <text x={ox + paper.w * P - 102} y={oy + paper.h * P - 14} fontSize={12} fill="#495057">SCALE {sc.label}</text>
    </svg>
  );
  const drawnW = body.w * sc.k;
  const check = () => {
    const items = [
      { ok: fits(sc.k), text: <>Both views fit inside the margins at {sc.label}</> },
      { ok: !!best && sc.label === best.label, text: <>Largest standard scale that fits (so details are as big as possible)</> },
      { ok: Math.abs(Number(typed) - drawnW) < 0.6 && typed.trim() !== '', text: <>Drawn width of the body: you said {typed || '—'} mm</> },
    ];
    return fromChecklist(items, `Scale ${sc.label}: the ${body.w} mm body is drawn ${fmt(drawnW, 1)} mm wide.`, `Views need ${fmt(needW, 0)} × ${fmt(needH, 0)} mm of paper at ${sc.label}; the space inside the margins is ${availW} × ${availH} mm.`);
  };
  const panel = (
    <Challenge
      id="l12-camera"
      title="Camera body at scale"
      brief={
        <>
          <p>Draw a camera body <b>{body.w} × {body.h} × {body.d} mm</b> with a lens sticking out <b>{body.lens} mm</b> (Ø {body.lensD} mm). Show a front view and a side view, {task.gap} mm apart, on <b>{paper.name}</b> paper.</p>
          <p>Pick the <b>largest</b> standard scale that fits, then type how wide the body is drawn.</p>
        </>
      }
      check={check}
      onNewTarget={() => { setTask(cameraTask(difficulty)); setTyped(''); setSi(0); }}
      hint="Add up everything side by side: front width + side depth + lens + gap. Multiply by the scale and compare with the paper minus margins."
      solution={<Steps steps={[
        `width needed at 1:1 = ${body.w} + ${body.d} + ${body.lens} + gap ${task.gap} = ${body.w + body.d + body.lens + task.gap} mm (gap stays 20)`,
        `space available = ${availW} × ${availH} mm`,
        `largest scale that fits: ${best?.label ?? 'none'}`,
        `drawn body width = ${body.w} × ${best?.k ?? 0} = ${fmt(body.w * (best?.k ?? 0), 1)} mm`,
      ]} />}
    >
      <Segmented value={si} onChange={setSi} options={CAM_SCALES.map((s, i) => ({ value: i, label: s.label }))} />
      <div className="quiz-input" style={{ marginTop: 8 }}>
        <span>Body drawn width =</span>
        <input inputMode="decimal" value={typed} onChange={(e) => setTyped(e.target.value)} />
        <span className="unit">mm</span>
      </div>
      <Stats><Stat label="views need" value={`${fmt(needW, 0)} × ${fmt(needH, 0)}`} sub="mm on paper" /><Stat label="space" value={`${availW} × ${availH}`} sub="mm" /></Stats>
    </Challenge>
  );
  return <Workbench title="Camera body at scale" tool={tool} panel={panel} />;
}

/* ================================================================== */
/* 4. Adjustable desk stand angle                                      */
/* ================================================================== */

function standTask(d: Difficulty) {
  const P = d === 'hard' ? randInt(24, 32) * 10 : 280;
  const target = d === 'easy' ? null : d === 'normal' ? pick([12, 15, 18, 20]) : randInt(11, 22);
  return { P, target, lo: 15, hi: 20, tol: d === 'hard' ? 0.3 : 0.5, step: d === 'hard' ? 0.5 : d === 'normal' ? 1 : 5 };
}

function StandProject() {
  const { difficulty } = useSettings();
  const [task, setTask] = useState(() => standTask(difficulty));
  const h = useHistory({ hgt: 40 });
  const theta = radToDeg(Math.asin(clamp(h.value.hgt / task.P, 0, 1)));
  const k = 1.6;
  const hinge = { x: 120, y: 380 };
  const run = Math.sqrt(Math.max(0, task.P * task.P - h.value.hgt * h.value.hgt));
  const top = { x: hinge.x + run * k, y: hinge.y - h.value.hgt * k };
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 440`}>
      <SvgDefs />
      <line x1={40} y1={392} x2={760} y2={392} stroke="#adb5bd" strokeWidth={3} />
      <rect x={hinge.x - 10} y={hinge.y} width={task.P * k + 30} height={12} rx={3} fill="#868e96" />
      <line x1={hinge.x} y1={hinge.y} x2={top.x} y2={top.y} stroke="#495057" strokeWidth={14} strokeLinecap="round" />
      <rect x={hinge.x} y={hinge.y - 34} width={22} height={24} fill="#495057" />
      <line x1={top.x} y1={top.y} x2={top.x} y2={hinge.y} stroke="#e8590c" strokeWidth={8} />
      <g transform={`translate(${hinge.x} ${hinge.y - 7}) rotate(${-theta})`}>
        <rect x={10} y={-16} width={task.P * k * 0.95} height={8} rx={2} fill="#343a40" />
        <rect x={20} y={-22} width={task.P * k * 0.7} height={6} rx={2} fill="#adb5bd" />
      </g>
      <DimLine a={{ x: top.x, y: hinge.y }} b={top} offset={-26} label={`prop ${fmt(h.value.hgt, 1)} mm`} color="#e8590c" />
      <text x={hinge.x + 70} y={hinge.y - 12} className="svg-label" fill="#1c7ed6">{fmt(theta, 1)}°</text>
      <Handle x={top.x} y={top.y} onStart={h.checkpoint} title="prop height" onDrag={(p) => h.set({ hgt: clamp(snap((hinge.y - p.y) / k, task.step), 0, task.P * 0.8) })} />
      <text x={40} y={30} className="svg-label" fill="#495057">Platform length {task.P} mm, hinged at the front. A prop lifts the back.</text>
    </svg>
  );
  const check = () => {
    const ok = task.target === null ? theta >= task.lo && theta <= task.hi : Math.abs(theta - task.target) <= task.tol;
    if (ok) return { ok: true, happened: `${fmt(theta, 1)}° with a ${fmt(h.value.hgt, 1)} mm prop.` };
    const want = task.target ?? (task.lo + task.hi) / 2;
    return {
      ok: false,
      happened: <>The platform tilts <b>{fmt(theta, 1)}°</b> — {theta < want ? 'too flat' : 'too steep'}.</>,
      why: 'The platform is the hypotenuse, the prop is the opposite side: sin θ = prop ÷ platform length.',
    };
  };
  const panel = (
    <Challenge
      id="l12-stand"
      title="Adjustable desk stand angle"
      brief={
        <>
          <p>{task.target === null ? <>Set the laptop stand between <span className="target">{task.lo}° and {task.hi}°</span>, a common typing angle range.</> : <>Make the stand tilt exactly <span className="target">{task.target}°</span> (±{task.tol}°).</>} The platform is {task.P} mm long.</p>
          <SafetyNote>A real stand must also be tested for the laptop's weight, wobble and tipping. Here we only design the angle.</SafetyNote>
        </>
      }
      check={check}
      onNewTarget={() => { setTask(standTask(difficulty)); h.reset(); }}
      hint="prop height = platform length × sin(angle)."
      solution={<Steps steps={[`prop = ${task.P} × sin ${task.target ?? 17.5}°`, `= ${task.P} × ${fmt(Math.sin(((task.target ?? 17.5) * Math.PI) / 180), 4)}`, `≈ ${fmt(task.P * Math.sin(((task.target ?? 17.5) * Math.PI) / 180), 1)} mm`]} />}
    >
      <Stats><Stat label="angle" value={`${fmt(theta, 1)}°`} color="#1c7ed6" /><Stat label="prop ÷ platform" value={fmt(h.value.hgt / task.P, 4)} sub="= sin θ" /></Stats>
    </Challenge>
  );
  return <Workbench title="Adjustable desk stand angle" tool={tool} controls={<ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />} panel={panel} />;
}

/* ================================================================== */
/* 5. Rotating mechanism: gear pair                                    */
/* ================================================================== */

function gearPath(T: number, m: number, k: number): string {
  const r = (m * T) / 2;
  const ra = (r + m) * k;
  const rf = (r - 1.25 * m) * k;
  const step = (2 * Math.PI) / T;
  const pt = (rr: number, a: number) => `${(rr * Math.cos(a)).toFixed(2)} ${(-rr * Math.sin(a)).toFixed(2)}`;
  let d = '';
  for (let i = 0; i < T; i++) {
    const a = i * step;
    d += `${i ? 'L' : 'M'}${pt(rf, a)} L${pt(rf, a + step * 0.18)} L${pt(ra, a + step * 0.36)} L${pt(ra, a + step * 0.64)} L${pt(rf, a + step * 0.82)} `;
  }
  return d + 'Z';
}

function gearTask(d: Difficulty) {
  if (d === 'easy') return { ratio: 2, centre: null as number | null, m: 2 };
  if (d === 'normal') return { ratio: 3, centre: 64, m: 2 };
  return { ratio: 2.5, centre: 70, m: 2 };
}

function GearsProject() {
  const { difficulty } = useSettings();
  const [task, setTask] = useState(() => gearTask(difficulty));
  const h = useHistory({ t1: 12, t2: 20 });
  const { t1, t2 } = h.value;
  const [angle, setAngle] = useState(0);
  const [run, setRun] = useState(true);
  const raf = useRef(0);
  useEffect(() => {
    if (!run) return;
    let last = performance.now();
    const tick = (t: number) => {
      setAngle((a) => (a + ((t - last) / 1000) * 60) % 360000);
      last = t;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [run]);
  const m = task.m;
  const r1 = (m * t1) / 2;
  const r2 = (m * t2) / 2;
  const k = Math.min(6, 640 / (2 * (r1 + r2) + 4 * m));
  const c1 = { x: 400 - (r1 + r2) * k + r1 * k, y: 260 };
  const c2 = { x: c1.x + (r1 + r2) * k, y: 250 };
  const a2 = -angle * (t1 / t2) + 180 - 180 / t2;
  const ratio = t2 / t1;
  const centre = r1 + r2;
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 480`}>
      <g transform={`translate(${c1.x} ${c1.y}) rotate(${-angle})`}>
        <path d={gearPath(t1, m, k)} fill="#ffa94d" stroke="#d9480f" strokeWidth={1.5} />
        <circle r={r1 * k} fill="none" stroke="#d9480f" strokeDasharray="3 4" opacity={0.6} />
        <line x1={0} y1={0} x2={r1 * k * 0.8} y2={0} stroke="#7f3b08" strokeWidth={4} />
        <circle r={6} fill="#7f3b08" />
      </g>
      <g transform={`translate(${c2.x} ${c2.y}) rotate(${-a2})`}>
        <path d={gearPath(t2, m, k)} fill="#74c0fc" stroke="#1864ab" strokeWidth={1.5} />
        <circle r={r2 * k} fill="none" stroke="#1864ab" strokeDasharray="3 4" opacity={0.6} />
        <line x1={0} y1={0} x2={r2 * k * 0.8} y2={0} stroke="#0b3d91" strokeWidth={4} />
        <circle r={6} fill="#0b3d91" />
      </g>
      <DimLine a={{ x: c1.x, y: c1.y + Math.max(r1, r2) * k + 30 }} b={{ x: c2.x, y: c2.y + Math.max(r1, r2) * k + 30 }} offset={0} label={`centre distance ${fmt(centre, 1)} mm`} color={task.centre && Math.abs(centre - task.centre) > 0.01 ? '#e5484d' : '#1f2a44'} />
      <text x={20} y={30} className="svg-label" fill="#d9480f">motor gear: {t1} teeth</text>
      <text x={20} y={52} className="svg-label" fill="#1864ab">output gear: {t2} teeth — turns {fmt(1 / ratio, 3)}× as fast</text>
    </svg>
  );
  const check = () => {
    const items = [
      { ok: Math.abs(ratio - task.ratio) < 1e-6, text: <>Output turns 1/{task.ratio} as fast — teeth ratio {t2}:{t1} = {fmt(ratio, 3)}</> },
      ...(task.centre ? [{ ok: Math.abs(centre - task.centre) < 1e-6, text: <>Centre distance {fmt(centre, 1)} mm (needs {task.centre} mm)</> }] : []),
    ];
    return fromChecklist(items, `${t1} and ${t2} teeth: ratio 1 : ${fmt(ratio, 2)}, centres ${fmt(centre, 1)} mm apart.`, 'Speed ratio = output teeth ÷ input teeth. Centre distance = module × (t1 + t2) ÷ 2.');
  };
  const panel = (
    <Challenge
      id="l12-gears"
      title="A simple rotating mechanism"
      brief={
        <>
          <p>A small motor spins too fast. Choose two gears (module {m} mm) so the output turns <span className="target">{task.ratio}× slower</span>{task.centre ? <> and the shafts are <span className="target">{task.centre} mm</span> apart</> : null}.</p>
          <SafetyNote>Real gearboxes also need tooth strength, material and lubrication checks.</SafetyNote>
        </>
      }
      check={check}
      onNewTarget={() => { setTask(gearTask(difficulty)); h.reset(); }}
      hint={task.centre ? `Centre distance ${task.centre} mm with module ${m} means t1 + t2 = 2 × ${task.centre} ÷ ${m} = ${(2 * task.centre) / m} teeth in total.` : 'Output teeth must be twice the motor teeth.'}
      solution={<Steps steps={task.centre ? [`t1 + t2 = ${(2 * task.centre) / m}`, `t2 = ${task.ratio} × t1`, `t1 × (1 + ${task.ratio}) = ${(2 * task.centre) / m} → t1 = ${(2 * task.centre) / m / (1 + task.ratio)}`, `t2 = ${((2 * task.centre) / m / (1 + task.ratio)) * task.ratio}`] : ['for example t1 = 12, t2 = 24']} />}
    >
      <Slider label="Motor gear teeth" value={t1} min={8} max={40} onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, t1: x }))} color="#d9480f" />
      <Slider label="Output gear teeth" value={t2} min={8} max={60} onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, t2: x }))} color="#1864ab" />
      <Toggle label="Run motor" checked={run} onChange={setRun} />
    </Challenge>
  );
  return <Workbench title="A simple rotating mechanism" tool={tool} controls={<ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />} panel={panel} />;
}

/* ================================================================== */
/* 6. Symmetrical product enclosure                                    */
/* ================================================================== */

function enclosureTask(d: Difficulty) {
  const pcb = { w: pick([50, 56, 60, 64]), h: pick([24, 28, 32]) };
  const clear = d === 'easy' ? 2 : 3;
  const width = d === 'easy' ? null : pcb.w + 2 * clear + pick([4, 6, 8, 10]);
  const maxArea = d === 'hard' ? Math.round((pcb.w + 2 * clear + 8) * (pcb.h + 2 * clear + 10) * 0.92) : null;
  return { pcb, clear, width, maxArea, standoff: 4 };
}

function EnclosureProject() {
  const { difficulty } = useSettings();
  const [task, setTask] = useState(() => enclosureTask(difficulty));
  const h = useHistory<{ pts: Vec[]; top: number }>({ pts: [{ x: 30, y: 0 }, { x: 34, y: 14 }, { x: 28, y: 30 }], top: 36 });
  const { pts, top } = h.value;
  const k = 5;
  const cx = 400;
  const by = 400;
  const X = (x: number) => cx + x * k;
  const Y = (y: number) => by - y * k;
  const half: Vec[] = [{ x: 0, y: 0 }, ...pts, { x: 0, y: top }];
  const outline: Vec[] = [...half, ...half.slice(1, -1).reverse().map((p) => ({ x: -p.x, y: p.y }))];
  const pcbR: Vec[] = [
    { x: -task.pcb.w / 2, y: task.standoff }, { x: task.pcb.w / 2, y: task.standoff },
    { x: task.pcb.w / 2, y: task.standoff + task.pcb.h }, { x: -task.pcb.w / 2, y: task.standoff + task.pcb.h },
  ];
  const width = 2 * Math.max(...outline.map((p) => p.x));
  const area = polygonArea(outline);
  const inside = pcbR.every((p) => pointInPolygon(p, outline));
  let minClear = Infinity;
  for (const p of pcbR) for (let i = 0; i < outline.length; i++) minClear = Math.min(minClear, distToSegment(p, outline[i], outline[(i + 1) % outline.length]));
  for (const q of outline) for (let i = 0; i < 4; i++) {
    const d = distToSegment(q, pcbR[i], pcbR[(i + 1) % 4]);
    const inPcb = q.x > pcbR[0].x && q.x < pcbR[1].x && q.y > pcbR[0].y && q.y < pcbR[2].y;
    minClear = Math.min(minClear, inPcb ? 0 : d);
  }
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 440`}>
      <GridLines x0={cx - 75 * k} y0={by - 60 * k} w={150 * k} h={60 * k} step={2 * k} major={5} color="#f4f5f7" majorColor="#e3e8f2" />
      <line x1={cx} y1={20} x2={cx} y2={430} stroke="#7048e8" strokeDasharray="10 4 2 4" strokeWidth={1.5} />
      <text x={cx + 6} y={34} className="svg-label small" fill="#7048e8">centre line (mirror)</text>
      <path d={outline.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)} ${Y(p.y)}`).join(' ') + ' Z'} fill="#e7f5ff" stroke="#1971c2" strokeWidth={3} strokeLinejoin="round" />
      <rect x={X(pcbR[0].x)} y={Y(pcbR[2].y)} width={task.pcb.w * k} height={task.pcb.h * k} fill={inside && minClear >= task.clear ? '#b2f2bb' : '#ffc9c9'} stroke="#2b8a3e" strokeWidth={2} />
      <text x={cx} y={Y(task.standoff + task.pcb.h / 2) + 5} textAnchor="middle" className="svg-label small" fill="#2b8a3e">circuit board {task.pcb.w} × {task.pcb.h}</text>
      <DimLine a={{ x: X(-width / 2), y: Y(0) }} b={{ x: X(width / 2), y: Y(0) }} offset={20} label={`width ${fmt(width, 1)} mm`} error={task.width !== null && Math.abs(width - task.width) > 1} />
      {pts.map((p, i) => (
        <Handle key={i} x={X(p.x)} y={Y(p.y)} onStart={h.checkpoint} step={k * 0.5}
          onDrag={(q) => h.set((s) => ({ ...s, pts: s.pts.map((o, j) => (j === i ? { x: clamp(snap((q.x - cx) / k, 0.5), 1, 74), y: clamp(snap((by - q.y) / k, 0.5), 0, 58) } : o)) }))} />
      ))}
      <Handle x={X(0)} y={Y(top)} shape="square" onStart={h.checkpoint} title="top of the enclosure" onDrag={(q) => h.set((s) => ({ ...s, top: clamp(snap((by - q.y) / k, 0.5), 5, 58) }))} />
    </svg>
  );
  const check = () => {
    const items = [
      { ok: inside, text: <>Circuit board fits inside the outline</> },
      { ok: minClear >= task.clear - 1e-6, text: <>At least {task.clear} mm clearance around the board (now {fmt(Math.max(0, minClear), 1)} mm)</> },
      ...(task.width !== null ? [{ ok: Math.abs(width - task.width) <= 1, text: <>Overall width {fmt(width, 1)} mm (needs {task.width} ± 1)</> }] : []),
      ...(task.maxArea !== null ? [{ ok: area <= task.maxArea, text: <>Cross-section area {fmt(area, 0)} mm² — at most {task.maxArea} mm² to save material</> }] : []),
    ];
    return fromChecklist(items, `A symmetrical ${fmt(width, 1)} mm enclosure, ${fmt(area, 0)} mm² in section.`, 'Shape only the right half — the mirror makes the left. Keep every wall at least the clearance away from the board.');
  };
  const panel = (
    <Challenge
      id="l12-enclosure"
      title="Symmetrical product enclosure"
      brief={
        <>
          <p>Design the cross-section of a remote-control shell around a <span className="target">{task.pcb.w} × {task.pcb.h} mm</span> circuit board sitting {task.standoff} mm above the base.</p>
          <ul>
            <li>Clearance: <b>{task.clear} mm</b> all round.</li>
            {task.width !== null && <li>Overall width: <b>{task.width} mm</b>.</li>}
            {task.maxArea !== null && <li>Cross-section area ≤ <b>{task.maxArea} mm²</b> (compact and light).</li>}
          </ul>
          <p className="muted small">Drag the right-hand points; the left half mirrors automatically.</p>
        </>
      }
      check={check}
      onNewTarget={() => { setTask(enclosureTask(difficulty)); h.reset(); }}
      hint={`The widest point must be at least ${task.pcb.w / 2 + task.clear} mm from the centre line, level with the board.`}
      solution={<Steps steps={[`board half-width + clearance = ${task.pcb.w / 2} + ${task.clear} = ${task.pcb.w / 2 + task.clear} mm`, `top above ${task.standoff + task.pcb.h + task.clear} mm`, task.width !== null ? `put the widest point at x = ${task.width / 2} mm` : 'keep the outline smooth and close to the board']} />}
    >
      <Stats><Stat label="width" value={`${fmt(width, 1)} mm`} /><Stat label="area" value={`${fmt(area, 0)} mm²`} /><Stat label="wall length" value={`${fmt(perimeter(outline), 0)} mm`} /></Stats>
    </Challenge>
  );
  return <Workbench title="Symmetrical product enclosure" tool={tool} controls={<ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />} panel={panel} />;
}

/* ================================================================== */
/* 7. Prototype material estimate: cardboard box net                   */
/* ================================================================== */

const SHEET = { w: 600, h: 400 };
const TAB = 15;

function MaterialProject() {
  const { difficulty } = useSettings();
  const targetL = difficulty === 'easy' ? 2 : difficulty === 'normal' ? 4 : 5.5;
  const h = useHistory({ W: 120, D: 80, H: 100 });
  const { W: bw, D, H } = h.value;
  const netW = 2 * bw + 2 * D + TAB;
  const netH = H + D;
  const fits = netW <= SHEET.w && netH <= SHEET.h;
  const vol = (bw * D * H) / 1e6;
  const netArea = (2 * bw + 2 * D) * netH + TAB * H;
  const waste = 1 - netArea / (SHEET.w * SHEET.h);
  const k = 1.2;
  const ox = 40;
  const oy = 30;
  const X = (x: number) => ox + x * k;
  const Y = (y: number) => oy + y * k;
  const panels = [bw, D, bw, D];
  let x = 0;
  const parts: ReactNode[] = [];
  panels.forEach((pw, i) => {
    parts.push(<rect key={`p${i}`} x={X(x)} y={Y(D / 2)} width={pw * k} height={H * k} fill={i % 2 ? '#ffe8cc' : '#ffd8a8'} stroke="#7f3b08" />);
    parts.push(<rect key={`t${i}`} x={X(x)} y={Y(0)} width={pw * k} height={(D / 2) * k} fill="#fff4e6" stroke="#7f3b08" />);
    parts.push(<rect key={`b${i}`} x={X(x)} y={Y(D / 2 + H)} width={pw * k} height={(D / 2) * k} fill="#fff4e6" stroke="#7f3b08" />);
    x += pw;
  });
  parts.push(<path key="tab" d={`M${X(x)} ${Y(D / 2)} L${X(x + TAB)} ${Y(D / 2 + 8)} L${X(x + TAB)} ${Y(D / 2 + H - 8)} L${X(x)} ${Y(D / 2 + H)} Z`} fill="#ffe8cc" stroke="#7f3b08" />);
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 530`}>
      <rect x={X(0)} y={Y(0)} width={SHEET.w * k} height={SHEET.h * k} fill="#f8f9fa" stroke="#868e96" strokeDasharray="6 4" />
      <text x={X(SHEET.w) - 4} y={Y(SHEET.h) - 6} textAnchor="end" fontSize={12} fill="#868e96">card sheet {SHEET.w} × {SHEET.h} mm</text>
      <g opacity={fits ? 1 : 0.85}>{parts}</g>
      {!fits && <rect x={X(0)} y={Y(0)} width={netW * k} height={netH * k} fill="url(#hatch)" stroke="#e5484d" strokeWidth={2} />}
      <SvgDefs />
      <DimLine a={{ x: X(0), y: Y(netH) }} b={{ x: X(netW), y: Y(netH) }} offset={18} label={`net ${fmt(netW, 0)} mm`} error={netW > SHEET.w} />
      <DimLine a={{ x: X(netW), y: Y(netH) }} b={{ x: X(netW), y: Y(0) }} offset={-18} label={`${fmt(netH, 0)} mm`} error={netH > SHEET.h} />
    </svg>
  );
  const check = () => {
    const items = [
      { ok: fits, text: <>Net ({fmt(netW, 0)} × {fmt(netH, 0)} mm) fits on the {SHEET.w} × {SHEET.h} mm sheet</> },
      { ok: vol >= targetL, text: <>Volume {fmt(vol, 2)} L — needs at least {targetL} L</> },
    ];
    return fromChecklist(items, `${fmt(vol, 2)} L box from one sheet, ${fmt(waste * 100, 0)}% offcut.`, 'Net width = 2W + 2D + glue tab; net height = H + D (two half-depth flaps). Trade width for height to fit.');
  };
  const panel = (
    <Challenge
      id="l12-material"
      title="Prototype material estimate"
      brief={
        <>
          <p>Cut a cardboard prototype box (standard flap style) from <b>one {SHEET.w} × {SHEET.h} mm sheet</b>. It must hold at least <span className="target">{targetL} litres</span>.</p>
          <Note>Solid lines are cuts; flaps are half the depth so they meet in the middle. The glue tab is {TAB} mm.</Note>
        </>
      }
      check={check}
      hint="The net is long and short: 2W + 2D across, H + D down. Make D smaller to gain height, or W smaller to gain room for D."
      solution={<Steps steps={['Try W = 175, D = 115, H = 285', `net = 2×175 + 2×115 + 15 = 595 mm across, 285 + 115 = 400 mm down`, 'volume = 175 × 115 × 285 mm³ ≈ 5.74 L']} />}
    >
      <Slider label="Width W" value={bw} min={40} max={250} unit="mm" onStart={h.checkpoint} onChange={(v) => h.set((s) => ({ ...s, W: v }))} />
      <Slider label="Depth D" value={D} min={40} max={250} unit="mm" onStart={h.checkpoint} onChange={(v) => h.set((s) => ({ ...s, D: v }))} />
      <Slider label="Height H" value={H} min={40} max={350} unit="mm" onStart={h.checkpoint} onChange={(v) => h.set((s) => ({ ...s, H: v }))} />
      <Stats>
        <Stat label="volume" value={`${fmt(vol, 2)} L`} color="#1c7ed6" />
        <Stat label="card used" value={`${fmt(netArea / 1e4, 0)} dm²`} />
        <Stat label="offcut" value={`${fmt(Math.max(0, waste) * 100, 0)}%`} color="#e8590c" />
      </Stats>
    </Challenge>
  );
  return <Workbench title="Prototype material estimate" tool={tool} controls={<ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />} panel={panel} />;
}

export default {
  'l12-sockets': SocketsProject,
  'l12-box': BoxProject,
  'l12-camera': CameraProject,
  'l12-stand': StandProject,
  'l12-gears': GearsProject,
  'l12-enclosure': EnclosureProject,
  'l12-material': MaterialProject,
};
