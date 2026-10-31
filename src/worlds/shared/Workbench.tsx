import { useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { ColourPanel, CurveEditor, FilmPanel, HslMixer, ToolSection, TonePanel, WheelsPanel, WhiteBalancePanel } from '../../components/grading/Controls';
import type { GradeHandle } from '../../components/grading/GradeCanvas';
import { GradeViewport } from '../../components/grading/GradeViewport';
import { ScopePanel, type ScopeKind } from '../../components/grading/Scopes';
import { Transport, useClip } from '../../components/grading/Transport';
import { ChallengeBrief, Hint, weighted, type ChallengeCtx, type ChallengeResult, type Criterion } from '../../components/lesson/LessonShell';
import { Badge, Button, Slider, cx } from '../../components/ui';
import type { Frame } from '../../engine/GradeEngine';
import { defaultParams, solveWbFromSample, type CaptureSpec, type GradeParams, type SignalSpec, type SourceSpec } from '../../engine/params';
import type { Difficulty } from '../../state/progress';
import { useSaveToGallery } from '../../lib/gallery';

export type PanelId = 'wb' | 'exposure' | 'tone' | 'toneFull' | 'gamma' | 'wheels' | 'curves' | 'hsl' | 'colour' | 'film';

export interface WorkbenchProps {
  source: SourceSpec;
  capture?: CaptureSpec;
  aspect: number;
  params: GradeParams;
  setParams: (p: GradeParams) => void;
  panels: PanelId[];
  scopes?: ScopeKind[];
  eyedropper?: boolean;
  signal?: SignalSpec;
  showLost?: boolean;
  video?: boolean;
  handleRef?: Ref<GradeHandle>;
  onFrame?: (f: Frame) => void;
  sidebarTop?: ReactNode;
  sidebarBottom?: ReactNode;
  under?: ReactNode;
  beforeRolloff?: number;
  defaults?: GradeParams;
  compareLabels?: [string, string];
}

/** The standard grading layout: image + compare tools on the left, panels and scopes on the right. */
export function Workbench(props: WorkbenchProps) {
  const { source, capture, aspect, params, setParams, panels, scopes, eyedropper, signal, showLost, video, handleRef, onFrame, sidebarTop, sidebarBottom, under, beforeRolloff, defaults, compareLabels } = props;
  const local = useRef<GradeHandle>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [picking, setPicking] = useState(false);
  const clip = useClip(10, false);
  const set = (q: Partial<GradeParams>) => setParams({ ...params, ...q });
  const setHandle = (h: GradeHandle | null) => {
    local.current = h;
    if (typeof handleRef === 'function') handleRef(h);
    else if (handleRef && typeof handleRef === 'object') (handleRef as { current: GradeHandle | null }).current = h;
  };
  const has = (p: PanelId) => panels.includes(p);
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-3">
        <GradeViewport
          ref={setHandle}
          source={source}
          capture={capture}
          params={params}
          aspect={aspect}
          time={video ? clip.time : 0}
          beforeRolloff={beforeRolloff}
          view={{ mode: 'graded', split: 0.5, clipWarn: false, showLost: !!showLost, signal }}
          onAnalysis={(f) => { setFrame(f); onFrame?.(f); }}
          onPick={picking ? (u, v) => { const s = local.current?.sampleSource(u, v); if (s) set(solveWbFromSample(s)); setPicking(false); } : undefined}
          beforeLabel={compareLabels?.[0]}
          afterLabel={compareLabels?.[1]}
          toolbarExtra={
            <>
              {eyedropper && <Button size="sm" variant={picking ? 'primary' : 'secondary'} onClick={() => setPicking(!picking)}>{picking ? 'Tap something neutral…' : 'WB eyedropper'}</Button>}
              <Button size="sm" variant="ghost" onClick={() => setParams(defaults ?? defaultParams({ rolloff: params.rolloff }))}>Reset</Button>
            </>
          }
        />
        {video && <Transport clip={clip} />}
        {under}
        {scopes && scopes.length > 0 && (
          <div className="rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750"><ScopePanel frame={frame} kinds={scopes} /></div>
        )}
      </div>
      <aside className="space-y-3">
        {sidebarTop}
        {(has('wb') || has('exposure')) && (
          <ToolSection title={has('wb') ? 'White balance' + (has('exposure') ? ' & exposure' : '') : 'Exposure'}>
            {has('wb') && <WhiteBalancePanel p={params} set={set} />}
            {has('exposure') && <div className={cx(has('wb') && 'mt-3')}><TonePanel p={params} set={set} include={['exposure']} /></div>}
          </ToolSection>
        )}
        {has('tone') && <ToolSection title="Tone"><TonePanel p={params} set={set} include={['contrast', 'highlights', 'shadows']} /></ToolSection>}
        {has('toneFull') && <ToolSection title="Tone"><TonePanel p={params} set={set} include={['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'rolloff']} /></ToolSection>}
        {has('gamma') && (
          <ToolSection title="Gamma">
            <Slider label="Gamma γ" value={Math.log2(params.gamma)} min={Math.log2(0.3)} max={Math.log2(3.3)} step={0.005} defaultValue={0} onChange={(v) => set({ gamma: Math.pow(2, v) })} format={(v) => `γ ${Math.pow(2, v).toFixed(2)}`} />
          </ToolSection>
        )}
        {has('wheels') && <ToolSection title="Lift · Gamma · Gain"><WheelsPanel p={params} set={set} size={112} /></ToolSection>}
        {has('curves') && <ToolSection title="Curves"><CurveEditor curves={params.curves} onChange={(curves) => set({ curves })} /></ToolSection>}
        {has('hsl') && <ToolSection title="HSL mixer"><HslMixer hsl={params.hsl} onChange={(hsl) => set({ hsl })} /></ToolSection>}
        {has('colour') && <ToolSection title="Saturation"><ColourPanel p={params} set={set} /></ToolSection>}
        {has('film') && <ToolSection title="Film emulation"><FilmPanel p={params} set={set} /></ToolSection>}
        {sidebarBottom}
      </aside>
    </div>
  );
}

// ------------------------------------------------------------------ multi-round grading challenge

export interface RoundResult { criteria: Criterion[]; worked: string[]; improve: string[]; meta?: Record<string, number | boolean> }

export interface GradingRound {
  id: string;
  label: string;
  brief: ReactNode;
  source: SourceSpec;
  capture?: CaptureSpec;
  aspect: number;
  initial?: Partial<GradeParams>;
  panels: PanelId[];
  scopes?: ScopeKind[];
  eyedropper?: boolean;
  signal?: SignalSpec;
  showLost?: boolean;
  video?: boolean;
  hint?: ReactNode;
  /** Live readout for beginners. */
  live?: (f: Frame, p: GradeParams) => ReactNode;
  /** Reference render for comparisons (defaults to the untouched image with the same capture). */
  reference?: { source?: SourceSpec; capture?: CaptureSpec; params?: Partial<GradeParams> };
  evaluate: (f: Frame, p: GradeParams, d: Difficulty, ref: Frame | null) => RoundResult;
}

/** Runs one or more grading rounds and scores them all against the real rendered pixels on submit. */
export function GradingChallenge({ ctx, title, intro, rounds, why, subjective, extraSidebar, roundWeights, saveAs }: {
  ctx: ChallengeCtx; title: ReactNode; intro?: ReactNode; rounds: GradingRound[]; why: string; subjective?: boolean; extraSidebar?: ReactNode; roundWeights?: number[];
  /** When set, offers "save to gallery" for the current round, titled with this prefix. */
  saveAs?: string;
}) {
  const save = useSaveToGallery();
  const [i, setI] = useState(0);
  const [params, setParams] = useState<GradeParams[]>(() => rounds.map((r) => defaultParams(r.initial)));
  const [frame, setFrame] = useState<Frame | null>(null);
  const handle = useRef<GradeHandle>(null);
  const r = rounds[i];
  const p = params[i];
  const setP = (np: GradeParams) => setParams((all) => all.map((x, k) => (k === i ? np : x)));
  const liveNode = useMemo(() => (ctx.difficulty === 'beginner' && r.live && frame ? r.live(frame, p) : null), [ctx.difficulty, r, frame, p]);

  const submit = () => {
    const engine = handle.current?.engine;
    if (!engine) return;
    const all: RoundResult[] = rounds.map((rd, k) => {
      const f = engine.analyzeScenario({ source: rd.source, capture: rd.capture, params: params[k], view: { signal: rd.signal } });
      if (!f) return { criteria: [{ label: rd.label, score: 0, weight: 1, detail: 'Could not render this round.' }], worked: [], improve: [] };
      const ref = engine.analyzeScenario({
        source: rd.reference?.source ?? rd.source,
        capture: rd.reference ? rd.reference.capture : rd.capture,
        params: rd.reference ? defaultParams(rd.reference.params) : defaultParams(rd.initial),
        view: { signal: rd.signal },
      });
      return rd.evaluate(f, params[k], ctx.difficulty, ref);
    });
    const criteria: Criterion[] = [];
    all.forEach((res, k) => {
      const w = roundWeights?.[k] ?? 1;
      for (const c of res.criteria) criteria.push({ ...c, label: rounds.length > 1 ? `${rounds[k].label} · ${c.label}` : c.label, weight: c.weight * w });
    });
    // Achievements care about the best round: keep the minimum of numeric errors and OR booleans.
    const meta: Record<string, number | boolean> = {};
    for (const res of all) for (const [k, v] of Object.entries(res.meta ?? {})) {
      const prev = meta[k];
      meta[k] = typeof v === 'number' ? (typeof prev === 'number' ? Math.min(prev, v) : v) : !!prev || v;
    }
    const result: ChallengeResult = {
      score: weighted(criteria),
      criteria,
      worked: all.flatMap((x, k) => x.worked.map((w) => (rounds.length > 1 ? `${rounds[k].label}: ${w}` : w))),
      improve: all.flatMap((x, k) => x.improve.map((w) => (rounds.length > 1 ? `${rounds[k].label}: ${w}` : w))),
      why,
      subjective,
      meta,
    };
    ctx.submit(result);
  };

  return (
    <div>
      <ChallengeBrief title={title}>{intro}</ChallengeBrief>
      {rounds.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {rounds.map((rd, k) => (
            <button key={rd.id} onClick={() => { setI(k); setFrame(null); }} className={cx('h-10 rounded-full px-4 text-[13px] ring-1', k === i ? 'bg-ink-100 text-ink-950 ring-ink-100' : 'text-ink-300 ring-ink-600 hover:ring-ink-300')}>
              {k + 1}. {rd.label}
            </button>
          ))}
        </div>
      )}
      <p className="mb-3 max-w-3xl text-[14px] leading-relaxed text-ink-300">{r.brief}</p>
      <Workbench
        key={r.id}
        source={r.source}
        capture={r.capture}
        aspect={r.aspect}
        params={p}
        setParams={setP}
        panels={r.panels}
        scopes={r.scopes}
        eyedropper={r.eyedropper}
        signal={r.signal}
        showLost={r.showLost}
        video={r.video}
        handleRef={handle}
        onFrame={setFrame}
        defaults={defaultParams(r.initial)}
        sidebarTop={
          <div className="space-y-3 rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750">
            {liveNode}
            {r.hint && <Hint>{r.hint}</Hint>}
            <div className="flex flex-wrap gap-2">
              {i < rounds.length - 1 && <Button size="sm" onClick={() => { setI(i + 1); setFrame(null); }}>Next round →</Button>}
              <Button size="sm" variant="primary" onClick={submit}>{rounds.length > 1 ? `Submit all ${rounds.length} rounds` : 'Submit grade'}</Button>
              <Badge tone="outline">Unlimited retries</Badge>
            </div>
            {saveAs && <Button size="sm" variant="ghost" onClick={async () => { const img = handle.current?.snapshot(); if (img) await save({ title: `${saveAs} — ${r.label}`, source: saveAs, image: img }); }}>Save this look to my gallery</Button>}
            {extraSidebar}
          </div>
        }
      />
    </div>
  );
}

/** A compact metric row for live readouts. */
export function LiveMetric({ label, value, ok, target }: { label: string; value: string; ok: boolean; target?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[12.5px]">
      <span className="text-ink-300">{label}</span>
      <span className="flex items-center gap-2"><b className="num font-mono text-ink-50">{value}</b>{target && <Badge tone={ok ? 'ok' : 'outline'}>{target}</Badge>}</span>
    </div>
  );
}
