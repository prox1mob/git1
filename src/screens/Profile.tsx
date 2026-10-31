import { useRef, useState } from 'react';
import { Badge, Button, Eyebrow, Meter, Segmented, Toggle, cx } from '../components/ui';
import { useToast } from '../components/Toaster';
import { ACHIEVEMENTS, LEVELS, rankFor, RANKS, SANDBOX_TOOLS, SKILLS, levelById, type SkillId } from '../game/content';
import { useProgress, type Difficulty } from '../state/progress';

export default function Profile() {
  const { state, mastery, setSettings, reset, importState, persistent } = useProgress();
  const toast = useToast();
  const rank = rankFor(state.xp);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const groups = Array.from(new Set(Object.values(SKILLS).map((s) => s.group)));
  const completed = LEVELS.filter((l) => state.levels[l.id]?.completed);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'visual-lab-progress.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <header className="pt-10 pb-6">
        <Eyebrow>Your studio record</Eyebrow>
        <h1 className="mt-2 font-display text-[52px] leading-none text-ink-50">{rank.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="num font-mono text-[14px] text-ink-200">{state.xp} XP</span>
          <Meter value={rank.progress * 100} tone="neutral" className="w-64" />
          <span className="text-[12px] text-ink-400">{rank.next ? `${rank.next - state.xp} XP to ${rank.nextTitle}` : 'Top rank'}</span>
        </div>
        <ol className="mt-4 flex flex-wrap gap-1.5">
          {RANKS.map((r, i) => <li key={r.title}><Badge tone={i <= rank.index ? 'neutral' : 'outline'}>{r.title}</Badge></li>)}
        </ol>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl bg-ink-850 p-6 ring-1 ring-ink-750">
          <Eyebrow>Skill mastery</Eyebrow>
          <p className="mt-1 text-[12.5px] text-ink-400">Average of your best scores in every playable lesson that trains the skill.</p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-2 text-[12px] font-semibold text-ink-300">{g}</p>
                <ul className="space-y-2.5">
                  {(Object.keys(SKILLS) as SkillId[]).filter((s) => SKILLS[s].group === g).map((s) => (
                    <li key={s}>
                      <div className="flex justify-between text-[12.5px]"><span className="text-ink-200">{SKILLS[s].label}</span><span className="num font-mono text-[11.5px] text-ink-400">{mastery(s)}%</span></div>
                      <Meter value={mastery(s)} tone="neutral" className="mt-1" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-2xl bg-ink-850 p-6 ring-1 ring-ink-750">
            <Eyebrow>Settings</Eyebrow>
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 text-[13px] text-ink-200">Difficulty</p>
                <Segmented<Difficulty> value={state.settings.difficulty} onChange={(d) => setSettings({ difficulty: d })} label="Difficulty"
                  options={[{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} />
                <p className="mt-2 text-[12px] leading-relaxed text-ink-400">Higher difficulty tightens tolerances, hides live meters and uses subtler targets. XP is multiplied by 1×, 1.25× and 1.5×.</p>
              </div>
              <Toggle checked={state.settings.freeExploration} onChange={(v) => setSettings({ freeExploration: v })} label="Free Exploration — unlock every mission and sandbox tool" />
              <Toggle checked={state.settings.showHints} onChange={(v) => setSettings({ showHints: v })} label="Offer optional hints" />
            </div>
          </div>
          <div className="rounded-2xl bg-ink-850 p-6 ring-1 ring-ink-750">
            <Eyebrow>Unlocked sandbox tools</Eyebrow>
            <ul className="mt-3 space-y-1.5 text-[13px]">
              {SANDBOX_TOOLS.map((t) => {
                const on = !t.unlockedBy || state.settings.freeExploration || state.levels[t.unlockedBy]?.completed;
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3">
                    <span className={on ? 'text-ink-100' : 'text-ink-500'}>{t.label}</span>
                    <span className="text-[11.5px] text-ink-500">{on ? 'Unlocked' : `Complete “${levelById(t.unlockedBy!)?.title}”`}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-2xl bg-ink-850 p-6 ring-1 ring-ink-750">
        <Eyebrow>Achievements · {Object.keys(state.achievements).length} / {ACHIEVEMENTS.length}</Eyebrow>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const got = state.achievements[a.id];
            return (
              <li key={a.id} className={cx('flex items-center gap-3 rounded-xl p-3 ring-1', got ? 'bg-ink-800 ring-ink-600' : 'ring-ink-750')}>
                <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-[15px]', got ? 'bg-ink-100 text-ink-950' : 'bg-ink-800 text-ink-600')}>{a.glyph}</span>
                <div>
                  <p className={cx('text-[13.5px] font-medium', got ? 'text-ink-50' : 'text-ink-400')}>{a.title}</p>
                  <p className="text-[12px] text-ink-500">{a.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-5 rounded-2xl bg-ink-850 p-6 ring-1 ring-ink-750">
        <Eyebrow>Lesson history</Eyebrow>
        {completed.length === 0 ? <p className="mt-3 text-[13px] text-ink-400">No challenges submitted yet.</p> : (
          <table className="mt-3 w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-ink-500"><tr><th className="py-2">Lesson</th><th>Best</th><th>Attempts</th><th className="hidden sm:table-cell">Recent scores</th></tr></thead>
            <tbody className="divide-y divide-ink-800">
              {completed.map((l) => {
                const r = state.levels[l.id];
                return (
                  <tr key={l.id}><td className="py-2 text-ink-100">{l.title}</td><td className="num font-mono">{r.best}</td><td className="num font-mono">{r.attempts}</td><td className="hidden font-mono text-ink-400 sm:table-cell">{r.history.join(' · ')}</td></tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={exportJson}>Export progress</Button>
        <Button onClick={() => fileRef.current?.click()}>Import progress</Button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const ok = importState(await f.text());
          toast({ title: ok ? 'Progress imported' : 'That file is not a Visual Lab progress export' });
        }} />
        {confirmReset ? (
          <span className="flex items-center gap-2 text-[13px] text-ink-300">Erase all progress?
            <Button size="sm" variant="primary" onClick={() => { reset(); setConfirmReset(false); toast({ title: 'Progress reset' }); }}>Yes, reset</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
          </span>
        ) : <Button variant="ghost" onClick={() => setConfirmReset(true)}>Reset progress…</Button>}
        {!persistent && <span className="text-[12px] text-warn">Storage unavailable: progress is not saved.</span>}
      </section>
    </div>
  );
}
