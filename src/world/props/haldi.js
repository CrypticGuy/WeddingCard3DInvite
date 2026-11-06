import * as THREE from 'three';
import { Bag, strand } from '../kit.js';

export function buildHaldi(rand) {
  const root = new THREE.Group(), ticks = [];
  const bag = new Bag();
  const mari = ['#ffb030', '#ffc53f', '#ff9a2e', '#ffd566'];
  // Moon gate of marigolds, reads as a sun from orbit
  const cy = 1.72, Rg = 1.5;
  for (let ring = 0; ring < 3; ring++) {
    const n = 92 - ring * 6, rr = Rg - ring * 0.13;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const y = cy + Math.sin(a) * rr;
      if (y < 0.02) continue;
      bag.ball([Math.cos(a) * rr, y, (rand() - 0.5) * 0.1 + (ring === 1 ? 0.05 : 0)], 0.082 + rand() * 0.03, mari[(i + ring) % 4], [1, 0.95, 0.85], 1);
    }
  }
  // Curtain of strands hanging inside the gate
  for (let i = -8; i <= 8; i++) {
    const x = i * 0.155, top = cy + Math.sqrt(Math.max(0, (Rg - 0.2) ** 2 - x * x));
    const len = 0.6 + (1 - Math.abs(i) / 8) * 0.25 + Math.abs(Math.sin(i * 1.7)) * 0.42 + (Math.abs(i) / 8) * 0.7;
    strand(bag, [x, top, -0.08], len, 0.048, i % 2 ? ['#ffc53f', '#fff2c6'] : ['#ff9a2e', '#ffd566'], rand, '#ffe7ae');
  }
  // Brass urlis full of petals, and low stools
  const brass = '#eec66a';
  for (const [x, z, s] of [[-1.05, 0.72, 1], [1.08, 0.62, 1.2]]) {
    bag.lathe([x, 0, z], [[0.001, 0.02], [0.14, 0.02], [0.3, 0.14], [0.36, 0.24], [0.34, 0.24], [0.2, 0.15], [0.001, 0.14]], brass, 24, '#f9dfa0', s);
    for (let i = 0; i < 34; i++) {
      const a = rand() * 6.28, rr = Math.sqrt(rand()) * 0.28 * s;
      bag.ball([x + Math.cos(a) * rr, 0.2 * s + rand() * 0.035, z + Math.sin(a) * rr], 0.038, mari[i % 4], [1, 0.5, 1], 1);
    }
  }
  bag.cyl([0, 0.2, 0.55], 0.33, 0.28, 0.08, '#fff6dc', [0, 0, 0], 22);
  bag.cyl([0, 0.1, 0.55], 0.16, 0.2, 0.2, '#ffe3ae', [0, 0, 0], 18);
  // Turmeric bowl on the stool
  bag.lathe([0, 0.24, 0.55], [[0.001, 0], [0.09, 0], [0.16, 0.08], [0.15, 0.08], [0.001, 0.05]], '#fff2d2', 18);
  bag.ball([0, 0.3, 0.55], 0.13, '#ffc82e', [1, 0.22, 1], 2);
  // Marigold bushes
  for (const [x, z, s] of [[-2.25, 0.05, 1.2], [2.3, -0.05, 1.3], [-2.75, -1, 1], [2.8, -1.05, 1.1], [-1.85, -1.1, 0.8], [1.85, -1.1, 0.85]]) {
    bag.ball([x, 0.38 * s, z], 0.48 * s, '#b9d97d', [1, 0.85, 1], 2);
    for (let i = 0; i < 34; i++) {
      const u = rand() * 6.28, v = rand() * 1.3;
      bag.ball([x + Math.cos(u) * Math.sin(v) * 0.47 * s, 0.38 * s + Math.cos(v) * 0.4 * s, z + Math.sin(u) * Math.sin(v) * 0.47 * s], 0.075 * s, mari[i % 4], [1, 0.85, 1], 1);
    }
  }
  root.add(bag.build());
  return { root, ticks, radius: 3.5 };
}

