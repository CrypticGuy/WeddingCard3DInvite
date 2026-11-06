import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/jost/index.css';
import '@fontsource/imperial-script/400.css';
import './style.css';
import gsap from 'gsap';
import { invite } from '../config.js';
import { startCountdown, icsFile, dateOf, part } from '../ui/story.js';
import { Music } from '../audio.js';
import { clamp, damp, sstep } from '../world/kit.js';
import { renderStory } from './story.js';
import { Stage, REST } from './stage.js';
import { PaintedDog } from './dog.js';
import { ART, artTier, musicSrc } from './tier.js';

const $ = (s, r = document) => r.querySelector(s);
const html = document.documentElement;
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || innerWidth < 760;
// A page can opt out of the beagle: <html data-variant="nodog">.
const withDog = html.dataset.variant !== 'nodog';
const tier = artTier(params);
const audio = new Music(musicSrc(tier));

$('#versions').hidden = !params.has('review');

const story = $('#story');
renderStory(story, withDog);
startCountdown(story);
document.title = `${invite.couple.first} & ${invite.couple.second}`;

const events = invite.events;
const eventEls = [...document.querySelectorAll('.event')];
const heroEl = $('.hero'), finaleEl = $('.finale'), outroEl = $('.gap.outro');
const stage = new Stage($('#stage'), events, { lite: tier === 'lite', reduced, fewer: mobile });
const dog = new PaintedDog($('#dog'), { reduced });
if (withDog) dog.strip.src = `${ART}${tier === 'lite' ? 'dog-lite' : 'dog'}.webp`;
const wipe = $('#wipe'), page = $('#page');

// Scroll map, in pixels from the top of the page.
let map = null;
function measure() {
  const vh = innerHeight;
  map = {
    vh,
    events: eventEls.map((n) => ({ top: n.offsetTop, h: n.offsetHeight })),
    outro: outroEl.offsetTop,
    finale: finaleEl.offsetTop,
  };
  map.start = map.events[0].top;
}

// Which part of the story a scroll position falls in.
function locate(y) {
  const { events: ev, start, outro, finale } = map;
  if (y < start) return { mode: 'dive', u: y / start };
  if (y >= outro) return { mode: 'outro', u: clamp((y - outro) / (finale - outro)) };
  let i = ev.length - 1;
  while (i > 0 && y < ev[i].top) i--;
  return { mode: 'paint', i, p: (y - ev[i].top) / ev[i].h };
}

// Chapter dots
const labels = ['Start', ...events.map((e) => e.title), 'See you there'];
$('#dots').innerHTML = labels.map((l, i) => `<button type="button" data-go="${i}" aria-label="${l}"><span>${l}</span></button>`).join('');
function chapterY(i) {
  if (i <= 0) return 0;
  if (i > events.length) return map.finale;
  const e = map.events[i - 1];
  return e.top + e.h * REST;
}
function goTo(i) {
  window.scrollTo({ top: chapterY(i), behavior: reduced ? 'auto' : 'smooth' });
}

