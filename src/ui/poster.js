// The whole invite on one A4 page, drawn in the browser from config.js so it can never
// disagree with the site. Saved as a JPEG, or as a PDF that wraps the same JPEG.
import { invite } from '../config.js';
import { dateOf, dateSpan, part, timeRange } from './story.js';
import { SCENES } from '../v2/scenes.js';
import dogMeta from '../v2/dog.json';

const ART = '../v2/art/';
const W = 1240, H = 1754;      // A4 at 150 dots per inch
const INK = '#4f3a3f', SOFT = '#7c666a', ROSE = '#a4596a', GOLD = '#b48d4e', PAPER = '#fbf5ea';
const ACCENT = { mehendi: '#5d7f62', haldi: '#a9742a', sangeet: '#6b5a93', wedding: ROSE };

const load = (src) => new Promise((res, rej) => {
  const i = new Image();
  i.onload = () => res(i);
  i.onerror = () => rej(new Error(`Could not load ${src}`));
  i.src = src;
});

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

async function drawScene(g, id, x, y, size) {
  const base = `${ART}${id}/`, sprites = SCENES[id].sprites.filter((s) => s.src);
  const [main, ...parts] = await Promise.all([load(`${base}subject.webp`), ...sprites.map((s) => load(base + s.src))]);
  const piece = (back) => sprites.forEach((s, k) => {
    if (!!s.back !== back) return;
    const w = s.w * size, h = w / s.ar;
    g.drawImage(parts[k], x + s.x * size - w / 2, y + s.y * size - (s.cls === 'sway' ? 0 : h), w, h);
  });
  piece(true);
  g.drawImage(main, x, y, size, size);
  piece(false);
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

  // A band of evening sky that dissolves into the paper.
  const sky = await load(`${ART}wedding/sky.webp`);
  const band = document.createElement('canvas');
  band.width = W; band.height = 520;
  const b = band.getContext('2d');
  b.drawImage(sky, 0, 0, W, W / 2);
  b.globalCompositeOperation = 'destination-in';
  const fade = b.createLinearGradient(0, 0, 0, 520);
  fade.addColorStop(0, 'rgba(0,0,0,.72)');
  fade.addColorStop(0.5, 'rgba(0,0,0,.42)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  b.fillStyle = fade;
  b.fillRect(0, 0, W, 520);
  g.drawImage(band, 0, 0);

  const { first, second } = invite.couple, mid = W / 2;
  write(g, invite.cardIntro.toUpperCase(), mid, 118, '500 24px "Jost Variable", sans-serif', INK, { track: '5px' });
  const names = `${first} & ${second}`;
  const font = fit(g, names, (s) => `${s}px "Imperial Script", cursive`, 168, W - 200);
  write(g, names, mid, 268, font, ROSE);
  write(g, invite.cardOutro.toUpperCase(), mid, 334, '500 24px "Jost Variable", sans-serif', INK, { track: '5px' });
  write(g, dateSpan(), mid, 400, 'italic 300 42px "Fraunces Variable", Georgia, serif', INK);

  // Four events, two by two.
  const colW = 540, top = 452, rowH = 540, art = 300;
  for (const [i, e] of invite.events.entries()) {
    const cx = mid + (i % 2 ? colW / 2 : -colW / 2), y = top + ((i / 2) | 0) * rowH;
    await drawScene(g, e.id, cx - art / 2, y, art);
    const d = dateOf(e);
    write(g, e.title, cx, y + art + 74, '82px "Imperial Script", cursive', ACCENT[e.id] ?? ROSE);
    const line = fit(g, e.venue, (s) => `400 ${s}px "Jost Variable", sans-serif`, 25, colW - 40);
    write(g, part(d, { weekday: 'long', day: 'numeric', month: 'long' }), cx, y + art + 116, '500 25px "Jost Variable", sans-serif', INK);
    write(g, timeRange(e), cx, y + art + 150, '400 25px "Jost Variable", sans-serif', INK);
    write(g, e.venue, cx, y + art + 184, line, INK);
    write(g, `Wear: ${e.dress}`, cx, y + art + 218, 'italic 300 25px "Fraunces Variable", Georgia, serif', SOFT);
  }

  write(g, invite.closingTitle, mid, 1620, '74px "Imperial Script", cursive', ROSE);
  if (withDog) {
    write(g, invite.closingNote, mid, 1668, 'italic 300 26px "Fraunces Variable", Georgia, serif', SOFT);
    const atlas = await load(`${ART}dog.webp`);
    const k = dogMeta.strips.idle.start, { fw, fh, cols } = dogMeta;
    g.drawImage(atlas, (k % cols) * fw, ((k / cols) | 0) * fh, fw, fh, W - 262, 1534, 180, (180 * fh) / fw);
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

export async function saveInvite(kind, opts) {
  const image = await jpeg(await paint(opts));
  const { first, second } = invite.couple;
  const name = `${first}-${second}-invite`.toLowerCase();
  const file = kind === 'pdf' ? await pdfOf(image, `${first} and ${second}: invitation`) : image;
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.${kind}` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
