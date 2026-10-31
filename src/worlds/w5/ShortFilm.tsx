import { useEffect, useRef, useState, type RefObject } from 'react';
import { ColourPanel, FilmPanel, ToolSection, TonePanel, WheelsPanel, WhiteBalancePanel } from '../../components/grading/Controls';
import { GradeCanvas, type GradeHandle } from '../../components/grading/GradeCanvas';
import { Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Badge, Button, Eyebrow, Segmented, cx } from '../../components/ui';
import type { Frame } from '../../engine/GradeEngine';
import { defaultParams, type CaptureSpec, type GradeParams, type SourceSpec } from '../../engine/params';
import type { LevelProps } from '../../game/registry';
import { contrastRatio, errorToScore, hexToRgb, rangeScore, rgbToHex, rgbToLch, type RGB } from '../../lib/color';
import { clampWeight, fontById, FONTS } from '../../lib/fonts';
import { useSaveToGallery } from '../../lib/gallery';
import { chromaticHues, detectHarmony } from '../w1/palette';
import { frameLab, tonalColour, toneStats } from '../shared/measure';

const LIGHTS = ['Studio', 'Golden hour', 'Neon night', 'Window daylight'];
type Mood = 'suspense' | 'romance' | 'loneliness' | 'nostalgia';
const MOOD_TEXT: Record<Mood, string> = { suspense: 'darker, harder, colder', romance: 'warmer, softer, glowing', loneliness: 'cooler, desaturated, quiet', nostalgia: 'warm, faded blacks, grain' };
type Corr = { exposure: number; temp: number; tint: number };
const N: Corr = { exposure: 0, temp: 6504, tint: 0 };

function shots(light: number): { label: string; source: SourceSpec; capture: CaptureSpec }[] {
  return [
    { label: 'Establishing', source: { kind: 'scene', scene: light === 1 ? 'coast' : 'street' }, capture: { exposure: -0.4, castTemp: 5600 } },
    { label: 'Her face', source: { kind: 'scene', scene: 'portrait', variant: 4, params: [light, 3, 1, 0] }, capture: { exposure: 0.4, castTint: 15 } },
    { label: 'Detail', source: light === 1 ? { kind: 'scene', scene: 'coast', frame: [0.18, -0.12, 0.4] } : { kind: 'scene', scene: 'street', frame: [-0.24, 0.16, 0.42] }, capture: { exposure: -0.6, castTemp: 8000 } },
  ];
}

/** A few dominant colours from frames: hue-bucketed means, ranked by population. */
function extractPalette(frames: Frame[], k = 5): RGB[] {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (const f of frames) for (let i = 0; i < f.data.length; i += 4 * 7) {
    const c: RGB = [f.data[i] / 255, f.data[i + 1] / 255, f.data[i + 2] / 255];
    const [L, C, h] = rgbToLch(c);
    const key = C < 10 ? 100 + Math.min(3, Math.floor(L / 25)) : Math.floor(h / 30);
    const bk = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bk.r += c[0]; bk.g += c[1]; bk.b += c[2]; bk.n++;
    buckets.set(key, bk);
  }
  return [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, k).map((bk) => [bk.r / bk.n, bk.g / bk.n, bk.b / bk.n] as RGB);
}

export default function ShortFilm({ level }: LevelProps) {
  return <LessonShell level={level}
    observe={
      <div className="space-y-5">
        <Board light={2} look={defaultParams({ contrast: 0.3, temp: 8200, saturation: 0.85, lift: { x: 0.35, y: -0.25, m: 0 }, halation: 0.4, grain: 0.2 })} corr={[N, N, N]} title="Night Shift" font="bebas" colour="#F2EEE6" />
        <ObserveQuestion question="Three frames and a title card. What makes them feel like one film?" options={['The same colour temperature', 'The same contrast and black level', 'Recurring accent colours', 'All of these']}
          reveal={() => <p>All of them. An art director defines a visual direction — palette, lighting mood, contrast style, title typography — so every shot, however different in content, belongs to the same world. Consistency is designed, not hoped for.</p>} />
      </div>
    }
    experiment={<p className="max-w-2xl text-[14px] text-ink-300">The mission itself is the playground: every control is live. Open the Challenge to begin; you can refine as often as you like.</p>}
    discover={
      <Concepts items={[
        { title: 'A visual direction', body: 'A short document of decisions: palette, lighting mood, contrast style, lenses, title type. It lets a whole crew make consistent choices without asking.' },
        { title: 'Lighting mood', body: 'Chosen on set, not in grading: golden hour, practical neon, soft window light. The grade can push it further but cannot invent it.' },
        { title: 'Palette', body: 'A handful of colours that recur — in costumes, locations and light. Extracted from your frames here so you can see whether they hang together.' },
        { title: 'Title typography', body: 'The title card is the film’s logo. Its typeface and colour should belong to the same world as the images.' },
      ]} />
    }
    challenge={(ctx) => <Studio ctx={ctx} />} />;
}

