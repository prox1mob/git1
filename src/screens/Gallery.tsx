import { useEffect, useState } from 'react';
import { Badge, Button, Eyebrow } from '../components/ui';
import { listGallery, removeFromGallery, type GalleryItem } from '../lib/gallery';
import { navigate } from '../lib/router';
import { useProgress } from '../state/progress';

export default function Gallery() {
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<GalleryItem | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const { bumpGallery } = useProgress();
  useEffect(() => { listGallery().then(setItems).catch(() => setError(true)); }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);

  const del = async (id: string) => {
    await removeFromGallery(id);
    setItems((xs) => xs?.filter((x) => x.id !== id) ?? null);
    bumpGallery(-1);
    setConfirm(null);
    setOpen(null);
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 sm:px-6">
      <header className="pt-10 pb-6">
        <Eyebrow>Your portfolio</Eyebrow>
        <h1 className="mt-2 font-display text-[52px] leading-none text-ink-50">Gallery</h1>
        <p className="mt-3 max-w-2xl text-[15px] text-ink-300">Everything you chose to keep: grades from the Sandbox and labs, covers, posters and campaigns. Stored privately in this browser.</p>
      </header>
      {error && <p className="rounded-xl bg-warn/10 p-4 text-[13.5px] text-warn">This browser does not allow local storage for images (IndexedDB is unavailable — often private browsing). The gallery cannot be shown here.</p>}
      {items && items.length === 0 && (
        <div className="rounded-2xl bg-ink-850 p-8 ring-1 ring-ink-750">
          <p className="font-display text-[26px] text-ink-50">Nothing here yet.</p>
          <p className="mt-2 max-w-xl text-[14px] text-ink-300">Look for “Save to gallery” in the Sandbox, the Photography Master Challenge, the Magazine Art Director, Master of Colour and every Creative Director mission.</p>
          <div className="mt-4 flex gap-3"><Button variant="primary" onClick={() => navigate('sandbox')}>Open the Sandbox</Button><Button onClick={() => navigate('world/w5')}>Creative Director Studio</Button></div>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {items.map((it) => (
            <figure key={it.id} className="vl-rise mb-4 break-inside-avoid overflow-hidden rounded-2xl bg-ink-850 ring-1 ring-ink-750">
              <button className="block w-full" onClick={() => setOpen(it)} aria-label={`Open ${it.title}`}><img src={it.image} alt={it.title} className="block w-full" loading="lazy" /></button>
              <figcaption className="flex items-start justify-between gap-3 p-3.5">
                <div>
                  <p className="text-[13.5px] text-ink-100">{it.title}</p>
                  <p className="text-[11.5px] text-ink-500">{it.source} · {new Date(it.createdAt).toLocaleDateString()}</p>
                </div>
                {typeof it.score === 'number' && <Badge tone="outline">{it.score}</Badge>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {open && (
        <div className="vl-fade fixed inset-0 z-50 flex flex-col bg-black/90 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={open.title}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-display text-[24px] text-ink-50">{open.title}</p><p className="text-[12px] text-ink-400">{open.source} · {new Date(open.createdAt).toLocaleString()}</p></div>
            <div className="flex gap-2">
              <a href={open.image} download={`${open.title.replace(/[^\w\- ]+/g, '').trim() || 'visual-lab'}.jpg`} className="inline-flex h-11 items-center rounded-full bg-ink-750 px-4 text-sm text-ink-100 ring-1 ring-ink-650 hover:bg-ink-700">Download</a>
              {confirm === open.id ? <Button variant="primary" onClick={() => del(open.id)}>Confirm delete</Button> : <Button variant="ghost" onClick={() => setConfirm(open.id)}>Delete</Button>}
              <Button onClick={() => { setOpen(null); setConfirm(null); }}>Close</Button>
            </div>
          </div>
          <div className="grid min-h-0 flex-1 place-items-center"><img src={open.image} alt={open.title} className="max-h-full max-w-full rounded-lg object-contain" /></div>
        </div>
      )}
    </div>
  );
}
