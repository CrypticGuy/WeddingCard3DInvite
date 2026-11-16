import { invite } from '../config.js';

const TZ = invite.timeZone;
const fmt = (o) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...o });
export const part = (d, o) => fmt(o).format(d);
export const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const dateOf = (e) => new Date(e.start);

export function timeOfDay(d) {
  const h = Number(fmt({ hour: 'numeric', hourCycle: 'h23' }).format(d));
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

// Events without an `end` are open ended: "6:00 PM onwards" on the card, and a slot of
// this many hours in calendars, which need some end.
const OPEN_HOURS = 4;
export const endOf = (e) => (e.end ? new Date(e.end) : new Date(new Date(e.start).getTime() + OPEN_HOURS * 3600e3));

export const clock = (d) => part(d, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s*([ap])\.?m\.?$/i, (_, x) => ` ${x.toUpperCase()}M`);

export function timeRange(e) {
  return e.end ? `${clock(new Date(e.start))} to ${clock(new Date(e.end))}` : `${clock(new Date(e.start))} onwards`;
}

// Directions: the event's own pin if it has one, else a Google Maps search for the venue.
export function mapsLink(e) {
  if (e.maps || e.mapUrl) return e.maps || e.mapUrl;
  const q = [e.venue, e.address].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

const utc = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');

export function googleLink(e) {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${e.title}: ${invite.couple.first} & ${invite.couple.second}`,
    dates: `${utc(new Date(e.start))}/${utc(endOf(e))}`,
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
      `DTSTART:${utc(new Date(e.start))}`, `DTEND:${utc(endOf(e))}`,
      `SUMMARY:${clean(`${e.title}: ${invite.couple.first} & ${invite.couple.second}`)}`,
      `DESCRIPTION:${clean(e.tagline)}`, `LOCATION:${clean([e.venue, e.address].filter(Boolean).join(', '))}`, 'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function dateSpan() {
  const ds = invite.events.map(dateOf);
  const a = ds[0], b = ds[ds.length - 1];
  const day = (d) => part(d, { day: 'numeric' });
  const month = part(b, { month: 'long' }), year = part(b, { year: 'numeric' });
  if (part(a, { dateStyle: 'medium' }) === part(b, { dateStyle: 'medium' })) return `${day(b)} ${month} ${year}`;
  const sameMonth = part(a, { month: 'long' }) === month;
  return sameMonth
    ? `${day(a)}–${day(b)} ${month} ${year}`
    : `${day(a)} ${part(a, { month: 'long' })} to ${day(b)} ${month} ${year}`;
}

// Touch screens are told to swipe, everything else to scroll.
export const touchFirst = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

// The hero's hint: an icon (a mouse, or a chevron on touch screens) and one line of text.
export const cueButton = () =>
  `<button class="cue" type="button" data-go="1"><i class="cue-ico" aria-hidden="true"></i><span>${esc(invite.scrollCue[touchFirst() ? 'touch' : 'mouse'])}</span></button>`;

// Each letter animates in on its own; words stay whole so a long title can wrap.
export function letters(s) {
  let i = 0;
  return s.split(' ').map((w) => {
    const chars = [...w].map((c) => `<span class="ch" style="--i:${i++}" aria-hidden="true">${esc(c)}</span>`).join('');
    i++;
    return `<span class="wd">${chars}</span>`;
  }).join(' ');
}

// Card art per event id, from public/v1/art/spray-<name>.webp. The reception shares the
// lantern spray first painted for the sangeet.
const SPRAY = { mehendi: 'mehendi', wedding: 'wedding', reception: 'sangeet' };
const PIN = '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>';

function eventCard(e, i) {
  const d = dateOf(e);
  const maps = esc(mapsLink(e));
  const spray = e.spray ?? SPRAY[e.id];
  const address = e.address ? `<span class="sub">${esc(e.address)}</span>` : '';
  const near = e.near ? `<span class="sub near">${esc(e.near)}</span>` : '';
  return `
  <section class="chapter event" id="${esc(e.id)}" data-chapter="${i + 1}" data-theme-event="${esc(e.id)}" aria-label="${esc(e.title)}">
    <article class="card">
      ${spray ? `<img class="spray" data-art="art/spray-${esc(spray)}" alt="" width="520" height="520">` : ''}
      <div class="card-in">
        <p class="eyebrow r1">${part(d, { weekday: 'long' })} ${timeOfDay(d)}</p>
        <h2 aria-label="${esc(e.title)}">${e.title.length > 11 ? `<span class="fit">${letters(e.title)}</span>` : letters(e.title)}</h2>
        <p class="tag r2">${esc(e.tagline)}</p>
        <div class="when r3">
          <span class="day">${part(d, { day: 'numeric' })}</span>
          <span class="mon"><b>${part(d, { month: 'long' })}</b><i>${part(d, { year: 'numeric' })}</i></span>
        </div>
        <dl class="r4">
          <div><dt>Time</dt><dd>${timeRange(e)}</dd></div>
          <div><dt>Where</dt><dd><a class="venue" href="${maps}" target="_blank" rel="noopener" aria-label="${esc(e.venue)}, open in Google Maps">${esc(e.venue)}</a>${address}${near}</dd></div>
          <div><dt>Wear</dt><dd>${esc(e.dress)}</dd></div>
        </dl>
        <div class="actions r5">
          <a class="btn" href="${googleLink(e)}" target="_blank" rel="noopener">Add to calendar</a>
          <a class="btn ghost dir" href="${maps}" target="_blank" rel="noopener">${PIN}Get directions</a>
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
    ${cueButton()}
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
      ${invite.musicCredit ? `<p class="credit r5">${invite.musicCredit}</p>` : ''}
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