function Board({ light, look, corr, title, font, colour, frames, setFrame, mainHandle }: {
  light: number; look: GradeParams; corr: Corr[]; title: string; font: string; colour: string; frames?: (Frame | null)[]; setFrame?: (i: number, f: Frame) => void; mainHandle?: RefObject<GradeHandle | null>;
}) {
  const S = shots(light);
  const f = fontById(font);
  const pal = frames && frames.every(Boolean) ? extractPalette(frames as Frame[]) : [];
  return (
    <div className="space-y-3">
      <div className="relative">
        <GradeCanvas ref={mainHandle} source={S[0].source} capture={S[0].capture} params={{ ...look, ...corr[0] }} aspect={2.39} time={2} onAnalysis={setFrame ? (fr) => setFrame(0, fr) : undefined} label="Title frame" />
        <p className="pointer-events-none absolute bottom-[12%] left-[6%]" style={{ fontFamily: f.css, fontWeight: clampWeight(f, 700), color: colour, fontSize: 'clamp(28px, 6vw, 84px)', lineHeight: 0.95, letterSpacing: '0.02em', textTransform: f.id === 'bebas' ? 'uppercase' : undefined }}>{title}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {S.slice(1).map((s, k) => (
          <GradeCanvas key={s.label} source={s.source} capture={s.capture} params={{ ...look, ...corr[k + 1] }} aspect={16 / 9} time={2} onAnalysis={setFrame ? (fr) => setFrame(k + 1, fr) : undefined} label={s.label} maxPixels={600_000} />
        ))}
      </div>
      {pal.length > 0 && (
        <div className="flex items-center gap-2"><Eyebrow>Extracted palette</Eyebrow>{pal.map((c, i) => <span key={i} className="h-8 w-12 rounded-md ring-1 ring-white/10" style={{ background: rgbToHex(c) }} title={rgbToHex(c)} />)}</div>
      )}
    </div>
  );
}

