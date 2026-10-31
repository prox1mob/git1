# The Visual Lab

An interactive game for learning visual design, colour science, typography, photography and cinematic colour grading — by seeing, experimenting, measuring and refining.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (relative paths, works from any host)
npm test           # colour-science unit tests
```

## Android app (APK)

The app is wrapped for Android with [Capacitor](https://capacitorjs.com) (`capacitor.config.ts`, `android/`). It runs fully offline — fonts, scenes and the grading engine are bundled — and needs Android 7.0+ with a WebGL2-capable System WebView (any up-to-date device).

- **Easiest:** every push runs the **Android APK** GitHub Actions workflow (`.github/workflows/android-apk.yml`). Open the run under the repository’s *Actions* tab and download `the-visual-lab-apk` from *Artifacts*. Unzip it and install `the-visual-lab-debug.apk` on your device (allow “install unknown apps” for your browser or file manager).
- **Locally:** with the Android SDK installed (e.g. via Android Studio) and JDK 21, run `npm run android:apk`; the APK lands in `android/app/build/outputs/apk/debug/`. `npm run android:open` opens the project in Android Studio.

The APK is a *debug* build, signed with a development key: ideal for sideloading and testing. Publishing on Google Play needs a release build signed with your own key.

Requires a browser with WebGL2 for the grading worlds (any recent Chrome, Edge, Firefox or Safari, including Android tablets). The Colour and Typography worlds work without it.

## What is in the game

Every lesson follows the same sequence: **Observe → Experiment → Discover → Challenge → Feedback → Refine**. Challenges are scored out of 100 with a visible breakdown, “what worked / what to improve / why”, unlimited retries and attempt-to-attempt comparison.

| World | Lessons |
|---|---|
| 01 · The Colour Laboratory | Colour Detective · Colour Mixer (ΔE2000) · Colour Harmony · Colour Psychology · Contrast & Accessibility (WCAG) · Simultaneous Contrast · Palette Architect · Master of Colour |
| 02 · Typography Academy | Anatomy of Letters · Typeface Families · Kerning Surgery · Tracking & Leading · Visual Hierarchy · Typeface Pairing · Editorial Composition · The Magazine Art Director |
| 03 · Photography Grading Lab | Exposure & Tonal Values · Gamma Laboratory · Dynamic Range · White Balance · Lift/Gamma/Gain · RGB Curves · HSL Mixer · Skin Tone Laboratory · Colour Separation · Photography Master Challenge |
| 04 · Cinematic Grading Suite | Correction vs Grading · Video Signals · The Log Footage Mystery · Video Scopes · Primary Correction · Cinematic Colour Contrast · Shot Matching · Film Emulation · Mood & Narrative · Become the Colourist |
| 05 · Creative Director Studio | Luxury Sneaker Campaign · Cinematic Movie Poster · Fashion Editorial · Brand Identity · Short Film Art Direction |

Game systems: XP and ranks (never subtracted), achievements, per-skill mastery, Beginner / Intermediate / Advanced difficulty (tolerances, live meters, subtler targets), optional hints, a seeded daily five-minute challenge with streaks, an unscored Sandbox (your own photos and videos too) whose tools unlock through lessons, a private Gallery (IndexedDB), and progress saved to `localStorage` with export/import. Free Exploration (Profile) unlocks every mission and tool.

## How the images work

All photographs and footage are generated live by the Lab’s own WebGL2 renderer (`src/engine/glsl/scenes.ts`) in **scene-linear light**: a dusk coast, studio portraits in six complexions and four lighting set-ups, a modernist facade, a rain-soaked night street, a still life with an 18% grey card and a 24-patch reference chart, a product sneaker and a test pattern. Scenes animate over time, so they double as video clips (scrub, play, step frames). Because the scenes are generated, every lesson knows the ground truth — where the grey card is, which pixels are skin, what colour the light was — and can score you honestly. No third-party media is bundled; typefaces are Fontsource packages under the SIL Open Font License.

## Processing order

Documented in `src/engine/glsl/grade.ts` and in the in-app **Lab notes**:

1. Decode → scene-linear Rec.709/D65 (uploaded JPEGs/videos via the sRGB curve — an approximation)
2. White balance — Bradford chromatic adaptation from the assumed illuminant (temperature + tint on the Planckian locus)
3. Exposure — ×2^EV in linear light
4. Halation and vignette — linear light
5. Contrast around 18% grey, highlights/shadows — log2 (stops)
6. Display transform — per-channel highlight shoulder, then sRGB encode
7. Whites/blacks → pure power-law gamma → lift/gamma/gain → RGB curves (display-referred)
8. HSL mixer, saturation, vibrance, density — in Oklab
9. Fade, grain, clamp

Scopes (histogram, waveform, RGB parade, vectorscope with skin-tone line) are computed from the actual rendered pixels.

## Measurements

- Colour difference: CIEDE2000, verified against Sharma’s published test data (`src/lib/__tests__/color.test.ts`)
- Text contrast: WCAG 2.x relative luminance and contrast ratio
- White balance: residual chroma C*ab of known neutrals
- Exposure: clipping fractions and luminance percentiles
- Skin: Rec.709 vectorscope angle versus the ~123° skin-tone line, and ΔE versus the person’s true complexion under clean light
- Typography: glyph metrics measured from the real fonts on a canvas (x-height, cap height, stroke contrast), kerning compared with the type designer’s kerning table
- Creative briefs: transparent rubrics combining measurements (contrast over the photo, overlap with the subject mask, alignment, margins, hierarchy ratios) with clearly labelled rules of thumb

## Honest limitations

- Browsers mostly assume an sRGB display; wide-gamut/HDR or uncalibrated screens show colours differently.
- The Log lesson uses the published Sony S-Log3, ARRI LogC3 and Panasonic V-Log transfer curves, but not their camera gamuts.
- Film emulation (density, halation, grain) is a set of perceptual approximations, not a spectral film model.
- Highlights/shadows are global tone curves, not local tone mapping.
- Mood and personality scores are convention-based models (labelled as such in the app); taste is not perfectly measurable.
- Exported gallery images render text with canvas fonts; tiny typographic differences from the on-screen layout are possible.

## Project layout

```
src/lib/          colour science, fonts, glyph metrics, router, gallery store
src/engine/       WebGL2 engine, GLSL scenes and grading pass, analysis, scopes
src/components/   UI kit, lesson shell and score card, grading controls, colour picker
src/worlds/       w1–w5 lessons, shared Workbench / Composer / rubrics
src/screens/      home, worlds, level router, sandbox, gallery, daily, profile, notes
```
