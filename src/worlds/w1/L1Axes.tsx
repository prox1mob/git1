import { useEffect, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { LevelShell } from '../../components/LevelShell';
import { Stage3D, type ViewName } from '../../components/Stage3D';
import { ObjectGestures, type DragAxis } from '../../components/three/ObjectGestures';
import { Arrow3D, CoordinateGuides, Label } from '../../components/three/ObjectMesh';
import { Seg, Task, Toggle } from '../../components/ui';
import { useSettings } from '../../store/progress';
import { absTol, dist3, fmt } from '../../lib/math';
import type { Feedback, LessonStep, Vec3 } from '../../lib/types';
import { Edges } from '@react-three/drei';

const TARGETS: { p: Vec3; hidden?: boolean; hint: string }[] = [
  { p: [40, 10, 0], hint: 'Slide along X only (red axis).' },
  { p: [40, 50, 0], hint: 'Now lift it along Y (green axis).' },
  { p: [-30, 10, 40], hidden: true, hint: 'Invisible target! Use its coordinates: change X, Y and Z.' },
];
const START: Vec3 = [0, 10, 0];

const steps: LessonStep[] = [
  {
    stage: 'OBSERVE',
    text: 'This is 3D space. Three coloured axes meet at the origin (0, 0, 0): X (red) runs left–right, Y (green) runs up–down, Z (blue) runs towards you and away.',
    ta: 'இது முப்பரிமாண (3D) வெளி. மூன்று அச்சுகள் origin (0,0,0)-இல் சந்திக்கின்றன: X (சிவப்பு) இடது–வலது, Y (பச்சை) மேல்–கீழ், Z (நீலம்) முன்–பின்.',
  },
  {
    stage: 'TOUCH',
    text: 'Choose "Orbit view", then drag one finger on the scene to look around; pinch to zoom. Try the Front / Top / Side buttons — each one looks straight down an axis.',
    ta: '"Orbit view" தேர்வு செய்து, ஒரு விரலால் இழுத்து சுற்றிப் பாருங்கள்; இரண்டு விரல்களால் pinch செய்து zoom செய்யுங்கள்.',
  },
  {
    stage: 'EXPERIMENT',
    text: 'Choose "Drag cube" and an axis (X, Y or Z). Drag anywhere: the cube can only slide along that axis, so only one number changes. "Floor XZ" lets it slide across the floor.',
    ta: '"Drag cube" மற்றும் ஒரு அச்சைத் தேர்ந்தெடுத்து இழுக்கவும். அந்த அச்சின் வழியே மட்டுமே cube நகரும் — ஒரே ஒரு எண் மட்டும் மாறும்.',
  },
  {
    stage: 'UNDERSTAND',
    text: 'Every position is written (x, y, z) in millimetres. +X is right, +Y is up, +Z is towards you. This lab is "Y-up" like most game engines; many CAD tools are "Z-up" — same idea, different labels.',
    ta: 'ஒவ்வொரு நிலையும் (x, y, z) என mm-இல் எழுதப்படுகிறது. +X வலது, +Y மேல், +Z உங்களை நோக்கி.',
  },
  {
    stage: 'BUILD',
    text: 'Challenge: move the cube onto each glowing target. The third target is invisible — you must use its coordinates.',
    ta: 'சவால்: ஒவ்வொரு ஒளிரும் இலக்கின் மீதும் cube-ஐ நகர்த்துங்கள். மூன்றாவது இலக்கு கண்ணுக்குத் தெரியாது — அதன் ஆயத்தொலைவுகளைப் பயன்படுத்துங்கள்.',
  },
  { stage: 'TEST', text: 'Tap "Check my work" for feedback. You can retry as many times as you like.', ta: 'பின்னூட்டம் பெற "Check my work" அழுத்தவும்.' },
];

export default function L1Axes() {
  const { difficulty } = useSettings();
  const tol = absTol(difficulty);
  const [pos, setPos] = useState<Vec3>(START);
  const [mode, setMode] = useState<'drag' | 'gizmo' | 'orbit'>('drag');
  const [axis, setAxis] = useState<DragAxis>('x');
  const [snapOn, setSnapOn] = useState(true);
  const [reached, setReached] = useState<boolean[]>([false, false, false]);
  const [axesUsed, setAxesUsed] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewName>('persp');
  const [corr, setCorr] = useState(false);
  const [flash, setFlash] = useState<number | null>(null);
  const cube = useRef<THREE.Mesh>(null);
  const posRef = useRef(pos);
  posRef.current = pos;
  const current = reached.findIndex((r) => !r);

  const moveTo = (p: Vec3) => {
    const prev = posRef.current;
    const used = new Set(axesUsed);
    ['x', 'y', 'z'].forEach((a, i) => {
      if (Math.abs(p[i] - prev[i]) > 0.01) used.add(a);
    });
    if (used.size !== axesUsed.size) setAxesUsed(used);
    setPos(p);
  };

  useEffect(() => {
    if (current < 0) return;
    if (dist3(pos, TARGETS[current].p) <= tol) {
      const r = [...reached];
      r[current] = true;
      setReached(r);
      setFlash(current);
      setTimeout(() => setFlash(null), 1200);
    }
  }, [pos, current, reached, tol]);

  const nudge = (d: number) => {
    const p = [...pos] as Vec3;
    const k = axis === 'x' ? 0 : axis === 'y' ? 1 : axis === 'z' ? 2 : 0;
    p[k] += d;
    moveTo(p);
  };

  const evaluate = (): Feedback => {
    const n = reached.filter(Boolean).length;
    const correct: string[] = [];
    const issues: Feedback['issues'] = [];
    reached.forEach((r, i) => {
      const t = TARGETS[i].p;
      if (r) correct.push(`Reached target ${i + 1} at (${t.join(', ')}).`);
      else {
        const d = t.map((v, k) => v - pos[k]);
        const parts = ['x', 'y', 'z']
          .map((a, k) => (Math.abs(d[k]) > tol ? `${a.toUpperCase()} ${d[k] > 0 ? '+' : ''}${fmt(d[k])} mm` : null))
          .filter(Boolean);
        issues.push({ label: `Target ${i + 1} at (${t.join(', ')}) not reached yet.`, detail: i === current ? `From where the cube is now, move ${parts.join(', ')}.` : 'Reach the earlier targets first.' });
      }
    });
    if (axesUsed.size === 3) correct.push('You moved along all three axes: X, Y and Z.');
    else issues.push({ label: `You have used ${axesUsed.size} of 3 axes.`, detail: 'Try every axis — each one is an independent direction.' });
    const score = Math.round(n * 30 + (axesUsed.size === 3 ? 10 : axesUsed.size * 3));
    return {
      score,
      correct,
      issues,
      why: 'Every CAD tool, game engine and 3D printer describes position with three independent numbers. If you can move along one axis at a time, you can place anything precisely — and read any coordinate in a drawing.',
      suggestion: n < 3 ? 'Select one axis, drag until only that coordinate matches the target, then switch axis. Watch the (x, y, z) label above the cube.' : 'Try the Top view: it hides Y entirely, so you only see X and Z — a 2D map of the floor.',
      canShowCorrection: n < 3,
    };
  };

  const retry = () => {
    setPos(START);
    setReached([false, false, false]);
    setAxesUsed(new Set());
  };

  const tgt = current >= 0 ? TARGETS[current] : null;

  const viewport = (
    <Stage3D
      axes={70}
      fit={110}
      view={view}
      onViewChange={setView}
      camera={[115, 100, 165]}
      overlay={
        <>
          <div className="overlay-tl">
            <div className="hud mono" style={{ fontSize: 15 }}>
              <span style={{ color: 'var(--x)' }}>x {fmt(pos[0])}</span> · <span style={{ color: 'var(--y)' }}>y {fmt(pos[1])}</span> ·{' '}
              <span style={{ color: 'var(--z)' }}>z {fmt(pos[2])}</span> mm
            </div>
          </div>
          {flash != null && (
            <div className="overlay-tc">
              <div className="hud" style={{ borderColor: 'var(--good)', fontSize: 16 }}>
                🎯 Target {flash + 1} reached!
              </div>
            </div>
          )}
          <div className="overlay-bl">
            <div className="hud" style={{ fontSize: 12 }}>
              {mode === 'drag' ? `☝ Drag anywhere to move along ${axis === 'xz' ? 'the floor (X & Z)' : axis.toUpperCase()}` : mode === 'gizmo' ? 'Drag the coloured arrows' : 'Drag to orbit · pinch to zoom'}
            </div>
          </div>
        </>
      }
    >
      <mesh ref={cube} position={pos} castShadow>
        <boxGeometry args={[20, 20, 20]} />
        <meshStandardMaterial color="#4cc9f0" roughness={0.35} />
        <Edges color="#0b0f14" />
      </mesh>
      <Label position={[pos[0], pos[1] + 18, pos[2]]} color="#9ff0ff">
        ({fmt(pos[0])}, {fmt(pos[1])}, {fmt(pos[2])})
      </Label>
      <CoordinateGuides p={pos} />
      {TARGETS.map((t, i) =>
        reached[i] ? (
          <mesh key={i} position={t.p}>
            <boxGeometry args={[20, 20, 20]} />
            <meshBasicMaterial color="#3fb950" transparent opacity={0.12} />
            <Edges color="#3fb950" />
          </mesh>
        ) : null,
      )}
      {tgt && (!tgt.hidden || corr) && (
        <mesh position={tgt.p}>
          <boxGeometry args={[21, 21, 21]} />
          <meshBasicMaterial color="#ffd166" transparent opacity={0.18} depthWrite={false} />
          <Edges color="#ffd166" />
        </mesh>
      )}
      {tgt && corr && <Arrow3D from={pos} to={tgt.p} color="#ffd166" />}
      {mode === 'drag' && (
        <ObjectGestures
          enabled
          axis={axis}
          snap={snapOn ? 5 : 0}
          allowRotate={false}
          allowScale={false}
          get={() => ({ position: posRef.current, rotation: [0, 0, 0], scale: [1, 1, 1] })}
          onChange={(t) => moveTo(t.position)}
        />
      )}
      {mode === 'gizmo' && cube.current && (
        <TransformControls
          object={cube.current}
          mode="translate"
          size={1.2}
          translationSnap={snapOn ? 5 : null}
          showX={axis === 'x' || axis === 'xz'}
          showY={axis === 'y'}
          showZ={axis === 'z' || axis === 'xz'}
          onObjectChange={() => {
            const o = cube.current!;
            moveTo([o.position.x, o.position.y, o.position.z]);
          }}
        />
      )}
    </Stage3D>
  );

  return (
    <LevelShell
      id="w1-l1"
      steps={steps}
      viewport={viewport}
      evaluate={evaluate}
      onRetry={retry}
      onCorrection={setCorr}
      hints={[
        { en: 'Only one coordinate should change while you drag. If two change, you are on "Floor XZ".', ta: 'இழுக்கும் போது ஒரே ஒரு எண் மட்டுமே மாற வேண்டும்.' },
        { en: 'Target 3 is at x = −30, y = 10, z = 40. Negative X means left of the origin.', ta: 'இலக்கு 3: x = −30, y = 10, z = 40. எதிர்மறை X என்றால் origin-க்கு இடப்புறம்.' },
      ]}
    >
      <div>
        <div className="lbl">Touch controls</div>
        <Seg
          value={mode}
          onChange={setMode}
          options={[
            { v: 'drag', label: '☝ Drag cube' },
            { v: 'gizmo', label: '✥ Gizmo' },
            { v: 'orbit', label: '⟳ Orbit view' },
          ]}
        />
      </div>
      <div>
        <div className="lbl">Move along</div>
        <div className="btnrow">
          <Seg
            value={axis}
            onChange={(a) => {
              setAxis(a);
              if (mode === 'orbit') setMode('drag');
            }}
            options={[
              { v: 'x', label: 'X', cls: 'x' },
              { v: 'y', label: 'Y', cls: 'y' },
              { v: 'z', label: 'Z', cls: 'z' },
              { v: 'xz', label: 'Floor XZ' },
            ]}
          />
        </div>
        {axis !== 'xz' && (
          <div className="btnrow" style={{ marginTop: 6 }}>
            {[-10, -1, 1, 10].map((d) => (
              <button key={d} className="btn small" onClick={() => nudge(d)}>
                {d > 0 ? '+' : ''}
                {d} mm
              </button>
            ))}
          </div>
        )}
        <Toggle checked={snapOn} onChange={setSnapOn} label="Snap to 5 mm grid" />
      </div>
      <div>
        <div className="lbl">Targets</div>
        {TARGETS.map((t, i) => (
          <Task key={i} ok={reached[i]}>
            Target {i + 1}: <span className="mono">({t.p.join(', ')})</span> {t.hidden && <span className="tag">invisible</span>}
            {i === current && <div className="muted" style={{ fontSize: 12 }}>{t.hint}</div>}
          </Task>
        ))}
      </div>
      <button className="btn small" onClick={() => setPos(START)}>
        ↺ Return cube to start
      </button>
    </LevelShell>
  );
}
