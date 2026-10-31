import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  add, angleAt, arcPath, ccwAngle, degToRad, dist, fmt, headingDeg, norm, pick, polar, randInt, scale, snap, sub, type Vec,
} from '../../../core/geometry';
import type { TermKey } from '../../../core/glossary';
import { useHistory } from '../../../core/history';
import { useSettings, type Difficulty } from '../../../core/store';
import { Challenge, ChoiceQuiz, NumberQuiz, type CheckResult } from '../../../ui/feedback';
import {
  DesignLink, Formula, Note, NumberTable, Segmented, Slider, Stat, Stats, Steps, T, Toggle, ToolBar,
} from '../../../ui/kit';
import { Lesson, Workbench, type StageKey } from '../../../ui/lesson';
import { Handle, SvgDefs } from '../../../ui/svg';
import { Protractor, type ProtractorState } from '../tools/Protractor';
import { SketchLayer, type Stroke } from '../tools/SketchLayer';

const W = 800;
const H = 520;

export function angleType(d: number): { key: TermKey; color: string } {
  if (Math.abs(d - 90) < 0.5) return { key: 'right', color: '#2b8a3e' };
  if (d < 90) return { key: 'acute', color: '#1c7ed6' };
  if (Math.abs(d - 180) < 0.5) return { key: 'straight', color: '#495057' };
  if (d < 180) return { key: 'obtuse', color: '#e8590c' };
  return { key: 'reflex', color: '#ae3ec9' };
}

