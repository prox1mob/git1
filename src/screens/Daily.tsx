import { useEffect, useMemo, useRef, useState } from 'react';
import { ColourPicker } from '../components/color/ColourPicker';
import { WhiteBalancePanel } from '../components/grading/Controls';
import { GradeCanvas, type GradeHandle } from '../components/grading/GradeCanvas';
import { Badge, Button, Eyebrow, Meter, Slider, cx } from '../components/ui';
import { useToast } from '../components/Toaster';
import { defaultParams, solveWbFromSample, type GradeParams } from '../engine/params';
import { REGIONS } from '../engine/scenes';
import { contrastRatio, deltaERgb, describeDeltaE, diagnoseDifference, errorToScore, hexToRgb, oklchToRgbGamut, rgbToHex, rgbToOklch, type RGB, type Vec3 } from '../lib/color';
import { hashString, mulberry32, pick, todayKey } from '../lib/random';
import { meanLch } from '../worlds/shared/measure';
import { useProgress } from '../state/progress';

const TARGETS: [string, string][] = [['Terracotta', '#B5603F'], ['Sage', '#8A9A7B'], ['Ultramarine', '#2E46C8'], ['Ochre', '#C49A45'], ['Dusty Rose', '#C99A9E'], ['Teal', '#1E8C8C'], ['Plum', '#6E4A6B'], ['Champagne', '#E6D3B3'], ['Signal Orange', '#E8622C'], ['Slate', '#5A6B8D']];
const PAIRS: [string, string][] = [['#FFFFFF', '#F4A259'], ['#9C9C9C', '#FFFFFF'], ['#56C2B6', '#FFFFFF'], ['#7766C4', '#22264F'], ['#E58E9B', '#FFFFFF'], ['#6E8BD8', '#1C2238']];
const CASTS = [{ castTemp: 3200 }, { castTemp: 9800 }, { castTemp: 5400, castTint: 42 }, { castTemp: 6200, castTint: -38 }, { castTemp: 4300, castTint: 18 }];

export default function Daily() {
  const day = todayKey();
  const plan = useMemo(() => {
    const rng = mulberry32(hashString('daily-' + day));
    const [name, hex] = pick(rng, TARGETS);
    const pair = pick(rng, PAIRS);
    return { target: { name, rgb: hexToRgb(hex)! }, pair: { fg: hexToRgb(pair[0])!, bg: hexToRgb(pair[1])! }, cast: pick(rng, CASTS) };
  }, [day]);
  const { state, recordDaily } = useProgress();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<(number | null)[]>([null, null, null]);
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const [done, setDone] = useState<{ total: number; xp: number } | null>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const finish = (k: number, s: number) => {
    const next = scores.map((x, i) => (i === k ? s : x));
    setScores(next);
    if (k < 2) { setStep(k + 1); return; }
    const total = Math.round(next.reduce<number>((a, b) => a + (b ?? 0), 0) / 3);
    const out = recordDaily(day, total);
    setDone({ total, xp: out.xpGained });
    toast({ title: `Daily challenge complete · ${total}/100`, body: `+${out.xpGained} XP · streak ${state.daily.lastDate === day ? state.daily.streak : state.daily.streak + 1}`, glyph: '✓' });
  };
  const secs = Math.floor((now - start) / 1000);
  const already = state.daily.history[day] !== undefined;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 pt-10 pb-6">
        <div>
          <Eyebrow>Daily five-minute challenge · {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</Eyebrow>
          <h1 className="mt-2 font-display text-[48px] leading-none text-ink-50">Three quick exercises</h1>
          <p className="mt-2 text-[14px] text-ink-300">Same puzzles for everyone today. No penalties, no lives — a streak that grows with practice.</p>
        </div>
        <div className="text-right">
          <p className="num font-mono text-[22px] text-ink-100">{String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}</p>
          <p className="text-[12px] text-ink-500">Streak {state.daily.streak} day{state.daily.streak === 1 ? '' : 's'}{already ? ' · today done' : ''}</p>
        </div>
      </header>
      <ol className="mb-6 grid grid-cols-3 gap-2">
        {['Mix a colour', 'Rescue the contrast', 'Neutralise the cast'].map((t, i) => (
          <li key={t} className={cx('rounded-xl px-3 py-2.5 text-[13px] ring-1', i === step && !done ? 'bg-ink-100 text-ink-950 ring-ink-100' : scores[i] !== null ? 'text-ink-200 ring-ink-600' : 'text-ink-500 ring-ink-750')}>
            {i + 1}. {t} {scores[i] !== null && <span className="num font-mono">· {scores[i]}</span>}
          </li>
        ))}
      </ol>
      {done ? (
        <div className="vl-rise rounded-2xl bg-ink-850 p-8 ring-1 ring-ink-750">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">Today</p>
          <p className="num font-display text-[88px] leading-none text-ink-50">{done.total}</p>
          <Meter value={done.total} className="mt-3 max-w-sm" />
          <p className="mt-3 text-[14px] text-ink-300">+{done.xp} XP · {secs}s. Come back tomorrow for new puzzles — or replay for practice.</p>
          <div className="mt-5 flex gap-3"><Button variant="primary" onClick={() => { setScores([null, null, null]); setStep(0); setDone(null); }}>Play again</Button></div>
        </div>
      ) : step === 0 ? <MixTask target={plan.target} onDone={(s) => finish(0, s)} /> : step === 1 ? <ContrastTask pair={plan.pair} onDone={(s) => finish(1, s)} /> : <CastTask cast={plan.cast} onDone={(s) => finish(2, s)} />}
    </div>
  );
}

