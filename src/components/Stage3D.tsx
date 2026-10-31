import { Canvas, useThree } from '@react-three/fiber';
import { Environment, Grid, Lightformer, Line, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { Suspense, useEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { SafeHtml } from './three/SafeHtml';
import type { Vec3 } from '../lib/types';

export type ViewName = 'persp' | 'front' | 'top' | 'side' | 'iso';

export interface StageProps {
  children?: ReactNode;
  overlay?: ReactNode;
  camera?: Vec3;
  target?: Vec3;
  fit?: number;
  grid?: boolean;
  gridSize?: number;
  axes?: boolean | number;
  shadows?: boolean;
  env?: boolean;
  lights?: ReactNode;
  view?: ViewName;
  onViewChange?: (v: ViewName) => void;
  showViews?: boolean;
  orbit?: boolean;
  fov?: number;
  className?: string;
  background?: string;
  onPointerMissed?: () => void;
  preserve?: boolean;
}

export const VIEW_LABEL: Record<ViewName, string> = { persp: '3D', iso: 'Iso', front: 'Front', top: 'Top', side: 'Side' };

function ViewRig({ view, fit, target, camera0 }: { view: ViewName; fit: number; target: Vec3; camera0: Vec3 }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const t = new THREE.Vector3(...target);
    const D = fit * 3;
    let p: THREE.Vector3;
    switch (view) {
      case 'front':
        p = new THREE.Vector3(0, 0, D);
        break;
      case 'top':
        p = new THREE.Vector3(0, D, 0.0001);
        break;
      case 'side':
        p = new THREE.Vector3(D, 0, 0);
        break;
      case 'iso':
        p = new THREE.Vector3(1, 0.8165, 1).normalize().multiplyScalar(D);
        break;
      default:
        p = new THREE.Vector3(...camera0).sub(t);
    }
    camera.position.copy(t).add(p);
    camera.lookAt(t);
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const oc = camera as THREE.OrthographicCamera;
      oc.zoom = Math.min(size.width, size.height) / (fit * 1.25);
      oc.updateProjectionMatrix();
    }
    if (controls) {
      controls.target.copy(t);
      controls.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, camera, controls]);
  return null;
}

export function AxesGizmo({ length = 60, labels = true, negative = true }: { length?: number; labels?: boolean; negative?: boolean }) {
  const ax: { dir: Vec3; color: string; label: string }[] = [
    { dir: [1, 0, 0], color: '#ff5f5f', label: 'X' },
    { dir: [0, 1, 0], color: '#5bd75b', label: 'Y' },
    { dir: [0, 0, 1], color: '#4d8dff', label: 'Z' },
  ];
  return (
    <group>
      {ax.map((a) => {
        const end: Vec3 = [a.dir[0] * length, a.dir[1] * length, a.dir[2] * length];
        const rot: Vec3 = a.label === 'X' ? [0, 0, -Math.PI / 2] : a.label === 'Z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
        return (
          <group key={a.label}>
            <Line points={[[0, 0, 0], end]} color={a.color} lineWidth={2.5} />
            {negative && <Line points={[[0, 0, 0], [-end[0], -end[1], -end[2]]]} color={a.color} lineWidth={1} dashed dashSize={3} gapSize={2} transparent opacity={0.6} />}
            <mesh position={end} rotation={rot}>
              <coneGeometry args={[length * 0.035, length * 0.1, 16]} />
              <meshBasicMaterial color={a.color} />
            </mesh>
            {labels && (
              <SafeHtml position={[end[0] * 1.12, end[1] * 1.12, end[2] * 1.12]} center zIndexRange={[4, 0]}>
                <div style={{ color: a.color, fontWeight: 900, fontSize: 18, textShadow: '0 0 4px #000', pointerEvents: 'none' }}>{a.label}</div>
              </SafeHtml>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function DefaultLights({ shadows = true, extent = 150 }: { shadows?: boolean; extent?: number }) {
  return (
    <>
      <hemisphereLight args={['#dfefff', '#1a1f26', 0.9]} />
      <directionalLight
        position={[extent * 0.6, extent * 1.2, extent * 0.8]}
        intensity={2.2}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={1}
        shadow-camera-far={extent * 6}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-extent, extent * 0.5, -extent * 0.6]} intensity={0.6} />
    </>
  );
}

export function StudioEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={['#202833']} />
      <Lightformer form="rect" intensity={3} position={[0, 5, -9]} scale={[10, 10, 1]} />
      <Lightformer form="rect" intensity={2} position={[-6, 2, 4]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} />
      <Lightformer form="rect" intensity={1.5} position={[6, 3, 2]} rotation-y={-Math.PI / 2} scale={[8, 4, 1]} />
      <Lightformer form="ring" intensity={2} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={4} />
    </Environment>
  );
}

export function Stage3D({
  children,
  overlay,
  camera = [120, 100, 160],
  target = [0, 0, 0],
  fit = 100,
  grid = true,
  gridSize,
  axes = false,
  shadows = true,
  env = false,
  lights,
  view = 'persp',
  onViewChange,
  showViews = true,
  orbit = true,
  fov = 40,
  className,
  background,
  onPointerMissed,
  preserve = false,
}: StageProps) {
  const ortho = view === 'front' || view === 'top' || view === 'side';
  const wrap = useRef<HTMLDivElement>(null);
  return (
    <div className={`viewport ${className ?? ''}`} ref={wrap} style={background ? { background } : undefined}>
      <Canvas
        shadows={shadows ? 'percentage' : false}
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: preserve }}
        onPointerMissed={onPointerMissed}
        style={{ position: 'absolute', inset: 0 }}
      >
        {ortho ? (
          <OrthographicCamera makeDefault near={-5000} far={10000} position={camera} />
        ) : (
          <PerspectiveCamera makeDefault fov={fov} near={0.5} far={20000} position={camera} />
        )}
        <OrbitControls
          makeDefault
          enabled={orbit}
          enableDamping
          dampingFactor={0.12}
          target={target}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
          maxDistance={fit * 12}
          minDistance={fit * 0.15}
        />
        <ViewRig view={view} fit={fit} target={target} camera0={camera} />
        {lights ?? <DefaultLights shadows={shadows} extent={fit * 1.5} />}
        {env && (
          <Suspense fallback={null}>
            <StudioEnvironment />
          </Suspense>
        )}
        {grid && (
          <Grid
            position={[0, -0.02, 0]}
            args={[10, 10]}
            cellSize={gridSize ?? (fit > 300 ? 50 : 10)}
            sectionSize={(gridSize ?? (fit > 300 ? 50 : 10)) * 5}
            cellColor="#243140"
            sectionColor="#35506b"
            cellThickness={0.8}
            sectionThickness={1.2}
            fadeDistance={fit * 8}
            fadeStrength={1.5}
            infiniteGrid
          />
        )}
        {shadows && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -fit * 0.002, 0]} receiveShadow renderOrder={-1}>
            <planeGeometry args={[fit * 20, fit * 20]} />
            <shadowMaterial transparent opacity={0.28} depthWrite={false} />
          </mesh>
        )}
        {axes && <AxesGizmo length={typeof axes === 'number' ? axes : fit * 0.6} />}
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
      {showViews && onViewChange && (
        <div className="overlay-tr">
          <div className="seg">
            {(['persp', 'front', 'top', 'side'] as ViewName[]).map((v) => (
              <button key={v} className={`btn small ${view === v ? 'on' : ''}`} onClick={() => onViewChange(v)} title={`${VIEW_LABEL[v]} view`}>
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>
        </div>
      )}
      {overlay}
    </div>
  );
}
