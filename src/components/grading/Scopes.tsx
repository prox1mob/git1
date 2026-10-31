import { useEffect, useRef, useState } from 'react';
import type { Frame } from '../../engine/GradeEngine';
import { drawHistogram, drawVectorscope, drawWaveform } from '../../engine/scopes';
import { Segmented, cx } from '../ui';

export type ScopeKind = 'histogram' | 'waveform' | 'parade' | 'vectorscope';
const LABELS: Record<ScopeKind, string> = { histogram: 'Histogram', waveform: 'Waveform', parade: 'RGB parade', vectorscope: 'Vectorscope' };

export function Scope({ frame, kind, className, zoom = 1, histMode = 'rgb' }: { frame: Frame | null; kind: ScopeKind; className?: string; zoom?: number; histMode?: 'rgb' | 'luma' }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !frame || c.clientWidth < 4) return;
    if (kind === 'histogram') drawHistogram(c, frame, histMode);
    else if (kind === 'waveform') drawWaveform(c, frame, 'luma');
    else if (kind === 'parade') drawWaveform(c, frame, 'parade');
    else drawVectorscope(c, frame, zoom);
  }, [frame, kind, zoom, histMode]);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={`${LABELS[kind]} computed from the current image`}
      className={cx('block w-full rounded-lg bg-[#0d0d0d] ring-1 ring-ink-700', kind === 'vectorscope' ? 'aspect-square' : 'aspect-[16/9]', className)}
    />
  );
}

/** Tabbed scopes panel; scopes are computed from the actual rendered pixels. */
export function ScopePanel({ frame, kinds = ['histogram', 'waveform', 'parade', 'vectorscope'], initial, className }: { frame: Frame | null; kinds?: ScopeKind[]; initial?: ScopeKind; className?: string }) {
  const [kind, setKind] = useState<ScopeKind>(initial ?? kinds[0]);
  const [zoom, setZoom] = useState(1);
  return (
    <div className={className}>
      {kinds.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Segmented size="sm" label="Scope" value={kind} onChange={setKind} options={kinds.map((k) => ({ value: k, label: LABELS[k] }))} />
          {kind === 'vectorscope' && <Segmented size="sm" label="Zoom" value={zoom} onChange={setZoom} options={[{ value: 1, label: '×1' }, { value: 2, label: '×2' }]} />}
        </div>
      )}
      <div className={kind === 'vectorscope' ? 'mx-auto max-w-[300px]' : ''}>
        <Scope frame={frame} kind={kind} zoom={zoom} />
      </div>
    </div>
  );
}
