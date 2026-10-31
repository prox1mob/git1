import { useEffect, useState } from 'react';
import { deletePortfolio, listPortfolio, listProjects, type PortfolioEntry, type Project } from '../lib/storage';
import { BADGES, rankOf, useProgress } from '../store/progress';
import { ALL_LEVELS } from '../worlds/meta';
import { SkillRadar } from './Profile';
import { download } from '../lib/export';
import { navigate } from '../lib/router';

export default function Portfolio() {
  const s = useProgress();
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState(() => localStorage.getItem('the-3d-lab-name') ?? '');
  const load = async () => {
    setEntries(await listPortfolio());
    setProjects(await listProjects());
  };
  useEffect(() => {
    load();
  }, []);
  const cleared = ALL_LEVELS.filter((l) => s.results[l.id]?.completed);
  const r = rankOf(s.xp);

  return (
    <div className="page">
      <div className="btnrow no-print">
        <button className="btn small" onClick={() => navigate('/')}>
          ← Home
        </button>
        <button className="btn small" onClick={() => window.print()}>
          🖨 Print / save as PDF
        </button>
        <button
          className="btn small"
          onClick={() =>
            download(
              new Blob([JSON.stringify({ name, xp: s.xp, rank: r.name, results: s.results, badges: s.badges, entries: entries.map((e) => ({ ...e, thumb: undefined })) }, null, 2)], { type: 'application/json' }),
              'the-3d-lab-portfolio.json',
            )
          }
        >
          ⬇ Export JSON
        </button>
      </div>
      <h1 style={{ marginTop: 12 }}>
        Design portfolio{' '}
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            localStorage.setItem('the-3d-lab-name', e.target.value);
          }}
          style={{ display: 'inline-block', width: 220, fontSize: 18 }}
        />
      </h1>
      <div className="grid cols-2">
        <div className="card">
          <h3>{r.name}</h3>
          <div className="kv">
            <span>Experience</span>
            <span>{s.xp} XP</span>
            <span>Challenges cleared</span>
            <span>{cleared.length}</span>
            <span>Badges</span>
            <span>{s.badges.length}</span>
            <span>Saved models</span>
            <span>{projects.length}</span>
          </div>
          <div style={{ marginTop: 10 }}>
            {s.badges.map((b) => {
              const bd = BADGES.find((x) => x.id === b);
              return (
                <span key={b} className="badge-pop">
                  {bd?.icon} {bd?.name}
                </span>
              );
            })}
          </div>
        </div>
        <div className="card" style={{ display: 'grid', placeItems: 'center' }}>
          <SkillRadar size={280} />
        </div>
      </div>

      <h2 style={{ marginTop: 20 }}>Projects & missions</h2>
      {entries.length === 0 ? (
        <p className="muted">Add models from the Gallery, or complete Inventor’s Garage missions, to build your portfolio.</p>
      ) : (
        <div className="grid cols-2">
          {entries.map((e) => (
            <div key={e.id} className="card">
              {e.thumb && <img src={e.thumb} alt="" style={{ width: '100%', borderRadius: 8 }} />}
              <h3 style={{ marginTop: 6 }}>{e.title}</h3>
              <div className="muted" style={{ fontSize: 12 }}>
                {new Date(e.at).toLocaleDateString()} {e.score != null && `· score ${e.score}/100`}
              </div>
              {e.notes && <p style={{ fontSize: 14 }}>{e.notes}</p>}
              {e.rubric && (
                <ul style={{ fontSize: 13, paddingLeft: 18 }}>
                  {e.rubric.map((rr) => (
                    <li key={rr.criterion}>
                      {rr.criterion}: {Math.round(rr.points)}/{rr.max}
                    </li>
                  ))}
                </ul>
              )}
              <button
                className="btn small danger no-print"
                onClick={async () => {
                  await deletePortfolio(e.id);
                  load();
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: 20 }}>Cleared challenges</h2>
      {cleared.length === 0 ? (
        <p className="muted">No challenges cleared yet.</p>
      ) : (
        <div className="card">
          <table style={{ width: '100%', fontSize: 13 }}>
            <tbody>
              {cleared.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '4px 0' }}>
                    World {l.world} · {l.title}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {s.results[l.id].first} → {s.results[l.id].best}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: 12 }}>
            Scores show first attempt → best attempt.
          </p>
        </div>
      )}
      <style>{`@media print { .topbar, .no-print { display: none !important; } body { background: #fff; color: #000; } .card { border-color: #ccc; background: #fff; } }`}</style>
    </div>
  );
}
