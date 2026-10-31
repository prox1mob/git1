import { Suspense, useEffect } from 'react';
import { LEVEL_COMPONENTS } from '../worlds/components';
import { levelById } from '../worlds/meta';
import { levelUnlocked, useProgress } from '../store/progress';
import { navigate } from '../lib/router';

export default function LevelHost({ id }: { id: string }) {
  const s = useProgress();
  const meta = levelById(id);
  const C = LEVEL_COMPONENTS[id];
  const open = levelUnlocked(id, s);
  useEffect(() => {
    if (meta && open) s.setLast(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!meta || !C) {
    return (
      <div className="page">
        <h2>{meta ? meta.title : 'Unknown level'}</h2>
        <p className="muted">This level is planned but not built yet.</p>
        <button className="btn" onClick={() => navigate(meta ? `/world/${meta.world}` : '/')}>
          Back
        </button>
      </div>
    );
  }
  if (!open) {
    return (
      <div className="page">
        <h2>🔒 {meta.title}</h2>
        <p className="muted">Complete the previous level first, or enable Explorer mode in Settings.</p>
        <button className="btn" onClick={() => navigate(`/world/${meta.world}`)}>
          Back to world
        </button>
      </div>
    );
  }
  return (
    <Suspense fallback={<div className="page muted">Loading level…</div>}>
      <C key={id} />
    </Suspense>
  );
}
