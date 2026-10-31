import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { GradeCanvas, type GradeHandle } from '../../components/grading/GradeCanvas';
import { GradeViewport } from '../../components/grading/GradeViewport';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx, type Criterion } from '../../components/lesson/LessonShell';
import { Badge, Button, Eyebrow, Note, Segmented, Slider, Toggle, cx } from '../../components/ui';
import { meanDeltaE, regionMean } from '../../engine/analysis';
import type { Frame } from '../../engine/GradeEngine';
import { defaultParams, type SceneId } from '../../engine/params';
import { REGIONS, sceneRectToUv } from '../../engine/scenes';
import type { LevelProps } from '../../game/registry';
import { errorToScore, linearToSrgb, rec709Oetf, rgbToLab, srgbToLinear } from '../../lib/color';

const G_MIN = 0.3, G_MAX = 3.3;
const clampG = (g: number) => Math.min(G_MAX, Math.max(G_MIN, g));
const gOut = (x: number, g: number) => Math.pow(x, 1 / g);

export default function GammaLab({ level }: LevelProps) {
  return <LessonShell level={level} observe={<Observe />} experiment={<Experiment />} discover={<Discover />} challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

// ------------------------------------------------------------------ shared widgets

/** Gamma curve editor: drag anywhere to set the curve through that point; endpoints stay fixed. */
export function GammaCurve({ gamma, onChange, size = 260, reference }: { gamma: number; onChange: (g: number) => void; size?: number; reference?: number }) {
  const pad = 14;
  const S = size - pad * 2;
  const pt = (x: number, y: number) => `${pad + x * S},${pad + (1 - y) * S}`;
  const path = (g: number) => 'M' + Array.from({ length: 65 }, (_, i) => pt(i / 64, gOut(i / 64, g))).join(' L');
  const hx = 0.5, hy = gOut(0.5, gamma);
  const fromPointer = (e: RPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(0.97, Math.max(0.03, ((e.clientX - r.left) / r.width * size - pad) / S));
    const y = Math.min(0.995, Math.max(0.005, 1 - ((e.clientY - r.top) / r.height * size - pad) / S));
    onChange(clampG(Math.log(x) / Math.log(y)));
  };
  const onKey = (e: KeyboardEvent) => {
    const k = e.shiftKey ? 1.1 : 1.02;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(clampG(gamma * k));
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(clampG(gamma / k));
    else return;
    e.preventDefault();
  };
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full max-w-[340px] touch-none select-none rounded-xl bg-[#0e0e0e] ring-1 ring-ink-700 outline-offset-2"
      role="slider"
      tabIndex={0}
      aria-label={`Gamma curve, gamma ${gamma.toFixed(2)}. Arrow keys adjust.`}
      aria-valuenow={Number(gamma.toFixed(2))}
      aria-valuemin={G_MIN}
      aria-valuemax={G_MAX}
      onKeyDown={onKey}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); }}
      onPointerMove={(e) => { if (e.buttons) fromPointer(e); }}
    >
      {[0.25, 0.5, 0.75].map((v) => (
        <g key={v} stroke="#262626">
          <line x1={pad + v * S} y1={pad} x2={pad + v * S} y2={pad + S} />
          <line x1={pad} y1={pad + v * S} x2={pad + S} y2={pad + v * S} />
        </g>
      ))}
      <rect x={pad} y={pad} width={S} height={S} fill="none" stroke="#333" />
      <path d={`M${pt(0, 0)} L${pt(1, 1)}`} stroke="#4a4a4a" strokeDasharray="4 4" fill="none" />
      {reference !== undefined && <path d={path(reference)} stroke="#ff5b3a" strokeWidth={1.5} strokeDasharray="3 3" fill="none" opacity={0.8} />}
      <path d={path(gamma)} stroke="#f2f2f2" strokeWidth={2.2} fill="none" />
      <line x1={pad + hx * S} y1={pad + S} x2={pad + hx * S} y2={pad + (1 - hy) * S} stroke="#666" strokeDasharray="2 3" />
      <line x1={pad} y1={pad + (1 - hy) * S} x2={pad + hx * S} y2={pad + (1 - hy) * S} stroke="#666" strokeDasharray="2 3" />
      <circle cx={pad} cy={pad + S} r={4} fill="#888" />
      <circle cx={pad + S} cy={pad} r={4} fill="#888" />
      <circle cx={pad + hx * S} cy={pad + (1 - hy) * S} r={9} fill="#f2f2f2" stroke="#000" strokeWidth={1.5} />
      <text x={pad + 4} y={pad + S - 6} fill="#777" fontSize="10" fontFamily="JetBrains Mono Variable, monospace">in →</text>
      <text x={pad + 4} y={pad + 12} fill="#777" fontSize="10" fontFamily="JetBrains Mono Variable, monospace">out ↑</text>
    </svg>
  );
}

