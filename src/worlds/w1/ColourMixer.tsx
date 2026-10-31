import { useMemo, useState } from 'react';
import { ColourPicker } from '../../components/color/ColourPicker';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx, type Criterion } from '../../components/lesson/LessonShell';
import { Badge, Button, Eyebrow, Meter, Note, cx } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import {
  deltaE2000, describeDeltaE, diagnoseDifference, errorToScore, hexToRgb, hueName, rgbToHex, rgbToHsl, rgbToLab, rgbToLch, rgbToOklch, temperatureOf, to255, type RGB,
} from '../../lib/color';
import { hashString, mulberry32, shuffle } from '../../lib/random';
import type { Difficulty } from '../../state/progress';

const POOLS: Record<Difficulty, [string, string][]> = {
  beginner: [['Signal Orange', '#E8622C'], ['Ultramarine', '#2E46C8'], ['Leaf Green', '#4C9A3A'], ['Lemon', '#F2D33C'], ['Fuchsia', '#C2378F'], ['Teal', '#1E8C8C']],
  intermediate: [['Sage', '#8A9A7B'], ['Dusty Rose', '#C99A9E'], ['Slate Blue', '#5A6B8D'], ['Ochre', '#C49A45'], ['Terracotta', '#B5603F'], ['Plum', '#6E4A6B']],
  advanced: [['Warm Greige', '#B5AA9C'], ['Cool Grey', '#8E949B'], ['Champagne', '#E6D3B3'], ['Taupe', '#7D7166'], ['Mist', '#C5CCC9'], ['Mushroom', '#A39587']],
};
const TOL: Record<Difficulty, [number, number]> = { beginner: [2, 25], intermediate: [1.5, 20], advanced: [1, 15] };

const rgb = (h: string) => hexToRgb(h)!;
const fmt = (n: number, d = 0) => n.toFixed(d);

export default function ColourMixer({ level }: LevelProps) {
  return (
    <LessonShell
      level={level}
      observe={<Observe />}
      experiment={<Experiment />}
      discover={<Discover />}
      challenge={(ctx) => <Challenge ctx={ctx} />}
    />
  );
}

// ------------------------------------------------------------------ observe

function Observe() {
  // Both pairs differ by exactly 22 units in one RGB channel — the same "distance" in RGB numbers.
  const pairs = useMemo(() => {
    const a: [RGB, RGB] = [rgb('#1D2F9E'), rgb('#1D2FB4')];
    const b: [RGB, RGB] = [rgb('#7C8A7C'), rgb('#7CA07C')];
    return [a, b].map(([x, y]) => ({ x, y, dE: deltaE2000(rgbToLab(x), rgbToLab(y)) }));
  }, []);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="grid grid-cols-2 gap-4 rounded-2xl bg-[#777] p-6">
        {pairs.map((p, i) => (
          <figure key={i}>
            <div className="flex h-56 overflow-hidden rounded-lg sm:h-72">
              <div className="flex-1" style={{ background: rgbToHex(p.x) }} />
              <div className="flex-1" style={{ background: rgbToHex(p.y) }} />
            </div>
            <figcaption className="mt-2 text-center font-display text-[18px] text-[#111]">Pair {i === 0 ? 'A' : 'B'}</figcaption>
          </figure>
        ))}
      </div>
      <ObserveQuestion
        question="Which pair shows the bigger difference between its two halves?"
        options={['Pair A — the blues', 'Pair B — the greens', 'They look equally different']}
        reveal={() => (
          <div className="space-y-3">
            <p>Here is the twist: in both pairs, exactly one RGB channel changes by <b>22 units</b>. To the computer, they are equally different.</p>
            <p>Your eye disagrees. Measured with CIEDE2000, a model of human perception, Pair A differs by <b>ΔE {fmt(pairs[0].dE, 1)}</b> and Pair B by <b>ΔE {fmt(pairs[1].dE, 1)}</b>.</p>
            <p className="text-ink-400">That is why this lab scores colour matches with ΔE, not RGB arithmetic. Most people find Pair B far more obvious: we are much more sensitive to changes around greens and mid-tones than within deep blues.</p>
          </div>
        )}
      />
    </div>
  );
}

// ------------------------------------------------------------------ experiment

