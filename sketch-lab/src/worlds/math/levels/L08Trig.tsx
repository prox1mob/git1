import { useEffect, useRef, useState, type ReactNode } from 'react';
import { arcPath, clamp, degToRad, fmt, headingDeg, polar, randInt, radToDeg } from '../../../core/geometry';
import { useHistory } from '../../../core/history';
import { useSettings, type Difficulty } from '../../../core/store';
import { Challenge, ChoiceQuiz, NumberQuiz, type CheckResult } from '../../../ui/feedback';
import { DesignLink, Formula, NumberTable, Segmented, Slider, Stat, Stats, Stepper, Steps, T, Toggle, ToolBar } from '../../../ui/kit';
import { Lesson, Workbench, type StageKey } from '../../../ui/lesson';
import { DimLine, Handle, SvgDefs } from '../../../ui/svg';

const W = 800;

/* ================================================================== */
/* Unit-circle explorer                                                */
/* ================================================================== */

function UnitCircleLesson() {
  const h = useHistory({ theta: 40 });
  const { theta } = h.value;
  const [playing, setPlaying] = useState(false);
  const [showTan, setShowTan] = useState(false);
  const C = { x: 200, y: 250 };
  const R = 150;
  const P = polar(C, R, theta);
  const cs = Math.cos(degToRad(theta));
  const sn = Math.sin(degToRad(theta));
  const tn = Math.tan(degToRad(theta));
  const raf = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      h.set((s) => ({ theta: (s.theta + dt * 45) % 360 }));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // graph on the right: θ 0..360 → x 400..770
  const GX = 400;
  const GW = 370;
  const gx = (d: number) => GX + (GW * d) / 360;
  const gy = (v: number) => C.y - v * R;
  const wave = (f: (r: number) => number, upto: number) => {
    let d = '';
    for (let a = 0; a <= upto; a += 2) d += `${a ? 'L' : 'M'}${gx(a)} ${gy(f(degToRad(a)))} `;
    return d;
  };
  const tanEnd = { x: C.x + R, y: C.y - clamp(tn, -1.6, 1.6) * R };
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 500`}>
      <line x1={C.x - R - 30} y1={C.y} x2={C.x + R + 30} y2={C.y} stroke="#adb5bd" />
      <line x1={C.x} y1={C.y - R - 30} x2={C.x} y2={C.y + R + 30} stroke="#adb5bd" />
      <circle cx={C.x} cy={C.y} r={R} fill="none" stroke="#1f2a44" strokeWidth={2} />
      <text x={C.x + R + 6} y={C.y + 16} fontSize={12} fill="#868e96">1</text>
      <text x={C.x + 4} y={C.y - R - 6} fontSize={12} fill="#868e96">1</text>
      <path d={arcPath(C, 34, 0, theta, true)} fill="#ffd43b55" stroke="#f08c00" />
      <text x={polar(C, 52, theta / 2).x} y={polar(C, 52, theta / 2).y} className="svg-label small" fill="#e67700" textAnchor="middle">θ</text>
      <line x1={C.x} y1={C.y} x2={P.x} y2={P.y} stroke="#2b8a3e" strokeWidth={3} />
      <line x1={C.x} y1={C.y} x2={P.x} y2={C.y} stroke="#1c7ed6" strokeWidth={6} strokeLinecap="round" />
      <line x1={P.x} y1={C.y} x2={P.x} y2={P.y} stroke="#e5484d" strokeWidth={6} strokeLinecap="round" />
      <text x={(C.x + P.x) / 2} y={C.y + (sn >= 0 ? 22 : -10)} textAnchor="middle" className="svg-label small" fill="#1c7ed6">cos = {fmt(cs, 3)}</text>
      <text x={P.x + (cs >= 0 ? 8 : -8)} y={(C.y + P.y) / 2} textAnchor={cs >= 0 ? 'start' : 'end'} className="svg-label small" fill="#e5484d">sin = {fmt(sn, 3)}</text>
      {showTan && Math.abs(cs) > 0.05 && (
        <g>
          <line x1={C.x + R} y1={C.y - R * 1.7} x2={C.x + R} y2={C.y + R * 1.7} stroke="#7048e8" strokeDasharray="4 4" />
          <line x1={C.x + R} y1={C.y} x2={tanEnd.x} y2={tanEnd.y} stroke="#7048e8" strokeWidth={6} />
          <line x1={C.x} y1={C.y} x2={tanEnd.x} y2={tanEnd.y} stroke="#7048e8" strokeDasharray="3 3" />
          <text x={C.x + R + 8} y={tanEnd.y} className="svg-label small" fill="#7048e8">tan = {Math.abs(tn) > 50 ? '∞' : fmt(tn, 3)}</text>
        </g>
      )}
      <line x1={P.x} y1={P.y} x2={gx(theta)} y2={gy(sn)} stroke="#e5484d" strokeDasharray="2 4" />
      {/* graph */}
      <line x1={GX} y1={C.y} x2={GX + GW} y2={C.y} stroke="#adb5bd" />
      <line x1={GX} y1={gy(1.2)} x2={GX} y2={gy(-1.2)} stroke="#adb5bd" />
      {[90, 180, 270, 360].map((a) => <text key={a} x={gx(a)} y={C.y + 16} fontSize={11} textAnchor="middle" fill="#868e96">{a}°</text>)}
      <text x={GX - 6} y={gy(1) + 4} fontSize={11} textAnchor="end" fill="#868e96">1</text>
      <text x={GX - 6} y={gy(-1) + 4} fontSize={11} textAnchor="end" fill="#868e96">−1</text>
      <path d={wave(Math.sin, 360)} fill="none" stroke="#ffc9c9" strokeWidth={2} />
      <path d={wave(Math.cos, 360)} fill="none" stroke="#a5d8ff" strokeWidth={2} />
      <path d={wave(Math.sin, theta)} fill="none" stroke="#e5484d" strokeWidth={3} />
      <path d={wave(Math.cos, theta)} fill="none" stroke="#1c7ed6" strokeWidth={3} />
      <circle cx={gx(theta)} cy={gy(sn)} r={6} fill="#e5484d" />
      <circle cx={gx(theta)} cy={gy(cs)} r={6} fill="#1c7ed6" />
      <text x={GX + GW - 4} y={gy(1.25)} textAnchor="end" fontSize={12} fill="#e5484d" fontWeight={700}>sin θ (height)</text>
      <text x={GX + GW - 4} y={gy(1.25) + 16} textAnchor="end" fontSize={12} fill="#1c7ed6" fontWeight={700}>cos θ (sideways)</text>
      <Handle x={P.x} y={P.y} color="#2b8a3e" r={11} title="turn the radius" onStart={() => { setPlaying(false); h.checkpoint(); }} onDrag={(p) => h.set({ theta: Math.round(headingDeg(C, p)) })} />
    </svg>
  );
  const controls = (
    <>
      <Slider label="Angle θ" value={Math.round(theta)} min={0} max={359} unit="°" onStart={h.checkpoint} onChange={(x) => h.set({ theta: x })} color="#f08c00" />
      <button className="btn primary" onClick={() => setPlaying((p) => !p)}>{playing ? '⏸ Pause' : '▶ Spin it'}</button>
      <Toggle label="Show tangent" checked={showTan} onChange={setShowTan} />
      <div className="row">{[0, 30, 45, 60, 90, 180, 270].map((a) => <button key={a} className="btn small" onClick={() => { setPlaying(false); h.commit({ theta: a }); }}>{a}°</button>)}</div>
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => { setPlaying(false); h.reset(); }} />
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A point goes round a circle of radius <b>1</b>. Its <b style={{ color: '#1c7ed6' }}>sideways</b> distance is the blue bar; its <b style={{ color: '#e5484d' }}>height</b> is the red bar.</p>,
    touch: <p>Drag the green point round the circle, or press <b>▶ Spin it</b>. On the right, the bars become waves.</p>,
    experiment: (
      <ul>
        <li>Visit 0°, 90°, 180°, 270°. Where is each bar biggest? Zero?</li>
        <li>When is the height negative?</li>
        <li>Turn on <b>Show tangent</b> and go towards 90°.</li>
      </ul>
    ),
    discover: (
      <>
        <ChoiceQuiz question="At 90°, how long are the blue (sideways) and red (height) bars?" options={[{ label: 'blue 0, red 1', correct: true, why: 'Straight up: no sideways distance, full height. cos 90° = 0, sin 90° = 1.' }, { label: 'blue 1, red 0', why: 'That is 0° — pointing right.' }, { label: 'both 0.5', why: 'At 90° the point is right at the top.' }]} />
        <ChoiceQuiz question="blue² + red² is always…" options={[{ label: '1', correct: true, why: 'They are the two short sides of a right triangle whose long side is the radius 1. Pythagoras: cos² + sin² = 1.' }, { label: 'it changes', why: 'Check the Numbers tab at several angles.' }]} />
      </>
    ),
    understand: (
      <>
        <p><T k="cosine" /> = how much of the radius points <b>sideways</b>. <T k="sine" /> = how much points <b>up</b>.</p>
        <p>For a radius r (not 1), just multiply: sideways = r × cos θ, up = r × sin θ.</p>
        <p><T k="tangent" /> = up ÷ sideways = steepness of the radius line.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'x', means: 'sideways position', color: '#1c7ed6' }, ' = ', { s: 'r', means: 'radius', color: '#2b8a3e' }, ' × cos ', { s: 'θ', means: 'angle from the right-hand side', color: '#f08c00' }]} />
        <Formula parts={[{ s: 'y', means: 'height', color: '#e5484d' }, ' = ', { s: 'r', means: 'radius', color: '#2b8a3e' }, ' × sin ', { s: 'θ', means: 'angle', color: '#f08c00' }]} />
        <NumberQuiz question="An LED sits on a ring of radius 40 mm at 30°. How far right of the centre is it? (mm)" answer={34.64} tolerance={0.05} unit="mm" hint="sideways = r × cos θ."
          diagnose={(x) => (Math.abs(x - 20) < 0.1 ? 'That is the height (r × sin 30°). Sideways uses cos.' : null)}
          solution={<Steps steps={['cos 30° ≈ 0.866', '40 × 0.866 ≈ 34.64 mm']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Knob markings, clock hands, fan blades and LED rings: every position is (r cos θ, r sin θ).</li>
          <li>Rotating mechanisms move up and down in a sine wave (try the gears in Level 12).</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['θ', `${fmt(theta, 1)}° = ${fmt(degToRad(theta), 3)} rad`],
      ['cos θ (sideways)', fmt(cs, 4)],
      ['sin θ (height)', fmt(sn, 4)],
      ['tan θ = sin ÷ cos', Math.abs(cs) < 1e-6 ? 'undefined' : fmt(tn, 4)],
      ['cos² + sin²', `${fmt(cs * cs, 4)} + ${fmt(sn * sn, 4)} = ${fmt(cs * cs + sn * sn, 4)}`],
    ]} />
  );
  return <Lesson id="l8-unitcircle" title="Unit-circle explorer" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Right-triangle ratios                                               */
/* ================================================================== */

function TriangleLesson() {
  const h = useHistory({ theta: 35, hyp: 8 });
  const { theta, hyp } = h.value;
  const [copy, setCopy] = useState(false);
  const S = 40;
  const A = { x: 100, y: 440 };
  const adj = hyp * Math.cos(degToRad(theta));
  const opp = hyp * Math.sin(degToRad(theta));
  const B = { x: A.x + adj * S, y: A.y };
  const Cc = { x: B.x, y: A.y - opp * S };
  const tri = (k: number, alpha = 1) => {
    const b = { x: A.x + adj * S * k, y: A.y };
    const c = { x: b.x, y: A.y - opp * S * k };
    return (
      <g opacity={alpha}>
        <line x1={A.x} y1={A.y} x2={b.x} y2={b.y} stroke="#1c7ed6" strokeWidth={5} />
        <line x1={b.x} y1={b.y} x2={c.x} y2={c.y} stroke="#e5484d" strokeWidth={5} />
        <line x1={A.x} y1={A.y} x2={c.x} y2={c.y} stroke="#2b8a3e" strokeWidth={5} />
        <path d={`M${b.x - 16} ${b.y} L${b.x - 16} ${b.y - 16} L${b.x} ${b.y - 16}`} fill="none" stroke="#495057" strokeWidth={1.5} />
      </g>
    );
  };
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 480`}>
      <SvgDefs />
      {copy && tri(0.5, 0.55)}
      {tri(1)}
      <path d={arcPath(A, 50, 0, theta, true)} fill="#ffd43b55" stroke="#f08c00" />
      <text x={polar(A, 66, theta / 2).x} y={polar(A, 66, theta / 2).y} className="svg-label" fill="#e67700" textAnchor="middle">θ = {theta}°</text>
      <text x={(A.x + B.x) / 2} y={A.y + 24} textAnchor="middle" className="svg-label" fill="#1c7ed6">adjacent {fmt(adj, 2)}</text>
      <text x={B.x + 10} y={(B.y + Cc.y) / 2} className="svg-label" fill="#e5484d">opposite {fmt(opp, 2)}</text>
      <text x={(A.x + Cc.x) / 2 - 14} y={(A.y + Cc.y) / 2 - 10} textAnchor="end" className="svg-label" fill="#2b8a3e">hypotenuse {fmt(hyp, 2)}</text>
      <Handle x={Cc.x} y={Cc.y} color="#2b8a3e" title="tip of the triangle" onStart={h.checkpoint}
        onDrag={(p) => {
          const th = clamp(Math.round(headingDeg(A, p)), 5, 85);
          const len = clamp(Math.hypot(p.x - A.x, p.y - A.y) / S, 2, 11);
          h.set({ theta: th, hyp: Math.round(len * 10) / 10 });
        }} />
      <g transform="translate(560 40)">
        <text x={0} y={0} className="svg-label" fill="#495057">The three ratios</text>
        {[
          { l: 'opp ÷ hyp', v: opp / hyp, c: '#e5484d', n: 'sin' },
          { l: 'adj ÷ hyp', v: adj / hyp, c: '#1c7ed6', n: 'cos' },
          { l: 'opp ÷ adj', v: Math.min(opp / adj, 3), c: '#7048e8', n: 'tan' },
        ].map((r, i) => (
          <g key={r.n} transform={`translate(0 ${24 + i * 56})`}>
            <rect x={0} y={0} width={200} height={22} rx={4} fill="#f1f3f5" />
            <rect x={0} y={0} width={Math.min(200, r.v * 100)} height={22} rx={4} fill={r.c} />
            <text x={0} y={40} fontSize={13} fill={r.c} fontWeight={700}>{r.n} = {r.l} = {fmt(r.n === 'tan' ? opp / adj : r.v, 3)}</text>
          </g>
        ))}
      </g>
    </svg>
  );
  const controls = (
    <>
      <Slider label="Angle θ" value={theta} min={5} max={85} unit="°" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, theta: x }))} color="#f08c00" />
      <Slider label="Size (hypotenuse)" value={hyp} min={2} max={11} step={0.1} onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, hyp: x }))} color="#2b8a3e" />
      <Toggle label="Show a half-size copy" checked={copy} onChange={setCopy} />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>A <T k="right" />-angled triangle. Seen from the angle θ: the side <b>opposite</b> it (red), the side <b>next to</b> it (blue), and the longest side, the <T k="hypotenuse" /> (green).</p>,
    touch: <p>Drag the green tip, or use the sliders for angle and size.</p>,
    experiment: (
      <ul>
        <li>Keep the angle, change only the size. Watch the three ratio bars.</li>
        <li>Turn on the half-size copy.</li>
        <li>Now change the angle. What happens to the bars?</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz
        question="You make the triangle twice as big but keep θ the same. The ratio opposite ÷ hypotenuse…"
        options={[{ label: 'stays the same', correct: true, why: 'Both sides double, so their ratio does not change. The ratio depends only on the angle!' }, { label: 'doubles', why: 'Both the top and bottom of the fraction double — the bars did not move.' }]}
      />
    ),
    understand: (
      <>
        <p>Every right triangle with the same angle θ has the same shape, so the same side ratios.</p>
        <p>That means a ratio can tell you the angle, and an angle can tell you the ratio. Calculators store these ratios as sin, cos and tan.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={['sin ', { s: 'θ', means: 'the angle', color: '#f08c00' }, ' = ', { s: 'opp', means: 'side opposite the angle', color: '#e5484d' }, ' ÷ ', { s: 'hyp', means: 'hypotenuse (longest side)', color: '#2b8a3e' }]} />
        <Formula parts={['cos θ = ', { s: 'adj', means: 'side next to the angle', color: '#1c7ed6' }, ' ÷ ', { s: 'hyp', means: 'hypotenuse', color: '#2b8a3e' }, '    tan θ = ', { s: 'opp', means: 'opposite', color: '#e5484d' }, ' ÷ ', { s: 'adj', means: 'adjacent', color: '#1c7ed6' }]} caption="Memory aid: SOH · CAH · TOA." />
        <NumberQuiz question="A 4 m ladder leans at 70° to the ground. How high up the wall does it reach? (m)" answer={3.76} tolerance={0.02} unit="m" hint="Height is opposite the 70° angle; the ladder is the hypotenuse → sin."
          diagnose={(x) => (Math.abs(x - 1.37) < 0.02 ? 'That is the distance from the wall (cos). Height uses sin.' : null)}
          solution={<Steps steps={['height = 4 × sin 70°', '= 4 × 0.940', '≈ 3.76 m']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>A laptop stand that tilts 15°: tan 15° tells you how high the back must be.</li>
          <li>The slope of a chair back, a ramp or a drawing table is a right triangle.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['θ', `${theta}°`],
      ['hypotenuse', fmt(hyp, 2)],
      ['opposite = hyp × sin θ', `${fmt(hyp, 2)} × ${fmt(Math.sin(degToRad(theta)), 4)} = ${fmt(opp, 3)}`],
      ['adjacent = hyp × cos θ', `${fmt(hyp, 2)} × ${fmt(Math.cos(degToRad(theta)), 4)} = ${fmt(adj, 3)}`],
      ['opp ÷ hyp (sin)', fmt(opp / hyp, 4)],
      ['adj ÷ hyp (cos)', fmt(adj / hyp, 4)],
      ['opp ÷ adj (tan)', fmt(opp / adj, 4)],
    ]} />
  );
  return <Lesson id="l8-triangle" title="Right-triangle ratios" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Heights, ramps & bolt circles                                       */
