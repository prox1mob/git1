import { BADGES, RANKS, TOOLS, rankOf, skillScores, toolUnlocked, useProgress } from '../store/progress';
import { SKILLS } from '../lib/types';
import { SettingsPanel } from '../components/SettingsPanel';
import { ALL_LEVELS } from '../worlds/meta';
import { navigate } from '../lib/router';

export function SkillRadar({ size = 300 }: { size?: number }) {
  const results = useProgress((s) => s.results);
  const sc = skillScores(results);
  const cx = size / 2,
    cy = size / 2,
    R = size / 2 - 50;
  const n = SKILLS.length;
  const pt = (i: number, f: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f];
  };
  const vals = SKILLS.map((k) => {
    const v = sc[k.id];
    return v && v.max > 0 ? v.score / v.max : 0;
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }} role="img" aria-label="Skill radar">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={SKILLS.map((_, i) => pt(i, f).join(',')).join(' ')} fill="none" stroke="#2a3644" />
      ))}
      {SKILLS.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#2a3644" />;
      })}
      <polygon points={vals.map((v, i) => pt(i, Math.max(0.02, v)).join(',')).join(' ')} fill="rgba(76,201,240,0.3)" stroke="#4cc9f0" strokeWidth={2} />
      {SKILLS.map((k, i) => {
        const [x, y] = pt(i, 1.2);
        return (
          <text key={k.id} x={x} y={y} fill="#8d9aa8" fontSize={10.5} textAnchor="middle" dominantBaseline="middle">
            {k.name} {Math.round(vals[i] * 100)}%
          </text>
        );
      })}
    </svg>
  );
}

export default function Profile() {
  const s = useProgress();
  const r = rankOf(s.xp);
  const played = ALL_LEVELS.filter((l) => s.results[l.id]);
  return (
    <div className="page">
      <h1>Your lab profile</h1>
      <div className="grid cols-2">
        <div className="card">
          <h3>
            Rank: {r.name} {s.settings.tamil && <span className="muted" lang="ta">· {r.ta}</span>}
          </h3>
          <div className="progress" style={{ height: 10 }}>
            <i style={{ width: `${r.frac * 100}%`, background: 'linear-gradient(90deg,#4cc9f0,#f8961e)' }} />
          </div>
          <p className="muted" style={{ marginTop: 6 }}>
            {s.xp} XP {r.next ? `· ${r.next.xp - s.xp} XP to ${r.next.name}` : '· top rank reached'}
          </p>
          <div className="muted" style={{ fontSize: 12 }}>
            Ranks: {RANKS.map((x) => `${x.name} (${x.xp})`).join(' → ')}
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            XP is awarded for improving your best score on each challenge, so retries are always worthwhile but never “farmed”.
          </p>
        </div>
        <div className="card" style={{ display: 'grid', placeItems: 'center' }}>
          <h3 style={{ alignSelf: 'start' }}>Skill tracking</h3>
          <SkillRadar />
        </div>
      </div>

      <div className="section-title">
        <h2>Badges</h2>
        <span className="muted">
          {s.badges.length}/{BADGES.length}
        </span>
      </div>
      <div className="grid cols-4">
        {BADGES.map((b) => {
          const got = s.badges.includes(b.id);
          return (
            <div key={b.id} className={`card ${got ? '' : 'locked'}`} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 30, filter: got ? 'none' : 'grayscale(1)' }}>{b.icon}</div>
              <b>{b.name}</b>
              <div className="muted" style={{ fontSize: 12 }}>
                {b.desc}
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-title">
        <h2>Unlockable tools</h2>
      </div>
      <div className="grid cols-2">
        {TOOLS.map((t) => {
          const ok = toolUnlocked(t.id, s);
          return (
            <div key={t.id} className={`card ${ok ? '' : 'locked'}`}>
              <b>
                {ok ? '🔓' : '🔒'} {t.name}
              </b>
              <div className="muted" style={{ fontSize: 13 }}>
                In: {t.where} · {ok ? 'unlocked' : `complete ${t.requires.toUpperCase().replace('-', ' ')} to unlock`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-title">
        <h2>Challenge history</h2>
      </div>
      {played.length === 0 ? (
        <p className="muted">No challenges attempted yet.</p>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr className="muted" style={{ textAlign: 'left' }}>
                <th>Level</th>
                <th>First</th>
                <th>Best</th>
                <th>Tries</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {played.map((l) => {
                const x = s.results[l.id];
                return (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate(`/level/${l.id}`)}>
                    <td style={{ padding: '6px 0' }}>
                      W{l.world}·L{l.n} {l.title}
                    </td>
                    <td className="mono">{x.first}</td>
                    <td className="mono">{x.best}</td>
                    <td className="mono">{x.attempts}</td>
                    <td>{x.completed ? <span className="tag done">cleared</span> : <span className="tag">in progress</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="section-title">
        <h2>Settings</h2>
      </div>
      <SettingsPanel />
      <div className="card" style={{ marginTop: 12 }}>
        <h3>Reset</h3>
        <p className="muted">Erase XP, scores, badges and settings on this device. Saved gallery models are kept.</p>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('Reset all progress on this device? This cannot be undone.')) s.reset();
          }}
        >
          Reset progress
        </button>
      </div>
    </div>
  );
}