/** Arc (or square corner for right angles) marking an angle from heading h0, sweeping ccw by d. */
function AngleMark({ v, h0, d, r = 46, color, label, arc = true }: { v: Vec; h0: number; d: number; r?: number; color: string; label?: string; arc?: boolean }) {
  const isRight = Math.abs(d - 90) < 0.5;
  const lp = polar(v, r + 22, h0 + d / 2);
  return (
    <g pointerEvents="none">
      {!arc ? null : isRight ? (
        <path
          d={`M${polar(v, 24, h0).x} ${polar(v, 24, h0).y} L${add(polar(v, 24, h0), sub(polar(v, 24, h0 + 90), v)).x} ${add(polar(v, 24, h0), sub(polar(v, 24, h0 + 90), v)).y} L${polar(v, 24, h0 + 90).x} ${polar(v, 24, h0 + 90).y}`}
          fill={`${color}22`}
          stroke={color}
          strokeWidth={2}
        />
      ) : (
        <path d={arcPath(v, r, h0, d, true)} fill={`${color}22`} stroke={color} strokeWidth={2} />
      )}
      {label && (
        <text x={lp.x} y={lp.y} className="svg-label big" fill={color} textAnchor="middle" dominantBaseline="middle">
          {label}
        </text>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Topic 1 — the interactive protractor                                */
/* ------------------------------------------------------------------ */

interface ProtLessonState {
  v: Vec;
  a: Vec;
  b: Vec;
  prot: ProtractorState;
}

const START: ProtLessonState = {
  v: { x: 330, y: 370 },
  a: { x: 600, y: 370 },
  b: polar({ x: 330, y: 370 }, 230, 50),
  prot: { c: { x: 610, y: 470 }, rot: 0 },
};

function makeMeasureTarget(d: Difficulty) {
  const base = d === 'easy' ? 0 : d === 'normal' ? pick([0, 0, 15, 30, 340, 20]) : randInt(0, 359);
  const theta = d === 'easy' ? 5 * randInt(3, 33) : d === 'normal' ? randInt(12, 168) : pick([randInt(12, 168), randInt(195, 340)]);
  return { base, theta };
}

function ProtractorLesson() {
  const { difficulty } = useSettings();
  const h = useHistory<ProtLessonState>(START);
  const { v, a, b, prot } = h.value;
  const [stage, setStage] = useState<StageKey>('see');
  const [mode, setMode] = useState<'explore' | 'measure'>('explore');
  const [snapOn, setSnapOn] = useState(true);
  const [unit, setUnit] = useState<'deg' | 'rad'>('deg');
  const [showProt, setShowProt] = useState(true);
  const [target, setTarget] = useState(() => makeMeasureTarget(difficulty));
  const touched = useRef(false);

  const hA = headingDeg(v, a);
  const theta = ccwAngle(a, v, b);
  const type = angleType(theta);
  const measuring = mode === 'measure';

  // SEE stage: the line gently swings by itself until you touch it.
  useEffect(() => {
    if (stage !== 'see' || measuring) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      if (touched.current) return;
      const d = 90 + 70 * Math.sin((t - t0) / 1400);
      h.set((s) => ({ ...s, b: polar(s.v, dist(s.v, s.b), headingDeg(s.v, s.a) + d) }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, measuring]); // eslint-disable-line react-hooks/exhaustive-deps

  const startMeasure = (d: Difficulty = difficulty) => {
    const t = makeMeasureTarget(d);
    setTarget(t);
    setMode('measure');
    setShowProt(true);
    const c = { x: 360, y: 330 };
    h.commit({ v: c, a: polar(c, 260, t.base), b: polar(c, 240, t.base + t.theta), prot: { c: { x: 620, y: 480 }, rot: 0 } });
  };

  const fmtAngle = (d: number) => (unit === 'deg' ? `${fmt(d, snapOn ? 0 : 1)}°` : `${fmt(degToRad(d), 3)} rad`);
  const align = () => h.commit((s) => ({ ...s, prot: { c: s.v, rot: headingDeg(s.v, s.a) } }));
  const grab = () => {
    touched.current = true;
    h.checkpoint();
  };
  const rayEnd = (p: Vec) => add(v, scale(norm(sub(p, v)), 380));

  const tool = (
    <div style={{ position: 'relative' }}>
      <svg className="tool" viewBox={`0 0 ${W} ${H}`}>
        <SvgDefs />
        <line x1={v.x} y1={v.y} x2={rayEnd(a).x} y2={rayEnd(a).y} stroke="#1f2a44" strokeWidth={4} strokeLinecap="round" />
        <line x1={v.x} y1={v.y} x2={rayEnd(b).x} y2={rayEnd(b).y} stroke="#e8590c" strokeWidth={4} strokeLinecap="round" />
        <AngleMark v={v} h0={hA} d={theta} color={measuring ? '#868e96' : type.color} />
        {showProt && <Protractor s={prot} onStart={grab} onChange={(p) => h.set((s) => ({ ...s, prot: p }))} />}
        <AngleMark v={v} h0={hA} d={theta} arc={false} r={showProt && dist(prot.c, v) < 40 ? 190 : 46} color={measuring ? '#868e96' : type.color} label={measuring ? '?' : fmtAngle(theta)} />
        {!measuring && (
          <>
            <Handle x={a.x} y={a.y} color="#1f2a44" title="rotate the first line" onStart={grab}
              onDrag={(p) => {
                const hd = snapOn ? snap(headingDeg(v, p), 5) : headingDeg(v, p);
                const na = polar(v, Math.max(60, dist(v, p)), hd);
                h.set((s) => ({ ...s, a: na, b: polar(v, dist(v, s.b), hd + ccwAngle(s.a, v, s.b)) }));
              }} />
            <Handle x={b.x} y={b.y} color="#e8590c" r={11} title="rotate the orange line" onStart={grab}
              onDrag={(p) => {
                let d = ccwAngle(a, v, p);
                if (snapOn) d = snap(d, 5) % 360;
                h.set((s) => ({ ...s, b: polar(v, Math.max(60, dist(v, p)), hA + d) }));
              }} />
            <Handle x={v.x} y={v.y} color="#495057" r={7} shape="square" title="move the vertex" onStart={grab}
              onDrag={(p) => h.set((s) => ({ ...s, v: p, a: add(p, sub(s.a, s.v)), b: add(p, sub(s.b, s.v)) }))} />
            <text x={v.x - 14} y={v.y + 26} className="svg-label small" fill="#495057" textAnchor="end">vertex</text>
          </>
        )}
      </svg>
      <div className="overlay-badge" style={{ pointerEvents: 'auto' }}>
        {measuring ? 'Measure the angle with the protractor' : <><T k={type.key} /> · {fmtAngle(theta)}</>}
      </div>
    </div>
  );

  const controls = (
    <>
      <Segmented
        value={mode}
        onChange={(m) => (m === 'measure' ? startMeasure() : (setMode('explore'), h.commit(START)))}
        options={[{ value: 'explore', label: '🧭 Explore' }, { value: 'measure', label: '📐 Measure it yourself' }]}
      />
      <Segmented value={unit} onChange={setUnit} small options={[{ value: 'deg', label: 'degrees °' }, { value: 'rad', label: 'radians' }]} />
      {!measuring && <Toggle label="Snap to 5°" checked={snapOn} onChange={setSnapOn} />}
      <Toggle label="Protractor" checked={showProt} onChange={setShowProt} />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => (setMode('explore'), h.reset(START))}>
        {!measuring && <button className="btn" onClick={align}>📌 Put protractor on the angle</button>}
      </ToolBar>
    </>
  );

  const tol = difficulty === 'easy' ? 2 : 1;
  const measurePanel = measuring && (
    <div className="card">
      <b>Measuring task</b>
      <Steps steps={[
        'Drag the protractor so its red centre circle sits on the corner.',
        'Turn it with the blue ⟳ knob until the straight baseline lies along the dark line.',
        'Find where the orange line crosses the scale. Use the scale that starts at 0 on the dark line.',
        ...(target.theta > 180 ? ['This angle is bigger than a half-turn. Measure the small angle on the other side, then take it away from 360°.'] : []),
      ]} />
      <NumberQuiz
        key={`${target.base}-${target.theta}`}
        question="How many degrees is the angle?"
        answer={target.theta}
        tolerance={tol}
        unit="°"
        hint={target.theta > 180 ? 'Measure the gap on the outside, then: 360 − that.' : 'Count from the 0 that sits on the dark line — not from the other end.'}
        diagnose={(x) =>
          Math.abs(x - (180 - target.theta)) <= tol
            ? 'You read the other scale. Protractors have two rows of numbers — start counting from the 0 that touches the dark line.'
            : Math.abs(x - (360 - target.theta)) <= tol
              ? 'You measured the angle on the other side of the lines. Both sides together make 360°.'
              : Math.abs(Math.abs(x - target.theta) - 10) <= tol
                ? 'You are exactly one 10° block away — recount the big tick marks.'
                : 'Check that the centre circle is exactly on the corner and the baseline lies along the dark line.'}
        solution={<>The angle is <b>{target.theta}°</b>. {target.theta > 180 && <>The small side is {360 - target.theta}°, and 360 − {360 - target.theta} = {target.theta}.</>}</>}
      />
      <button className="btn" onClick={() => startMeasure()}>🎲 Another angle</button>
    </div>
  );

  const stages: Record<StageKey, ReactNode> = {
    see: (
      <>
        <p>Two straight lines meet at one corner, the <b>vertex</b>.</p>
        <p>The coloured arc shows how far the orange line has <b>turned away</b> from the dark one. That amount of turn is an <T k="angle" />.</p>
        <p className="muted">The orange line is moving by itself. Watch the arc change colour.</p>
      </>
    ),
    touch: (
      <>
        <p>Grab the <b style={{ color: '#e8590c' }}>orange dot</b> and turn the line around the corner.</p>
        <p>The dark dot turns the other line. The grey square moves the whole angle.</p>
        <p className="try">Drag the orange line all the way round. What happens after half a turn?</p>
      </>
    ),
    experiment: (
      <ul>
        <li>Make the arc as small as you can.</li>
        <li>Make a corner like the corner of a book — the arc becomes a little <b>square</b>.</li>
        <li>Open it until the lines make one straight line.</li>
        <li>Pull the orange dot further away without turning it. Does the number change?</li>
      </ul>
    ),
    discover: (
      <>
        <ChoiceQuiz
          question="You drag the orange dot further away from the corner, but you don't turn it. What happens to the angle?"
          options={[
            { label: 'It gets bigger — the line is longer', why: 'Longer lines feel "bigger", but the arc stayed the same size. An angle measures turning, not length.' },
            { label: 'It stays exactly the same', correct: true, why: 'An angle only measures how much one line is turned from the other. Length does not matter.' },
            { label: 'It gets smaller', why: 'Try it: drag the orange dot outwards along the line. The number does not move.' },
          ]}
          hint="Watch the number at the arc while you pull the dot outward in a straight line."
        />
        <ChoiceQuiz
          question="Which name did the tool give to the 'book corner' angle?"
          options={[
            { label: 'Acute', why: 'Acute angles are narrower than a book corner.' },
            { label: 'Right angle — 90°', correct: true, why: 'A quarter of a full turn. It is marked with a small square instead of an arc.' },
            { label: 'Obtuse', why: 'Obtuse angles are wider than a book corner.' },
          ]}
        />
      </>
    ),
    understand: (
      <>
        <p>A full turn is cut into <b>360 equal tiny turns</b>. Each one is a <T k="degree" /> (°).</p>
        <Stats>
          <Stat label="¼ turn" value="90°" color="#2b8a3e" />
          <Stat label="½ turn" value="180°" color="#495057" />
          <Stat label="full turn" value="360°" color="#ae3ec9" />
        </Stats>
        <ul>
          <li><T k="acute" />: less than 90°</li>
          <li><T k="right" />: exactly 90°</li>
          <li><T k="obtuse" />: between 90° and 180°</li>
          <li><T k="straight" />: 180°</li>
          <li><T k="reflex" />: more than 180°</li>
        </ul>
      </>
    ),
    calculate: (
      <>
        <p>To read a <T k="protractor" />:</p>
        <Steps steps={['Centre circle on the vertex.', 'Baseline along one line (that line reads 0).', 'Read where the other line crosses — on the scale that starts at 0.']} />
        <Formula
          parts={[{ s: 'θ', means: 'the angle (Greek letter "theta")', color: '#e8590c' }, ' in radians = ', { s: 'θ', means: '', color: '#e8590c' }, ' × ', { s: 'π', means: 'pi ≈ 3.14159', color: '#7048e8' }, ' ÷ 180']}
          caption="Radians are another unit for angles (see the next topic). 180° = π radians."
        />
        <p>Now switch to <b>📐 Measure it yourself</b> below the tool and measure some angles.</p>
        {measurePanel}
        {!measuring && <button className="btn primary" onClick={() => startMeasure()}>Start measuring →</button>}
      </>
    ),
    apply: (
      <>
        <DesignLink>
          <ul>
            <li>A comfortable laptop screen opens about <b>100–120°</b>.</li>
            <li>Chair backrests lean back about <b>100–110°</b> from the seat.</li>
            <li>Perspective lines leave the horizon at different angles — measuring them makes sketches believable.</li>
          </ul>
        </DesignLink>
        <p className="try">Set the angle to 110° — the opening of a laptop screen. Then sketch a laptop on paper with that angle.</p>
        {measurePanel}
      </>
    ),
  };

  const numbers = (
    <>
      <NumberTable rows={[
        ['Angle θ (degrees)', `${fmt(theta, 1)}°`],
        ['Angle θ (radians)', `${fmt(degToRad(theta), 4)} rad`],
        ['Fraction of a full turn', `${fmt(theta, 1)} ÷ 360 = ${fmt(theta / 360, 3)}`],
        ['Type', <T k={type.key} key="t" />],
        ['Missing to 90° (complement)', theta < 90 ? `90 − ${fmt(theta, 1)} = ${fmt(90 - theta, 1)}°` : '—'],
        ['Missing to 180° (supplement)', theta < 180 ? `180 − ${fmt(theta, 1)} = ${fmt(180 - theta, 1)}°` : '—'],
        ['Other side of the lines', `360 − ${fmt(theta, 1)} = ${fmt(360 - theta, 1)}°`],
      ]} />
      {measuring && <Note>The live numbers are hidden from the picture while you measure — but they are here. No peeking until you have tried!</Note>}
    </>
  );

  return <Lesson id="l3-protractor" title="The interactive protractor" tool={tool} controls={controls} stages={stages} numbers={numbers} stage={stage} onStage={setStage} />;
}

/* ------------------------------------------------------------------ */
/* Topic 2 — degrees & radians                                         */
/* ------------------------------------------------------------------ */

function RadiansLesson() {
  const h = useHistory({ r: 120, theta: 120 });
  const { r, theta } = h.value;
  const c = { x: 260, y: 260 };
  const rad = degToRad(theta);
  const arc = r * rad;
  const pieces: ReactNode[] = [];
  const oneRadDeg = 180 / Math.PI;
  for (let k = 0; k * oneRadDeg < theta; k++) {
    const s = k * oneRadDeg;
    const e = Math.min(theta, (k + 1) * oneRadDeg);
    const mid = polar(c, r + 18, (s + e) / 2);
    pieces.push(
      <g key={k} pointerEvents="none">
        <path d={arcPath(c, r, s, e - s)} fill="none" stroke={k % 2 ? '#7048e8' : '#f08c00'} strokeWidth={9} strokeLinecap="butt" />
        {e - s > oneRadDeg - 0.01 && <text x={mid.x} y={mid.y} className="svg-label" fill="#495057" textAnchor="middle" dominantBaseline="middle">{k + 1}</text>}
      </g>,
    );
  }
  const tip = polar(c, r, theta);
  // Straightened arc on the right, measured in radius sticks
  const bx = 520;
  const unitPx = 34;
  const stickCount = Math.floor(rad);
  const tool = (
    <svg className="tool" viewBox={`0 0 ${W} 500`}>
      <circle cx={c.x} cy={c.y} r={r} fill="none" stroke="#dee2e6" strokeWidth={2} />
      <line x1={c.x} y1={c.y} x2={c.x + r} y2={c.y} stroke="#f08c00" strokeWidth={4} />
      <text x={c.x + r / 2} y={c.y + 20} className="svg-label" fill="#f08c00" textAnchor="middle">radius r</text>
      <line x1={c.x} y1={c.y} x2={tip.x} y2={tip.y} stroke="#1f2a44" strokeWidth={3} />
      <path d={arcPath(c, 30, 0, theta, true)} fill="#7048e822" stroke="#7048e8" />
      {pieces}
      <Handle x={tip.x} y={tip.y} color="#7048e8" title="turn the angle" onStart={h.checkpoint}
        onDrag={(p) => h.set((s) => ({ ...s, theta: Math.max(1, Math.round(headingDeg(c, p))) }))} />
      <text x={bx} y={60} className="svg-label" fill="#1f2a44">Arc straightened out, measured in radii:</text>
      {Array.from({ length: Math.ceil(rad) }, (_, k) => {
        const w = Math.min(1, rad - k) * unitPx * 3;
        return (
          <g key={k}>
            <rect x={bx} y={80 + k * 30} width={w} height={20} fill={k % 2 ? '#7048e8' : '#f08c00'} rx={3} />
            <text x={bx + w + 8} y={95 + k * 30} className="svg-label small" fill="#495057">{rad - k >= 1 ? `radius ${k + 1}` : `${fmt(rad - k, 2)} of a radius`}</text>
          </g>
        );
      })}
      <text x={bx} y={110 + Math.ceil(rad) * 30} className="svg-label big" fill="#7048e8">θ = {fmt(rad, 3)} radians</text>
      <text x={bx} y={136 + Math.ceil(rad) * 30} className="svg-label" fill="#495057">= {stickCount} whole radii + {fmt(rad - stickCount, 2)}</text>
    </svg>
  );
  const controls = (
    <>
      <Slider label="Angle θ" value={theta} min={1} max={360} unit="°" onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, theta: x }))} color="#7048e8" />
      <Slider label="Radius (px on screen)" value={r} min={60} max={170} onStart={h.checkpoint} onChange={(x) => h.set((s) => ({ ...s, r: x }))} color="#f08c00" />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()}>
        <button className="btn" onClick={() => h.commit((s) => ({ ...s, theta: 57.2958 }))}>Show exactly 1 radian</button>
        <button className="btn" onClick={() => h.commit((s) => ({ ...s, theta: 180 }))}>Half turn</button>
      </ToolBar>
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>The coloured stripes along the circle are each exactly <b>one radius long</b> — as if you bent the orange radius stick around the edge.</p>,
    touch: <p>Drag the purple dot around the circle. Count how many radius-stripes fit into the arc.</p>,
    experiment: (
      <ul>
        <li>Press <b>Show exactly 1 radian</b>. One stripe exactly.</li>
        <li>Change the radius slider. Does the number of stripes change?</li>
        <li>Press <b>Half turn</b>. How many stripes now?</li>
      </ul>
    ),
    discover: (
      <>
        <ChoiceQuiz
          question="How many radius-lengths fit around half a circle?"
          options={[
            { label: 'Exactly 3', why: 'Look closely: after 3 stripes there is still a small piece left over.' },
            { label: 'A bit more than 3 (about 3.14)', correct: true, why: 'That famous 3.14159… is π (pi). Half a turn = π radians.' },
            { label: '4', why: 'The fourth stripe is not complete — only about 0.14 of it fits.' },
          ]}
        />
        <ChoiceQuiz
          question="If you make the circle twice as big, how many stripes fit in the same angle?"
          options={[
            { label: 'Twice as many', why: 'The arc does get twice as long — but each stripe (one radius) also gets twice as long.' },
            { label: 'The same number', correct: true, why: 'Arc and radius grow together, so the count — the angle in radians — stays the same.' },
          ]}
        />
      </>
    ),
    understand: (
      <>
        <p>A <T k="radian" /> is the angle where the arc is exactly as long as the <T k="radius" />.</p>
        <p>Degrees cut a turn into 360 pieces because of history. Radians come straight from the circle itself — that is why engineers and computers like them.</p>
        <p>Half a turn = π radians ≈ 3.14. Full turn = 2π ≈ 6.28.</p>
      </>
    ),
    calculate: (
      <>
        <Formula parts={[{ s: 'θ', means: 'the angle in radians', color: '#7048e8' }, ' = ', { s: 's', means: 'the arc length (curved distance along the edge)', color: '#f08c00' }, ' ÷ ', { s: 'r', means: 'the radius', color: '#f08c00' }]} />
        <Formula parts={[{ s: 's', means: 'arc length', color: '#f08c00' }, ' = ', { s: 'r', means: 'radius', color: '#f08c00' }, ' × ', { s: 'θ', means: 'angle in radians', color: '#7048e8' }]} />
        <NumberQuiz
          question="A wheel has radius 30 mm. It turns 2 radians. How far does a point on its rim travel (arc length)?"
          answer={60}
          tolerance={0.5}
          unit="mm"
          hint="Arc = radius × angle in radians."
          diagnose={(x) => (Math.abs(x - 15) < 1 ? 'You divided. Here we know the angle and want the arc, so multiply.' : null)}
          solution={<Steps steps={['s = r × θ', 's = 30 × 2', 's = 60 mm']} />}
        />
      </>
    ),
    apply: (
      <DesignLink>
        <p>Rotating parts — knobs, wheels, gears, hinges — use arc length all the time:</p>
        <ul>
          <li>How far does a belt move when a pulley turns? <b>s = r × θ</b>.</li>
          <li>CAD and animation software often expects angles in radians.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['Angle in degrees', `${fmt(theta, 1)}°`],
      ['Angle in radians', `${fmt(theta, 1)} × π ÷ 180 = ${fmt(rad, 4)}`],
      ['Radius r', `${r} px`],
      ['Arc length s = r × θ', `${r} × ${fmt(rad, 4)} = ${fmt(arc, 1)} px`],
      ['Check: s ÷ r', `${fmt(arc, 1)} ÷ ${r} = ${fmt(arc / r, 4)}`],
    ]} />
  );
  return <Lesson id="l3-radians" title="Degrees & radians" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ------------------------------------------------------------------ */
