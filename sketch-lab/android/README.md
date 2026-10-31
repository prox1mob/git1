# Android app (APK)

`release/SketchLab-MathPlayground-0.8.0.apk` is a ready-to-install Android build of THE SKETCH LAB.

## Install on a tablet or phone
1. Copy the APK to the device (or download it from GitHub on the device).
2. Open it. Android asks to allow installing from this source (your browser or file manager) — allow it once.
3. Tap **Install**, then open **Sketch Lab Maths**.

Requires Android 7.0 or newer with an up-to-date **Android System WebView** (updated through the Play Store).
Everything runs offline; progress is saved on the device.

## How it works
A tiny native activity (`src/…/MainActivity.java`) shows the game full-screen in a WebView. The built web game is
bundled in `assets/www` and served from a private `https://appassets.androidplatform.net/` address, so ES modules,
3D (WebGL), touch, stylus pressure and saved progress all work as they do in a browser. The Back button goes back
through the lessons; links to other websites open in the browser.

## Rebuild
```bash
sudo apt-get install aapt apksigner zipalign android-sdk-platform-23 dalvik-exchange   # once
./build-apk.sh                       # builds the web game, then build/SketchLab-MathPlayground-<version>.apk
VERSION_CODE=2 ./build-apk.sh        # for an update that installs over the previous one
```
No Gradle or Android Studio is needed.

## Signing key
`sketchlab-sideload.keystore` (password `android`) signs the APK so that later builds install as updates without
losing progress. It is a convenience key for sideloading only — anyone with this repository can sign with it.
For the Play Store, create your own private key and pass it with `KEYSTORE=… KS_PASS=… ./build-apk.sh`.
