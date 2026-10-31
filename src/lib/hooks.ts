import { useEffect, useRef, useState } from 'react';

/** Seconds elapsed while `playing`, advanced with requestAnimationFrame and capped to `fps`. */
export function useClock(playing: boolean, fps = 30, start = 0): [number, (t: number) => void] {
  const [t, setT] = useState(start);
  const last = useRef<number | null>(null);
  const acc = useRef(0);
  useEffect(() => {
    if (!playing) { last.current = null; return; }
    let id = 0;
    const tick = (now: number) => {
      if (last.current !== null) {
        acc.current += (now - last.current) / 1000;
        if (acc.current >= 1 / fps) {
          const step = acc.current;
          acc.current = 0;
          setT((v) => v + step);
        }
      }
      last.current = now;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, fps]);
  return [t, setT];
}

export function usePrefersReducedMotion() {
  const [r, setR] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!m) return;
    const on = () => setR(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return r;
}

/** Keeps a value in state but also exposes a ref that always holds the latest value. */
export function useLatest<T>(v: T) {
  const r = useRef(v);
  r.current = v;
  return r;
}

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
