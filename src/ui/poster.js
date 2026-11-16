// The whole invite on one A4 page, drawn in the browser from config.js so it can never
// disagree with the site. Saved as a JPEG, or as a PDF that wraps the same JPEG, or
// handed to the phone's share sheet. It uses only V1's card sprays, so it works from
// every version, and copes with any number of events.
import { invite } from '../config.js';
import { dateOf, dateSpan, part, timeRange } from './story.js';
import dogMeta from '../v2/dog.json';

// Resolved from the page, so /v1/, /v2/ and the site root all find the same files.
const asset = (path) => new URL(path, location.href).href;
const SPRAY = { mehendi: 'mehendi', wedding: 'wedding', reception: 'sangeet' };
const W = 1240, H = 1754;      // A4 at 150 dots per inch
const INK = '#4f3a3f', SOFT = '#7c666a', ROSE = '#a4596a', GOLD = '#b48d4e', PAPER = '#fbf5ea';
const ACCENT = { mehendi: '#4f8a68', wedding: ROSE, reception: '#5f74b0' };

const load = (src) => new Promise((res, rej) => {
  const i = new Image();
  i.onload = () => res(i);
  i.onerror = () => rej(new Error(`Could not load ${src}`));
  i.src = src;
});
const maybe = (src) => load(src).catch(() => null);

function write(g, text, x, y, font, color, { align = 'center', track = '0px' } = {}) {
  g.font = font;
  g.fillStyle = color;
  g.textAlign = align;
  if ('letterSpacing' in g) g.letterSpacing = track;
  g.fillText(text, x, y);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}

// Largest size up to `size` that keeps the line inside `max`.
function fit(g, text, font, size, max) {
  g.font = font(size);
  const w = g.measureText(text).width;
  return w > max ? font(Math.floor((size * max) / w)) : font(size);
}

// Splits text into lines no wider than max, at most `lines` of them.
function wrap(g, text, font, max, lines = 2) {
  g.font = font;
  const out = [];
  let cur = '';
  for (const w of text.split(' ')) {
    const next = cur ? `${cur} ${w}` : w;
    if (g.measureText(next).width > max && cur) { out.push(cur); cur = w; } else cur = next;
  }
  if (cur) out.push(cur);
  if (out.length > lines) out.splice(lines - 1, out.length, out.slice(lines - 1).join(' '));
  return out;
}

