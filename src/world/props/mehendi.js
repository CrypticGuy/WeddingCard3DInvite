import * as THREE from 'three';
import { Bag, garland, xf } from '../kit.js';
import { parasol, potted } from './common.js';

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