let activeChapter = -1;
function setChapter(i, theme) {
  if (i === activeChapter) return;
  activeChapter = i;
  document.querySelectorAll('#dots button').forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
  html.dataset.chapter = theme;
}

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) goTo(Number(go.dataset.go));
  if (e.target.closest('#ics')) {
    const url = URL.createObjectURL(new Blob([icsFile()], { type: 'text/calendar' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${invite.couple.first}-${invite.couple.second}.ics`.toLowerCase() });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
});

const soundBtn = $('#sound');
soundBtn.hidden = !invite.music;
soundBtn.addEventListener('click', () => {
  const on = audio.toggle();
  soundBtn.setAttribute('aria-pressed', String(on));
  soundBtn.setAttribute('aria-label', on ? 'Mute music' : 'Play music');
});

function unlockScroll() {
  html.classList.remove('locked');
  $('#chrome').classList.add('in');
  measure();
}

function layout() {
  stage.resize();
  dog.resize(stage.W, stage.H);
  measure();
  world?.setSpot(dog.x, dog.foot, dog.w, dog.h, stage.H);
  bleed?.size(stage.W, stage.H, dog.x, stage.H - dog.foot);
  snapFor = -1;
}

// ── Petals that blow across during the dive: the wipe's leading edge.
const fly = $('#fly');
const flyers = [];
if (!reduced) {
  const n = mobile ? 9 : 16;
  for (let k = 0; k < n; k++) {
    const p = new Image();
    p.alt = '';
    p.dataset.src = `${ART}petals/p${[0, 3, 1, 4, 6, 7][k % 6]}.webp`;
    fly.append(p);
    flyers.push({ el: p, y: (k * 0.618) % 1, lag: (k * 0.381) % 1 * 0.45, size: 26 + ((k * 7) % 5) * 9, spin: 200 + ((k * 53) % 300) });
  }
}
function flyPetals(t) {
  const on = t > 0.02 && t < 0.98;
  fly.style.visibility = on ? 'visible' : 'hidden';
  if (!on) return;
  const { W, H } = stage;
  for (const f of flyers) {
    const k = clamp((t - f.lag * 0.7) / 0.55);
    const x = (1.15 - k * 1.4) * W;
    const y = (f.y * 0.8 + 0.05 + Math.sin(k * 5 + f.y * 9) * 0.05) * H;
    f.el.style.width = `${f.size}px`;
    f.el.style.opacity = sstep(0, 0.1, k) * (1 - sstep(0.88, 1, k));
    f.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${(k * f.spin).toFixed(0)}deg)`;
  }
}

// ── The page between paintings: a wash of bare paper crosses the screen.
let wipeOn = false, wipeShown = 0;
function runWipe(y) {
  const { vh, events: ev } = map;
  let w = -1, next = 0;
  const reach = vh * 0.8;
  for (let k = 1; k < ev.length; k++) {
    if (Math.abs(y - ev[k].top) < reach) {
      w = (y - (ev[k].top - reach)) / (reach * 2);
      next = k;
    }
  }
  const on = w >= 0;
  if (on !== wipeOn) {
    wipeOn = on;
    wipe.style.visibility = on ? 'visible' : 'hidden';
  }
  if (!on) {
    if (wipeShown) { page.style.opacity = 0; wipeShown = 0; dog.root.style.zIndex = ''; }
    return;
  }
  const { W } = stage;
  const B = W * 2.6;
  const x = W - w * (W + B);
  wipe.firstElementChild.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
  // Over the dog's spot the paper has passed, so he steps onto the page.
  dog.root.style.zIndex = x < dog.x - dog.w * 0.6 && x + B > dog.x + dog.w * 0.6 ? 14 : '';
  if (wipeShown !== next) {
    wipeShown = next;
    const e = events[next];
    page.firstElementChild.textContent = part(dateOf(e), { day: 'numeric', month: 'long' });
    page.lastElementChild.textContent = e.title;
  }
  page.style.opacity = sstep(0.36, 0.44, w) * (1 - sstep(0.56, 0.64, w));
}

// ── Cards rise when their painting is in view.
let cardOn = -1;
function setCard(i) {
  if (i === cardOn) return;
  cardOn = i;
  eventEls.forEach((n, k) => n.classList.toggle('on', k === i));
}

// ── Painted part of the story, shared by the 3D and no-3D paths.
let world = null, bleed = null;
let snapFor = -1;
let ySmooth = window.scrollY, vSmooth = 0, t = 0;

function paintFrame(loc) {
  const { i, p } = loc;
  stage.window(i);
  stage.show(i);
  stage.update(p);
  setCard(p > 0.17 && p < 0.62 ? i : -1);
  setChapter(i + 1, events[i].id);
}

function stepStory(dt) {
  const y = window.scrollY;
  const prev = ySmooth;
  // Going back is slower: the painting eases past at the pup's shuffling pace.
  ySmooth = reduced ? y : damp(ySmooth, y, y < ySmooth ? 1.9 : 6, dt);
  if (Math.abs(ySmooth - y) < 0.3) ySmooth = y;
  vSmooth = damp(vSmooth, (ySmooth - prev) / Math.max(dt, 0.001) / map.vh, 12, dt);
  const loc = locate(ySmooth);
  html.dataset.mode = loc.mode;
  runWipe(ySmooth);
  return loc;
}

function runPlain(dt) {
  t += dt;
  const loc = stepStory(dt);
  if (loc.mode === 'paint') paintFrame(loc);
  else {
    // Without 3D the first and last paintings stand in for the globe.
    const i = loc.mode === 'dive' ? 0 : events.length - 1;
    paintFrame({ i, p: loc.mode === 'dive' ? 0 : 1 });
    setCard(-1);
    setChapter(loc.mode === 'dive' ? 0 : events.length + 1, loc.mode === 'dive' ? 'top' : 'see-you');
  }
  dog.fade(1);
  dog.update(dt, t, vSmooth);
}

function showPlainInvite() {
  html.classList.add('no-gl');
  $('#loader').remove();
  $('#intro').remove();
  heroEl.classList.add('on');
  finaleEl.classList.add('on');
  layout();
  unlockScroll();
  stage.show(0);
  gsap.ticker.add((_, ms) => runPlain(Math.min(0.05, ms / 1000)));
}

function webglOK() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch { return false; }
}

const loadImage = (src) => new Promise((res) => {
  const i = new Image();
  i.onload = () => res(i);
  i.onerror = () => res(null);
  i.src = src;
});

async function boot() {
  layout();
  if (!webglOK() || params.has('nogl')) return showPlainInvite();
  const bar = $('#loader .fill');
  const onStep = (k) => { bar.style.transform = `scaleX(${k})`; };

  await Promise.all([
    document.fonts.load('italic 300 100px "Fraunces Variable"'),
    document.fonts.load('100px "Imperial Script"'),
    document.fonts.load('500 30px "Jost Variable"'),
  ]).catch(() => {});

  const [{ PaintedWorld }, { createIntro }, { Bleed }, THREE, art, noise] = await Promise.all([
    import('./world.js'), import('../world/intro.js'), import('./bleed.js'), import('three'),
    loadImage('../v1/art/card.webp'), loadImage(`${ART}noise.webp`),
  ]);

  const high = params.has('low') ? false : !mobile;
  world = new PaintedWorld($('#gl'), events, { high });
  world.cardArt = art;
  await world.build(onStep);
  if (!withDog) {
    world.dog.root.visible = false;
    world.thread.mesh.visible = false;
    world.hearts.pop = () => {};
  }
  const noiseTex = new THREE.Texture(noise);
  noiseTex.needsUpdate = true;
  bleed = new Bleed(world.renderer, noiseTex);
  world.bleed = bleed;
  layout();

  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    world.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });

  let introDone = false;
  const intro = createIntro(world, {
    onReveal: () => { $('#intro').classList.add('reading'); },
    onHeroIn: () => {
      $('#intro').classList.add('gone');
      heroEl.classList.add('on');
    },
    onDone: () => {
      introDone = true;
      unlockScroll();
      $('#intro').remove();
    },
  });

  // Start fetching the first painting while the opening plays.
  stage.load(0);
  for (const f of flyers) f.el.src = f.el.dataset.src;

  // The 3D world only runs while it can be seen.
  const shots = { first: { i: 0, p: 0 }, last: { i: events.length - 1, p: 1 } };
  function prepareBleed(which) {
    const key = which === 'first' ? 0 : 1;
    if (snapFor === key) return;
    const s = shots[which];
    const scene = stage.scenes[s.i];
    stage.load(s.i);
    if (!scene.decoded) return;
    snapFor = key;
    bleed.setPaint(stage.snapshot(s.i, s.p, Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2)));
  }

  const loop = (dt) => {
    t += dt;
    if (!introDone) {
      world.frame(dt, t);
      return;
    }
    const loc = stepStory(dt);
    let t3d = -1;
    if (loc.mode === 'dive') {
      prepareBleed('first');
      world.wake();
      // The camera arrives first, so the 3D dog is on its mark when the sprite takes over.
      const k = sstep(0.0, 0.5, loc.u);
      world.s = k;
      const b = clamp((loc.u - 0.5) / 0.5);
      world.bleedT = snapFor === 0 ? b : 0;
      world.bleedZoom = 1;
      t3d = world.bleedT;
      setChapter(0, 'top');
      setCard(-1);
    } else if (loc.mode === 'outro') {
      prepareBleed('last');
      if (world.asleep || world.s < 3.5) { world.wake(); world.teleport(4); }
      world.s = 4 + sstep(0.12, 1, loc.u);
      const b = 1 - clamp(loc.u / 0.72);
      world.bleedT = snapFor === 1 ? b : 0;
      world.bleedZoom = 1 - 0.5 * clamp(loc.u / 0.72);
      t3d = world.bleedT;
      setChapter(loc.u > 0.5 ? events.length + 1 : events.length, loc.u > 0.5 ? 'see-you' : 'wedding');
      setCard(-1);
    }

    if (t3d >= 1 || loc.mode === 'paint') {
      // Fully painted: the 3D world sleeps and the live scene takes over.
      const i = loc.mode === 'paint' ? loc.i : loc.mode === 'dive' ? 0 : events.length - 1;
      paintFrame(loc.mode === 'paint' ? loc : { i, p: loc.mode === 'dive' ? 0 : 1 });
      world.sleep();
      html.classList.add('painted');
      if (loc.mode !== 'paint') setCard(-1);
    } else {
      html.classList.remove('painted');
      stage.load(loc.mode === 'dive' ? 0 : events.length - 1);
      world.frame(dt, t);
    }

    const painted = t3d >= 1 || loc.mode === 'paint';
    const b = painted ? 1 : t3d;
    // In the finale the dog rides away on the receding sheet, then the 3D dog is back.
    const leaving = loc.mode === 'outro' && !painted;
    dog.fade(painted ? 1 : leaving ? clamp((b - 0.1) / 0.2) : clamp(b / 0.05));
    dog.shrink(leaving ? world.bleedZoom : 1, stage.W, stage.H);
    flyPetals(loc.mode === 'dive' ? t3d : 0);
    dog.update(dt, t, vSmooth);
    finaleEl.classList.toggle('on', loc.mode === 'outro' && loc.u > 0.86);
  };

  // Same pacing rules as V1: smoothed time, and every other frame on 120Hz screens.
  let smooth = 1 / 60, elapsed = 0, minGap = 0;
  const gaps = [];
  gsap.ticker.add((time, deltaMs) => {
    if (gaps.length < 60) {
      gaps.push(deltaMs);
      if (gaps.length === 60 && [...gaps].sort((a, b) => a - b)[30] < 10) minGap = 12;
    }
    elapsed += deltaMs;
    if (elapsed < minGap) return;
    smooth += (Math.min(0.05, elapsed / 1000) - smooth) * 0.2;
    elapsed = 0;
    loop(smooth);
  });
  gsap.ticker.lagSmoothing(0);

  $('#loader').classList.add('done');
  setTimeout(() => $('#loader')?.remove(), 1200);

  const introEl = $('#intro');
  introEl.classList.add('ready');
  $('#tap').addEventListener('click', () => {
    audio.start();
    introEl.classList.add('started');
    intro.start();
  });
  $('#skip').addEventListener('click', () => {
    audio.start();
    intro.skip();
  });
  introEl.addEventListener('click', (e) => {
    if (introEl.classList.contains('reading') && !e.target.closest('#skip')) intro.advance();
  });

  if (reduced || params.has('skip')) intro.skip();

  if (params.has('perf')) {
    const { startMonitor, estimateGpuBytes } = await import('../perf/monitor.js');
    startMonitor(world, {
      raf: true,
      extra() {
        const art = stage.decodedBytes();
        const est = estimateGpuBytes(world);
        const gl = world.asleep ? est.geometry + est.texture : est.total;
        return {
          mode: world.asleep ? 'paint' : '3d',
          gpuEstMB: +((gl + art) / 1048576).toFixed(1),
          artMB: +(art / 1048576).toFixed(1),
          ...(world.asleep ? { triangles: 0, calls: 0, gpuMs: null } : {}),
          note: `${world.asleep ? '3D asleep, painted scene' : '3D running'}   art ${(art / 1048576).toFixed(0)}MB`,
        };
      },
    });
  }

  if (import.meta.env.DEV) window.__invite = { world, intro, gsap, stage, dog, bleed };
}

addEventListener('resize', () => {
  world?.resize();
  layout();
});

boot().catch((err) => {
  console.error(err);
  if (!html.classList.contains('no-gl')) showPlainInvite();
});
