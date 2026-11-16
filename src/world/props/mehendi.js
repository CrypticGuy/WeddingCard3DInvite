import * as THREE from 'three';
import { Bag, garland, strand, xf } from '../kit.js';
import { MARIGOLD, PASTEL as P, fxCount, instanced, parasol, pose, potted } from './common.js';

// Mehendi & Sangeet: the henna garden swing under parasols, with the sangeet's dhol,
// paper lanterns and marigold torans. Moving: the swing, the torans, lanterns and notes.
export function buildMehendi(rand, ctx = {}) {
  const root = new THREE.Group(), ticks = [];
  const mat = ctx.mat;
  const bag = new Bag();
  // Swing frame, wrapped in vines
  const wood = P.cream, W = 1.15, H = 2.2;
  bag.cyl([-W, H / 2, 0], 0.055, 0.075, H, wood);
  bag.cyl([W, H / 2, 0], 0.055, 0.075, H, wood);
  bag.tube([[-W, H, 0], [-W * 0.55, H + 0.3, 0], [0, H + 0.42, 0], [W * 0.55, H + 0.3, 0], [W, H, 0]], 0.06, wood, 30);
  const green = ['#a9e2b8', '#c4edc4', '#98d9aa'], bloom = [P.cream, P.blush, P.butter];
  for (let i = 0; i < 190; i++) {
    const t = i / 189, a = t * Math.PI;
    const x = -Math.cos(a) * W * 1.02, y = H + Math.sin(a) * 0.42;
    bag.ball([x + (rand() - 0.5) * 0.13, y + (rand() - 0.4) * 0.15, (rand() - 0.5) * 0.2], 0.04 + rand() * 0.03, i % 3 ? green[i % 3] : bloom[(i / 3 | 0) % 3], [1, 0.8, 1], 1);
  }
  for (const s of [-1, 1]) for (let i = 0; i < 60; i++) {
    const y = (i / 59) * H, a = i * 0.9;
    bag.ball([s * W + Math.cos(a) * 0.085, y, Math.sin(a) * 0.085], 0.03 + rand() * 0.022, i % 4 === 0 ? bloom[i % 3] : green[i % 3], [1, 0.8, 1], 1);
  }
  // Hanging parasols are what make a mehendi garden read from a distance
  const brollies = [[-2.25, -0.6, 2.2, 0.72, P.blush, P.cream, 0.05], [2.25, -0.4, 2.4, 0.8, P.butter, P.mint, -0.05], [-1.5, -1.8, 2.9, 0.86, P.mint, P.cream, 0.03], [1.3, -1.9, 2.75, 0.76, P.lilac, P.cream, -0.03]];
  for (const [x, z, h, r, a, b, tilt] of brollies) parasol(bag, x, z, h, r, a, b, tilt);
  potted(bag, -1.75, 0.55, 1.2, P.peach, '#9fdcae', P.blush, rand);
  potted(bag, 1.72, 0.65, 1.05, P.mint, '#9fdcae', P.cream, rand);
  potted(bag, 2.3, 0.3, 1.35, P.butter, '#ace0b8', P.pink, rand);
  // Rug and floor cushions
  bag.ball([0, 0.012, 0.2], 1, '#ffe6ea', [1.5, 0.012, 0.8], 3);
  bag.ball([-0.95, 0.09, 0.55], 0.2, P.blush, [1, 0.48, 1], 2);
  bag.ball([0.92, 0.09, 0.62], 0.2, P.butter, [1, 0.48, 1], 2);
  // The sangeet's dhol, resting on its side by the rug, with a cushion for the drummer
  const dhol = xf([1.38, 0.27, 1.02], [0, 0.5, Math.PI / 2]);
  bag.add(new THREE.CylinderGeometry(0.24, 0.24, 0.56, 20), P.pink, dhol, P.blush);
  for (const s of [-0.29, 0.29]) bag.add(new THREE.CylinderGeometry(0.255, 0.255, 0.035, 20), P.gold, xf([1.38 + s * Math.cos(0.5), 0.27, 1.02 - s * Math.sin(0.5)], [0, 0.5, Math.PI / 2]));
  for (let i = 0; i < 6; i++) bag.add(new THREE.BoxGeometry(0.014, 0.5, 0.014), P.rope, dhol.clone().multiply(xf([0, 0, 0], [0, i * 1.05, 0])).multiply(xf([0, 0, 0.243])));
  bag.ball([1.75, 0.08, 0.55], 0.17, P.lavender, [1, 0.45, 1], 2);
  root.add(bag.build(mat));

  // The swing itself rocks
  const swing = new THREE.Group();
  swing.position.set(0, H + 0.26, 0);
  const sb = new Bag();
  const seatY = -1.72;
  for (const s of [-0.62, 0.62]) sb.cyl([s, seatY / 2, 0], 0.012, 0.012, -seatY, P.rope, [0, 0, 0], 6);
  sb.add(new THREE.BoxGeometry(1.5, 0.07, 0.5), P.cream, xf([0, seatY, 0]));
  sb.ball([0, seatY + 0.08, 0], 0.66, P.blush, [1.08, 0.13, 0.36], 2);
  sb.ball([-0.46, seatY + 0.24, -0.1], 0.17, P.cream, [1, 0.8, 0.5], 2);
  sb.ball([0.45, seatY + 0.24, -0.1], 0.17, P.mint, [1, 0.8, 0.5], 2);
  sb.ball([0, seatY + 0.2, -0.14], 0.14, P.butter, [1, 0.8, 0.5], 2);
  garland(sb, [-0.62, seatY + 0.1, 0.02], [-0.62, -0.1, 0.02], 0, 40, 0.024, [P.cream, P.blush, P.mint], rand);
  garland(sb, [0.62, seatY + 0.1, 0.02], [0.62, -0.1, 0.02], 0, 40, 0.024, [P.cream, P.blush, P.mint], rand);
  swing.add(sb.build(mat));
  root.add(swing);
  ticks.push((t) => { swing.rotation.x = Math.sin(t * 1.2) * 0.13; });

  // Marigold torans hang from the front of the arch and sway, each from its own top.
  const tb = new Bag();
  strand(tb, [0, 0, 0], 0.55, 0.042, MARIGOLD, rand, P.blush);
  const toranGeo = tb.build().geometry;
  const spots = [-0.95, -0.76, -0.4, -0.2, 0, 0.2, 0.4, 0.76, 0.95];
  const nT = fxCount(spots.length, ctx, 3);
  const pick = nT >= spots.length ? spots : [-0.76, -0.2, 0.2, 0.76, -0.4, 0.4, 0].slice(0, nT);
  const torans = instanced(toranGeo, mat, pick.length);
  const tops = pick.map((x, i) => ({
    x, y: H + Math.sqrt(Math.max(0, 1 - (x / (W * 1.02)) ** 2)) * 0.42 - 0.05, len: 0.85 + (1 - Math.abs(x)) * 0.25, ph: i * 1.7,
  }));
  const swayToran = (t) => {
    tops.forEach((s, i) => pose(torans, i, s.x, s.y, 0.13, Math.sin(t * 1.4 + s.ph) * 0.09, 0, Math.sin(t * 1.1 + s.ph * 0.7) * 0.07, [1, s.len, 1]));
    torans.instanceMatrix.needsUpdate = true;
  };
  swayToran(0);
  root.add(torans);
  ticks.push(swayToran);

  // Paper lanterns hang from the parasol rims and bob
  const lg = new THREE.SphereGeometry(0.13, 14, 10);
  lg.scale(0.92, 1.15, 0.92);
  const lanternSpots = brollies.map(([x, z, h, r], i) => ({ x: x + (i % 2 ? -r : r) * 0.72, y: h - 0.28, z: z + 0.18, ph: i * 2.1 }));
  const nL = fxCount(lanternSpots.length, ctx, 2);
  const lanterns = instanced(lg, ctx.lanternMat ?? mat, nL);
  const bob = (t) => {
    for (let i = 0; i < nL; i++) {
      const s = lanternSpots[i];
      pose(lanterns, i, s.x, s.y + Math.sin(t * 0.9 + s.ph) * 0.05, s.z, 0, 0, Math.sin(t * 0.7 + s.ph) * 0.1);
    }
    lanterns.instanceMatrix.needsUpdate = true;
  };
  bob(0);
  root.add(lanterns);
  ticks.push(bob);

  // Music notes bounce up off the dhol in time with an imagined beat
  const nb = new Bag();
  nb.ball([0, 0, 0], 0.075, '#ffffff', [1.2, 0.85, 0.5], 1);
  nb.cyl([0.078, 0.2, 0], 0.012, 0.012, 0.4, '#ffffff', [0, 0, 0], 6);
  nb.add(new THREE.BoxGeometry(0.15, 0.05, 0.02), '#ffffff', xf([0.14, 0.38, 0], [0, 0, -0.35]));
  const noteGeo = nb.build().geometry;
  const nN = fxCount(6, ctx, 2);
  const notes = instanced(noteGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), nN);
  const noteCols = [P.blush, P.butter, P.lavender, P.mint, P.peach, '#ffffff'], c = new THREE.Color();
  const seeds = Array.from({ length: nN }, (_, i) => ({ off: i / nN, sp: 0.16 + rand() * 0.06, side: rand() - 0.5 }));
  seeds.forEach((_, i) => notes.setColorAt(i, c.set(noteCols[i % noteCols.length])));
  const bounce = (t) => {
    seeds.forEach((s, i) => {
      const k = (t * s.sp + s.off) % 1;
      const hop = Math.abs(Math.sin(k * Math.PI * 3)) * 0.18;   // three little bounces on the way up
      pose(notes, i, 1.38 + s.side * 0.8 + Math.sin(k * 6 + i) * 0.15, 0.7 + k * 2.1 + hop, 1.0, 0, 0, Math.sin(k * 9 + i) * 0.35, 0.75 * Math.sin(k * Math.PI) + 0.05);
    });
    notes.instanceMatrix.needsUpdate = true;
  };
  bounce(0.4);
  root.add(notes);
  ticks.push(bounce);
  return { root, ticks, radius: 3.4 };
}
