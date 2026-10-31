import type { Frame } from './GradeEngine';
import { histogram, SKIN_LINE_DEG, ycbcr } from './analysis';

const BG = '#0d0d0d';
const GRID = 'rgba(255,255,255,0.09)';
const LABEL = 'rgba(255,255,255,0.38)';

function prep(canvas: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  return { ctx, w, h, dpr };
}

export function drawHistogram(canvas: HTMLCanvasElement, f: Frame, mode: 'rgb' | 'luma' = 'rgb') {
  const { ctx, w, h } = prep(canvas);
  const hist = histogram(f);
  const chans = mode === 'rgb' ? [[hist.r, 'rgba(255,70,70,0.75)'], [hist.g, 'rgba(70,230,90,0.7)'], [hist.b, 'rgba(80,130,255,0.8)']] as const : [[hist.y, 'rgba(235,235,235,0.85)']] as const;
  let max = 1;
  for (const [a] of chans) for (let i = 2; i < 254; i++) max = Math.max(max, a[i]);
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo((w * i) / 4, 0); ctx.lineTo((w * i) / 4, h); ctx.stroke(); }
  ctx.globalCompositeOperation = 'lighter';
  for (const [a, col] of chans) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < 256; i++) ctx.lineTo((i / 255) * w, h - Math.min(1, Math.sqrt(a[i] / max)) * (h - 4));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // clipping indicators
  const lo = (hist.y[0] + hist.y[1]) / hist.total, hi = (hist.r[255] + hist.g[255] + hist.b[255]) / (3 * hist.total);
  ctx.font = '10px "JetBrains Mono Variable", monospace';
  ctx.fillStyle = lo > 0.005 ? '#5c8dff' : LABEL;
  ctx.fillText(`◀ ${(lo * 100).toFixed(1)}%`, 4, 12);
  ctx.fillStyle = hi > 0.005 ? '#ff5a5a' : LABEL;
  const t = `${(hi * 100).toFixed(1)}% ▶`;
  ctx.fillText(t, w - ctx.measureText(t).width - 4, 12);
}

