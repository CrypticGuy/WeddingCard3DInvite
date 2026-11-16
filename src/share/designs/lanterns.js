// Evening lanterns: an indigo dusk deepening to rose, paper lanterns glowing at the
// corners, sky lanterns drifting up, gold type. Everything is drawn in canvas.
import { rng } from '../core.js';
import { typeset } from '../layout.js';

const IVORY = '#fbf0dc', SOFT = '#e6cfd6', GOLD_SOLID = '#e9c27a';

const gold = (g, top, bottom) => {
  const grad = g.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, '#fff0c4');
  grad.addColorStop(0.45, '#eac27a');
  grad.addColorStop(0.75, '#c99449');
  grad.addColorStop(1, '#f2d692');
  return grad;
};

const AMBER = ['#fff6d6', '#ffc56b', '#e2763f', '#8c2f2a'];
const ROSE = ['#ffe9ef', '#ff9fb4', '#d9496e', '#6e1d3c'];

function halo(g, x, y, r, a = 0.5) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  const h = g.createRadialGradient(x, y, 0, x, y, r);
  h.addColorStop(0, `rgba(255,190,110,${a})`);
  h.addColorStop(0.35, `rgba(255,140,90,${a * 0.35})`);
  h.addColorStop(1, 'rgba(255,120,90,0)');
  g.fillStyle = h;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

// A round ribbed paper lantern hanging from (x, 0) with its body centred at (x, y).
function lantern(g, x, y, r, pal, u) {
  g.save();
  g.strokeStyle = 'rgba(240,205,140,.55)';
  g.lineWidth = 1.2 * u;
  g.beginPath(); g.moveTo(x, 0); g.lineTo(x, y - r * 1.2); g.stroke();
  halo(g, x, y, r * 4.2, 0.55);
  const body = g.createRadialGradient(x - r * 0.2, y - r * 0.15, r * 0.1, x, y, r * 1.15);
  body.addColorStop(0, pal[0]);
  body.addColorStop(0.45, pal[1]);
  body.addColorStop(0.85, pal[2]);
  body.addColorStop(1, pal[3]);
  g.fillStyle = body;
  g.beginPath(); g.ellipse(x, y, r, r * 1.12, 0, 0, Math.PI * 2); g.fill();
  // Ribs.
  g.strokeStyle = 'rgba(110,30,30,.22)';
  g.lineWidth = 1.1 * u;
  for (const k of [-0.66, -0.33, 0, 0.33, 0.66]) {
    g.beginPath(); g.ellipse(x, y, Math.abs(k) * r || 0.5, r * 1.12, 0, 0, Math.PI * 2); g.stroke();
  }
  // Caps and tassel.
  g.fillStyle = '#5b3a22';
  const cw = r * 0.62, ch = r * 0.2;
  g.fillRect(x - cw / 2, y - r * 1.12 - ch * 0.6, cw, ch);
  g.fillRect(x - cw / 2, y + r * 1.12 - ch * 0.4, cw, ch);
  g.fillStyle = 'rgba(240,200,120,.8)';
  g.fillRect(x - cw / 2, y - r * 1.12 - ch * 0.6, cw, ch * 0.25);
  g.strokeStyle = pal[2];
  g.lineWidth = 1.4 * u;
  g.beginPath(); g.moveTo(x, y + r * 1.12 + ch * 0.6); g.lineTo(x, y + r * 1.6); g.stroke();
  g.fillStyle = pal[2];
  g.beginPath(); g.ellipse(x, y + r * 1.72, r * 0.09, r * 0.2, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

// A small sky lantern: a glowing trapezoid, lit from the flame at its base.
function skyLantern(g, x, y, r, a) {
  halo(g, x, y + r * 0.4, r * 3.4, 0.32 * a);
  g.save();
  g.globalAlpha = a;
  const grad = g.createLinearGradient(0, y - r, 0, y + r);
  grad.addColorStop(0, '#d98a5a');
  grad.addColorStop(0.6, '#ffc979');
  grad.addColorStop(1, '#fff1c8');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(x - r * 0.62, y - r); g.lineTo(x + r * 0.62, y - r);
  g.lineTo(x + r * 0.46, y + r); g.lineTo(x - r * 0.46, y + r);
  g.closePath();
  g.fill();
  g.restore();
}

function background(g, w, h) {
  const s = w / 1080, r = rng(11);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#120f33');
  sky.addColorStop(0.38, '#272059');
  sky.addColorStop(0.72, '#552b63');
  sky.addColorStop(1, '#8a3f63');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  // A warm bloom low on the horizon.
  const bloom = g.createRadialGradient(w / 2, h * 1.05, 0, w / 2, h * 1.05, w * 0.9);
  bloom.addColorStop(0, 'rgba(255,150,130,.38)');
  bloom.addColorStop(1, 'rgba(255,150,130,0)');
  g.fillStyle = bloom;
  g.fillRect(0, 0, w, h);

  // Stars, thinning towards the horizon.
  for (let i = 0; i < 260 * (h / w); i++) {
    const y = r() ** 1.6 * h * 0.75, a = (1 - y / (h * 0.75)) * (0.25 + r() * 0.6);
    g.fillStyle = `rgba(255,244,220,${a})`;
    g.beginPath(); g.arc(r() * w, y, (0.5 + r() * 1.3) * s, 0, Math.PI * 2); g.fill();
  }

  // Sky lanterns drifting up the margins: far ones small and faint.
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1, d = r();
    // Story formats have a narrow column of type; the others use the full width.
    const spread = h / w > 1.6 ? 0.36 + r() * 0.12 : 0.44 + r() * 0.045;
    const x = w / 2 + side * w * spread, y = h * (0.3 + r() * 0.62);
    skyLantern(g, x, y, (6 + d * 13) * s, 0.35 + d * 0.5);
  }

  // Low hills in silhouette, with a string of lights along the nearest.
  const hill = (base, amp, colour, seed) => {
    const q = rng(seed);
    g.fillStyle = colour;
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += w / 8) g.lineTo(x, h - base - Math.sin(x / w * 5 + q() * 6) * amp - q() * amp * 0.5);
    g.lineTo(w, h); g.closePath(); g.fill();
  };
  hill(h * 0.045, 12 * s, 'rgba(58,26,64,.75)', 3);
  hill(h * 0.022, 8 * s, '#2a1433', 5);
  g.save();
  g.strokeStyle = 'rgba(255,220,160,.35)';
  g.lineWidth = 1 * s;
  const sag = (x) => h - h * 0.058 + Math.sin((x / w) * Math.PI * 3) ** 2 * 18 * s;
  g.beginPath();
  for (let x = 0; x <= w; x += 8 * s) g.lineTo(x, sag(x));
  g.stroke();
  for (let x = 12 * s; x < w; x += 34 * s) {
    halo(g, x, sag(x), 9 * s, 0.6);
    g.fillStyle = r() < 0.3 ? '#ffd6e2' : '#ffe2a8';
    g.beginPath(); g.arc(x, sag(x) + 2 * s, 2.2 * s, 0, Math.PI * 2); g.fill();
  }
  g.restore();

  // Hanging lanterns clustered at the two top corners, clear of the centred type.
  const reach = Math.min(h * 0.24, w * 0.34);
  // On shorter formats the heading starts higher, so the inner pair is left out.
  const spots = [[0.07, 0.62, 30, 1], [0.15, 0.9, 40, 1], [0.235, 0.4, 24, 0], [0.93, 0.58, 30, 1], [0.845, 0.92, 40, 1], [0.765, 0.36, 22, 0]];
  spots.forEach(([fx, fy, size, always], i) => {
    if (always || h / w > 1.6) lantern(g, w * fx, reach * fy, size * s, i % 3 === 1 ? ROSE : AMBER, s);
  });
}

