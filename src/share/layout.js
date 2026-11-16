// Typesetting shared by every design. A design supplies colours, ornaments and a background;
// this file decides where the words go. Layout depends only on the canvas shape and on
// how many events there are (three or four look right), never on which events they are.
import {
  FONT, put, measure, fitLines, wrap, invite, dateOf, dateSpan, part, timeOfDay, time, couple, inWords,
} from './core.js';

// ── Items: things with a height that draw themselves at a given top ──

const gap = (min, grow = 1, max = Infinity) => ({ gap: min, grow, max });

function line(L, str, font, fill, opts = {}) {
  const m = measure(L.g, str, font, opts.track ?? 0);
  return {
    h: m.asc + m.desc,
    w: m.w,
    draw: (y, x = L.cx, align = 'center') => put(L.g, str, x, y + m.asc, font, fill, { align, ...opts }),
  };
}

function block(L, strs, font, fill, lead, opts = {}) {
  const parts = strs.map((s) => line(L, s, font, fill, opts));
  return {
    h: parts.reduce((a, p) => a + p.h, 0) + lead * (parts.length - 1),
    w: Math.max(...parts.map((p) => p.w)),
    draw: async (y, x, align) => { for (const p of parts) { p.draw(y, x, align); y += p.h + lead; } },
  };
}

// Several items with fixed gaps between them, drawn as one.
function column(items) {
  return {
    h: items.reduce((a, i) => a + (i.gap ?? i.h), 0),
    w: Math.max(0, ...items.map((i) => i.w ?? 0)),
    draw: async (y, x, align) => {
      for (const i of items) {
        if (i.gap !== undefined) { y += i.gap; continue; }
        await i.draw(y, x, align);
        y += i.h;
      }
    },
  };
}

// Lays items out between top and bottom, sharing any spare room among the gaps.
async function place(items, top, bottom) {
  const fixed = items.reduce((a, i) => a + (i.gap ?? i.h), 0);
  let spare = bottom - top - fixed;
  const gaps = items.filter((i) => i.gap !== undefined);
  const size = new Map(gaps.map((i) => [i, i.gap]));
  // Grow gaps by weight, stopping each at its max, until the room is used.
  for (let round = 0; round < 4 && spare > 0.5; round++) {
    const open = gaps.filter((i) => size.get(i) < i.max);
    const weight = open.reduce((a, i) => a + i.grow, 0);
    if (!weight) break;
    let used = 0;
    for (const i of open) {
      const add = Math.min((spare * i.grow) / weight, i.max - size.get(i));
      size.set(i, size.get(i) + add);
      used += add;
    }
    spare -= used;
  }
  let y = top + Math.max(0, spare) / 2;
  for (const i of items) {
    if (i.gap !== undefined) { y += size.get(i); continue; }
    await i.draw(y);
    y += i.h;
  }
}

const need = (items) => items.reduce((a, i) => a + (i.gap ?? i.h), 0);

// ── Pieces of the invite ─────────────────────────────────────

function rule(L, width) {
  const h = (L.T.ruleH ?? 18) * L.u;
  return { h, draw: (y, x = L.cx) => L.T.rule(L.g, x, y + h / 2, width, L.u) };
}

function names(L, maxW, stacked) {
  const { g, T, u } = L, c = T.colors, { first, second } = invite.couple;
  const glow = T.glow?.(u);
  if (!stacked) {
    const f = fitLines(g, couple(), FONT.script, 150 * u, maxW);
    L.namesSize = f.size;
    return line(L, couple(), FONT.script(f.size), c.names, { impress: T.impress, glow });
  }
  // On a story the event details need the height, so stacked names start a little smaller.
  const top = (L.story ? 168 : 200) * u;
  const size = Math.min(fitLines(g, first, FONT.script, top, maxW).size, fitLines(g, second, FONT.script, top, maxW).size);
  L.namesSize = size;
  return column([
    line(L, first, FONT.script(size), c.names, { impress: T.impress, glow }),
    gap(14 * u),
    line(L, '&', FONT.italic(size * 0.34), c.amp, { impress: T.impress }),
    gap(4 * u),
    line(L, second, FONT.script(size), c.names, { impress: T.impress, glow }),
  ]);
}

