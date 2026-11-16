// Tiny planet: V1's look. A pastel sky, the watercolour garland from V1's card across the
// top, and the curve of the little meadow planet along the foot, drawn in canvas.
import { rng, tryLoad, FONT, put } from '../core.js';
import { typeset } from '../layout.js';

const V1 = '../v1/art/';
const INK = '#5a3350', SOFT = '#84607c', GOLD = '#c99a4e', ROSE = '#dc6585';
const FLOWERS = ['#ffc9d6', '#ffe0a8', '#fff3f6', '#d9c8f5', '#ff9db4', '#ffb84d'];
const CANOPY = ['#ffc9d6', '#c9efd7', '#d9c8f5', '#ffe0a8', '#a8dcae'];

const garlandWidth = (w, h) => w * (h / w > 1.6 ? 0.76 : h / w > 1.3 ? 0.8 : h / w > 1.2 ? 0.66 : 0.56);
// The garland's flowers fill roughly this share of its own width, from the card's top.
const GARLAND = { y0: 48, y1: 432, src: 1024 };
const garlandBottom = (w, h) => garlandWidth(w, h) * ((GARLAND.y1 - GARLAND.y0) / GARLAND.src) * 0.95;
// Shorter on stories, where the event details need the height.
const planetHeight = (w, h) => Math.min(h * 0.13, w * (h / w > 1.6 ? 0.15 : 0.2));

