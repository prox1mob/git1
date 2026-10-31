import { useEffect, useMemo, useRef, useState } from 'react';
import { ColourPanel, CurveEditor, FilmPanel, HslMixer, ToolSection, TonePanel, WheelsPanel, WhiteBalancePanel } from '../components/grading/Controls';
import type { GradeHandle } from '../components/grading/GradeCanvas';
import { GradeViewport } from '../components/grading/GradeViewport';
import { ScopePanel } from '../components/grading/Scopes';
import { Transport, useClip } from '../components/grading/Transport';
import { Badge, Button, Eyebrow, Note, Segmented, Slider } from '../components/ui';
import type { Frame } from '../engine/GradeEngine';
import { defaultParams, solveWbFromSample, type GradeParams, type SceneId, type SourceSpec } from '../engine/params';
import { PORTRAIT_LIGHTS, SCENES, WARDROBE, sceneMeta } from '../engine/scenes';
import { levelById, SANDBOX_TOOLS } from '../game/content';
import { useSaveToGallery } from '../lib/gallery';
import { useProgress } from '../state/progress';

type Media = { kind: 'image'; el: HTMLImageElement; key: string; aspect: number; name: string } | { kind: 'video'; el: HTMLVideoElement; key: string; aspect: number; name: string };

export default function Sandbox() {
  const { state } = useProgress();
  const save = useSaveToGallery();
  const unlocked = (id: string) => {
    const t = SANDBOX_TOOLS.find((x) => x.id === id)!;
    return !t.unlockedBy || state.settings.freeExploration || !!state.levels[t.unlockedBy]?.completed;
  };
  const lockMsg = (id: string) => {
    const t = SANDBOX_TOOLS.find((x) => x.id === id)!;
    return unlocked(id) ? undefined : `Unlock by completing “${levelById(t.unlockedBy!)?.title}” — or turn on Free Exploration in your profile.`;
  };

  const [scene, setScene] = useState<SceneId>('portrait');
  const [variant, setVariant] = useState(2);
  const [light, setLight] = useState(0);
  const [ward, setWard] = useState(0);
  const [media, setMedia] = useState<Media | null>(null);
  const [p, setP] = useState<GradeParams>(() => defaultParams());
  const [frame, setFrame] = useState<Frame | null>(null);
  const [picking, setPicking] = useState(false);
  const handle = useRef<GradeHandle>(null);
  const clip = useClip(10, false);
  const set = (q: Partial<GradeParams>) => setP((o) => ({ ...o, ...q }));
  const fileRef = useRef<HTMLInputElement>(null);

  // keep uploaded video playing in step with the transport
  useEffect(() => {
    if (media?.kind !== 'video') return;
    const v = media.el;
    if (clip.playing) v.play().catch(() => {}); else v.pause();
  }, [clip.playing, media]);

  const source: SourceSpec = useMemo(() => {
    if (media) return media.kind === 'image' ? { kind: 'image', image: media.el, key: media.key } : { kind: 'video', video: media.el, key: media.key };
    return { kind: 'scene', scene, variant, params: [light, ward, 0, 0] };
  }, [media, scene, variant, light, ward]);
  const aspect = media ? media.aspect : sceneMeta(scene).aspect;

  const load = async (f: File) => {
    const url = URL.createObjectURL(f);
    if (f.type.startsWith('video/')) {
      const v = document.createElement('video');
      v.src = url; v.muted = true; v.loop = true; v.playsInline = true; v.crossOrigin = 'anonymous';
      await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('video')); });
      setMedia({ kind: 'video', el: v, key: url, aspect: v.videoWidth / v.videoHeight || 16 / 9, name: f.name });
      clip.setPlaying(true);
    } else {
      const img = new Image();
      img.src = url;
      await img.decode();
      setMedia({ kind: 'image', el: img, key: url, aspect: img.naturalWidth / img.naturalHeight, name: f.name });
    }
    setP(defaultParams({ rolloff: 0 }));
  };

  const onPick = (u: number, v: number) => {
    if (!picking) return;
    const s = handle.current?.sampleSource(u, v);
    if (s) set(solveWbFromSample(s));
    setPicking(false);
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-24 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 pt-8 pb-5">
        <div>
          <Eyebrow>Free experimentation</Eyebrow>
          <h1 className="mt-1 font-display text-[44px] leading-none text-ink-50">Sandbox</h1>
          <p className="mt-2 max-w-2xl text-[14px] text-ink-300">Nothing is scored. Every control is the real engine. Tools unlock as you demonstrate them in lessons.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setP(defaultParams({ rolloff: media ? 0 : 0.5 }))}>Reset grade</Button>
          <Button variant="primary" onClick={async () => { const img = handle.current?.snapshot(); if (img) await save({ title: media ? media.name : sceneMeta(scene).label, source: 'Sandbox', image: img }); }}>Save to gallery</Button>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {SCENES.map((s) => (
              <button key={s.id} onClick={() => { setMedia(null); setScene(s.id); setP(defaultParams({ rolloff: s.rolloff ?? 0.5 })); }}
                className={`h-9 rounded-full px-3 text-[12.5px] ring-1 ${!media && scene === s.id ? 'bg-ink-100 text-ink-950 ring-ink-100' : 'text-ink-300 ring-ink-600 hover:text-ink-50'}`}>
                {s.label}
              </button>
            ))}
            <button onClick={() => fileRef.current?.click()} className={`h-9 rounded-full px-3 text-[12.5px] ring-1 ${media ? 'bg-ink-100 text-ink-950 ring-ink-100' : 'text-ink-300 ring-ink-600 hover:text-ink-50'}`}>
              {media ? `Your ${media.kind}: ${media.name.slice(0, 18)}` : '＋ Your photo or video'}
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f).catch(() => alert('That file could not be decoded by this browser.')); }} />
          </div>
          <GradeViewport ref={handle} source={source} params={p} aspect={aspect} time={media?.kind === 'video' ? clip.time : clip.time} onAnalysis={setFrame} onPick={picking ? onPick : undefined}
            beforeRolloff={media ? 0 : sceneMeta(scene).rolloff ?? 0.5} label="Sandbox preview"
            toolbarExtra={<Button size="sm" variant={picking ? 'primary' : 'secondary'} onClick={() => setPicking(!picking)}>{picking ? 'Tap something neutral…' : 'WB eyedropper'}</Button>} />
          <Transport clip={clip} />
          {!media && scene === 'portrait' && (
            <div className="grid gap-3 rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750 md:grid-cols-3">
              <div><p className="mb-1.5 text-[12px] text-ink-400">Complexion</p><Segmented size="sm" value={variant} onChange={setVariant} options={sceneMeta('portrait').variants!.map((v, i) => ({ value: i, label: String(i + 1), title: v }))} /></div>
              <div><p className="mb-1.5 text-[12px] text-ink-400">Lighting</p><Segmented size="sm" value={light} onChange={setLight} options={PORTRAIT_LIGHTS.map((v, i) => ({ value: i, label: v.split(' ')[0] }))} /></div>
              <div><p className="mb-1.5 text-[12px] text-ink-400">Wardrobe</p><Segmented size="sm" value={ward} onChange={setWard} options={WARDROBE.map((v, i) => ({ value: i, label: v.slice(0, 3), title: v }))} /></div>
            </div>
          )}
          {!media && scene === 'sneaker' && (
            <div className="rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-750"><p className="mb-1.5 text-[12px] text-ink-400">Colourway</p><Segmented size="sm" value={variant} onChange={setVariant} options={sceneMeta('sneaker').variants!.map((v, i) => ({ value: i, label: v }))} /></div>
          )}
          <ToolSection title="Scopes" locked={lockMsg('scopes')} right={unlocked('scopes') ? undefined : <Badge tone="outline">Locked</Badge>}>
            <ScopePanel frame={frame} />
          </ToolSection>
          {media && <Note tone="caution">Your file is display-referred (already tone-mapped by a camera or app). The Lab decodes it with the sRGB curve and treats it as linear light, which is an approximation; highlight roll-off starts at “hard clip” so the untouched image looks exactly like your original.</Note>}
        </div>

        <aside className="space-y-3">
          <ToolSection title="White balance & exposure">
            <WhiteBalancePanel p={p} set={set} />
            <div className="mt-3"><TonePanel p={p} set={set} include={['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'rolloff']} /></div>
          </ToolSection>
          <ToolSection title="Gamma" open={false} locked={lockMsg('gamma')}>
            <Slider label="Gamma γ" value={Math.log2(p.gamma)} min={Math.log2(0.3)} max={Math.log2(3.3)} step={0.005} defaultValue={0} onChange={(v) => set({ gamma: Math.pow(2, v) })} format={(v) => `γ ${Math.pow(2, v).toFixed(2)}`} />
          </ToolSection>
          <ToolSection title="Lift · Gamma · Gain" open={false} locked={lockMsg('wheels')}><WheelsPanel p={p} set={set} size={120} /></ToolSection>
          <ToolSection title="Curves" open={false} locked={lockMsg('curves')}><CurveEditor curves={p.curves} onChange={(curves) => set({ curves })} /></ToolSection>
          <ToolSection title="HSL mixer" open={false} locked={lockMsg('hsl')}><HslMixer hsl={p.hsl} onChange={(hsl) => set({ hsl })} /></ToolSection>
          <ToolSection title="Saturation" open={false}><ColourPanel p={p} set={set} /></ToolSection>
          <ToolSection title="Film emulation" open={false} locked={lockMsg('film')}><FilmPanel p={p} set={set} /></ToolSection>
        </aside>
      </div>
    </div>
  );
}
