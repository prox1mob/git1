import { useEffect, useImperativeHandle, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode, type Ref } from 'react';
import { GradeEngine, type Frame } from '../../engine/GradeEngine';
import { defaultView, type CaptureSpec, type GradeParams, type SourceSpec, type ViewSpec } from '../../engine/params';
import type { Vec3 } from '../../lib/color';
import { cx } from '../ui';

export interface GradeHandle {
  engine: GradeEngine | null;
  analyze: (opts?: { params?: GradeParams; before?: boolean; width?: number }) => Frame | null;
  snapshot: (type?: string, q?: number) => string | null;
  sampleSource: (u: number, v: number) => Vec3 | null;
  mask: (w?: number) => Frame | null;
}

export interface GradeCanvasProps {
  source: SourceSpec;
  capture?: CaptureSpec;
  params: GradeParams;
  view?: ViewSpec;
  time?: number;
  aspect: number;
  beforeRolloff?: number;
  onAnalysis?: (f: Frame) => void;
  analysisWidth?: number;
  onPick?: (u: number, v: number) => void;
  className?: string;
  ref?: Ref<GradeHandle>;
  label?: string;
  children?: ReactNode;
  maxPixels?: number;
  rounded?: boolean;
}

const sourceKey = (s: SourceSpec) => (s.kind === 'scene' ? JSON.stringify(s) : `${s.kind}:${s.key}`);

export function EngineUnavailable({ className, reason }: { className?: string; reason?: string }) {
  return (
    <div className={cx('grid place-items-center rounded-xl bg-ink-850 p-6 text-center ring-1 ring-ink-700', className)}>
      <div className="max-w-sm">
        <p className="font-display text-[22px] text-ink-50">This lab needs WebGL2</p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-300">
          {reason ?? 'Your browser or device did not provide a WebGL2 context, so real-time grading cannot run here.'} The Colour and Typography worlds work without it. Try a recent Chrome, Edge, Firefox or Safari.
        </p>
      </div>
    </div>
  );
}

export function GradeCanvas({
  source, capture, params, view, time = 0, aspect, beforeRolloff, onAnalysis, analysisWidth = 320, onPick, className, ref, label, children, maxPixels = 1_900_000, rounded = true,
}: GradeCanvasProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<GradeEngine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const raf = useRef(0);
  const analysisTimer = useRef<number | null>(null);
  const lastAnalysis = useRef(0);
  const onAnalysisRef = useRef(onAnalysis);
  onAnalysisRef.current = onAnalysis;
  const keys = useRef({ source: '', capture: '' });

  const schedule = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const e = engine.current;
      if (!e) return;
      if (e.contextLost) { setError('The graphics context was lost (the device may have reclaimed GPU memory). Reload the page to continue.'); return; }
      e.render();
      if (onAnalysisRef.current) {
        const now = performance.now();
        const run = () => {
          lastAnalysis.current = performance.now();
          analysisTimer.current = null;
          const f = engine.current?.analyze({ width: analysisWidth });
          if (f) onAnalysisRef.current?.(f);
        };
        if (now - lastAnalysis.current > 90) run();
        else if (analysisTimer.current === null) analysisTimer.current = window.setTimeout(run, 100);
      }
    });
  };

  useEffect(() => {
    if (!canvas.current) return;
    try {
      engine.current = new GradeEngine(canvas.current);
      keys.current = { source: '', capture: '' };
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    const ro = new ResizeObserver(() => {
      const el = wrap.current;
      const e = engine.current;
      if (!el || !e) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      let w = el.clientWidth * dpr;
      let h = w / aspect;
      if (w * h > maxPixels) { const k = Math.sqrt(maxPixels / (w * h)); w *= k; h *= k; }
      if (w < 2) return;
      e.setSize(w, h);
      schedule();
    });
    if (wrap.current) ro.observe(wrap.current);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      if (analysisTimer.current) clearTimeout(analysisTimer.current);
      engine.current?.dispose();
      engine.current = null;
      keys.current = { source: '', capture: '' };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const sk = sourceKey(source);
    if (sk !== keys.current.source) { keys.current.source = sk; e.setSource(source); }
    else if (source.kind === 'video') e.markSourceDirty();
    const ck = JSON.stringify(capture ?? {});
    if (ck !== keys.current.capture) { keys.current.capture = ck; e.setCapture(capture ?? {}); }
    e.setParams(params);
    e.setView(view ?? defaultView());
    e.setTime(time);
    e.beforeRolloff = beforeRolloff ?? null;
    schedule();
  });

  useImperativeHandle(ref, () => ({
    get engine() { return engine.current; },
    analyze: (opts) => engine.current?.analyze({ width: analysisWidth, ...opts }) ?? null,
    snapshot: (type, q) => engine.current?.snapshot(type, q) ?? null,
    sampleSource: (u, v) => engine.current?.sampleSource(u, v) ?? null,
    mask: (w) => engine.current?.mask(w) ?? null,
  }), [analysisWidth]);

  const pick = (ev: RPointerEvent<HTMLCanvasElement>) => {
    if (!onPick) return;
    const r = ev.currentTarget.getBoundingClientRect();
    onPick((ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height);
  };

  if (error) return <EngineUnavailable className={cx('w-full', className)} reason={error.includes('WebGL2') ? undefined : error} />;

  return (
    <div ref={wrap} className={cx('relative w-full overflow-hidden bg-ink-950', rounded && 'rounded-xl', className)} style={{ aspectRatio: String(aspect) }}>
      <canvas ref={canvas} aria-label={label ?? 'Image preview'} role="img" onPointerDown={pick} className={cx('block h-full w-full', onPick && 'cursor-crosshair')} />
      {children}
    </div>
  );
}