/* ================================================================== */

function ApplyLesson() {
  const [mode, setMode] = useState<'height' | 'ramp' | 'bolts'>('bolts');
  const h = useHistory({ d: 30, sight: 35, ramp: 5, n: 6, pcd: 80, start: 0 });
  const { d, sight, ramp, n, pcd, start } = h.value;
  let body: ReactNode;
  let rows: [ReactNode, ReactNode][] = [];
  if (mode === 'height') {
    const k = 8;
    const eye = { x: 90, y: 440 - 1.6 * k };
    const treeX = 90 + d * k;
    const hgt = 1.6 + d * Math.tan(degToRad(sight));
    const tip = { x: treeX, y: 440 - hgt * k };
    body = (
      <g>
        <line x1={20} y1={440} x2={780} y2={440} stroke="#495057" strokeWidth={2} />
        <rect x={treeX - 10} y={Math.max(20, 440 - 42 * k)} width={20} height={440 - Math.max(20, 440 - 42 * k)} fill="#ced4da" />
        <text x={treeX + 14} y={Math.max(32, 440 - 42 * k + 12)} fontSize={12} fill="#868e96">a building</text>
        <circle cx={90} cy={440 - 1.6 * k - 6} r={6} fill="#495057" />
        <line x1={90} y1={440} x2={90} y2={eye.y} stroke="#495057" strokeWidth={4} />
        <line x1={eye.x} y1={eye.y} x2={tip.x} y2={tip.y} stroke="#e8590c" strokeWidth={2.5} strokeDasharray="6 4" />
        <line x1={eye.x} y1={eye.y} x2={treeX} y2={eye.y} stroke="#1c7ed6" strokeWidth={2} />
        <path d={arcPath(eye, 60, 0, sight, true)} fill="#ffd43b55" stroke="#f08c00" />
        <text x={eye.x + 70} y={eye.y - 10} className="svg-label" fill="#e67700">{sight}°</text>
        <DimLine a={{ x: 90, y: 440 }} b={{ x: treeX, y: 440 }} offset={20} label={`${d} m`} />
        <line x1={treeX} y1={eye.y} x2={tip.x} y2={tip.y} stroke="#e5484d" strokeWidth={4} />
        <text x={treeX + 12} y={(eye.y + tip.y) / 2} className="svg-label" fill="#e5484d">{fmt(hgt - 1.6, 1)} m + 1.6 m eye height</text>
        <Handle x={tip.x} y={tip.y} color="#e8590c" title="aim the sight line" onStart={h.checkpoint} onDrag={(p) => h.set((s) => ({ ...s, sight: clamp(Math.round(headingDeg(eye, p)), 1, 80) }))} />
      </g>
    );
    rows = [['distance d', `${d} m`], ['angle to the top', `${sight}°`], ['tan θ', fmt(Math.tan(degToRad(sight)), 4)], ['height above eye = d × tan θ', `${d} × ${fmt(Math.tan(degToRad(sight)), 4)} = ${fmt(hgt - 1.6, 2)} m`], ['total height', `${fmt(hgt - 1.6, 2)} + 1.6 = ${fmt(hgt, 2)} m`]];
  } else if (mode === 'ramp') {
    const run = 600;
    const rise = run * Math.tan(degToRad(ramp));
    body = (
      <g>
        <path d={`M100 420 L${100 + run} 420 L${100 + run} ${420 - rise} Z`} fill="#ffe8cc" stroke="#e8590c" strokeWidth={3} />
        <path d={arcPath({ x: 100, y: 420 }, 80, 0, ramp, true)} fill="#ffd43b55" stroke="#f08c00" />
        <text x={190} y={410} className="svg-label" fill="#e67700">{ramp}°</text>
        <text x={100 + run / 2} y={445} textAnchor="middle" className="svg-label" fill="#1c7ed6">run 100</text>
        <text x={100 + run + 10} y={420 - rise / 2} className="svg-label" fill="#e5484d">rise {fmt(100 * Math.tan(degToRad(ramp)), 1)}</text>
        <text x={100} y={60} className="svg-label big" fill="#1f2a44">gradient = {fmt(100 * Math.tan(degToRad(ramp)), 1)}% ≈ 1 : {fmt(1 / Math.tan(degToRad(ramp)), 1)}</text>
      </g>
    );
    rows = [['angle', `${ramp}°`], ['tan θ = rise ÷ run', fmt(Math.tan(degToRad(ramp)), 4)], ['gradient %', `${fmt(100 * Math.tan(degToRad(ramp)), 2)}%`], ['ratio', `1 : ${fmt(1 / Math.tan(degToRad(ramp)), 2)}`]];
  } else {
    const C = { x: 260, y: 250 };
    const k = 2;
    const holes = Array.from({ length: n }, (_, i) => start + (360 * i) / n);
    body = (
      <g>
        <circle cx={C.x} cy={C.y} r={(pcd / 2 + 22) * k} fill="#e9ecef" stroke="#495057" strokeWidth={2} />
        <circle cx={C.x} cy={C.y} r={(pcd / 2 - 20) * k} fill="#fff" stroke="#495057" strokeWidth={2} />
        <circle cx={C.x} cy={C.y} r={(pcd / 2) * k} fill="none" stroke="#7048e8" strokeDasharray="8 5" />
        <line x1={C.x - 200} y1={C.y} x2={C.x + 200} y2={C.y} stroke="#ced4da" />
        <line x1={C.x} y1={C.y - 200} x2={C.x} y2={C.y + 200} stroke="#ced4da" />
        {holes.map((a, i) => {
          const p = polar(C, (pcd / 2) * k, a);
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={10} fill="#fff" stroke="#1f2a44" strokeWidth={2} />
              <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fontWeight={700}>{i + 1}</text>
            </g>
          );
        })}
        <line x1={C.x} y1={C.y} x2={polar(C, (pcd / 2) * k, holes[0]).x} y2={polar(C, (pcd / 2) * k, holes[0]).y} stroke="#2b8a3e" strokeWidth={2} />
        <g transform="translate(520 40)">
          <text x={0} y={0} className="svg-label" fill="#495057">Hole centres (mm from the middle)</text>
          {holes.map((a, i) => (
            <text key={i} x={0} y={24 + i * 20} fontSize={13} fill="#1f2a44" fontFamily="monospace">
              {i + 1}: ({fmt((pcd / 2) * Math.cos(degToRad(a)), 2).padStart(7)}, {fmt((pcd / 2) * Math.sin(degToRad(a)), 2).padStart(7)})
            </text>
          ))}
        </g>
      </g>
    );
    rows = holes.map((a, i) => [`hole ${i + 1} at ${fmt(a, 1)}°`, `x = ${pcd / 2} × cos ${fmt(a, 1)}° = ${fmt((pcd / 2) * Math.cos(degToRad(a)), 2)}, y = ${fmt((pcd / 2) * Math.sin(degToRad(a)), 2)}`] as [ReactNode, ReactNode]);
  }
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 480`}>
      <SvgDefs />
      {body}
    </svg>
  );
  const controls = (
    <>
      <Segmented value={mode} onChange={setMode} options={[{ value: 'bolts', label: '🔩 Bolt circle' }, { value: 'height', label: '🏢 Height' }, { value: 'ramp', label: '♿ Ramp slope' }]} />
      {mode === 'height' && (
        <>
          <Slider label="Distance to building" value={d} min={10} max={80} unit="m" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, d: x }))} />
          <Slider label="Sight angle" value={sight} min={1} max={80} unit="°" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, sight: x }))} />
        </>
      )}
      {mode === 'ramp' && <Slider label="Ramp angle" value={ramp} min={1} max={45} unit="°" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, ramp: x }))} />}
      {mode === 'bolts' && (
        <>
          <Stepper label="Holes" value={n} min={3} max={12} onChange={(x) => h.commit((s) => ({ ...s, n: x }))} />
          <Slider label="Bolt circle diameter (PCD)" value={pcd} min={40} max={150} unit="mm" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, pcd: x }))} />
          <Slider label="First hole angle" value={start} min={0} max={90} unit="°" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, start: x }))} />
        </>
      )}
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>Three places trigonometry does real work: placing holes on a circle, measuring heights you cannot reach, and setting slopes.</p>,
    touch: <p>Switch between 🔩, 🏢 and ♿. Drag and slide everything.</p>,
    experiment: (
      <ul>
        <li>Bolt circle: 4 holes, then 6, then 5. Read the hole coordinates.</li>
        <li>Height: aim the orange line at the top of the building.</li>
        <li>Ramp: find the angle for a 1 : 12 wheelchair ramp.</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz question="With 6 holes on a circle, how many degrees apart are they?" options={[{ label: '60°', correct: true, why: '360° ÷ 6 = 60°. Each hole is at start + 60° × k.' }, { label: '6°', why: '6 degrees would put them almost on top of each other.' }, { label: '36°', why: 'That would be 10 holes.' }]} />
    ),
    understand: (
      <>
        <p><b>Bolt circle:</b> each hole is at angle start + 360° × k ÷ n. Its position is (r cos θ, r sin θ) with r = PCD ÷ 2.</p>
        <p><b>Height:</b> stand a known distance away, measure the angle to the top: height = distance × tan θ (+ your eye height).</p>
        <p><b>Ramp:</b> gradient % = tan θ × 100.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={['hole ', { s: 'k', means: 'hole number counting from 0', color: '#1f2a44' }, ': θ = start + 360° × k ÷ ', { s: 'n', means: 'number of holes', color: '#1f2a44' }, ';  (x, y) = (r cos θ, r sin θ)']} />
        <NumberQuiz question="4 holes on an 80 mm PCD, first hole at 45°. What is the x coordinate of the first hole? (mm)" answer={28.28} tolerance={0.05} unit="mm" hint="r = 40; x = 40 × cos 45°."
          diagnose={(x) => (Math.abs(x - 56.57) < 0.1 ? 'You used the diameter. The radius is half: 40 mm.' : null)}
          solution={<Steps steps={['r = 80 ÷ 2 = 40', 'cos 45° ≈ 0.7071', '40 × 0.7071 ≈ 28.28 mm']} />} />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Flanges, fan hubs, speaker mounts and wheels are drawn with a PCD and an angle — CAD turns them into coordinates exactly like this.</li>
          <li>Accessibility guidelines commonly use about 1 : 12 for ramps — check your local regulations for real buildings.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = <NumberTable rows={rows} />;
  return <Lesson id="l8-apply" title="Heights, ramps & bolt circles" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ================================================================== */
/* Challenge: measure the tower                                        */
/* ================================================================== */

function towerTask(d: Difficulty) {
  return { H: randInt(18, 45), dist: randInt(25, 60), eye: d === 'hard' ? 1.6 : 0, tol: d === 'easy' ? 0.06 : d === 'normal' ? 0.04 : 0.03 };
}

function TowerChallenge() {
  const { difficulty } = useSettings();
  const [task, setTask] = useState(() => towerTask(difficulty));
  const h = useHistory({ sight: 20 });
  const [answer, setAnswer] = useState('');
  const [ghost, setGhost] = useState<number | null>(null);
  const k = 8;
  const ground = 460;
  const obs = 70;
  const eye = { x: obs, y: ground - task.eye * k };
  const tx = obs + task.dist * k;
  const tip = polar(eye, Math.hypot(tx - obs, 400), h.value.sight);
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 490`}>
      <SvgDefs />
      <line x1={10} y1={ground} x2={790} y2={ground} stroke="#495057" strokeWidth={2} />
      <rect x={tx - 16} y={ground - task.H * k} width={32} height={task.H * k} fill="#868e96" />
      <path d={`M${tx - 22} ${ground - task.H * k} L${tx} ${ground - task.H * k - 20} L${tx + 22} ${ground - task.H * k} Z`} fill="#495057" />
      {ghost !== null && <rect x={tx + 30} y={ground - ghost * k} width={14} height={ghost * k} fill="#e5484d" opacity={0.6} />}
      {ghost !== null && <text x={tx + 50} y={ground - ghost * k + 4} className="svg-label small" fill="#e5484d">your answer {fmt(ghost, 1)} m</text>}
      <circle cx={obs} cy={eye.y - 8} r={7} fill="#1f2a44" />
      <line x1={obs} y1={ground} x2={obs} y2={eye.y} stroke="#1f2a44" strokeWidth={4} />
      <line x1={eye.x} y1={eye.y} x2={tip.x} y2={tip.y} stroke="#e8590c" strokeWidth={2} strokeDasharray="7 4" />
      <path d={arcPath(eye, 70, 0, h.value.sight, true)} fill="#ffd43b55" stroke="#f08c00" />
      <text x={eye.x + 80} y={eye.y - 8} className="svg-label" fill="#e67700">clinometer: {h.value.sight}°</text>
      <DimLine a={{ x: obs, y: ground }} b={{ x: tx, y: ground }} offset={18} label={`${task.dist} m`} />
      <Handle x={polar(eye, 200, h.value.sight).x} y={polar(eye, 200, h.value.sight).y} color="#e8590c" title="aim at the top" onStart={h.checkpoint}
        onDrag={(p) => h.set({ sight: clamp(Math.round(headingDeg(eye, p) * 2) / 2, 1, 80) })} />
    </svg>
  );
  const trueAngle = radToDeg(Math.atan((task.H - task.eye) / task.dist));
  const check = (): CheckResult => {
    const v = Number(answer);
    if (answer.trim() === '' || Number.isNaN(v)) return { ok: false, happened: 'Aim the sight line, then type the height.' };
    if (Math.abs(v - task.H) / task.H <= task.tol) return { ok: true, happened: `Tower ≈ ${task.H} m. You said ${fmt(v, 1)} m.`, why: 'Surveyors measured buildings and mountains exactly like this.' };
    setGhost(v);
    const t = Math.tan(degToRad(h.value.sight));
    const diag =
      task.eye && Math.abs(v - task.dist * t) / task.H < task.tol ? 'You forgot your eye height: the sight line starts 1.6 m above the ground.' :
      Math.abs(v - task.dist * Math.sin(degToRad(h.value.sight))) / task.H < task.tol ? 'You used sin. The distance along the ground is the adjacent side; height is opposite → tan.' :
      Math.abs(v - task.dist / t) / task.H < task.tol ? 'You divided by tan. Height = distance × tan θ.' :
      Math.abs(h.value.sight - trueAngle) > 2 ? 'Your sight line is not aimed at the very top of the tower yet — the red bar shows your answer next to it.' : 'Check the multiplication: distance × tan θ.';
    return { ok: false, happened: <>Your answer (red bar) is {fmt(v, 1)} m — {v > task.H ? 'taller' : 'shorter'} than the tower.</>, why: diag };
  };
  const panel = (
    <Challenge
      id="l8-challenge"
      title="Measure the tower"
      brief={<><p>You stand <span className="target">{task.dist} m</span> from a tower{task.eye ? <> and your eye is <span className="target">1.6 m</span> above the ground</> : null}. Aim the clinometer at the top, then work out the tower's height.</p></>}
      check={check}
      onResult={(r) => { if (!r || r.ok) setGhost(null); }}
      onNewTarget={() => { setTask(towerTask(difficulty)); setAnswer(''); setGhost(null); }}
      hint="height above your eye = distance × tan(angle)."
      solution={<Steps steps={[`angle to the top ≈ ${fmt(trueAngle, 1)}°`, `${task.dist} × tan ${fmt(trueAngle, 1)}° ≈ ${fmt(task.H - task.eye, 1)} m`, ...(task.eye ? [`+ 1.6 m eye height = ${task.H} m`] : [])]} />}
    >
      <div className="quiz-input" style={{ marginTop: 8 }}>
        <span>Height =</span>
        <input inputMode="decimal" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="m" />
        <span className="unit">m</span>
      </div>
      <Stats><Stat label="your angle" value={`${h.value.sight}°`} color="#e67700" /><Stat label="tan of it" value={fmt(Math.tan(degToRad(h.value.sight)), 4)} color="#7048e8" /></Stats>
    </Challenge>
  );
  return <Workbench title="Challenge: measure the tower" tool={tool} controls={<ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />} panel={panel} />;
}

export default {
  'l8-unitcircle': UnitCircleLesson,
  'l8-triangle': TriangleLesson,
  'l8-apply': ApplyLesson,
  'l8-challenge': TowerChallenge,
};
