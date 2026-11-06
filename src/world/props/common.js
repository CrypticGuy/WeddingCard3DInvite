import * as THREE from 'three';
import { xf } from '../kit.js';
import { R, dirAt } from '../planet.js';

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
export function curtain(w, h, folds, depth, tie = 0) {
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

export function potted(bag, x, z, s, potColor, leafColor, bloom, rand) {
  bag.lathe([x, 0, z], [[0.001, 0], [0.13, 0], [0.17, 0.06], [0.2, 0.26], [0.22, 0.3], [0.18, 0.31], [0.001, 0.3]], potColor, 18, null, s);
  for (let i = 0; i < 44; i++) {
    const a = rand() * 6.28, rr = Math.sqrt(rand()) * 0.2 * s, y = (0.36 + rand() * 0.34) * s;
    bag.ball([x + Math.cos(a) * rr, y - (rr / s) * 0.4 * s, z + Math.sin(a) * rr], (0.045 + rand() * 0.035) * s, i % 4 === 0 ? bloom : leafColor, [1, 0.8, 1], 1);
  }
}

export function parasol(bag, x, z, h, rad, c1, c2, tilt = 0) {
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

export const fireMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 0.95, 0.42) });

