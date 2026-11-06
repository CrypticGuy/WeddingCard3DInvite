import * as THREE from 'three';
import { Bag, garland, strand, rng, soft, vertexSoft, xf, lerp } from './kit.js';
import { R, dirAt } from './planet.js';

const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();
const basis = new THREE.Matrix4();

// Stands an object on the planet: x runs along the path, y is local up.
export function place(obj, terrain, phi, zOff = 0, along = 0, yaw = 0, lift = 0) {
  const p = phi + along / R;
  const d = dirAt(p, zOff);
  Y.copy(d);
  X.set(Math.cos(p), -Math.sin(p), 0);
  X.addScaledVector(Y, -X.dot(Y)).normalize();
  Z.crossVectors(X, Y);
  basis.makeBasis(X, Y, Z);
  obj.quaternion.setFromRotationMatrix(basis);
  if (yaw) obj.rotateY(yaw);
  obj.position.copy(d).multiplyScalar(R + terrain.height(d) + lift);
  return obj;
}

// Pleated fabric panel. Hangs from y=0 down to -h.
function curtain(w, h, folds, depth, tie = 0) {
  const g = new THREE.PlaneGeometry(w, h, folds * 4, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / w + 0.5, v = 0.5 - p.getY(i) / h;
    const pinch = 1 - tie * Math.sin(v * Math.PI) * 0.75;
    p.setXYZ(i, (u - 0.5) * w * pinch, -v * h, Math.sin(u * folds * Math.PI * 2) * depth * pinch);
  }
  g.computeVertexNormals();
  return g;
}

function potted(bag, x, z, s, potColor, leafColor, bloom, rand) {
  bag.lathe([x, 0, z], [[0.001, 0], [0.13, 0], [0.17, 0.06], [0.2, 0.26], [0.22, 0.3], [0.18, 0.31], [0.001, 0.3]], potColor, 18, null, s);
  for (let i = 0; i < 44; i++) {
    const a = rand() * 6.28, rr = Math.sqrt(rand()) * 0.2 * s, y = (0.36 + rand() * 0.34) * s;
    bag.ball([x + Math.cos(a) * rr, y - (rr / s) * 0.4 * s, z + Math.sin(a) * rr], (0.045 + rand() * 0.035) * s, i % 4 === 0 ? bloom : leafColor, [1, 0.8, 1], 1);
  }
}

function parasol(bag, x, z, h, rad, c1, c2, tilt = 0) {
  bag.cyl([x, h / 2, z], 0.018, 0.024, h, '#f6e2c6', [0, 0, 0], 8);
  const seg = 16;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const g = new THREE.BufferGeometry();
    const dip = 0.05;
    const v = [
      0, h + rad * 0.5, 0,
      Math.cos(a0) * rad, h, Math.sin(a0) * rad,
      Math.cos((a0 + a1) / 2) * rad * 1.02, h - dip, Math.sin((a0 + a1) / 2) * rad * 1.02,
      Math.cos(a1) * rad, h, Math.sin(a1) * rad,
    ];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setIndex([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]);
    g.computeVertexNormals();
    bag.add(g, i % 2 ? c1 : c2, xf([x, 0, z], [tilt, 0, tilt * 0.6]));
  }
  bag.ball([x, h + rad * 0.54, z], 0.035, '#f2cf85', [1, 1, 1], 1);
}

const fireMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 0.95, 0.42) });

export function buildMehendi(rand) {
  const root = new THREE.Group(), ticks = [];
  const bag = new Bag();
  // Swing frame, wrapped in vines
  const wood = '#fdeed8', W = 1.15, H = 2.2;
  bag.cyl([-W, H / 2, 0], 0.055, 0.075, H, wood);
  bag.cyl([W, H / 2, 0], 0.055, 0.075, H, wood);
  bag.tube([[-W, H, 0], [-W * 0.55, H + 0.3, 0], [0, H + 0.42, 0], [W * 0.55, H + 0.3, 0], [W, H, 0]], 0.06, wood, 30);
  const green = ['#9bdcab', '#b8e8b8', '#84d09b'], bloom = ['#fff5ea', '#ffd0dc', '#ffe39b'];
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
  parasol(bag, -2.25, -0.6, 2.2, 0.72, '#ff9fb6', '#fff0dc', 0.05);
  parasol(bag, 2.25, -0.4, 2.4, 0.8, '#ffd768', '#7fd0a8', -0.05);
  parasol(bag, -1.5, -1.8, 2.9, 0.86, '#7fd0a8', '#fff0dc', 0.03);
  parasol(bag, 1.3, -1.9, 2.75, 0.76, '#b9a0f0', '#fff0dc', -0.03);
  potted(bag, -1.75, 0.55, 1.2, '#fbc8b6', '#8fd4a0', '#ffd0dc', rand);
  potted(bag, 1.72, 0.65, 1.05, '#c8efdb', '#8fd4a0', '#fff6e6', rand);
  potted(bag, 2.3, 0.3, 1.35, '#fff0c4', '#a4dcb0', '#ffc2d2', rand);
  // Rug and floor cushions
  bag.ball([0, 0.012, 0.2], 1, '#ffe3e6', [1.5, 0.012, 0.8], 3);
  bag.ball([-0.95, 0.09, 0.55], 0.2, '#ffc2d2', [1, 0.48, 1], 2);
  bag.ball([0.92, 0.09, 0.62], 0.2, '#ffe39b', [1, 0.48, 1], 2);
  root.add(bag.build());

  // The swing itself rocks
  const swing = new THREE.Group();
  swing.position.set(0, H + 0.26, 0);
  const sb = new Bag();
  const seatY = -1.72;
  for (const s of [-0.62, 0.62]) sb.cyl([s, seatY / 2, 0], 0.012, 0.012, -seatY, '#e8c98d', [0, 0, 0], 6);
  sb.add(new THREE.BoxGeometry(1.5, 0.07, 0.5), '#fdeed8', xf([0, seatY, 0]));
  sb.ball([0, seatY + 0.08, 0], 0.66, '#ffc8d4', [1.08, 0.13, 0.36], 2);
  sb.ball([-0.46, seatY + 0.24, -0.1], 0.17, '#fff4e4', [1, 0.8, 0.5], 2);
  sb.ball([0.45, seatY + 0.24, -0.1], 0.17, '#c8efdb', [1, 0.8, 0.5], 2);
  sb.ball([0, seatY + 0.2, -0.14], 0.14, '#ffe39b', [1, 0.8, 0.5], 2);
  garland(sb, [-0.62, seatY + 0.1, 0.02], [-0.62, -0.1, 0.02], 0, 40, 0.024, ['#fff5ea', '#ffc8d4', '#c8efdb'], rand);
  garland(sb, [0.62, seatY + 0.1, 0.02], [0.62, -0.1, 0.02], 0, 40, 0.024, ['#fff5ea', '#ffc8d4', '#c8efdb'], rand);
  swing.add(sb.build());
  root.add(swing);
  ticks.push((t) => { swing.rotation.x = Math.sin(t * 1.2) * 0.13; });
  return { root, ticks, radius: 3.4 };
}

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
  root.add(glow);
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

export const builders = { mehendi: buildMehendi, haldi: buildHaldi, sangeet: buildSangeet, wedding: buildWedding };
export { rng, vertexSoft };
