import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built game works from any folder (GitHub Pages, a USB stick, a tablet).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
