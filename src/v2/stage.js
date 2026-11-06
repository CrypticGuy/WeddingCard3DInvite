// The painted scenes. Every layer is a plain <img> moved with a GPU transform, so
// scrolling repaints nothing: the compositor just slides finished bitmaps, which is
// the cheapest thing an old phone can do. Layout is computed once per resize and
// shared with snapshot(), so the frozen frame the paint-bleed uses matches exactly.
import { clamp } from '../world/kit.js';
import { SCENES } from './scenes.js';
import { ART } from './tier.js';

// Where a scene rests, as a share of its own scroll length.
export const REST = 0.36;
const FG_AR = 3;
const HILLS_AR = 2;
const SKY_AR = 2;

const el = (tag, cls, parent) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  parent?.append(n);
  return n;
};
const img = (cls, parent, w, h) => {
  const n = el('img', cls, parent);
  n.alt = '';
  n.draggable = false;
  n.decoding = 'async';
  if (w) { n.width = w; n.height = h; }
  return n;
};
const rand = (seed) => {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
};

export class Stage {
  constructor(root, events, { lite, reduced, fewer }) {
    this.root = root;
    this.lite = lite;
    this.fewer = fewer || lite;
    this.reduced = reduced;
    this.events = events;
    this.scenes = events.map((e, i) => this.build(e, i));
    this.active = -1;
    this.warmed = -1;
    this.W = 0;
    this.H = 0;
    this.resize();
  }

  build(e, i) {
    const def = SCENES[e.id];
    const small = `${ART}${e.id}/`;
    const base = this.lite ? `${small}lite/` : small;
    const box = el('div', 'scene', this.root);
    box.dataset.scene = e.id;
    box.style.backgroundColor = def.paper;
    const sky = img('sky', box);
    const clouds = el('div', 'clouds', box);
    const hills = img('hills', box);
    const subject = el('div', 'subject', box);
    const subjectImg = img('main', subject);
    const sprites = [];
    for (const q of def.sprites) {
      // Margins centre each piece; percentages work because every subject is square.
      const pos = `left:${q.x * 100}%;top:${q.y * 100}%;width:${q.w * 100}%;margin-left:${-q.w * 50}%;`;
      if (q.glow) {
        const n = el('i', 'glow', subject);
        n.style.cssText = `${pos}height:${q.w * 100}%;margin-top:${-q.w * 50}%;${q.style ?? ''}`;
        continue;
      }
      const n = img(`sprite ${q.cls}`);
      if (q.back) subject.prepend(n); else subject.append(n);
      n.dataset.src = small + q.src;
      const tall = (q.w / q.ar) * 100;
      n.style.cssText = `${pos}height:${tall}%;${q.cls === 'sway' ? '' : `margin-top:${-tall}%;`}${q.style ?? ''}`;
      n.spec = q;
      sprites.push(n);
    }
    const r = rand(97 + i * 31);
    const cloudImgs = [];
    for (let k = 0; k < (this.lite ? 0 : Math.min(def.clouds, this.fewer ? 2 : 3)); k++) {
      const n = img('cloud', clouds);
      n.dataset.src = `${small}cloud${k % 3}.webp`;
      n.style.cssText = `top:${4 + r() * 26}%;left:${-10 + r() * 70}%;--dur:${70 + r() * 60}s;--delay:${-r() * 60}s`;
      cloudImgs.push(n);
    }
    const fg = el('div', 'fg', box);
    const petals = el('div', 'petals', box);
    const n = this.lite ? 4 : this.fewer ? 5 : 9;
    const petalImgs = [];
    if (!this.reduced) {
      for (let k = 0; k < n; k++) {
        const p = img('petal', petals);
        p.dataset.src = `${ART}petals/${def.petals[k % def.petals.length]}.webp`;
        // Kept large on purpose: tiny specks are what shimmered on small screens.
        p.style.cssText = `left:${(k + r()) * (100 / n)}%;--s:${22 + r() * 16}px;--dur:${12 + r() * 9}s;--delay:${-r() * 20}s;--sway:${30 + r() * 60}px;--spin:${200 + r() * 340}deg`;
        petalImgs.push(p);
      }
    }
    return {
      id: e.id, def, box, sky, clouds, hills, subject, subjectImg, fg, fgTiles: [], base, sprites,
      lazy: [...sprites, ...cloudImgs, ...petalImgs], last: {}, ready: null, loaded: false,
    };
  }

