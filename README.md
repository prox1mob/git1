# THE 3D LAB — From Imagination to Reality

An interactive, touch-first game for learning 3D modelling, CAD, engineering, physics and product invention. Every lesson follows **Observe → Touch → Experiment → Understand → Build → Test → Improve**: you manipulate real 3D objects first, and the maths and engineering come after.

Built with React 19, TypeScript, Three.js, React Three Fiber, drei, Rapier (rigid-body physics) and three-bvh-csg (mesh Booleans). It runs entirely in the browser — no paid APIs, no account, works offline once loaded.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (also exposed on your LAN for a tablet)
npm run build        # static site in dist/ (relative paths: host it anywhere)
npm run preview      # serve the production build
npm test             # unit tests (constraint solver, gears, mesh analysis, enclosure CSG)
```

**On an Android tablet:** run `npm run dev`, open the printed *Network* URL in Chrome on the tablet (same Wi-Fi), then use *Add to Home screen* for a full-screen app. Touch: one finger orbits / drags, two fingers pinch-zoom / pan, and in object-gesture mode pinch scales and twist rotates. A stylus works as a precise pointer (pressure is not used).

## Android app (APK)

The repository includes an Android project (`android/`, made with [Capacitor](https://capacitorjs.com)) that packages the whole game into an installable app. It runs fully offline, keeps progress on the device, follows the Android back button, saves exports to *Documents/The3DLab* and opens the share sheet (send an STL to a slicer, Drive, e-mail…), and the portfolio's *Print* button opens Android's print / *Save as PDF* dialog.

**Get the APK:** every push to this branch (or *Actions → Android APK → Run workflow*) builds it with GitHub Actions and publishes it under **Releases** (`the-3d-lab-v1.0.N.apk`). On the tablet, open the release page, download the APK, tap it and allow installing from that source. Newer builds install over older ones and keep your progress. Requires Android 7.0 or newer with an up-to-date *Android System WebView* (WebGL 2).

**Build it yourself** (needs Android Studio or the Android SDK with platform 36, and JDK 21): `npm run android:apk` → `android/app/build/outputs/apk/release/app-release.apk`. `npm run android:sync` copies a fresh web build into the Android project; `npm run android:assets` re-renders the launcher icons and splash screens from the logo.

**Signing:** builds are signed with `android/app/the3dlab-sideload.jks` (password `the3dlab-sideload`) so that updates install over each other. That key is public and only suitable for sideloading. Before publishing to an app store, create your own key and add it as repository secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`; the workflow then uses it instead (an app signed with a different key must be uninstalled once before installing).

## macOS app (DMG)

