import { Eyebrow, Note } from '../components/ui';

const PIPELINE: [string, string, string][] = [
  ['0', 'Decode', 'Procedural scenes are generated directly in scene-linear light (Rec.709 primaries, D65 white; an 18% grey card reads 0.18). Your own JPEGs and videos are decoded with the sRGB curve — an approximation, because they were already tone-mapped by a camera.'],
  ['1', 'White balance', 'A Bradford chromatic-adaptation matrix from the assumed scene illuminant (temperature + tint on the Planckian locus) to the reference white. Lowering the temperature tells the software “the light was warmer”, so the image cools — as in Lightroom.'],
  ['2', 'Exposure', 'Multiply scene-linear values by 2^EV. One stop doubles the light. This is the only place exposure is applied.'],
  ['3', 'Halation & vignette', 'Linear-light effects: blurred, red-shifted highlights are added; lens falloff is a radial gain.'],
  ['4', 'Contrast, highlights, shadows', 'Contrast scales log2 distance from 18% grey (the pivot). Highlights/shadows add or remove stops through smooth luminance masks. Global curves, not local tone mapping.'],
  ['5', 'Display transform', 'A per-channel highlight shoulder (“roll-off”) compresses values above a knee toward 1.0, then the sRGB encoding curve is applied. From here on the image is display-referred, 0–1.'],
  ['6', 'Whites / blacks, gamma', 'Endpoint adjustments, then an optional pure power law (out = in^(1/γ)) used by the Gamma Laboratory.'],
  ['7', 'Lift / gamma / gain', 'Per-channel: lift raises blacks with white fixed, gain scales, gamma bends mids. Wheel directions follow Rec.709 vectorscope orientation.'],
  ['8', 'Curves', 'Master curve then R, G, B curves, monotone cubic interpolation, baked to a 1024-entry lookup table.'],
  ['9', 'HSL & saturation', 'Converted to linear then Oklab; eight overlapping hue bands adjust hue, chroma and lightness. Neutrals are protected by a chroma mask. Saturation, vibrance and film-like density live here too.'],
  ['10', 'Fade & grain', 'Lifted black level, then luminance-weighted procedural grain. Finally values are clamped to the 0–1 display range and sent to the screen.'],
];

export default function Notes() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
      <header className="pt-10 pb-6">
        <Eyebrow>Lab notes</Eyebrow>
        <h1 className="mt-2 font-display text-[52px] leading-none text-ink-50">How the Lab sees</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-300">
          Everything you grade passes through one documented pipeline running on your GPU. Order matters: exposure in linear light is not the same as brightening a gamma-encoded image, and neither is the same as an HSL tweak.
        </p>
      </header>
      <section className="rounded-2xl bg-ink-850 p-6 ring-1 ring-ink-750">
        <Eyebrow>Processing order</Eyebrow>
        <ol className="mt-4 space-y-4">
          {PIPELINE.map(([n, t, d]) => (
            <li key={n} className="grid grid-cols-[36px_1fr] gap-3">
              <span className="font-mono text-[12px] text-ink-500">{n.padStart(2, '0')}</span>
              <div><p className="text-[15px] font-medium text-ink-50">{t}</p><p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-300">{d}</p></div>
            </li>
          ))}
        </ol>
      </section>
      <section className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl bg-ink-850 p-6 ring-1 ring-ink-750">
          <Eyebrow>Measurements</Eyebrow>
          <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-ink-300">
            <li><b className="text-ink-100">Colour difference</b> — CIEDE2000 (ΔE00), verified against Sharma’s published test data.</li>
            <li><b className="text-ink-100">Text contrast</b> — WCAG 2.x relative luminance and contrast ratio.</li>
            <li><b className="text-ink-100">White balance</b> — chroma C*ab of a known neutral patch after your correction.</li>
            <li><b className="text-ink-100">Exposure</b> — clipping fractions and luminance percentiles from the rendered pixels.</li>
            <li><b className="text-ink-100">Scopes</b> — Rec.709 luma and Y′CbCr computed from the actual output frame.</li>
          </ul>
        </div>
        <div className="rounded-2xl bg-ink-850 p-6 ring-1 ring-ink-750">
          <Eyebrow>Honest limitations</Eyebrow>
          <div className="mt-3 space-y-3">
            <Note tone="caution">Browsers mostly assume an sRGB display. Wide-gamut, HDR or uncalibrated screens will show colours differently; ΔE scores describe the numbers, not your particular screen.</Note>
            <Note tone="caution">The Log lessons use the published Sony S-Log3, ARRI LogC3 and Panasonic V-Log transfer curves, but not their camera gamuts. Real footage also needs a gamut conversion.</Note>
            <Note tone="caution">Film emulation here is a set of perceptual approximations. Physical film models use spectral dye densities, interlayer effects and grain structure we do not simulate.</Note>
            <Note tone="info">Creative scores combine measurements with a transparent rubric. They are guidance from a (very opinionated) art director, not objective truth.</Note>
          </div>
        </div>
      </section>
    </div>
  );
}
