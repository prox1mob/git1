import type { CapacitorConfig } from '@capacitor/cli';

// Wraps the built web app (dist/) in a native Android shell. The app is fully offline:
// fonts, scenes and the grading engine are all bundled, and progress lives in WebView storage.
const config: CapacitorConfig = {
  appId: 'app.visuallab.game',
  appName: 'The Visual Lab',
  webDir: 'dist',
  backgroundColor: '#111111',
  android: {
    backgroundColor: '#111111',
  },
  plugins: {
    SystemBars: {
      // index.html uses viewport-fit=cover, so the WebView is edge-to-edge and the
      // app pads itself with env(safe-area-inset-*).
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
