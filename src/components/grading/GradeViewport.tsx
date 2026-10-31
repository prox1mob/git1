import { useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { defaultView, type ViewSpec } from '../../engine/params';
import { Segmented, Toggle, cx } from '../ui';
import { GradeCanvas, type GradeCanvasProps } from './GradeCanvas';

type Mode = ViewSpec['mode'];

/** Image preview with before/after comparison (split wipe, toggle, press-and-hold) and clipping warnings. */
export function GradeViewport({
  view: viewOver, compare = true, clipToggle = true, toolbarExtra, beforeLabel = 'Before', afterLabel = 'After', initialMode = 'graded', ...rest
}: GradeCanvasProps & { compare?: boolean; clipToggle?: boolean; toolbarExtra?: ReactNode; beforeLabel?: string; afterLabel?: string; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [split, setSplit] = useState(0.5);
  const [clip, setClip] = useState(false);
  const [holding, setHolding] = useState(false);
  const dragging = useRef(false);
  const view: ViewSpec = { ...defaultView(), ...viewOver, mode: holding ? 'before' : mode, split, clipWarn: clip || !!viewOver?.clipWarn };

  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    setSplit(Math.max(0.02, Math.min(0.98, (e.clientX - r.left) / r.width)));
  };

  return (
    <div className="space-y-2.5">
      <GradeCanvas {...rest} view={view}>
        {mode === 'split' && !holding && (
          <div
            className="absolute inset-0 touch-none"
            onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); onMove(e); }}
            onPointerMove={onMove}
            onPointerUp={() => { dragging.current = false; }}
          >
            <div className="pointer-events-none absolute inset-y-0 w-px bg-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" style={{ left: `${split * 100}%` }}>
              <div className="absolute top-1/2 left-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[13px] text-ink-950 shadow-lg">⇆</div>
            </div>
            <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white/90">{beforeLabel}</span>
            <span className="pointer-events-none absolute top-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white/90">{afterLabel}</span>
          </div>
        )}
        {(holding || mode === 'before') && <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white/90">{beforeLabel}</span>}
        {rest.children}
      </GradeCanvas>
      {(compare || clipToggle || toolbarExtra) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {compare && (
            <>
              <Segmented size="sm" label="Compare" value={mode} onChange={setMode} options={[{ value: 'graded', label: afterLabel }, { value: 'split', label: 'Split' }, { value: 'before', label: beforeLabel }]} />
              <button
                className={cx('h-8 rounded-full px-3 text-[12px] ring-1 select-none', holding ? 'bg-ink-100 text-ink-950 ring-ink-100' : 'text-ink-300 ring-ink-600 hover:text-ink-50')}
                onPointerDown={() => setHolding(true)}
                onPointerUp={() => setHolding(false)}
                onPointerLeave={() => setHolding(false)}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setHolding(true); }}
                onKeyUp={() => setHolding(false)}
              >
                Hold for {beforeLabel.toLowerCase()}
              </button>
            </>
          )}
          {clipToggle && <Toggle checked={clip} onChange={setClip} label="Clipping warning" />}
          {toolbarExtra}
        </div>
      )}
    </div>
  );
}
