#!/usr/bin/env bash
# Builds an installable, signed APK of THE SKETCH LAB — no Gradle or Android Studio needed.
#
# Needs Node.js (web build), a JDK (javac, keytool) and these Ubuntu/Debian packages:
#   sudo apt-get install aapt apksigner zipalign android-sdk-platform-23 dalvik-exchange
#
# Usage:  ./build-apk.sh            (VERSION_CODE=2 ./build-apk.sh for an update)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$(cd "$HERE/.." && pwd)"
OUT="$HERE/build"
ANDROID_JAR="${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}"
VERSION_NAME="$(node -p "require('$APP/package.json').version")"
VERSION_CODE="${VERSION_CODE:-1}"
KEYSTORE="${KEYSTORE:-$HERE/sketchlab-sideload.keystore}"
KS_PASS="${KS_PASS:-android}"
APK_NAME="SketchLab-MathPlayground-$VERSION_NAME.apk"

for tool in aapt apksigner zipalign dalvik-exchange javac keytool node; do
  command -v "$tool" >/dev/null || { echo "Missing tool: $tool (see the header of this script)"; exit 1; }
done
[ -f "$ANDROID_JAR" ] || { echo "Missing $ANDROID_JAR — install android-sdk-platform-23"; exit 1; }

if [ "${SKIP_WEB:-0}" != "1" ]; then
  echo "▶ Building the web game"
  (cd "$APP" && npm run build)
fi

echo "▶ Packaging resources and the game files"
rm -rf "$OUT"
mkdir -p "$OUT/assets/www" "$OUT/gen" "$OUT/classes"
cp -R "$APP/dist/." "$OUT/assets/www/"
aapt package -f -m \
  -J "$OUT/gen" -M "$HERE/AndroidManifest.xml" -S "$HERE/res" -A "$OUT/assets" -I "$ANDROID_JAR" \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -F "$OUT/unsigned.apk"

echo "▶ Compiling the Android activity"
javac --release 8 -Xlint:-options -encoding UTF-8 -classpath "$ANDROID_JAR" -d "$OUT/classes" \
  $(find "$OUT/gen" "$HERE/src" -name '*.java')
dalvik-exchange --dex --output="$OUT/classes.dex" "$OUT/classes"
(cd "$OUT" && aapt add unsigned.apk classes.dex >/dev/null)

echo "▶ Aligning and signing"
zipalign -p -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -storetype PKCS12 -alias sketchlab -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=Sketch Lab (sideload), O=Sketch Lab"
fi
apksigner sign --ks "$KEYSTORE" --ks-key-alias sketchlab --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --out "$OUT/$APK_NAME" "$OUT/aligned.apk"
apksigner verify --verbose "$OUT/$APK_NAME" | grep -E "Verifies|v2 scheme|v3 scheme"

echo "✔ $OUT/$APK_NAME ($(du -h "$OUT/$APK_NAME" | cut -f1))"
