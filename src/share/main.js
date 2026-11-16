// The share page: live previews of every design in the chosen size, then save or share.
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/jost/index.css';
import '@fontsource/imperial-script/400.css';
import './share.css';
import { DESIGNS, FORMATS, pagesOf, renderPage, exportFile } from './render.js';
import { invite, dateSpan, couple } from './core.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const state = {
  format: FORMATS.find((f) => f.id === params.get('format')) ?? FORMATS[0],
  design: DESIGNS.find((d) => d.id === params.get('design')) ?? DESIGNS[0],
};
const status = (s) => { $('#status').textContent = s; };

// Rendered canvases, by design, format and page.
const cache = new Map();
const keyOf = (d, f, p) => `${d.id}|${f.id}|${p}`;
function canvasFor(d, f, p) {
  const k = keyOf(d, f, p);
  if (!cache.has(k)) cache.set(k, renderPage(d, f, p));
  return cache.get(k);
}

function show(frame, canvas) {
  frame.classList.remove('busy');
  frame.replaceChildren(canvas);
  canvas.setAttribute('aria-hidden', 'true');
}

$('#formats').innerHTML = FORMATS.map((f) => `
  <label><input type="radio" name="format" value="${f.id}"${f === state.format ? ' checked' : ''}>
  ${f.name} <small>${f.pdf ? f.note : `${f.w} × ${f.h}`}</small></label>`).join('');

$('#designs').innerHTML = DESIGNS.map((d) => `
  <label class="card"><input type="radio" name="design" value="${d.id}"${d === state.design ? ' checked' : ''}>
    <div class="frame busy" data-design="${d.id}"></div>
    <b>${d.name}</b><span>${d.blurb}</span>
  </label>`).join('');

// Previews and the chosen design's pages render separately, so picking a design
// never interrupts the previews still drawing.
let run = 0, pick = 0;
async function refresh() {
  const id = ++run, f = state.format;
  document.documentElement.style.setProperty('--ar', `${f.w} / ${f.h}`);
  // The chosen design first, so its preview and file are ready soonest.
  const order = [state.design, ...DESIGNS.filter((d) => d !== state.design)];
  const frames = new Map([...document.querySelectorAll('.frame')].map((el) => [el.dataset.design, el]));
  frames.forEach((el) => { el.classList.add('busy'); el.replaceChildren(); });
  select();
  for (const d of order) {
    const c = await canvasFor(d, f, pagesOf(f)[0]);
    if (id !== run) return;
    // A canvas can only live in one place; previews get a copy.
    const copy = document.createElement('canvas');
    copy.width = c.width; copy.height = c.height;
    copy.getContext('2d').drawImage(c, 0, 0);
    show(frames.get(d.id), copy);
  }
}

function select() {
  const id = ++pick;
  renderPages(id);
  prepare(id);
}

// For the PDF, a strip of every page of the chosen design.
async function renderPages(id) {
  const box = $('#pages'), f = state.format, d = state.design;
  box.hidden = !f.pdf;
  if (!f.pdf) return box.replaceChildren();
  const pages = pagesOf(f);
  box.innerHTML = pages.map((p) => `<figure><div class="frame busy"></div><figcaption>${p === 'cover' ? 'Cover' : invite.events[p].title}</figcaption></figure>`).join('');
  const frames = box.querySelectorAll('.frame');
  for (const [i, p] of pages.entries()) {
    const c = await canvasFor(d, f, p);
    if (id !== pick) return;
    const copy = document.createElement('canvas');
    copy.width = c.width; copy.height = c.height;
    copy.getContext('2d').drawImage(c, 0, 0);
    show(frames[i], copy);
  }
}

// Builds the file ahead of time: sharing must start straight from the tap.
let prepared = null;
function prepare(id) {
  const { design: d, format: f } = state;
  const p = Promise.all(pagesOf(f).map((pg) => canvasFor(d, f, pg)))
    .then((canvases) => exportFile(d, f, canvases));
  prepared = { id, p, file: null };
  p.then((file) => { if (prepared?.id === id) { prepared.file = file; updateShare(file); } });
  return prepared;
}

// Share is the main action wherever the browser can share files (most phones); elsewhere
// it is hidden and Download leads. Checked first with a stand-in, then with the real file,
// since some browsers share images but not PDFs.
const canShareFiles = (file) => {
  try { return !!navigator.share && !!navigator.canShare && navigator.canShare({ files: [file] }); } catch { return false; }
};
function setShare(can) {
  $('#share').hidden = !can;
  $('#download').className = can ? 'secondary' : 'primary';
}
function updateShare(file) { setShare(canShareFiles(file)); }
setShare(canShareFiles(new File([new Uint8Array([0xff, 0xd8, 0xff])], 'invite.jpg', { type: 'image/jpeg' })));

$('#formats').addEventListener('change', (e) => {
  state.format = FORMATS.find((f) => f.id === e.target.value);
  refresh();
});
$('#designs').addEventListener('change', (e) => {
  state.design = DESIGNS.find((d) => d.id === e.target.value);
  select();
});

async function current() {
  const p = prepared ?? prepare(pick);
  return p.file ?? p.p;
}

$('#download').addEventListener('click', async () => {
  const b = $('#download');
  b.disabled = true;
  status('Preparing your file…');
  try {
    const file = await current();
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    status(`Saved ${file.name}`);
  } catch (err) {
    status('Sorry, that did not save. Please try again.');
    console.error(err);
  } finally {
    b.disabled = false;
  }
});

$('#share').addEventListener('click', async () => {
  // Use the ready file if there is one, so the share sheet opens within the tap.
  const file = prepared?.file ?? await current();
  try {
    await navigator.share({ files: [file], title: couple(), text: `${couple()} · ${dateSpan()}` });
    status('Shared');
  } catch (err) {
    if (err?.name !== 'AbortError') { status('Sharing is not available here. Use Download instead.'); console.error(err); }
  }
});

// Test and automation hook: render any design, format and page to a data URL or file.
window.shareInvite = { DESIGNS, FORMATS, pagesOf, renderPage, exportFile, invite };

refresh();
