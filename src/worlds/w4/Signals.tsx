import { useMemo, useState } from 'react';
import { GradeCanvas } from '../../components/grading/GradeCanvas';
import { Concepts, LessonShell, ObserveQuestion, weighted, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Badge, Button, Eyebrow, Note, Segmented, cx } from '../../components/ui';
import { defaultParams, type SignalSpec } from '../../engine/params';
import type { LevelProps } from '../../game/registry';
import { LOG_CURVES } from '../../lib/color';
import { mulberry32, shuffle } from '../../lib/random';
import { TransferPlot } from '../w3/GammaLab';

const portrait = { kind: 'scene' as const, scene: 'portrait' as const, variant: 2, params: [0, 1, 1, 0] as [number, number, number, number] };

// Spectral locus (CIE 1931 2°), coarse sampling for a teaching diagram.
const LOCUS: [number, number][] = [[0.1741, 0.005], [0.1714, 0.0051], [0.1644, 0.0109], [0.144, 0.0297], [0.1241, 0.0578], [0.0913, 0.1327], [0.0687, 0.2007], [0.0454, 0.295], [0.0235, 0.4127], [0.0082, 0.5384], [0.0039, 0.6548], [0.0139, 0.7502], [0.0389, 0.812], [0.0743, 0.8338], [0.1142, 0.8262], [0.1547, 0.8059], [0.1929, 0.7816], [0.2296, 0.7543], [0.2658, 0.7243], [0.3016, 0.6923], [0.3373, 0.6589], [0.3731, 0.6245], [0.4087, 0.5896], [0.4441, 0.5547], [0.4788, 0.5202], [0.5125, 0.4866], [0.5448, 0.4544], [0.5752, 0.4242], [0.6029, 0.3965], [0.627, 0.3725], [0.6482, 0.3514], [0.6658, 0.334], [0.6915, 0.3083], [0.714, 0.2859], [0.7347, 0.2653]];
const GAMUTS = [
  { id: 'rec709', label: 'sRGB / Rec.709', color: '#f2f2f2', pts: [[0.64, 0.33], [0.3, 0.6], [0.15, 0.06]] },
  { id: 'p3', label: 'Display P3 / DCI-P3', color: '#ff8a5c', pts: [[0.68, 0.32], [0.265, 0.69], [0.15, 0.06]] },
  { id: 'rec2020', label: 'Rec.2020', color: '#6ea8ff', pts: [[0.708, 0.292], [0.17, 0.797], [0.131, 0.046]] },
];