The repository also includes a desktop wrapper (`electron/`, made with [Electron](https://www.electronjs.org)) for Mac. It runs fully offline from a single window, keeps progress on the device, exports STL/GLB/glTF/JSON through a native *Save As* dialog, and the portfolio's *Print* button opens macOS's print / *Save as PDF* dialog. The web build is served through a custom `app://` scheme rather than `file://`, which is what lets the per-level code-splitting (dynamic `import()`) work inside the packaged app.

**Get the DMG:** every push to this branch (or *Actions → macOS DMG → Run workflow*) builds it with GitHub Actions and publishes two files under **Releases**: `The-3D-Lab-1.0.N-arm64.dmg` (Apple Silicon) and `The-3D-Lab-1.0.N-x64.dmg` (Intel) — pick the one matching your Mac (Apple menu → *About This Mac*). Open the DMG and drag **The 3D Lab** into *Applications*.

**Gatekeeper:** the app is unsigned (no Apple Developer certificate), so the first launch will say it "can't be opened because Apple cannot check it for malicious software." Right-click (or Control-click) the app in *Applications* and choose **Open**, then confirm — needed once, after that it opens normally. (Apple Developer Program membership costs money and isn't a reasonable thing to assume on your behalf — see *Signing* below.)

**Build it yourself** (needs a Mac, or any OS for `--dir` testing; DMG creation itself needs macOS's own `hdiutil`): `npm run mac:dmg` → `release/The-3D-Lab-*.dmg`. `npm run mac:assets` re-renders the app icon and DMG background from the logo; `npm run electron:dev` runs the built app directly without packaging it, for quick testing.

**Signing:** builds are unsigned (`identity: null` in `package.json`'s `build.mac`), which is why Gatekeeper warns on first open. To remove that warning, get an Apple Developer ID certificate, export it as a `.p12`, and add it as repository secrets `MAC_CSC_LINK` (base64 of the `.p12`) and `MAC_CSC_KEY_PASSWORD`, then point `electron-builder`'s `CSC_LINK`/`CSC_KEY_PASSWORD` env vars at them in the workflow (and, for distribution outside your own Macs, notarize with `@electron/notarize` using an app-specific Apple ID password).

`node scripts/smoke.mjs http://localhost:4173/ /level/w1-l1 …` opens routes in headless Chromium and fails on console errors (used to check all 78 routes).

## What is built

All **60 levels in the 9 worlds are playable**, plus the tools below. Every visible control works; anything not built is listed under *Not included* and never appears as a button.

| World | Levels | Highlights |
|---|---|---|
| 01 Spatial Thinking | 6 / 6 | Touch-drag a cube along X/Y/Z to targets; shape playground; orthographic views with a "glass box" and exact visible-edge drawings; mental rotation with mirror distractors; build-from-primitives matching; 3D packing puzzle |
| 02 Visual Mathematics | 9 / 9 | Units & scale with drag handles; coordinates; degrees/radians; live area/volume formulas and a can-optimisation task; ratios; trigonometry with Pythagoras squares; Bézier splines → lathe; local/world transforms with the 4×4 matrix; dimensioned-drawing challenge |
| 03 CAD Workshop | 10 / 10 | Sketch planes; a **real 2D constraint solver** (Levenberg–Marquardt, Jacobian-rank DOF, conflict/redundancy detection, drag-solving); driving dimensions; extrude; revolve; fillets/chamfers; Boolean union/subtract/intersect; circular & linear patterns with mirror; parametric feature tree with rollback and failure states; electronics-enclosure master challenge with STL export |
| 04 Materials | 3 / 3 | PBR material lab (18 presets in 8 families) with engineering-property cards; beam stiffness/strength, weight and heat demos; material selection rubric |
| 05 Mechanisms | 8 / 8 | Hinge limits; slider travel; **involute spur gears** with correct meshing phase and idlers; levers; Hooke's-law spring simulation; four-bar linkage with Grashof analysis and coupler curves; assembly mates with DOF counting; folding phone-stand kinematics + stability |
| 06 Product Design | 8 / 8 | Form variants; grip sizing for 5th–95th percentile hands; product architecture; enclosure packaging; design for assembly; exploded views; aesthetic refinement; desk-accessory challenge |
| 07 Manufacturing | 6 / 6 | Process comparison; print orientation with real overhang detection and a slice-based time model; tolerance fits (worst case); DFM inspection; a real slicer (plane intersection + infill); pre-print checklist and STL export |
| 08 Rendering | 3 / 3 | Virtual studio: full-frame focal length, three-point lighting, shadow softness, backgrounds, thirds guides, framing measured from the camera projection, photo capture to portfolio |
| 09 Inventor's Garage | 7 / 7 | Mission engine (brief → research → concept → model → evaluate → present) for a cable organiser, phone stand, mouse, modular storage, compact camera, footwear concept and your own invention |

**Tools:** free-build 3D editor (primitives, move/rotate/scale gizmos, touch gestures, grid snapping, undo/redo, duplicate, group/ungroup, hierarchy, numeric dimensions in mm/cm/m/in, materials, lighting, non-destructive Booleans, IndexedDB save with versions, GLB / glTF / binary STL export) · Sketch-to-3D studio (polygon/freehand/rect/circle profiles, holes, validation, live extrude/revolve, edit-and-update) · Visual Physics Lab (gravity, centre of mass, friction, torque, stacking — Rapier) · daily challenge · gallery with before/after slider · printable portfolio · XP, ranks, 22 badges, skill radar, unlockable tools, Beginner/Intermediate/Advanced tolerances, optional hints, optional Tamil explanations.

Every challenge returns: what is correct, what is wrong (with measured values), why it matters, a visual correction where it makes sense, and one specific suggestion. Creative challenges show a transparent rubric and never claim one aesthetic answer is objectively correct. Retries are unlimited; XP is only awarded for improving your best score.

## Honest limits / not included

- **STEP export** — needs a boundary-representation CAD kernel (e.g. OpenCascade). The editor exports meshes (STL, glTF/GLB) only.
- **CAD kernel** — booleans, fillets and patterns operate on triangle meshes (three-bvh-csg) or on 2D profiles before extrusion. Edge-by-edge fillets, shells on arbitrary solids and exact B-rep topology are not available.
- **Physics and engineering numbers** are simplified teaching models (rigid bodies, single friction coefficient, ideal beam theory, rounded material data) and are labelled as such. They are not engineering validation.
- **Manufacturing checks** are geometric only; real suitability depends on the machine, material and process.
- **Freeform sketch reconstruction** from perspective drawings is not attempted (it is ambiguous); only closed profiles are extruded or revolved.
- **Storage** is local to the device (localStorage + IndexedDB). No accounts or cloud sync. The web version has no service-worker offline cache yet (the Android and macOS apps do not need one). Uninstalling the Android or macOS app deletes its progress, so export models you want to keep.
- **Stylus pressure** and palm rejection are not used.
- **The macOS app is unsigned and not notarized** — no Apple Developer certificate is set up for this project. Gatekeeper needs one right-click → Open per Mac on first launch (see the macOS app section above); the README explains how to add your own certificate to remove that.
- Performance guidance: the editor is designed for ~150 objects / 500k triangles on mid-range tablets; the status bar warns above that.

## Project layout

```
src/
  App.tsx, main.tsx, styles.css     app shell, hash router, top bar
  components/                       Stage3D viewport, LevelShell + feedback, editor, sketchers, mission engine, UI kit
  lib/                              shapes & CSG, materials, constraint solver (cad/), gears, mesh analysis, export, storage
  store/                            progress (XP, badges, unlocks, settings) and editor (undo/redo, grouping, booleans)
  screens/                          home, worlds, editor, sketch studio, physics lab, gallery, portfolio, profile, status
  worlds/                           meta.ts (all worlds/levels), components.ts (playable registry), w1…w9 level code
android/                            Capacitor Android project (native print plugin, icons, signing)
electron/                           macOS/desktop app (main process, preload bridge, app:// static server)
build-resources/                    macOS app icon (.icns) and DMG window background
scripts/smoke.mjs                   headless route checker
scripts/android-assets.mjs          renders Android launcher icons and splash screens
scripts/mac-assets.mjs              renders the macOS app icon and DMG background
.github/workflows/android-apk.yml   builds the APK and publishes it as a GitHub release
.github/workflows/macos-dmg.yml     builds the DMGs and publishes them as a GitHub release
```

Add a level by creating a component in `src/worlds/wN/` that renders `<LevelShell>` and registering it in `src/worlds/components.ts`; anything not registered is shown as *Planned*.
