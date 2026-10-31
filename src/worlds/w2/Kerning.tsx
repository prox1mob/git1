import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx, type Criterion } from '../../components/lesson/LessonShell';
import { Badge, Button, Toggle, cx } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { errorToScore } from '../../lib/color';
import { clampWeight, ensureFont, fontById } from '../../lib/fonts';
import { glyphPositions } from '../../lib/typeMetrics';

const SIZE = 150, W = 1000, H = 240, BASE = 175;
interface Word { text: string; font: string; weight: number; offsets: number[] }
const WORDS: Word[] = [
  { text: 'WAVY', font: 'playfair', weight: 700, offsets: [0, 0.1, -0.02, 0.09] },
  { text: 'Tryout', font: 'fraunces', weight: 600, offsets: [0, 0.08, 0.06, -0.05, 0.03, -0.04] },
  { text: 'LAYOUT', font: 'montserrat', weight: 800, offsets: [0, 0.11, 0.07, -0.04, 0.02, -0.06] },
];

function useReference(w: Word) {
  const [ref, setRef] = useState<number[] | null>(null);
  useEffect(() => {
    let alive = true;
    const f = fontById(w.font);
    ensureFont(f, w.weight, w.text).then(() => { if (alive) setRef(glyphPositions(w.text, f, w.weight, SIZE, true).map((g) => g.x)); });
    return () => { alive = false; };
  }, [w]);
  return ref;
}

/** Draggable headline: each glyph is positioned absolutely (font kerning off) so you set the spacing. */
function Surgery({ word, xs, setXs, refXs, ghost, flip, blur }: { word: Word; xs: number[]; setXs: (x: number[]) => void; refXs: number[] | null; ghost: boolean; flip: boolean; blur: boolean }) {
  const f = fontById(word.font);
  const [sel, setSel] = useState(1);
  const drag = useRef<{ i: number; dx: number } | null>(null);
  const total = refXs ? refXs[refXs.length - 1] + SIZE * 0.7 : 600;
  const ox = (W - total) / 2;
  const toSvg = (e: RPointerEvent<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * W; };
  const key = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const d = e.key === 'ArrowLeft' ? -step : step; setXs(xs.map((x, k) => (k === sel ? x + d : x))); }
    if (e.key === 'Tab') return;
    if (/^[1-9]$/.test(e.key)) setSel(Math.min(xs.length - 1, Math.max(1, Number(e.key) - 1)));
  };
  const style = { fontFamily: f.css, fontWeight: clampWeight(f, word.weight), fontKerning: 'none' as const };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none rounded-xl bg-paper outline-offset-2" tabIndex={0} role="application"
      aria-label={`Kerning editor for ${word.text}. Letter ${sel + 1} selected. Arrow keys move it; number keys select a letter.`}
      onKeyDown={key}
      onPointerDown={(e) => {
        const x = toSvg(e) - ox;
        let best = -1, bd = 1e9;
        xs.forEach((gx, k) => { if (k === 0) return; const d = Math.abs(gx + SIZE * 0.3 - x); if (d < bd) { bd = d; best = k; } });
        if (best > 0) { setSel(best); drag.current = { i: best, dx: x - xs[best] }; e.currentTarget.setPointerCapture(e.pointerId); }
      }}
      onPointerMove={(e) => { if (!drag.current || !e.buttons) return; const x = toSvg(e) - ox; const { i, dx } = drag.current; setXs(xs.map((v, k) => (k === i ? x - dx : v))); }}
      onPointerUp={() => { drag.current = null; }}
      style={{ transform: flip ? 'scaleY(-1)' : undefined, filter: blur ? 'blur(6px)' : undefined }}>
      <line x1={0} x2={W} y1={BASE} y2={BASE} stroke="#d8d2c6" />
      {ghost && refXs && word.text.split('').map((ch, k) => <text key={'g' + k} x={ox + refXs[k]} y={BASE} fontSize={SIZE} fill="#b8432f" opacity={0.28} style={style}>{ch}</text>)}
      {word.text.split('').map((ch, k) => (
        <text key={k} x={ox + xs[k]} y={BASE} fontSize={SIZE} fill={k === sel ? '#111' : '#222'} style={style} className={k === 0 ? undefined : 'cursor-ew-resize'}>{ch}</text>
      ))}
      {!flip && !blur && <rect x={ox + xs[sel] + 6} y={BASE + 18} width={SIZE * 0.4} height={4} rx={2} fill="#b8432f" />}
    </svg>
  );
}

