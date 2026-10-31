import { Canvas } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { AxesGizmo, DefaultLights } from '../components/Stage3D';
import { navigate } from '../lib/router';
import { levelById, WORLDS } from '../worlds/meta';
import { READY } from '../worlds/ready';
import { rankOf, toolUnlocked, useProgress, worldUnlocked } from '../store/progress';
import { SettingsPanel } from '../components/SettingsPanel';
import { T } from '../components/ui';
import { todayKey } from '../lib/math';

function HeroScene() {
  return (
    <Canvas shadows="percentage" dpr={[1, 2]} camera={{ position: [80, 60, 90], fov: 40 }} style={{ touchAction: 'none' }}>
      <DefaultLights extent={80} />
      <OrbitControls autoRotate autoRotateSpeed={1.2} enablePan={false} enableDamping minDistance={60} maxDistance={220} touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }} />
      <AxesGizmo length={48} />
      <mesh position={[0, 12, 0]} castShadow>
        <boxGeometry args={[24, 24, 24]} />
        <meshStandardMaterial color="#4cc9f0" roughness={0.35} />
        <Edges color="#0b0f14" />
      </mesh>
      <mesh position={[0, 30, 0]} castShadow>
        <cylinderGeometry args={[6, 6, 12, 32]} />
        <meshStandardMaterial color="#f8961e" roughness={0.4} />
      </mesh>
      <mesh position={[0, 41, 0]} castShadow>
        <sphereGeometry args={[6, 32, 16]} />
        <meshStandardMaterial color="#e9edf2" metalness={0.6} roughness={0.25} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <shadowMaterial transparent opacity={0.3} />
      </mesh>
    </Canvas>
  );
}

