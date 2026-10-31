import { ContactShadows } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D } from '../../components/Stage3D';
import { CaptureHook, type CaptureFn } from '../../components/three/Capture';
import { Seg, Slider, Toggle } from '../../components/ui';
import { DEG, fmt } from '../../lib/math';
import { putPortfolio } from '../../lib/storage';
import { toast } from '../../store/toast';
import type { Feedback, LessonStep } from '../../lib/types';

export interface Lights {
  keyAz: number;
  keyEl: number;
  key: number;
  fillAz: number;
  fill: number;
  rimAz: number;
  rim: number;
  soft: number;
}
export interface Shot {
  focal: number;
  bg: string;
  product: 'bottle' | 'speaker' | 'headphones';
  color: string;
  lights: Lights;
  thirds: boolean;
  tagline: string;
}
export interface Frame {
  fill: number; // fraction of the frame area covered by the product's bounding rectangle
  cx: number; // product centre in the frame, 0..1
  cy: number;
  camAz: number; // degrees, camera azimuth around the product
  inFrame: boolean;
}

const lum = (hex: string) => {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};

function Product({ kind, color }: { kind: Shot['product']; color: string }) {
  const bottle = useMemo(() => {
    const pts = [
      [0, 0],
      [26, 0],
      [28, 6],
      [28, 90],
      [20, 112],
      [10, 120],
      [10, 138],
      [0, 138],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 64);
  }, []);
  if (kind === 'bottle')
    return (
      <group>
        <mesh geometry={bottle} castShadow>
          <meshPhysicalMaterial color={color} roughness={0.15} metalness={0.2} clearcoat={1} />
        </mesh>
        <mesh position={[0, 146, 0]} castShadow>
          <cylinderGeometry args={[11, 11, 16, 32]} />
          <meshStandardMaterial color="#1e2126" roughness={0.4} metalness={0.6} />
        </mesh>
      </group>
    );
  if (kind === 'speaker')
    return (
      <group>
        <mesh position={[0, 60, 0]} castShadow>
          <cylinderGeometry args={[45, 50, 120, 64]} />
          <meshPhysicalMaterial color={color} roughness={0.95} sheen={1} sheenColor={color} />
        </mesh>
        <mesh position={[0, 122, 0]}>
          <cylinderGeometry args={[45, 45, 4, 64]} />
          <meshStandardMaterial color="#1e2126" roughness={0.3} />
        </mesh>
        <mesh position={[0, 124.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[14, 17, 48]} />
          <meshBasicMaterial color="#4cc9f0" />
        </mesh>
      </group>
    );
  return (
    <group position={[0, 10, 0]}>
      <mesh position={[0, 90, 0]} castShadow>
        <torusGeometry args={[60, 6, 16, 64, Math.PI]} />
        <meshPhysicalMaterial color={color} roughness={0.3} clearcoat={0.8} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 60, 70, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[30, 30, 18, 48]} />
          <meshPhysicalMaterial color={color} roughness={0.35} clearcoat={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Lens({ focal }: { focal: number }) {
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useEffect(() => {
    if (!cam.isPerspectiveCamera) return;
    cam.fov = 2 * Math.atan(12 / focal) / DEG; // vertical FOV of a 36 × 24 mm full-frame sensor
    cam.updateProjectionMatrix();
  }, [cam, focal]);
  return null;
}

function Meter({ onFrame, height }: { onFrame: (f: Frame) => void; height: number }) {
  const cam = useThree((s) => s.camera);
  const n = useRef(0);
  useFrame(() => {
    if (n.current++ % 10) return;
    const box = new THREE.Box3(new THREE.Vector3(-65, 0, -50), new THREE.Vector3(65, height, 50));
    const pts: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) pts.push(new THREE.Vector3(x, y, z).project(cam));
    const xs = pts.map((p) => p.x),
      ys = pts.map((p) => p.y);
    const x0 = Math.max(-1, Math.min(...xs)),
      x1 = Math.min(1, Math.max(...xs)),
      y0 = Math.max(-1, Math.min(...ys)),
      y1 = Math.min(1, Math.max(...ys));
    const fill = Math.max(0, ((x1 - x0) * (y1 - y0)) / 4);
    const inFrame = Math.min(...xs) > -1 && Math.max(...xs) < 1 && Math.min(...ys) > -1 && Math.max(...ys) < 1;
    const c = new THREE.Vector3(0, height / 2, 0).project(cam);
    onFrame({ fill, cx: (c.x + 1) / 2, cy: (1 - c.y) / 2, camAz: Math.atan2(cam.position.x, cam.position.z) / DEG, inFrame });
  });
  return null;
}

function StudioLights({ l, camAz }: { l: Lights; camAz: number }) {
  const pos = (az: number, el: number, d = 400) => {
    const a = (camAz + az) * DEG,
      e = el * DEG;
    return new THREE.Vector3(Math.sin(a) * Math.cos(e) * d, Math.sin(e) * d + 60, Math.cos(a) * Math.cos(e) * d);
  };
  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={pos(l.keyAz, l.keyEl)} intensity={l.key} castShadow />
      <directionalLight position={pos(l.fillAz, 15)} intensity={l.fill} />
      <directionalLight position={pos(l.rimAz, 35)} intensity={l.rim} />
    </>
  );
}

export function scoreShot(s: Shot, f: Frame | null, mode: 'camera' | 'light' | 'ad') {
  const rows: { criterion: string; points: number; max: number; note?: string }[] = [];
  const add = (criterion: string, ok: boolean | number, max: number, note?: string) => rows.push({ criterion, points: (typeof ok === 'number' ? ok : ok ? 1 : 0) * max, max, note });
  if (mode !== 'light') {
    add('Portrait / product focal length (50–135 mm) — little distortion', s.focal >= 50 && s.focal <= 135, mode === 'ad' ? 10 : 30, `${s.focal} mm`);
    const fill = f?.fill ?? 0;
    add('Product fills 25–60 % of the frame, fully visible', !!f?.inFrame && fill >= 0.25 && fill <= 0.6, mode === 'ad' ? 15 : 40, `${fmt(fill * 100, 0)} % · ${f?.inFrame ? 'fully in frame' : 'cropped'}`);
    const dThird = f ? Math.min(...[1 / 3, 2 / 3].map((t) => Math.abs(f.cx - t))) : 1;
    const centred = f ? Math.abs(f.cx - 0.5) < 0.04 : false;
    add('Deliberate placement: on a thirds line or centred', !!f && (dThird < 0.05 || centred), mode === 'ad' ? 10 : 30, f ? `centre at ${fmt(f.cx * 100, 0)} % across` : '');
  }
  if (mode !== 'camera') {
    const ratio = s.lights.key / Math.max(0.01, s.lights.fill);
    add('Key light raised 20–60° and to the side (30–75°)', s.lights.keyEl >= 20 && s.lights.keyEl <= 60 && Math.abs(s.lights.keyAz) >= 30 && Math.abs(s.lights.keyAz) <= 75, mode === 'ad' ? 10 : 25, `elevation ${s.lights.keyEl}°, side ${s.lights.keyAz}°`);
    add('Fill on the opposite side, key : fill between 2 : 1 and 4 : 1', Math.sign(s.lights.fillAz) !== Math.sign(s.lights.keyAz) && ratio >= 2 && ratio <= 4, mode === 'ad' ? 10 : 25, `ratio ${fmt(ratio, 1)} : 1`);
    add('Rim light from behind separates the product from the background', s.lights.rim >= 0.6 && Math.abs(s.lights.rimAz) >= 120, mode === 'ad' ? 10 : 25, `rim ${fmt(s.lights.rim, 1)} at ${s.lights.rimAz}°`);
    add('Soft, natural shadow', s.lights.soft >= 1.5, mode === 'ad' ? 5 : 25, `softness ${fmt(s.lights.soft, 1)}`);
  }
  if (mode === 'ad') {
    const contrast = Math.abs(lum(s.bg) - lum(s.color));
    add('Product stands out from the background (luminance contrast ≥ 0.25)', contrast >= 0.25, 15, `contrast ${fmt(contrast, 2)}`);
    add('A short tagline (2–8 words)', s.tagline.trim().split(/\s+/).filter(Boolean).length >= 2 && s.tagline.trim().split(/\s+/).length <= 8, 15, `“${s.tagline}”`);
  }
  return rows;
}

export function Studio({ id, mode, steps }: { id: string; mode: 'camera' | 'light' | 'ad'; steps: LessonStep[] }) {
  const [s, setS] = useState<Shot>({
    focal: mode === 'camera' ? 24 : 85,
    bg: '#20262e',
    product: 'bottle',
    color: '#d62828',
    lights: mode === 'light' ? { keyAz: 0, keyEl: 75, key: 2, fillAz: 0, fill: 2, rimAz: 0, rim: 0, soft: 0.5 } : { keyAz: 45, keyEl: 40, key: 2.4, fillAz: -50, fill: 0.9, rimAz: 160, rim: 1.2, soft: 2.5 },
    thirds: true,
    tagline: '',
  });
  const [frame, setFrame] = useState<Frame | null>(null);
  const capture = useRef<CaptureFn | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const L = (p: Partial<Lights>) => setS({ ...s, lights: { ...s.lights, ...p } });
  const height = s.product === 'bottle' ? 154 : s.product === 'speaker' ? 125 : 165;

  const evaluate = (): Feedback => {
    const rows = scoreShot(s, frame, mode);
    const bad = rows.filter((r) => r.points < r.max);
    const score = Math.round((rows.reduce((a, r) => a + r.points, 0) / rows.reduce((a, r) => a + r.max, 0)) * 100);
    return {
      score,
      correct: rows.filter((r) => r.points >= r.max).map((r) => r.criterion),
      issues: bad.map((r) => ({ label: r.criterion, detail: r.note })),
      why: 'These are widely used studio conventions, not laws: they make products look solid, true to shape and easy to read. Great photographers break them on purpose — once they know them.',
      suggestion: bad.length ? `Try: ${bad[0].criterion.toLowerCase()}.` : 'Now break one rule deliberately and compare the mood — the rubric measures technique, not taste.',
      rubric: rows,
    };
  };

  const takePhoto = async () => {
    const img = capture.current?.(640);
    if (!img) return;
    setPhoto(img);
    if (mode === 'ad') {
      const rows = scoreShot(s, frame, 'ad');
      await putPortfolio({ id: `ad-${Date.now()}`, title: `Product advertisement: ${s.tagline || s.product}`, levelId: id, at: new Date().toISOString(), thumb: img, notes: s.tagline, rubric: rows });
      toast('📸 Photo saved to your portfolio');
    }
  };

  return (
    <LevelShell
      id={id}
      steps={steps}
      evaluate={evaluate}
      viewport={
        <Stage3D
          fit={180}
          camera={mode === 'camera' ? [60, 110, 280] : [0, 120, 950]}
          target={[0, height / 2, 0]}
          grid={false}
          shadows
          env={mode !== 'light'}
          lights={<StudioLights l={s.lights} camAz={frame?.camAz ?? 0} />}
          background={s.bg}
          showViews={false}
          preserve
          overlay={
            <>
              {s.thirds && (
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  {[1, 2].map((i) => (
                    <div key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i * 100) / 3}%`, borderLeft: '1px dashed rgba(255,255,255,0.35)' }} />
                  ))}
                  {[1, 2].map((i) => (
                    <div key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: `${(i * 100) / 3}%`, borderTop: '1px dashed rgba(255,255,255,0.35)' }} />
                  ))}
                </div>
              )}
              {mode === 'ad' && s.tagline && (
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 40, textAlign: 'center', fontSize: 28, fontWeight: 800, letterSpacing: '0.04em', color: lum(s.bg) > 0.5 ? '#111' : '#fff', pointerEvents: 'none', textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>{s.tagline}</div>
              )}
              <div className="overlay-tl">
                <div className="hud mono" style={{ fontSize: 12 }}>
                  {s.focal} mm · fill {fmt((frame?.fill ?? 0) * 100, 0)} % {frame && !frame.inFrame ? '· cropped' : ''}
                </div>
              </div>
            </>
          }
        >
          <Lens focal={s.focal} />
          <Meter onFrame={setFrame} height={height} />
          <CaptureHook fnRef={capture} />
          <Product kind={s.product} color={s.color} />
          <ContactShadows position={[0, 0.1, 0]} opacity={0.6} scale={400} blur={s.lights.soft} far={200} resolution={512} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
            <planeGeometry args={[3000, 3000]} />
            <meshStandardMaterial color={s.bg} roughness={0.9} />
          </mesh>
        </Stage3D>
      }
    >
      <Seg value={s.product} onChange={(product) => setS({ ...s, product })} options={[{ v: 'bottle', label: 'Bottle' }, { v: 'speaker', label: 'Speaker' }, { v: 'headphones', label: 'Headphones' }]} />
      <div className="muted" style={{ fontSize: 12 }}>
        Orbit and pinch in the viewport to move the camera; the lights stay relative to the camera, as in a real studio.
      </div>
      {mode !== 'light' && <Slider label="Focal length (full-frame equivalent)" value={s.focal} min={14} max={200} step={1} unit="mm" onChange={(focal) => setS({ ...s, focal })} />}
      {mode !== 'camera' && (
        <>
          <div className="lbl">Key light</div>
          <Slider label="Side angle" value={s.lights.keyAz} min={-120} max={120} step={5} unit="°" onChange={(v) => L({ keyAz: v })} />
          <Slider label="Height" value={s.lights.keyEl} min={0} max={90} step={5} unit="°" onChange={(v) => L({ keyEl: v })} />
          <Slider label="Intensity" value={s.lights.key} min={0} max={5} step={0.1} onChange={(v) => L({ key: v })} digits={1} />
          <div className="lbl">Fill light</div>
          <Slider label="Side angle" value={s.lights.fillAz} min={-120} max={120} step={5} unit="°" onChange={(v) => L({ fillAz: v })} />
          <Slider label="Intensity" value={s.lights.fill} min={0} max={5} step={0.1} onChange={(v) => L({ fill: v })} digits={1} />
          <div className="lbl">Rim (back) light</div>
          <Slider label="Angle" value={s.lights.rimAz} min={-180} max={180} step={5} unit="°" onChange={(v) => L({ rimAz: v })} />
          <Slider label="Intensity" value={s.lights.rim} min={0} max={5} step={0.1} onChange={(v) => L({ rim: v })} digits={1} />
          <Slider label="Shadow softness (light size)" value={s.lights.soft} min={0.2} max={5} step={0.1} onChange={(v) => L({ soft: v })} digits={1} />
        </>
      )}
      {mode === 'ad' && (
        <>
          <div className="numrow">
            <span className="lbl">Product colour</span>
            <input type="color" value={s.color} onChange={(e) => setS({ ...s, color: e.target.value })} />
            <span className="lbl">Background</span>
            <input type="color" value={s.bg} onChange={(e) => setS({ ...s, bg: e.target.value })} />
          </div>
          <div className="btnrow">
            {['#f4f1e8', '#20262e', '#0b0f14', '#ffd166', '#a8dadc'].map((c) => (
              <button key={c} className="btn small" style={{ background: c, width: 34 }} onClick={() => setS({ ...s, bg: c })} aria-label={`Background ${c}`} />
            ))}
          </div>
          <div className="field">
            <label>Tagline</label>
            <input type="text" value={s.tagline} maxLength={60} placeholder="e.g. Pure water. Pure design." onChange={(e) => setS({ ...s, tagline: e.target.value })} />
          </div>
        </>
      )}
      <Toggle checked={s.thirds} onChange={(thirds) => setS({ ...s, thirds })} label="Rule-of-thirds guides" />
      <button className="btn accent" onClick={takePhoto}>
        📸 Take photo{mode === 'ad' ? ' (saves to portfolio)' : ''}
      </button>
      {photo && <img src={photo} alt="Your shot" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />}
    </LevelShell>
  );
}
