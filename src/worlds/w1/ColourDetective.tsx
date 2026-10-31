import { useMemo, useState } from 'react';
import { ChallengeBrief, Concepts, Hint, LessonShell, ObserveQuestion, weighted, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Badge, Button, Segmented, Slider, Toggle, cx } from '../../components/ui';
import type { LevelProps } from '../../game/registry';
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl, rgbToLch, temperatureOf, wrapHue, type Temperature } from '../../lib/color';

interface Shape { id: string; name: string; fill: string; el: 'rect' | 'ellipse' | 'path' | 'circle'; a: Record<string, number | string>; c: [number, number] }
interface Comp { id: string; title: string; shapes: Shape[] }

const R = (id: string, name: string, fill: string, x: number, y: number, w: number, h: number, rx = 0): Shape => ({ id, name, fill, el: 'rect', a: { x, y, width: w, height: h, rx }, c: [x + w / 2, y + h / 2] });
const E = (id: string, name: string, fill: string, cx: number, cy: number, rx: number, ry: number): Shape => ({ id, name, fill, el: 'ellipse', a: { cx, cy, rx, ry }, c: [cx, cy] });
const P = (id: string, name: string, fill: string, d: string, c: [number, number]): Shape => ({ id, name, fill, el: 'path', a: { d }, c });

const COMPS: Comp[] = [
  {
    id: 'room', title: 'Living room at dusk', shapes: [
      R('wall', 'Wall', '#A69E95', 0, 0, 600, 300),
      R('window', 'Window', '#3E5F8A', 370, 40, 170, 140, 4),
      R('art1', 'Red print', '#C23B3B', 70, 60, 90, 110, 2),
      R('art2', 'Blue print', '#2F4FA0', 180, 80, 70, 90, 2),
      R('floor', 'Floorboards', '#7A5236', 0, 300, 600, 100),
      E('rug', 'Rug', '#8D8B88', 300, 352, 230, 34),
      R('sofa', 'Sofa', '#B4553A', 50, 205, 270, 90, 18),
      R('cushion', 'Cushion', '#2E8A86', 80, 182, 70, 52, 12),
      P('shade', 'Lamp shade', '#F0A93A', 'M470 190 L540 190 L555 240 L455 240 Z', [505, 215]),
      R('pole', 'Lamp stand', '#2A2A2A', 502, 240, 6, 70),
      R('pot', 'Plant pot', '#D8D4CE', 395, 262, 50, 42, 4),
      E('leaves', 'Leaves', '#3F7A4F', 420, 232, 38, 34),
    ],
  },
  {
    id: 'beach', title: 'Seaside poster', shapes: [
      R('sky', 'Sky', '#8FB8D8', 0, 0, 600, 200),
      { id: 'sun', name: 'Sun', fill: '#F2C14E', el: 'circle', a: { cx: 470, cy: 80, r: 42 }, c: [470, 80] },
      R('sea', 'Sea', '#1F5F7A', 0, 200, 600, 80),
      R('sand', 'Sand', '#D8C3A0', 0, 280, 600, 120),
      P('umbrella', 'Umbrella', '#E04B3A', 'M120 250 Q200 160 280 250 Z', [200, 225]),
      R('pole2', 'Umbrella pole', '#F2EFE8', 197, 248, 6, 90),
      R('towel', 'Towel', '#3A9E8F', 300, 330, 150, 40, 4),
      E('rock', 'Rock', '#6E6A66', 540, 300, 50, 26),
      P('boat', 'Sail', '#F4F2EE', 'M330 195 L330 120 L380 195 Z', [345, 170]),
    ],
  },
  {
    id: 'shelf', title: 'Product shelf', shapes: [
      R('bg', 'Back wall', '#1F2024', 0, 0, 600, 400),
      R('shelf', 'Shelf', '#8A8A86', 0, 300, 600, 22),
      R('b1', 'Orange bottle', '#E26D2F', 70, 140, 70, 160, 14),
      R('b2', 'Blue bottle', '#3E8ED0', 170, 120, 70, 180, 14),
      R('b3', 'Green jar', '#4FA96A', 270, 190, 90, 110, 12),
      R('label', 'Label', '#F2EEE6', 280, 225, 70, 40, 3),
      R('tin', 'Gold tin', '#C9A227', 390, 200, 80, 100, 8),
      R('box', 'Grey box', '#7F858A', 490, 170, 80, 130, 4),
    ],
  },
];