/* Topic 3 — angles in real products                                   */
/* ------------------------------------------------------------------ */

type Scene = 'door' | 'laptop' | 'camera' | 'chair';
const SCENES: Record<Scene, { label: string; min: number; max: number; start: number; good?: [number, number]; goodLabel?: string }> = {
  door: { label: '🚪 Door hinge', min: 0, max: 180, start: 60 },
  laptop: { label: '💻 Laptop screen', min: 0, max: 180, start: 110, good: [100, 130], goodLabel: 'comfortable viewing' },
  camera: { label: '📷 Camera tilt', min: -45, max: 45, start: -10 },
  chair: { label: '🪑 Chair backrest', min: 85, max: 140, start: 105, good: [100, 110], goodLabel: 'typical office chair' },
};

function SceneView({ scene, angle, onAngle, onStart }: { scene: Scene; angle: number; onAngle: (a: number) => void; onStart: () => void }) {
  const cfg = SCENES[scene];
  const clampA = (x: number) => Math.round(Math.min(cfg.max, Math.max(cfg.min, x)));
  if (scene === 'door') {
    const hinge = { x: 260, y: 380 };
    const leaf = 220;
    const end = polar(hinge, leaf, angle);
    return (
      <g>
        <rect x={60} y={380} width={200} height={16} fill="#adb5bd" />
        <rect x={480} y={380} width={260} height={16} fill="#adb5bd" />
        <text x={400} y={430} className="svg-label" fill="#495057" textAnchor="middle">wall (seen from above) — door is 800 mm wide</text>
        <path d={arcPath(hinge, leaf, 0, angle, true)} fill="#1c7ed611" stroke="#1c7ed6" strokeDasharray="6 5" />
        <path d={arcPath(hinge, leaf, 0, 180)} fill="none" stroke="#dee2e6" strokeDasharray="3 6" />
        <line x1={hinge.x} y1={hinge.y} x2={end.x} y2={end.y} stroke="#8d5524" strokeWidth={12} strokeLinecap="round" />
        <circle cx={hinge.x} cy={hinge.y} r={8} fill="#495057" />
        <AngleMark v={hinge} h0={0} d={angle} r={60} color={angleType(angle).color} label={`${angle}°`} />
        <Handle x={end.x} y={end.y} onStart={onStart} onDrag={(p) => onAngle(clampA(headingDeg(hinge, p) > 270 ? 0 : headingDeg(hinge, p)))} title="swing the door" />
      </g>
    );
  }
  if (scene === 'laptop') {
    const hinge = { x: 360, y: 380 };
    const top = polar(hinge, 210, angle);
    return (
      <g>
        <line x1={80} y1={392} x2={720} y2={392} stroke="#ced4da" strokeWidth={3} />
        <rect x={hinge.x} y={hinge.y - 6} width={250} height={14} rx={4} fill="#495057" />
        {cfg.good && <path d={arcPath(hinge, 150, cfg.good[0], cfg.good[1] - cfg.good[0], true)} fill="#2b8a3e18" stroke="#2b8a3e55" />}
        <line x1={hinge.x} y1={hinge.y} x2={top.x} y2={top.y} stroke="#343a40" strokeWidth={12} strokeLinecap="round" />
        <line x1={polar(hinge, 20, angle).x} y1={polar(hinge, 20, angle).y} x2={polar(hinge, 200, angle).x} y2={polar(hinge, 200, angle).y} stroke="#74c0fc" strokeWidth={5} />
        <AngleMark v={hinge} h0={0} d={angle} r={56} color={angleType(angle).color} label={`${angle}°`} />
        <Handle x={top.x} y={top.y} onStart={onStart} onDrag={(p) => onAngle(clampA(headingDeg(hinge, p) > 270 ? 0 : headingDeg(hinge, p)))} title="open the screen" />
      </g>
    );
  }
  if (scene === 'camera') {
    const head = { x: 300, y: 250 };
    const lens = polar(head, 80, angle);
    const corners = [
      polar(head, 50, angle + 150), polar(head, 50, angle - 150), polar(polar(head, 40, angle), 28, angle - 90), polar(polar(head, 40, angle), 28, angle + 90),
    ];
    return (
      <g>
        <line x1={60} y1={440} x2={740} y2={440} stroke="#ced4da" strokeWidth={3} />
        <line x1={head.x} y1={head.y} x2={head.x - 70} y2={440} stroke="#495057" strokeWidth={5} />
        <line x1={head.x} y1={head.y} x2={head.x + 70} y2={440} stroke="#495057" strokeWidth={5} />
        <line x1={head.x} y1={head.y} x2={head.x} y2={440} stroke="#495057" strokeWidth={5} />
        <line x1={head.x} y1={head.y} x2={760} y2={head.y} stroke="#adb5bd" strokeDasharray="5 5" />
        <path d={`M${lens.x} ${lens.y} L${polar(lens, 520, angle + 22).x} ${polar(lens, 520, angle + 22).y} L${polar(lens, 520, angle - 22).x} ${polar(lens, 520, angle - 22).y} Z`} fill="#ffd43b33" stroke="#fab005" strokeDasharray="4 4" />
        <path d={`M${corners[0].x} ${corners[0].y} L${corners[3].x} ${corners[3].y} L${corners[2].x} ${corners[2].y} L${corners[1].x} ${corners[1].y} Z`} fill="#343a40" />
        <circle cx={lens.x} cy={lens.y} r={14} fill="#495057" stroke="#212529" strokeWidth={3} />
        <AngleMark v={head} h0={angle < 0 ? angle : 0} d={Math.abs(angle)} r={110} color={angle < 0 ? '#e8590c' : '#1c7ed6'} label={`${angle}°`} />
        <text x={620} y={head.y - 10} className="svg-label small" fill="#868e96">level (0°)</text>
        <Handle x={lens.x} y={lens.y} onStart={onStart} onDrag={(p) => {
          let a = headingDeg(head, p);
          if (a > 180) a -= 360;
          onAngle(clampA(a));
        }} title="tilt the camera" />
      </g>
    );
  }
  const joint = { x: 380, y: 330 };
  const back = polar(joint, 200, angle);
  return (
    <g>
      <line x1={80} y1={470} x2={720} y2={470} stroke="#ced4da" strokeWidth={3} />
      <line x1={joint.x + 20} y1={joint.y} x2={joint.x + 20} y2={470} stroke="#495057" strokeWidth={8} />
      <line x1={joint.x + 190} y1={joint.y} x2={joint.x + 190} y2={470} stroke="#495057" strokeWidth={8} />
      <line x1={joint.x} y1={joint.y} x2={joint.x + 210} y2={joint.y} stroke="#8d5524" strokeWidth={16} strokeLinecap="round" />
      {cfg.good && <path d={arcPath(joint, 150, cfg.good[0], cfg.good[1] - cfg.good[0], true)} fill="#2b8a3e18" stroke="#2b8a3e55" />}
      <line x1={joint.x} y1={joint.y} x2={back.x} y2={back.y} stroke="#8d5524" strokeWidth={16} strokeLinecap="round" />
      <AngleMark v={joint} h0={0} d={angle} r={60} color={angleType(angle).color} label={`${angle}°`} />
      <Handle x={back.x} y={back.y} onStart={onStart} onDrag={(p) => onAngle(clampA(headingDeg(joint, p)))} title="lean the backrest" />
    </g>
  );
}

