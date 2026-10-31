import { useMemo, useRef, useState, type ReactNode } from 'react';
import { LevelShell } from './LevelShell';
import { MiniEditor } from './editor/MiniEditor';
import { Inspector } from './editor/panels';
import { CaptureHook, type CaptureFn } from './three/Capture';
import { Task, Toggle } from './ui';
import { createEditorStore, EditorContext, flattenWorld } from '../store/editorStore';
import type { PrimType, SceneObject } from '../lib/shapes';
import { putPortfolio, saveVersion } from '../lib/storage';
import { useProgress } from '../store/progress';
import { toast } from '../store/toast';
import type { Feedback, LessonStep } from '../lib/types';

export interface AutoCheck {
  criterion: string;
  ok: boolean | number; // number = partial 0..1
  note?: string;
  weight?: number;
}

export interface MissionConfig {
  id: string;
  title: string;
  problem: string;
  persona: string;
  constraints: string[];
  research: { text: string; relevant: boolean }[];
  concepts: { name: string; desc: string }[];
  starter: () => SceneObject[];
  allowed?: PrimType[];
  booleans?: boolean;
  fit?: number;
  checks: (flat: SceneObject[], all: SceneObject[]) => AutoCheck[];
  selfChecks: string[];
  disclaimer?: string;
  tips?: string[];
  /** Replace the free-form editor with a custom model stage (e.g. a parametric configurator). */
  custom?: {
    viewport: (capture: React.MutableRefObject<CaptureFn | null>) => ReactNode;
    panel: ReactNode;
    checks: () => AutoCheck[];
  };
}

type Tab = 'brief' | 'research' | 'concept' | 'model' | 'evaluate' | 'present';
const TABS: [Tab, string][] = [
  ['brief', '1 Brief'],
  ['research', '2 Research'],
  ['concept', '3 Concept'],
  ['model', '4 Model'],
  ['evaluate', '5 Evaluate'],
  ['present', '6 Present'],
];

const steps: LessonStep[] = [
  { stage: 'OBSERVE', text: 'Read the brief: who has the problem, what exactly goes wrong, and which constraints are fixed.', ta: 'சுருக்கத்தைப் படியுங்கள்: யாருக்குப் பிரச்சினை, என்ன தவறு நடக்கிறது, என்ன கட்டுப்பாடுகள்.' },
  { stage: 'UNDERSTAND', text: 'Research: pick the insights that really matter for this user. Then choose a concept direction — or write your own.', ta: 'ஆய்வு: இந்தப் பயனருக்கு உண்மையில் முக்கியமானவற்றைத் தேர்ந்தெடுங்கள்.' },
  { stage: 'BUILD', text: 'Model it with the tools you have learned: primitives, exact dimensions and Boolean cuts.', ta: 'கற்ற கருவிகளால் மாடல் செய்யுங்கள்.' },
  { stage: 'TEST', text: 'Evaluate: measured checks update live; self-assessment items are your honest judgement and are labelled as such.', ta: 'மதிப்பீடு: அளவிடப்பட்ட சோதனைகள் + உங்கள் நேர்மையான சுய மதிப்பீடு.' },
  { stage: 'IMPROVE', text: 'Present: take a snapshot, write one sentence on why it works, and add it to your portfolio. Then iterate — save versions to compare before/after.', ta: 'படம் எடுத்து, ஏன் வேலை செய்கிறது என்று ஒரு வாக்கியம் எழுதி portfolio-வில் சேருங்கள்.' },
];

