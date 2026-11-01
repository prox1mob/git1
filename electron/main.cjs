// Electron main process. Loads the built web app (dist/) through a custom "app://"
// protocol instead of file://, because file:// breaks ES module code-splitting
// (dynamic import() of the per-level chunks gets blocked by Chromium's CORS rules
// for the file: origin). app:// is registered as a standard, secure, fetch-enabled
// scheme, so it behaves like a normal same-origin web app.
const { app, BrowserWindow, Menu, shell, dialog, ipcMain, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

const isDev = !app.isPackaged;
// Packaged app: dist/ is bundled next to this file (see package.json "build.files").
// Dev run (`npm run electron:dev`, after `npm run build`): dist/ is at the repo root.
const distDir = isDev ? path.join(__dirname, '..', 'dist') : path.join(__dirname, '..', 'dist');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b0f14',
    title: 'The 3D Lab',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.setMenuBarVisibility(false); // Windows/Linux: the game has its own top bar. macOS uses the app menu below.
  win.loadURL('app://local/index.html');

  // Any attempt to open a new window (there are none in the app today) opens the
  // user's default browser instead of a second Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  return win;
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },
    // Required on macOS for Cmd+C / Cmd+V / Cmd+X / Cmd+A / Cmd+Z to work in text fields —
    // without an Edit menu with these roles, Electron does not wire up those shortcuts.
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '' || pathname === '/') pathname = '/index.html';
    const filePath = path.normalize(path.join(distDir, pathname));
    if (!filePath.startsWith(distDir)) return new Response('Forbidden', { status: 403 }); // path traversal guard
    return net.fetch(pathToFileURL(filePath).toString());
  });

  ipcMain.handle('lab:print', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return new Promise((resolve) => {
      win.webContents.print({}, (ok, reason) => resolve({ ok, reason }));
    });
  });

  ipcMain.handle('lab:save-file', async (event, filename, data) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: filename });
    if (canceled || !filePath) return { ok: false };
    await fs.writeFile(filePath, Buffer.from(data));
    return { ok: true, path: filePath };
  });

  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
