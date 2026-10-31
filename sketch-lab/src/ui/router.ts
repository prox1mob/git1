import { useSyncExternalStore } from 'react';

/**
 * Tiny hash router. Routes are written as plain hash names joined by "--",
 * e.g. #math--level--3--l3-protractor → ['math','level','3','l3-protractor'].
 * Plain names (letters, digits, hyphens) survive embedded viewers that only
 * pass simple #names through; the older "#/math/level/3" form is still read.
 */
function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
const snapshot = () => window.location.hash;

export function parseHash(hash: string): string[] {
  const h = hash.replace(/^#/, '');
  const parts = h.startsWith('/') ? h.split('/') : h.split('--');
  return parts.filter(Boolean).map(decodeURIComponent);
}

export function useRoute(): string[] {
  return parseHash(useSyncExternalStore(subscribe, snapshot, () => ''));
}

export function href(...parts: (string | number)[]) {
  return parts.length ? '#' + parts.map((p) => encodeURIComponent(String(p))).join('--') : '#';
}

export function go(...parts: (string | number)[]) {
  window.location.hash = href(...parts);
}
