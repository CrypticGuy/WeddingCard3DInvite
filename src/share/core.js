// Shared drawing helpers for the share graphics. Everything is drawn on a 2D canvas in the
// browser from config.js, so the images always match the site and nothing is committed.
import { invite } from '../config.js';
import { dateOf, dateSpan, part, timeOfDay } from '../ui/story.js';

export { invite, dateOf, dateSpan, part, timeOfDay };

// Static art for these graphics lives in public/share/ (paper.webp is a copy of V2's card paper).
export const ART = '../share/';

export const FONT = {
  script: (s) => `${s}px "Imperial Script", cursive`,
  serif: (s, w = 300) => `${w} ${s}px "Fraunces Variable", Georgia, serif`,
  italic: (s, w = 300) => `italic ${w} ${s}px "Fraunces Variable", Georgia, serif`,
  sans: (s, w = 400) => `${w} ${s}px "Jost Variable", "Segoe UI", sans-serif`,
};

let fontsPromise;
export function fontsReady() {
  fontsPromise ??= Promise.all([
    document.fonts.load('100px "Imperial Script"'),
    document.fonts.load('300 40px "Fraunces Variable"'),
    document.fonts.load('italic 300 40px "Fraunces Variable"'),
    document.fonts.load('400 24px "Jost Variable"'),
    document.fonts.load('500 24px "Jost Variable"'),
  ]).catch(() => {}).then(() => document.fonts.ready);
  return fontsPromise;
}

const images = new Map();
export function load(src) {
  if (!images.has(src)) {
    images.set(src, new Promise((res, rej) => {
      const i = new Image();
      i.decoding = 'async';
      i.onload = () => res(i);
      i.onerror = () => rej(new Error(`Could not load ${src}`));
      i.src = src;
    }));
  }
  return images.get(src);
}
export const tryLoad = (src) => load(src).catch(() => null);

// Small seeded random, so previews and saved files always match.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sizeOf = (font) => Number(/([\d.]+)px/.exec(font)?.[1] ?? 20);

function setText(g, font, track) {
  g.font = font;
  g.textBaseline = 'alphabetic';
  if ('letterSpacing' in g) g.letterSpacing = `${track}px`;
}

export function measure(g, str, font, track = 0) {
  setText(g, font, track);
  const m = g.measureText(str);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  // Letter spacing adds a trailing gap after the last glyph; leave it out.
  return { w: m.width - (track && 'letterSpacing' in g ? track : 0), asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent };
}

// fill may be a colour or (g, top, bottom) => style, for gradients that follow the line.
// impress: a pale edge under the glyphs, like ink pressed into paper. glow: [colour, blur].
export function put(g, str, x, y, font, fill, { align = 'center', track = 0, impress, glow, alpha = 1 } = {}) {
  setText(g, font, track);
  g.textAlign = align;
  // Letter spacing also trails the last glyph, which pulls centred text left.
  const dx = track && 'letterSpacing' in g ? (align === 'center' ? track / 2 : align === 'right' ? track : 0) : 0;
  const size = sizeOf(font);
  g.save();
  g.globalAlpha = alpha;
  if (impress) {
    g.fillStyle = impress;
    g.fillText(str, x + dx, y + Math.max(1, size / 34));
  }
  if (glow) {
    g.shadowColor = glow[0];
    g.shadowBlur = glow[1];
  }
  g.fillStyle = typeof fill === 'function' ? fill(g, y - size * 0.85, y + size * 0.15) : fill;
  g.fillText(str, x + dx, y);
  g.restore();
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}

