// Watercolour florals, painted by polygon deformation: many translucent,
// slightly different copies of a shape build up soft, bleeding edges.
// Run once at build time by scripts/bake-art.mjs; the site ships the images.

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function painter(ctx, seed = 1) {
  const r = mulberry(seed);
  const gauss = () => (r() + r() + r() + r() - 2) / 2;

  const deform = (poly, depth, amp) => {
    let p = poly;
    for (let d = 0; d < depth; d++) {
      const out = [];
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const k = amp * (a[2] + b[2]) * 0.5 * len;
        const nx = (b[1] - a[1]) / (len || 1), ny = -(b[0] - a[0]) / (len || 1);
        const off = gauss() * k;
        out.push(a, [(a[0] + b[0]) / 2 + nx * off, (a[1] + b[1]) / 2 + ny * off, (a[2] + b[2]) / 2 * (0.8 + r() * 0.5)]);
      }
      p = out;
    }
    return p;
  };

  const fill = (poly) => {
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  };

  function wash(base, color, { layers = 22, alpha = 0.055, amp = 0.55 } = {}) {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    const b = deform(base.map(([x, y]) => [x, y, 0.5 + r()]), 3, amp);
    for (let i = 0; i < layers; i++) fill(deform(b, 2, amp * 0.9));
    ctx.globalAlpha = 1;
  }

  const ellipse = (cx, cy, rx, ry, rot = 0, n = 12) => {
    const pts = [], c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      pts.push([cx + x * c - y * s, cy + x * s + y * c]);
    }
    return pts;
  };

  function petal(cx, cy, len, wid, ang, color, opts) {
    const c = Math.cos(ang), s = Math.sin(ang), pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, w = Math.sin(Math.pow(t, 0.7) * Math.PI) * wid;
      pts.push([t * len, w]);
    }
    for (let i = 11; i > 0; i--) {
      const t = i / 12, w = Math.sin(Math.pow(t, 0.7) * Math.PI) * wid;
      pts.push([t * len, -w]);
    }
    wash(pts.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]), color, opts);
  }

  // Layered bloom: outer petals pale, heart deep, with a touch of gold.
  function peony(cx, cy, size, pal) {
    const [pale, mid, deep, heart] = pal;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.283 + r() * 0.5;
      petal(cx, cy, size * (0.9 + r() * 0.2), size * 0.5, a, pale, { layers: 18, alpha: 0.06, amp: 0.5 });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.283 + r();
      petal(cx, cy, size * 0.68, size * 0.36, a, mid, { layers: 15, alpha: 0.062, amp: 0.5 });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.283 + r();
      petal(cx, cy, size * 0.42, size * 0.24, a, deep, { layers: 12, alpha: 0.07, amp: 0.5 });
    }
    wash(ellipse(cx, cy, size * 0.15, size * 0.14), heart, { layers: 16, alpha: 0.08, amp: 0.6 });
    ctx.fillStyle = '#e0ad52';
    for (let i = 0; i < 26; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * size * 0.2;
      ctx.globalAlpha = 0.5 + r() * 0.4;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, size * (0.008 + r() * 0.012), 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function blossom(cx, cy, size, pal) {
    const n = 5, rot = r() * 6.28;
    for (let i = 0; i < n; i++) {
      petal(cx, cy, size, size * 0.46, rot + (i / n) * 6.283, pal[0], { layers: 14, alpha: 0.075, amp: 0.45 });
      petal(cx, cy, size * 0.6, size * 0.22, rot + (i / n) * 6.283, pal[1], { layers: 9, alpha: 0.07, amp: 0.45 });
    }
    ctx.fillStyle = '#e0ad52';
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 10; i++) {
      const a = r() * 6.283, d = r() * size * 0.14;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, size * 0.03, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function sprig(x0, y0, ang, len, leaves, pal, leafSize = 0.2, round = false) {
    let x = x0, y = y0, a = ang;
    const bend = (r() - 0.5) * 0.9;
    const step = len / leaves;
    ctx.strokeStyle = pal[2] ?? pal[1];
    ctx.lineCap = 'round';
    for (let i = 0; i < leaves; i++) {
      const nx = x + Math.cos(a) * step, ny = y + Math.sin(a) * step;
      ctx.lineWidth = Math.max(1, len * 0.012 * (1 - i / leaves));
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
      ctx.globalAlpha = 1;
      x = nx; y = ny; a += bend / leaves;
      const k = 1 - (i / leaves) * 0.55, L = len * leafSize * k;
      const col = pal[i % 2];
      for (const side of [-1, 1]) {
        const la = a + side * (round ? 1.25 : 0.72);
        if (round) wash(ellipse(x + Math.cos(la) * L * 0.5, y + Math.sin(la) * L * 0.5, L * 0.5, L * 0.36, la), col, { layers: 11, alpha: 0.08, amp: 0.4 });
        else petal(x, y, L, L * 0.2, la, col, { layers: 10, alpha: 0.085, amp: 0.4 });
      }
    }
    petal(x, y, len * leafSize * 0.5, len * leafSize * 0.1, a, pal[0], { layers: 8, alpha: 0.09, amp: 0.4 });
  }

  function dots(cx, cy, spread, n, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      ctx.globalAlpha = 0.25 + r() * 0.4;
      ctx.beginPath();
      ctx.arc(cx + gauss() * spread, cy + gauss() * spread, 1 + r() * 3.2, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return { r, wash, petal, peony, blossom, sprig, dots, ellipse };
}

const LEAF = ['#8fbf9a', '#a9d0a2', '#6fa583'];
const SAGE = ['#a6c9b0', '#c4dcc0', '#7fa98f'];
const PALS = {
  blush: ['#fbd3da', '#f6a8ba', '#e8728f', '#c94f72'],
  peach: ['#fde1c6', '#fbc49c', '#f39d78', '#d9744f'],
  lilac: ['#e7dafb', '#c9b1f2', '#9f83e0', '#7755bd'],
  butter: ['#fff0bd', '#ffd978', '#fbb73a', '#e68a12'],
  mint: ['#dbf2e0', '#bfe6cc', '#92cfae', '#6bb391'],
  ivory: ['#fff6ea', '#fde8d6', '#f9d3c4', '#eeb09f'],
};

export const SPRAYS = {
  mehendi: { big: ['ivory', 'blush'], small: 'mint', leaf: LEAF },
  haldi: { big: ['butter', 'peach'], small: 'butter', leaf: LEAF },
  sangeet: { big: ['lilac', 'blush'], small: 'lilac', leaf: SAGE },
  wedding: { big: ['blush', 'peach'], small: 'ivory', leaf: SAGE },
};

// A diagonal corner spray for the event cards.
export function paintSpray(ctx, size, theme, seed) {
  const p = painter(ctx, seed), c = SPRAYS[theme], k = size / 520;
  const cx = size * 0.56, cy = size * 0.42;
  for (let i = 0; i < 9; i++) {
    const a = -2.9 + (i / 8) * 3.6 + (p.r() - 0.5) * 0.3;
    p.sprig(cx, cy, a, size * (0.3 + p.r() * 0.16), 6, c.leaf, 0.2, i % 3 === 0);
  }
  p.sprig(cx, cy, 2.3, size * 0.4, 7, c.leaf, 0.2);
  p.sprig(cx, cy, 1.5, size * 0.34, 6, c.leaf, 0.2, true);
  p.blossom(size * 0.3, size * 0.34, 44 * k, PALS[c.small]);
  p.blossom(size * 0.8, size * 0.66, 40 * k, PALS[c.small]);
  p.peony(size * 0.68, size * 0.32, 96 * k, PALS[c.big[1]]);
  p.peony(size * 0.46, size * 0.52, 122 * k, PALS[c.big[0]]);
  p.blossom(size * 0.66, size * 0.56, 36 * k, PALS[c.small]);
  p.dots(cx, cy, size * 0.3, 44, PALS[c.big[0]][1]);
}

// A soft wreath frame for the 5:7 card. The middle stays clear for the text.
export function paintCard(ctx, W, H, seed) {
  const p = painter(ctx, seed);
  const leaf = LEAF, sage = SAGE;
  // Faint wash across the paper
  p.wash(p.ellipse(W * 0.5, H * 0.08, W * 0.7, H * 0.13, 0, 16), '#fde4e6', { layers: 14, alpha: 0.03, amp: 0.7 });
  p.wash(p.ellipse(W * 0.5, H * 0.95, W * 0.7, H * 0.12, 0, 16), '#e7f3df', { layers: 14, alpha: 0.03, amp: 0.7 });

  // Top garland
  const top = H * 0.19;
  for (let i = 0; i < 8; i++) p.sprig(W * 0.5, top, Math.PI + (i < 4 ? 0.1 * i - 0.3 : Math.PI + 0.1 * (i - 4) - 0.2 - Math.PI * 0), W * 0.36, 7, i % 2 ? leaf : sage, 0.15, i % 3 === 0);
  p.sprig(W * 0.5, top, 0.15, W * 0.44, 8, sage, 0.14, true);
  p.sprig(W * 0.5, top, Math.PI - 0.15, W * 0.44, 8, sage, 0.14, true);
  p.sprig(W * 0.5, top, -1.1, W * 0.2, 5, leaf, 0.2);
  p.sprig(W * 0.5, top, -2.0, W * 0.2, 5, leaf, 0.2);
  p.blossom(W * 0.16, top + 30, 46, PALS.lilac);
  p.blossom(W * 0.84, top + 26, 44, PALS.butter);
  p.peony(W * 0.27, top + 2, 94, PALS.peach);
  p.peony(W * 0.73, top - 2, 98, PALS.lilac);
  p.peony(W * 0.5, top, 136, PALS.blush);
  p.blossom(W * 0.38, top + 66, 40, PALS.ivory);
  p.blossom(W * 0.62, top + 64, 40, PALS.butter);
  p.dots(W * 0.5, top, W * 0.28, 60, '#f6a8ba');

  // Bottom spray
  const bot = H * 0.9;
  for (let i = 0; i < 7; i++) p.sprig(W * 0.5, bot, -0.3 - (i / 6) * 2.5, W * 0.13, 5, i % 2 ? leaf : sage, 0.26, i % 2 === 0);
  p.sprig(W * 0.5, bot, -0.05, W * 0.42, 7, sage, 0.15);
  p.sprig(W * 0.5, bot, Math.PI + 0.05, W * 0.42, 7, sage, 0.15);
  p.blossom(W * 0.26, bot + 8, 42, PALS.butter);
  p.blossom(W * 0.74, bot + 6, 42, PALS.lilac);
  p.peony(W * 0.37, bot - 8, 78, PALS.blush);
  p.peony(W * 0.63, bot - 6, 82, PALS.peach);
  p.peony(W * 0.5, bot + 4, 104, PALS.ivory);
  p.dots(W * 0.5, bot, W * 0.24, 44, '#fbc49c');
}
