// V1's world with three additions for the storybook, all kept out of V1's files:
//  - the close shot frames the dog exactly where the painted sprite stands,
//  - a Bleed pass draws over the finished 3D frame,
//  - sleep() stops work and hands back GPU memory while paintings are showing.
import { World } from '../world/world.js';
import { R } from '../world/planet.js';
import meta from './dog.json';

const TAN = Math.tan((15 * Math.PI) / 180);

export class PaintedWorld extends World {
  constructor(canvas, events, opts) {
    super(canvas, events, opts);
    this.asleep = false;
    this.spot = { x: 0, foot: 0, w: 120, h: 100, H: 800 };
    this.bleed = null;
    this.bleedT = 0;
    this.bleedZoom = 1;
    this.spin = { az: 0, el: 0, vaz: 0, vel: 0, held: false };
  }

  // Phones: after the opening the shadow pass, which redraws every triangle, runs one
  // frame in three. Resolution and plant density are src/device.js's job.
  thinShadows() {
    const map = this.renderer.shadowMap, world = this;
    let wanted = false, tick = 0;
    Object.defineProperty(map, 'needsUpdate', {
      configurable: true,
      get() { return wanted; },
      set(v) { wanted = v && (!world.introOver || tick++ % 3 === 0); },
    });
  }

  // Where the painted dog stands on screen, in CSS pixels.
  setSpot(x, foot, w, h, H) {
    this.spot = { x, foot, w, h, H };
  }

  pose(name) {
    if (name === 'finale') return this.spunPose(super.pose(name));
    const close = !['intro', 'hero'].includes(name);
    if (!close) return super.pose(name);
    const { x, foot, h, w, H } = this.spot;
    // Same view direction as the sprite bake, at the distance that makes the sizes match.
    const dist = (meta.worldHeight * H) / (h * 2 * TAN);
    // Aimed at the dog's paws. The view offset then slides the picture so they land
    // on the sprite's paws: same place, same size, same angle.
    const tgt = [-0.75, R, 0];
    const X = x - w / 2 + meta.rootX * w;
    const Y = H - foot - meta.footLift * h;
    return {
      pos: [tgt[0] + 0.07 * dist, tgt[1] + 0.13 * dist, tgt[2] + dist], tgt,
      sx: 0.5 - X / (this.w || 1), sy: 0.5 - Y / (this.h || H), wide: 0, blur: 0,
    };
  }

  // The reader's drag orbits the view, which looks like turning the globe in the hand
  // and keeps the dog, sky and lighting consistent. No spin gives V1's pose exactly.
  spunPose(base) {
    const { az, el } = this.spin;
    if (!az && !el) return base;
    const [x, y, z] = base.pos, r = Math.hypot(x, y, z);
    const a = Math.atan2(x, z) + az;
    const e = Math.max(-1.2, Math.min(1.2, Math.asin(y / r) + el));
    return { ...base, pos: [Math.sin(a) * Math.cos(e) * r, Math.sin(e) * r, Math.cos(a) * Math.cos(e) * r] };
  }

  // dx, dy: radians from a drag, or a flick's speed when `flick` is set.
  turn(dx, dy) {
    this.spin.az += dx;
    this.spin.el = Math.max(-1.1, Math.min(0.9, this.spin.el + dy));
  }

  stepSpin(dt) {
    const p = this.spin;
    if (this.s < 4.96) {
      // Leaving the finale: settle back, so the pull-out always retraces itself.
      p.vaz = p.vel = 0;
      const k = Math.exp(-5 * dt);
      p.az = Math.abs(p.az) < 0.002 ? 0 : (((p.az + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * k;
      p.el = Math.abs(p.el) < 0.002 ? 0 : p.el * k;
      return;
    }
    if (p.held) return;
    this.turn(p.vaz * dt, p.vel * dt);
    const k = Math.exp(-2.2 * dt);
    p.vaz *= k;
    p.vel *= k;
  }

  // Jumps the story position without the dog reacting to the leap.
  teleport(s) {
    this.s = s;
    this.theta = this.prevTheta = this.thetaAt(s);
    this.speed = 0;
  }

  frame(dt, t) {
    this.stepSpin(dt);
    super.frame(dt, t);
    this.bleed?.render(this.bleedT, this.bleedZoom);
  }

  sleep() {
    if (this.asleep) return;
    this.asleep = true;
    this.canvas.style.visibility = 'hidden';
    // The drawing buffers are the biggest GPU allocation on a phone: shrink them away.
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(2, 2, false);
    if (this.composer) { this.composer.setPixelRatio(1); this.composer.setSize(2, 2); }
    const sh = this.sun.shadow;
    sh.map?.dispose();
    sh.map = null;
  }

  wake() {
    if (!this.asleep) return;
    this.asleep = false;
    this.canvas.style.visibility = '';
    this.w = 0;
    this.resize();
    this.renderer.shadowMap.needsUpdate = true;
  }

  resize() {
    if (!this.asleep) super.resize();
  }
}
