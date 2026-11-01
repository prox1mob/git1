// Renders the Android launcher icons and splash screens from the app logo.
// Usage: node scripts/android-assets.mjs   (after `npx cap add android`)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }

const RES = 'android/app/src/main/res';
const BG = '#0b0f14';
// Logo artwork in a 64-unit box (same as public/icon.svg, without its background).
const LOGO = `<path d="M32 10 52 21v22L32 54 12 43V21z" fill="none" stroke="#4cc9f0" stroke-width="3" stroke-linejoin="round"/>
<path d="M32 32 52 21M32 32v22M32 32 12 21" stroke="#f8961e" stroke-width="3" stroke-linecap="round"/>`;

const logoAt = (cx, cy, size) => `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 64})">${LOGO}</g>`;

const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const browser = await pw.chromium.launch();
const page = await browser.newPage();
async function render(file, w, h, svgBody, transparent = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">${svgBody}</svg></body></html>`);
  writeFileSync(`${RES}/${file}`, await page.screenshot({ omitBackground: transparent, type: 'png' }));
}

for (const [d, k] of Object.entries(DENS)) {
  const s = 48 * k; // legacy icon
  await render(`mipmap-${d}/ic_launcher.png`, s, s, `<rect x="${s * 0.04}" y="${s * 0.04}" width="${s * 0.92}" height="${s * 0.92}" rx="${s * 0.2}" fill="${BG}"/>${logoAt(s / 2, s / 2, s * 0.86)}`, true);
  await render(`mipmap-${d}/ic_launcher_round.png`, s, s, `<circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.46}" fill="${BG}"/>${logoAt(s / 2, s / 2, s * 0.8)}`, true);
  const f = 108 * k; // adaptive foreground: keep the artwork inside the 66 dp safe zone
  await render(`mipmap-${d}/ic_launcher_foreground.png`, f, f, logoAt(f / 2, f / 2, f * 0.72), true);
}

const splash = (w, h) => {
  const m = Math.min(w, h);
  const logo = m * 0.3;
  const fs = Math.max(12, m * 0.055);
  return `<rect width="${w}" height="${h}" fill="${BG}"/>${logoAt(w / 2, h / 2 - fs, logo)}
<text x="${w / 2}" y="${h / 2 + logo / 2 + fs * 0.6}" fill="#e6edf3" font-family="Roboto, 'Noto Sans', sans-serif" font-weight="800" font-size="${fs}" letter-spacing="${fs * 0.12}" text-anchor="middle">THE 3D LAB</text>`;
};
const SPLASH = {
  'drawable/splash.png': [480, 320],
  'drawable-land-mdpi/splash.png': [480, 320],
  'drawable-land-hdpi/splash.png': [800, 480],
  'drawable-land-xhdpi/splash.png': [1280, 720],
  'drawable-land-xxhdpi/splash.png': [1600, 960],
  'drawable-land-xxxhdpi/splash.png': [1920, 1280],
  'drawable-port-mdpi/splash.png': [320, 480],
  'drawable-port-hdpi/splash.png': [480, 800],
  'drawable-port-xhdpi/splash.png': [720, 1280],
  'drawable-port-xxhdpi/splash.png': [960, 1600],
  'drawable-port-xxxhdpi/splash.png': [1280, 1920],
};
for (const [file, [w, h]] of Object.entries(SPLASH)) await render(file, w, h, splash(w, h));

await browser.close();
console.log('Android icons and splash screens written to', RES);