function Readouts({ c }: { c: RGB }) {
  const [h, s, l] = rgbToHsl(c);
  const lab = rgbToLab(c);
  const [, C, hab] = rgbToLch(c);
  const ok = rgbToOklch(c);
  const rows: [string, string][] = [
    ['HEX', rgbToHex(c)],
    ['RGB', c.map(to255).join(' · ')],
    ['HSL', `${fmt(h)}° · ${fmt(s * 100)}% · ${fmt(l * 100)}%`],
    ['CIELAB', `L* ${fmt(lab[0], 1)} · a* ${fmt(lab[1], 1)} · b* ${fmt(lab[2], 1)}`],
    ['LCh', `L* ${fmt(lab[0], 1)} · C* ${fmt(C, 1)} · h ${fmt(hab)}°`],
    ['OkLCh', `${fmt(ok[0] * 100, 1)}% · ${fmt(ok[1], 3)} · ${fmt(ok[2])}°`],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents"><dt className="text-ink-500">{k}</dt><dd className="num font-mono text-ink-200">{v}</dd></div>
      ))}
    </dl>
  );
}

function AdditiveLight({ c }: { c: RGB }) {
  return (
    <svg viewBox="0 0 200 170" className="h-40 w-full" role="img" aria-label="Your colour as three overlapping beams of red, green and blue light">
      <rect width="200" height="170" fill="#000" rx="12" />
      <g style={{ mixBlendMode: 'screen' }}>
        <circle cx="78" cy="68" r="46" fill={`rgb(${to255(c[0])},0,0)`} style={{ mixBlendMode: 'screen' }} />
        <circle cx="122" cy="68" r="46" fill={`rgb(0,${to255(c[1])},0)`} style={{ mixBlendMode: 'screen' }} />
        <circle cx="100" cy="106" r="46" fill={`rgb(0,0,${to255(c[2])})`} style={{ mixBlendMode: 'screen' }} />
      </g>
    </svg>
  );
}

function Experiment() {
  const [c, setC] = useState<RGB>(rgb('#C8643C'));
  const temp = temperatureOf(c);
  const name = hueName(rgbToLch(c)[2]);
  return (
    <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
      <div className="rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
        <ColourPicker value={c} onChange={setC} wheelSize={240} />
      </div>
      <div className="space-y-5">
        <div className="overflow-hidden rounded-2xl ring-1 ring-ink-750">
          <div className="h-44" style={{ background: rgbToHex(c) }} />
          <div className="grid gap-4 bg-ink-850 p-5 sm:grid-cols-2">
            <div>
              <p className="font-display text-[22px] capitalize text-ink-50">{rgbToLch(c)[1] < 6 ? 'a neutral' : `a ${name}`}</p>
              <p className="mb-3 text-[12px] text-ink-400">Reads as <b className="text-ink-200">{temp}</b>. {describeTemp(temp)}</p>
              <Readouts c={c} />
            </div>
            <div>
              <Eyebrow className="mb-2">The same colour as light</Eyebrow>
              <AdditiveLight c={c} />
              <p className="mt-2 text-[12px] leading-relaxed text-ink-400">Screens make colour by adding red, green and blue light. Where all three overlap at full strength you get white.</p>
            </div>
          </div>
        </div>
        <Note>Try this: keep Hue fixed and drag Lightness from 0 to 100%. Watch how “saturation 100%” stops meaning “vivid” near black and white. HSL is a convenient geometry for numbers, not a model of perception.</Note>
      </div>
    </div>
  );
}
const describeTemp = (t: string) => (t === 'warm' ? 'Warm colours feel closer and more energetic.' : t === 'cool' ? 'Cool colours feel calmer and further away.' : 'Neutrals let other colours lead.');

// ------------------------------------------------------------------ discover