function Chromaticity() {
  const [show, setShow] = useState<Record<string, boolean>>({ rec709: true, p3: true, rec2020: true });
  const S = 300, pad = 24;
  const X = (x: number) => pad + (x / 0.8) * (S - pad * 2);
  const Y = (y: number) => S - pad - (y / 0.9) * (S - pad * 2);
  return (
    <div>
      <svg viewBox={`0 0 ${S} ${S}`} className="w-full max-w-[360px] rounded-xl bg-[#0e0e0e] ring-1 ring-ink-700" role="img" aria-label="CIE 1931 chromaticity diagram with Rec.709, P3 and Rec.2020 gamuts">
        <defs>
          <linearGradient id="loc" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#3b3bff" /><stop offset="0.4" stopColor="#2fd0a0" /><stop offset="0.6" stopColor="#c9e04a" /><stop offset="1" stopColor="#ff4040" /></linearGradient>
        </defs>
        <path d={'M' + LOCUS.map(([x, y]) => `${X(x)},${Y(y)}`).join(' L') + ' Z'} fill="url(#loc)" fillOpacity={0.18} stroke="#888" strokeWidth={1} />
        {GAMUTS.filter((g) => show[g.id]).map((g) => <path key={g.id} d={'M' + g.pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' L') + ' Z'} fill="none" stroke={g.color} strokeWidth={1.5} />)}
        <circle cx={X(0.3127)} cy={Y(0.329)} r={3} fill="#fff" />
        <text x={X(0.3127) + 6} y={Y(0.329) + 3} fill="#aaa" fontSize="9" fontFamily="JetBrains Mono Variable, monospace">D65</text>
        <text x={pad} y={S - 6} fill="#666" fontSize="9" fontFamily="JetBrains Mono Variable, monospace">x →</text>
        <text x={4} y={pad} fill="#666" fontSize="9" fontFamily="JetBrains Mono Variable, monospace">y</text>
      </svg>
      <div className="mt-2 flex flex-wrap gap-2">
        {GAMUTS.map((g) => (
          <button key={g.id} onClick={() => setShow((s) => ({ ...s, [g.id]: !s[g.id] }))} className={cx('flex h-8 items-center gap-2 rounded-full px-3 text-[12px] ring-1', show[g.id] ? 'text-ink-100 ring-ink-500' : 'text-ink-500 ring-ink-700')}>
            <span className="h-0.5 w-4" style={{ background: g.color }} />{g.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-400">The horseshoe is every colour a human can see. Each triangle is what a colour space can encode with its three primaries. Your browser most likely shows the white triangle.</p>
    </div>
  );
}

/** Code values per stop: how 10-bit encodings share out their 1024 values. */
function BitBudget() {
  const stops = Array.from({ length: 13 }, (_, i) => i - 8); // relative to 18% grey
  const enc = {
    Linear: (x: number) => Math.min(1, x / 8),
    'Gamma 2.4': (x: number) => Math.pow(Math.min(1, x / 8), 1 / 2.4),
    'S-Log3': (x: number) => LOG_CURVES.slog3.encode(x),
  } as const;
  const rows = Object.entries(enc).map(([name, f]) => ({
    name,
    counts: stops.map((s) => Math.max(0, Math.round((f(0.18 * Math.pow(2, s + 1)) - f(0.18 * Math.pow(2, s))) * 1023))),
  }));
  const max = Math.max(...rows.flatMap((r) => r.counts));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.name}>
          <p className="mb-1 text-[12px] text-ink-300">{r.name}</p>
          <div className="flex h-14 items-end gap-0.5">
            {r.counts.map((c, i) => (
              <div key={i} className="flex flex-1 flex-col items-center justify-end">
                <div className="w-full rounded-sm bg-ink-200" style={{ height: `${Math.max(2, (c / max) * 100)}%` }} title={`${c} code values`} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-between font-mono text-[10px] text-ink-500"><span>−8 stops (shadows)</span><span>18% grey</span><span>+4 stops</span></div>
      <p className="text-[12px] leading-relaxed text-ink-400">10-bit code values spent on each stop of light (white clipped at +5.5 stops for linear and gamma). Linear wastes most values on the brightest stop; Log spreads them almost evenly — that is why cameras record it.</p>
    </div>
  );
}

const CASES: { id: string; label: string; signal: SignalSpec; explain: string }[] = [
  { id: 'ok', label: 'Correct pipeline', signal: {}, explain: 'Scene-linear light, graded, then a display transform and sRGB encoding. Skin and midtones look natural.' },
  { id: 'noencode', label: 'Display encoding missing', signal: { debugTransfer: 1 }, explain: 'Linear values were sent straight to the screen. Midtones look far too dark and contrasty because the display applies its own decoding curve to unencoded data.' },
  { id: 'double', label: 'Encoded twice', signal: { debugTransfer: 2 }, explain: 'The gamma curve was applied twice. Everything looks washed out, grey and low-contrast — the classic “double gamma” mistake.' },
  { id: 'log', label: 'Log shown without a transform', signal: { log: { src: 0, dst: 0, viewRaw: true } }, explain: 'Log-encoded footage viewed directly: flat, milky, desaturated. The data is fine; it just needs its camera-specific transform.' },
];
const QUIZ = [
  { q: 'A Log clip looks flat and milky on a normal monitor. What is the right fix?', options: ['Add contrast and saturation until it looks right', 'Apply the transform for that camera’s Log curve', 'Re-shoot — it is underexposed'], a: 1, why: 'The data is fine: Log is designed to look flat. The matching transform (from the camera maker’s published curve) restores correct contrast and colour; eyeballing contrast gets the tone curve wrong.' },
  { q: 'Which colour space can encode the widest range of colours?', options: ['sRGB', 'Display P3', 'Rec.2020'], a: 2, why: 'Rec.2020’s primaries sit almost on the spectral locus, so its triangle encloses the most of the visible horseshoe.' },
];

export default function Signals({ level }: LevelProps) {
  return <LessonShell level={level}
    observe={<Observe />}
    experiment={<Experiment />}
    discover={
      <Concepts items={[
        { title: 'Linear light', body: 'Numbers proportional to the actual amount of light: double the value, double the photons. Physics (exposure, blur, light mixing) works correctly here — so grading engines like ours do their maths in linear where it matters.' },
        { title: 'Gamma encoding', body: 'A non-linear curve that spends more code values on shadows, matching human sensitivity. Saves bits; must be undone (decoded) before light maths.' },
        { title: 'Rec.709', body: 'The HD television standard: primaries (the triangle), white point (D65) and a camera curve. Displays decode with BT.1886, roughly a 2.4 power. Your web browser uses sRGB, a close sibling.' },
        { title: 'Log footage', body: 'Camera curves (S-Log3, LogC3, V-Log…) that compress 14+ stops into the signal by giving each stop a similar number of code values. Looks flat until transformed.' },
        { title: 'Colour spaces', body: 'A colour space = primaries + white point + transfer function. The same RGB numbers mean different colours in different spaces. Always know which one you are in.' },
        { title: 'Display transforms & management', body: 'The final step maps scene light to what a particular screen can show (SDR, HDR, P3…). Colour management is the bookkeeping that keeps every transform applied exactly once.' },
      ]} />
    }
    challenge={(ctx) => <Doctor ctx={ctx} />} />;
}

function Observe() {
  const p = useMemo(() => defaultParams(), []);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {[{ l: 'A', s: { debugTransfer: 1 } as SignalSpec }, { l: 'B', s: {} as SignalSpec }].map((x) => (
          <figure key={x.l}><GradeCanvas source={portrait} params={p} aspect={3 / 2} view={{ mode: 'graded', split: 0.5, clipWarn: false, showLost: false, signal: x.s }} label={`Version ${x.l}`} /><figcaption className="mt-2 font-display text-[17px] text-ink-100">{x.l}</figcaption></figure>
        ))}
      </div>
      <ObserveQuestion question="These two images contain exactly the same data. Why might A look so dark and harsh?" options={['It was underexposed', 'Something in the signal chain is missing', 'It has more contrast applied']}
        reveal={() => <p>A is the image’s <b>linear light</b> values sent straight to the screen. Nothing was underexposed: the display expected gamma-encoded numbers, applied its own decoding curve, and crushed the midtones. B is the same data with the correct encoding step. A missing (or doubled) transform is one of the most common real-world pipeline errors.</p>} />
    </div>
  );
}

function Experiment() {
  const [sig, setSig] = useState<'ok' | 'noencode' | 'double' | 'log'>('ok');
  const p = useMemo(() => defaultParams(), []);
  const c = CASES.find((x) => x.id === sig)!;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
        <Eyebrow className="mb-3">The signal chain</Eyebrow>
        <ol className="flex flex-wrap items-center gap-2 text-[12.5px]">
          {['Scene light', sig === 'log' ? 'Camera Log curve' : 'Camera (linear RAW)', 'Grading in linear / log', sig === 'noencode' ? '✕ display transform skipped' : sig === 'double' ? 'Display transform ×2' : sig === 'log' ? '✕ Log → display skipped' : 'Display transform', 'Your screen (sRGB EOTF)'].map((s, i, a) => (
            <li key={s} className="flex items-center gap-2"><span className={cx('rounded-full px-3 py-1.5 ring-1', s.startsWith('✕') || s.includes('×2') ? 'text-bad ring-bad/40' : 'text-ink-100 ring-ink-600')}>{s}</span>{i < a.length - 1 && <span className="text-ink-500">→</span>}</li>
          ))}
        </ol>
        <div className="mt-4"><Segmented value={sig} onChange={setSig} label="Pipeline" options={[{ value: 'ok', label: 'Correct' }, { value: 'noencode', label: 'Skip encoding' }, { value: 'double', label: 'Encode twice' }, { value: 'log', label: 'Log, no transform' }]} /></div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <div>
          <GradeCanvas source={portrait} params={p} aspect={3 / 2} view={{ mode: 'graded', split: 0.5, clipWarn: false, showLost: false, signal: c.signal }} label="Pipeline result" />
          <p className="mt-2 text-[13px] text-ink-300">{c.explain}</p>
        </div>
        <div className="rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750"><Eyebrow className="mb-3">Transfer functions</Eyebrow><TransferPlot /></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750"><Eyebrow className="mb-3">Colour spaces (gamuts)</Eyebrow><Chromaticity /></div>
        <div className="rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750"><Eyebrow className="mb-3">Where the bits go</Eyebrow><BitBudget /></div>
      </div>
      <Note tone="caution">Your browser almost certainly displays sRGB. Wide-gamut and HDR displays need colour-managed output that this lab only describes, not renders.</Note>
    </div>
  );
}

function Doctor({ ctx }: { ctx: ChallengeCtx }) {
  const cases = useMemo(() => shuffle(mulberry32(Math.floor(Math.random() * 1e9)), CASES), []);
  const [ans, setAns] = useState<Record<string, string>>({});
  const [qa, setQa] = useState<Record<number, number>>({});
  const p = useMemo(() => defaultParams(), []);
  const done = cases.every((c) => ans[c.id]) && QUIZ.every((_, i) => qa[i] !== undefined);
  const submit = () => {
    const criteria = [
      ...cases.map((c, i) => ({ label: `Image ${i + 1}`, score: ans[c.id] === c.id ? 100 : 0, weight: 1, detail: `Truth: ${c.label}.` })),
      ...QUIZ.map((q, i) => ({ label: `Question ${i + 1}`, score: qa[i] === q.a ? 100 : 0, weight: 1, detail: q.why })),
    ];
    ctx.submit({
      score: weighted(criteria), criteria, worked: [],
      improve: cases.filter((c) => ans[c.id] !== c.id).map((c) => `${c.label}: ${c.explain}`),
      why: 'Most “my footage looks wrong” problems in post-production are not grading problems at all — they are a transform applied twice, skipped, or the wrong one. Recognising the signature on sight saves hours.',
    });
  };
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-ink-850 px-5 py-4 ring-1 ring-ink-750">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-signal">The brief</p>
        <h2 className="mt-1 font-display text-[24px] text-ink-50">Pipeline doctor</h2>
        <p className="mt-1.5 text-[14px] text-ink-300">Four deliveries came back from different vendors. Diagnose what happened to each signal, then answer two questions.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {cases.map((c, i) => (
          <div key={c.id} className="rounded-2xl bg-ink-850 p-3 ring-1 ring-ink-750">
            <GradeCanvas source={portrait} params={p} aspect={3 / 2} view={{ mode: 'graded', split: 0.5, clipWarn: false, showLost: false, signal: c.signal }} label={`Delivery ${i + 1}`} maxPixels={600_000} />
            <p className="mt-2 mb-2 text-[13px] text-ink-200">Delivery {i + 1}</p>
            <div className="flex flex-wrap gap-1.5">
              {CASES.map((o) => (
                <button key={o.id} onClick={() => setAns((a) => ({ ...a, [c.id]: o.id }))} className={cx('min-h-9 rounded-full px-3 text-[12px] ring-1', ans[c.id] === o.id ? 'bg-ink-100 text-ink-950 ring-ink-100' : 'text-ink-300 ring-ink-600')}>{o.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {QUIZ.map((q, i) => (
        <div key={i} className="rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
          <p className="mb-2 text-[14px] text-ink-100">{q.q}</p>
          <div className="flex flex-wrap gap-2">{q.options.map((o, k) => <button key={o} onClick={() => setQa((s) => ({ ...s, [i]: k }))} className={cx('min-h-9 rounded-full px-3 text-[12.5px] ring-1', qa[i] === k ? 'bg-ink-100 text-ink-950 ring-ink-100' : 'text-ink-300 ring-ink-600')}>{o}</button>)}</div>
        </div>
      ))}
      <div className="flex items-center gap-3"><Button variant="primary" disabled={!done} onClick={submit}>Submit diagnosis</Button>{!done && <Badge tone="outline">Answer everything to submit</Badge>}</div>
    </div>
  );
}
