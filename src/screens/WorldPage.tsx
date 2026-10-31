import { useEffect } from 'react';
import { Badge, Button, Eyebrow, cx } from '../components/ui';
import { levelsOf, SKILLS, worldById, WORLDS, type WorldId } from '../game/content';
import { href, navigate } from '../lib/router';
import { useProgress } from '../state/progress';

export default function WorldPage({ id }: { id: string }) {
  const world = worldById(id);
  const { state, visitWorld, isUnlocked, setSettings } = useProgress();
  useEffect(() => { if (world) visitWorld(world.id as WorldId); }, [world, visitWorld]);
  if (!world) return <div className="p-10 text-ink-300">Unknown world. <a className="underline" href={href('')}>Go home</a></div>;
  const levels = levelsOf(world.id);
  const idx = WORLDS.findIndex((w) => w.id === world.id);
  const nextW = WORLDS[idx + 1];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <header className="grid gap-6 pt-10 pb-8 md:grid-cols-[auto_1fr] md:items-end">
        <span className="font-display text-[120px] leading-[0.8] text-ink-700 md:text-[160px]">{world.number}</span>
        <div className="vl-rise">
          <Eyebrow>{world.subject}</Eyebrow>
          <h1 className="mt-2 font-display text-[44px] leading-[1] text-ink-50 sm:text-[60px]">{world.title}</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-300">{world.description}</p>
          <div className="mt-4 flex h-2 w-40 overflow-hidden rounded-full">{world.swatch.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}</div>
        </div>
      </header>

      <ol className="divide-y divide-ink-800 border-y border-ink-800">
        {levels.map((l, i) => {
          const rec = state.levels[l.id];
          const unlocked = isUnlocked(l.id);
          const ready = l.status === 'ready';
          return (
            <li key={l.id} className="vl-rise" style={{ animationDelay: `${i * 35}ms` }}>
              <div className="grid gap-3 py-5 sm:grid-cols-[64px_1fr_auto] sm:items-center">
                <span className="font-mono text-[13px] text-ink-500">{world.id === 'w5' ? 'Mission' : 'Level'} {String(l.n).padStart(2, '0')}</span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={cx('font-display text-[26px] leading-tight', ready ? 'text-ink-50' : 'text-ink-300')}>{l.title}</h2>
                    {!ready && <Badge tone="warn">In development</Badge>}
                    {ready && !unlocked && <Badge tone="outline">Locked</Badge>}
                    {rec?.completed && <Badge tone="ok">Best {rec.best}</Badge>}
                  </div>
                  <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-300">{l.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {l.skills.map((s) => <Badge key={s} tone="outline">{SKILLS[s].label}</Badge>)}
                    <span className="ml-1 text-[11.5px] text-ink-500">{l.minutes} min · {l.xp} XP</span>
                  </div>
                  {ready && !unlocked && l.requires && (
                    <p className="mt-2 text-[12.5px] text-ink-400">Unlocks after: {l.requires.map((r) => levels.find((x) => x.id === r)?.title ?? r).join(', ')} — or{' '}
                      <button className="text-ink-200 underline underline-offset-4" onClick={() => setSettings({ freeExploration: true })}>turn on Free Exploration</button>.
                    </p>
                  )}
                </div>
                <div className="sm:text-right">
                  {ready && unlocked ? (
                    <Button variant={rec?.completed ? 'secondary' : 'primary'} onClick={() => navigate(`play/${l.id}`)}>{rec?.completed ? 'Replay' : 'Start'} →</Button>
                  ) : ready ? (
                    <Button disabled>Locked</Button>
                  ) : (
                    <Button variant="ghost" onClick={() => navigate(`play/${l.id}`)}>Preview plan</Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 flex flex-wrap justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate('')}>← All worlds</Button>
        {nextW && <Button onClick={() => navigate(`world/${nextW.id}`)}>World {nextW.number}: {nextW.title} →</Button>}
      </div>
    </div>
  );
}
