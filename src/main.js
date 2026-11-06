import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/jost/index.css';
import '@fontsource/imperial-script/400.css';
import './style.css';
import gsap from 'gsap';
import { invite } from './config.js';
import { renderStory, startCountdown, icsFile } from './ui/story.js';
import { Music } from './audio.js';
import { clamp, damp } from './world/kit.js';

const $ = (s, r = document) => r.querySelector(s);
const html = document.documentElement;
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const audio = new Music(invite.music);

const story = $('#story');
renderStory(story);
startCountdown(story);
document.title = `${invite.couple.first} & ${invite.couple.second}`;

const chapters = [...document.querySelectorAll('.chapter')];

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
  chapters.forEach((c, k) => c.classList.toggle('on', k === i));
  document.querySelectorAll('#dots button').forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
  html.dataset.chapter = chapters[i].dataset.themeEvent ?? chapters[i].id;
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
soundBtn.addEventListener('click', () => {
  audio.unlock();
  const on = audio.toggle();
  soundBtn.setAttribute('aria-pressed', String(on));
  soundBtn.setAttribute('aria-label', on ? 'Mute music' : 'Play music');
  if (on) audio.startMusic();
});

function unlockScroll() {
  html.classList.remove('locked');
  $('#chrome').classList.add('in');
  setActive(Math.round(scrollChapter()));
}

function showPlainInvite() {
  html.classList.add('no-gl');
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

async function loadArt() {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = 'art/card.webp';
  });
}

async function boot() {
  if (!webglOK()) return showPlainInvite();
  const bar = $('#loader .fill');
  const onStep = (k) => { bar.style.transform = `scaleX(${k})`; };

  await Promise.all([
    document.fonts.load('italic 300 100px "Fraunces Variable"'),
    document.fonts.load('100px "Imperial Script"'),
    document.fonts.load('500 30px "Jost Variable"'),
  ]).catch(() => {});

  const [{ World }, { createIntro }, art] = await Promise.all([import('./world/world.js'), import('./world/intro.js'), loadArt()]);

  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || innerWidth < 760;
  const high = params.has('low') ? false : !mobile;
  const world = new World($('#gl'), invite.events, { high });
  world.cardArt = art;
  await world.build(onStep);

  addEventListener('resize', () => world.resize());
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
  let last = performance.now(), t = 0;
  let target = 0;
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    if (!html.classList.contains('locked')) {
      target = scrollChapter();
      setActive(clamp(Math.round(target), 0, chapters.length - 1));
    }
    world.s = reduced ? target : damp(world.s, target, 5.5, dt);
    world.frame(dt, t);
  };
  gsap.ticker.add(() => loop(performance.now()));
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
    audio.unlock();
    audio.startMusic();
    introEl.classList.add('started');
    intro.start();
  });
  $('#skip').addEventListener('click', () => {
    audio.unlock();
    audio.startMusic();
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