export function Mission({ cfg }: { cfg: MissionConfig }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const store = useMemo(() => createEditorStore({ objects: cfg.starter(), snapMove: 1 }), [cfg.id]);
  const objects = store((s) => s.objects);
  const [tab, setTab] = useState<Tab>('brief');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [concept, setConcept] = useState<number | null>(null);
  const [own, setOwn] = useState('');
  const [self, setSelf] = useState<boolean[]>(cfg.selfChecks.map(() => false));
  const [statement, setStatement] = useState('');
  const [snap, setSnap] = useState<string | null>(null);
  const capture = useRef<CaptureFn | null>(null);
  const flat = flattenWorld(objects);
  const auto = cfg.custom ? cfg.custom.checks() : cfg.checks(flat, objects);

  const researchScore = () => {
    const rel = cfg.research.map((r, i) => r.relevant === picked.has(i));
    return rel.filter(Boolean).length / cfg.research.length;
  };

  const rubric = () => {
    const autoMax = 50;
    const totalW = auto.reduce((s, a) => s + (a.weight ?? 1), 0) || 1;
    const rows = [
      { criterion: 'Research: relevant insights selected (and irrelevant ones left out)', points: researchScore() * 15, max: 15 },
      { criterion: 'Concept chosen and explained', points: concept != null ? (concept < cfg.concepts.length || own.trim().length > 10 ? 10 : 5) : 0, max: 10 },
      ...auto.map((a) => ({ criterion: `Measured: ${a.criterion}`, points: (typeof a.ok === 'number' ? a.ok : a.ok ? 1 : 0) * ((a.weight ?? 1) / totalW) * autoMax, max: Math.round(((a.weight ?? 1) / totalW) * autoMax * 10) / 10, note: a.note })),
      { criterion: 'Self-assessment (your judgement, not measured)', points: (self.filter(Boolean).length / Math.max(1, self.length)) * 15, max: 15 },
      { criterion: 'Presented: snapshot + one-sentence rationale', points: (snap ? 5 : 0) + (statement.trim().length > 15 ? 5 : 0), max: 10 },
    ];
    return rows;
  };

  const evaluate = (): Feedback => {
    const rows = rubric();
    const bad = rows.filter((r) => r.points < r.max - 0.01);
    return {
      score: Math.round(rows.reduce((s, r) => s + r.points, 0)),
      correct: rows.filter((r) => r.points >= r.max - 0.01).map((r) => r.criterion),
      issues: bad.map((r) => ({ label: r.criterion, detail: (r as { note?: string }).note })),
      why: 'Real invention is a loop, not a straight line: understand the user, explore, build, measure against the brief, then improve. The rubric shows exactly where each point comes from; no single aesthetic answer is “correct”.',
      suggestion: bad.length ? `Improve: ${bad[0].criterion}.` : 'Save this as version 1, then challenge one assumption in the brief and design version 2.',
      rubric: rows,
    };
  };

  const takeSnap = () => {
    const img = capture.current?.(560);
    if (img) setSnap(img);
  };
  const toPortfolio = async () => {
    const rows = rubric();
    await putPortfolio({ id: `mission-${cfg.id}`, title: cfg.title, levelId: cfg.id, at: new Date().toISOString(), thumb: snap ?? undefined, notes: statement, score: Math.round(rows.reduce((s, r) => s + r.points, 0)), rubric: rows });
    toast('📁 Added to your portfolio');
  };
  const toGallery = async () => {
    if (cfg.custom) return;
    const img = capture.current?.(360) ?? '';
    await saveVersion({ name: cfg.title, source: `mission:${cfg.id}`, objects, thumb: img, note: statement || 'Mission model' });
    useProgress.getState().bump('projectsSaved');
    toast('💾 Saved to the gallery');
  };

  const viewport = cfg.custom ? (
    cfg.custom.viewport(capture)
  ) : (
    <MiniEditor allowed={cfg.allowed} booleans={cfg.booleans} fit={cfg.fit ?? 140}>
      <CaptureHook fnRef={capture} />
    </MiniEditor>
  );

  return (
    <EditorContext.Provider value={store}>
      <LevelShell id={cfg.id} steps={steps} evaluate={evaluate} viewport={viewport} onRetry={() => store.getState().setObjects(cfg.starter())} hints={cfg.tips?.map((t) => ({ en: t }))}>
        <div className="tabs">
          {TABS.map(([k, l]) => (
            <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
        {tab === 'brief' && (
          <div>
            <h3>The problem</h3>
            <p>{cfg.problem}</p>
            <h3>The user</h3>
            <p>{cfg.persona}</p>
            <h3>Constraints</h3>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {cfg.constraints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            {cfg.disclaimer && <div className="note warn">{cfg.disclaimer}</div>}
            <button className="btn small primary" style={{ marginTop: 8 }} onClick={() => setTab('research')}>
              Next: research →
            </button>
          </div>
        )}
        {tab === 'research' && (
          <div>
            <p className="muted" style={{ fontSize: 13 }}>
              Which observations should shape the design? Select all that are relevant.
            </p>
            {cfg.research.map((r, i) => (
              <Toggle
                key={i}
                checked={picked.has(i)}
                onChange={(v) => {
                  const n = new Set(picked);
                  if (v) n.add(i);
                  else n.delete(i);
                  setPicked(n);
                }}
                label={r.text}
              />
            ))}
            <button className="btn small primary" onClick={() => setTab('concept')}>
              Next: concept →
            </button>
          </div>
        )}
        {tab === 'concept' && (
          <div className="grid" style={{ gap: 6 }}>
            {cfg.concepts.map((c, i) => (
              <div key={i} className={`card hover ${concept === i ? '' : ''}`} style={{ padding: 10, borderColor: concept === i ? 'var(--accent)' : undefined }} onClick={() => setConcept(i)}>
                <b>{c.name}</b>
                <div className="muted" style={{ fontSize: 13 }}>
                  {c.desc}
                </div>
              </div>
            ))}
            <div className="card" style={{ padding: 10, borderColor: concept === cfg.concepts.length ? 'var(--accent)' : undefined }} onClick={() => setConcept(cfg.concepts.length)}>
              <b>My own idea</b>
              <textarea rows={2} value={own} placeholder="Describe your concept in a sentence…" onChange={(e) => setOwn(e.target.value)} />
            </div>
            <button className="btn small primary" onClick={() => setTab('model')}>
              Next: model →
            </button>
          </div>
        )}
        {tab === 'model' && (
          <div>
            {cfg.custom ? (
              cfg.custom.panel
            ) : (
              <>
                <p className="muted" style={{ fontSize: 13 }}>
                  The starter kit contains named parts. Keep their names — some checks look for them. Turn on ☑ Multi and use Subtract to cut slots and holes.
                </p>
                <div className="card" style={{ padding: 10 }}>
                  <Inspector unit="mm" />
                </div>
              </>
            )}
            <button className="btn small primary" style={{ marginTop: 8 }} onClick={() => setTab('evaluate')}>
              Next: evaluate →
            </button>
          </div>
        )}
        {tab === 'evaluate' && (
          <div>
            <div className="lbl">Measured from your model (live)</div>
            {auto.map((a, i) => (
              <Task key={i} ok={a.ok === true || (typeof a.ok === 'number' && a.ok >= 1)}>
                {a.criterion}
                {a.note && <div className="muted" style={{ fontSize: 12 }}>{a.note}</div>}
              </Task>
            ))}
            <div className="lbl" style={{ marginTop: 8 }}>
              Self-assessment (your honest judgement)
            </div>
            {cfg.selfChecks.map((c, i) => (
              <Toggle key={i} checked={self[i]} onChange={(v) => setSelf(self.map((x, k) => (k === i ? v : x)))} label={c} />
            ))}
            <button className="btn small primary" onClick={() => setTab('present')}>
              Next: present →
            </button>
          </div>
        )}
        {tab === 'present' && (
          <div>
            <button className="btn small accent" onClick={takeSnap}>
              📸 Snapshot the model
            </button>
            {snap && <img src={snap} alt="Snapshot" style={{ width: '100%', borderRadius: 8, marginTop: 6 }} />}
            <div className="field" style={{ marginTop: 6 }}>
              <label>Why does your design work? (one sentence)</label>
              <textarea rows={2} value={statement} onChange={(e) => setStatement(e.target.value)} />
            </div>
            <div className="btnrow">
              <button className="btn small" onClick={toPortfolio}>
                📁 Add to portfolio
              </button>
              {!cfg.custom && (
                <button className="btn small" onClick={toGallery}>
                  💾 Save model to gallery
                </button>
              )}
            </div>
          </div>
        )}
      </LevelShell>
    </EditorContext.Provider>
  );
}
