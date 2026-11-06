import gsap from 'gsap';
import * as THREE from 'three';
import { R } from './planet.js';

// The opening shot, start to finish. Times are in seconds from the first tap.
export function createIntro(world, { onReveal, onHeroIn, onDone }) {
  const { dog, env, thread, intro } = world;
  world.introDrivesDog = true;
  dog.sit = 1; dog.wag = 0.9; dog.pant = 1;
  dog.lookYaw = -0.25;

  const tl = gsap.timeline({ paused: true });
  const P = (s, vars, at) => tl.to(dog, { duration: 0.3, ease: 'power2.out', ...vars }, at);
  const walkBack = (to, dur, at) => {
    tl.to(intro, { psi: to, duration: dur, ease: 'power1.inOut' }, at);
    tl.to(dog, { walk: 1, gait: -15, duration: 0.15 }, at);
    tl.to(dog, { walk: 0, gait: 0, duration: 0.2 }, at + dur - 0.1);
  };
  const tug = (at, power, wobble) => {
    tl.to(dog, { shake: 1, duration: 0.08 }, at);
    tl.to(dog, { shake: 0, duration: 0.2 }, at + 0.34);
    tl.to(dog, { lean: 1.25, duration: 0.14, ease: 'power2.out' }, at);
    tl.to(env.lean.rotation, { z: wobble, duration: 0.09, yoyo: true, repeat: 3, ease: 'sine.inOut' }, at);
    tl.to(env.bow.scale, { x: 1 - power * 0.5, y: 1 + power * 0.25, duration: 0.12, ease: 'back.out(3)' }, at);
  };

  // Stand up, turn, take the thread.
  P(0, { sit: 0, pant: 0.2, wag: 0.5, duration: 0.4 }, 0);
  tl.to(intro, { heading: -Math.PI, duration: 0.5, ease: 'power2.inOut' }, 0.1);
  P(0, { lookYaw: 0, duration: 0.4 }, 0.1);
  // The camera drifts with the pup so both ends of the thread stay in frame.
  tl.to(intro, { camPush: 0.7, camX: 0.8, duration: 3.0, ease: 'sine.inOut' }, 0.2);
  P(0, { crouch: 0.9, lookPitch: -0.62, duration: 0.3 }, 0.62);
  tl.call(() => { thread.hasB = true; }, null, 0.92);
  P(0, { crouch: 0.15, lookPitch: 0.04, duration: 0.3, wag: 0.95 }, 1.0);

  // Three tugs. The third one wins.
  walkBack(0.215, 0.75, 1.05);
  tug(1.82, 0.32, 0.03);
  tl.to(dog, { lean: 0.4, duration: 0.3 }, 2.2);
  walkBack(0.26, 0.42, 2.25);
  tug(2.72, 0.55, 0.05);
  tl.to(dog, { lean: 0.3, duration: 0.25 }, 3.1);
  walkBack(0.3, 0.32, 3.15);
  tug(3.52, 0.8, 0.075);

  // Pop.
  tl.call(() => {
    thread.hasA = false;
    world.scene.updateMatrixWorld(true);
    world.burst.fire(env.knotAnchor.getWorldPosition(new THREE.Vector3()), 70, 2.2);
  }, null, 3.92);
  tl.to(env.bow.scale, { x: 0, y: 0, z: 0, duration: 0.2, ease: 'back.in(2)' }, 3.9);
  tl.to(env.wraps.scale, { x: 0, duration: 0.3, ease: 'power3.in' }, 3.92);
  tl.to(env.vert.scale, { y: 0, duration: 0.3, ease: 'power3.in' }, 3.92);
  tl.set(env.wraps, { visible: false }, 4.25);
  // The pup goes tumbling back a step, delighted.
  tl.to(intro, { psi: 0.345, duration: 0.3, ease: 'power3.out' }, 3.92);
  tl.to(dog, { hop: 0.2, lean: 1.8, duration: 0.14, ease: 'power2.out' }, 3.92);
  tl.to(dog, { hop: 0, lean: 0, duration: 0.3, ease: 'bounce.out' }, 4.08);
  tl.call(() => { thread.hasB = false; }, null, 4.4);
  // Thread dropped, the pup trots back and sits by the envelope to watch.
  tl.to(intro, { psi: 0.15, duration: 0.8, ease: 'power1.inOut' }, 4.42);
  tl.to(dog, { walk: 1, gait: 15, pant: 1, wag: 1, duration: 0.15 }, 4.42);
  tl.to(dog, { walk: 0, gait: 0, duration: 0.2 }, 5.12);
  tl.to(intro, { heading: -2.3, duration: 0.45, ease: 'power2.inOut' }, 5.1);
  P(0, { sit: 1, lookPitch: 0.3, lookYaw: 0.1, duration: 0.45 }, 5.18);

  // Flap lifts, the card rises.
  tl.to(env.flap.rotation, { x: -Math.PI * 0.94, duration: 1.05, ease: 'power2.inOut' }, 4.3);
  tl.to(intro, { camX: 0.1, camPush: 0.6, duration: 1.4, ease: 'sine.inOut' }, 4.4);
  tl.to(env.card.position, { y: 2.05, duration: 1.1, ease: 'power2.inOut' }, 5.05);
  tl.call(() => {
    world.scene.updateMatrixWorld(true);
    const o = env.body.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.1, 0.3));
    world.burst.fire(o, 200, 4.4);
    world.hearts.pop(dog.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0)), 7);
  }, null, 5.55);

  // Card flies to the viewer.
  tl.call(() => {
    world.detachCard();
    // Once free, the card sits above the scene so grass never crosses the text.
    let order = 50;
    env.card.traverse((o) => {
      if (!o.material) return;
      o.material.depthTest = false;
      o.renderOrder = order++;
    });
  }, null, 6.15);
  tl.to(intro, { cardFly: 1, duration: 1.25, ease: 'power3.inOut' }, 6.16);
  tl.to(intro, { blur: 3.4, duration: 1, ease: 'sine.out' }, 6.3);
  tl.to(env.reveal, { value: 1, duration: 2.1, ease: 'sine.inOut' }, 7.1);
  tl.call(onReveal, null, 7.1);
  tl.addLabel('hold', 9.4);

  // The pull back: the meadow turns out to be a planet.
  const out = 12.0;
  tl.addLabel('out', out);
  tl.to(intro, { cardExit: 1, duration: 1.0, ease: 'power3.in' }, out);
  tl.to(world, { introBlend: 1, duration: 4.2, ease: 'sine.inOut' }, out + 0.25);
  tl.set(thread.mesh, { visible: false }, out + 1.1);
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
    // Anyone reading the card can move on as soon as the names have landed.
    advance() {
      if (tl.time() > 8 && tl.time() < out) tl.seek(out, false);
    },
    skip() {
      running = true;
      thread.hasA = thread.hasB = false;
      tl.seek(tl.duration(), false);
      tl.pause();
      world.env.group.visible = false;
      if (!world.cardFree) world.env.card.visible = false;
      thread.mesh.visible = false;
    },
    get running() { return running; },
    R,
  };
}
