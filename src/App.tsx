import { lazy, Suspense, useEffect } from 'react';
import { navigate, useRoute } from './lib/router';
import { rankOf, useProgress } from './store/progress';
import { useToast } from './store/toast';
import Home from './screens/Home';
import WorldPage from './screens/WorldPage';
import LevelHost from './screens/LevelHost';
import Profile from './screens/Profile';
import Status from './screens/Status';

const Editor = lazy(() => import('./screens/editor/Editor'));
const SketchStudio = lazy(() => import('./screens/SketchStudio'));
const PhysicsLab = lazy(() => import('./screens/PhysicsLab'));
const Gallery = lazy(() => import('./screens/Gallery'));
const Portfolio = lazy(() => import('./screens/Portfolio'));
const Daily = lazy(() => import('./screens/Daily'));

function TopBar() {
  const xp = useProgress((s) => s.xp);
  const r = rankOf(xp);
  return (
    <header className="topbar">
      <div className="brand" onClick={() => navigate('/')} role="link" aria-label="Home">
        <img className="logo" src="./icon.svg" alt="" />
        <span>
          THE 3D LAB <small className="muted">From Imagination to Reality</small>
        </span>
      </div>
      <div className="spacer" />
      <button className="btn small ghost" onClick={() => navigate('/editor')}>
        Editor
      </button>
      <button className="btn small ghost" onClick={() => navigate('/profile')} aria-label="Profile and settings">
        <span className="xpchip">
          <b>{r.name}</b>
          <span className="xpbar">
            <i style={{ width: `${Math.round(r.frac * 100)}%` }} />
          </span>
          <span className="mono">{xp} XP</span>
        </span>
      </button>
    </header>
  );
}

function Toast() {
  const { msg, key } = useToast();
  if (!msg) return null;
  return (
    <div className="toast" key={key} role="status">
      {msg}
    </div>
  );
}

const Loading = () => (
  <div className="page muted" style={{ padding: 40 }}>
    Loading…
  </div>
);

export default function App() {
  const route = useRoute();
  const [a, b] = route.parts;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);

  let screen: React.ReactNode;
  let fill = false;
  switch (a) {
    case undefined:
      screen = <Home />;
      break;
    case 'world':
      screen = <WorldPage n={parseInt(b ?? '1', 10)} />;
      break;
    case 'level':
      screen = <LevelHost id={b ?? ''} />;
      fill = true;
      break;
    case 'editor':
      screen = <Editor projectId={route.query.get('project') ?? undefined} />;
      fill = true;
      break;
    case 'sketch':
      screen = <SketchStudio />;
      fill = true;
      break;
    case 'physics':
      screen = <PhysicsLab />;
      fill = true;
      break;
    case 'daily':
      screen = <Daily />;
      fill = true;
      break;
    case 'gallery':
      screen = <Gallery />;
      break;
    case 'portfolio':
      screen = <Portfolio />;
      break;
    case 'profile':
      screen = <Profile />;
      break;
    case 'status':
      screen = <Status />;
      break;
    default:
      screen = <Home />;
  }
  return (
    <div className="app">
      <TopBar />
      <main className={`main ${fill ? 'fill' : ''}`}>
        <Suspense fallback={<Loading />}>{screen}</Suspense>
      </main>
      <Toast />
    </div>
  );
}
