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
  }

  // Where the painted dog stands on screen, in CSS pixels.
  setSpot(x, foot, w, h, H) {
    this.spot = { x, foot, w, h, H };
  }

  pose(name) {
    const close = !['intro', 'hero', 'finale'].includes(name);
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

  // Jumps the story position without the dog reacting to the leap.
  teleport(s) {
    this.s = s;
    this.theta = this.prevTheta = this.thetaAt(s);
    this.speed = 0;
  }

  frame(dt, t) {
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