function header(L, { maxW, stacked, tight }) {
  const { T, u } = L, c = T.colors, im = { impress: T.impress };
  const eyebrow = (s) => {
    const str = s.toUpperCase(), size = fitLines(L.g, str, (z) => FONT.sans(z, 500), 23 * u, maxW, { track: 7 * u }).size;
    return line(L, str, FONT.sans(size, 500), c.eyebrow, { track: 7 * u, ...im });
  };
  return [
    eyebrow(invite.cardIntro),
    gap((tight ? 22 : 34) * u, 1, 70 * u),
    names(L, maxW, stacked),
    gap((tight ? 18 : 30) * u, 1, 60 * u),
    eyebrow(invite.cardOutro),
    gap((tight ? 22 : 30) * u, 1, 50 * u),
    rule(L, Math.min(maxW, 420 * u)),
    gap((tight ? 20 : 28) * u, 1, 50 * u),
    line(L, dateSpan(), FONT.italic(44 * u), c.ink, im),
  ];
}

const weekdayTime = (e) => { const d = dateOf(e); return `${part(d, { weekday: 'long' })} ${timeOfDay(d)}`; };
const longDate = (e) => part(dateOf(e), { weekday: 'long', day: 'numeric', month: 'long' });

// One event's words as named slots, so cells side by side can line up slot by slot.
function eventSlots(L, e, width, detail, side = false) {
  const { g, T, u } = L, c = T.colors, im = { impress: T.impress };
  const fit = (str, make, size, opts = {}) => fitLines(g, str, make, size, width, opts);
  const slots = {};
  const titleSize = { full: 92, cover: 84, compact: 70 * L.ev }[detail];
  const t = fit(e.title, FONT.script, titleSize * u, { maxLines: 2, min: 0.6 });
  slots.title = block(L, t.lines, FONT.script(t.size), c.title, 2 * u, { impress: T.impress, glow: T.glow?.(u * 0.6) });

  if (detail === 'compact') {
    // Grid cells grow with L.ev when the page has room to spare.
    const v = u * L.ev;
    const day = part(dateOf(e), { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
    slots.date = line(L, day, FONT.sans(fit(day, (s) => FONT.sans(s, 500), 23 * v, { track: 4 * v }).size, 500), c.eyebrow, { track: 4 * v, ...im });
    // Same size in every cell, so one long time or venue does not stand out.
    const all = invite.events;
    const ts = Math.min(...all.map((x) => fit(time(x), FONT.sans, 25 * v, { min: 0.6 }).size));
    slots.time = line(L, time(e), FONT.sans(ts), c.ink, im);
    // Long venues (a name and an address in one) may take three lines rather than shrink.
    const vs = Math.min(...all.map((x) => fit(x.venue, FONT.sans, 23 * v, { maxLines: 3, min: 0.8, single: 0.72 }).size));
    slots.venue = block(L, wrap(g, e.venue, FONT.sans(vs), width, 0, 3), FONT.sans(vs), c.soft, 6 * v, im);
    return slots;
  }
  const when = `${longDate(e)}  ·  ${time(e)}`;
  slots.date = line(L, when, FONT.sans(fit(when, FONT.sans, 28 * u).size), c.ink, im);
  const v = fit(e.venue, FONT.sans, 26 * u, { maxLines: 2, min: 0.8 });
  slots.venue = block(L, v.lines, FONT.sans(v.size), c.soft, 6 * u, im);
  return slots;
}

// Status and story images (one event per row, lots of height): big type, read at phone size.
// Sizes use L.ev, the event scale, which starts well above the header's and shrinks to fit.
function storySlots(L, e, width) {
  const { g, T, u, ev } = L, c = T.colors, im = { impress: T.impress }, v = u * ev;
  const fit = (str, make, size, opts = {}) => fitLines(g, str, make, size, width, opts);
  // Every event's lines share one size per slot, so one long venue does not stand out.
  const all = invite.events;
  const same = (get, make, size, opts) => Math.min(...all.map((x) => (get(x) ? fit(get(x), make, size, opts).size : size)));
  const slots = {};
  // Event titles stay a step below the couple's names.
  const ts = same((x) => x.title, FONT.script, Math.min(124 * v, (L.namesSize ?? Infinity) * 0.8), { maxLines: 2, min: 0.6 });
  const t = fit(e.title, FONT.script, ts, { maxLines: 2, min: 0.6 });
  slots.title = block(L, t.lines, FONT.script(t.size), c.title, 0, { impress: T.impress, glow: T.glow?.(v * 0.6) });
  const day = (x) => part(dateOf(x), { weekday: 'long', day: 'numeric', month: 'long' });
  const ds = same(day, (z) => FONT.serif(z, 400), 50 * v);
  slots.date = line(L, day(e), FONT.serif(ds, 400), c.ink, im);
  const tm = (x) => time(x).toUpperCase();
  const tz = same(tm, (z) => FONT.sans(z, 500), 31 * v, { track: 5 * v });
  slots.time = line(L, tm(e), FONT.sans(tz, 500), c.eyebrow, { track: 5 * v, ...im });
  const vs = same((x) => x.venue, (z) => FONT.sans(z, 500), 38 * v, { maxLines: 2, min: 0.7, single: 0.9 });
  const vn = { lines: wrap(g, e.venue, FONT.sans(vs, 500), width, 0, 2) };
  slots.venue = block(L, vn.lines, FONT.sans(vs, 500), c.ink, 8 * v, im);
  if (e.address) {
    const as = same((x) => x.address, FONT.sans, 31 * v, { maxLines: 2, min: 0.7, single: 0.9 });
    const a = { size: as, lines: wrap(g, e.address, FONT.sans(as), width, 0, 2) };
    slots.address = block(L, a.lines, FONT.sans(a.size), c.soft, 6 * v, im);
  }
  if (e.dress) {
    const d = `Dress: ${e.dress}`;
    slots.dress = line(L, d, FONT.italic(fit(d, FONT.italic, 32 * v).size), c.soft, im);
  }
  return slots;
}

const ORDER = ['art', 'eyebrow', 'title', 'date', 'time', 'venue', 'address', 'dress'];
const AFTER = { art: 16, eyebrow: 12, title: 12, date: 8, time: 8, venue: 8, address: 8, dress: 0 };
const STORY_AFTER = { title: 14, date: 10, time: 22, venue: 8, address: 14, dress: 0 };

// Cells in a grid: every row shares slot heights so titles and dates line up across.
function grid(L, { width, cols, detail }) {
  const { T, u } = L, n = invite.events.length;
  const gutter = (cols > 2 ? 40 : 50) * u, cw = (width - gutter * (cols - 1)) / cols;
  const art = T.art ? Math.min(cw * 0.86, (cols > 2 ? 230 : 300) * u) : 0;
  const cells = invite.events.map((e, i) => {
    const s = eventSlots(L, e, cw, detail);
    if (art) s.art = { h: art, draw: (y, x) => T.art(L.g, e, i, x - art / 2, y, art) };
    return s;
  });
  const rows = [];
  for (let r = 0; r * cols < n; r++) rows.push(cells.slice(r * cols, r * cols + cols));
  const rowItems = rows.map((row) => {
    const keys = ORDER.filter((k) => row.some((c) => c[k]));
    const h = Object.fromEntries(keys.map((k) => [k, Math.max(...row.map((c) => c[k]?.h ?? 0))]));
    const total = keys.reduce((a, k, j) => a + h[k] + (j < keys.length - 1 ? AFTER[k] * u : 0), 0);
    // A short last row is centred under the full ones.
    const x0 = L.cx - ((row.length * cw + (row.length - 1) * gutter) / 2) + cw / 2;
    return {
      h: total,
      draw: async (y) => {
        for (const [j, c] of row.entries()) {
          let yy = y;
          for (const k of keys) {
            // Titles sit on the bottom of their slot so one-line titles meet the dates.
            if (c[k]) await c[k].draw(k === 'title' ? yy + h[k] - c[k].h : yy, x0 + j * (cw + gutter));
            yy += h[k] + AFTER[k] * u;
          }
        }
      },
    };
  });
  const items = [];
  rowItems.forEach((r, i) => { if (i) items.push(gap(44 * u, 1, 90 * u)); items.push(r); });
  return items;
}

// One event per row, centred, with a small ornament between rows.
function rows(L, { width, detail, side }) {
  const { T, u } = L;
  const items = [];
  const art = side && T.art ? (detail === 'cover' ? 190 : 210) * u : 0;
  const textW = art ? width - art - 40 * u : width;
  const story = detail === 'full' && !art, after = story ? STORY_AFTER : AFTER, au = story ? u * L.ev : u;
  const cells = invite.events.map((e, i) => {
    const s = story ? storySlots(L, e, textW) : eventSlots(L, e, textW, detail, !!art);
    const parts = [];
    for (const k of ORDER) if (s[k]) { if (parts.length) parts.push(gap(after[parts.at(-1).key] * au)); parts.push(Object.assign(s[k], { key: k })); }
    return { col: column(parts), e, i };
  });
  if (!art) {
    cells.forEach(({ col }, i) => {
      if (i) items.push(gap(26 * au, 1, (story ? 70 : 46) * au), divider(L), gap(26 * au, 1, (story ? 70 : 46) * au));
      items.push({ h: col.h, draw: (y) => col.draw(y, L.cx, 'center') });
    });
    return items;
  }
  // Painting on the left, words on the right; every row shares the same left edge.
  const tw = Math.max(...cells.map((c) => c.col.w));
  const x0 = L.cx - (art + 40 * u + tw) / 2;
  cells.forEach(({ col, e, i }, j) => {
    if (j) items.push(gap(18 * u, 1, 40 * u));
    const h = Math.max(art, col.h);
    items.push({
      h,
      draw: async (y) => {
        await T.art(L.g, e, i, x0, y + (h - art) / 2, art);
        await col.draw(y + (h - col.h) / 2, x0 + art + 40 * u, 'left');
      },
    });
  });
  return items;
}

function divider(L) {
  const h = 10 * L.u;
  return { h, draw: (y) => L.T.divider(L.g, L.cx, y + h / 2, L.u) };
}

function closing(L) {
  const { T, u } = L;
  return line(L, invite.closingTitle, FONT.script(84 * u), T.colors.title, { impress: T.impress, glow: T.glow?.(u * 0.6) });
}

// ── Pages ────────────────────────────────────────────────────

function summary(L) {
  const { w, h, u, T, box } = L, n = invite.events.length, tall = h / w;
  const cols = tall >= 1.4 ? 1 : n <= 3 ? n : tall >= 1.2 ? 2 : n;
  const width = box.right - box.left;
  const headW = Math.min(width, T.headerWidth ? T.headerWidth(L) : width);
  const detail = cols === 1 ? (L.page === 'cover' ? 'cover' : 'full') : 'compact';
  // The header first: event titles are sized against the names.
  const head = header(L, { maxW: headW, stacked: L.stacked ?? tall >= 1.6, tight: tall < 1.3 });
  const ev = cols === 1 ? rows(L, { width, detail, side: true }) : grid(L, { width, cols, detail });
  return [
    ...head,
    gap(52 * u, 2, 140 * u),
    ...ev,
    gap(46 * u, 2, 140 * u),
    closing(L),
  ];
}

function eventPage(L) {
  const { g, u, T, box, page } = L, c = T.colors, im = { impress: T.impress };
  const e = invite.events[page], n = invite.events.length;
  const width = box.right - box.left;
  const eyebrow = (s, size = 22) => line(L, s.toUpperCase(), FONT.sans(size * u, 500), c.eyebrow, { track: 7 * u, ...im });
  const t = fitLines(g, e.title, FONT.script, 210 * u, width, { maxLines: 2, min: 0.55 });
  const tagline = fitLines(g, e.tagline, FONT.italic, 46 * u, width, { maxLines: 2 });
  const v = fitLines(g, e.venue, (s) => FONT.sans(s, 500), 36 * u, width, { maxLines: 2, min: 0.75 });
  const items = [
    eyebrow(couple()),
    gap(18 * u, 0.5, 30 * u),
    eyebrow(`Celebration ${inWords(page + 1)} of ${inWords(n)}`, 18),
    gap(40 * u, 1, 90 * u),
  ];
  const hero = T.hero?.(L, e, page);
  if (hero) items.push(hero, gap(40 * u, 1, 90 * u));
  items.push(
    eyebrow(weekdayTime(e)),
    gap(20 * u, 0.5, 40 * u),
    block(L, t.lines, FONT.script(t.size), c.title, 4 * u, { impress: T.impress, glow: T.glow?.(u) }),
    gap(18 * u, 0.5, 40 * u),
    block(L, tagline.lines, FONT.italic(tagline.size), c.soft, 10 * u, im),
    gap(34 * u, 1, 70 * u),
    rule(L, 380 * u),
    gap(34 * u, 1, 70 * u),
    line(L, `${longDate(e)} ${part(dateOf(e), { year: 'numeric' })}`, FONT.serif(54 * u), c.ink, im),
    gap(18 * u, 0.3, 30 * u),
    line(L, time(e).toUpperCase(), FONT.sans(28 * u, 500), c.ink, { track: 5 * u, ...im }),
    gap(28 * u, 0.5, 50 * u),
    block(L, v.lines, FONT.sans(v.size, 500), c.ink, 10 * u, im),
  );
  if (e.address) {
    const a = fitLines(g, e.address, FONT.sans, 28 * u, width, { maxLines: 3, min: 0.8, single: 0.95 });
    items.push(gap(12 * u), block(L, a.lines, FONT.sans(a.size), c.soft, 8 * u, im));
  }
  if (e.near) {
    const n2 = fitLines(g, e.near, FONT.italic, 28 * u, width, { maxLines: 2, min: 0.8 });
    items.push(gap(8 * u), block(L, n2.lines, FONT.italic(n2.size), c.soft, 6 * u, im));
  }
  if (e.dress) {
    items.push(gap(40 * u, 1, 80 * u), eyebrow('Dress code', 18), gap(14 * u),
      line(L, e.dress, FONT.italic(fitLines(g, e.dress, FONT.italic, 40 * u, width).size), c.ink, im));
  }
  items.push(gap(40 * u, 2, 160 * u), line(L, dateSpan(), FONT.italic(30 * u), c.soft, im));
  return items;
}

// Safe areas: story and status views cover the top and bottom with their own controls.
export function frame(w, h) {
  const tall = h / w;
  if (tall > 1.6) return { top: h * 0.095, bottom: h * 0.105, side: w * 0.085 };
  return { top: w * 0.085, bottom: w * 0.085, side: w * 0.085 };
}

const STORY_EV = 1.22, STORY_MIN_K = 0.9;
const GRID_EV = [1.4, 1.28, 1.16, 1], GRID_MIN_K = 1.1;

// Typesets a page. page: 'all' (everything on one image), 'cover', or an event index.
export async function typeset(g, T, { w, h, page = 'all' }) {
  const s = w / 1080;
  const f = { ...frame(w, h), ...(T.frame?.(w, h, page) ?? {}) };
  const box = { left: f.side, right: w - f.side, top: f.top, bottom: h - f.bottom };
  const story = page === 'all' && h / w > 1.6;
  // Start a little large and shrink until everything fits; spare room goes to the gaps.
  // ev scales the event details against the header: stories always run them larger.
  const fit = (ev, stacked) => {
    let L, items;
    for (let k = 1.25, i = 0; i < 40; i++, k *= 0.97) {
      L = { g, w, h, s, k, u: s * k, ev, stacked, story, cx: w / 2, T, page, box };
      items = typeof page === 'number' ? eventPage(L) : summary(L);
      if (need(items) <= box.bottom - box.top) break;
    }
    return { L, items };
  };
  let L, items;
  if (story) {
    // Stories stack the names when there is room; with several events the names go on one
    // line instead, so the event details can stay large.
    ({ L, items } = fit(STORY_EV, undefined));
    if (L.k < STORY_MIN_K) {
      const one = fit(STORY_EV, false);
      if (one.L.k > L.k) ({ L, items } = one);
    }
  } else if (page === 'all') {
    // Portrait and square grids: the largest event type that keeps the header full size.
    for (const ev of GRID_EV) {
      ({ L, items } = fit(ev));
      if (L.k >= GRID_MIN_K) break;
    }
  } else ({ L, items } = fit(1));
  await place(items, box.top, box.bottom);
  return L;
}
