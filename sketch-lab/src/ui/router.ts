import { useSyncExternalStore } from 'react';

/** Tiny hash router: #/math/level/3/l3-protractor → ['math','level','3','l3-protractor'] */
function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
const snapshot = () => window.location.hash;

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, snapshot, () => '');
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function href(...parts: (string | number)[]) {
  return '#/' + parts.map((p) => encodeURIComponent(String(p))).join('/');
}

export function go(...parts: (string | number)[]) {
  window.location.hash = href(...parts);
}
