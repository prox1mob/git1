import { useEffect, useRef, useState } from 'react';
import { cx } from '../ui';

export const FPS = 24;
const tc = (t: number) => {
  const f = Math.floor(t * FPS);
  const s = Math.floor(f / FPS);
  return `00:00:${String(s % 60).padStart(2, '0')}:${String(f % FPS).padStart(2, '0')}`;
};

/** Play/pause, frame stepping and scrubbing for a clip whose frames are a function of time. */
export function useClip(duration: number, autoplay = false) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) { last.current = null; return; }
    let id = 0;
    const tick = (now: number) => {
      if (last.current !== null) {
        const dt = (now - last.current) / 1000;
        setTime((t) => (t + dt) % duration);
      }
      last.current = now;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, duration]);
  // Quantise to whole frames so scrubbing and stepping land on real frames.
  const frameTime = Math.floor(time * FPS) / FPS;
  return { time: frameTime, playing, setPlaying, setTime: (t: number) => setTime(((t % duration) + duration) % duration), duration };
}

export function Transport({ clip, className }: { clip: ReturnType<typeof useClip>; className?: string }) {
  const { time, playing, setPlaying, setTime, duration } = clip;
  return (
    <div className={cx('flex items-center gap-2 rounded-full bg-ink-850 px-2 py-1.5 ring-1 ring-ink-700', className)}>
      <button className="grid h-9 w-9 place-items-center rounded-full text-ink-200 hover:bg-ink-700" aria-label="Previous frame" onClick={() => { setPlaying(false); setTime(time - 1 / FPS); }}>⏮</button>
      <button className="grid h-10 w-10 place-items-center rounded-full bg-ink-100 text-ink-950" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}>{playing ? '❚❚' : '▶'}</button>
      <button className="grid h-9 w-9 place-items-center rounded-full text-ink-200 hover:bg-ink-700" aria-label="Next frame" onClick={() => { setPlaying(false); setTime(time + 1 / FPS); }}>⏭</button>
      <input type="range" className="vl-range mx-1 flex-1" min={0} max={duration} step={1 / FPS} value={time} aria-label="Scrub timeline" onChange={(e) => { setPlaying(false); setTime(parseFloat(e.target.value)); }} />
      <span className="num pr-2 font-mono text-[11.5px] text-ink-300">{tc(time)}</span>
    </div>
  );
}
