import * as THREE from 'three';
import { Bag, lerp, xf } from '../kit.js';

export function buildSangeet(rand, bulbMat, lanternMat) {
  const root = new THREE.Group(), ticks = [];
  const bag = new Bag();
  // Round stage
  bag.cyl([0, 0.1, 0], 2.15, 2.25, 0.2, '#ece4ff', [0, 0, 0], 40, '#c9bbf6');
  bag.cyl([0, 0.25, -0.1], 1.85, 1.95, 0.12, '#f7f0ff', [0, 0, 0], 40);
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
    bag.tube(pts, 0.048, i % 2 ? '#fff' : '#f0d9ff', 28);
  }
  // Shell fabric panels between ribs
  const fabric = new THREE.Group();
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
    bag.add(g, i % 2 ? '#c5b0f5' : '#dfc5fb', null, i % 2 ? '#f6c9e8' : '#fbd9ec');
  }
  void fabric;
  // Dhol, mic stand, harmonium-ish speaker stacks in pastel
  bag.add(new THREE.CylinderGeometry(0.26, 0.26, 0.6, 22), '#ffb8cf', xf([-1.05, 0.62, 0.35], [0, 0.4, Math.PI / 2]));
  for (const s of [-0.31, 0.31]) bag.add(new THREE.CylinderGeometry(0.28, 0.28, 0.035, 22), '#f6d58c', xf([-1.05 + s * Math.cos(0.4), 0.62, 0.35 - s * Math.sin(0.4)], [0, 0.4, Math.PI / 2]));
  bag.cyl([1.1, 0.72, 0.25], 0.012, 0.022, 0.92, '#f6d58c', [0, 0, 0], 8);
  bag.ball([1.1, 1.22, 0.25], 0.06, '#d8c6ff', [1, 1.2, 1], 2);
  bag.cyl([1.1, 0.32, 0.25], 0.14, 0.16, 0.03, '#f6d58c', [0, 0, 0], 16);
  root.add(bag.build());

  // String lights arcing out to posts
  const bulbs = new Bag();
  const poleBag = new Bag();
  const posts = [[-3.2, 0.6], [3.2, 0.6], [-3, -1.8], [3, -1.8]];
  for (const [x, z] of posts) poleBag.cyl([x, 1.3, z], 0.03, 0.045, 2.6, '#ece4ff', [0, 0, 0], 8);
  root.add(poleBag.build());
  const top = [0, 3.35, -0.1];
  for (const [x, z] of posts) {
    const n = 15;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      bulbs.ball([lerp(x, top[0], t), lerp(2.6, top[1], t) - Math.sin(t * Math.PI) * 0.42, lerp(z, top[2], t)], 0.042, ['#fff2c0', '#ffd9ef', '#d9e9ff'][i % 3], [1, 1, 1], 1);
    }
  }
  root.add(bulbs.build(bulbMat, { cast: false, receive: false }));

  // Floating paper lanterns, bobbing
  const lg = new THREE.SphereGeometry(0.2, 18, 12);
  lg.scale(0.92, 1.12, 0.92);
  for (let i = 0; i < 12; i++) {
    const l = new THREE.Mesh(lg, lanternMat);
    const side = i % 2 ? 1 : -1;
    const bx = side * (1.7 + rand() * 2.3), by = 1.9 + rand() * 2.5, bz = -0.9 - rand() * 2.1, ph = rand() * 6;
    l.position.set(bx, by, bz);
    l.scale.setScalar(0.75 + rand() * 0.8);
    root.add(l);
    ticks.push((t) => {
      l.position.y = by + Math.sin(t * 0.8 + ph) * 0.14;
      l.rotation.z = Math.sin(t * 0.6 + ph) * 0.08;
    });
  }

  // Music notes drifting off the stage
  const noteBag = new Bag();
  noteBag.ball([0, 0, 0], 0.075, '#ffffff', [1.2, 0.85, 0.5], 1);
  noteBag.cyl([0.078, 0.2, 0], 0.012, 0.012, 0.4, '#ffffff', [0, 0, 0], 6);
  noteBag.add(new THREE.BoxGeometry(0.15, 0.05, 0.02), '#ffffff', xf([0.14, 0.38, 0], [0, 0, -0.35]));
  const noteGeo = noteBag.build().geometry;
  for (let i = 0; i < 7; i++) {
    const m = new THREE.MeshBasicMaterial({ color: ['#ffffff', '#ffe6f6', '#fff4c8'][i % 3], transparent: true });
    const n = new THREE.Mesh(noteGeo, m);
    const x0 = (rand() - 0.5) * 3, off = rand(), sp = 0.1 + rand() * 0.06;
    root.add(n);
    ticks.push((t) => {
      const k = (t * sp + off) % 1;
      n.position.set(x0 + Math.sin(k * 8 + off * 6) * 0.3, 0.8 + k * 3.2, 0.5);
      n.rotation.z = Math.sin(k * 10 + off) * 0.3;
      n.scale.setScalar(0.8 + 0.5 * Math.sin(k * Math.PI));
      m.opacity = Math.sin(k * Math.PI);
    });
  }
  return { root, ticks, radius: 3.8 };
}