function WorldAnglesLesson() {
  const [scene, setScene] = useState<Scene>('door');
  const h = useHistory<Record<Scene, number>>({ door: 60, laptop: 110, camera: -10, chair: 105 });
  const angle = h.value[scene];
  const cfg = SCENES[scene];
  const set = (a: number) => h.set((s) => ({ ...s, [scene]: a }));
  const swept = (angle / 360) * Math.PI * 0.8 * 0.8;
  const tool = (
    <div style={{ position: 'relative' }}>
      <svg className="tool" viewBox={`0 0 ${W} 500`}>
        <SceneView scene={scene} angle={angle} onAngle={set} onStart={h.checkpoint} />
      </svg>
      <div className="overlay-badge">
        {cfg.label}: <b>{angle}°</b>
        {cfg.good && (angle >= cfg.good[0] && angle <= cfg.good[1] ? ` ✔ ${cfg.goodLabel}` : ` (green zone = ${cfg.goodLabel})`)}
      </div>
    </div>
  );
  const controls = (
    <>
      <Segmented value={scene} onChange={setScene} options={(Object.keys(SCENES) as Scene[]).map((k) => ({ value: k, label: SCENES[k].label }))} />
      <Slider label="Angle" value={angle} min={cfg.min} max={cfg.max} unit="°" onStart={h.checkpoint} onChange={set} />
      <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />
    </>
  );
  const stages: Record<StageKey, ReactNode> = {
    see: <p>Many product parts <b>turn around a pivot</b>: doors on hinges, laptop screens, camera heads, chair backs. The amount they turn is an angle.</p>,
    touch: <p>Pick a product above the slider. Drag the orange dot to move the part.</p>,
    experiment: (
      <ul>
        <li>Open the door to a quarter turn. What does it look like next to the wall?</li>
        <li>Find a laptop angle in the green zone.</li>
        <li>Tilt the camera down: the angle becomes negative.</li>
      </ul>
    ),
    discover: (
      <ChoiceQuiz
        question="A door opened to exactly 90° is … to the wall."
        options={[
          { label: 'parallel', why: 'Parallel lines never meet. The door touches the wall at the hinge — at 0° it lies along the wall.' },
          { label: 'perpendicular', correct: true, why: 'Meeting at a right angle (90°) is called perpendicular.' },
          { label: 'acute', why: 'Acute describes angles less than 90°.' },
        ]}
      />
    ),
    understand: (
      <>
        <p>Every moving part has a <b>pivot</b> (hinge or joint) and an <b>angle range</b>, limited by a stop.</p>
        <p>Designers write the range on drawings, e.g. “screen opens 0–135°”.</p>
        <p>A negative angle simply means turning the other way (downwards for the camera).</p>
      </>
    ),
    calculate: (
      <>
        <p>The floor area a door sweeps is a slice of a circle:</p>
        <Formula parts={[{ s: 'A', means: 'swept floor area', color: '#1c7ed6' }, ' = (', { s: 'θ', means: 'opening angle in degrees', color: '#e8590c' }, ' ÷ 360) × π × ', { s: 'r', means: 'door width (the radius of the swing)', color: '#8d5524' }, '²']} caption="r² means r × r." />
        <NumberQuiz
          question="An 0.8 m door opens to 90°. What floor area does it sweep? (m², 2 decimals)"
          answer={0.5}
          tolerance={0.01}
          unit="m²"
          hint="90 ÷ 360 is a quarter. Then π × 0.8 × 0.8."
          diagnose={(x) => (Math.abs(x - 2.01) < 0.05 ? 'That is the whole circle. The door only sweeps a quarter of it.' : Math.abs(x - 0.63) < 0.02 ? 'You found the swing length (arc), not the area.' : null)}
          solution={<Steps steps={['90 ÷ 360 = 0.25', '0.8 × 0.8 = 0.64', '0.25 × 3.1416 × 0.64 ≈ 0.50 m²']} />}
        />
      </>
    ),
    apply: (
      <DesignLink>
        <ul>
          <li>Product sketches often show a <b>motion arc</b> (dashed arc with an arrow) to explain how a part moves.</li>
          <li>Check clearance: will an open door hit a cupboard? Draw the swing arc on the floor plan.</li>
          <li>Sketch a laptop at 110°, a chair at 105° — they will look natural.</li>
        </ul>
      </DesignLink>
    ),
  };
  const numbers = (
    <NumberTable rows={[
      ['Product', cfg.label],
      ['Angle', `${angle}°`],
      ['Type', <T k={angleType(Math.abs(angle)).key} key="t" />],
      ...(scene === 'door' ? ([
        ['Door swept area', `(${angle} ÷ 360) × π × 0.8² = ${fmt(swept, 3)} m²`],
        ['Handle path (arc)', `0.8 × ${fmt(degToRad(angle), 3)} rad = ${fmt(0.8 * degToRad(angle), 3)} m`],
      ] as [ReactNode, ReactNode][]) : []),
      ...(cfg.good ? ([['Recommended', `${cfg.good[0]}–${cfg.good[1]}° (${cfg.goodLabel})`]] as [ReactNode, ReactNode][]) : []),
    ]} />
  );
  return <Lesson id="l3-world" title="Angles in real products" tool={tool} controls={controls} stages={stages} numbers={numbers} />;
}

