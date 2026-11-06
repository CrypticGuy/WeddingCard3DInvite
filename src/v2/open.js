// The opening without the dog: same interface as src/world/intro.js. There is no
// knot to pull, so the envelope sits centred with a gold seal on its flap. One tap
// turns it over in the air, the flap lifts and the card comes out to the reader.
import gsap from 'gsap';
import * as THREE from 'three';
import { soft } from '../world/kit.js';

export function createOpening(world, { onReveal, onHeroIn, onDone }) {
  const { env, thread, intro } = world;
  world.introDrivesDog = true;

  // The bow, band and thread belong to the dog's tug.
  env.bow.visible = false;
  env.wraps.visible = false;
  thread.mesh.visible = false;
  thread.hasA = thread.hasB = false;

  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.035, 28), soft({ color: '#c9a25a', roughness: 0.45, metalness: 0.25 }));
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0, -1.2, 0.03);
  env.flap.add(seal);

  // Centred on the envelope, close enough to fill a phone. Portrait needs more distance.
  const portrait = world.aspect < 0.9;
  intro.camX = -0.62;
  intro.camPush = portrait ? 2.7 : 1.4;

  const lift = env.lean.position, turn = env.body.rotation;
  const tl = gsap.timeline({ paused: true });

  // Up off the grass and over, landing back where it started.
  tl.to(lift, { y: 0.42, duration: 0.55, ease: 'power2.out' }, 0);
  tl.to(turn, { y: Math.PI * 2, duration: 1.25, ease: 'power2.inOut' }, 0.05);
  tl.to(lift, { y: 0, duration: 0.5, ease: 'power2.in' }, 0.8);
  tl.to(env.lean.rotation, { x: -0.05, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 1.28);

  // Flap lifts, the card rises.
  tl.to(env.flap.rotation, { x: -Math.PI * 0.94, duration: 1.0, ease: 'power2.inOut' }, 1.4);
  tl.to(intro, { camPush: portrait ? 1.5 : 0.6, duration: 1.4, ease: 'sine.inOut' }, 1.4);
  tl.to(env.card.position, { y: 2.05, duration: 1.05, ease: 'power2.inOut' }, 2.1);
  tl.call(() => {
    world.scene.updateMatrixWorld(true);
    const o = env.body.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.1, 0.3));
    world.burst.fire(o, 160, 3.6);
  }, null, 2.6);

  // Card flies to the reader.
  tl.call(() => {
    world.detachCard();
    let order = 50;
    env.card.traverse((o) => {
      if (!o.material) return;
      o.material.depthTest = false;
      o.renderOrder = order++;
    });
  }, null, 3.15);
  tl.to(intro, { cardFly: 1, duration: 1.25, ease: 'power3.inOut' }, 3.16);
  tl.to(intro, { blur: 3.4, duration: 1, ease: 'sine.out' }, 3.3);
  tl.to(env.reveal, { value: 1, duration: 2.1, ease: 'sine.inOut' }, 4.1);
  tl.call(onReveal, null, 4.1);

  // The pull back: the meadow turns out to be a planet.
  const out = 9.0;
  tl.to(intro, { cardExit: 1, duration: 1.0, ease: 'power3.in' }, out);
  tl.to(world, { introBlend: 1, duration: 4.2, ease: 'sine.inOut' }, out + 0.25);
  tl.to(env.group.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.9, ease: 'back.in(1.6)' }, out + 1.0);
  tl.call(onHeroIn, null, out + 2.1);
  tl.call(() => { world.introDrivesDog = false; world.introBlend = 1; onDone(); }, null, out + 4.5);

  let running = false;
  return {
    tl,
    start() {
      if (running) return;
      running = true;
      tl.play();
    },
    advance() {
      if (tl.time() > 5 && tl.time() < out) tl.seek(out, false);
    },
    skip() {
      running = true;
      tl.seek(tl.duration(), false);
      tl.pause();
      env.group.visible = false;
      if (!world.cardFree) env.card.visible = false;
    },
    get running() { return running; },
  };
}