function cloud(g, x, y, r) {
  g.save();
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.filter = `blur(${r * 0.25}px)`;
  for (const [dx, dy, k] of [[0, 0, 1], [0.9, 0.15, 0.75], [-0.85, 0.2, 0.7], [0.35, -0.35, 0.7]]) {
    g.beginPath(); g.ellipse(x + dx * r, y + dy * r, r * k * 1.3, r * k * 0.8, 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function tree(g, x, y, ang, size, colour) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = '#c9a07e';
  g.fillRect(-size * 0.07, -size * 0.9, size * 0.14, size * 0.95);
  const c = g.createRadialGradient(-size * 0.15, -size * 1.25, size * 0.05, 0, -size * 1.1, size * 0.55);
  c.addColorStop(0, '#ffffff');
  c.addColorStop(0.25, colour);
  c.addColorStop(1, colour);
  g.fillStyle = c;
  g.beginPath(); g.arc(0, -size * 1.1, size * 0.5, 0, Math.PI * 2); g.fill();
  g.restore();
}

function planet(g, w, h) {
  const s = w / 1080, ph = planetHeight(w, h), r = rng(21);
  const R = w * 1.35, cx = w / 2, cy = h - ph + R;
  // Atmosphere.
  const glow = g.createRadialGradient(cx, cy, R * 0.98, cx, cy, R + 70 * s);
  glow.addColorStop(0, 'rgba(255,255,255,.75)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.beginPath(); g.arc(cx, cy, R + 70 * s, 0, Math.PI * 2); g.fill();
  // Ground, darkening towards the curve's far side.
  const ground = g.createLinearGradient(0, h - ph, 0, h);
  ground.addColorStop(0, '#c4ebc8');
  ground.addColorStop(1, '#93d3a3');
  g.fillStyle = ground;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  // A winding path.
  g.save();
  g.strokeStyle = '#fff0dc';
  g.lineWidth = 16 * s;
  g.lineCap = 'round';
  g.beginPath();
  for (let a = -0.42; a <= 0.42; a += 0.01) {
    const rr = R - ph * (0.45 + Math.sin(a * 9) * 0.18);
    g.lineTo(cx + Math.sin(a) * rr, cy - Math.cos(a) * rr);
  }
  g.stroke();
  g.restore();
  const on = (a, inset = 0) => [cx + Math.sin(a) * (R - inset), cy - Math.cos(a) * (R - inset)];
  // Trees along the rim, smaller towards the edges.
  for (let i = 0; i < 9; i++) {
    const a = -0.4 + (i / 8) * 0.8 + (r() - 0.5) * 0.04;
    if (Math.abs(a) < 0.07) continue;
    const [x, y] = on(a, 2 * s);
    tree(g, x, y, a, (34 + r() * 22) * s * (1 - Math.abs(a)), CANOPY[i % CANOPY.length]);
  }
  // Flowers scattered over the meadow.
  for (let i = 0; i < 140; i++) {
    const a = (r() - 0.5) * 0.9, [x, y] = on(a, r() * ph * 0.95 + 4 * s);
    if (y > h) continue;
    g.fillStyle = FLOWERS[i % FLOWERS.length];
    g.beginPath(); g.arc(x, y, (2 + r() * 3) * s, 0, Math.PI * 2); g.fill();
  }
}

async function background(g, w, h) {
  const s = w / 1080;
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#fbdbe2');
  sky.addColorStop(0.45, '#fdeaee');
  sky.addColorStop(0.8, '#fff6ef');
  sky.addColorStop(1, '#e9f6ea');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const r = rng(4);
  for (let i = 0; i < 6; i++) cloud(g, (i % 2 ? 0.08 + r() * 0.12 : 0.8 + r() * 0.12) * w, h * (0.25 + (i / 6) * 0.5), (40 + r() * 40) * s);
  planet(g, w, h);
  const card = await tryLoad(`${V1}card.webp`);
  if (card) {
    const gw = garlandWidth(w, h), k = gw / GARLAND.src, gh = (GARLAND.y1 - GARLAND.y0) * k;
    g.drawImage(card, 0, GARLAND.y0, GARLAND.src, GARLAND.y1 - GARLAND.y0, (w - gw) / 2, 0, gw, gh);
  }
}

function rule(g, x, y, width, u) {
  g.save();
  g.strokeStyle = GOLD;
  g.lineWidth = 1.5 * u;
  const d = 20 * u;
  g.beginPath(); g.moveTo(x - width / 2, y); g.lineTo(x - d, y); g.moveTo(x + d, y); g.lineTo(x + width / 2, y); g.stroke();
  // A tiny planet with a ring of flowers.
  g.fillStyle = '#a8dcae';
  g.beginPath(); g.arc(x, y, 8 * u, 0, Math.PI * 2); g.fill();
  g.fillStyle = ROSE;
  g.beginPath(); g.arc(x, y - 8 * u, 3 * u, 0, Math.PI * 2); g.fill();
  g.restore();
}

function divider(g, x, y, u) {
  g.save();
  for (const [k, c] of [[-1, '#ffc9d6'], [0, ROSE], [1, '#d9c8f5']]) {
    g.fillStyle = c;
    g.beginPath(); g.arc(x + k * 14 * u, y, (k ? 2.4 : 3.2) * u, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// Events with no spray of their own borrow one. The reception has none yet, so it uses the
// lilac sangeet spray, which no current event shows. Any other id without a spray gets the
// drawn little planet with the event's initial.
const SPRAY = { reception: 'sangeet' };

// Event pages: the event's flower spray from V1, or a little planet when there is none.
function hero(L, e) {
  const { g, u, cx } = L, size = 420 * u;
  return {
    h: size,
    draw: async (y) => {
      const spray = await tryLoad(`${V1}spray-${SPRAY[e.id] ?? e.id}.webp`);
      if (spray) return g.drawImage(spray, cx - size / 2, y, size, size);
      const R = size * 0.3, py = y + size / 2;
      const ground = g.createRadialGradient(cx - R * 0.3, py - R * 0.3, R * 0.1, cx, py, R);
      ground.addColorStop(0, '#d8f3db');
      ground.addColorStop(1, '#93d3a3');
      g.fillStyle = ground;
      g.beginPath(); g.arc(cx, py, R, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 7; i++) {
        const a = -1.2 + i * 0.4;
        tree(g, cx + Math.sin(a) * R, py - Math.cos(a) * R, a, R * 0.32, CANOPY[i % CANOPY.length]);
      }
      put(g, e.title.trim()[0] ?? '', cx, py + R * 0.3, FONT.script(R * 0.95), INK);
    },
  };
}

export const meadow = {
  id: 'planet',
  name: 'Tiny planet',
  blurb: 'The pastel meadow world and garland from the site',
  async draw(g, o) {
    await background(g, o.w, o.h);
    const s = o.w / 1080, tall = o.h / o.w;
    await typeset(g, {
      colors: { ink: INK, soft: SOFT, eyebrow: GOLD, names: ROSE, amp: GOLD, title: ROSE },
      rule,
      divider,
      hero,
      frame: (w, h) => ({
        top: Math.max(h * (tall > 1.6 ? 0.095 : 0), garlandBottom(w, h) + 18 * s),
        bottom: Math.max(h * (tall > 1.6 ? 0.105 : 0), planetHeight(w, h) + 40 * s) + 70 * s, // trees stand above the rim
      }),
    }, o);
  },
};
