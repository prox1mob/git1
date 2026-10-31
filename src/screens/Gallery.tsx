import { useEffect, useState } from 'react';
import { deleteProject, listProjects, putPortfolio, putProject, type Project, type ProjectVersion } from '../lib/storage';
import { navigate } from '../lib/router';
import { objectVolume, objectBox } from '../lib/shapes';
import { flattenWorld } from '../store/editorStore';
import { fmt } from '../lib/math';
import * as THREE from 'three';
import { toast } from '../store/toast';

function versionStats(v: ProjectVersion) {
  const flat = flattenWorld(v.objects);
  let vol = 0;
  const box = new THREE.Box3();
  for (const o of flat) {
    try {
      vol += objectVolume(o);
      box.union(objectBox(o));
    } catch {
      /* skip */
    }
  }
  const s = new THREE.Vector3();
  if (!box.isEmpty()) box.getSize(s);
  return { parts: flat.length, vol, size: [s.x, s.y, s.z] };
}

function Compare({ a, b }: { a: ProjectVersion; b: ProjectVersion }) {
  const [pos, setPos] = useState(50);
  const sa = versionStats(a),
    sb = versionStats(b);
  return (
    <div className="card">
      <h3>Before / after</h3>
      <div style={{ position: 'relative', width: '100%', maxWidth: 640, aspectRatio: '16 / 10', background: '#10161d', borderRadius: 10, overflow: 'hidden' }}>
        {b.thumb && <img src={b.thumb} alt="after" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />}
        {a.thumb && <img src={a.thumb} alt="before" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', clipPath: `inset(0 ${100 - pos}% 0 0)` }} />}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos}%`, width: 2, background: '#f8961e' }} />
        <span className="hud" style={{ position: 'absolute', left: 8, top: 8 }}>
          Before
        </span>
        <span className="hud" style={{ position: 'absolute', right: 8, top: 8 }}>
          After
        </span>
      </div>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(+e.target.value)} aria-label="Before / after slider" />
      <table style={{ width: '100%', fontSize: 13 }}>
        <thead className="muted">
          <tr>
            <th style={{ textAlign: 'left' }} />
            <th>Before · {a.note}</th>
            <th>After · {b.note}</th>
          </tr>
        </thead>
        <tbody className="mono" style={{ textAlign: 'center' }}>
          <tr>
            <td style={{ textAlign: 'left' }}>Parts</td>
            <td>{sa.parts}</td>
            <td>{sb.parts}</td>
          </tr>
          <tr>
            <td style={{ textAlign: 'left' }}>Volume</td>
            <td>{fmt(sa.vol / 1000, 1)} cm³</td>
            <td>{fmt(sb.vol / 1000, 1)} cm³</td>
          </tr>
          <tr>
            <td style={{ textAlign: 'left' }}>Overall size</td>
            <td>{sa.size.map((v) => fmt(v, 0)).join('×')} mm</td>
            <td>{sb.size.map((v) => fmt(v, 0)).join('×')} mm</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function Gallery() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [open, setOpen] = useState<Project | null>(null);
  const [pair, setPair] = useState<[number, number]>([0, 0]);
  const reload = async () => setProjects(await listProjects());
  useEffect(() => {
    reload();
  }, []);

  if (open) {
    const vs = open.versions;
    return (
      <div className="page">
        <button className="btn small" onClick={() => setOpen(null)}>
          ← Gallery
        </button>
        <h1 style={{ marginTop: 10 }}>{open.name}</h1>
        <div className="btnrow">
          <button className="btn primary" onClick={() => navigate(`/editor?project=${open.id}`)}>
            Open in editor
          </button>
          <button
            className="btn"
            onClick={async () => {
              const name = prompt('Rename model', open.name);
              if (!name) return;
              const p = { ...open, name };
              await putProject(p);
              setOpen(p);
              reload();
            }}
          >
            Rename
          </button>
          <button
            className="btn"
            onClick={async () => {
              const v = vs[vs.length - 1];
              const notes = prompt('What problem does this model solve? (shown in your portfolio)', '') ?? '';
              await putPortfolio({ id: `pf-${open.id}`, title: open.name, at: new Date().toISOString(), thumb: v.thumb, notes });
              toast('📁 Added to your portfolio');
            }}
          >
            Add to portfolio
          </button>
          <button
            className="btn danger"
            onClick={async () => {
              if (!confirm(`Delete “${open.name}” and all its versions?`)) return;
              await deleteProject(open.id);
              setOpen(null);
              reload();
            }}
          >
            Delete
          </button>
        </div>
        <h3 style={{ marginTop: 16 }}>Versions ({vs.length})</h3>
        <div className="grid cols-4">
          {vs.map((v, i) => (
            <div key={v.at} className="card" style={{ padding: 8, borderColor: pair.includes(i) ? 'var(--accent)' : undefined }}>
              {v.thumb && <img src={v.thumb} alt="" style={{ width: '100%', borderRadius: 6 }} />}
              <b style={{ fontSize: 13 }}>
                v{i + 1} · {v.note}
              </b>
              <div className="muted" style={{ fontSize: 11 }}>
                {new Date(v.at).toLocaleString()}
              </div>
              <div className="btnrow" style={{ marginTop: 4 }}>
                <button className={`btn small ${pair[0] === i ? 'on' : ''}`} onClick={() => setPair([i, pair[1]])}>
                  Before
                </button>
                <button className={`btn small ${pair[1] === i ? 'on' : ''}`} onClick={() => setPair([pair[0], i])}>
                  After
                </button>
              </div>
            </div>
          ))}
        </div>
        {vs.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Compare a={vs[pair[0]] ?? vs[0]} b={vs[pair[1]] ?? vs[vs.length - 1]} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <button className="btn small" onClick={() => navigate('/')}>
        ← Home
      </button>
      <h1 style={{ marginTop: 10 }}>Model gallery</h1>
      <p className="muted">Every “Save” in the editor stores a new version with a thumbnail. Open a model to compare any two versions before / after.</p>
      {projects == null && <p className="muted">Loading…</p>}
      {projects?.length === 0 && (
        <div className="card">
          <p>No saved models yet.</p>
          <button className="btn primary" onClick={() => navigate('/editor')}>
            Open the editor
          </button>
        </div>
      )}
      <div className="grid cols-3">
        {projects?.map((p) => {
          const v = p.versions[p.versions.length - 1];
          return (
            <div
              key={p.id}
              className="card hover"
              onClick={() => {
                setOpen(p);
                setPair([0, p.versions.length - 1]);
              }}
            >
              {v?.thumb && <img src={v.thumb} alt="" style={{ width: '100%', borderRadius: 8 }} />}
              <b>{p.name}</b>
              <div className="muted" style={{ fontSize: 12 }}>
                {p.versions.length} version{p.versions.length === 1 ? '' : 's'} · updated {new Date(p.updatedAt).toLocaleDateString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
