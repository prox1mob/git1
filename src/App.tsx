import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { Loading } from './components/Loading';
import { ToastProvider } from './components/Toaster';
import { cx } from './components/ui';
import { rankFor } from './game/content';
import { href, useRoute } from './lib/router';
import { ProgressProvider, useProgress } from './state/progress';
import Home from './screens/Home';
import WorldPage from './screens/WorldPage';
import LevelPage from './screens/LevelPage';

const Profile = lazy(() => import('./screens/Profile'));
const Sandbox = lazy(() => import('./screens/Sandbox'));
const Gallery = lazy(() => import('./screens/Gallery'));
const Daily = lazy(() => import('./screens/Daily'));
const Notes = lazy(() => import('./screens/Notes'));

export default function App() {
  return (
    <ProgressProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </ProgressProvider>
  );
}

function Shell() {
  const route = useRoute();
  const [section, a] = route;
  let page: ReactNode;
  if (!section) page = <Home />;
  else if (section === 'world' && a) page = <WorldPage id={a} />;
  else if (section === 'play' && a) page = <LevelPage id={a} />;
  else if (section === 'profile') page = <Profile />;
  else if (section === 'sandbox') page = <Sandbox />;
  else if (section === 'gallery') page = <Gallery />;
  else if (section === 'daily') page = <Daily />;
  else if (section === 'notes') page = <Notes />;
  else page = <Home />;

  return (
    <div className="min-h-dvh">
      <TopBar active={section ?? ''} />
      <PersistenceBanner />
      <Suspense fallback={<Loading />}>{page}</Suspense>
    </div>
  );
}

function PersistenceBanner() {
  const { persistent } = useProgress();
  if (persistent) return null;
  return (
    <div className="bg-warn/10 px-4 py-2 text-center text-[12.5px] text-warn">
      Browser storage is unavailable (private mode or blocked), so progress will be kept only until you close this tab.
    </div>
  );
}

function TopBar({ active }: { active: string }) {
  const { state } = useProgress();
  const rank = rankFor(state.xp);
  useEffect(() => {
    document.title = 'The Visual Lab';
  }, [active]);
  const links: [string, string][] = [['', 'Worlds'], ['daily', 'Daily'], ['sandbox', 'Sandbox'], ['gallery', 'Gallery'], ['notes', 'Lab notes']];
  return (
    <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-900/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
        <a href={href('')} className="flex items-center gap-2.5 pr-2" aria-label="The Visual Lab — home">
          <span aria-hidden className="relative inline-block h-6 w-8">
            <span className="absolute top-0 left-0 h-6 w-6 rounded-full bg-[#ff5b3a] mix-blend-screen" />
            <span className="absolute top-0 left-2.5 h-6 w-6 rounded-full bg-[#4f86ff] mix-blend-screen opacity-90" />
          </span>
          <span className="font-display text-[21px] leading-none tracking-[-0.01em] text-ink-50">The Visual Lab</span>
        </a>
        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map(([to, label]) => (
            <a key={to} href={href(to)} className={cx('rounded-full px-3 py-1.5 text-[13px] transition-colors', (active === to || (to === '' && (active === 'world' || active === 'play'))) ? 'bg-ink-800 text-ink-50' : 'text-ink-300 hover:text-ink-50')}>
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a href={href('profile')} className="flex items-center gap-2.5 rounded-full py-1 pr-1 pl-3 ring-1 ring-ink-700 hover:ring-ink-500" aria-label={`Profile: ${rank.title}, ${state.xp} XP`}>
            <span className="hidden text-[12px] text-ink-300 sm:inline">{rank.title}</span>
            <span className="num rounded-full bg-ink-100 px-2.5 py-1 font-mono text-[11.5px] font-medium text-ink-950">{state.xp} XP</span>
          </a>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-ink-800 px-3 py-1.5 md:hidden" aria-label="Main (compact)">
        {[...links, ['profile', 'Profile'] as [string, string]].map(([to, label]) => (
          <a key={to} href={href(to)} className={cx('shrink-0 rounded-full px-3 py-1.5 text-[13px]', active === to ? 'bg-ink-800 text-ink-50' : 'text-ink-300')}>{label}</a>
        ))}
      </nav>
    </header>
  );
}