async function paint({ withDog }) {
  await Promise.all([
    document.fonts.load('100px "Imperial Script"'),
    document.fonts.load('italic 300 40px "Fraunces Variable"'),
    document.fonts.load('500 24px "Jost Variable"'),
    document.fonts.load('400 24px "Jost Variable"'),
  ]).catch(() => {});

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = PAPER;
  g.fillRect(0, 0, W, H);

  // A wash of evening sky across the top that dissolves into the paper.
  const sky = g.createLinearGradient(0, 0, 0, 520);
  sky.addColorStop(0, 'rgba(191, 214, 246, .75)');
  sky.addColorStop(0.45, 'rgba(244, 205, 220, .45)');
  sky.addColorStop(1, 'rgba(251, 245, 234, 0)');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, 520);

  const { first, second } = invite.couple, mid = W / 2;
  write(g, invite.cardIntro.toUpperCase(), mid, 118, '500 24px "Jost Variable", sans-serif', INK, { track: '5px' });
  const names = `${first} & ${second}`;
  const font = fit(g, names, (s) => `${s}px "Imperial Script", cursive`, 168, W - 200);
  write(g, names, mid, 268, font, ROSE);
  write(g, invite.cardOutro.toUpperCase(), mid, 334, '500 24px "Jost Variable", sans-serif', INK, { track: '5px' });
  write(g, dateSpan(), mid, 400, 'italic 300 42px "Fraunces Variable", Georgia, serif', INK);

  // One row per event: its card spray on the left, the details beside it.
  const events = invite.events, top = 452, bottom = 1540;
  const rowH = Math.min(380, (bottom - top) / events.length);
  const art = Math.min(300, rowH - 40), textX = 150 + art + 60, textW = W - textX - 110;
  const sprays = await Promise.all(events.map((e) => maybe(asset(`../v1/art/spray-${e.spray ?? SPRAY[e.id] ?? e.id}.webp`))));
  for (const [i, e] of events.entries()) {
    const y = top + i * rowH + (rowH - art) / 2;
    if (sprays[i]) g.drawImage(sprays[i], 150, y, art, art);
    const d = dateOf(e), L = { align: 'left' };
    let ty = y + Math.max(0, (art - 300) / 2) + 74;
    write(g, e.title, textX, ty, fit(g, e.title, (s) => `${s}px "Imperial Script", cursive`, 82, textW), ACCENT[e.id] ?? ROSE, L);
    ty += 50;
    write(g, `${part(d, { weekday: 'long', day: 'numeric', month: 'long' })}, ${timeRange(e)}`, textX, ty, fit(g, `${part(d, { weekday: 'long', day: 'numeric', month: 'long' })}, ${timeRange(e)}`, (s) => `500 ${s}px "Jost Variable", sans-serif`, 27, textW), INK, L);
    ty += 38;
    write(g, e.venue, textX, ty, fit(g, e.venue, (s) => `400 ${s}px "Jost Variable", sans-serif`, 27, textW), INK, L);
    const addr = [e.address, e.near].filter(Boolean).join(' · ');
    for (const line of wrap(g, addr, '400 22px "Jost Variable", sans-serif', textW, 2)) {
      ty += 30;
      write(g, line, textX, ty, '400 22px "Jost Variable", sans-serif', SOFT, L);
    }
    ty += 38;
    write(g, `Wear: ${e.dress}`, textX, ty, 'italic 300 25px "Fraunces Variable", Georgia, serif', SOFT, L);
  }

  write(g, invite.closingTitle, mid, 1620, '74px "Imperial Script", cursive', ROSE);
  if (withDog) {
    write(g, invite.closingNote, mid, 1668, 'italic 300 26px "Fraunces Variable", Georgia, serif', SOFT);
    const atlas = await maybe(asset('../v2/art/dog.webp'));
    if (atlas) {
      const k = dogMeta.strips.idle.start, { fw, fh, cols } = dogMeta;
      g.drawImage(atlas, (k % cols) * fw, ((k / cols) | 0) * fh, fw, fh, W - 262, 1534, 180, (180 * fh) / fw);
    }
  }

  // A printer's rule, inset from the edge.
  g.strokeStyle = GOLD;
  g.lineWidth = 2;
  g.strokeRect(34, 34, W - 68, H - 68);
  return c;
}

const jpeg = (canvas) => new Promise((res) => { canvas.toBlob(res, 'image/jpeg', 0.9); });

// A one-page PDF holding a single JPEG. Small enough not to need a PDF library.
async function pdfOf(blob, title) {
  const image = new Uint8Array(await blob.arrayBuffer());
  const enc = new TextEncoder();
  const pw = 595.28, ph = 841.89;
  const body = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  const safe = title.replace(/[^\x20-\x7e]/g, '').replace(/([()\\])/g, '\\$1');
  const chunks = [], offsets = [];
  let size = 0;
  const add = (part) => {
    const bytes = typeof part === 'string' ? enc.encode(part) : part;
    chunks.push(bytes);
    size += bytes.length;
  };
  const object = (n, text) => { offsets[n] = size; add(`${n} 0 obj\n${text}\nendobj\n`); };

  add('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = size;
  add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`);
  add(image);
  add('\nendstream\nendobj\n');
  object(5, `<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
  object(6, `<< /Title (${safe}) >>`);
  const xref = size;
  add(`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  add(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}

const fileName = () => `${invite.couple.first}-${invite.couple.second}-invite`.toLowerCase();

// The invite as a JPEG File, ready for navigator.share.
export async function inviteFile(opts = {}) {
  const image = await jpeg(await paint({ withDog: true, ...opts }));
  return new File([image], `${fileName()}.jpg`, { type: 'image/jpeg' });
}

export async function saveInvite(kind, opts) {
  const image = await jpeg(await paint(opts));
  const { first, second } = invite.couple;
  const name = fileName();
  const file = kind === 'pdf' ? await pdfOf(image, `${first} and ${second}: invitation`) : image;
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.${kind}` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
