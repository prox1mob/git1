import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { GradeCanvas, type GradeHandle } from '../../components/grading/GradeCanvas';
import { ColourPicker } from '../../components/color/ColourPicker';
import { Button, Eyebrow, Segmented, Slider, Toggle, cx } from '../../components/ui';
import type { Frame } from '../../engine/GradeEngine';
import { defaultParams, type GradeParams, type SourceSpec } from '../../engine/params';
import { contrastRatio, hexToRgb, rgbToHex, rgbToHsl, rgbToLch, type RGB } from '../../lib/color';
import { clampWeight, fontById, FONTS } from '../../lib/fonts';
import { useElementWidth } from '../../lib/hooks';

export type Role = 'masthead' | 'headline' | 'kicker' | 'standfirst' | 'body' | 'caption' | 'cta' | 'credit' | 'logo';
export interface TextLayer {
  id: string; role: Role; label: string; text: string;
  font: string; size: number; weight: number; color: string;
  x: number; y: number; w: number;
  align: 'left' | 'center' | 'right'; caps: boolean; tracking: number; leading: number; italic?: boolean;
}
export interface ImageSlot { source: SourceSpec; rect: [number, number, number, number]; params: GradeParams; behindHead?: boolean }
export interface Composition { width: number; height: number; bg: string; image?: ImageSlot; layers: TextLayer[]; grid?: { cols: number; margin: number; gutter: number } }

export const LOOKS: { id: string; label: string; params: Partial<GradeParams> }[] = [
  { id: 'natural', label: 'Natural', params: {} },
  { id: 'warm', label: 'Warm film', params: { temp: 5200, contrast: -0.1, fade: 0.45, grain: 0.3, gain: { x: -0.2, y: 0.2, m: 0 } } },
  { id: 'cool', label: 'Cool editorial', params: { temp: 8200, contrast: 0.2, saturation: 0.85, lift: { x: 0.25, y: -0.15, m: 0 } } },
  { id: 'moody', label: 'Moody', params: { exposure: -0.5, contrast: 0.35, saturation: 0.75, lift: { x: 0.35, y: -0.3, m: -0.05 }, vignette: 0.5 } },
  { id: 'mono', label: 'Black & white', params: { saturation: 0, contrast: 0.3 } },
];

/** Measured, rendering-independent facts about a composition, shared by every rubric. */
export interface LayerFacts { layer: TextLayer; rect: [number, number, number, number]; under: RGB; contrast: number; subjectOverlap: number; outsideMargin: boolean; busy: number }
export interface CompositionFacts { layers: LayerFacts[]; overlaps: number; leftEdges: number; coverage: number; imageDominant: RGB | null }

const toRgb = (h: string) => hexToRgb(h) ?? [0, 0, 0];

