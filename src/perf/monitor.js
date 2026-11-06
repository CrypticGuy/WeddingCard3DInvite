// Performance monitor, loaded only with ?perf. It works on a real phone.
// Browsers do not reveal true RAM or GPU use to a web page, so each figure here is
// labelled for what it really is. iPhones report neither JS memory nor GPU timing.
const MB = 1048576;

function geometryBytes(geo, seen) {
  if (seen.has(geo)) return 0;
  seen.add(geo);
  let b = geo.index?.array.byteLength ?? 0;
  for (const a of Object.values(geo.attributes)) b += a.array?.byteLength ?? 0;
  return b;
}

// Adds up what the app has uploaded to the GPU. An estimate: drivers add overhead.
export function estimateGpuBytes(world) {
  const seen = new Set(), textures = new Set();
  let geometry = 0, texture = 0;
  world.scene.traverse((o) => {
    if (o.geometry) geometry += geometryBytes(o.geometry, seen);
    if (o.isInstancedMesh) geometry += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) if (m.map) textures.add(m.map);
  });
  for (const t of textures) {
    const i = t.image;
    if (i?.width) texture += i.width * i.height * 4 * 1.33;
  }
  const px = world.w * world.dpr * world.h * world.dpr;
  const shadow = world.sun.shadow.mapSize.x * world.sun.shadow.mapSize.y * 4;
  // Colour and depth, doubled for anti-aliasing buffers; half-float chain on desktop.
  const buffers = world.composer ? px * (8 * 4 + 8 * 2 + 4 * 4) : px * (4 + 4) * 3;
  return { geometry, texture, buffers: buffers + shadow, total: geometry + texture + buffers + shadow };
}

class GpuTimer {
  constructor(gl) {
    this.gl = gl;
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.pending = [];
    this.ms = null;
  }
  begin() {
    if (!this.ext || this.pending.length > 3) return;
    this.q = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.q);
  }
  end() {
    if (!this.ext) return;
    const { gl, ext } = this;
    if (this.q) {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      this.pending.push(this.q);
      this.q = null;
    }
    const head = this.pending[0];
    if (head && gl.getQueryParameter(head, gl.QUERY_RESULT_AVAILABLE)) {
      this.pending.shift();
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        const v = gl.getQueryParameter(head, gl.QUERY_RESULT) / 1e6;
        this.ms = this.ms == null ? v : this.ms + (v - this.ms) * 0.1;
      }
      gl.deleteQuery(head);
    }
  }
}

function gpuName(gl) {
  const e = gl.getExtension('WEBGL_debug_renderer_info');
  return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
}

export function startMonitor(world) {
  const r = world.renderer, gl = r.getContext();
  const timer = new GpuTimer(gl);
  const frames = [];
  const samples = [];
  const started = performance.now();
  let last = started;
  // Timed around the real draw, so skipped refreshes on 120Hz screens do not count.
  world.probe = {
    begin() {
      const now = performance.now();
      frames.push(now - last);
      last = now;
      r.info.reset();
      timer.begin();
    },
    end() { timer.end(); },
  };
  r.info.autoReset = false;

  const device = {
    gpu: gpuName(gl),
    userAgent: navigator.userAgent,
    screen: `${screen.width}x${screen.height} @${devicePixelRatio}`,
    cores: navigator.hardwareConcurrency ?? null,
    deviceMemoryGB: navigator.deviceMemory ?? null,
    tier: world.device.tier,
    tierReasons: world.device.reasons,
    signals: world.device.signals,
  };

  function sample() {
    const d = frames.splice(0).sort((a, b) => a - b);
    const q = (p) => (d.length ? +d[Math.min(d.length - 1, Math.floor(d.length * p))].toFixed(1) : null);
    const sum = d.reduce((a, b) => a + b, 0);
    const est = estimateGpuBytes(world);
    const s = {
      t: Math.round((performance.now() - started) / 1000),
      chapter: +world.s.toFixed(2),
      fps: sum ? +(d.length / (sum / 1000)).toFixed(1) : 0,
      frameP50: q(0.5), frameP95: q(0.95), frameMax: q(0.999),
      longFrames: d.filter((x) => x > 50).length,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / MB).toFixed(1) : null,
      gpuMs: timer.ms == null ? null : +timer.ms.toFixed(2),
      gpuEstMB: +(est.total / MB).toFixed(1),
      triangles: r.info.render.triangles,
      calls: r.info.render.calls,
      geometries: r.info.memory.geometries,
      textures: r.info.memory.textures,
      programs: r.info.programs?.length ?? 0,
      dpr: +world.dpr.toFixed(2),
      level: world.quality.level,
    };
    samples.push(s);
    if (samples.length > 3600) samples.shift();
    return s;
  }

  const report = () => ({
    device, duration: Math.round((performance.now() - started) / 1000),
    qualityChanges: world.quality.history, samples,
  });

  // One reader only: sample() drains the frame buffer, so tools read the latest row.
  window.__perf = { latest: () => samples[samples.length - 1], report, device };

  // Panel
  const box = document.createElement('aside');
  box.setAttribute('aria-label', 'Performance monitor');
  box.style.cssText = 'position:fixed;z-index:99;left:8px;bottom:8px;padding:8px 10px;border-radius:10px;background:rgba(30,20,40,.82);color:#fff;font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;max-width:calc(100vw - 16px);touch-action:manipulation';
  const text = document.createElement('pre');
  text.style.cssText = 'margin:0 0 6px;white-space:pre-wrap;font:inherit';
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy report';
  copy.style.cssText = 'font:inherit;color:#2a1c35;background:#fff;border:0;border-radius:6px;padding:4px 10px;cursor:pointer';
  copy.addEventListener('click', async () => {
    const json = JSON.stringify(report());
    try { await navigator.clipboard.writeText(json); copy.textContent = 'Copied'; } catch {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'invite-perf.json' });
      a.click();
      copy.textContent = 'Saved as a file';
    }
    setTimeout(() => { copy.textContent = 'Copy report'; }, 1500);
  });
  box.append(text, copy);
  document.body.append(box);

  const na = 'not exposed';
  setInterval(() => {
    const s = sample();
    text.textContent = [
      `tier ${device.tier}   ${device.tierReasons.join(', ') || 'no limits'}`,
      `${s.fps} fps   frame ${s.frameP50}ms   worst ${s.frameMax}ms`,
      `long frames ${s.longFrames}/s   quality ${s.level}   res x${s.dpr}`,
      `GPU work ${s.gpuMs == null ? na : `${s.gpuMs}ms`}`,
      `GPU memory est ${s.gpuEstMB}MB`,
      `JS memory ${s.heapMB == null ? na : `${s.heapMB}MB`}`,
      `${(s.triangles / 1000).toFixed(0)}k triangles   ${s.calls} draws`,
    ].join('\n');
  }, 1000);
}
