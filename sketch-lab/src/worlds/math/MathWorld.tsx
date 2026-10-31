import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType, type CSSProperties } from 'react';
import { GLOSSARY, type TermKey } from '../../core/glossary';
import { resetProgress, setLastRoute, storageAvailable, updateSettings, useAppState, type AppState } from '../../core/store';
import { href, useRoute } from '../../ui/router';
import { STAGES } from '../../ui/lesson';
import { Toggle } from '../../ui/kit';
import { LEVELS, PRIORITY, PUZZLES, TOOLS, type LevelMeta, type TopicMeta } from './registry';

const SketchToMath = lazy(() => import('./sketch/SketchToMath'));

export function topicDone(t: TopicMeta, s: AppState) {
  if (t.kind === 'challenge') return !!s.challenges[t.id]?.done;
  return (s.stages[t.id]?.length ?? 0) >= STAGES.length;
}

function levelProgress(l: LevelMeta, s: AppState) {
  const done = l.topics.filter((t) => topicDone(t, s)).length;
  return { done, total: l.topics.length };
}

const topicCache = new Map<string, ComponentType>();
function topicComponent(level: LevelMeta, id: string): ComponentType {
  const key = `${level.n}/${id}`;
  let c = topicCache.get(key);
  if (!c) {
    c = lazy(() =>
      level.load().then((m) => ({
        default: m.default[id] ?? (() => <p className="muted">This topic could not be found.</p>),
      })),
    );
    topicCache.set(key, c);
  }
  return c;
}

const puzzleCache = new Map<string, ComponentType>();
function puzzleComponent(id: string): ComponentType | null {
  const meta = PUZZLES.find((p) => p.id === id);
  if (!meta) return null;
  let c = puzzleCache.get(id);
  if (!c) {
    c = lazy(meta.load);
    puzzleCache.set(id, c);
  }
  return c;
}

function Loading() {
  return <div className="loading">Loading the workbench…</div>;
}

export default function MathWorld() {
  const route = useRoute();
  const [, section, a, b] = route;
  useEffect(() => {
    setLastRoute(window.location.hash);
    window.scrollTo({ top: 0 });
  }, [section, a, b]);

  if (section === 'level') {
    const level = LEVELS.find((l) => l.n === Number(a));
    if (level) return <LevelPage level={level} topicId={b} />;
  }
  if (section === 'sketch')
    return (
      <Suspense fallback={<Loading />}>
        <SketchToMath />
      </Suspense>
    );
  if (section === 'puzzles') return <Puzzles id={a} />;
  if (section === 'tools') return <Toolbox />;
  if (section === 'glossary') return <Glossary />;
  if (section === 'progress') return <ProgressPage />;
  return <WorldMap />;
}

