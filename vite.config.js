import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages sub-paths or any static host.
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
});