function Discover() {
  const strip = (stops: string[]) => <div className="h-16" style={{ background: `linear-gradient(to right, ${stops.join(',')})` }} />;
  return (
    <Concepts
      items={[
        { title: 'Hue', body: 'The colour family — red, orange, green, blue — measured as an angle around the wheel. Rotating hue changes what colour it is, not how strong or light it is.', visual: strip(['#f00', '#ff0', '#0f0', '#0ff', '#00f', '#f0f', '#f00']) },
        { title: 'Saturation', body: 'How pure or intense the colour is, from grey to vivid. Designers often call perceptual saturation “chroma”. Low-chroma colours feel sophisticated; high-chroma colours shout.', visual: strip(['#8a7f78', '#c8643c']) },
        { title: 'Lightness', body: 'How close to black or white. Lightness carries most of an image’s structure: if a design still works in greyscale, its hierarchy is sound.', visual: strip(['#000', '#c8643c', '#fff']) },
        { title: 'RGB is light', body: 'Screens add red, green and blue light; 0–255 per channel in 8-bit. RGB numbers describe instructions to a display, not how big a difference looks to you.', visual: <div className="flex h-16">{['#f00', '#0f0', '#00f'].map((x) => <div key={x} className="flex-1" style={{ background: x }} />)}</div> },
        { title: 'HEX', body: 'RGB written in base 16: #C8643C means red C8 (200), green 64 (100), blue 3C (60). Two characters per channel. It is a shorthand, not a different colour space.', visual: <p className="grid h-16 place-items-center font-mono text-[22px] text-ink-100"><span><span className="text-[#ff6b6b]">C8</span><span className="text-[#6bdc7a]">64</span><span className="text-[#7aa2ff]">3C</span></span></p> },
        { title: 'ΔE 2000', body: 'A perceptual colour difference. Under 1: invisible to most people. 2–3.5: visible at a glance to a trained eye. Over 5: clearly different. Viewing conditions and your screen still matter.', visual: <div className="flex h-16">{['#c8643c', '#c9663f', '#cc6a45', '#d0754f', '#d6865f'].map((x) => <div key={x} className="flex-1" style={{ background: x }} />)}</div> },
      ]}
    />
  );
}

// ------------------------------------------------------------------ challenge