  // Sizes for one scene at this viewport. All in CSS pixels.
  layout(s) {
    const { W, H } = this;
    const portrait = W / H < 0.9;
    const def = s.def;
    // Sky always fills; its pan is small because it is far away.
    const skyH = Math.max(H, (W * 1.16) / SKY_AR);
    const sky = { w: skyH * SKY_AR, h: skyH };
    const hillsH = Math.max(H * (portrait ? 0.66 : 0.8), (W * 1.34) / HILLS_AR);
    const hills = { w: hillsH * HILLS_AR, h: hillsH };
    const size = portrait ? Math.min(W * 1.02, H * 0.5) : Math.min(H * def.subject.size, W * 0.5);
    const subject = { w: size, h: size / def.subject.ar };
    const fgH = Math.round(portrait ? Math.max(H * 0.17, W * 0.34) : Math.max(H * 0.2, W * 0.11));
    const fg = { w: Math.round(fgH * FG_AR), h: fgH };
    return { sky, hills, subject, fg, portrait };
  }

  // Layer positions for scroll share p (0..1). `hold` keeps the subject in frame.
  place(i, p) {
    const s = this.scenes[i], L = this.layout(s), { W, H } = this;
    const last = i === this.scenes.length - 1;
    const q = clamp(p);
    const sky = -(L.sky.w - W) * (0.42 + 0.16 * q);
    const hills = -(L.hills.w - W) * (0.1 + 0.8 * q);
    const restX = L.portrait ? W * 0.5 : W * 0.43;
    const span = L.portrait ? W * 1.75 : W * 1.1;
    // The first painting opens with its subject already in view; the last one stays.
    const from = i === 0 ? Math.min(p, REST) : p;
    let dp = REST - clamp(from, -0.2, 1.2);
    if (i === 0) dp *= 0.5;
    if (last && p > REST) dp = (REST - p) * 0.12;
    const subjectX = restX + dp * span - L.subject.w / 2;
    const subjectY = H - L.subject.h - H * (L.portrait ? 0.1 : 0.095);
    const fg = -((q * 1.15 + 0.1) * W);
    return { sky, hills, subjectX, subjectY, fg, L };
  }

  resize() {
    const W = this.root.clientWidth, H = this.root.clientHeight;
    if (W === this.W && H === this.H) return false;
    this.W = W; this.H = H;
    for (const s of this.scenes) this.fit(s);
    return true;
  }

  fit(s) {
    const L = this.layout(s), { W, H } = this;
    const size = (n, b) => { n.style.width = `${b.w}px`; n.style.height = `${b.h}px`; };
    size(s.sky, L.sky);
    size(s.hills, L.hills);
    size(s.subject, L.subject);
    s.sky.style.top = `${H - L.sky.h}px`;
    s.hills.style.top = `${H - L.hills.h}px`;
    // Enough mirrored copies to cover the widest pan.
    const need = Math.ceil((W * 2.4) / L.fg.w) + 1;
    while (s.fgTiles.length < need) {
      const t = img(s.fgTiles.length % 2 ? 'flip' : '', s.fg);
      if (s.loaded) t.src = `${s.base}fg.webp`;
      s.fgTiles.push(t);
    }
    s.fgTiles.forEach((t, k) => {
      t.style.left = `${k * L.fg.w}px`;
      size(t, L.fg);
    });
    s.fg.style.height = `${L.fg.h}px`;
    s.fg.style.top = `${H - L.fg.h + Math.round(L.fg.h * 0.1)}px`;
    s.last = {};
  }

  // Fetches and decodes one scene; repeat calls are free.
  load(i) {
    const s = this.scenes[i];
    if (!s || s.ready) return s?.ready;
    const set = (n, src) => { n.src = src; return n.decode().catch(() => {}); };
    const main = [
      set(s.sky, `${s.base}sky.webp`),
      set(s.hills, `${s.base}hills.webp`),
      set(s.subjectImg, `${s.base}subject.webp`),
    ];
    s.loaded = true;
    for (const t of s.fgTiles) main.push(set(t, `${s.base}fg.webp`));
    for (const n of s.lazy) n.src = n.dataset.src;
    for (const n of s.sprites) main.push(n.decode().catch(() => {}));
    s.ready = Promise.all(main).then(() => { s.decoded = true; });
    return s.ready;
  }

