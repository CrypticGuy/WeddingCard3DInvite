// The painted beagle. Frames are baked from the real 3D model in src/world/beagle.js
// (see scripts/v2-art/), so it is the same dog at runtime with no 3D cost.
//
// Scrolling back: the couple's request. The dog never turns round and the sprite is
// never mirrored. It keeps facing forward and shuffles backward in slow, uneven
// steps with its head low, like updateDog in src/world/world.js.
import { sstep } from '../world/kit.js';
import meta from './dog.json';

const TAU = Math.PI * 2;
const STILL_AFTER = 0.35;     // seconds without movement before it sits
const FWD = 0.02, BACK = -0.012;

export class PaintedDog {
  constructor(root, { reduced }) {
    this.root = root;
    this.frameBox = root.querySelector('.frame');
    this.strip = root.querySelector('img');
    this.reduced = reduced;
    this.state = 'idle';
    this.f = 0;
    this.still = 1;
    this.w = 0;
    this.h = 0;
    this.shown = -1;
    this.dip = 0;
  }

  // Placement is shared with the 3D camera, so the two dogs line up during the bleed.
  resize(W, H) {
    const portrait = W / H < 0.9;
    this.h = Math.round(Math.min(Math.max(H * (portrait ? 0.128 : 0.15), 84), 168));
    this.w = Math.round((this.h * meta.fw) / meta.fh);
    this.x = Math.round((portrait ? 0.2 : 0.13) * W);
    this.foot = Math.round(H * (portrait ? 0.075 : 0.07));
    this.frameBox.style.width = `${this.w}px`;
    this.frameBox.style.height = `${this.h}px`;
    const rows = Math.ceil((meta.strips.idle.start + meta.strips.idle.n) / meta.cols);
    this.strip.style.width = `${this.w * meta.cols}px`;
    this.strip.style.height = `${this.h * rows}px`;
    this.root.style.left = `${this.x - this.w / 2}px`;
    this.root.style.top = `${H - this.foot - this.h}px`;
    this.root.style.width = `${this.w}px`;
    this.root.style.height = `${this.h}px`;
    this.shown = -1;
  }

  draw(strip, k) {
    const s = meta.strips[strip], i = s.start + (Math.floor(k) % s.n + s.n) % s.n;
    if (i === this.shown) return;
    this.shown = i;
    const col = i % meta.cols, row = (i / meta.cols) | 0;
    this.strip.style.transform = `translate3d(${-col * this.w}px,${-row * this.h}px,0)`;
  }

  // v: scroll speed in screen heights per second, after smoothing.
  update(dt, t, v) {
    const forward = v > FWD, backward = v < BACK;
    this.still = forward || backward ? 0 : this.still + dt;
    const fps = (rate) => { this.f += rate * dt; };
    const n = meta.strips.settle.n;

    switch (this.state) {
      case 'idle':
        if (forward || backward) { this.state = 'rise'; this.f = n - 1; break; }
        fps(9);
        this.draw('idle', this.f);
        break;
      case 'settle':
        if (forward || backward) { this.state = 'rise'; this.f = n - 1 - this.f; break; }
        fps(13);
        if (this.f >= n - 1) { this.state = 'idle'; this.f = 0; }
        else this.draw('settle', this.f);
        break;
      case 'rise':
        fps(-20);
        if (this.f <= 0) { this.state = backward ? 'back' : 'walk'; this.f = 0; }
        else this.draw('settle', this.f);
        break;
      case 'walk':
        if (backward) { this.state = 'back'; break; }
        if (this.still > STILL_AFTER) { this.state = 'settle'; this.f = 0; break; }
        // Feet keep pace with the ground, within what still reads as a trot.
        fps(Math.min(26, Math.max(9, Math.abs(v) * 42)) * (meta.strips.walk.n / 12));
        this.draw('walk', this.f);
        break;
      case 'back': {
        if (forward) { this.state = 'walk'; break; }
        if (this.still > STILL_AFTER * 1.6) { this.state = 'settle'; this.f = 0; break; }
        // V1's reverse gait: 2.4 to 5.4 radians a second, pulsing, so it hesitates.
        const gait = 2.4 + 3 * (0.5 + 0.5 * Math.sin(t * 2.3));
        fps((gait / TAU) * meta.strips.back.n);
        this.draw('back', this.f);
        break;
      }
      default:
    }
    const low = this.state === 'back' ? 1 : 0;
    this.dip += (low - this.dip) * Math.min(1, dt * 6);
    if (this.state !== this.shownState) this.root.dataset.state = this.shownState = this.state;
    // Weight shifts with each hesitant step; never a flip, only a small nudge.
    if (this.reduced) return;
    const nudge = this.state === 'back' ? Math.sin(t * 2.3) * this.h * 0.012 : 0;
    this.frameBox.style.transform = `translate3d(${nudge.toFixed(1)}px,${(this.dip * this.h * 0.02).toFixed(1)}px,0)`;
  }

  // Scales with the painting about the middle of the screen.
  shrink(z, W, H) {
    if (z === this.z) return;
    this.z = z;
    const r = this.root;
    r.style.transformOrigin = `${W / 2 - (this.x - this.w / 2)}px ${H / 2 - (H - this.foot - this.h)}px`;
    r.style.transform = z === 1 ? '' : `scale(${z.toFixed(3)})`;
  }

  fade(k) {
    const o = sstep(0, 1, k);
    if (o === this.o) return;
    this.o = o;
    this.root.style.opacity = o;
    this.root.style.visibility = o < 0.01 ? 'hidden' : 'visible';
  }
}
