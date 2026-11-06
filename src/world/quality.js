// Keeps frame rate steady without the viewer noticing. The rules exist because the
// earlier version caused the glitches it was meant to prevent:
//  - changes happen only mid-transition, while the whole scene is moving;
//  - plant density goes first, since it costs nothing to change;
//  - resolution never drops below one device pixel per CSS pixel;
//  - a step that did not help is undone, and quality comes back when there is room.
const STEPS = [
  { density: 1, scale: 1 },
  { density: 0.6, scale: 1 },
  { density: 0.35, scale: 1 },
  { density: 0.35, scale: 0.8 },
  { density: 0.25, scale: 0.8, shadows: false },
];
const MIN_RATIO = 1;    // device pixels per CSS pixel, never lower

export class Quality {
  constructor(world) {
    this.world = world;
    // A 30fps tier is allowed its 33ms; everyone else should hold about 42fps or better.
    this.slowMs = Math.max(24, world.p.frameMs * 1.45);
    this.fastMs = Math.max(15, world.p.frameMs * 1.15);
    this.level = 0;
    this.ms = 16;
    this.slowFor = 0;
    this.fastFor = 0;
    this.cool = 4;            // seconds before any decision
    this.backoff = 30;
    this.trial = null;        // measuring whether the last step helped
    this.history = [];
  }

  apply(level, reason) {
    const w = this.world, s = STEPS[level];
    this.level = level;
    w.nearFlora.traverse((o) => { if (o.isInstancedMesh) o.count = Math.floor(o.userData.full * s.density); });
    const native = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.max(s.scale, Math.min(1, MIN_RATIO / native));
    if (scale !== w.pixelRatio) { w.pixelRatio = scale; w.resize(); }
    if (s.shadows === false && w.p.shadows) { w.p = { ...w.p, shadows: false }; w.sun.castShadow = false; }
    this.history.push({ at: Math.round(performance.now() / 1000), level, reason, ms: +this.ms.toFixed(1) });
  }

  update(dt, s) {
    const ms = dt * 1000;
    this.ms += (ms - this.ms) * 0.05;
    this.cool -= dt;
    if (this.cool > 0) return;
    this.slowFor = this.ms > this.slowMs ? this.slowFor + dt : 0;
    this.fastFor = this.ms < this.fastMs ? this.fastFor + dt : 0;

    // Judge the last step once its effect has settled.
    if (this.trial && (this.trial.left -= dt) <= 0) {
      const helped = this.ms < this.trial.before * 0.9;
      const from = this.trial.from;
      this.trial = null;
      if (!helped && STEPS[this.level].scale !== STEPS[from].scale) {
        this.pending = { level: from, reason: 'no gain, undone' };
        this.locked = true;
      }
    }

    const moving = this.world.quiet || Math.abs(s - Math.round(s)) > 0.12;
    if (!moving) return;

    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      this.apply(p.level, p.reason);
      this.cool = 6;
      return;
    }
    if (this.slowFor > 3 && this.level < STEPS.length - 1 && !this.locked) {
      this.trial = { before: this.ms, from: this.level, left: 5 };
      this.apply(this.level + 1, 'slow');
      this.slowFor = 0;
      this.cool = 6;
    } else if (this.fastFor > this.backoff && this.level > 0) {
      this.apply(this.level - 1, 'headroom');
      this.fastFor = 0;
      this.backoff = Math.min(this.backoff * 2, 240);
      this.cool = 6;
    }
  }
}
