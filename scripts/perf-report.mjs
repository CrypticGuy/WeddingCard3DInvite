// Runs the invite through emulated phones and writes perf-report/index.html.
//   npm run perf                    all profiles, 60s each, version v1
//   npm run perf -- --seconds 120 --version v2
import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const seconds = Number(arg('seconds', 60));
const version = arg('version', 'v1');
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari';

// CPU slowdown is an approximation of each device class. GPU speed cannot be emulated.
const profiles = [
  { name: 'Budget Android', w: 360, h: 640, dpr: 2, cpu: 6, ua: PHONE, tier: 'lite' },
  { name: 'iPhone SE class', w: 375, h: 667, dpr: 2, cpu: 4, ua: PHONE, tier: 'medium' },
  { name: 'Mid Android', w: 412, h: 915, dpr: 2.6, cpu: 3, ua: PHONE, tier: 'medium' },
  { name: 'New iPhone class', w: 393, h: 852, dpr: 3, cpu: 1.5, ua: PHONE, tier: 'high' },
];

function rssMB(pids) {
  if (!pids.length) return 0;
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('powershell', ['-NoProfile', '-Command', `(Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum`], { encoding: 'utf8' });
      return Math.round(Number(out.trim()) / 1048576);
    }
    const out = execFileSync('ps', ['-o', 'rss=', '-p', pids.join(',')], { encoding: 'utf8' });
    return Math.round(out.trim().split(/\s+/).reduce((a, b) => a + Number(b), 0) / 1024);
  } catch { return null; }
}

async function runProfile(p, url) {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info'],
  });
  const sys = await browser.newBrowserCDPSession();
  const ctx = await browser.newContext({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: p.dpr, hasTouch: true, userAgent: p.ua });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(e.message));
  await page.goto(`${url}&tier=${p.tier}`);
  await page.waitForFunction(() => window.__perf, null, { timeout: 90000 });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpu });
  await page.evaluate(() => { document.documentElement.style.scrollSnapType = 'none'; });

  const samples = [];
  const count = await page.evaluate(() => document.querySelectorAll('.chapter').length);
  const t0 = Date.now();
  let chapter = 0, hostRam = null, hostGpu = null;
  for (let i = 0; (Date.now() - t0) / 1000 < seconds; i++) {
    if (i % 3 === 0) {
      await page.evaluate((c) => scrollTo({ top: document.querySelectorAll('.chapter')[c].offsetTop, behavior: 'smooth' }), chapter);
      chapter = (chapter + 1) % count;
    }
    if (i % 5 === 0) {
      const { processInfo } = await sys.send('SystemInfo.getProcessInfo');
      hostRam = rssMB(processInfo.filter((x) => x.type === 'renderer').map((x) => x.id));
      hostGpu = rssMB(processInfo.filter((x) => x.type === 'GPU').map((x) => x.id));
    }
    await page.waitForTimeout(1000);
    const s = await page.evaluate(() => window.__perf.latest());
    if (s) samples.push({ ...s, t: Math.round((Date.now() - t0) / 1000), hostRam, hostGpu });
  }
  const report = await page.evaluate(() => window.__perf.report());
  await browser.close();
  return { name: p.name, profile: p, device: report.device, qualityChanges: report.qualityChanges, problems, samples };
}

execSync('npx vite build', { stdio: 'inherit' });
const server = await preview({ preview: { port: 4179, strictPort: true }, logLevel: 'error' });
const url = `http://localhost:4179/${version}/?skip&perf`;
const runs = [];
for (const p of profiles) {
  console.log(`measuring ${p.name} for ${seconds}s`);
  runs.push(await runProfile(p, url));
}
await server.close();

const dir = resolve('perf-report');
mkdirSync(dir, { recursive: true });
const data = { version, seconds, created: new Date().toISOString(), runs };
writeFileSync(resolve(dir, 'data.json'), JSON.stringify(data));
const page = readFileSync(resolve('scripts/perf-report.template.html'), 'utf8').replace('/*DATA*/null', JSON.stringify(data).replace(/</g, '\\u003c'));
writeFileSync(resolve(dir, 'index.html'), page);
console.log(`report: ${resolve(dir, 'index.html')}`);
process.exit(0);
