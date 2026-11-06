// Renders the score offline and prints levels, so a change can be sanity-checked
// without listening: it catches silence, clipping and scheduling errors.
// Needs the dev server on :5173 and Playwright:  node scripts/check-music.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5173/scripts/bake-art.html');

const report = await page.evaluate(async () => {
  const { Music } = await import('/src/audio.js');
  const seconds = 54, rate = 44100;
  const ctx = new OfflineAudioContext(2, seconds * rate, rate);
  const m = new Music();
  m.connect(ctx);
  m.bus.gain.value = 0.85;
  m.scheduleLoop(0.1);
  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0);
  const rows = [];
  for (let s = 0; s < seconds; s += 6) {
    let peak = 0, sum = 0;
    const a = s * rate, b = Math.min(d.length, (s + 6) * rate);
    for (let i = a; i < b; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; }
    const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf');
    rows.push(`${String(s).padStart(2)}s  peak ${db(peak)} dB  rms ${db(Math.sqrt(sum / (b - a)))} dB`);
  }
  return rows;
});
console.log(report.join('\n'));
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
