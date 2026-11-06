// Decides how much this device should download and draw, before any heavy code loads.
//
// Browsers reveal little, so several signals are combined and the most cautious wins:
//  - deviceMemory: Android Chrome only, rounded and capped at 8GB. iPhones report nothing.
//  - hardwareConcurrency, the GPU name (iPhones just say "Apple GPU"), and screen size.
//  - Save-Data and network speed, where the browser exposes them.
//  - A short GPU and CPU speed test. It is the only signal that works on every phone.
// Thresholds are starting estimates. The Quality controller corrects them at runtime.

export const TIERS = ['lite', 'medium', 'high', 'full'];

export const PRESETS = {
  lite: {
    ground: 44, grass: 600, blossom: 160, peony: 60, tulip: 50, lavender: 0, trees: 14, patches: 36,
    clouds: 3, balloons: 1, petals: 24, shadows: false, shadowMap: 512, post: false, dprCap: 1.35,
    lambert: true, canopyCell: 0.2, sdf: 1.6, smallBall: 0.13, pointLight: false, frameMs: 30,
    smallArt: true, lowMusic: true, setWindow: 1,
  },
  medium: {
    ground: 56, grass: 1500, blossom: 420, peony: 150, tulip: 130, lavender: 0, trees: 26, patches: 60,
    clouds: 6, balloons: 2, petals: 50, shadows: true, shadowMap: 1024, post: false, dprCap: 1.6,
    lambert: true, canopyCell: 0.17, sdf: 1.25, smallBall: 0.09, pointLight: false, frameMs: 0,
    smallArt: true, lowMusic: true, setWindow: 9,
  },
  high: {
    ground: 64, grass: 2800, blossom: 800, peony: 300, tulip: 260, lavender: 260, trees: 40, patches: 90,
    clouds: 9, balloons: 4, petals: 90, shadows: true, shadowMap: 1024, post: false, dprCap: 2,
    lambert: false, canopyCell: 0.15, sdf: 1, smallBall: 0.075, pointLight: false, frameMs: 0,
    smallArt: false, lowMusic: false, setWindow: 9,
  },
  full: {
    ground: 96, grass: 4400, blossom: 1300, peony: 460, tulip: 400, lavender: 420, trees: 60, patches: 130,
    clouds: 14, balloons: 4, petals: 300, shadows: true, shadowMap: 2048, post: true, dprCap: 2,
    lambert: false, canopyCell: 0.12, sdf: 1, smallBall: 0.075, pointLight: true, frameMs: 0,
    smallArt: false, lowMusic: false, setWindow: 9,
  },
};

const CACHE = 'invite-device-1';

