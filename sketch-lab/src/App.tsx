import { lazy, Suspense } from 'react';
import { updateSettings, useAppState } from './core/store';
import { DifficultyPicker, Toggle } from './ui/kit';
import { href, useRoute } from './ui/router';
import { WORLDS } from './worlds';
import { LEVELS } from './worlds/math/registry';

const MathWorld = lazy(() => import('./worlds/math/MathWorld'));

function Crumbs({ route }: { route: string[] }) {
  const [world, section, a] = route;
  const crumbs: { label: string; to: string }[] = [{ label: 'The Sketch Lab', to: href() }];
  if (world === 'math') {
    crumbs.push({ label: 'World 08 · Math Playground', to: href('math') });
    if (section === 'level') {
      const l = LEVELS.find((x) => x.n === Number(a));
      if (l) crumbs.push({ label: `Level ${l.n}`, to: href('math', 'level', l.n) });
    }
    if (section === 'sketch') crumbs.push({ label: 'Sketch-to-Math', to: href('math', 'sketch') });
    if (section === 'puzzles') crumbs.push({ label: 'Puzzles', to: href('math', 'puzzles') });
    if (section === 'tools') crumbs.push({ label: 'Toolbox', to: href('math', 'tools') });
    if (section === 'glossary') crumbs.push({ label: 'Glossary', to: href('math', 'glossary') });
    if (section === 'progress') crumbs.push({ label: 'Progress', to: href('math', 'progress') });
  }
  return (
    <nav className="crumbs" aria-label="breadcrumbs">
      {crumbs.map((c, i) => (
        <span key={c.to}>
          {i > 0 && <span className="crumb-sep">›</span>}
          <a href={c.to}>{c.label}</a>
        </span>
      ))}
    </nav>
  );
}

function TopBar({ route }: { route: string[] }) {
  const { tamil } = useAppState().settings;
  return (
    <header className="topbar">
      <a className="brand" href={href()}>
        <span className="brand-mark">✎</span> THE SKETCH LAB
      </a>
      <Crumbs route={route} />
      <div className="topbar-tools">
        <Toggle label={<span>தமிழ் terms</span>} checked={tamil} onChange={(v) => updateSettings({ tamil: v })} />
        <DifficultyPicker />
        {route[0] === 'math' && <a className="btn small" href={href('math', 'progress')}>★ Progress</a>}
      </div>
    </header>
  );
}

function Hub() {
  const s = useAppState();
  return (
    <div className="hub">
      <div className="hub-hero">
        <div className="hub-mark">✎</div>
        <h1>THE SKETCH LAB</h1>
        <p>Learn to see, sketch and invent physical products.</p>
      </div>
      <div className="world-list">
        {WORLDS.map((w) => (
          <a key={w.route} className="world-card" href={href(w.route)} style={{ borderColor: w.color }}>
            <div className="world-card-num" style={{ background: w.color }}>WORLD {String(w.n).padStart(2, '0')}</div>
            <div className="world-card-icon">{w.icon}</div>
            <div>
              <div className="world-card-title">{w.title}</div>
              <div className="world-card-sub">{w.subtitle}</div>
              <p>{w.blurb}</p>
            </div>
          </a>
        ))}
      </div>
      {s.lastRoute && s.lastRoute.length > 3 && (
        <a className="btn primary big resume" href={s.lastRoute}>▶ Continue where you left off</a>
      )}
    </div>
  );
}

export default function App() {
  const route = useRoute();
  return (
    <div className="app">
      <TopBar route={route} />
      <main className="main">
        {route[0] === 'math' ? (
          <Suspense fallback={<div className="loading">Opening the Math Playground…</div>}>
            <MathWorld />
          </Suspense>
        ) : (
          <Hub />
        )}
      </main>
    </div>
  );
}
