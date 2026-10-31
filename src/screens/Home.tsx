import { useMemo } from 'react';
import { GradeCanvas } from '../components/grading/GradeCanvas';
import { Badge, Button, Meter, ProgressRing, Eyebrow, cx } from '../components/ui';
import { defaultParams } from '../engine/params';
import { LEVELS, levelById, levelsOf, rankFor, SKILLS, WORLDS, type SkillId } from '../game/content';
import { useClock, usePrefersReducedMotion } from '../lib/hooks';
import { todayKey } from '../lib/random';
import { href, navigate } from '../lib/router';
import { useProgress } from '../state/progress';

const START_HERE = ['w1-2', 'w3-2', 'w2-5'];

export default function Home() {
  const { state, mastery } = useProgress();
  const reduced = usePrefersReducedMotion();
  const [t] = useClock(!reduced, 20);
  const rank = rankFor(state.xp);
  const last = state.lastLevel ? levelById(state.lastLevel) : undefined;
  const heroParams = useMemo(() => defaultParams({ exposure: -0.15, contrast: 0.08, rolloff: 0.55 }), []);
  const dailyDone = state.daily.history[todayKey()] !== undefined;
  const readyCount = LEVELS.filter((l) => l.status === 'ready').length;
  const topSkills = (Object.keys(SKILLS) as SkillId[]).map((s) => ({ s, v: mastery(s) })).sort((a, b) => b.v - a.v).slice(0, 5);

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 sm:px-6">
      {/* Hero */}
      <section className="grid items-center gap-8 pt-8 pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:pt-14">
        <div className="vl-rise">
          <Eyebrow>An apprenticeship in seeing</Eyebrow>
          <h1 className="mt-3 font-display text-[52px] leading-[0.95] tracking-[-0.02em] text-ink-50 sm:text-[72px] xl:text-[86px]">
            Train the eye of an <em className="text-ink-200">art director.</em>
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-300">
            Five worlds of hands-on practice in colour, typography, photography and cinematic grading. You look first, experiment second, learn the science third — then solve real design problems, measured honestly.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {last && last.status === 'ready' ? (
              <Button variant="primary" size="lg" onClick={() => navigate(`play/${last.id}`)}>Continue: {last.title} →</Button>
            ) : (
              <Button variant="primary" size="lg" onClick={() => navigate('play/w1-2')}>Begin with the Colour Mixer →</Button>
            )}
            <Button size="lg" onClick={() => navigate('world/w1')}>Explore World 01</Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-ink-800 pt-6">
            <div className="min-w-[200px]">
              <p className="text-[12px] text-ink-400">Rank</p>
              <p className="font-display text-[24px] text-ink-50">{rank.title}</p>
              <Meter value={rank.progress * 100} tone="neutral" className="mt-2 w-48" />
              <p className="mt-1 text-[11.5px] text-ink-500">{rank.next ? `${rank.next - state.xp} XP to ${rank.nextTitle}` : 'Highest rank reached'}</p>
            </div>
            <div>
              <p className="text-[12px] text-ink-400">Daily streak</p>
              <p className="num font-display text-[24px] text-ink-50">{state.daily.streak} <span className="text-[14px] text-ink-400">days</span></p>
            </div>
            <div>
              <p className="text-[12px] text-ink-400">Lessons complete</p>
              <p className="num font-display text-[24px] text-ink-50">{Object.values(state.levels).filter((l) => l.completed).length}<span className="text-[14px] text-ink-400"> / {readyCount} playable</span></p>
            </div>
          </div>
        </div>
        <figure className="vl-rise" style={{ animationDelay: '120ms' }}>
          <GradeCanvas source={{ kind: 'scene', scene: 'coast' }} params={heroParams} time={t} aspect={3 / 2} label="Live render: a coast at dusk" maxPixels={1_200_000} className="shadow-2xl shadow-black/60" />
          <figcaption className="mt-3 flex items-baseline justify-between gap-4 text-[12px] text-ink-400">
            <span><span className="font-display text-[15px] italic text-ink-200">Plate 01.</span> Coast at dusk — rendered live in scene-linear light, sun ≈ 8 stops above mid-grey.</span>
            <a href={href('notes')} className="shrink-0 text-ink-300 hover:text-ink-50">How it works →</a>
          </figcaption>
        </figure>
      </section>

      {/* Start here */}
      <section className="mt-4">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <Eyebrow>Start here</Eyebrow>
            <h2 className="mt-1 font-display text-[32px] leading-tight text-ink-50">Three laboratories, fully open</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {START_HERE.map((id, i) => {
            const l = levelById(id)!;
            const rec = state.levels[id];
            const w = WORLDS.find((x) => x.id === l.world)!;
            return (
              <a key={id} href={href(`play/${id}`)} className="group vl-rise flex flex-col rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750 transition hover:bg-ink-800 hover:ring-ink-600" style={{ animationDelay: `${i * 70}ms` }}>
                <StartArt id={id} />
                <p className="mt-4 text-[11.5px] text-ink-400">World {w.number} · Level {l.n} · {l.minutes} min</p>
                <h3 className="mt-1 font-display text-[26px] leading-tight text-ink-50">{l.title}</h3>
                <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-ink-300">{l.summary}</p>
                <div className="mt-4 flex items-center justify-between">
                  {rec?.completed ? <Badge tone="ok">Best {rec.best}</Badge> : <Badge tone="outline">Not started</Badge>}
                  <span className="text-[13px] text-ink-200 transition group-hover:translate-x-0.5">Open lab →</span>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* Worlds */}
      <section className="mt-14">
        <Eyebrow>The five worlds</Eyebrow>
        <h2 className="mt-1 font-display text-[32px] leading-tight text-ink-50">Free to explore, in any order</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {WORLDS.map((w, i) => {
            const ls = levelsOf(w.id);
            const done = ls.filter((l) => state.levels[l.id]?.completed).length;
            const ready = ls.filter((l) => l.status === 'ready').length;
            return (
              <a key={w.id} href={href(`world/${w.id}`)} className="group vl-rise flex min-h-[260px] flex-col justify-between rounded-2xl bg-ink-850 p-5 ring-1 ring-ink-750 transition hover:bg-ink-800 hover:ring-ink-600" style={{ animationDelay: `${i * 60}ms` }}>
                <div>
                  <div className="flex items-start justify-between">
                    <span className="font-display text-[56px] leading-none text-ink-600 transition group-hover:text-ink-400">{w.number}</span>
                    <ProgressRing value={done / ls.length}>{done}/{ls.length}</ProgressRing>
                  </div>
                  <h3 className="mt-3 font-display text-[24px] leading-tight text-ink-50">{w.title}</h3>
                  <p className="mt-1 text-[12.5px] text-ink-400">{w.subject}</p>
                </div>
                <div>
                  <p className="mt-4 text-[13px] leading-relaxed text-ink-300">{w.tagline}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex h-2 w-24 overflow-hidden rounded-full">
                      {w.swatch.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
                    </div>
                    <span className="text-[11.5px] text-ink-500">{ready} of {ls.length} playable</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* Daily + skills */}
      <section className="mt-14 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl bg-ink-850 p-6 ring-1 ring-ink-750">
          <Eyebrow>Daily five-minute challenge</Eyebrow>
          <h2 className="mt-1 font-display text-[30px] leading-tight text-ink-50">{dailyDone ? 'Done for today. Nicely done.' : 'Three quick exercises, new every day'}</h2>
          <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-ink-300">Mix a colour, rescue a contrast failure, neutralise a cast. Same puzzles for everyone today; your streak grows with practice, never shrinks with mistakes.</p>
          <div className="mt-5 flex items-center gap-3">
            <Button variant={dailyDone ? 'secondary' : 'primary'} onClick={() => navigate('daily')}>{dailyDone ? 'Play again for practice' : 'Start today’s challenge'}</Button>
            <span className="text-[12.5px] text-ink-400">Streak: {state.daily.streak} day{state.daily.streak === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="rounded-2xl bg-ink-850 p-6 ring-1 ring-ink-750">
          <div className="flex items-baseline justify-between">
            <Eyebrow>Skill mastery</Eyebrow>
            <a href={href('profile')} className="text-[12px] text-ink-300 hover:text-ink-50">All skills →</a>
          </div>
          <ul className="mt-4 space-y-3">
            {topSkills.map(({ s, v }) => (
              <li key={s}>
                <div className="flex justify-between text-[13px]"><span className="text-ink-200">{SKILLS[s].label}</span><span className="num font-mono text-[12px] text-ink-400">{v}%</span></div>
                <Meter value={v} tone="neutral" className="mt-1.5" />
              </li>
            ))}
          </ul>
          {topSkills.every((x) => x.v === 0) && <p className="mt-3 text-[12.5px] text-ink-500">Mastery grows with your best score in each lesson that trains a skill.</p>}
        </div>
      </section>

      <footer className="mt-16 border-t border-ink-800 pt-6 text-[12px] leading-relaxed text-ink-500">
        All imagery is generated live by the Lab’s own renderer or provided by you; typefaces are bundled under the SIL Open Font License. Browsers assume an sRGB display; colour accuracy depends on your screen.
      </footer>
    </div>
  );
}

function StartArt({ id }: { id: string }) {
  if (id === 'w1-2') {
    return (
      <div className="relative h-32 overflow-hidden rounded-xl bg-ink-800">
        <div className="absolute inset-y-0 left-0 w-1/2" style={{ background: '#c8643c' }} />
        <div className="absolute inset-y-0 right-0 w-1/2" style={{ background: '#c26a45' }} />
        <span className="absolute bottom-2 left-3 font-mono text-[11px] text-white/80">target</span>
        <span className="absolute right-3 bottom-2 font-mono text-[11px] text-white/80">ΔE00 2.4</span>
      </div>
    );
  }
  if (id === 'w3-2') {
    return (
      <div className="relative h-32 overflow-hidden rounded-xl bg-ink-800 p-3">
        <div className="h-5 rounded" style={{ background: 'linear-gradient(to right, #000, #fff)' }} />
        <svg viewBox="0 0 100 50" className="mt-2 h-[72px] w-full" preserveAspectRatio="none">
          <path d="M0 50 L100 0" stroke="#555" strokeWidth="0.6" fill="none" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          <path d={`M0 50 ${Array.from({ length: 21 }, (_, i) => `L${i * 5} ${50 - Math.pow(i / 20, 1 / 1.8) * 50}`).join(' ')}`} stroke="#eee" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    );
  }
  return (
    <div className="h-32 overflow-hidden rounded-xl bg-paper p-3 text-ink-950">
      <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-[#b8432f]">Perception</p>
      <p className="mt-0.5 font-['Playfair_Display_Variable'] text-[26px] leading-[0.95] font-bold">The Quiet Power of Grey</p>
      <p className="mt-1 text-[8.5px] leading-snug text-ink-600">Why the most useful colour in a designer’s palette is the one nobody notices.</p>
      <div className={cx('mt-1.5 grid grid-cols-2 gap-2')}>
        <div className="h-1 rounded bg-ink-300" />
        <div className="h-1 rounded bg-ink-300" />
      </div>
    </div>
  );
}
