// The words, set like a printed invitation. Dates, links and calendar logic come
// from src/ui/story.js; everything guests read comes from src/config.js.
import { invite } from '../config.js';
import { ART } from './tier.js';
import { dateOf, dateSpan, esc, googleLink, letters, part, timeOfDay, timeRange } from '../ui/story.js';

function eventCard(e, i) {
  const d = dateOf(e);
  const map = e.mapUrl ? `<a class="btn ghost" href="${esc(e.mapUrl)}" target="_blank" rel="noopener">Open map</a>` : '';
  const address = e.address ? `<span class="sub">${esc(e.address)}</span>` : '';
  return `
  <section class="chapter event" id="${esc(e.id)}" data-index="${i}" data-theme-event="${esc(e.id)}" aria-label="${esc(e.title)}">
    <div class="pin">
      <article class="card">
        <img class="sprig" src="${ART}${esc(e.id)}/sprig.webp" alt="" width="300" height="300" loading="lazy">
        <p class="eyebrow">${part(d, { weekday: 'long' })} ${timeOfDay(d)}</p>
        <h2>${esc(e.title)}</h2>
        <p class="tag">${esc(e.tagline)}</p>
        <p class="when"><b>${part(d, { day: 'numeric' })}</b><span>${part(d, { month: 'long' })}<i>${part(d, { year: 'numeric' })}</i></span></p>
        <dl>
          <div><dt>Time</dt><dd>${timeRange(e)}</dd></div>
          <div><dt>Where</dt><dd>${esc(e.venue)}${address}</dd></div>
          <div><dt>Wear</dt><dd>${esc(e.dress)}</dd></div>
        </dl>
        <div class="actions">
          <a class="btn" href="${googleLink(e)}" target="_blank" rel="noopener">Add to calendar</a>
          ${map}
        </div>
      </article>
    </div>
  </section>`;
}

// withDog false is the variation without the beagle, so its lines go too.
export function renderStory(root, withDog = true) {
  const { first, second } = invite.couple;
  const n = invite.events.length;
  const list = invite.events.map((e, i) => `
    <li><button type="button" data-go="${i + 1}">
      <span class="d">${part(dateOf(e), { day: 'numeric', month: 'short' })}</span>
      <span class="t">${esc(e.title)}</span>
    </button></li>`).join('');

  root.innerHTML = `
  <section class="chapter hero" id="top" aria-label="${esc(first)} and ${esc(second)}">
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
    <button class="cue" type="button" data-go="1"><span>${withDog ? 'Scroll to walk with the pup' : 'Scroll to begin'}</span><i aria-hidden="true"></i></button>
  </section>
  <div class="gap dive" aria-hidden="true"></div>
  ${invite.events.map(eventCard).join('')}
  <div class="gap outro" aria-hidden="true"></div>
  <section class="chapter finale" id="see-you" data-index="${n}" aria-label="${esc(invite.closingTitle)}">
    <div class="finale-in">
      <p class="eyebrow">Until we all meet</p>
      <h2>${esc(invite.closingTitle)}</h2>
      <div class="count" role="timer" aria-live="off">
        ${['days', 'hours', 'mins', 'secs'].map((u) => `<div><b data-u="${u}">00</b><span>${u}</span></div>`).join('')}
      </div>
      <ol class="mini">${list}</ol>
      <div class="actions">
        <button class="btn" type="button" id="ics">Save all dates</button>
        <button class="btn ghost" type="button" data-go="0">Back to the start</button>
      </div>
      ${withDog ? `<p class="note">${esc(invite.closingNote)}</p>` : ''}
      ${invite.musicCredit ? `<p class="credit">${invite.musicCredit}</p>` : ''}
    </div>
  </section>`;
}
