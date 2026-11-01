import { Capacitor, registerPlugin } from '@capacitor/core';
import { toast } from '../store/toast';

/** True inside the Android app (Capacitor), false in a normal browser or the desktop app. */
export const isNative = Capacitor.isNativePlatform();

interface ElectronAPI {
  isElectron: true;
  print(): Promise<{ ok: boolean; reason?: string }>;
  saveFile(filename: string, data: Uint8Array): Promise<{ ok: boolean; path?: string }>;
}
/** Exposed by electron/preload.cjs. Present only inside the macOS/Windows/Linux desktop app. */
const electronAPI: ElectronAPI | undefined = typeof window !== 'undefined' ? (window as unknown as { electronAPI?: ElectronAPI }).electronAPI : undefined;
export const isElectron = !!electronAPI;

interface LabPrintPlugin {
  print(options: { name: string }): Promise<void>;
}
/** App-local native plugin (android/app/.../LabPrintPlugin.java): Android WebView ignores window.print(). */
const LabPrint = registerPlugin<LabPrintPlugin>('LabPrint');

export async function printPage(name: string) {
  try {
    if (electronAPI) {
      const r = await electronAPI.print();
      if (!r.ok && r.reason) toast(`Printing was cancelled: ${r.reason}`);
      return;
    }
    if (isNative) return await LabPrint.print({ name });
    window.print();
  } catch (e) {
    toast(`Printing is not available: ${(e as Error).message}`);
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

const FOLDER = 'The3DLab';

/** Desktop app (Electron): native "Save As" dialog, written directly to disk. */
export async function saveElectronFile(blob: Blob, filename: string) {
  const data = new Uint8Array(await blob.arrayBuffer());
  const r = await electronAPI!.saveFile(filename, data);
  if (r.ok) toast(`💾 Saved ${r.path ?? filename}`, 4000);
}

/**
 * Android: saves the file to Documents/The3DLab (falls back to app cache if that is not allowed)
 * and opens the share sheet so it can be sent to a slicer, Drive, e-mail…
 */
export async function saveNativeFile(blob: Blob, filename: string) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const data = await blobToBase64(blob);
  let uri: string;
  let where = '';
  try {
    const perm = await Filesystem.checkPermissions();
    if (perm.publicStorage !== 'granted' && (await Filesystem.requestPermissions()).publicStorage !== 'granted') throw new Error('no storage permission');
    uri = (await Filesystem.writeFile({ path: `${FOLDER}/${filename}`, data, directory: Directory.Documents, recursive: true })).uri;
    where = `Documents/${FOLDER}/${filename}`;
  } catch {
    uri = (await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache })).uri;
  }
  toast(where ? `💾 Saved to ${where}` : `📦 ${filename} is ready to share`, 4000);
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title: filename, files: [uri] });
  } catch {
    // The user closed the share sheet; the file is already saved.
  }
}

/** Android back button: go back through the app's screens, minimise the app on the first screen. */
export async function initNative() {
  if (isElectron) document.documentElement.classList.add('native', 'electron');
  if (!isNative) return;
  document.documentElement.classList.add('native');
  const { App } = await import('@capacitor/app');
  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else App.minimizeApp();
  });
}
