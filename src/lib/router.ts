import { useEffect, useState } from 'react';

/** Minimal hash router: works from file:// and any static host, no server config needed. */
export function useRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => {
      setParts(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}

export const href = (path: string) => '#/' + path.replace(/^\/+/, '');
export function navigate(path: string) {
  window.location.hash = href(path);
}
