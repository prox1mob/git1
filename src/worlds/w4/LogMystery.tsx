import { useMemo, useState } from 'react';
import { GradeCanvas } from '../../components/grading/GradeCanvas';
import { Scope } from '../../components/grading/Scopes';
import { Concepts, LessonShell, ObserveQuestion, weighted, type ChallengeCtx } from '../../components/lesson/LessonShell';
import { Badge, Button, Eyebrow, Note, Segmented, cx } from '../../components/ui';
import type { Frame } from '../../engine/GradeEngine';
import { defaultParams } from '../../engine/params';
import type { LevelProps } from '../../game/registry';
import { errorToScore, LOG_CURVES, type LogCurveId } from '../../lib/color';
import { mulberry32, shuffle } from '../../lib/random';
import { neutralReport } from '../shared/measure';

const still = { kind: 'scene' as const, scene: 'stilllife' as const };
const coast = { kind: 'scene' as const, scene: 'coast' as const };
const IDS: LogCurveId[] = ['slog3', 'logc3', 'vlog'];
const idx = (id: LogCurveId) => IDS.indexOf(id) as 0 | 1 | 2;
const view = (src: LogCurveId, dst: LogCurveId, raw: boolean) => ({ mode: 'graded' as const, split: 0.5, clipWarn: false, showLost: false, signal: { log: { src: idx(src), dst: idx(dst), viewRaw: raw } } });

export default function LogMystery({ level }: LevelProps) {
  return <LessonShell level={level} observe={<Observe />} experiment={<Experiment />}
    discover={
      <Concepts items={[
        { title: 'Why Log looks flat', body: 'A Log curve gives every stop of light roughly the same number of code values, so 14+ stops fit in the signal. Viewed directly, shadows are lifted and highlights pulled down: flat and milky by design.' },
        { title: 'It is a container, not a look', body: 'Log is meant to be transformed before viewing. The information is all there — more of it than in a contrasty image — waiting for the right inverse curve.' },
        { title: 'Camera-specific', body: 'Sony, ARRI, Panasonic, Canon and RED each publish their own curve (and colour gamut). Decode S-Log3 as if it were LogC and exposure and contrast come out wrong.' },
        { title: 'Transforms, not tweaks', body: 'Use the matching transform (a colour-space transform or a LUT from the maker), then grade. Eyeballing contrast onto Log footage is a common, avoidable mistake.' },
        { title: 'Exposure in Log', body: 'Check the grey card against the published level: 18% grey sits at about 41% for S-Log3, 39% for LogC3 and 42% for V-Log.' },
      ]} footer={<Note tone="caution">This lab simulates the published transfer curves only. Real cameras also record in a wide native gamut (S-Gamut3, ARRI Wide Gamut, V-Gamut) that needs its own conversion; we leave colours in Rec.709 primaries.</Note>} />
    }
    challenge={(ctx) => <Mystery ctx={ctx} />} />;
}

function Observe() {
  const p = useMemo(() => defaultParams(), []);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <figure><GradeCanvas source={coast} params={p} aspect={3 / 2} view={view('slog3', 'slog3', true)} label="Log signal" /><figcaption className="mt-2 font-display text-[17px] text-ink-100">A</figcaption></figure>
        <figure><GradeCanvas source={coast} params={p} aspect={3 / 2} view={view('slog3', 'slog3', false)} label="Transformed" /><figcaption className="mt-2 font-display text-[17px] text-ink-100">B</figcaption></figure>
      </div>
      <ObserveQuestion question="Which of these two files holds more information about the scene?" options={['A — it’s flat but…', 'B — it looks better', 'They hold the same']}
        reveal={() => <p>They hold the <b>same</b> recording. A is the S-Log3 signal shown directly; B is the same signal passed through the S-Log3 inverse curve and a display transform. Log looks flat because it is a storage format, not a viewing format. Judge footage only after its transform.</p>} />
    </div>
  );
}