/* ------------------------------------------------------------------ */
/* Topic 4 — challenge: mechanical arm                                 */
/* ------------------------------------------------------------------ */

const L1 = 180;
const L2 = 150;
const SHOULDER = { x: 250, y: 420 };

function armTarget(d: Difficulty) {
  if (d === 'easy') return { a: 15 * randInt(2, 8), b: 15 * randInt(4, 10) };
  if (d === 'normal') return { a: 5 * randInt(5, 30), b: 5 * randInt(10, 32) };
  return { a: randInt(25, 155), b: randInt(45, 170) };
}

function armPoints(a: number, rel: number) {
  const e = polar(SHOULDER, L1, a);
  const w = polar(e, L2, a + rel);
  return { e, w };
}

function ArmChallenge() {
  const { difficulty } = useSettings();
  const h = useHistory({ a: 40, rel: -30 });
  const { a, rel } = h.value;
  const [target, setTarget] = useState(() => armTarget(difficulty));
  const [result, setResult] = useState<CheckResult | null>(null);
  const [prot, setProt] = useState<ProtractorState>({ c: { x: 600, y: 470 }, rot: 0 });
  const [showProt, setShowProt] = useState(difficulty === 'hard');
  const [sketching, setSketching] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [ghost, setGhost] = useState(false);
  const { e, w } = armPoints(a, rel);
  const elbow = angleAt(SHOULDER, e, w);
  const hideNumbers = difficulty === 'hard';
  const tol = difficulty === 'easy' ? 3 : difficulty === 'normal' ? 2 : 1.5;
  const aErr = a - target.a;
  const bErr = elbow - target.b;
  const bad = result && !result.ok;

  const ghostPts = useMemo(() => armPoints(target.a, -(180 - target.b)), [target]);
  const fa = headingDeg(e, w);

  const tool = (
    <div style={{ position: 'relative' }}>
      <svg className="tool" viewBox={`0 0 ${W} ${H}`}>
        <SvgDefs />
        <line x1={40} y1={SHOULDER.y + 40} x2={760} y2={SHOULDER.y + 40} stroke="#adb5bd" strokeWidth={3} />
        <line x1={SHOULDER.x} y1={SHOULDER.y} x2={SHOULDER.x + 260} y2={SHOULDER.y} stroke="#ced4da" strokeDasharray="6 6" />
        <rect x={SHOULDER.x - 50} y={SHOULDER.y + 6} width={100} height={34} rx={6} fill="#495057" />
        {ghost && (
          <g opacity={0.45} pointerEvents="none">
            <line x1={SHOULDER.x} y1={SHOULDER.y} x2={ghostPts.e.x} y2={ghostPts.e.y} stroke="#2b8a3e" strokeWidth={18} strokeLinecap="round" strokeDasharray="2 10" />
            <line x1={ghostPts.e.x} y1={ghostPts.e.y} x2={ghostPts.w.x} y2={ghostPts.w.y} stroke="#2b8a3e" strokeWidth={14} strokeLinecap="round" strokeDasharray="2 10" />
          </g>
        )}
        <line x1={SHOULDER.x} y1={SHOULDER.y} x2={e.x} y2={e.y} stroke="#fab005" strokeWidth={26} strokeLinecap="round" />
        <line x1={e.x} y1={e.y} x2={w.x} y2={w.y} stroke="#f59f00" strokeWidth={20} strokeLinecap="round" />
        <g transform={`translate(${w.x} ${w.y}) rotate(${-fa})`}>
          <path d="M0 -14 L26 -14 L26 -6 L8 -6 L8 6 L26 6 L26 14 L0 14 Z" fill="#495057" />
        </g>
        <circle cx={SHOULDER.x} cy={SHOULDER.y} r={14} fill="#343a40" />
        <circle cx={e.x} cy={e.y} r={12} fill="#343a40" />
        {!hideNumbers && (
          <>
            <AngleMark v={SHOULDER} h0={0} d={a} r={60} color={bad && Math.abs(aErr) > tol ? '#e5484d' : '#1c7ed6'} label={`${fmt(a, 0)}°`} />
            <AngleMark v={e} h0={ccwAngle(SHOULDER, e, w) <= 180 ? headingDeg(e, SHOULDER) : headingDeg(e, w)} d={elbow} r={44} color={bad && Math.abs(bErr) > tol ? '#e5484d' : '#7048e8'} label={`${fmt(elbow, 0)}°`} />
          </>
        )}
        <SketchLayer active={sketching} strokes={strokes} onStrokes={setStrokes} width={W} height={H} color="#1f2a44" size={3} />
        {!sketching && (
          <>
            <Handle x={e.x} y={e.y} r={10} color="#1c7ed6" title="shoulder: raise or lower the upper arm" onStart={h.checkpoint} highlight={!!bad && Math.abs(aErr) > tol}
              onDrag={(p) => h.set((s) => ({ ...s, a: Math.round(Math.min(180, Math.max(0, headingDeg(SHOULDER, p) > 270 ? 0 : headingDeg(SHOULDER, p))) * 2) / 2 }))} />
            <Handle x={w.x} y={w.y} r={10} color="#7048e8" title="elbow: bend the forearm" onStart={h.checkpoint} highlight={!!bad && Math.abs(bErr) > tol}
              onDrag={(p) => {
                let r = headingDeg(e, p) - a;
                r = ((r + 540) % 360) - 180;
                h.set((s) => ({ ...s, rel: Math.round(r * 2) / 2 }));
              }} />
            {showProt && <Protractor s={prot} onChange={setProt} R={120} />}
          </>
        )}
      </svg>
      {!hideNumbers && (
        <div className="overlay-badge">Shoulder <b>{fmt(a, 0)}°</b> · Elbow <b>{fmt(elbow, 0)}°</b></div>
      )}
      {hideNumbers && <div className="overlay-badge">Hard mode: numbers hidden — use the protractor 📐</div>}
    </div>
  );

  const check = (): CheckResult => {
    const okA = Math.abs(aErr) <= tol;
    const okB = Math.abs(bErr) <= tol;
    if (okA && okB) return { ok: true, happened: `Shoulder ${fmt(a, 0)}°, elbow ${fmt(elbow, 0)}° — within ±${tol}°.`, why: 'Robot arms are programmed exactly like this: one angle per joint.' };
    const parts: ReactNode[] = [];
    if (!okA) parts.push(<div key="a">Shoulder is <b>{fmt(a, 0)}°</b> but should be <b>{target.a}°</b> → {aErr < 0 ? 'raise' : 'lower'} the upper arm by about {fmt(Math.abs(aErr), 0)}°.</div>);
    if (!okB) parts.push(<div key="b">Elbow opening is <b>{fmt(elbow, 0)}°</b> but should be <b>{target.b}°</b> → {bErr < 0 ? 'straighten (open)' : 'bend (close)'} the elbow by about {fmt(Math.abs(bErr), 0)}°.</div>);
    return {
      ok: false,
      happened: <>{parts}<div className="muted small">The joint that is off is circled in red.</div></>,
      why: okA && !okB ? 'The elbow angle is measured between the two arm pieces — not from the ground.' : 'The shoulder angle is measured from the flat ground line (dashed) up to the upper arm.',
    };
  };

  const panel = (
    <Challenge
      id="l3-arm"
      title="Position the mechanical arm"
      brief={
        <>
          <p>A pick-and-place robot needs its arm at:</p>
          <p>Shoulder (upper arm above the ground): <span className="target">{target.a}°</span></p>
          <p>Elbow (opening between the two arm pieces): <span className="target">{target.b}°</span></p>
          <p className="muted small">Drag the blue dot (shoulder) and purple dot (elbow). Tolerance ±{tol}°.</p>
        </>
      }
      check={check}
      onResult={setResult}
      onNewTarget={() => {
        setTarget(armTarget(difficulty));
        setGhost(false);
      }}
      hint="Do one joint at a time: first the shoulder (blue), then the elbow (purple). Moving the shoulder keeps the elbow bend the same."
      solution={
        <>
          <Steps steps={[`Drag the blue dot until the shoulder reads ${target.a}°.`, `Drag the purple dot until the elbow opening reads ${target.b}°.`]} />
          <button className="btn small" onClick={() => setGhost(true)}>Show the target arm (green)</button>
        </>
      }
    >
      <div className="toolbar" style={{ marginTop: 8 }}>
        <Toggle label="📐 Protractor" checked={showProt} onChange={setShowProt} />
        <Toggle label="✏️ Sketch over the arm" checked={sketching} onChange={setSketching} />
        {strokes.length > 0 && <button className="btn small" onClick={() => setStrokes(strokes.slice(0, -1))}>↶ stroke</button>}
        {strokes.length > 0 && <button className="btn small" onClick={() => setStrokes([])}>Clear sketch</button>}
      </div>
      {sketching && <Note kind="design">Sketch the arm's body, motor housings and gripper around the skeleton. Pen pressure works with a stylus.</Note>}
    </Challenge>
  );
  const controls = <ToolBar onUndo={h.undo} canUndo={h.canUndo} onReset={() => h.reset()} />;
  return <Workbench title="Challenge: position the mechanical arm" tool={tool} controls={controls} panel={panel} />;
}

export default {
  'l3-protractor': ProtractorLesson,
  'l3-radians': RadiansLesson,
  'l3-world': WorldAnglesLesson,
  'l3-arm': ArmChallenge,
};
