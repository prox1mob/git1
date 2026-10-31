import { Html } from '@react-three/drei';
import { useEffect, useState, type ComponentProps } from 'react';

/**
 * drei's <Html> can mount an empty root when it is created in the very first frame
 * (before the canvas is attached to the page). Delaying it by one frame avoids that.
 */
export function SafeHtml(props: ComponentProps<typeof Html>) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return ready ? <Html {...props} /> : null;
}
