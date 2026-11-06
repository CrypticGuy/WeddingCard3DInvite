import * as THREE from 'three';
import { Bag, garland, soft, strand, xf } from '../kit.js';
import { curtain, fireMat } from './common.js';

export function buildWedding(rand, q) {
  const root = new THREE.Group(), ticks = [];
  const bag = new Bag();
  const gold = '#efcc80', ivory = '#fff4e6', blush = '#ffc4cf', rose = '#ff9fb5', peach = '#ffd0ae';
  const flowers = [blush, rose, ivory, peach, '#ffe7ee'];
  // Three stepped dais
  bag.cyl([0, 0.07, 0], 1.95, 2.05, 0.14, '#fff0ea', [0, 0, 0], 44);
  bag.cyl([0, 0.19, 0], 1.7, 1.78, 0.1, ivory, [0, 0, 0], 44);
  bag.ball([0, 0.242, 0], 1, '#ffd8df', [1.5, 0.008, 1.5], 3);
  // Four carved pillars
  const PX = 1.32, PZ = 1.08, PH = 2.3;
  const pillar = [[0.001, 0], [0.16, 0], [0.15, 0.1], [0.085, 0.2], [0.075, 0.55], [0.1, 0.62], [0.075, 0.7], [0.066, 1.6], [0.09, 1.68], [0.066, 1.76], [0.07, 2.04], [0.15, 2.2], [0.16, 2.3], [0.001, 2.3]];
  for (const [x, z] of [[-PX, PZ], [PX, PZ], [-PX, -PZ], [PX, -PZ]]) {
    bag.lathe([x, 0.24, z], pillar, ivory, 16, gold);
    // Flowers climb each pillar
    for (let i = 0; i < 34; i++) {
      const y = 0.3 + (i / 34) * 2.1, a = i * 0.72;
      bag.ball([x + Math.cos(a) * 0.1, y, z + Math.sin(a) * 0.1], 0.036 + rand() * 0.016, flowers[i % 5], [1, 0.85, 1], 1);
    }
  }
  // Canopy: beam ring and chhatri dome
  const TOP = PH + 0.24;
  bag.add(new THREE.BoxGeometry(PX * 2 + 0.5, 0.13, PZ * 2 + 0.5), ivory, xf([0, TOP + 0.06, 0]));
  bag.add(new THREE.BoxGeometry(PX * 2 + 0.72, 0.05, PZ * 2 + 0.72), gold, xf([0, TOP + 0.15, 0]));
  bag.lathe([0, TOP + 0.17, 0], [[1.34, 0], [1.3, 0.15], [1.08, 0.58], [0.68, 0.92], [0.3, 1.1], [0.08, 1.24], [0.03, 1.42], [0.001, 1.55]], '#ffd9df', 32, ivory);
  bag.ball([0, TOP + 1.76, 0], 0.075, gold, [1, 1.3, 1], 2);
  for (const [x, z] of [[-PX, PZ], [PX, PZ], [-PX, -PZ], [PX, -PZ]]) {
    bag.lathe([x * 1.04, TOP + 0.17, z * 1.04], [[0.24, 0], [0.22, 0.12], [0.12, 0.28], [0.03, 0.38], [0.001, 0.44]], '#fff0ea', 16, gold);
  }
  // Rim of blooms around the dome base, garland swags on the beam
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    bag.ball([Math.cos(a) * 1.33, TOP + 0.21 + (rand() - 0.5) * 0.05, Math.sin(a) * 1.33], 0.062 + rand() * 0.02, flowers[i % 5], [1, 0.85, 1], 1);
  }
  garland(bag, [-PX, TOP - 0.05, PZ + 0.22], [0, TOP - 0.05, PZ + 0.24], 0.32, 42, 0.036, flowers, rand);
  garland(bag, [0, TOP - 0.05, PZ + 0.24], [PX, TOP - 0.05, PZ + 0.22], 0.32, 42, 0.036, flowers, rand);
  garland(bag, [-PX, TOP - 0.05, -PZ], [PX, TOP - 0.05, -PZ], 0.46, 40, 0.05, flowers, rand);
  for (let i = -7; i <= 7; i++) {
    strand(bag, [i * 0.17, TOP - 0.04, -PZ - 0.05], 0.5 + Math.abs(i) * 0.1, 0.033, [ivory, blush], rand);
  }
  // Havan kund
  bag.add(new THREE.BoxGeometry(0.52, 0.14, 0.52), gold, xf([0, 0.32, 0.05], [0, 0.785, 0]));
  bag.add(new THREE.BoxGeometry(0.4, 0.1, 0.4), '#d9a95d', xf([0, 0.41, 0.05], [0, 0.785, 0]));
  // Two low seats
  for (const s of [-1, 1]) {
    bag.ball([s * 0.72, 0.36, 0.1], 0.26, '#ffc1ce', [1, 0.42, 0.9], 2);
    bag.ball([s * 0.72, 0.56, -0.13], 0.24, ivory, [0.92, 0.82, 0.3], 2);
  }
  // Rose bushes and urns flanking the steps
  for (const [x, z, s] of [[-2.5, 0.75, 1.1], [2.5, 0.75, 1.1], [-2.75, -0.5, 1.25], [2.75, -0.5, 1.2]]) {
    bag.lathe([x, 0, z], [[0.001, 0], [0.14, 0], [0.09, 0.14], [0.12, 0.2], [0.27, 0.56], [0.3, 0.6], [0.23, 0.62], [0.001, 0.6]], ivory, 20, gold, s);
    bag.ball([x, 0.68 * s, z], 0.27 * s, '#a9c7a2', [1, 0.8, 1], 2);
    for (let i = 0; i < 60; i++) {
      const u = rand() * 6.28, v = rand() * 1.6;
      bag.ball([x + Math.cos(u) * Math.sin(v) * 0.29 * s, (0.68 + Math.cos(v) * 0.24) * s, z + Math.sin(u) * Math.sin(v) * 0.29 * s], 0.058 * s, flowers[i % 5], [1, 0.85, 1], 1);
    }
  }
  // Diyas lining the steps
  for (let i = -5; i <= 5; i++) {
    if (Math.abs(i) < 1) continue;
    bag.lathe([i * 0.35, 0.15, 1.73 - Math.abs(i) * 0.03], [[0.001, 0], [0.05, 0], [0.07, 0.035], [0.06, 0.035], [0.001, 0.02]], gold, 10);
  }
  root.add(bag.build());

  // Drapes tied back to each front pillar
  const dm = soft({ color: '#ffe9ee', side: THREE.DoubleSide, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(curtain(0.9, 2.2, 3, 0.05, 1), dm);
    c.position.set(s * (PX - 0.28), TOP - 0.03, PZ + 0.08);
    c.castShadow = true;
    root.add(c);
    const ph = s * 2;
    ticks.push((t) => { c.rotation.x = Math.sin(t * 0.9 + ph) * 0.018 - 0.01; });
  }
  const back = new THREE.Mesh(curtain(2.6, 2.3, 8, 0.05, 0), dm);
  back.position.set(0, TOP - 0.03, -PZ - 0.02);
  root.add(back);

  // Flame
  const fm = fireMat();
  const flames = [0.15, 0.11, 0.09].map((r, i) => {
    const g = new THREE.ConeGeometry(r * 0.72, r * 3.1, 12, 3);
    const m = new THREE.Mesh(g, i ? new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.5, 0.75) }) : fm);
    m.position.set((i - 1) * 0.05, 0.6, 0.05 + (i === 2 ? 0.05 : 0));
    root.add(m);
    return m;
  });
  const glow = new THREE.PointLight('#ffb36b', q ? 3 : 0, 3.5, 1.6);
  glow.position.set(0, 0.85, 0.2);
  if (q) root.add(glow);   // adding a light later would recompile every material
  ticks.push((t) => {
    flames.forEach((f, i) => {
      const n = Math.sin(t * (9 + i * 3)) * 0.13 + Math.sin(t * (17 - i)) * 0.09;
      f.scale.set(1 - n * 0.3, 1 + n, 1 - n * 0.3);
      f.rotation.z = Math.sin(t * 5 + i * 2) * 0.09;
    });
    glow.intensity = (q ? 3 : 0) * (0.85 + Math.sin(t * 13) * 0.15);
  });
  // Diya flames
  const dBag = new Bag();
  for (let i = -5; i <= 5; i++) {
    if (Math.abs(i) < 1) continue;
    dBag.add(new THREE.ConeGeometry(0.02, 0.075, 8), '#ffffff', xf([i * 0.35, 0.235, 1.73 - Math.abs(i) * 0.03]));
  }
  root.add(dBag.build(new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 1.25, 0.6), vertexColors: true }), { cast: false, receive: false }));
  return { root, ticks, radius: 3.5 };
}