  // Lets the browser drop a far-away scene's bitmaps. It will load again if needed.
  unload(i) {
    const s = this.scenes[i];
    if (!s?.ready || i === this.active) return;
    for (const n of [s.sky, s.hills, s.subjectImg, ...s.fgTiles, ...s.lazy]) n.removeAttribute('src');
    s.ready = null;
    s.loaded = false;
    s.decoded = false;
  }

  // One event ahead and one behind stay ready; everything else is let go.
  window(i) {
    this.load(i);
    this.load(i + 1);
    this.load(i - 1);
    this.scenes.forEach((_, k) => { if (Math.abs(k - i) > 1) this.unload(k); });
  }

  show(i) {
    if (i === this.active) return;
    this.scenes.forEach((s, k) => s.box.classList.toggle('on', k === i));
    this.active = i;
    if (this.warmed === i) { this.scenes[i].box.classList.remove('warm'); this.warmed = -1; }
  }

  // Puts a neighbour on screen behind the active scene, so the swap costs nothing.
  warm(i, p) {
    const s = this.scenes[i];
    const next = s?.decoded && i !== this.active ? i : -1;
    if (next !== this.warmed) {
      this.scenes[this.warmed]?.box.classList.remove('warm');
      s?.box.classList.toggle('warm', next >= 0);
      this.warmed = next;
    }
    if (next >= 0) this.update(p, next);
  }

  update(p, i = this.active) {
    if (i < 0) return;
    const s = this.scenes[i], o = this.place(i, p), l = s.last;
    const step = window.devicePixelRatio || 1;
    const put = (n, key, x, y = 0) => {
      // Whole device pixels: the smallest step the eye can see, so slow layers glide.
      const v = Math.round(x * step) / step;
      if (l[key] === v) return;
      l[key] = v;
      n.style.transform = `translate3d(${v}px,${y}px,0)`;
    };
    put(s.sky, 'sky', o.sky);
    put(s.hills, 'hills', o.hills);
    put(s.subject, 'subject', o.subjectX, Math.round(o.subjectY));
    put(s.fg, 'fg', o.fg);
  }

  // Decoded size of the paintings currently held, for the ?perf panel.
  decodedBytes() {
    let b = 0;
    for (const s of this.scenes) {
      if (!s.decoded) continue;
      for (const n of [s.sky, s.hills, s.subjectImg, s.fgTiles[0]]) b += n.naturalWidth * n.naturalHeight * 4;
    }
    return b;
  }

  // Draws a scene into a canvas, for the paint-bleed to reveal.
  snapshot(i, p, scale) {
    const s = this.scenes[i], o = this.place(i, p), L = o.L, { W, H } = this;
    const c = (this.canvas ||= document.createElement('canvas'));
    c.width = Math.round(W * scale);
    c.height = Math.round(H * scale);
    const g = c.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.fillStyle = s.def.paper;
    g.fillRect(0, 0, W, H);
    g.drawImage(s.sky, o.sky, H - L.sky.h, L.sky.w, L.sky.h);
    g.drawImage(s.hills, o.hills, H - L.hills.h, L.hills.w, L.hills.h);
    const pieces = (back) => {
      for (const n of s.sprites) {
        const q = n.spec, w = q.w * L.subject.w, h = w / q.ar;
        if (!!q.back !== back || !n.complete || !n.naturalWidth) continue;
        const x = o.subjectX + q.x * L.subject.w - w / 2;
        g.drawImage(n, x, o.subjectY + q.y * L.subject.h - (q.cls === 'sway' ? 0 : h), w, h);
      }
    };
    pieces(true);
    g.drawImage(s.subjectImg, o.subjectX, o.subjectY, L.subject.w, L.subject.h);
    pieces(false);
    const top = H - L.fg.h + Math.round(L.fg.h * 0.1);
    s.fgTiles.forEach((t, k) => {
      const x = o.fg + k * L.fg.w;
      if (x > W || x + L.fg.w < 0) return;
      if (k % 2) {
        g.save();
        g.translate(x + L.fg.w, top);
        g.scale(-1, 1);
        g.drawImage(t, 0, 0, L.fg.w, L.fg.h);
        g.restore();
      } else g.drawImage(t, x, top, L.fg.w, L.fg.h);
    });
    return c;
  }
}

