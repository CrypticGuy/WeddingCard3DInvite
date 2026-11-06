import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Every folder like v1/ or v2/ with an index.html becomes a page automatically,
// so adding a version needs no change here.
const versions = readdirSync('.').filter((d) => /^v\d+$/.test(d) && existsSync(`${d}/index.html`));

export default defineConfig({
  // Relative base so the build works on GitHub Pages sub-paths or any static host.
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        main: resolve('index.html'),
        ...Object.fromEntries(versions.map((v) => [v, resolve(v, 'index.html')])),
      },
    },
  },
});