// Split into lines that fit `max`, preferring a balanced break for two lines.
export function wrap(g, str, font, max, track = 0, maxLines = 3) {
  const words = str.split(/\s+/).filter(Boolean);
  if (measure(g, str, font, track).w <= max || words.length < 2) return [str];
  if (maxLines >= 2) {
    let best = null;
    for (let k = 1; k < words.length; k++) {
      const a = words.slice(0, k).join(' '), b = words.slice(k).join(' ');
      const wide = Math.max(measure(g, a, font, track).w, measure(g, b, font, track).w);
      // Never leave a lone ampersand or short joiner at the end of the first line.
      const lonely = /^(&|and|of|the|a)$/i.test(words[k - 1]) ? 1.15 : 1;
      // Addresses read best broken after a comma ("…, Bakoli," / "G.T. Karnal Road…").
      const comma = str.includes(',') && !/,$/.test(words[k - 1]) ? 1.25 : 1;
      if (wide <= max && (!best || wide * lonely * comma < best.score)) best = { lines: [a, b], score: wide * lonely * comma };
    }
    if (best) return best.lines;
  }
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && measure(g, test, font, track).w > max) { lines.push(cur); cur = w; } else cur = test;
  }
  lines.push(cur);
  return lines;
}

// The largest size up to `size` at which the text fits in `lines` lines of width `max`.
export function fitLines(g, str, make, size, max, { maxLines = 1, track = 0, min = 0.5, single = 0.82 } = {}) {
  const one = measure(g, str, make(size), track).w;
  if (one <= max) return { size, lines: [str] };
  if (maxLines === 1 || (one * single <= max)) {
    const s = Math.max(size * min, Math.floor((size * max) / one));
    return { size: s, lines: [str] };
  }
  for (let s = size; s >= size * min; s *= 0.96) {
    const lines = wrap(g, str, make(s), max, track, maxLines);
    if (lines.length <= maxLines && lines.every((l) => measure(g, l, make(s), track).w <= max)) return { size: s, lines };
  }
  const s = size * min;
  return { size: s, lines: wrap(g, str, make(s), max, track, maxLines).slice(0, maxLines) };
}

// ── Wording ──────────────────────────────────────────────────

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const inWords = (n) => WORDS[n] ?? String(n);
// Times are worked out here rather than with the site's timeRange, so an event with no end
// time ("6 PM onwards") or an unparseable one never breaks a layout.
const clock = (d) => part(d, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s+/g, ' ').replace(':00', '').replace(/\s*([ap])\.?m\.?$/i, (_, x) => ` ${x.toUpperCase()}M`);
export const endOf = (e) => { const d = e.end ? new Date(e.end) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
export const time = (e) => { const end = endOf(e); return end ? `${clock(dateOf(e))} to ${clock(end)}` : `${clock(dateOf(e))} onwards`; };
export const couple = () => `${invite.couple.first} & ${invite.couple.second}`;
export const mainEvent = () => invite.events.find((e) => e.main) ?? invite.events[invite.events.length - 1];
export const year = () => part(dateOf(mainEvent()), { year: 'numeric' });

// ── Output ───────────────────────────────────────────────────

export const jpeg = (canvas) => new Promise((res) => { canvas.toBlob(res, 'image/jpeg', 0.9); });

// A PDF with one full-bleed JPEG per page. Small enough not to need a PDF library.
// pages: [{ blob, width, height }] in pixels; each page is A4 portrait.
export async function pdfOf(pages, title) {
  const enc = new TextEncoder();
  const pw = 595.28, ph = 841.89;
  const body = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  const safe = title.replace(/[^\x20-\x7e]/g, '').replace(/([()\\])/g, '\\$1');
  const n = pages.length, info = 3 + n * 3, chunks = [], offsets = [];
  let size = 0;
  const add = (p) => {
    const bytes = typeof p === 'string' ? enc.encode(p) : p;
    chunks.push(bytes);
    size += bytes.length;
  };
  const object = (k, text) => { offsets[k] = size; add(`${k} 0 obj\n${text}\nendobj\n`); };

  add('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${n} >>`);
  for (const [i, p] of pages.entries()) {
    const o = 3 + i * 3, image = new Uint8Array(await p.blob.arrayBuffer());
    object(o, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${o + 1} 0 R >> >> /Contents ${o + 2} 0 R >>`);
    offsets[o + 1] = size;
    add(`${o + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`);
    add(image);
    add('\nendstream\nendobj\n');
    object(o + 2, `<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
  }
  object(info, `<< /Title (${safe}) >>`);
  const xref = size;
  add(`xref\n0 ${info + 1}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  add(`trailer\n<< /Size ${info + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}
