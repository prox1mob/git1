// Runs in an isolated world with Node access, before the page's own scripts.
// Exposes a minimal, typed bridge at window.electronAPI (see src/lib/native.ts).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  print: () => ipcRenderer.invoke('lab:print'),
  saveFile: (filename, data) => ipcRenderer.invoke('lab:save-file', filename, data),
});
