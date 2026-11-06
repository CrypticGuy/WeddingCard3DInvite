import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/jost/index.css';
import './router.css';
import { versions } from './versions.js';

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

document.querySelector('#list').innerHTML = versions.map((v) => `
  <li class="version">
    <a class="thumb" href="${esc(v.id)}/?review" aria-label="Open ${esc(v.title)}">
      <img src="thumbs/${esc(v.id)}.webp" alt="" width="390" height="620" loading="lazy">
    </a>
    <div class="text">
      <p class="meta"><span>${esc(v.id.toUpperCase())}</span><span class="status">${esc(v.status)}</span></p>
      <h2>${esc(v.title)}</h2>
      <p>${esc(v.summary)}</p>
      <ul class="notes">${v.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      <div class="links">
        <a class="open" href="${esc(v.id)}/?review">Open</a>
        <a class="monitor" href="${esc(v.id)}/?review&amp;perf">Open with performance monitor</a>
      </div>
    </div>
  </li>`).join('');
