import { useCallback } from 'react';
import { useToast } from '../components/Toaster';
import { useProgress } from '../state/progress';

export interface GalleryItem {
  id: string;
  title: string;
  source: string;
  createdAt: string;
  /** JPEG data URL. */
  image: string;
  score?: number;
  notes?: string;
}

const DB = 'visual-lab';
const STORE = 'gallery';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function listGallery(): Promise<GalleryItem[]> {
  const all = await tx<GalleryItem[]>('readonly', (s) => s.getAll() as IDBRequest<GalleryItem[]>);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export const removeFromGallery = (id: string) => tx('readwrite', (s) => s.delete(id));
export const addToGallery = (item: GalleryItem) => tx('readwrite', (s) => s.put(item));

/** Downscale a data URL to keep the gallery light. */
export async function downscale(dataUrl: string, maxW = 1400, quality = 0.88): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  if (img.width <= maxW) return dataUrl;
  const c = document.createElement('canvas');
  c.width = maxW;
  c.height = Math.round((img.height * maxW) / img.width);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

export function useSaveToGallery() {
  const toast = useToast();
  const { bumpGallery } = useProgress();
  return useCallback(async (item: Omit<GalleryItem, 'id' | 'createdAt'>) => {
    try {
      const image = await downscale(item.image);
      await addToGallery({ ...item, image, id: crypto.randomUUID?.() ?? String(Date.now()), createdAt: new Date().toISOString() });
      bumpGallery(1);
      toast({ title: 'Saved to your gallery', body: item.title, glyph: '▤' });
      return true;
    } catch {
      toast({ title: 'Could not save', body: 'Browser storage (IndexedDB) is unavailable or full.' });
      return false;
    }
  }, [toast, bumpGallery]);
}