interface Round { name: string; target: RGB }

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const d = ctx.difficulty;
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const rounds: Round[] = useMemo(() => {
    const rng = mulberry32(hashString(d + seed));
    return shuffle(rng, POOLS[d]).slice(0, 3).map(([name, hex]) => ({ name, target: rgb(hex) }));
  }, [d, seed]);
  const [picks, setPicks] = useState<RGB[]>(() => [0, 1, 2].map(() => [0.5, 0.5, 0.5] as RGB));
  const [i, setI] = useState(0);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [full, zero] = TOL[d];
  const round = rounds[i];
  const pick = picks[i];
  const diag = diagnoseDifference(round.target, pick);
  const showLive = d === 'beginner';
  const showCheck = d !== 'advanced';

  const submit = () => {
    const results = rounds.map((r, k) => ({ r, dg: diagnoseDifference(r.target, picks[k]), pick: picks[k] }));
    const criteria: Criterion[] = results.map(({ r, dg }) => ({
      label: r.name,
      score: errorToScore(dg.dE, full, zero),
      weight: 1,
      detail: `ΔE00 ${dg.dE.toFixed(2)} — ${describeDeltaE(dg.dE)}. ΔL* ${dg.dL >= 0 ? '+' : ''}${dg.dL.toFixed(1)}, ΔC* ${dg.dC >= 0 ? '+' : ''}${dg.dC.toFixed(1)}, Δh ${dg.dH >= 0 ? '+' : ''}${dg.dH.toFixed(0)}°`,
    }));
    const worked: string[] = [];
    const improve: string[] = [];
    for (const { r, dg } of results) {
      if (dg.dE < full) worked.push(`${r.name}: practically indistinguishable (ΔE ${dg.dE.toFixed(2)}).`);
      else if (Math.abs(dg.dL) < 2) worked.push(`${r.name}: lightness is spot-on — the hardest dimension for most beginners.`);
      if (dg.dE >= full) improve.push(`${r.name}: ${dg.notes.join(' ')}`);
    }
    const best = Math.min(...results.map((x) => x.dg.dE));
    ctx.submit({
      score: weighted(criteria),
      criteria,
      worked,
      improve,
      why: 'Professionals judge colour in three separate moves: first lightness (squint), then chroma (is it duller or more vivid?), then hue (which way does it lean?). Fixing them in that order is much faster than nudging RGB sliders at random.',
      meta: { bestDeltaE: best },
      visual: (
        <div className="grid gap-3 sm:grid-cols-3">
          {results.map(({ r, pick, dg }) => (
            <figure key={r.name}>
              <div className="flex h-24 overflow-hidden rounded-lg">
                <div className="flex-1" style={{ background: rgbToHex(r.target) }} />
                <div className="flex-1" style={{ background: rgbToHex(pick) }} />
              </div>
              <figcaption className="mt-1.5 flex justify-between text-[12px] text-ink-300"><span>{r.name} · target | yours</span><span className="num font-mono">ΔE {dg.dE.toFixed(2)}</span></figcaption>
            </figure>
          ))}
        </div>
      ),
    });
  };

  return (
    <div>
      <ChallengeBrief
        title="Recreate three colours from the studio swatch book"
        aside={<Button variant="ghost" size="sm" onClick={() => { setSeed(Math.floor(Math.random() * 1e9)); setPicks([0, 1, 2].map(() => [0.5, 0.5, 0.5] as RGB)); setI(0); setChecked({}); }}>New targets</Button>}
      >
        Mix each target using any controls you like. Matches are scored with CIEDE2000: full marks under ΔE {full}, falling to zero at ΔE {zero} ({d} tolerance).
        {d === 'advanced' && ' Advanced: no live meter and no checks — trust your eye.'}
      </ChallengeBrief>

      <div className="mb-4 flex flex-wrap gap-2">
        {rounds.map((r, k) => (
          <button key={r.name} onClick={() => setI(k)} className={cx('flex h-11 items-center gap-2 rounded-full pr-4 pl-1.5 text-[13px] ring-1', k === i ? 'bg-ink-100 text-ink-950 ring-ink-100' : 'text-ink-300 ring-ink-600 hover:ring-ink-300')}>
            <span className="h-8 w-8 rounded-full ring-1 ring-black/20" style={{ background: rgbToHex(r.target) }} />
            {k + 1}. {r.name}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl bg-[#767676] p-5 sm:p-8">
          <div className="flex h-64 overflow-hidden rounded-lg sm:h-80" role="img" aria-label={`Target ${round.name} beside your mix`}>
            <div className="flex flex-1 items-end p-3" style={{ background: rgbToHex(round.target) }}><span className="rounded-full bg-black/35 px-2 py-0.5 text-[11px] text-white">Target · {round.name}</span></div>
            <div className="flex flex-1 items-end justify-end p-3" style={{ background: rgbToHex(pick) }}><span className="rounded-full bg-black/35 px-2 py-0.5 text-[11px] text-white">Your mix</span></div>
          </div>
          <p className="mt-3 text-center text-[11.5px] text-[#1a1a1a]">Shown on a neutral mid-grey surround, as in a colour-matching booth.</p>
        </div>
        <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <ColourPicker value={pick} onChange={(c) => setPicks((ps) => ps.map((p, k) => (k === i ? c : p)))} wheelSize={200} />
          {(showLive || checked[i]) && (
            <div className="rounded-xl bg-ink-800 p-3.5 ring-1 ring-ink-700">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-ink-200">ΔE00 <b className="num font-mono text-ink-50">{diag.dE.toFixed(2)}</b></span>
                <span className="text-[12px] text-ink-400">{describeDeltaE(diag.dE)}</span>
              </div>
              <Meter value={errorToScore(diag.dE, full, zero)} className="mt-2" />
              {showLive && <ul className="mt-2 space-y-0.5 text-[12.5px] text-ink-300">{diag.notes.map((n) => <li key={n}>— {n}</li>)}</ul>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {showCheck && !showLive && <Button size="sm" onClick={() => setChecked((c) => ({ ...c, [i]: true }))}>Check this match</Button>}
            {i < 2 ? <Button size="sm" onClick={() => setI(i + 1)}>Next target →</Button> : null}
            <Button size="sm" variant="primary" onClick={submit}>Submit all three</Button>
            <Badge tone="outline">{ctx.attempts.length ? `Attempt ${ctx.attempts.length + 1}` : 'First attempt'}</Badge>
          </div>
          <Hint>
            Squint until the two halves blur. If one side looks heavier, fix lightness first. Then ask: is mine duller or louder? Only then rotate the hue — {round.name} sits around {Math.round(rgbToHsl(round.target)[0] / 10) * 10}° on this wheel.
          </Hint>
        </div>
      </div>
    </div>
  );
}