export function compositionFacts(c: Composition, heights: Record<string, number>, img: Frame | null, mask: Frame | null): CompositionFacts {
  const margin = c.grid?.margin ?? 32;
  const sample = (f: Frame, x0: number, y0: number, x1: number, y1: number) => {
    // page → frame coordinates through the image rect
    const [ix, iy, iw, ih] = c.image!.rect;
    const fx0 = Math.max(0, Math.floor(((x0 - ix) / iw) * f.width)), fx1 = Math.min(f.width - 1, Math.ceil(((x1 - ix) / iw) * f.width));
    const fy0 = Math.max(0, Math.floor(((y0 - iy) / ih) * f.height)), fy1 = Math.min(f.height - 1, Math.ceil(((y1 - iy) / ih) * f.height));
    let r = 0, g = 0, b = 0, n = 0, l2 = 0;
    for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) {
      const i = (y * f.width + x) * 4;
      r += f.data[i]; g += f.data[i + 1]; b += f.data[i + 2];
      const L = 0.2126 * f.data[i] + 0.7152 * f.data[i + 1] + 0.0722 * f.data[i + 2];
      l2 += L * L; n++;
    }
    if (!n) return null;
    const mean: RGB = [r / n / 255, g / n / 255, b / n / 255];
    const Lm = (0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2]) * 255;
    return { mean, std: Math.sqrt(Math.max(0, l2 / n - Lm * Lm)) / 255, n, fill: mean[0] };
  };
  const layers: LayerFacts[] = c.layers.map((L) => {
    const h = heights[L.id] ?? L.size * L.leading;
    const rect: [number, number, number, number] = [L.x, L.y, L.w, h];
    let under: RGB = toRgb(c.bg), busy = 0, overlap = 0;
    if (c.image && img) {
      const [ix, iy, iw, ih] = c.image.rect;
      const x0 = Math.max(L.x, ix), y0 = Math.max(L.y, iy), x1 = Math.min(L.x + L.w, ix + iw), y1 = Math.min(L.y + h, iy + ih);
      if (x1 > x0 && y1 > y0) {
        const s = sample(img, x0, y0, x1, y1);
        const frac = ((x1 - x0) * (y1 - y0)) / Math.max(1, L.w * h);
        if (s) { under = under.map((v, k) => v * (1 - frac) + s.mean[k] * frac) as RGB; busy = s.std * frac; }
        if (mask) { const m = sample(mask, x0, y0, x1, y1); if (m) overlap = m.fill * frac; }
      }
    }
    const outside = L.x < margin - 1 || L.y < margin - 1 || L.x + L.w > c.width - margin + 1 || L.y + h > c.height - margin + 1;
    return { layer: L, rect, under, contrast: contrastRatio(toRgb(L.color), under), subjectOverlap: overlap, outsideMargin: outside, busy };
  });
  let overlaps = 0;
  for (let i = 0; i < layers.length; i++) for (let j = i + 1; j < layers.length; j++) {
    const a = layers[i].rect, b = layers[j].rect;
    const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]), h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
    if (w > 2 && h > 2) overlaps++;
  }
  const lefts = new Set(c.layers.filter((l) => l.align === 'left').map((l) => Math.round(l.x / 6)));
  const coverage = layers.reduce((a, l) => a + l.rect[2] * l.rect[3], 0) / (c.width * c.height);
  let dom: RGB | null = null;
  if (img) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < img.data.length; i += 16) { r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++; }
    dom = [r / n / 255, g / n / 255, b / n / 255];
  }
  return { layers, overlaps, leftEdges: lefts.size, coverage, imageDominant: dom };
}

// ------------------------------------------------------------------ view

function layerStyle(L: TextLayer): CSSProperties {
  const f = fontById(L.font);
  return {
    position: 'absolute', left: L.x, top: L.y, width: L.w,
    fontFamily: f.css, fontSize: L.size, fontWeight: clampWeight(f, L.weight), color: L.color, textAlign: L.align,
    textTransform: L.caps ? 'uppercase' : 'none', letterSpacing: `${L.tracking / 1000}em`, lineHeight: L.leading, fontStyle: L.italic ? 'italic' : 'normal', whiteSpace: 'pre-wrap',
  };
}

export interface ComposerHandle { image: GradeHandle | null; heights: Record<string, number>; frame: Frame | null; cutout: string | null }

