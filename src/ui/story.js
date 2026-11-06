import { invite } from '../config.js';

const TZ = invite.timeZone;
const fmt = (o) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...o });
const part = (d, o) => fmt(o).format(d);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const dateOf = (e) => new Date(e.start);

function timeOfDay(d) {
  const h = Number(fmt({ hour: 'numeric', hourCycle: 'h23' }).format(d));
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

function timeRange(e) {
  const f = (d) => part(d, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', ' ').toLowerCase();
  return `${f(new Date(e.start))} to ${f(new Date(e.end))}`;
}

const utc = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');

function googleLink(e) {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${e.title}: ${invite.couple.first} & ${invite.couple.second}`,
    dates: `${utc(new Date(e.start))}/${utc(new Date(e.end))}`,
    details: e.tagline,
    location: [e.venue, e.address].filter(Boolean).join(', '),
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export function icsFile() {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wedding invite//EN', 'CALSCALE:GREGORIAN'];
  const clean = (s) => s.replace(/([,;])/g, '\\$1');
  for (const e of invite.events) {
    lines.push(
      'BEGIN:VEVENT', `UID:${e.id}-${utc(new Date(e.start))}@invite`, `DTSTAMP:${utc(new Date())}`,
      `DTSTART:${utc(new Date(e.start))}`, `DTEND:${utc(new Date(e.end))}`,
      `SUMMARY:${clean(`${e.title}: ${invite.couple.first} & ${invite.couple.second}`)}`,
      `DESCRIPTION:${clean(e.tagline)}`, `LOCATION:${clean([e.venue, e.address].filter(Boolean).join(', '))}`, 'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function dateSpan() {
  const ds = invite.events.map(dateOf);
  const a = ds[0], b = ds[ds.length - 1];
  const day = (d) => part(d, { day: 'numeric' });
  const month = part(b, { month: 'long' }), year = part(b, { year: 'numeric' });
  const sameMonth = part(a, { month: 'long' }) === month;
  return sameMonth
    ? `${day(a)} to ${day(b)} ${month} ${year}`
    : `${day(a)} ${part(a, { month: 'long' })} to ${day(b)} ${month} ${year}`;
}

const letters = (s) => [...s].map((c, i) => `<span class="ch" style="--i:${i}" aria-hidden="true">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');

function eventCard(e, i) {
  const d = dateOf(e);
  const map = e.mapUrl ? `<a class="btn ghost" href="${esc(e.mapUrl)}" target="_blank" rel="noopener">Open map</a>` : '';
  const address = e.address ? `<span class="sub">${esc(e.address)}</span>` : '';
  return `
  <section class="chapter event" id="${esc(e.id)}" data-chapter="${i + 1}" data-theme-event="${esc(e.id)}" aria-label="${esc(e.title)}">
    <article class="card">
      <img class="spray" src="art/spray-${esc(e.id)}.webp" alt="" width="520" height="520">
      <div class="card-in">
        <p class="eyebrow r1">${part(d, { weekday: 'long' })} ${timeOfDay(d)}</p>
        <h2 aria-label="${esc(e.title)}">${letters(e.title)}</h2>
        <p class="tag r2">${esc(e.tagline)}</p>
        <div class="when r3">
          <span class="day">${part(d, { day: 'numeric' })}</span>
          <span class="mon"><b>${part(d, { month: 'long' })}</b><i>${part(d, { year: 'numeric' })}</i></span>
        </div>
        <dl class="r4">
          <div><dt>Time</dt><dd>${timeRange(e)}</dd></div>
          <div><dt>Where</dt><dd>${esc(e.venue)}${address}</dd></div>
          <div><dt>Wear</dt><dd>${esc(e.dress)}</dd></div>
        </dl>
        <div class="actions r5">
          <a class="btn" href="${googleLink(e)}" target="_blank" rel="noopener">Add to calendar</a>
          ${map}
        </div>
      </div>
    </article>
  </section>`;
}

export function renderStory(root) {
  const { first, second } = invite.couple;
  const n = invite.events.length;
  const list = invite.events.map((e, i) => `
    <li><button type="button" data-go="${i + 1}">
      <span class="d">${part(dateOf(e), { day: 'numeric', month: 'short' })}</span>
      <span class="t">${esc(e.title)}</span>
    </button></li>`).join('');

  root.innerHTML = `
  <section class="chapter hero" id="top" data-chapter="0" aria-label="${esc(first)} and ${esc(second)}">
    <div class="hero-in">
      <p class="eyebrow r1">Save the dates</p>
      <h1 aria-label="${esc(first)} and ${esc(second)}">
        <span class="nm">${letters(first)}</span>
        <em class="amp" aria-hidden="true">&amp;</em>
        <span class="nm">${letters(second)}</span>
      </h1>
      <p class="span r2">${dateSpan()}</p>
      <p class="line r3">${esc(invite.heroLine)}</p>
    </div>
    <button class="cue" type="button" data-go="1"><span>Scroll to walk with the pup</span><i aria-hidden="true"></i></button>
  </section>
  ${invite.events.map(eventCard).join('')}
  <section class="chapter finale" id="see-you" data-chapter="${n + 1}" aria-label="${esc(invite.closingTitle)}">
    <div class="finale-in">
      <p class="eyebrow r1">Until we all meet</p>
      <h2 aria-label="${esc(invite.closingTitle)}">${letters(invite.closingTitle)}</h2>
      <div class="count r2" role="timer" aria-live="off">
        ${['days', 'hours', 'mins', 'secs'].map((u) => `<div><b data-u="${u}">00</b><span>${u}</span></div>`).join('')}
      </div>
      <ol class="mini r3">${list}</ol>
      <div class="actions r4">
        <button class="btn" type="button" id="ics">Save all dates</button>
        <button class="btn ghost" type="button" data-go="0">Back to the start</button>
      </div>
      <p class="note r5">${esc(invite.closingNote)}</p>
    </div>
  </section>`;
}

export function startCountdown(root) {
  const main = invite.events.find((e) => e.main) ?? invite.events[invite.events.length - 1];
  const target = new Date(main.start).getTime();
  const out = Object.fromEntries([...root.querySelectorAll('[data-u]')].map((el) => [el.dataset.u, el]));
  const pad = (v) => String(v).padStart(2, '0');
  const tick = () => {
    const ms = Math.max(0, target - Date.now());
    const s = Math.floor(ms / 1000);
    out.days.textContent = pad(Math.floor(s / 86400));
    out.hours.textContent = pad(Math.floor(s / 3600) % 24);
    out.mins.textContent = pad(Math.floor(s / 60) % 60);
    out.secs.textContent = pad(s % 60);
  };
  tick();
  setInterval(tick, 1000);
}