function gapReport(xs: number[], ref: number[]) {
  // compare each letter's offset from its left neighbour with the designer's spacing, in thousandths of an em
  const devs = xs.slice(1).map((x, k) => ((x - xs[k]) - (ref[k + 1] - ref[k])) / SIZE * 1000);
  return { devs, mean: devs.reduce((a, d) => a + Math.abs(d), 0) / Math.max(1, devs.length) };
}

export default function Kerning({ level }: LevelProps) {
  return <LessonShell level={level} observe={<Observe />} experiment={<Practice />}
    discover={
      <Concepts items={[
        { title: 'Kerning', body: 'Adjusting the space between two specific letters. Shapes like A, V, W, Y, T and L leave awkward gaps that look like holes, so they are tucked closer.' },
        { title: 'Optical, not mathematical', body: 'Equal measured distances look unequal because letters have different shapes. The goal is equal-looking area between letters — like pouring the same amount of sand into each gap.' },
        { title: 'Tricks of the trade', body: 'Turn the word upside down or blur it: you stop reading and start seeing shapes, which makes uneven gaps jump out.' },
        { title: 'The font already knows', body: 'Good fonts ship with thousands of kerning pairs. Large headlines and logos still deserve manual attention, because tiny errors become huge at display sizes.' },
      ]} />
    }
    challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

function Observe() {
  const w = WORDS[0];
  const ref = useReference(w);
  return (
    <div className="space-y-5">
      {ref && <div className="space-y-3"><Surgery word={w} xs={ref.map((x, k) => x + w.offsets[k] * SIZE)} setXs={() => {}} refXs={ref} ghost={false} flip={false} blur={false} /><Surgery word={w} xs={ref} setXs={() => {}} refXs={ref} ghost={false} flip={false} blur={false} /></div>}
      <ObserveQuestion question="Two versions of the same headline. What feels wrong in the first?" options={['The W and A are too far apart', 'The A and V collide', 'The V and Y are too far apart', 'Nothing']}
        reveal={() => <p>The diagonal letters leave big triangular gaps. In the top version the W–A and V–Y pairs drift apart, so the word reads as “W AV Y”. The bottom version uses the font designer’s kerning: diagonals tucked together so the gaps <i>look</i> even.</p>} />
    </div>
  );
}

function Practice() {
  const w = WORDS[0];
  const ref = useReference(w);
  const [xs, setXs] = useState<number[] | null>(null);
  const [flip, setFlip] = useState(false), [blur, setBlur] = useState(false), [ghost, setGhost] = useState(true);
  useEffect(() => { if (ref && !xs) setXs(ref.map((x, k) => x + w.offsets[k] * SIZE)); }, [ref, xs, w]);
  if (!ref || !xs) return <p className="text-ink-400">Loading the typeface…</p>;
  const r = gapReport(xs, ref);
  return (
    <div className="space-y-3">
      <Surgery word={w} xs={xs} setXs={setXs} refXs={ref} ghost={ghost} flip={flip} blur={blur} />
      <div className="flex flex-wrap items-center gap-4"><Toggle checked={ghost} onChange={setGhost} label="Show designer’s spacing (ghost)" /><Toggle checked={flip} onChange={setFlip} label="Upside down" /><Toggle checked={blur} onChange={setBlur} label="Blur" /><Badge tone="outline">Average deviation {r.mean.toFixed(0)}‰ em</Badge></div>
    </div>
  );
}

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const [i, setI] = useState(0);
  const refs = [useReference(WORDS[0]), useReference(WORDS[1]), useReference(WORDS[2])];
  const [xs, setXs] = useState<(number[] | null)[]>([null, null, null]);
  const [flip, setFlip] = useState(false), [blur, setBlur] = useState(false);
  useEffect(() => { setXs((cur) => cur.map((c, k) => c ?? (refs[k] ? refs[k]!.map((x, j) => x + WORDS[k].offsets[j] * SIZE) : null))); }, [refs[0], refs[1], refs[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = xs.every(Boolean) && refs.every(Boolean);
  const submit = () => {
    if (!ready) return;
    const tol = ctx.difficulty === 'advanced' ? 8 : ctx.difficulty === 'intermediate' ? 12 : 16;
    const criteria: Criterion[] = WORDS.map((w, k) => { const r = gapReport(xs[k]!, refs[k]!); return { label: w.text, score: errorToScore(r.mean, tol, 90), weight: 1, detail: `Average deviation from the designer’s spacing: ${r.mean.toFixed(0)}‰ em. Pairs: ${r.devs.map((d, j) => `${w.text[j]}${w.text[j + 1]} ${d > 0 ? '+' : ''}${d.toFixed(0)}`).join(', ')}.` }; });
    ctx.submit({ score: weighted(criteria), criteria,
      worked: criteria.filter((c) => c.score >= 90).map((c) => `${c.label}: spacing reads as even.`),
      improve: criteria.filter((c) => c.score < 90).map((c) => `${c.label}: ${c.detail} Positive = too loose, negative = too tight.`),
      why: 'Kerning is where typographic care becomes visible. The reference here is the type designer’s own kerning table — one expert’s optical judgement, not absolute truth — so differences of a few thousandths of an em are a matter of taste.',
      visual: <div className="space-y-2">{WORDS.map((w, k) => <Surgery key={w.text} word={w} xs={xs[k]!} setXs={() => {}} refXs={refs[k]} ghost flip={false} blur={false} />)}</div>,
    });
  };
  return (
    <div>
      <ChallengeBrief title="Three headlines need surgery" aside={<div className="flex gap-2">{WORDS.map((w, k) => <Button key={w.text} size="sm" variant={k === i ? 'primary' : 'secondary'} onClick={() => setI(k)}>{w.text}</Button>)}</div>}>
        Drag letters left and right (the first letter is fixed) until the spacing looks even. Keyboard: Tab to the word, number keys pick a letter, arrows move it. Scored against the typeface designer’s kerning.
      </ChallengeBrief>
      {ready ? (
        <div className="space-y-3">
          <Surgery key={i} word={WORDS[i]} xs={xs[i]!} setXs={(v) => setXs((all) => all.map((x, k) => (k === i ? v : x)))} refXs={refs[i]} ghost={false} flip={flip} blur={blur} />
          <div className="flex flex-wrap items-center gap-4">
            <Toggle checked={flip} onChange={setFlip} label="Upside down" /><Toggle checked={blur} onChange={setBlur} label="Blur" />
            <Button size="sm" variant="ghost" onClick={() => setXs((all) => all.map((x, k) => (k === i ? refs[i]!.map((r, j) => r + WORDS[i].offsets[j] * SIZE) : x)))}>Reset word</Button>
            {ctx.difficulty === 'beginner' && <Badge tone="outline">Deviation now {gapReport(xs[i]!, refs[i]!).mean.toFixed(0)}‰ em</Badge>}
          </div>
          <Hint>Compare the gaps as areas of empty paper, not as distances between edges. Diagonal pairs (W–A, A–V, T–r, A–Y) usually need to come closer than you think.</Hint>
          <div className={cx('flex gap-3')}><Button variant="primary" onClick={submit}>Submit all three</Button></div>
        </div>
      ) : <p className="text-ink-400">Loading typefaces…</p>}
    </div>
  );
}
