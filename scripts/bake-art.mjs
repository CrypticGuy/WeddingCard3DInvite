// Regenerates public/v1/art/*.webp from src/art/watercolor.js.
// Needs the dev server on :5173 and a browser with Playwright:
//   npm run dev, then node scripts/bake-art.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/scripts/bake-art.html`);
await page.waitForFunction(() => window.ready);
const files = await page.evaluate(() => window.bake());
const dir = resolve('public/v1/art');
mkdirSync(dir, { recursive: true });
for (const [name, url] of Object.entries(files)) {
  writeFileSync(resolve(dir, name), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', name);
}
await browser.close();