function Experiment() {
  const [src, setSrc] = useState<LogCurveId>('slog3');
  const [dst, setDst] = useState<LogCurveId>('slog3');
  const [raw, setRaw] = useState(true);
  const [frame, setFrame] = useState<Frame | null>(null);
  const p = useMemo(() => defaultParams(), []);
  const opts = IDS.map((id) => ({ value: id, label: LOG_CURVES[id].name }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
        <div><p className="mb-1 text-[12px] text-ink-400">Camera recorded in</p><Segmented size="sm" value={src} onChange={setSrc} options={opts} /></div>
        <div><p className="mb-1 text-[12px] text-ink-400">View</p><Segmented size="sm" value={raw ? 'raw' : 'tx'} onChange={(v) => setRaw(v === 'raw')} options={[{ value: 'raw', label: 'Raw Log signal' }, { value: 'tx', label: 'Apply transform' }]} /></div>
        {!raw && <div><p className="mb-1 text-[12px] text-ink-400">Transform used</p><Segmented size="sm" value={dst} onChange={setDst} options={opts} /></div>}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <GradeCanvas source={still} params={p} aspect={3 / 2} view={view(src, dst, raw)} onAnalysis={setFrame} label="Log experiment" />
        <div className="space-y-4">
          <div><Eyebrow className="mb-1">Waveform</Eyebrow><Scope frame={frame} kind="waveform" /></div>
          <table className="w-full text-left text-[12.5px]">
            <thead className="text-[11px] uppercase tracking-wider text-ink-500"><tr><th className="py-1">Curve</th><th>Black</th><th>18% grey</th><th>90% white</th></tr></thead>
            <tbody className="font-mono text-ink-200">
              {IDS.map((id) => <tr key={id} className={cx(id === src && 'text-ink-50')}><td className="py-1 font-sans">{LOG_CURVES[id].maker} {LOG_CURVES[id].name}</td><td>{(LOG_CURVES[id].encode(0) * 100).toFixed(1)}%</td><td>{(LOG_CURVES[id].encode(0.18) * 100).toFixed(1)}%</td><td>{(LOG_CURVES[id].encode(0.9) * 100).toFixed(1)}%</td></tr>)}
            </tbody>
          </table>
          <Note>Set the camera to S-Log3 and the transform to V-Log: exposure and contrast go subtly wrong. That mismatch is exactly what happens when a LUT for the wrong camera is used.</Note>
        </div>
      </div>
    </div>
  );
}

function Mystery({ ctx }: { ctx: ChallengeCtx }) {
  const truth = useMemo(() => shuffle(mulberry32(Math.floor(Math.random() * 1e9)), IDS), []);
  const [pick, setPick] = useState<(LogCurveId | null)[]>([null, null, null]);
  const [frames, setFrames] = useState<(Frame | null)[]>([null, null, null]);
  const p = useMemo(() => defaultParams(), []);
  const done = pick.every(Boolean);
  const submit = () => {
    const criteria = truth.map((t, i) => {
      const n = frames[i] ? neutralReport(frames[i]!) : null;
      const exact = pick[i] === t;
      const lerr = n ? Math.abs(n.cardL - 50) : 99;
      return { label: `Clip ${i + 1}`, score: exact ? 100 : Math.min(60, errorToScore(lerr, 1, 12)), weight: 1, detail: `Recorded in ${LOG_CURVES[t].name}; you chose ${pick[i] ? LOG_CURVES[pick[i]!].name : '—'}. Grey card L* ${n ? n.cardL.toFixed(1) : '?'}.` };
    });
    ctx.submit({
      score: weighted(criteria), criteria,
      worked: criteria.filter((c) => c.score === 100).length ? ['You matched transforms by reading exposure on the grey card, not by taste.'] : [],
      improve: truth.filter((t, i) => pick[i] !== t).map((t) => `The ${LOG_CURVES[t].name} clip: its 18% grey sits at ${(LOG_CURVES[t].encode(0.18) * 100).toFixed(0)}% in the raw signal — compare the waveform with the table.`),
      why: 'On real productions footage arrives from several cameras, often mislabelled. Identifying the encoding from a grey card and the waveform — before any creative work — prevents a whole film being graded on the wrong foundation.',
    });
  };
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-ink-850 px-5 py-4 ring-1 ring-ink-750">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-signal">The brief</p>
        <h2 className="mt-1 font-display text-[24px] text-ink-50">Three unlabelled Log clips</h2>
        <p className="mt-1.5 text-[14px] text-ink-300">The camera reports went missing. For each clip, choose the transform that decodes it correctly. The right transform puts the grey card at L* 50 with natural contrast; a wrong one is subtly too bright, dark or flat.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {truth.map((t, i) => (
          <div key={i} className="space-y-2 rounded-2xl bg-ink-850 p-3 ring-1 ring-ink-750">
            <p className="text-[13px] text-ink-200">Clip {i + 1}</p>
            <GradeCanvas source={still} params={p} aspect={3 / 2} view={pick[i] ? view(t, pick[i]!, false) : view(t, t, true)} onAnalysis={(f) => setFrames((fs) => fs.map((x, k) => (k === i ? f : x)))} label={`Clip ${i + 1}`} maxPixels={500_000} />
            <Scope frame={frames[i]} kind="waveform" />
            <div className="flex flex-wrap gap-1.5">
              {IDS.map((id) => <button key={id} onClick={() => setPick((ps) => ps.map((x, k) => (k === i ? id : x)))} className={cx('min-h-9 rounded-full px-3 text-[12px] ring-1', pick[i] === id ? 'bg-ink-100 text-ink-950 ring-ink-100' : 'text-ink-300 ring-ink-600')}>{LOG_CURVES[id].name}</button>)}
              {pick[i] && <button onClick={() => setPick((ps) => ps.map((x, k) => (k === i ? null : x)))} className="min-h-9 px-2 text-[12px] text-ink-400">view raw</button>}
            </div>
            {pick[i] && frames[i] && ctx.difficulty === 'beginner' && <p className="text-[12px] text-ink-400">Grey card L* {neutralReport(frames[i]!).cardL.toFixed(1)}</p>}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3"><Button variant="primary" disabled={!done} onClick={submit}>Submit identifications</Button>{!done && <Badge tone="outline">Choose a transform for every clip</Badge>}</div>
    </div>
  );
}
