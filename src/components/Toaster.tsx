import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { achievementById, useProgress } from '../state/progress';

interface Toast { id: number; title: string; body?: string; glyph?: string }
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const n = useRef(0);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++n.current;
    setToasts((ts) => [...ts, { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4800);
  }, []);
  const { onAchievements } = useProgress();
  useEffect(
    () =>
      onAchievements((ids) =>
        ids.forEach((id) => {
          const a = achievementById(id);
          if (a) push({ title: `Achievement · ${a.title}`, body: a.description + ' +25 XP', glyph: a.glyph });
        }),
      ),
    [onAchievements, push],
  );
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className="vl-toast pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink-100 px-4 py-3 text-ink-950 shadow-2xl shadow-black/50">
            {t.glyph && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-950 font-display text-[15px] text-ink-50">{t.glyph}</span>}
            <div>
              <p className="text-[13px] font-semibold">{t.title}</p>
              {t.body && <p className="text-[12.5px] text-ink-600">{t.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
