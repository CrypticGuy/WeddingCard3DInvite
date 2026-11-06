import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/jost/index.css';
import '@fontsource/imperial-script/400.css';
import './style.css';
import gsap from 'gsap';
import { invite } from './config.js';
import { renderStory, startCountdown, icsFile } from './ui/story.js';
import { Music } from './audio.js';
import { mountExtras } from './ui/extras.js';
import { detectDevice } from './device.js';
import { clamp, damp } from './world/kit.js';

const $ = (s, r = document) => r.querySelector(s);
const html = document.documentElement;
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const device = detectDevice(params);
const small = device.preset?.smallArt;
const audio = new Music(invite.music ? `${invite.music}${device.preset?.lowMusic ? '-lo' : ''}.mp3` : '');

// Reached from the versions page: offer the way back. Guests never see this.
$('#versions').hidden = !params.has('review');

const story = $('#story');
renderStory(story);
startCountdown(story);
document.title = `${invite.couple.first} & ${invite.couple.second}`;

const chapters = [...document.querySelectorAll('.chapter')];
const extras = mountExtras();

function chapterTop(i) { return chapters[clamp(i, 0, chapters.length - 1)].offsetTop; }
function scrollChapter() {
  const h = chapters[0].offsetHeight || innerHeight;
  return window.scrollY / h;
}
function goTo(i) {
  window.scrollTo({ top: chapterTop(i), behavior: reduced ? 'auto' : 'smooth' });
}

// Chapter activation drives the card entrances.
let active = -1;
function setActive(i) {
  if (i === active) return;
  active = i;
  loadArt(i);
  loadArt(i + 1);
  chapters.forEach((c, k) => c.classList.toggle('on', k === i));
  document.querySelectorAll('#dots button').forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
  html.dataset.chapter = chapters[i].dataset.themeEvent ?? chapters[i].id;
  // The hero has its own cue; every other chapter names the one below it.
  const below = invite.events[i];
  if (i === 0 || i >= chapters.length - 1) extras.setNext(null);
  else extras.setNext(i + 1, below ? `Next: ${below.title}` : invite.closingTitle);
}

// Card flowers load as their chapter comes up, at the size this device needs.
function loadArt(i) {
  const img = chapters[i]?.querySelector('img[data-art]');
  if (!img || img.src) return;
  img.src = `${img.dataset.art}${small ? '-s' : ''}.webp`;
}

function buildDots() {
  const nav = $('#dots');
  const labels = ['Start', ...invite.events.map((e) => e.title), 'See you there'];
  nav.innerHTML = labels.map((l, i) => `<button type="button" data-go="${i}" aria-label="${l}"><span>${l}</span></button>`).join('');
}
buildDots();

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
  setActive(Math.round(scrollChapter()));
}

function showPlainInvite() {
  html.classList.add('no-gl');
  chapters.forEach((c, i) => loadArt(i));
  $('#loader').remove();
  $('#intro').remove();
  unlockScroll();
  addEventListener('scroll', () => setActive(clamp(Math.round(scrollChapter()), 0, chapters.length - 1)), { passive: true });
}

function webglOK() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch { return false; }
}

async function loadCardImage() {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = `art/card${small ? '-s' : ''}.webp`;
  });
}

async function boot() {
  if (device.tier === 'plain' || !webglOK()) return showPlainInvite();
  const bar = $('#loader .fill');
  const onStep = (k) => { bar.style.transform = `scaleX(${k})`; };

  await Promise.all([
    document.fonts.load('italic 300 100px "Fraunces Variable"'),
    document.fonts.load('100px "Imperial Script"'),
    document.fonts.load('500 30px "Jost Variable"'),
  ]).catch(() => {});

  const [{ World }, { createIntro }, art] = await Promise.all([import('./world/world.js'), import('./world/intro.js'), loadCardImage()]);

  const world = new World($('#gl'), invite.events, device);
  world.cardArt = art;
  await world.build(onStep);

  addEventListener('resize', () => world.resize());
  if (params.has('perf')) import('./perf/monitor.js').then((m) => m.startMonitor(world));
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    world.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });

  const intro = createIntro(world, {
    onReveal: () => { $('#intro').classList.add('reading'); },
    onHeroIn: () => {
      $('#intro').classList.add('gone');
      setActive(0);
      chapters[0].classList.add('on');
    },
    onDone: () => {
      unlockScroll();
      $('#intro').remove();
    },
  });

  // Render loop
  let t = 0, smooth = 1 / 60;
  let target = 0;
  const loop = (rawMs) => {
    // Smoothed, so one late frame cannot jolt the camera or the planet.
    smooth += (Math.min(0.05, rawMs / 1000) - smooth) * 0.2;
    const dt = smooth;
    t += dt;
    if (!html.classList.contains('locked')) {
      target = scrollChapter();
      setActive(clamp(Math.round(target), 0, chapters.length - 1));
    }
    // Going back is slower: the planet eases round at the pup's shuffling pace.
    world.s = reduced ? target : damp(world.s, target, target < world.s ? 1.7 : 5.5, dt);
    world.frame(dt, t);
  };
  // 120Hz screens draw every other frame: same smoothness here, half the heat.
  let elapsed = 0, minGap = device.preset.frameMs;
  const gaps = [];
  gsap.ticker.add((time, deltaMs) => {
    if (gaps.length < 60) {
      gaps.push(deltaMs);
      // The median ignores the slow frames that happen while the page settles.
      if (gaps.length === 60 && [...gaps].sort((a, b) => a - b)[30] < 10) minGap = Math.max(minGap, 12);
    }
    elapsed += deltaMs;
    if (elapsed < minGap) return;
    loop(elapsed);
    elapsed = 0;
  });
  gsap.ticker.lagSmoothing(0);

  // Tap the pup for hearts
  let downAt = null;
  addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; }, { passive: true });
  addEventListener('pointerup', (e) => {
    if (!downAt || html.classList.contains('locked')) return;
    if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 12) return;
    if (e.target.closest('.card, button, a')) return;
    const p = world.dogScreenPos();
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < Math.max(70, 110 * (1 - world.wide))) {
      world.petTheDog();
    }
  }, { passive: true });

  $('#loader').classList.add('done');
  setTimeout(() => $('#loader')?.remove(), 1200);

  const introEl = $('#intro');
  introEl.classList.add('ready');
  $('#tap').addEventListener('click', () => {
    world.quiet = false;
    audio.start();
    introEl.classList.add('started');
    intro.start();
  });
  $('#skip').addEventListener('click', () => {
    world.quiet = false;
    audio.start();
    intro.skip();
  });
  introEl.addEventListener('click', (e) => {
    if (introEl.classList.contains('reading') && !e.target.closest('#skip')) intro.advance();
  });

  if (reduced || params.has('skip')) intro.skip();

  // Test hook for the screenshot tooling. Stripped from production builds.
  if (import.meta.env.DEV) window.__invite = { world, intro, gsap };
}

boot().catch((err) => {
  console.error(err);
  showPlainInvite();
});
