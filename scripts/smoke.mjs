// Headless smoke test: opens each route, collects console errors and saves screenshots.
// Usage: node scripts/smoke.mjs [baseUrl] [route ...]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173/';
const routes = process.argv.slice(3);
const list = routes.length ? routes : ['/'];
mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
await ctx.addInitScript(() => {
  localStorage.setItem('the-3d-lab-progress', JSON.stringify({ state: { settings: { difficulty: 'beginner', tamil: true, explorer: true, unit: 'mm', hints: true } }, version: 1 }));
});
let failures = 0;
for (const r of list) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + '#' + r, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const name = r.replace(/[^a-z0-9]+/gi, '_') || 'home';
  await page.screenshot({ path: `test-results/${name}.png` });
  const relevant = errors.filter((e) => !/GPU stall|WebGL|THREE.WebGLRenderer: Context Lost|Download the React DevTools/.test(e));
  if (relevant.length) failures++;
  console.log(`${relevant.length ? 'FAIL' : 'ok  '} ${r}${relevant.length ? '\n   ' + relevant.slice(0, 4).join('\n   ') : ''}`);
  await page.close();
}
await browser.close();
process.exit(failures ? 1 : 0);
