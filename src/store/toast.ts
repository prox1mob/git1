import { create } from 'zustand';

interface ToastState {
  msg: string | null;
  key: number;
  show: (msg: string, ms?: number) => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>((set) => ({
  msg: null,
  key: 0,
  show(msg, ms = 2600) {
    if (timer) clearTimeout(timer);
    set((s) => ({ msg, key: s.key + 1 }));
    timer = setTimeout(() => set({ msg: null }), ms);
  },
}));

export const toast = (msg: string, ms?: number) => useToast.getState().show(msg, ms);
