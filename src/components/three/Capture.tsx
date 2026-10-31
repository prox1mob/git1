import { useThree } from '@react-three/fiber';
import { useEffect, type MutableRefObject } from 'react';

export type CaptureFn = (width?: number) => string;

/** Registers a function that renders the current frame and returns a JPEG data URL thumbnail. */
export function CaptureHook({ fnRef }: { fnRef: MutableRefObject<CaptureFn | null> }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    fnRef.current = (w = 360) => {
      gl.render(scene, camera);
      const src = gl.domElement;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = Math.max(1, Math.round((w * src.height) / Math.max(1, src.width)));
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#10161d';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.82);
    };
    return () => {
      fnRef.current = null;
    };
  }, [gl, scene, camera, fnRef]);
  return null;
}
