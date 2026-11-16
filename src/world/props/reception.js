import * as THREE from 'three';
import { Bag, lerp, paint, xf } from '../kit.js';
import { PASTEL as P, fxCount, instanced, pose } from './common.js';

// The reception: a powder-blue bandshell stage under fairy lights, dinner tables with a
// tiered cake, and paper lanterns. Moving: twinkling lights, bobbing lanterns and slow
// sparkle bursts overhead.
export function buildReception(rand, ctx = {}) {
  const root = new THREE.Group(), ticks = [];
  const mat = ctx.mat;
  const bag = new Bag();
  // Round stage
  bag.cyl([0, 0.1, 0], 2.15, 2.25, 0.2, P.powder, [0, 0, 0], 40, '#e6eefc');
  bag.cyl([0, 0.25, -0.1], 1.85, 1.95, 0.12, '#f3f7ff', [0, 0, 0], 40);
  // Bandshell ribs
  const ribs = 7;
  for (let i = 0; i < ribs; i++) {
    const a = lerp(-1.25, 1.25, i / (ribs - 1));
    const ca = Math.sin(a), sa = -Math.cos(a), pts = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10, rise = Math.sin(t * Math.PI / 2);
      const rad = 2.0 * (1 - t * 0.72), y = 0.3 + rise * 3;
      pts.push([ca * rad, y, sa * rad - 0.1]);
    }
    bag.tube(pts, 0.048, i % 2 ? '#ffffff' : P.gold, 28);
  }
  // Shell fabric panels between ribs, powder blue fading to blush at the crown
  for (let i = 0; i < ribs - 1; i++) {
    const a0 = lerp(-1.25, 1.25, i / (ribs - 1)), a1 = lerp(-1.25, 1.25, (i + 1) / (ribs - 1));
    const n = 10, v = [], idx = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, rise = Math.sin(t * Math.PI / 2), rad = 2.0 * (1 - t * 0.72), y = 0.3 + rise * 3;
      v.push(Math.sin(a0) * rad, y, -Math.cos(a0) * rad - 0.1, Math.sin(a1) * rad, y, -Math.cos(a1) * rad - 0.1);
    }
    for (let k = 0; k < n; k++) { const a = k * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    bag.add(g, i % 2 ? P.sky : P.powder, null, i % 2 ? P.lavender : P.pink);
  }
  // Tiered cake on a little stand, centre stage
  bag.cyl([0, 0.36, 0.55], 0.05, 0.12, 0.1, P.gold, [0, 0, 0], 14);
  [[0.3, 0.2, P.cream], [0.22, 0.18, P.pink], [0.15, 0.16, P.powder]].reduce((y, [r, h, c]) => {
    bag.cyl([0, y + h / 2, 0.55], r, r, h, c, [0, 0, 0], 22);
    bag.add(new THREE.TorusGeometry(r, 0.018, 6, 22), '#ffffff', xf([0, y + 0.02, 0.55], [Math.PI / 2, 0, 0]));
    return y + h;
  }, 0.41);
  bag.ball([0, 0.99, 0.55], 0.05, P.blush, [1, 1, 1], 1);
  // Two dinner tables in cloths, with a posy each, and chairs tucked in
  for (const [x, z, cloth] of [[-2.85, 0.75, P.lavender], [2.85, 0.75, P.pink]]) {
    bag.lathe([x, 0, z], [[0.001, 0.5], [0.42, 0.5], [0.46, 0.46], [0.5, 0.05], [0.53, 0], [0.001, 0]], cloth, 22, '#ffffff');
    bag.ball([x, 0.58, z], 0.1, P.butter, [1, 0.7, 1], 1);
    bag.ball([x, 0.6, z], 0.06, P.blush, [1, 1, 1], 1);
    for (const a of [0.6, 2.2, 3.8, 5.4]) {
      const cx = x + Math.cos(a) * 0.68, cz = z + Math.sin(a) * 0.68;
      bag.add(new THREE.BoxGeometry(0.26, 0.04, 0.26), P.cream, xf([cx, 0.3, cz], [0, -a, 0]));
      bag.add(new THREE.BoxGeometry(0.04, 0.3, 0.26), P.cream, xf([cx + Math.cos(a) * 0.12, 0.46, cz + Math.sin(a) * 0.12], [0, -a, 0]));
      for (const [dx, dz] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) bag.cyl([cx + dx, 0.14, cz + dz], 0.015, 0.015, 0.28, P.gold, [0, 0, 0], 5);
    }
  }
  // Microphone stand for the toasts
  bag.cyl([1.1, 0.72, 0.25], 0.012, 0.022, 0.92, P.gold, [0, 0, 0], 8);
  bag.ball([1.1, 1.22, 0.25], 0.06, P.lilac, [1, 1.2, 1], 2);
  bag.cyl([1.1, 0.32, 0.25], 0.14, 0.16, 0.03, P.gold, [0, 0, 0], 16);
  // Posts the fairy lights run to
  const posts = [[-3.2, 0.6], [3.2, 0.6], [-3, -1.8], [3, -1.8]];
  for (const [x, z] of posts) {
    bag.cyl([x, 1.3, z], 0.03, 0.045, 2.6, P.cream, [0, 0, 0], 8);
    bag.ball([x, 2.62, z], 0.06, P.gold, [1, 1, 1], 1);
  }
  root.add(bag.build(mat));

  // Fairy lights arcing from the posts to the crown of the shell. Each bulb twinkles
  // on its own; colours live per instance, so the whole string is one draw call.
  const bulbGeo = paint(new THREE.IcosahedronGeometry(0.045, 1), '#ffffff');
  const top = [0, 3.35, -0.1], per = 15, bulbs = [];
  for (const [x, z] of posts) {
    for (let i = 0; i <= per; i++) {
      const t = i / per;
      bulbs.push([lerp(x, top[0], t), lerp(2.6, top[1], t) - Math.sin(t * Math.PI) * 0.42, lerp(z, top[2], t)]);
    }
  }
  // A swag along the front of the stage too
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    bulbs.push([lerp(-3.2, 3.2, t), 2.5 - Math.sin(t * Math.PI) * 0.55, 0.6 + Math.sin(t * Math.PI) * 0.25]);
  }
  const lights = instanced(bulbGeo, ctx.bulbMat ?? new THREE.MeshBasicMaterial({ vertexColors: true }), bulbs.length);
  const tones = ['#fff3c8', '#ffe0f0', '#dfeaff', '#fff8e8'].map((h) => new THREE.Color(h));
  const ph = bulbs.map(() => rand() * 6.28), rate = bulbs.map(() => 1.2 + rand() * 2.4);
  bulbs.forEach(([x, y, z], i) => pose(lights, i, x, y, z));
  const c = new THREE.Color();
  const twinkle = (t) => {
    for (let i = 0; i < bulbs.length; i++) {
      const k = 0.55 + 0.45 * Math.max(0, Math.sin(t * rate[i] + ph[i])) ** 3 + 0.12 * Math.sin(t * 7 + ph[i]);
      lights.setColorAt(i, c.copy(tones[i % 4]).multiplyScalar(k));
    }
    lights.instanceColor.needsUpdate = true;
  };
  twinkle(0);
  root.add(lights);
  ticks.push(twinkle);

  // Floating paper lanterns, bobbing
  const lg = new THREE.SphereGeometry(0.2, 16, 10);
  lg.scale(0.92, 1.12, 0.92);
  const nL = fxCount(12, ctx, 4);
  const lanterns = instanced(lg, ctx.lanternMat ?? mat, nL);
  const ls = Array.from({ length: nL }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    return { x: side * (1.7 + rand() * 2.3), y: 1.9 + rand() * 2.5, z: -0.9 - rand() * 2.1, ph: rand() * 6, s: 0.75 + rand() * 0.8 };
  });
  const bob = (t) => {
    ls.forEach((l, i) => pose(lanterns, i, l.x, l.y + Math.sin(t * 0.8 + l.ph) * 0.14, l.z, 0, 0, Math.sin(t * 0.6 + l.ph) * 0.08, l.s));
    lanterns.instanceMatrix.needsUpdate = true;
  };
  bob(0);
  root.add(lanterns);
  ticks.push(bob);

  // Slow sparkle bursts high above the stage: a soft firework that blooms and fades.
  const puffs = fxCount(3, ctx, 1), sparks = 16;
  const sparkGeo = new THREE.OctahedronGeometry(0.05, 0);
  const sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.4, 1.25) });
  const fw = instanced(sparkGeo, sparkMat, puffs * sparks);
  const hue = [P.blush, P.butter, P.powder, P.lavender, P.mint].map((h) => new THREE.Color(h));
  const dirs = Array.from({ length: sparks }, (_, j) => {
    const y = 1 - ((j + 0.5) / sparks) * 2, r = Math.sqrt(1 - y * y), a = j * 2.39996;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  });
  const bursts = Array.from({ length: puffs }, (_, p) => ({
    off: p / puffs, x: (p - (puffs - 1) / 2) * 2.4 + (rand() - 0.5) * 0.6, y: 4.6 + rand() * 0.7, z: -1.4 - rand() * 0.8, col: p % hue.length,
  }));
  for (let p = 0; p < puffs; p++) for (let j = 0; j < sparks; j++) fw.setColorAt(p * sparks + j, c.copy(hue[(bursts[p].col + (j % 2)) % hue.length]));
  const bloom = (t) => {
    bursts.forEach((b, p) => {
      const k = (t / 5.5 + b.off) % 1;            // one burst every 5.5s per puff
      const open = 1 - (1 - Math.min(1, k / 0.45)) ** 3;
      const size = k < 0.75 ? Math.sin(Math.min(1, k / 0.12) * Math.PI / 2) * (1 - Math.max(0, k - 0.45) / 0.3) : 0;
      for (let j = 0; j < sparks; j++) {
        const d = dirs[j];
        pose(fw, p * sparks + j, b.x + d[0] * open * 0.85, b.y + d[1] * open * 0.85 - k * k * 0.5, b.z + d[2] * open * 0.5, k * 4, j, 0, Math.max(0, size));
      }
    });
    fw.instanceMatrix.needsUpdate = true;
  };
  bloom(1.2);
  root.add(fw);
  ticks.push(bloom);
  return { root, ticks, radius: 3.8 };
}