export default function Home() {
  const s = useProgress();
  const r = rankOf(s.xp);
  const doneCount = Object.values(s.results).filter((x) => x.completed).length;
  const last = s.lastLevel ? levelById(s.lastLevel) : undefined;
  const sketchOk = toolUnlocked('sketch3d', s);
  const dailyDone = (s.daily[todayKey()] ?? 0) >= 70;

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="tag partial">Interactive 3D learning lab</div>
          <h1 style={{ marginTop: 10 }}>
            THE <span>3D LAB</span>
          </h1>
          <h3 className="muted" style={{ fontWeight: 500 }}>From Imagination to Reality</h3>
          <T
            en="Learn to think in 3D, model useful objects, understand why they work, and prepare them for manufacturing — by touching, building and testing, not by reading."
            ta="3D-இல் சிந்திக்கவும், பயனுள்ள பொருட்களை மாடல் செய்யவும், அவை ஏன் வேலை செய்கின்றன என்பதைப் புரிந்துகொள்ளவும் — தொட்டு, கட்டி, சோதித்துக் கற்றுக்கொள்ளுங்கள்."
          />
          <div className="loop" aria-label="Learning sequence">
            {['OBSERVE', 'TOUCH', 'EXPERIMENT', 'UNDERSTAND', 'BUILD', 'TEST', 'IMPROVE'].map((x, i) => (
              <span key={x}>
                <b>{x}</b>
                {i < 6 ? ' →' : ''}
              </span>
            ))}
          </div>
          <div className="btnrow">
            {last && READY.has(last.id) ? (
              <button className="btn primary" onClick={() => navigate(`/level/${last.id}`)}>
                ▶ Continue: {last.title}
              </button>
            ) : (
              <button className="btn primary" onClick={() => navigate('/level/w1-l1')}>
                ▶ Start: Meet the 3D World
              </button>
            )}
            <button className="btn" onClick={() => navigate('/editor')}>
              🧊 Free-build editor
            </button>
            <button className="btn" onClick={() => navigate('/daily')}>
              📅 Daily challenge {dailyDone ? '✓' : ''}
            </button>
          </div>
          <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            {r.name} · {s.xp} XP · {doneCount} challenges cleared · {s.badges.length} badges
          </div>
        </div>
        <div className="heroview">
          <HeroScene />
          <div className="overlay-bl">
            <div className="hud" style={{ fontSize: 12 }}>
              Drag to rotate · pinch to zoom
            </div>
          </div>
        </div>
      </section>

      <div className="section-title">
        <h2>The nine worlds</h2>
        <a href="#/status" className="muted" style={{ fontSize: 13 }}>
          What is built vs planned →
        </a>
      </div>
      <div className="grid cols-3">
        {WORLDS.map((w) => {
          const ready = w.levels.filter((l) => READY.has(l.id));
          const done = ready.filter((l) => s.results[l.id]?.completed).length;
          const unlocked = worldUnlocked(w.n, s);
          const status = ready.length === 0 ? 'planned' : ready.length === w.levels.length ? 'ready' : 'partial';
          return (
            <div
              key={w.n}
              className={`card hover worldcard ${unlocked ? '' : 'locked'}`}
              style={{ borderTop: `3px solid ${w.color}` }}
              onClick={() => navigate(`/world/${w.n}`)}
              role="link"
            >
              <div className="btnrow" style={{ justifyContent: 'space-between' }}>
                <span className="num">WORLD {String(w.n).padStart(2, '0')}</span>
                <span className={`tag ${status}`}>{status === 'ready' ? 'Playable' : status === 'partial' ? `${ready.length}/${w.levels.length} playable` : `Planned · phase ${w.phase}`}</span>
              </div>
              <h3 style={{ margin: 0 }}>
                {!unlocked && '🔒 '}
                {w.title}
              </h3>
              {s.settings.tamil && (
                <div className="muted" lang="ta" style={{ fontSize: 13 }}>
                  {w.ta}
                </div>
              )}
              <div className="muted" style={{ fontSize: 13, flex: 1 }}>
                {w.goal}
              </div>
              {ready.length > 0 && (
                <>
                  <div className="progress">
                    <i style={{ width: `${(done / ready.length) * 100}%` }} />
                  </div>
                  <small>
                    {done}/{ready.length} complete
                  </small>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="section-title">
        <h2>Labs, studios & your work</h2>
      </div>
      <div className="grid cols-3">
        <div className="card hover" onClick={() => navigate('/editor')}>
          <h3>🧊 Free-build 3D Editor</h3>
          <div className="muted">Primitives, gizmos, snapping, grouping, undo/redo, materials, lights, save and export to STL / GLB / glTF.</div>
        </div>
        <div className={`card hover ${sketchOk ? '' : 'locked'}`} onClick={() => navigate('/sketch')}>
          <h3>{sketchOk ? '✏️' : '🔒'} Sketch-to-3D Studio</h3>
          <div className="muted">Draw a closed 2D profile and extrude it into a solid; edit the sketch and watch the model update. {sketchOk ? '' : 'Unlocks after World 01 · Level 3.'}</div>
        </div>
        <div className="card hover" onClick={() => navigate('/physics')}>
          <h3>🍎 Visual Physics Lab</h3>
          <div className="muted">Gravity, centre of mass, balance, friction, torque and stacking with a real rigid-body engine.</div>
        </div>
        <div className="card hover" onClick={() => navigate('/daily')}>
          <h3>📅 Daily 3D Challenge</h3>
          <div className="muted">A new build-from-primitives target every day.</div>
        </div>
        <div className="card hover" onClick={() => navigate('/gallery')}>
          <h3>🖼️ Model Gallery</h3>
          <div className="muted">Your saved models, versions and before / after comparisons.</div>
        </div>
        <div className="card hover" onClick={() => navigate('/portfolio')}>
          <h3>📁 Project Portfolio</h3>
          <div className="muted">Cleared challenges, missions, scores and skills in one printable page.</div>
        </div>
      </div>

      <div className="section-title">
        <h2>Settings</h2>
        <a href="#/profile" className="muted" style={{ fontSize: 13 }}>
          Skills, badges & tools →
        </a>
      </div>
      <SettingsPanel compact />
      <p className="muted" style={{ fontSize: 12, marginTop: 20 }}>
        All lessons run offline in your browser. Progress is saved on this device. Simplified physics and engineering demonstrations are labelled as such and are not a substitute for professional validation.
      </p>
    </div>
  );
}
