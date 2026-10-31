import { useCallback, useRef, useState } from 'react';

/**
 * State with Undo and Reset.
 *  - set():        change the value without creating an undo step (use while dragging)
 *  - checkpoint(): remember the current value so it can be restored (call when a drag starts)
 *  - commit():     checkpoint + set, for one-shot changes such as button presses
 *  - reset():      go back to the initial value (Reset itself can be undone)
 */
export interface History<T> {
  value: T;
  set: (v: T | ((prev: T) => T)) => void;
  commit: (v: T | ((prev: T) => T)) => void;
  checkpoint: () => void;
  undo: () => void;
  reset: (to?: T) => void;
  canUndo: boolean;
}

const LIMIT = 80;

export function useHistory<T>(initial: T | (() => T)): History<T> {
  const [value, setValue] = useState<T>(initial);
  const current = useRef(value);
  const initialRef = useRef<T>(value);
  const stack = useRef<T[]>([]);
  const [depth, setDepth] = useState(0);

  const set = useCallback((v: T | ((prev: T) => T)) => {
    const next = typeof v === 'function' ? (v as (p: T) => T)(current.current) : v;
    current.current = next;
    setValue(next);
  }, []);

  const checkpoint = useCallback(() => {
    const snap = current.current;
    const s = stack.current;
    const top = s[s.length - 1];
    if (top !== undefined && JSON.stringify(top) === JSON.stringify(snap)) return;
    s.push(snap);
    if (s.length > LIMIT) s.shift();
    setDepth(s.length);
  }, []);

  const commit = useCallback(
    (v: T | ((prev: T) => T)) => {
      checkpoint();
      set(v);
    },
    [checkpoint, set],
  );

  const undo = useCallback(() => {
    const prev = stack.current.pop();
    if (prev === undefined) return;
    current.current = prev;
    setValue(prev);
    setDepth(stack.current.length);
  }, []);

  const reset = useCallback(
    (to?: T) => {
      checkpoint();
      if (to !== undefined) initialRef.current = to;
      current.current = initialRef.current;
      setValue(initialRef.current);
    },
    [checkpoint],
  );

  return { value, set, commit, checkpoint, undo, reset, canUndo: depth > 0 };
}
