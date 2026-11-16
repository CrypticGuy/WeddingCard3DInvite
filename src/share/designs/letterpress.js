// Letterpress: a deckle-edged cotton card on linen, deep ink pressed into the paper,
// fine gold rules. Type only, so it works for any event.
import { ART, tryLoad, rng, FONT, put, inWords } from '../core.js';
import { typeset } from '../layout.js';

const INK = '#3a2c2a', SOFT = '#6f5d55', GOLD = '#a27b3c', LINEN = '#ded2c0';

function goldRule(g, x, y, width, u) {
  g.save();
  const grad = g.createLinearGradient(x - width / 2, 0, x + width / 2, 0);
  grad.addColorStop(0, 'rgba(162,123,60,0)');
  grad.addColorStop(0.18, GOLD);
  grad.addColorStop(0.82, GOLD);
  grad.addColorStop(1, 'rgba(162,123,60,0)');
  g.strokeStyle = grad;
  g.lineWidth = 1.6 * u;
  const d = 9 * u;
  g.beginPath();
  g.moveTo(x - width / 2, y); g.lineTo(x - d * 2.2, y);
  g.moveTo(x + d * 2.2, y); g.lineTo(x + width / 2, y);
  g.stroke();
  // A small lozenge with a dot either side.
  g.fillStyle = GOLD;
  g.beginPath();
  g.moveTo(x, y - d); g.lineTo(x + d * 0.7, y); g.lineTo(x, y + d); g.lineTo(x - d * 0.7, y);
  g.closePath();
  g.fill();
  for (const s of [-1, 1]) { g.beginPath(); g.arc(x + s * d * 1.5, y, 1.9 * u, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

function divider(g, x, y, u) {
  g.save();
  g.fillStyle = GOLD;
  for (const s of [-1, 0, 1]) { g.beginPath(); g.arc(x + s * 14 * u, y, (s ? 1.8 : 2.6) * u, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

// A corner flourish: two nested L-shaped hairlines and a dot.
function corner(g, x, y, sx, sy, u) {
  const a = 46 * u;
  g.beginPath();
  g.moveTo(x + sx * a, y); g.lineTo(x, y); g.lineTo(x, y + sy * a);
  g.moveTo(x + sx * a * 0.55, y + sy * 9 * u); g.lineTo(x + sx * 9 * u, y + sy * 9 * u); g.lineTo(x + sx * 9 * u, y + sy * a * 0.55);
  g.stroke();
  g.beginPath(); g.arc(x + sx * 18 * u, y + sy * 18 * u, 2.2 * u, 0, Math.PI * 2); g.fill();
}

// Stretches the middle of the card but keeps its deckled edges at their own scale.
function nineSlice(g, img, x, y, w, h, e, d) {
  const sw = img.width, sh = img.height;
  const sx = [0, e, sw - e, sw], dx = [x, x + d, x + w - d, x + w];
  const sy = [0, e, sh - e, sh], dy = [y, y + d, y + h - d, y + h];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    g.drawImage(img, sx[i], sy[j], sx[i + 1] - sx[i], sy[j + 1] - sy[j], dx[i], dy[j], dx[i + 1] - dx[i] + 0.5, dy[j + 1] - dy[j] + 0.5);
  }
}

async function background(g, w, h) {
  const s = w / 1080;
  g.fillStyle = LINEN;
  g.fillRect(0, 0, w, h);
  // Linen weave: faint crossing hairlines.
  const r = rng(7);
  g.save();
  g.globalAlpha = 0.05;
  g.strokeStyle = '#5a4733';
  for (let y = 0; y < h; y += 3 * s) { g.lineWidth = r() * s; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (r() - 0.5) * 4); g.stroke(); }
  for (let x = 0; x < w; x += 3 * s) { g.lineWidth = r() * s; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 4, h); g.stroke(); }
  g.restore();

  // The card, with a soft shadow so it lifts off the linen.
  const m = 30 * s;
  const paper = await tryLoad(`${ART}paper.webp`);
  g.save();
  g.shadowColor = 'rgba(60,40,20,.28)';
  g.shadowBlur = 34 * s;
  g.shadowOffsetY = 10 * s;
  if (paper) nineSlice(g, paper, m, m, w - m * 2, h - m * 2, 40, 40 * s * 1.15);
  else { g.fillStyle = '#fbf3e3'; g.fillRect(m, m, w - m * 2, h - m * 2); }
  g.restore();

  // Cotton fibre speckle.
  g.save();
  for (let i = 0; i < (w * h) / 2200; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(120,90,60,.07)' : 'rgba(255,255,255,.22)';
    g.fillRect(m + r() * (w - m * 2), m + r() * (h - m * 2), (0.6 + r() * 1.4) * s, (0.6 + r() * 1.4) * s);
  }
  g.restore();

  // Double gold frame with corner flourishes.
  const f = 64 * s;
  g.save();
  g.strokeStyle = GOLD;
  g.fillStyle = GOLD;
  g.lineWidth = 2 * s;
  g.strokeRect(f, f, w - f * 2, h - f * 2);
  g.lineWidth = 0.9 * s;
  g.strokeRect(f + 9 * s, f + 9 * s, w - (f + 9 * s) * 2, h - (f + 9 * s) * 2);
  const c = f + 22 * s;
  g.lineWidth = 1.2 * s;
  corner(g, c, c, 1, 1, s);
  corner(g, w - c, c, -1, 1, s);
  corner(g, c, h - c, 1, -1, s);
  corner(g, w - c, h - c, -1, -1, s);
  g.restore();
}

// Event pages: a large italic numeral inside a gold ring.
function hero(L, e, i) {
  const { g, u, cx } = L, r = 92 * u;
  return {
    h: r * 2,
    draw: (y) => {
      g.save();
      g.strokeStyle = GOLD;
      g.lineWidth = 1.6 * u;
      g.beginPath(); g.arc(cx, y + r, r, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 0.8 * u;
      g.beginPath(); g.arc(cx, y + r, r - 8 * u, 0, Math.PI * 2); g.stroke();
      g.restore();
      put(g, inWords(i + 1).replace(/^./, (c) => c.toUpperCase()), cx, y + r + 16 * u, FONT.italic(48 * u), INK, { impress: 'rgba(255,255,255,.7)' });
    },
  };
}

export const letterpress = {
  id: 'letterpress',
  name: 'Letterpress',
  blurb: 'Ink on a deckle-edged card, gold rules',
  async draw(g, o) {
    await background(g, o.w, o.h);
    const s = o.w / 1080;
    await typeset(g, {
      colors: { ink: INK, soft: SOFT, eyebrow: GOLD, names: INK, amp: GOLD, title: INK },
      impress: 'rgba(255,255,255,.55)',
      headerWidth: (L) => L.w * (o.h / o.w < 1.3 ? 0.7 : 0.66),
      rule: goldRule,
      divider,
      hero,
      // Keep clear of the double frame.
      frame: (w, h) => ({ side: Math.max(118 * s, w * 0.11), top: Math.max(h * (h / w > 1.6 ? 0.095 : 0), 120 * s), bottom: Math.max(h * (h / w > 1.6 ? 0.105 : 0), 120 * s) }),
    }, o);
  },
};