function MixTask({ target, onDone }: { target: { name: string; rgb: RGB }; onDone: (s: number) => void }) {
  const [c, setC] = useState<RGB>([0.5, 0.5, 0.5]);
  const [checked, setChecked] = useState(false);
  const d = diagnoseDifference(target.rgb, c);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="rounded-2xl bg-[#767676] p-6"><div className="flex h-60 overflow-hidden rounded-lg"><div className="flex-1" style={{ background: rgbToHex(target.rgb) }} /><div className="flex-1" style={{ background: rgbToHex(c) }} /></div><p className="mt-2 text-center text-[12px] text-[#111]">{target.name} · your mix</p></div>
      <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
        <ColourPicker value={c} onChange={setC} wheelSize={170} />
        {checked && <p className="text-[13px] text-ink-300">ΔE00 <b className="num font-mono text-ink-50">{d.dE.toFixed(2)}</b> — {describeDeltaE(d.dE)}. {d.notes[0]}</p>}
        <div className="flex gap-2"><Button size="sm" onClick={() => setChecked(true)}>Check</Button><Button size="sm" variant="primary" onClick={() => onDone(errorToScore(d.dE, 2, 25))}>Lock in →</Button></div>
      </div>
    </div>
  );
}

function ContrastTask({ pair, onDone }: { pair: { fg: RGB; bg: RGB }; onDone: (s: number) => void }) {
  const [lch, setLch] = useState<Vec3>(() => rgbToOklch(pair.fg));
  const fg = oklchToRgbGamut(lch);
  const r = contrastRatio(fg, pair.bg);
  const dE = deltaERgb(pair.fg, fg);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="rounded-xl p-8" style={{ background: rgbToHex(pair.bg), color: rgbToHex(fg) }}><p className="text-[16px] leading-relaxed">Body copy at sixteen pixels in the brand colour. Make it readable for everyone while keeping the brand recognisable.</p></div>
      <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
        <p className={cx('num font-display text-[40px]', r >= 4.5 ? 'text-ok' : 'text-ink-50')}>{r.toFixed(2)}:1 <span className="text-[14px] text-ink-400">need 4.5:1</span></p>
        <Slider label="Lightness" value={lch[0]} min={0} max={1} step={0.002} onChange={(v) => setLch([v, lch[1], lch[2]])} format={(v) => `${Math.round(v * 100)}%`} />
        <p className="text-[12px] text-ink-400">Changed by ΔE00 {dE.toFixed(1)} from the brand colour.</p>
        <Button size="sm" variant="primary" onClick={() => onDone(r >= 4.5 ? Math.round(70 + 30 * errorToScore(dE, 8, 30) / 100) : Math.round((r / 4.5) * 50))}>Lock in →</Button>
      </div>
    </div>
  );
}

function CastTask({ cast, onDone }: { cast: { castTemp: number; castTint?: number }; onDone: (s: number) => void }) {
  const [p, setP] = useState<GradeParams>(() => defaultParams());
  const [C, setC] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const h = useRef<GradeHandle>(null);
  return (
    <div className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
      <GradeCanvas ref={h} source={{ kind: 'scene', scene: 'stilllife' }} capture={cast} params={p} aspect={3 / 2} onAnalysis={(f) => setC(meanLch(f, REGIONS.stilllife.card)[1])}
        onPick={picking ? (u, v) => { const s = h.current?.sampleSource(u, v); if (s) setP({ ...p, ...solveWbFromSample(s) }); setPicking(false); } : undefined} label="Still life with a colour cast" />
      <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
        <WhiteBalancePanel p={p} set={(q) => setP({ ...p, ...q })} />
        {C !== null && <p className="text-[13px] text-ink-300">Grey card chroma <b className="num font-mono text-ink-50">C* {C.toFixed(1)}</b> <Badge tone={C < 2 ? 'ok' : 'outline'}>aim &lt; 2</Badge></p>}
        <div className="flex flex-wrap gap-2"><Button size="sm" variant={picking ? 'primary' : 'secondary'} onClick={() => setPicking(!picking)}>{picking ? 'Tap the grey card…' : 'Eyedropper'}</Button><Button size="sm" variant="primary" onClick={() => onDone(errorToScore(C ?? 30, 2, 18))}>Finish →</Button></div>
      </div>
    </div>
  );
}
