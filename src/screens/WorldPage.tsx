import { navigate } from '../lib/router';
import { WORLDS } from '../worlds/meta';
import { READY } from '../worlds/ready';
import { levelUnlocked, useProgress, worldUnlocked } from '../store/progress';
import { Stars } from '../components/ui';

export default function WorldPage({ n }: { n: number }) {
  const s = useProgress();
  const w = WORLDS[n - 1];
  if (!w) return <div className="page">Unknown world.</div>;
  const unlocked = worldUnlocked(n, s);
  return (
    <div className="page">
      <div className="btnrow">
        <button className="btn small" onClick={() => navigate('/')}>
          ← All worlds
        </button>
        {n > 1 && (
          <button className="btn small ghost" onClick={() => navigate(`/world/${n - 1}`)}>
            ‹ World {n - 1}
          </button>
        )}
        {n < 9 && (
          <button className="btn small ghost" onClick={() => navigate(`/world/${n + 1}`)}>
            World {n + 1} ›
          </button>
        )}
      </div>
      <div style={{ borderLeft: `4px solid ${w.color}`, paddingLeft: 12, margin: '16px 0' }}>
        <div className="muted mono">WORLD {String(n).padStart(2, '0')} · PHASE {w.phase}</div>
        <h1>{w.title}</h1>
        {s.settings.tamil && <div className="ta" lang="ta">{w.ta}</div>}
        <div className="muted">Goal: {w.goal}</div>
      </div>
      {!unlocked && (
        <div className="note warn">
          🔒 This world unlocks when you complete at least half of the playable levels in World {String(n - 1).padStart(2, '0')}. You can also turn on Explorer mode in Settings to open everything.
        </div>
      )}
      <div className="grid" style={{ gap: 8 }}>
        {w.levels.map((l) => {
          const ready = READY.has(l.id);
          const open = levelUnlocked(l.id, s);
          const r = s.results[l.id];
          return (
            <div
              key={l.id}
              className={`card levelrow ${open ? 'hover' : 'locked'}`}
              onClick={() => open && navigate(`/level/${l.id}`)}
              role={open ? 'link' : undefined}
              aria-disabled={!open}
            >
              <div className={`idx ${r?.completed ? 'done' : ''}`}>{r?.completed ? '✓' : l.n}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>
                  {!open && ready && '🔒 '}
                  {l.title}
                  {s.settings.tamil && (
                    <span className="muted" lang="ta" style={{ fontWeight: 400, fontSize: 13 }}>
                      {' '}
                      · {l.ta}
                    </span>
                  )}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {l.summary}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {ready ? (
                  r ? (
                    <>
                      <Stars score={r.best} />
                      <div className="muted mono" style={{ fontSize: 12 }}>
                        best {r.best} · {r.attempts} tries
                      </div>
                    </>
                  ) : (
                    <span className="tag ready">{l.xp} XP</span>
                  )
                ) : (
                  <span className="tag planned">Planned</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {w.levels.some((l) => !READY.has(l.id)) && (
        <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
          Levels marked “Planned” are designed but not built yet; they cannot be opened. See the <a href="#/status">build status</a> page.
        </p>
      )}
    </div>
  );
}