const truthOf = (s: Shape): Temperature => temperatureOf(hexToRgb(s.fill)!);
const accepts = (s: Shape, t: Temperature) => {
  const tr = truthOf(s);
  if (t === tr) return true;
  const C = rgbToLch(hexToRgb(s.fill)!)[1];
  return C >= 10 && C < 16 && (t === 'neutral' || tr === 'neutral');
};
const TAG: Record<Temperature, string> = { warm: '#ff7043', cool: '#42a5f5', neutral: '#9e9e9e' };

function rotate(hex: string, deg: number, sat: number) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex)!);
  return rgbToHex(hslToRgb([wrapHue(h + deg), Math.min(1, s * sat), l]));
}

function Scene({ comp, tags, onTap, map, grey, hueShift = 0, satMul = 1, reveal }: { comp: Comp; tags?: Record<string, Temperature>; onTap?: (id: string) => void; map?: boolean; grey?: boolean; hueShift?: number; satMul?: number; reveal?: boolean }) {
  return (
    <svg viewBox="0 0 600 400" className="w-full rounded-xl" role="img" aria-label={comp.title} style={grey ? { filter: 'grayscale(1)' } : undefined}>
      {comp.shapes.map((s) => {
        const fill = map ? TAG[truthOf(s)] : hueShift || satMul !== 1 ? rotate(s.fill, hueShift, satMul) : s.fill;
        const El = s.el as 'rect';
        return <El key={s.id} {...(s.a as object)} fill={fill} className={onTap ? 'cursor-pointer hover:opacity-90' : undefined} onClick={onTap ? () => onTap(s.id) : undefined} />;
      })}
      {tags && comp.shapes.map((s) => {
        const t = tags[s.id];
        if (!t) return null;
        const ok = reveal ? accepts(s, t) : null;
        return (
          <g key={s.id + 't'} pointerEvents="none">
            <circle cx={s.c[0]} cy={s.c[1]} r={13} fill={TAG[t]} stroke={ok === null ? '#fff' : ok ? '#7bd389' : '#ff4d4d'} strokeWidth={3} />
            <text x={s.c[0]} y={s.c[1] + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#111" fontFamily="Inter Variable, sans-serif">{t[0].toUpperCase()}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function ColourDetective({ level }: LevelProps) {
  return <LessonShell level={level}
    observe={
      <div className="space-y-5">
        <div className="mx-auto max-w-3xl"><Scene comp={COMPS[0]} /></div>
        <ObserveQuestion question="Glance at this room. Which object does your eye land on first?" options={['The lamp shade', 'The window', 'The sofa', 'The rug']}
          reveal={() => <p>Most people land on the <b>lamp</b> or the <b>sofa</b>. Saturated warm colours tend to advance and grab attention; the cool blue window recedes into the distance; the greys and the rug rest quietly. Warm, cool and neutral are tools for steering the eye and setting the temperature of a scene.</p>} />
      </div>
    }
    experiment={<Experiment />}
    discover={
      <Concepts items={[
        { title: 'Warm colours', body: 'Reds, oranges, yellows — the colours of fire and sun. They feel energetic and close, and pull attention forward.' },
        { title: 'Cool colours', body: 'Greens, blues, violets — the colours of sky, water and shade. They feel calm and distant, and recede.' },
        { title: 'Neutrals', body: 'Greys, beiges, black and white with very little colour. They rest, separate and give vivid colours room to work.' },
        { title: 'Temperature is relative', body: 'A green can feel warm next to blue and cool next to orange. Greige can lean warm or cool. Context decides — your eye compares, it doesn’t measure.' },
        { title: 'Atmosphere', body: 'The balance of warm and cool sets the mood of a whole image: mostly warm feels cosy or tense; mostly cool feels calm or lonely.' },
      ]} />
    }
    challenge={(ctx) => <Challenge ctx={ctx} />} />;
}

function Experiment() {
  const [ci, setCi] = useState(0);
  const [map, setMap] = useState(false);
  const [grey, setGrey] = useState(false);
  const [hue, setHue] = useState(0);
  const [sat, setSat] = useState(1);
  const comp = COMPS[ci];
  const counts = comp.shapes.reduce((a, s) => { a[truthOf(s)]++; return a; }, { warm: 0, cool: 0, neutral: 0 } as Record<Temperature, number>);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <Segmented value={ci} onChange={setCi} options={COMPS.map((c, i) => ({ value: i, label: c.title }))} />
        <Scene comp={comp} map={map} grey={grey} hueShift={hue} satMul={sat} />
      </div>
      <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
        <Toggle checked={map} onChange={setMap} label="Temperature map (orange warm · blue cool · grey neutral)" />
        <Toggle checked={grey} onChange={setGrey} label="Greyscale (see value without temperature)" />
        <Slider label="Shift every hue" value={hue} min={-60} max={60} step={1} defaultValue={0} onChange={setHue} format={(v) => `${v > 0 ? '+' : ''}${v}°`} hint="Rotate the whole scene toward warmer or cooler and feel the atmosphere change." />
        <Slider label="Saturation" value={sat} min={0} max={1.5} step={0.01} defaultValue={1} onChange={setSat} format={(v) => `${Math.round(v * 100)}%`} />
        <div className="flex gap-2"><Badge tone="signal">{counts.warm} warm</Badge><Badge>{counts.cool} cool</Badge><Badge tone="outline">{counts.neutral} neutral</Badge></div>
      </div>
    </div>
  );
}

function Challenge({ ctx }: { ctx: ChallengeCtx }) {
  const [ci, setCi] = useState(0);
  const [mode, setMode] = useState<Temperature>('warm');
  const [tags, setTags] = useState<Record<string, Record<string, Temperature>>>({});
  const comp = COMPS[ci];
  const t = tags[comp.id] ?? {};
  const tagged = useMemo(() => COMPS.reduce((a, c) => a + Object.keys(tags[c.id] ?? {}).length, 0), [tags]);
  const total = COMPS.reduce((a, c) => a + c.shapes.length, 0);
  const tap = (id: string) => setTags((all) => ({ ...all, [comp.id]: { ...(all[comp.id] ?? {}), [id]: mode } }));
  const submit = () => {
    const criteria = COMPS.map((c) => {
      const tg = tags[c.id] ?? {};
      const correct = c.shapes.filter((s) => tg[s.id] && accepts(s, tg[s.id])).length;
      return { label: c.title, score: Math.round((correct / c.shapes.length) * 100), weight: 1, detail: `${correct} of ${c.shapes.length} regions classified correctly.` };
    });
    const misses = COMPS.flatMap((c) => c.shapes.filter((s) => !(tags[c.id]?.[s.id] && accepts(s, tags[c.id][s.id]))).map((s) => `${c.title}: ${s.name} reads as ${truthOf(s)} (${rgbToHex(hexToRgb(s.fill)!)}, chroma ${rgbToLch(hexToRgb(s.fill)!)[1].toFixed(0)}).`));
    ctx.submit({
      score: weighted(criteria), criteria, worked: criteria.filter((c) => c.score === 100).map((c) => `${c.label}: every region right.`), improve: misses.slice(0, 6),
      why: 'Seeing temperature quickly is the first step in reading any image: it tells you where the light is, where the eye will go, and what mood the palette sets. The answers here come from measured CIELAB hue and chroma; borderline colours accept either answer.',
      visual: <div className="grid gap-3 md:grid-cols-3">{COMPS.map((c) => <Scene key={c.id} comp={c} tags={tags[c.id] ?? {}} reveal />)}</div>,
    });
  };
  return (
    <div>
      <ChallengeBrief title="Tag every region as warm, cool or neutral" aside={<div className="flex flex-wrap gap-2">{COMPS.map((c, k) => <Button key={c.id} size="sm" variant={k === ci ? 'primary' : 'secondary'} onClick={() => setCi(k)}>{k + 1}. {c.title}</Button>)}</div>}>
        Choose a tag, then tap regions in the picture. {total} regions across three images. Ground truth comes from measured hue and chroma; genuinely borderline colours accept two answers.
      </ChallengeBrief>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Scene comp={comp} tags={t} onTap={tap} />
        <div className="space-y-4 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <Segmented value={mode} onChange={setMode} label="Tag" options={[{ value: 'warm', label: '● Warm' }, { value: 'cool', label: '● Cool' }, { value: 'neutral', label: '● Neutral' }]} />
          <ul className="max-h-72 space-y-1 overflow-auto pr-1 text-[13px] vl-scroll">
            {comp.shapes.map((s) => (
              <li key={s.id}>
                <button onClick={() => tap(s.id)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-ink-800">
                  <span className="flex items-center gap-2 text-ink-200"><span className="h-4 w-4 rounded" style={{ background: s.fill }} />{s.name}</span>
                  {t[s.id] ? <span className={cx('rounded-full px-2 text-[11px] font-medium text-ink-950')} style={{ background: TAG[t[s.id]] }}>{t[s.id]}</span> : <span className="text-[11px] text-ink-500">untagged</span>}
                </button>
              </li>
            ))}
          </ul>
          <Hint>Squint: if a colour almost disappears into grey, it is probably neutral. Then ask whether it leans toward fire (warm) or water (cool).</Hint>
          <div className="flex items-center gap-3"><Button variant="primary" onClick={submit}>Submit tags</Button><span className="text-[12px] text-ink-400">{tagged}/{total} tagged</span></div>
        </div>
      </div>
    </div>
  );
}
