import { Suspense, useEffect } from 'react';
import { Loading } from '../components/Loading';
import { Badge, Button, Eyebrow } from '../components/ui';
import { levelById, worldById } from '../game/content';
import { LEVEL_COMPONENTS } from '../game/registry';
import { href, navigate } from '../lib/router';
import { useProgress } from '../state/progress';

export default function LevelPage({ id }: { id: string }) {
  const level = levelById(id);
  const { isUnlocked, setSettings, visitWorld } = useProgress();
  useEffect(() => { if (level) visitWorld(level.world); }, [level, visitWorld]);
  if (!level) return <div className="p-10 text-ink-300">Unknown lesson. <a className="underline" href={href('')}>Go home</a></div>;
  const world = worldById(level.world)!;
  const Comp = LEVEL_COMPONENTS[level.id];

  if (level.status !== 'ready' || !Comp) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <a href={href(`world/${world.id}`)} className="text-[12px] text-ink-400 hover:text-ink-100">← World {world.number} · {world.title}</a>
        <div className="mt-4 flex items-center gap-2"><Badge tone="warn">In development</Badge><span className="text-[12px] text-ink-500">Not playable yet — clearly labelled rather than faked.</span></div>
        <h1 className="mt-3 font-display text-[44px] leading-tight text-ink-50">{level.title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-300">{level.summary}</p>
        <div className="mt-6 rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750">
          <Eyebrow>What this lesson will do</Eyebrow>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-300">
            Like every lesson it will follow Observe → Experiment → Discover → Challenge → Feedback → Refine, with real measurements where they exist and a transparent rubric where taste is involved. Until it ships, the related tools are available in the Sandbox.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => navigate('sandbox')}>Open the Sandbox</Button>
            <Button variant="ghost" onClick={() => navigate(`world/${world.id}`)}>Back to the world</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isUnlocked(level.id)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <Badge tone="outline">Locked mission</Badge>
        <h1 className="mt-3 font-display text-[44px] leading-tight text-ink-50">{level.title}</h1>
        <p className="mt-3 text-[15px] text-ink-300">Complete {level.requires?.map((r) => levelById(r)?.title).join(' and ')} first — or explore freely.</p>
        <div className="mt-6 flex gap-3">
          <Button variant="primary" onClick={() => setSettings({ freeExploration: true })}>Turn on Free Exploration</Button>
          <Button variant="ghost" onClick={() => navigate(`world/${world.id}`)}>Back</Button>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<Loading label="Setting up the lesson…" />}>
      <Comp key={level.id} level={level} />
    </Suspense>
  );
}