/** Input gradient above, output gradient below, with 10% step markers. */
function GradientStrip({ gamma }: { gamma: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const W = 1024, H = 2;
    c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    for (let x = 0; x < W; x++) {
      const v = x / (W - 1);
      const o = gOut(v, gamma);
      for (let y = 0; y < H; y++) {
        const i = (y * W + x) * 4;
        const val = Math.round((y === 0 ? v : o) * 255);
        img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [gamma]);
  return (
    <div>
      <div className="relative">
        <canvas ref={ref} className="block h-28 w-full rounded-lg [image-rendering:pixelated]" style={{ imageRendering: 'auto' }} aria-label="Black-to-white gradient: input above, after gamma below" role="img" />
        <span className="absolute top-1.5 left-2 text-[10.5px] text-white/70 mix-blend-difference">input</span>
        <span className="absolute bottom-1.5 left-2 text-[10.5px] text-white/70 mix-blend-difference">output · γ {gamma.toFixed(2)}</span>
      </div>
      <div className="mt-1.5 grid grid-cols-11 text-center font-mono text-[10px] text-ink-400">
        {Array.from({ length: 11 }, (_, i) => (
          <div key={i}>
            <div className="text-ink-500">{i * 10}</div>
            <div className={cx(i > 0 && i < 10 && 'text-ink-100')}>{Math.round(gOut(i / 10, gamma) * 100)}</div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-ink-500">Top row: input %. Bottom row: output %. The 0 and 100 never move.</p>
    </div>
  );
}

/** Encoding curves: how standards map linear light to code values. */
function TransferPlot() {
  const [zoom, setZoom] = useState(false);
  const [show, setShow] = useState({ srgb: true, p22: true, r709: true });
  const S = 260, pad = 14, W = S - pad * 2;
  const xMax = zoom ? 0.05 : 1, yMax = zoom ? 0.3 : 1;
  const pt = (x: number, y: number) => `${pad + (x / xMax) * W},${pad + (1 - y / yMax) * W}`;
  const curve = (f: (x: number) => number) => 'M' + Array.from({ length: 161 }, (_, i) => { const x = (i / 160) * xMax; return pt(x, Math.min(yMax, f(x))); }).join(' L');
  const curves = [
    { id: 'srgb' as const, label: 'sRGB (piecewise)', color: '#f2f2f2', f: linearToSrgb },
    { id: 'p22' as const, label: 'Pure power 1/2.2', color: '#ff5b3a', f: (x: number) => Math.pow(x, 1 / 2.2) },
    { id: 'r709' as const, label: 'Rec.709 camera OETF', color: '#6ea8ff', f: rec709Oetf },
  ];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {curves.map((c) => (
          <Toggle key={c.id} checked={show[c.id]} onChange={(v) => setShow((s) => ({ ...s, [c.id]: v }))} label={<span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: c.color }} />{c.label}</span>} />
        ))}
      </div>
      <svg viewBox={`0 0 ${S} ${S}`} className="mt-3 w-full max-w-[340px] rounded-xl bg-[#0e0e0e] ring-1 ring-ink-700" role="img" aria-label="Transfer function comparison">
        <rect x={pad} y={pad} width={W} height={W} fill="none" stroke="#333" />
        <path d={`M${pt(0, 0)} L${pt(xMax, Math.min(yMax, xMax))}`} stroke="#3a3a3a" strokeDasharray="4 4" fill="none" />
        {curves.filter((c) => show[c.id]).map((c) => <path key={c.id} d={curve(c.f)} stroke={c.color} strokeWidth={1.8} fill="none" />)}
        <text x={pad + 4} y={pad + W - 6} fill="#777" fontSize="10" fontFamily="JetBrains Mono Variable, monospace">linear light 0–{xMax}</text>
        <text x={pad + 4} y={pad + 12} fill="#777" fontSize="10" fontFamily="JetBrains Mono Variable, monospace">code value 0–{yMax}</text>
      </svg>
      <div className="mt-2"><Toggle checked={zoom} onChange={setZoom} label="Zoom into the deep shadows" /></div>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-400">Zoomed in, sRGB and Rec.709 start with a short straight segment; a pure power curve shoots up vertically at black, which would amplify noise. Displays then apply their own EOTF (e.g. BT.1886 ≈ γ 2.4) — standards, not creative choices.</p>
    </div>
  );
}

/** 8-bit storage: linear encoding wastes code values in the highlights and bands in the shadows. */
function BandingDemo() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const W = 720, H = 2;
    c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    for (let x = 0; x < W; x++) {
      const e = (x / (W - 1)) * 0.45; // perceptual position, shadows to lower mids
      const linQ = Math.round(srgbToLinear(e) * 255) / 255; // stored as 8-bit LINEAR
      const a = Math.round(linearToSrgb(linQ) * 255);
      const b = Math.round(e * 255); // stored as 8-bit sRGB-encoded
      for (const [row, v] of [[0, a], [1, b]] as const) {
        const i = (row * W + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, []);
  return (
    <div className="relative">
      <canvas ref={ref} className="block h-24 w-full" role="img" aria-label="Upper: 8-bit linear storage shows bands in the shadows. Lower: 8-bit gamma-encoded storage is smooth." />
      <span className="absolute top-1 left-2 text-[10.5px] text-white/80">8-bit linear</span>
      <span className="absolute bottom-1 left-2 text-[10.5px] text-white/80">8-bit gamma-encoded</span>
    </div>
  );
}

// ------------------------------------------------------------------ observe

function Observe() {
  const steps = Array.from({ length: 11 }, (_, i) => i / 10);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-5 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
        {[{ label: 'Ramp A', f: (v: number) => linearToSrgb(v) }, { label: 'Ramp B', f: (v: number) => v }].map((r) => (
          <figure key={r.label}>
            <figcaption className="mb-1.5 font-display text-[18px] text-ink-100">{r.label}</figcaption>
            <div className="flex h-20 overflow-hidden rounded-lg">
              {steps.map((v) => { const g = Math.round(r.f(v) * 255); return <div key={v} className="flex-1" style={{ background: `rgb(${g},${g},${g})` }} />; })}
            </div>
          </figure>
        ))}
      </div>
      <ObserveQuestion
        question="Both ramps have eleven steps from black to white. Which one looks evenly spaced?"
        options={['Ramp A', 'Ramp B', 'Both look even']}
        reveal={() => (
          <div className="space-y-3">
            <p><b>Ramp A</b> adds equal amounts of <i>light</i> per step. It jumps out of black, then the light end bunches together.</p>
            <p><b>Ramp B</b> adds equal steps of <i>encoded value</i>. It looks far more even, because human lightness perception is roughly a power law: we notice small changes in the dark much more than in the bright.</p>
            <p className="text-ink-400">That non-linearity is what “gamma” is about. Let’s bend it.</p>
          </div>
        )}
      />
    </div>
  );
}

// ------------------------------------------------------------------ experiment

const SCENE_OPTS: { value: SceneId; label: string }[] = [
  { value: 'portrait', label: 'Portrait' }, { value: 'facade', label: 'Architecture' }, { value: 'coast', label: 'Landscape' }, { value: 'street', label: 'Night' },
];

function Experiment() {
  const [gamma, setGamma] = useState(1);
  const [scene, setScene] = useState<SceneId>('portrait');
  const params = useMemo(() => defaultParams({ gamma }), [gamma]);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <GradeViewport source={{ kind: 'scene', scene, variant: 2 }} params={params} aspect={scene === 'street' ? 16 / 9 : 3 / 2} beforeLabel="γ 1.0" afterLabel={`γ ${gamma.toFixed(2)}`} clipToggle={false}
            toolbarExtra={<Segmented size="sm" value={scene} onChange={setScene} options={SCENE_OPTS} label="Photograph" />} />
        </div>
        <div className="space-y-5 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Eyebrow>Gamma γ</Eyebrow>
              <p className="num font-display text-[44px] leading-none text-ink-50">{gamma.toFixed(2)}</p>
              <p className="mt-1 font-mono text-[12px] text-ink-400">out = in<sup>1/γ</sup> = in<sup>{(1 / gamma).toFixed(3)}</sup></p>
            </div>
            <Button size="sm" onClick={() => setGamma(1)}>Reset</Button>
          </div>
          <GammaCurve gamma={gamma} onChange={setGamma} />
          <Slider label="Gamma (log scale)" value={Math.log2(gamma)} min={Math.log2(G_MIN)} max={Math.log2(G_MAX)} step={0.005} defaultValue={0} format={(v) => `γ ${Math.pow(2, v).toFixed(2)}`} onChange={(v) => setGamma(Math.pow(2, v))} />
          <p className="text-[12.5px] text-ink-300">Mid-grey 50% → <b className="num font-mono text-ink-50">{(gOut(0.5, gamma) * 100).toFixed(1)}%</b>. Black → 0%. White → 100%.</p>
        </div>
      </div>
      <div className="rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750"><GradientStrip gamma={gamma} /></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <Eyebrow className="mb-3">Not all “gammas” are the same thing</Eyebrow>
          <TransferPlot />
        </div>
        <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <Eyebrow>Why encode at all? Look at the shadows</Eyebrow>
          <BandingDemo />
          <p className="text-[13px] leading-relaxed text-ink-300">Both strips are stored in 8 bits (256 levels). Stored as linear light, the darkest values are spaced too far apart for your eye — visible bands. Gamma-encoding spends more of the 256 levels where vision is most sensitive.</p>
          <Note tone="science">This lab’s “Gamma” control is a pure power law applied to display-encoded values, after the display transform. Professional “Gamma/Midtone” wheels (World 03, Level 5) use their own maths, work per channel and are tuned to feel natural; they are related, but not identical.</Note>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ discover

function Discover() {
  const mini = (g: number) => (
    <svg viewBox="0 0 100 60" className="h-24 w-full">
      <path d={`M5 55 ${Array.from({ length: 21 }, (_, i) => `L${5 + i * 4.5} ${55 - gOut(i / 20, g) * 50}`).join(' ')}`} stroke="#eee" strokeWidth="1.5" fill="none" />
      <path d="M5 55 L95 5" stroke="#555" strokeDasharray="2 2" fill="none" />
    </svg>
  );
  return (
    <Concepts
      items={[
        { title: 'Gamma is a power curve', body: 'out = in^(1/γ). With γ above 1 the curve bows upward and midtones brighten; below 1 they darken. Because 0 and 1 raised to any power stay 0 and 1, black and white never move.', visual: mini(1.8) },
        { title: 'Midtones carry the mood', body: 'Lifting mids makes an image airy and open; lowering them adds weight and drama — without clipping anything. Exposure, by contrast, moves every tone including white.', visual: mini(0.6) },
        { title: 'Encoding is not grading', body: 'Cameras and files gamma-encode light so 8 or 10 bits are spent where your eyes need them. sRGB, Rec.709 and BT.1886 are standard encode/decode pairs. They are plumbing, not looks.', visual: mini(2.2) },
        { title: 'Display transfer functions', body: 'A display decodes the signal back into light. sRGB uses a short linear toe plus a 2.4 power; a pure 2.2 power is a close cousin that differs mainly near black. Mixing them up crushes or lifts shadows.' },
        { title: 'Midtone controls differ', body: 'The “Gamma” wheel in grading software or “Midtones” in photo editors are tuned creative tools — often per-channel, often not pure power laws. Treat them as related to gamma, not equal to it.' },
      ]}
    />
  );
}

// ------------------------------------------------------------------ challenge

const REF_GAMMAS = [0.62, 0.74, 1.45, 1.75];

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const [refG] = useState(() => REF_GAMMAS[Math.floor(Math.random() * REF_GAMMAS.length)]);
  const [g1, setG1] = useState(1);
  const [g2, setG2] = useState(1);
  const refHandle = useRef<GradeHandle>(null);
  const userHandle = useRef<GradeHandle>(null);
  const cardHandle = useRef<GradeHandle>(null);
  const [cardFrame, setCardFrame] = useState<Frame | null>(null);
  const refParams = useMemo(() => defaultParams({ gamma: refG }), [refG]);
  const p1 = useMemo(() => defaultParams({ gamma: g1 }), [g1]);
  const p2 = useMemo(() => defaultParams({ gamma: g2 }), [g2]);
  const cardRect = useMemo(() => sceneRectToUv(REGIONS.stilllife.card, 3 / 2), []);
  const liveL = cardFrame ? rgbToLab(regionMean(cardFrame, cardRect))[0] : null;
  const tolFull = ctx.difficulty === 'advanced' ? 1 : ctx.difficulty === 'intermediate' ? 1.5 : 2;

  const submit = () => {
    const a = refHandle.current?.analyze({ width: 240 });
    const b = userHandle.current?.analyze({ width: 240 });
    const c = cardHandle.current?.analyze({ width: 320 });
    const dE = a && b ? meanDeltaE(a, b, 2) : NaN;
    const L = c ? rgbToLab(regionMean(c, cardRect))[0] : NaN;
    const ratio = Math.abs(Math.log2(g1 / refG));
    const c1: Criterion = { label: 'Match the reference', score: Number.isFinite(dE) ? errorToScore(dE, 0.5 * tolFull, 7) : 0, weight: 1, detail: `Mean ΔE00 across the image ${dE.toFixed(2)}. Your γ ${g1.toFixed(2)} vs reference γ ${refG.toFixed(2)}.` };
    const c2: Criterion = { label: 'Place mid-grey at L* 50', score: Number.isFinite(L) ? errorToScore(Math.abs(L - 50), tolFull, 16) : 0, weight: 1, detail: `Grey card measured L* ${L.toFixed(1)} (target 50). γ ${g2.toFixed(2)}.` };
    const worked: string[] = [];
    const improve: string[] = [];
    if (c1.score >= 85) worked.push('Your eye read the midtone density of the reference accurately.');
    else improve.push(g1 < refG ? 'Your midtones are darker than the reference — raise γ.' : 'Your midtones are brighter than the reference — lower γ.');
    if (ratio < 0.1) worked.push('Reference γ recovered within 7%.');
    if (c2.score >= 85) worked.push('The grey card sits in the perceptual middle (L* ≈ 50) and the chart’s black stayed black.');
    else improve.push(L < 50 ? `The grey card reads L* ${L.toFixed(0)}: still too dark — raise γ a little.` : `The grey card reads L* ${L.toFixed(0)}: too bright — lower γ.`);
    ctx.submit({
      score: weighted([c1, c2]),
      criteria: [c1, c2],
      worked,
      improve,
      why: 'Mid-grey (18% reflectance) is the anchor of every exposure and grading system. Gamma moves it without touching black or white, which is why colourists reach for midtone controls when an image feels heavy but nothing is clipped.',
      meta: {},
    });
  };

  return (
    <div className="space-y-8">
      <section>
        <ChallengeBrief title="Round 1 · Match the reference print">
          A colleague graded this portrait with a single gamma adjustment. Using only gamma, make yours match. Scored by mean ΔE2000 over the whole frame.
        </ChallengeBrief>
        <div className="grid gap-4 lg:grid-cols-2">
          <figure>
            <GradeCanvas ref={refHandle} source={{ kind: 'scene', scene: 'portrait', variant: 3, params: [0, 2, 1, 0] }} params={refParams} aspect={3 / 2} label="Reference grade" />
            <figcaption className="mt-2 text-[12px] text-ink-400">Reference</figcaption>
          </figure>
          <figure>
            <GradeCanvas ref={userHandle} source={{ kind: 'scene', scene: 'portrait', variant: 3, params: [0, 2, 1, 0] }} params={p1} aspect={3 / 2} label="Your grade" />
            <figcaption className="mt-2 text-[12px] text-ink-400">Yours</figcaption>
          </figure>
        </div>
        <div className="mt-4 grid gap-5 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750 md:grid-cols-[auto_1fr]">
          <GammaCurve gamma={g1} onChange={setG1} size={220} />
          <div className="space-y-4">
            <Slider label="Gamma" value={Math.log2(g1)} min={Math.log2(G_MIN)} max={Math.log2(G_MAX)} step={0.005} defaultValue={0} format={(v) => `γ ${Math.pow(2, v).toFixed(2)}`} onChange={(v) => setG1(Math.pow(2, v))} />
            <Hint>Compare the darkest hair and the background tone rather than the face. If the reference feels lighter but no whiter, its γ is above 1.</Hint>
          </div>
        </div>
      </section>

      <section>
        <ChallengeBrief title="Round 2 · Rescue the midtones">
          This still life was underexposed and the client forbids touching exposure. Using only gamma, bring the 18% grey card to L* 50 — the perceptual middle — while black and white stay anchored.
        </ChallengeBrief>
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <GradeCanvas ref={cardHandle} source={{ kind: 'scene', scene: 'stilllife' }} capture={{ exposure: -1.2 }} params={p2} aspect={3 / 2} label="Underexposed still life" onAnalysis={setCardFrame} />
          <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
            <GammaCurve gamma={g2} onChange={setG2} size={220} />
            <Slider label="Gamma" value={Math.log2(g2)} min={Math.log2(G_MIN)} max={Math.log2(G_MAX)} step={0.005} defaultValue={0} format={(v) => `γ ${Math.pow(2, v).toFixed(2)}`} onChange={(v) => setG2(Math.pow(2, v))} />
            {ctx.difficulty === 'beginner' && liveL !== null && (
              <p className="text-[13px] text-ink-300">Grey card now: <b className="num font-mono text-ink-50">L* {liveL.toFixed(1)}</b> <Badge tone={Math.abs(liveL - 50) < 2 ? 'ok' : 'outline'}>target 50</Badge></p>
            )}
            <Hint>The grey card is the large rectangle behind the cup. L* 50 corresponds to an sRGB value of roughly 119 — about 47%.</Hint>
          </div>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={submit}>Submit both rounds</Button>
        <span className="text-[12px] text-ink-400">Unlimited retries. Your settings are kept if you refine.</span>
      </div>
    </div>
  );
}
