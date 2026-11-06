// Renders the V1 Beagle's gait frames to PNG. Then scripts/v2-art/paint-dog.py paints them.
//   npx vite --port 5199, then node scripts/v2-art/bake-dog.mjs <outdir>
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const out = resolve(process.argv[2] ?? '.shots/dog/raw');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
page.on('pageerror', (e) => console.error(e.message));
await page.goto('http://localhost:5199/scripts/v2-art/bake-dog.html');
await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
const strips = { walk: 18, back: 18, settle: 6, idle: 16 };
for (const [name, n] of Object.entries(strips)) {
  for (let k = 0; k < n; k++) {
    const url = await page.evaluate(([a, b, c]) => window.shot(a, b, c), [name, k, n]);
    writeFileSync(resolve(out, `${name}-${String(k).padStart(2, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
}
await browser.close();
console.log('done', out);