/** Waveform: x = image column, y = signal level (0–100%). `parade` splits R, G, B side by side. */
export function drawWaveform(canvas: HTMLCanvasElement, f: Frame, mode: 'luma' | 'parade' | 'overlay' = 'luma', gain = 1) {
  const { ctx, w, h, dpr } = prep(canvas);
  const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
  const img = ctx.createImageData(W, H);
  const acc = new Float32Array(W * H * 3);
  const d = f.data;
  const pad = 6 * dpr;
  const plotH = H - pad * 2;
  const panels = mode === 'parade' ? 3 : 1;
  const panelW = W / panels;
  const per = (f.width * f.height) / (W * plotH);
  const k = (0.9 * gain) / Math.max(1, per * 0.6);
  for (let y = 0; y < f.height; y++) {
    for (let x = 0; x < f.width; x++) {
      const i = (y * f.width + x) * 4;
      const R = d[i] / 255, G = d[i + 1] / 255, B = d[i + 2] / 255;
      if (mode === 'luma') {
        const X = Math.floor((x / f.width) * W);
        const Y = Math.round(pad + (1 - (0.2126 * R + 0.7152 * G + 0.0722 * B)) * plotH);
        const j = (Y * W + X) * 3;
        acc[j] += k; acc[j + 1] += k; acc[j + 2] += k;
      } else {
        const vals = [R, G, B];
        for (let c = 0; c < 3; c++) {
          const X = mode === 'parade' ? Math.floor(c * panelW + (x / f.width) * (panelW - 2)) : Math.floor((x / f.width) * W);
          const Y = Math.round(pad + (1 - vals[c]) * plotH);
          acc[(Y * W + X) * 3 + c] += k * (mode === 'overlay' ? 0.8 : 1);
        }
      }
    }
  }
  for (let i = 0, j = 0; i < acc.length; i += 3, j += 4) {
    const a = acc[i], b = acc[i + 1], c = acc[i + 2];
    if (mode === 'parade' || mode === 'overlay') {
      img.data[j] = Math.min(255, 255 * (1 - Math.exp(-a)) + 40 * (1 - Math.exp(-b - c)) * 0.3);
      img.data[j + 1] = Math.min(255, 255 * (1 - Math.exp(-b)) + 20 * (1 - Math.exp(-a - c)) * 0.3);
      img.data[j + 2] = Math.min(255, 255 * (1 - Math.exp(-c)) + 40 * (1 - Math.exp(-a)) * 0.1);
    } else {
      const v = 1 - Math.exp(-a);
      img.data[j] = 130 * v; img.data[j + 1] = 255 * v; img.data[j + 2] = 150 * v;
    }
    img.data[j + 3] = 255;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.putImageData(img, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // graticule: 0, 25, 50, 75, 100%
  ctx.strokeStyle = GRID;
  ctx.fillStyle = LABEL;
  ctx.font = '9px "JetBrains Mono Variable", monospace';
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    const y = 6 + (1 - v) * (h - 12);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    ctx.fillText(String(Math.round(v * 100)), 3, y - 2);
  }
  if (mode === 'parade') {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    for (let c = 1; c < 3; c++) { ctx.beginPath(); ctx.moveTo((w * c) / 3, 0); ctx.lineTo((w * c) / 3, h); ctx.stroke(); }
  }
}

const TARGETS: [string, [number, number, number]][] = [
  ['R', [0.75, 0, 0]], ['Mg', [0.75, 0, 0.75]], ['B', [0, 0, 0.75]], ['Cy', [0, 0.75, 0.75]], ['G', [0, 0.75, 0]], ['Yl', [0.75, 0.75, 0]],
];

/** Vectorscope: Cb on x, Cr on y. Distance from the centre = saturation, angle = hue. */
export function drawVectorscope(canvas: HTMLCanvasElement, f: Frame, zoom = 1) {
  const { ctx, w, h, dpr } = prep(canvas);
  const W = Math.round(w * dpr), H = Math.round(h * dpr);
  const R = Math.min(W, H) / 2 - 8 * dpr;
  const cx = W / 2, cy = H / 2;
  const scale = (R / 0.5) * 0.92 * zoom;
  const acc = new Float32Array(W * H * 4);
  const d = f.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const [, cb, cr] = ycbcr(r, g, b);
    const X = Math.round(cx + cb * scale), Y = Math.round(cy - cr * scale);
    if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const j = (Y * W + X) * 4;
    acc[j] += 0.25 + r; acc[j + 1] += 0.25 + g; acc[j + 2] += 0.25 + b; acc[j + 3] += 1;
  }
  const img = ctx.createImageData(W, H);
  const k = 2.2 / Math.max(1, (f.width * f.height) / (W * H) * 4);
  for (let j = 0; j < acc.length; j += 4) {
    const n = acc[j + 3];
    if (!n) { img.data[j] = 13; img.data[j + 1] = 13; img.data[j + 2] = 13; img.data[j + 3] = 255; continue; }
    const v = 1 - Math.exp(-n * k);
    img.data[j] = Math.min(255, 13 + (acc[j] / n) * 200 * v);
    img.data[j + 1] = Math.min(255, 13 + (acc[j + 1] / n) * 200 * v);
    img.data[j + 2] = Math.min(255, 13 + (acc[j + 2] / n) * 200 * v);
    img.data[j + 3] = 255;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.putImageData(img, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const c = { x: w / 2, y: h / 2 };
  const s = scale / dpr;
  ctx.strokeStyle = GRID;
  ctx.beginPath(); ctx.arc(c.x, c.y, (R / dpr), 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(c.x - R / dpr, c.y); ctx.lineTo(c.x + R / dpr, c.y); ctx.moveTo(c.x, c.y - R / dpr); ctx.lineTo(c.x, c.y + R / dpr); ctx.stroke();
  // skin-tone line
  const a = (SKIN_LINE_DEG * Math.PI) / 180;
  ctx.strokeStyle = 'rgba(255,200,150,0.45)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(a) * (R / dpr), c.y - Math.sin(a) * (R / dpr)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '9px "JetBrains Mono Variable", monospace';
  for (const [label, [r, g, b]] of TARGETS) {
    const [, cb, cr] = ycbcr(r, g, b);
    const x = c.x + cb * s, y = c.y - cr * s;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = LABEL;
    ctx.fillText(label, x + 6, y + 3);
  }
  if (zoom !== 1) { ctx.fillStyle = LABEL; ctx.fillText(`×${zoom}`, 4, 12); }
}