function Studio({ ctx }: { ctx: ChallengeCtx }) {
  const [light, setLight] = useState(2);
  const [mood, setMood] = useState<Mood>('loneliness');
  const [look, setLook] = useState<GradeParams>(() => defaultParams());
  const [corr, setCorr] = useState<Corr[]>([N, N, N]);
  const [shot, setShot] = useState(0);
  const [title, setTitle] = useState('Night Shift');
  const [font, setFont] = useState('inter');
  const [colour, setColour] = useState('#FFFFFF');
  const [frames, setFrames] = useState<(Frame | null)[]>([null, null, null]);
  const main = useRef<GradeHandle | null>(null);
  const save = useSaveToGallery();
  const setFrame = (i: number, f: Frame) => setFrames((fs) => fs.map((x, k) => (k === i ? f : x)));
  const setLookP = (q: Partial<GradeParams>) => setLook((l) => ({ ...l, ...q }));
  const shotP = { ...look, ...corr[shot] };
  const setShotP = (q: Partial<GradeParams>) => setCorr((cs) => cs.map((c, k) => (k === shot ? { exposure: q.exposure ?? c.exposure, temp: q.temp ?? c.temp, tint: q.tint ?? c.tint } : c)));

  const evaluate = () => {
    const e = main.current?.engine;
    if (!e || frames.some((x) => !x)) return null;
    const S = shots(light);
    const user = S.map((s, k) => e.analyzeScenario({ source: s.source, capture: s.capture, params: { ...look, ...corr[k], grain: 0 }, width: 200, time: 2 })!);
    const neutral = S.map((s) => e.analyzeScenario({ source: s.source, capture: {}, params: defaultParams(), width: 200, time: 2 })!);
    const labs = user.map((u) => frameLab(u)), labs0 = neutral.map((u) => frameLab(u));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
    const bSpread = sd(labs.map((l) => l.b)), LSpread = sd(labs.map((l) => l.L));
    const db = mean(labs.map((l, k) => l.b - labs0[k].b)), dC = mean(labs.map((l, k) => l.C / Math.max(1, labs0[k].C)));
    const t = user.map((u) => toneStats(u)), t0 = neutral.map((u) => toneStats(u));
    const dMed = mean(t.map((x, k) => x.median - t0[k].median)), dStd = mean(t.map((x, k) => x.std / Math.max(1e-3, t0[k].std)));
    const lo = mean(user.map((u) => tonalColour(u, 'shadows')[2]));
    const moodScore: Record<Mood, number> = {
      suspense: (rangeScore(-dMed, 0.03, 0.4, 0.06) + rangeScore(dStd, 1.1, 2.2, 0.25) + rangeScore(-lo, 3, 40, 6)) / 3,
      romance: (rangeScore(db, 3, 30, 5) + rangeScore(dStd, 0.6, 0.97, 0.15) + (look.halation > 0.1 ? 100 : 50)) / 3,
      loneliness: (rangeScore(-db, 3, 30, 5) + rangeScore(1 - dC, 0.15, 0.9, 0.15) + rangeScore(dStd, 0.7, 1.15, 0.2)) / 3,
      nostalgia: (rangeScore(Math.min(...t.map((x) => x.p02)), 0.05, 0.25, 0.05) + rangeScore(db, 3, 30, 5) + (look.grain > 0.1 ? 100 : 30)) / 3,
    };
    const pal = extractPalette(user);
    const hues = chromaticHues(pal);
    const h = detectHarmony(hues);
    const titleBg = frames[0]!;
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = Math.floor(titleBg.height * 0.6); y < titleBg.height * 0.9; y++) for (let x = Math.floor(titleBg.width * 0.05); x < titleBg.width * 0.55; x++) { const i = (y * titleBg.width + x) * 4; r += titleBg.data[i]; g += titleBg.data[i + 1]; b += titleBg.data[i + 2]; n++; }
    const titleC = contrastRatio(hexToRgb(colour)!, [r / n / 255, g / n / 255, b / n / 255]);
    const clip = Math.max(...t.map((x) => x.clipHi));
    return [
      { label: `Mood: ${mood}`, score: Math.round(moodScore[mood]), weight: 2, detail: `Measured across all three shots (${MOOD_TEXT[mood]}): Δb* ${db.toFixed(1)}, contrast ×${dStd.toFixed(2)}, chroma ×${dC.toFixed(2)}.` },
      { label: 'Shot-to-shot consistency', score: Math.round((errorToScore(bSpread, 3, 14) + errorToScore(LSpread, 6, 25)) / 2), weight: 2, detail: `Spread across shots: warmth b* ${bSpread.toFixed(1)}, lightness L* ${LSpread.toFixed(1)}.` },
      { label: 'Palette coherence', score: hues.length < 2 ? 80 : h.scheme === 'free' ? 35 : errorToScore(h.error, 15, 60), weight: 1, detail: `Extracted palette reads as ${hues.length < 2 ? 'near-monochrome' : h.scheme}.` },
      { label: 'Title legible', score: errorToScore(Math.max(0, 3 - titleC), 0, 2), weight: 1, detail: `Title colour vs the frame behind it: ${titleC.toFixed(2)}:1 (need 3:1 for large type).` },
      { label: 'Title fits the world', score: Math.round(100 - Math.abs(fontById(font).traits.loud - (mood === 'suspense' ? 0.8 : mood === 'loneliness' ? 0.35 : 0.5)) * 100), weight: 1, detail: `${fontById(font).label} (loudness ${fontById(font).traits.loud}) for a ${mood} film.` },
      { label: 'Technical · highlights', score: errorToScore(clip * 100, 1.5, 10), weight: 1, detail: `Worst shot clips ${(clip * 100).toFixed(1)}%.` },
    ];
  };
  const [live, setLive] = useState<ReturnType<typeof evaluate>>(null);
  const ready = frames.every(Boolean);
  useEffect(() => {
    if (ctx.difficulty !== 'beginner' || !ready) return;
    const t = setTimeout(() => setLive(evaluate()), 700);
    return () => clearTimeout(t);
  }, [ready, look, corr, light, mood, font, colour, ctx.difficulty]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    const criteria = evaluate();
    if (!criteria) return;
    ctx.submit({ score: weighted(criteria), criteria, subjective: true,
      worked: criteria.filter((c) => c.score >= 85).map((c) => `${c.label}: ${c.detail}`),
      improve: criteria.filter((c) => c.score < 70).map((c) => `${c.label}: ${c.detail}`),
      why: 'Art direction is consistency with intent: a mood chosen on purpose, carried through light, grade, palette and type, and held steady from shot to shot. The mood check uses the genre conventions from World 04 — strong tendencies, not laws.' });
  };
  const saveBoard = async () => {
    const e = main.current?.engine;
    if (!e) return;
    const S = shots(light);
    const imgs: string[] = [];
    for (let k = 0; k < 3; k++) { e.setSource(S[k].source); e.setCapture(S[k].capture); e.setParams({ ...look, ...corr[k] }); const s = e.snapshot('image/jpeg'); if (s) imgs.push(s); }
    e.setSource(S[0].source); e.setCapture(S[0].capture); e.setParams({ ...look, ...corr[0] }); e.render();
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1180;
    const g = c.getContext('2d')!; g.fillStyle = '#0d0d0d'; g.fillRect(0, 0, 1600, 1180);
    const draw = async (src: string, x: number, y: number, w: number, h: number) => { const im = new Image(); im.src = src; await im.decode(); g.drawImage(im, x, y, w, h); };
    if (imgs[0]) await draw(imgs[0], 40, 40, 1520, 636);
    if (imgs[1]) await draw(imgs[1], 40, 700, 750, 422);
    if (imgs[2]) await draw(imgs[2], 810, 700, 750, 422);
    const f = fontById(font); g.fillStyle = colour; g.font = `${clampWeight(f, 700)} 120px ${f.css}`; g.fillText(f.id === 'bebas' ? title.toUpperCase() : title, 110, 590);
    await save({ title: `${title} — visual direction`, source: 'Short Film Art Direction', image: c.toDataURL('image/jpeg', 0.9) });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-signal">Creative brief · Night Shift (short film)</p>
        <p className="mt-1 max-w-3xl text-[14px] leading-relaxed text-ink-300">A ten-minute short about a woman finishing a night shift. Define the visual direction: choose a lighting mood for her close-up, decide the emotional intent, grade three shots into one world, and design the title card.</p>
        <div className="mt-3 flex flex-wrap gap-4">
          <div><p className="mb-1 text-[12px] text-ink-400">Lighting mood (on set)</p><Segmented size="sm" value={light} onChange={setLight} options={LIGHTS.map((l, i) => ({ value: i, label: l }))} /></div>
          <div><p className="mb-1 text-[12px] text-ink-400">Emotional intent</p><Segmented size="sm" value={mood} onChange={setMood} options={(Object.keys(MOOD_TEXT) as Mood[]).map((m) => ({ value: m, label: m[0].toUpperCase() + m.slice(1) }))} /></div>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Board light={light} look={look} corr={corr} title={title} font={font} colour={colour} frames={frames} setFrame={setFrame} mainHandle={main} />
        <aside className="space-y-3">
          <div className="space-y-3 rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
            {live && <div className="flex flex-wrap gap-1.5">{live.map((c) => <Badge key={c.label} tone={c.score >= 85 ? 'ok' : c.score >= 50 ? 'warn' : 'bad'}>{c.label} {c.score}</Badge>)}</div>}
            <Hint>Balance the three shots first (per-shot exposure and white balance) until they feel like one place, then build one look for the mood. Title last — pick its colour from the frames.</Hint>
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="primary" onClick={submit}>Present the direction</Button><Button size="sm" variant="ghost" onClick={saveBoard}>Save board to gallery</Button></div>
          </div>
          <ToolSection title="Title card">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 w-full rounded-lg bg-ink-800 px-3 text-[14px] text-ink-50 ring-1 ring-ink-650" aria-label="Film title" />
            <select value={font} onChange={(e) => setFont(e.target.value)} className="mt-2 h-10 w-full rounded-lg bg-ink-800 px-2 text-[13px] text-ink-50 ring-1 ring-ink-650" aria-label="Title typeface">{FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
            <div className="mt-2 flex flex-wrap gap-1.5">{['#FFFFFF', '#F2EEE6', '#111111', '#E0457B', '#7FD1FF', '#E8B04A', ...(frames.every(Boolean) ? extractPalette(frames as Frame[]).map(rgbToHex) : [])].map((c) => <button key={c} onClick={() => setColour(c)} className={cx('h-8 w-8 rounded-full ring-2', colour === c ? 'ring-ink-100' : 'ring-ink-700')} style={{ background: c }} aria-label={`Title colour ${c}`} />)}</div>
          </ToolSection>
          <ToolSection title={`Per-shot balance · ${shots(light)[shot].label}`} right={<Segmented size="sm" value={shot} onChange={setShot} options={[0, 1, 2].map((k) => ({ value: k, label: String(k + 1) }))} />}>
            <WhiteBalancePanel p={shotP} set={setShotP} /><div className="mt-3"><TonePanel p={shotP} set={setShotP} include={['exposure']} /></div>
          </ToolSection>
          <ToolSection title="Shared look · tone & colour"><TonePanel p={look} set={setLookP} include={['contrast', 'highlights', 'shadows']} /><div className="mt-3"><ColourPanel p={look} set={setLookP} /></div></ToolSection>
          <ToolSection title="Shared look · wheels" open={false}><WheelsPanel p={look} set={setLookP} size={100} /></ToolSection>
          <ToolSection title="Shared look · film" open={false}><FilmPanel p={look} set={setLookP} /></ToolSection>
        </aside>
      </div>
    </div>
  );
}
