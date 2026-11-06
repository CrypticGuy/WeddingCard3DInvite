// Two things every version shares: an arrow saying what is further down the page, and
// a way to save the whole invite without watching it. The poster code loads on demand.
import './extras.css';

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
    <button type="button" class="open" aria-expanded="false" aria-label="Save the invite">${ARROW}<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg></button>
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
  open.addEventListener('click', (e) => {
    e.stopPropagation();
    show(menu.hidden);
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

  return {
    // Which chapter the arrow leads to, or nothing to hide it.
    setNext(chapter, title) {
      next.hidden = chapter == null;
      if (chapter == null) return;
      next.dataset.go = chapter;
      next.firstElementChild.textContent = title;
      next.setAttribute('aria-label', `Go to ${title}`);
    },
  };
}