function benchGpu() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, `#version 300 es
    void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2. - 1., 0., 1.); }`));
  // Roughly what a lit, shaded pixel costs.
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float; out vec4 o;
    void main(){
      vec2 p = gl_FragCoord.xy * .01; float a = 0.;
      for (int i = 0; i < 14; i++) { a += sin(p.x + float(i)) * cos(p.y * 1.3 + a); p = p.yx * 1.01 + a * .1; }
      o = vec4(a, p, 1.);
    }`));
  gl.linkProgram(prog);
  const name = (() => {
    const e = gl.getExtension('WEBGL_debug_renderer_info');
    return e ? String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)) : '';
  })();
  const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  let ms = null;
  if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const size = 1024;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, size, size);
    gl.useProgram(prog);
    const px = new Uint8Array(4);
    const pass = (n) => {
      const t = performance.now();
      for (let i = 0; i < n; i++) gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);   // forces the GPU to finish
      return (performance.now() - t) / n;
    };
    pass(1);
    const first = pass(1);
    // Slow devices get fewer passes, so the test itself never drags.
    const n = first > 25 ? 1 : 6;
    ms = Math.min(first, pass(n), pass(n));
  }
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return { ms, name, maxTexture };
}

function benchCpu() {
  let best = Infinity, x = 1.1;
  for (let r = 0; r < 3; r++) {
    const t = performance.now();
    for (let i = 0; i < 1500000; i++) x = Math.sqrt(x * 1.0001 + i) % 97.3;
    best = Math.min(best, performance.now() - t);
    if (best > 90) break;   // already slow: do not spend longer finding out
  }
  return x < 0 ? 0 : best;
}

const lowest = (a, b) => (TIERS.indexOf(a) < TIERS.indexOf(b) ? a : b);

function gpuCap(name) {
  const n = name.toLowerCase();
  const adreno = n.match(/adreno[^\d]*(\d{3})/);
  if (adreno) {
    const v = Number(adreno[1]);
    return v < 530 ? 'lite' : v < 640 ? 'medium' : 'high';
  }
  if (/mali-(t|4|g3|g5[12]|g7[12])/.test(n) || /powervr|sgx|videocore/.test(n)) return 'lite';
  if (/mali/.test(n)) return 'medium';
  return 'full';
}

export function detectDevice(params = new URLSearchParams(location.search)) {
  const ua = navigator.userAgent;
  const mobile = /Mobi|Android|iPhone|iPad/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)) || innerWidth < 760;
  const conn = navigator.connection;
  const signals = {
    mobile,
    memoryGB: navigator.deviceMemory ?? null,
    cores: navigator.hardwareConcurrency ?? null,
    saveData: !!conn?.saveData,
    network: conn?.effectiveType ?? null,
    screen: `${screen.width}x${screen.height}@${devicePixelRatio}`,
  };

  let bench = null;
  try { bench = JSON.parse(sessionStorage.getItem(CACHE)); } catch { /* storage may be blocked */ }
  if (!bench) {
    const gpu = benchGpu();
    if (!gpu) return { tier: 'plain', preset: null, signals, reasons: ['WebGL2 unavailable'] };
    bench = { gpuMs: gpu.ms == null ? null : +gpu.ms.toFixed(2), gpu: gpu.name, maxTexture: gpu.maxTexture, cpuMs: +benchCpu().toFixed(1) };
    try { sessionStorage.setItem(CACHE, JSON.stringify(bench)); } catch { /* fine without it */ }
  }
  Object.assign(signals, bench);

  let tier = mobile ? 'high' : 'full';
  const reasons = [];
  const cap = (to, why) => { if (lowest(to, tier) !== tier) { tier = to; reasons.push(why); } };

  const m = signals.memoryGB;
  if (m != null) {
    if (m <= 2) cap('lite', `${m}GB RAM`);
    else if (m <= 4) cap('medium', `${m}GB RAM`);
  }
  const c = signals.cores;
  if (c != null) {
    if (c <= 2) cap('lite', `${c} cores`);
    else if (c <= 4 && mobile) cap('medium', `${c} cores`);
  }
  if (bench.gpu) cap(gpuCap(bench.gpu), `GPU ${bench.gpu}`);
  if (bench.gpuMs != null) {
    if (bench.gpuMs > 9) cap('lite', `GPU test ${bench.gpuMs}ms`);
    else if (bench.gpuMs > 3.5) cap('medium', `GPU test ${bench.gpuMs}ms`);
  }
  // A recent laptop scores about 29ms here.
  if (bench.cpuMs > 170) cap('lite', `CPU test ${bench.cpuMs}ms`);
  else if (bench.cpuMs > 80) cap('medium', `CPU test ${bench.cpuMs}ms`);
  if (bench.maxTexture && bench.maxTexture < 4096) cap('lite', 'small texture limit');
  if (signals.saveData) cap('lite', 'data saver on');
  if (/^(slow-2g|2g)$/.test(signals.network ?? '')) cap('lite', `${signals.network} network`);
  else if (signals.network === '3g') cap('medium', '3g network');
  // Small iPhones are older models unless the speed test says otherwise.
  if (/iPhone/.test(ua) && Math.max(screen.width, screen.height) <= 667) cap('medium', 'small iPhone');

  const forced = params.get('tier');
  if (forced === 'plain') return { tier: 'plain', preset: null, signals, reasons: ['forced by URL'] };
  if (PRESETS[forced]) { tier = forced; reasons.push('forced by URL'); }
  else if (params.has('low')) { tier = 'medium'; reasons.push('forced by URL'); }
  return { tier, preset: PRESETS[tier], signals, reasons };
}
