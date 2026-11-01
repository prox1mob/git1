import { Capacitor, registerPlugin } from '@capacitor/core';
import { toast } from '../store/toast';

/** True inside the Android app (Capacitor), false in a normal browser. */
export const isNative = Capacitor.isNativePlatform();

interface LabPrintPlugin {
  print(options: { name: string }): Promise<void>;
}
/** App-local native plugin (android/app/.../LabPrintPlugin.java): Android WebView ignores window.print(). */
const LabPrint = registerPlugin<LabPrintPlugin>('LabPrint');

export async function printPage(name: string) {
  if (!isNative) return window.print();
  try {
    await LabPrint.print({ name });
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
  if (!isNative) return;
  document.documentElement.classList.add('native');
  const { App } = await import('@capacitor/app');
  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else App.minimizeApp();
  });
}