function goldRule(g, x, y, width, u) {
  g.save();
  const grad = g.createLinearGradient(x - width / 2, 0, x + width / 2, 0);
  grad.addColorStop(0, 'rgba(233,194,122,0)');
  grad.addColorStop(0.25, GOLD_SOLID);
  grad.addColorStop(0.75, GOLD_SOLID);
  grad.addColorStop(1, 'rgba(233,194,122,0)');
  g.strokeStyle = grad;
  g.lineWidth = 1.4 * u;
  const d = 22 * u;
  g.beginPath(); g.moveTo(x - width / 2, y); g.lineTo(x - d, y); g.moveTo(x + d, y); g.lineTo(x + width / 2, y); g.stroke();
  // A tiny lantern as the centre jewel.
  halo(g, x, y, 26 * u, 0.5);
  g.fillStyle = GOLD_SOLID;
  g.beginPath(); g.ellipse(x, y, 6 * u, 8 * u, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

function divider(g, x, y, u) {
  halo(g, x, y, 18 * u, 0.4);
  g.save();
  g.fillStyle = GOLD_SOLID;
  g.beginPath(); g.moveTo(x, y - 6 * u); g.lineTo(x + 4 * u, y); g.lineTo(x, y + 6 * u); g.lineTo(x - 4 * u, y); g.fill();
  g.restore();
}

// Event pages: three lanterns hanging in a row.
function hero(L) {
  const { g, u, cx } = L, h = 300 * u;
  return {
    h,
    draw: (y) => {
      g.save();
      g.translate(0, y);
      const clip = new Path2D(); clip.rect(0, 0, L.w, h); g.clip(clip);
      // Strings start above the slot, as if hung from the top of the page.
      g.translate(0, -40 * u);
      lantern(g, cx - 150 * u, 170 * u, 34 * u, AMBER, u);
      lantern(g, cx + 150 * u, 170 * u, 34 * u, AMBER, u);
      lantern(g, cx, 200 * u, 50 * u, ROSE, u);
      g.restore();
    },
  };
}

export const lanterns = {
  id: 'lanterns',
  name: 'Evening lanterns',
  blurb: 'Indigo dusk, glowing lanterns, gold type',
  async draw(g, o) {
    background(g, o.w, o.h);
    const s = o.w / 1080, tall = o.h / o.w;
    await typeset(g, {
      colors: { ink: IVORY, soft: SOFT, eyebrow: GOLD_SOLID, names: gold, amp: GOLD_SOLID, title: gold },
      glow: (u) => ['rgba(255,190,110,.45)', 22 * u],
      rule: goldRule,
      divider,
      hero: typeof o.page === 'number' ? hero : undefined,
      // The corner lanterns hang beside the heading, so keep the heading narrow.
      headerWidth: (L) => L.w * (tall < 1.6 ? 0.58 : 0.56),
      frame: (w, h) => ({ bottom: Math.max(h * (tall > 1.6 ? 0.105 : 0.085), h * 0.075 + 30 * s) }),
    }, o);
  },
};
