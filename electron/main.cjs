// Desktop shell for The Visual Lab (macOS DMG via electron-builder).
// The web app is bundled in dist/ and served from a private app:// origin, so it works fully
// offline and keeps its own storage (progress in localStorage, gallery in IndexedDB).
const { app, BrowserWindow, Menu, net, nativeTheme, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DIST = path.join(__dirname, '..', 'dist');
const ORIGIN = 'app://visual-lab';
const SMOKE = process.argv.includes('--smoke-test');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);
app.setName('The Visual Lab');

function serveDist() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname === '/' ? '/index.html' : pathname)));
    if (!file.startsWith(DIST + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: 'The Visual Lab',
    backgroundColor: '#111111',
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  win.once('ready-to-show', () => { if (!SMOKE) win.show(); });
  // Keep the app in its window; anything external opens in the user's browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(ORIGIN)) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });
  win.loadURL(`${ORIGIN}/index.html`);
  return win;
}

/** CI check: load the home page and a WebGL lesson, report what rendered, then quit. */
function smokeTest(win) {
  const errors = [];
  win.webContents.on('console-message', (event, level, message) => {
    const lvl = event.level ?? level;
    if (lvl === 'error' || lvl === 3) errors.push(String(event.message ?? message).slice(0, 300));
  });
  win.webContents.on('render-process-gone', (_e, details) => { errors.push(`renderer gone: ${details.reason}`); });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const read = () => win.webContents.executeJavaScript(`({
    h1: document.querySelector('h1')?.textContent ?? null,
    canvases: document.querySelectorAll('canvas').length,
    webgl2: !!document.createElement('canvas').getContext('webgl2'),
    storage: (() => { try { localStorage.setItem('__t', '1'); return true; } catch { return false; } })(),
  })`);
  win.webContents.once('did-finish-load', async () => {
    await wait(4000);
    const home = await read();
    await win.webContents.executeJavaScript(`location.hash = '#/play/w3-2'`);
    await wait(5000);
    const lesson = await read();
    const ok = Boolean(home.h1) && lesson.h1 === 'The Gamma Laboratory' && errors.length === 0;
    process.stdout.write(`SMOKE ${JSON.stringify({ ok, home, lesson, errors })}\n`);
    app.exit(ok ? 0 : 1);
  });
  setTimeout(() => { process.stdout.write(`SMOKE ${JSON.stringify({ ok: false, errors: [...errors, 'timeout'] })}\n`); app.exit(1); }, 60000);
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  serveDist();
  if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
  ]));
  const win = createWindow();
  if (SMOKE) smokeTest(win);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
