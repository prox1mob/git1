// Renders the macOS app icon (.icns) and the DMG window background from the app logo.
// Usage: node scripts/mac-assets.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const png2icons = require('png2icons');

const OUT = 'build-resources';
const BG = '#0b0f14';
const LOGO = `<path d="M32 10 52 21v22L32 54 12 43V21z" fill="none" stroke="#4cc9f0" stroke-width="3" stroke-linejoin="round"/>
<path d="M32 32 52 21M32 32v22M32 32 12 21" stroke="#f8961e" stroke-width="3" stroke-linecap="round"/>`;
const logoAt = (cx, cy, size) => `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 64})">${LOGO}</g>`;

const browser = await pw.chromium.launch();
const page = await browser.newPage();
async function renderPng(w, h, svgBody, transparent = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">${svgBody}</svg></body></html>`);
  return page.screenshot({ omitBackground: transparent, type: 'png' });
}

// macOS icons have rounded-square artwork inset from the full 1024x1024 canvas (Apple's "squircle" look
// is applied by the OS itself from a plain square source image with transparent padding around it).
const S = 1024;
const iconPng = await renderPng(S, S, `<rect x="${S * 0.07}" y="${S * 0.07}" width="${S * 0.86}" height="${S * 0.86}" rx="${S * 0.22}" fill="${BG}"/>${logoAt(S / 2, S / 2, S * 0.74)}`, true);
const icns = png2icons.createICNS(iconPng, png2icons.BICUBIC2, 0);
if (!icns) throw new Error('png2icons failed to build the .icns file');
writeFileSync(`${OUT}/icon.icns`, icns);
// Windows/Linux Electron builds (not requested here, but electron-builder wants a .png fallback too).
writeFileSync(`${OUT}/icon.png`, iconPng);

// DMG window background. electron-builder reads the *pixel* size of this file (via macOS `sips`) and
// uses it directly as the window's point size, so it must be drawn at the actual window size (660x420 —
// matches the dmg.window.width/height below), plus a @2x variant at double that for Retina.
// Icon positions below (dmg.contents x/y, in the same 660x420 space) must match the arrow drawn here.
const W = 660, H = 420;
const iconY = 260;
function dmgSvg(scale) {
  const s = (n) => n * scale;
  return `
  <rect width="${s(W)}" height="${s(H)}" fill="${BG}"/>
  <text x="${s(W / 2)}" y="${s(72)}" fill="#e6edf3" font-family="Roboto, 'Noto Sans', sans-serif" font-weight="800" font-size="${s(30)}" letter-spacing="${s(2)}" text-anchor="middle">THE 3D LAB</text>
  <text x="${s(W / 2)}" y="${s(100)}" fill="#8aa0b4" font-family="Roboto, 'Noto Sans', sans-serif" font-size="${s(14)}" text-anchor="middle">Drag the app into Applications to install</text>
  <path d="M ${s(235)} ${s(iconY)} L ${s(410)} ${s(iconY)}" stroke="#4cc9f0" stroke-width="${s(2.5)}" stroke-dasharray="${s(7)} ${s(6)}" fill="none" marker-end="url(#arrow)"/>
  <defs><marker id="arrow" markerWidth="${s(6)}" markerHeight="${s(6)}" refX="${s(4)}" refY="${s(2.5)}" orient="auto"><path d="M0,0 L${s(5)},${s(2.5)} L0,${s(5)} Z" fill="#4cc9f0"/></marker></defs>
`;
}
writeFileSync(`${OUT}/dmg-background.png`, await renderPng(W, H, dmgSvg(1)));
writeFileSync(`${OUT}/dmg-background@2x.png`, await renderPng(W * 2, H * 2, dmgSvg(2)));

await browser.close();
console.log('macOS icon and DMG background written to', OUT);