export function Composer({ comp, setComp, palette = [], onFacts, sidebarTop, sidebarBottom, handleRef, imageControls = true, gridToggle = true, lockedText = false, viewOnly = false }: {
  comp: Composition; setComp: (c: Composition) => void; palette?: string[]; onFacts?: (f: CompositionFacts) => void; sidebarTop?: ReactNode; sidebarBottom?: ReactNode;
  handleRef?: { current: ComposerHandle | null }; imageControls?: boolean; gridToggle?: boolean; lockedText?: boolean; viewOnly?: boolean;
}) {
  const [wrapRef, wrapW] = useElementWidth<HTMLDivElement>();
  const [sel, setSel] = useState<string | null>(viewOnly ? null : comp.layers[0]?.id ?? null);
  const [showGrid, setShowGrid] = useState(!viewOnly);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [mask, setMask] = useState<Frame | null>(null);
  const [cutout, setCutout] = useState<string | null>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const imgHandle = useRef<GradeHandle>(null);
  const layerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const scale = wrapW ? Math.min(1, wrapW / comp.width) : 0.4;
  const grid = comp.grid;
  const colX = useMemo(() => {
    if (!grid) return [] as number[];
    const live = comp.width - grid.margin * 2;
    const cw = (live - grid.gutter * (grid.cols - 1)) / grid.cols;
    return Array.from({ length: grid.cols }, (_, i) => grid.margin + i * (cw + grid.gutter));
  }, [grid, comp.width]);

  // measure layer heights (layout-dependent) in page units
  useLayoutEffect(() => {
    const h: Record<string, number> = {};
    for (const L of comp.layers) { const el = layerRefs.current[L.id]; if (el) h[L.id] = el.offsetHeight; }
    if (JSON.stringify(h) !== JSON.stringify(heights)) setHeights(h);
  });

  // subject mask (for overlap checks and the behind-the-head masthead)
  const imgKey = comp.image ? JSON.stringify(comp.image.source) + comp.image.rect.join(',') : '';
  useEffect(() => {
    if (!comp.image) return;
    const t = setTimeout(() => setMask(imgHandle.current?.mask(320) ?? null), 400);
    return () => clearTimeout(t);
  }, [imgKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const paramsKey = comp.image ? JSON.stringify(comp.image.params) : '';
  useEffect(() => {
    if (!comp.image?.behindHead) { setCutout(null); return; }
    const t = setTimeout(async () => {
      const h = imgHandle.current;
      const snap = h?.snapshot('image/png');
      const m = h?.mask(640);
      if (!snap || !m) return;
      const img = new Image();
      img.src = snap;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = m.width; c.height = m.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, m.width, m.height);
      const id = ctx.getImageData(0, 0, m.width, m.height);
      for (let i = 0; i < id.data.length; i += 4) id.data[i + 3] = m.data[i];
      ctx.putImageData(id, 0, 0);
      setCutout(c.toDataURL('image/png'));
    }, 350);
    return () => clearTimeout(t);
  }, [comp.image?.behindHead, paramsKey, imgKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const facts = useMemo(() => compositionFacts(comp, heights, frame, mask), [comp, heights, frame, mask]);
  useEffect(() => { onFacts?.(facts); }, [facts]); // eslint-disable-line react-hooks/exhaustive-deps
  if (handleRef) handleRef.current = { image: imgHandle.current, heights, frame, cutout };

  const update = (id: string, p: Partial<TextLayer>) => setComp({ ...comp, layers: comp.layers.map((l) => (l.id === id ? { ...l, ...p } : l)) });
  const snapX = (x: number, w: number) => {
    if (!grid || !colX.length) return Math.round(x);
    let best = colX[0], bd = 1e9;
    for (const cx_ of colX) { const d = Math.abs(cx_ - x); if (d < bd) { bd = d; best = cx_; } }
    const right = comp.width - grid.margin;
    return bd < 18 ? best : Math.abs(x + w - right) < 18 ? right - w : Math.round(x);
  };
  const toPage = (e: RPointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; };
  const onKey = (e: KeyboardEvent) => {
    if (!sel) return;
    const L = comp.layers.find((l) => l.id === sel)!;
    const s = e.shiftKey ? 10 : 1;
    const d: Record<string, [number, number]> = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] };
    if (!d[e.key]) return;
    e.preventDefault();
    update(sel, { x: L.x + d[e.key][0], y: L.y + d[e.key][1] });
  };
  const selected = comp.layers.find((l) => l.id === sel) ?? null;
  const swatches = Array.from(new Set(['#111111', '#FFFFFF', '#F4F2ED', ...palette, ...(facts.imageDominant ? [rgbToHex(facts.imageDominant)] : [])]));

  return (
    <div className={cx('grid min-w-0 gap-5', !viewOnly && 'xl:grid-cols-[minmax(0,1fr)_380px]', viewOnly && 'pointer-events-none')}>
      <div className="min-w-0">
        <div ref={wrapRef} className="w-full min-w-0">
          <div className="relative mx-auto overflow-hidden rounded-sm shadow-2xl shadow-black/60" style={{ width: comp.width * scale, height: comp.height * scale }}>
            <div
              tabIndex={0}
              role="application"
              aria-label="Composition canvas. Drag text layers; arrow keys nudge the selected layer."
              onKeyDown={onKey}
              className="absolute top-0 left-0 origin-top-left outline-none"
              style={{ width: comp.width, height: comp.height, transform: `scale(${scale})`, background: comp.bg }}
              onPointerDown={(e) => {
                const p = toPage(e);
                const hit = [...comp.layers].reverse().find((l) => p.x >= l.x && p.x <= l.x + l.w && p.y >= l.y && p.y <= l.y + (heights[l.id] ?? l.size));
                if (hit) { setSel(hit.id); drag.current = { id: hit.id, dx: p.x - hit.x, dy: p.y - hit.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
                else setSel(null);
              }}
              onPointerMove={(e) => {
                if (!drag.current || !e.buttons) return;
                const p = toPage(e);
                const L = comp.layers.find((l) => l.id === drag.current!.id)!;
                update(L.id, { x: snapX(p.x - drag.current.dx, L.w), y: Math.round((p.y - drag.current.dy) / 4) * 4 });
              }}
              onPointerUp={() => { drag.current = null; }}
            >
              {comp.image && (
                <div className="pointer-events-none absolute" style={{ left: comp.image.rect[0], top: comp.image.rect[1], width: comp.image.rect[2], height: comp.image.rect[3] }}>
                  <GradeCanvas ref={imgHandle} source={comp.image.source} params={comp.image.params} aspect={comp.image.rect[2] / comp.image.rect[3]} onAnalysis={setFrame} analysisWidth={240} rounded={false} label="Photograph" maxPixels={1_400_000} />
                </div>
              )}
              {showGrid && grid && colX.map((x, i) => (
                <div key={i} className="pointer-events-none absolute top-0 bottom-0 bg-[#ff5b3a]/[0.07]" style={{ left: x, width: (comp.width - grid.margin * 2 - grid.gutter * (grid.cols - 1)) / grid.cols }} />
              ))}
              {showGrid && grid && <div className="pointer-events-none absolute border border-dashed border-[#ff5b3a]/50" style={{ left: grid.margin, top: grid.margin, right: grid.margin, bottom: grid.margin }} />}
              {comp.layers.map((L) => (
                <div key={L.id} ref={(el) => { layerRefs.current[L.id] = el; }} style={{ ...layerStyle(L), zIndex: L.role === 'masthead' ? 1 : 3 }}
                  className={cx('cursor-move select-none', sel === L.id && 'outline outline-2 outline-offset-2 outline-[#ff5b3a]')}>
                  {L.text}
                </div>
              ))}
              {cutout && comp.image && <img src={cutout} alt="" className="pointer-events-none absolute" style={{ left: comp.image.rect[0], top: comp.image.rect[1], width: comp.image.rect[2], height: comp.image.rect[3], zIndex: 2 }} />}
            </div>
          </div>
        </div>
        {!viewOnly && <div className="mt-3 flex flex-wrap items-center gap-4">
          {gridToggle && grid && <Toggle checked={showGrid} onChange={setShowGrid} label="Show grid & margins" />}
          {comp.image && <Toggle checked={!!comp.image.behindHead} onChange={(v) => setComp({ ...comp, image: { ...comp.image!, behindHead: v } })} label="Masthead behind the subject" />}
          <span className="text-[12px] text-ink-500">Drag text to place it. Layers snap to columns.</span>
        </div>}
      </div>
      {!viewOnly && <aside className="space-y-3">
        {sidebarTop}
        <div className="rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
          <Eyebrow className="mb-2">Layers</Eyebrow>
          <div className="flex flex-wrap gap-1.5">{comp.layers.map((l) => <button key={l.id} onClick={() => setSel(l.id)} className={cx('h-8 rounded-full px-3 text-[12px] ring-1', sel === l.id ? 'bg-ink-100 text-ink-950 ring-ink-100' : 'text-ink-300 ring-ink-600')}>{l.label}</button>)}</div>
        </div>
        {selected && (
          <div className="space-y-3 rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
            {!lockedText && <textarea value={selected.text} onChange={(e) => update(selected.id, { text: e.target.value })} rows={selected.role === 'body' ? 4 : 2} className="w-full rounded-lg bg-ink-800 p-2.5 text-[13px] text-ink-50 ring-1 ring-ink-650 outline-none focus:ring-ink-300" aria-label="Layer text" />}
            <select value={selected.font} onChange={(e) => update(selected.id, { font: e.target.value, weight: clampWeight(fontById(e.target.value), selected.weight) })} className="h-10 w-full rounded-lg bg-ink-800 px-2 text-[13px] text-ink-50 ring-1 ring-ink-650" aria-label="Typeface">
              {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <Slider label="Size" value={selected.size} min={6} max={220} step={1} onChange={(size) => update(selected.id, { size })} format={(v) => `${v}`} />
            <Slider label="Weight" value={selected.weight} min={100} max={900} step={100} onChange={(weight) => update(selected.id, { weight })} format={(v) => `${clampWeight(fontById(selected.font), v)}`} />
            <Slider label="Width" value={selected.w} min={40} max={comp.width} step={2} onChange={(w) => update(selected.id, { w })} format={(v) => `${v}`} />
            <Slider label="Tracking" value={selected.tracking} min={-60} max={300} step={5} onChange={(tracking) => update(selected.id, { tracking })} format={(v) => `${v > 0 ? '+' : ''}${v}`} defaultValue={0} />
            <Slider label="Leading" value={selected.leading} min={0.75} max={2} step={0.01} onChange={(leading) => update(selected.id, { leading })} format={(v) => v.toFixed(2)} />
            <div className="flex flex-wrap items-center gap-3">
              <Segmented size="sm" value={selected.align} onChange={(align) => update(selected.id, { align })} options={[{ value: 'left', label: 'L' }, { value: 'center', label: 'C' }, { value: 'right', label: 'R' }]} label="Alignment" />
              <Toggle checked={selected.caps} onChange={(caps) => update(selected.id, { caps })} label="Caps" />
            </div>
            <div>
              <p className="mb-1.5 text-[12px] text-ink-400">Colour</p>
              <div className="flex flex-wrap gap-1.5">
                {swatches.map((s) => <button key={s} onClick={() => update(selected.id, { color: s })} aria-label={`Colour ${s}`} className={cx('h-8 w-8 rounded-full ring-2', selected.color.toUpperCase() === s.toUpperCase() ? 'ring-ink-100' : 'ring-ink-700')} style={{ background: s }} />)}
              </div>
              <details className="mt-2"><summary className="cursor-pointer text-[12px] text-ink-400">Custom colour…</summary><div className="mt-2"><ColourPicker value={toRgb(selected.color)} onChange={(c) => update(selected.id, { color: rgbToHex(c) })} wheelSize={140} layout="column" /></div></details>
            </div>
            {facts.layers.find((f) => f.layer.id === selected.id) && <p className="text-[12px] text-ink-400">Contrast against what is behind it: <b className="num font-mono text-ink-100">{facts.layers.find((f) => f.layer.id === selected.id)!.contrast.toFixed(2)}:1</b></p>}
          </div>
        )}
        {imageControls && comp.image && (
          <div className="space-y-3 rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
            <Eyebrow>Photograph grade</Eyebrow>
            <div className="flex flex-wrap gap-1.5">{LOOKS.map((l) => <Button key={l.id} size="sm" variant="secondary" onClick={() => setComp({ ...comp, image: { ...comp.image!, params: defaultParams(l.params) } })}>{l.label}</Button>)}</div>
            <Slider label="Exposure" value={comp.image.params.exposure} min={-2} max={2} step={0.01} defaultValue={0} onChange={(exposure) => setComp({ ...comp, image: { ...comp.image!, params: { ...comp.image!.params, exposure } } })} format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} EV`} />
            <Slider label="Temperature" value={Math.log(comp.image.params.temp)} min={Math.log(3000)} max={Math.log(12000)} step={0.002} defaultValue={Math.log(6504)} onChange={(v) => setComp({ ...comp, image: { ...comp.image!, params: { ...comp.image!.params, temp: Math.round(Math.exp(v)) } } })} format={(v) => `${Math.round(Math.exp(v))} K`} track="linear-gradient(to right, #3b6fd8, #d8d0c0, #e38a2e)" />
            <Slider label="Contrast" value={comp.image.params.contrast} min={-1} max={1} step={0.01} defaultValue={0} onChange={(contrast) => setComp({ ...comp, image: { ...comp.image!, params: { ...comp.image!.params, contrast } } })} format={(v) => `${Math.round(v * 100)}`} />
            <Slider label="Saturation" value={comp.image.params.saturation} min={0} max={2} step={0.01} defaultValue={1} onChange={(saturation) => setComp({ ...comp, image: { ...comp.image!, params: { ...comp.image!.params, saturation } } })} format={(v) => `${Math.round(v * 100)}%`} />
            <div className="flex items-center gap-2"><span className="text-[12px] text-ink-400">Background</span>{['#F4F2ED', '#111111', '#E9E2D6', '#1C2430'].map((s) => <button key={s} onClick={() => setComp({ ...comp, bg: s })} className="h-7 w-7 rounded-full ring-1 ring-ink-600" style={{ background: s }} aria-label={`Background ${s}`} />)}</div>
          </div>
        )}
        {sidebarBottom}
      </aside>}
    </div>
  );
}

/** Rasterise a composition (photo, cut-out and type) for the gallery. */
export async function exportComposition(c: Composition, handle: ComposerHandle | null, scale = 2): Promise<string | null> {
  const cv = document.createElement('canvas');
  cv.width = c.width * scale; cv.height = c.height * scale;
  const ctx = cv.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, c.width, c.height);
  const draw = async (src: string, r: [number, number, number, number]) => { const im = new Image(); im.src = src; await im.decode(); ctx.drawImage(im, r[0], r[1], r[2], r[3]); };
  if (c.image && handle?.image) { const snap = handle.image.snapshot('image/jpeg', 0.92); if (snap) await draw(snap, c.image.rect); }
  const text = (L: TextLayer) => {
    const f = fontById(L.font);
    ctx.font = `${L.italic ? 'italic ' : ''}${clampWeight(f, L.weight)} ${L.size}px ${f.css}`;
    ctx.fillStyle = L.color;
    ctx.textBaseline = 'top';
    if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(L.tracking / 1000) * L.size}px`;
    const words = (L.caps ? L.text.toUpperCase() : L.text).split(/(\s+)/);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) { if (w === '\n') { lines.push(cur); cur = ''; continue; } const t = cur + w; if (ctx.measureText(t).width > L.w && cur.trim()) { lines.push(cur.trimEnd()); cur = w.trimStart(); } else cur = t; }
    lines.push(cur);
    lines.forEach((ln, i) => {
      const lw = ctx.measureText(ln).width;
      const x = L.align === 'left' ? L.x : L.align === 'center' ? L.x + (L.w - lw) / 2 : L.x + L.w - lw;
      ctx.fillText(ln, x, L.y + i * L.size * L.leading + (L.size * (L.leading - 1)) / 2);
    });
  };
  for (const L of c.layers.filter((l) => l.role === 'masthead')) text(L);
  if (handle?.cutout && c.image) await draw(handle.cutout, c.image.rect);
  for (const L of c.layers.filter((l) => l.role !== 'masthead')) text(L);
  try { return cv.toDataURL('image/jpeg', 0.92); } catch { return null; }
}

/** Reusable rubric pieces. */
export const hueOf = (hex: string) => rgbToHsl(toRgb(hex))[0];
export const chromaOf = (hex: string) => rgbToLch(toRgb(hex))[1];