function WorldMap() {
  const s = useAppState();
  return (
    <div className="world">
      <header className="world-hero">
        <div className="world-kicker">THE SKETCH LAB · WORLD 08</div>
        <h1>The Math Playground</h1>
        <p>Maths as a creative tool for sketching, measuring and inventing physical products. Nothing to memorise — move things and watch the numbers follow.</p>
        <ol className="philosophy">
          {STAGES.map((st) => (
            <li key={st.key}><span aria-hidden>{st.icon}</span> {st.label}</li>
          ))}
        </ol>
      </header>

      <h2 className="section-title">Start here</h2>
      <div className="priority-grid">
        {PRIORITY.map((p) => {
          const level = LEVELS.find((l) => l.n === p.level)!;
          const topic = level.topics.find((t) => t.id === p.topic)!;
          const done = topicDone(topic, s);
          return (
            <a key={p.topic} className="priority-card" href={href('math', 'level', level.n, topic.id)} style={{ borderColor: level.color }}>
              <span className="priority-icon">{level.icon}</span>
              <span className="priority-title">{topic.title}</span>
              <span className="priority-blurb">{p.blurb}</span>
              {done && <span className="tick">✔</span>}
            </a>
          );
        })}
      </div>

      <div className="special-grid">
        <a className="special-card sketch" href={href('math', 'sketch')}>
          <span className="special-icon">✍️</span>
          <span><b>Sketch-to-Math</b><br />Draw a shape — the lab measures it.</span>
        </a>
        <a className="special-card puzzles" href={href('math', 'puzzles')}>
          <span className="special-icon">🧩</span>
          <span><b>Puzzles</b><br />Fit, build, match and engineer.</span>
        </a>
        <a className="special-card tools" href={href('math', 'tools')}>
          <span className="special-icon">🧰</span>
          <span><b>Toolbox</b><br />Every maths tool, ready to use.</span>
        </a>
        <a className="special-card glossary" href={href('math', 'glossary')}>
          <span className="special-icon">அ</span>
          <span><b>Glossary</b><br />English ↔ தமிழ் maths words.</span>
        </a>
      </div>

      <h2 className="section-title">The 12 levels</h2>
      <div className="level-grid">
        {LEVELS.map((l) => {
          const { done, total } = levelProgress(l, s);
          return (
            <a key={l.n} className="level-card" href={href('math', 'level', l.n)} style={{ '--lc': l.color } as CSSProperties}>
              <div className="level-num">Level {l.n}</div>
              <div className="level-icon" aria-hidden>{l.icon}</div>
              <div className="level-title">{l.title}</div>
              <div className="level-tag">{l.tagline}</div>
              <div className="level-link">✏️ {l.sketchLink}</div>
              <div className="progress"><span style={{ width: `${(100 * done) / total}%` }} /></div>
              <div className="level-count">{done}/{total} complete</div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function LevelPage({ level, topicId }: { level: LevelMeta; topicId?: string }) {
  const s = useAppState();
  const topic = level.topics.find((t) => t.id === topicId) ?? level.topics[0];
  const Comp = useMemo(() => topicComponent(level, topic.id), [level, topic.id]);
  const i = level.topics.indexOf(topic);
  const prev = level.topics[i - 1];
  const next = level.topics[i + 1];
  const nextLevel = LEVELS.find((l) => l.n === level.n + 1);
  return (
    <div className="level-page" style={{ '--lc': level.color } as CSSProperties}>
      <header className="level-head">
        <span className="level-head-icon" aria-hidden>{level.icon}</span>
        <div>
          <div className="level-num">Level {level.n}</div>
          <h1>{level.title}</h1>
        </div>
      </header>
      <nav className="topic-tabs" aria-label="topics">
        {level.topics.map((t) => (
          <a key={t.id} href={href('math', 'level', level.n, t.id)} className={`topic-tab${t.id === topic.id ? ' active' : ''}${t.kind === 'challenge' ? ' challenge' : ''}`}>
            {topicDone(t, s) ? '✔ ' : t.kind === 'challenge' ? '🏁 ' : ''}
            {t.title}
          </a>
        ))}
      </nav>
      <Suspense fallback={<Loading />}>
        <Comp key={topic.id} />
      </Suspense>
      <nav className="topic-nav">
        {prev ? <a className="btn" href={href('math', 'level', level.n, prev.id)}>← {prev.title}</a> : <span />}
        {next ? (
          <a className="btn primary" href={href('math', 'level', level.n, next.id)}>{next.title} →</a>
        ) : nextLevel ? (
          <a className="btn primary" href={href('math', 'level', nextLevel.n)}>Level {nextLevel.n}: {nextLevel.title} →</a>
        ) : (
          <a className="btn primary" href={href('math', 'puzzles')}>On to the puzzles →</a>
        )}
      </nav>
    </div>
  );
}

function Puzzles({ id }: { id?: string }) {
  const s = useAppState();
  const Comp = id ? puzzleComponent(id) : null;
  if (Comp) {
    const meta = PUZZLES.find((p) => p.id === id)!;
    return (
      <div className="level-page" style={{ '--lc': '#d6336c' } as CSSProperties}>
        <header className="level-head">
          <span className="level-head-icon">{meta.icon}</span>
          <div>
            <div className="level-num">Puzzle</div>
            <h1>{meta.title}</h1>
          </div>
        </header>
        <nav className="topic-tabs">
          {PUZZLES.map((p) => (
            <a key={p.id} className={`topic-tab${p.id === id ? ' active' : ''}`} href={href('math', 'puzzles', p.id)}>
              {s.challenges[`puzzle-${p.id}`]?.done ? '✔ ' : ''}{p.icon} {p.title}
            </a>
          ))}
        </nav>
        <Suspense fallback={<Loading />}>
          <Comp key={id} />
        </Suspense>
      </div>
    );
  }
  return (
    <div className="world">
      <h1>Puzzles</h1>
      <p className="muted">Maths exercises dressed up as visual puzzles. Each one has hints, undo and a solution you can ask for.</p>
      <div className="puzzle-grid">
        {PUZZLES.map((p) => (
          <a key={p.id} className="puzzle-card" href={href('math', 'puzzles', p.id)}>
            <span className="puzzle-icon">{p.icon}</span>
            <b>{p.title}</b>
            <span className="muted">{p.blurb}</span>
            {s.challenges[`puzzle-${p.id}`]?.done && <span className="tick">✔</span>}
          </a>
        ))}
      </div>
    </div>
  );
}

function Toolbox() {
  return (
    <div className="world">
      <h1>The Toolbox</h1>
      <p className="muted">Every tool is a working instrument. Each opens inside the lesson where it is explained — use the lesson's stages, or just play.</p>
      <div className="puzzle-grid">
        {TOOLS.map((t) => {
          const level = LEVELS.find((l) => l.n === t.level)!;
          return (
            <a key={t.id} className="puzzle-card" href={href('math', 'level', t.level, t.topic)}>
              <span className="puzzle-icon">{t.icon}</span>
              <b>{t.title}</b>
              <span className="muted">Level {level.n} · {level.title}</span>
            </a>
          );
        })}
        <a className="puzzle-card" href={href('math', 'sketch')}>
          <span className="puzzle-icon">✍️</span>
          <b>Sketch-to-Math analyser</b>
          <span className="muted">Draw a shape and get its measurements</span>
        </a>
      </div>
    </div>
  );
}

function Glossary() {
  const { tamil } = useAppState().settings;
  const [q, setQ] = useState('');
  const entries = (Object.keys(GLOSSARY) as TermKey[])
    .map((k) => GLOSSARY[k])
    .filter((g) => !q || `${g.en} ${g.ta} ${g.tr} ${g.plain}`.toLowerCase().includes(q.toLowerCase()))
    .sort((x, y) => x.en.localeCompare(y.en));
  return (
    <div className="world">
      <h1>Glossary · சொல்லகராதி</h1>
      <div className="glossary-bar">
        <input className="search" placeholder="Search a word…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Toggle label="Tamil–English mode everywhere" checked={tamil} onChange={(v) => updateSettings({ tamil: v })} />
      </div>
      <table className="glossary">
        <thead>
          <tr><th>English</th><th>தமிழ்</th><th>Say it</th><th>Plain meaning</th></tr>
        </thead>
        <tbody>
          {entries.map((g) => (
            <tr key={g.en}>
              <td><b>{g.en}</b></td>
              <td lang="ta">{g.ta}</td>
              <td><i>{g.tr}</i></td>
              <td>{g.plain}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">Tamil terms follow common Tamil Nadu school usage. Some technical design words have no single standard Tamil term; a descriptive phrase is given.</p>
    </div>
  );
}

function ProgressPage() {
  const s = useAppState();
  const ok = storageAvailable();
  const topics = LEVELS.flatMap((l) => l.topics);
  const done = topics.filter((t) => topicDone(t, s)).length;
  const stars = Object.values(s.challenges).reduce((a, c) => a + (c.done ? c.stars : 0), 0);
  return (
    <div className="world">
      <h1>Your progress</h1>
      <p>{done} of {topics.length} topics complete · {stars} ★ earned</p>
      <p className="muted">{ok ? 'Progress is saved on this device (local storage).' : 'This browser blocks local storage, so progress lasts only until the page is closed.'}</p>
      {LEVELS.map((l) => {
        const p = levelProgress(l, s);
        return (
          <div key={l.n} className="progress-row">
            <span>{l.icon} Level {l.n}: {l.title}</span>
            <div className="progress"><span style={{ width: `${(100 * p.done) / p.total}%`, background: l.color }} /></div>
            <span>{p.done}/{p.total}</span>
          </div>
        );
      })}
      <button
        className="btn danger"
        onClick={() => {
          if (window.confirm('Erase all progress and stars on this device?')) resetProgress();
        }}
      >
        Erase progress
      </button>
    </div>
  );
}
