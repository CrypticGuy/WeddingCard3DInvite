// Plays the recording named in config.js, looped. The file has its fades baked in,
// because iPhones ignore volume changes made from a web page.
export class Music {
  constructor(src = '') {
    this.on = true;
    this.started = false;
    this.el = null;
    if (!src) return;
    this.el = Object.assign(new window.Audio(src), { loop: true, preload: 'metadata' });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.el.pause();
      else if (this.on && this.started) this.play();
    });
  }

  play() {
    this.el?.play().catch(() => { this.started = false; });
  }

  // Must be called from a tap, or the browser will refuse to play.
  start() {
    if (!this.el || !this.on) return;
    this.started = true;
    this.play();
  }

  toggle() {
    this.on = !this.on;
    if (this.on) this.start();
    else this.el?.pause();
    return this.on;
  }
}
