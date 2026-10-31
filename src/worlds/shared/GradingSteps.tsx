import { useMemo, useState, type ReactNode } from 'react';
import { GradeCanvas } from '../../components/grading/GradeCanvas';
import type { ScopeKind } from '../../components/grading/Scopes';
import { ObserveQuestion } from '../../components/lesson/LessonShell';
import { Segmented, cx } from '../../components/ui';
import { defaultParams, type CaptureSpec, type GradeParams, type SignalSpec, type SourceSpec } from '../../engine/params';
import { Workbench, type PanelId } from './Workbench';

export interface Shot { label: string; source: SourceSpec; capture?: CaptureSpec; params?: Partial<GradeParams>; aspect?: number; signal?: SignalSpec; caption?: string }

/** Observe step: two or three images side by side, then an open question with an explanatory reveal. */
export function CompareObserve({ shots, question, options, reveal, time = 0 }: { shots: Shot[]; question: ReactNode; options: string[]; reveal: (i: number) => ReactNode; time?: number }) {
  const params = useMemo(() => shots.map((s) => defaultParams(s.params)), [shots]);
  return (
    <div className="space-y-5">
      <div className={cx('grid gap-4', shots.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
        {shots.map((s, i) => (
          <figure key={s.label}>
            <GradeCanvas source={s.source} capture={s.capture} params={params[i]} aspect={s.aspect ?? 3 / 2} time={time} view={{ mode: 'graded', split: 0.5, clipWarn: false, showLost: false, signal: s.signal }} label={s.label} maxPixels={900_000} />
            <figcaption className="mt-2 flex justify-between text-[12.5px] text-ink-300"><span className="font-display text-[17px] text-ink-100">{s.label}</span>{s.caption && <span className="text-ink-500">{s.caption}</span>}</figcaption>
          </figure>
        ))}
      </div>
      <ObserveQuestion question={question} options={options} reveal={reveal} />
    </div>
  );
}

export interface ExperimentScene extends Shot { initial?: Partial<GradeParams> }

/** Experiment step: the full workbench with a scene switcher and nothing scored. */
export function FreeExperiment({ scenes, panels, scopes, notes, eyedropper, video, showLost, aside }: {
  scenes: ExperimentScene[]; panels: PanelId[]; scopes?: ScopeKind[]; notes?: ReactNode; eyedropper?: boolean; video?: boolean; showLost?: boolean; aside?: ReactNode;
}) {
  const [i, setI] = useState(0);
  const [params, setParams] = useState<GradeParams>(() => defaultParams(scenes[0].initial ?? scenes[0].params));
  const s = scenes[i];
  return (
    <div className="space-y-4">
      {scenes.length > 1 && (
        <Segmented value={i} onChange={(k) => { setI(k); setParams(defaultParams(scenes[k].initial ?? scenes[k].params)); }} label="Image" options={scenes.map((x, k) => ({ value: k, label: x.label }))} />
      )}
      <Workbench key={i} source={s.source} capture={s.capture} aspect={s.aspect ?? 3 / 2} params={params} setParams={setParams} panels={panels} scopes={scopes} eyedropper={eyedropper} video={video} showLost={showLost} signal={s.signal}
        defaults={defaultParams(s.initial ?? s.params)} under={notes} sidebarBottom={aside} />
    </div>
  );
}
