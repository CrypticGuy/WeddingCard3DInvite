// Two things every version shares: an arrow saying what is further down the page, and
// a share button. Phones that can share files get the invite image and the link in the
// share sheet; others share just the link; anything else gets the save menu (image or
// PDF). The poster code loads on demand.
import './extras.css';
import { invite } from '../config.js';
import { dateSpan } from './story.js';

const ARROW = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

export function mountExtras({ withDog = true } = {}) {
  const next = document.createElement('button');
  next.id = 'next';
  next.type = 'button';
  next.hidden = true;
  next.innerHTML = `<span></span>${ARROW}<path d="M6 9l6 6 6-6"/></svg>`;

  const grab = document.createElement('div');
  grab.id = 'grab';
  grab.innerHTML = `
    <button type="button" class="open" aria-expanded="false" aria-label="Share the invite">${ARROW}<path d="M12 15V4M8 8l4-4 4 4"/><path d="M7 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1"/></svg></button>
    <div class="menu" hidden>
      <p>Save the whole invite</p>
      <button type="button" data-save="jpg">As an image</button>
      <button type="button" data-save="pdf">As a PDF</button>
    </div>`;
  document.body.append(next, grab);

  const open = grab.querySelector('.open'), menu = grab.querySelector('.menu');
  const show = (on) => {
    menu.hidden = !on;
    open.setAttribute('aria-expanded', String(on));
  };
  // The share sheet has to open within the tap that asked for it, and drawing the
  // poster takes a moment, so phones that can share files get it drawn ahead, when idle.
  const { first, second } = invite.couple;
  const url = location.origin + location.pathname.replace(/v1\/(index\.html)?$/, '');
  const text = `${first} & ${second} ${invite.cardOutro}. ${dateSpan()}. Open the invitation:`;
  const canFiles = typeof navigator.canShare === 'function';
  let file = null, making = null;
  const makeFile = () => (making ||= import('./poster.js').then((m) => m.inviteFile({ withDog })).then((f) => (file = f)).catch((err) => {
    console.warn('Invite image unavailable', err);
    making = null;
    return null;
  }));
  if (canFiles) {
    const idle = window.requestIdleCallback ?? ((f) => setTimeout(f, 1500));
    setTimeout(() => idle(makeFile, { timeout: 4000 }), 6000);
  }
  const share = async () => {
    if (canFiles) {
      const f = file ?? await makeFile();
      if (f && navigator.canShare({ files: [f] })) {
        await navigator.share({ files: [f], title: `${first} & ${second}`, text: `${text} ${url}` });
        return true;
      }
    }
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: `${first} & ${second}`, text, url });
      return true;
    }
    return false;
  };
  open.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!menu.hidden) return show(false);
    try {
      if (await share()) return;
    } catch (err) {
      if (err?.name === 'AbortError') return;   // the guest closed the share sheet
      console.warn('Share failed', err);
    }
    show(true);
  });
  document.addEventListener('click', (e) => { if (!grab.contains(e.target)) show(false); });

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-save]');
    if (!b) return;
    e.stopPropagation();
    const label = b.textContent;
    b.textContent = 'Preparing…';
    b.disabled = true;
    try {
      const { saveInvite } = await import('./poster.js');
      await saveInvite(b.dataset.save, { withDog });
      show(false);
    } catch (err) {
      console.error(err);
    }
    b.textContent = label;
    b.disabled = false;
  });

  // A reader resting on an event for a while gets a little pulse on the arrow.
  let idle = 0;
  const rest = () => {
    clearTimeout(idle);
    next.classList.remove('idle');
    if (!next.hidden) idle = setTimeout(() => next.classList.add('idle'), 6000);
  };
  addEventListener('scroll', rest, { passive: true });

  const html = document.documentElement;
  let armed = false;
  return {
    // Which chapter the arrow leads to, or nothing to hide it.
    setNext(chapter, title) {
      next.hidden = chapter == null;
      rest();
      if (chapter == null) return;
      next.dataset.go = chapter;
      next.firstElementChild.textContent = title;
      next.setAttribute('aria-label', `Go to ${title}`);
    },
    // Called once scrolling is allowed. The hero's cue shows, grows more insistent if
    // nobody scrolls for a few seconds, and leaves for good on the first real scroll.
    armHint() {
      if (armed) return;
      armed = true;
      if (window.scrollY > 24) { html.classList.add('scrolled'); return; }
      const nudge = setTimeout(() => html.classList.add('nudge'), 4000);
      const moved = () => {
        if (window.scrollY <= 24) return;
        clearTimeout(nudge);
        html.classList.remove('nudge');
        html.classList.add('scrolled');
        removeEventListener('scroll', moved);
      };
      addEventListener('scroll', moved, { passive: true });
    },
  };
}
