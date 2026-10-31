import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Relative base so the built app can be opened from any static host or sub-path.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
