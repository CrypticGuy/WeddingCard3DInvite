import * as THREE from 'three';
import { profile } from './kit.js';

// SDF toolkit + naive surface nets. This is how the beagle, clouds and tree
// canopies get a sculpted clay look without shipping a single model file.

export const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
export const sphere = (x, y, z, cx, cy, cz, r) => Math.hypot(x - cx, y - cy, z - cz) - r;
export const ell = (x, y, z, cx, cy, cz, rx, ry, rz) => {
  const k = Math.hypot((x - cx) / rx, (y - cy) / ry, (z - cz) / rz);
  return (k - 1) * Math.min(rx, ry, rz);
};
export const cone = (x, y, z, ax, ay, az, bx, by, bz, r1, r2) => {
  const px = x - ax, py = y - ay, pz = z - az, dx = bx - ax, dy = by - ay, dz = bz - az;
  const t = Math.min(1, Math.max(0, (px * dx + py * dy + pz * dz) / (dx * dx + dy * dy + dz * dz)));
  return Math.hypot(px - dx * t, py - dy * t, pz - dz * t) - (r1 + (r2 - r1) * t);
};

const CORNERS = [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];
const EDGES = [[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];

export function sdfGeometry({ sdf, color, min, max, cell: baseCell }) {
  const cell = baseCell * profile.sdf;
  const nx = Math.ceil((max[0] - min[0]) / cell) + 1;
  const ny = Math.ceil((max[1] - min[1]) / cell) + 1;
  const nz = Math.ceil((max[2] - min[2]) / cell) + 1;
  const val = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++)
        val[id(i, j, k)] = sdf(min[0] + i * cell, min[1] + j * cell, min[2] + k * cell);

  const vidx = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [];
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of EDGES) {
          const ca = CORNERS[a], cb = CORNERS[b];
          const va = val[id(i + ca[0], j + ca[1], k + ca[2])];
          const vb = val[id(i + cb[0], j + cb[1], k + cb[2])];
          if ((va < 0) === (vb < 0)) continue;
          const t = va / (va - vb);
          sx += ca[0] + (cb[0] - ca[0]) * t;
          sy += ca[1] + (cb[1] - ca[1]) * t;
          sz += ca[2] + (cb[2] - ca[2]) * t;
          n++;
        }
        if (!n) continue;
        vidx[id(i, j, k)] = pos.length / 3;
        pos.push(min[0] + (i + sx / n) * cell, min[1] + (j + sy / n) * cell, min[2] + (k + sz / n) * cell);
      }

  const index = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) index.push(a, c, b, a, d, c);
    else index.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const v = val[id(i, j, k)] < 0;
        if (v !== (val[id(i + 1, j, k)] < 0))
          quad(vidx[id(i, j - 1, k - 1)], vidx[id(i, j, k - 1)], vidx[id(i, j, k)], vidx[id(i, j - 1, k)], !v);
        if (v !== (val[id(i, j + 1, k)] < 0))
          quad(vidx[id(i - 1, j, k - 1)], vidx[id(i - 1, j, k)], vidx[id(i, j, k)], vidx[id(i, j, k - 1)], !v);
        if (v !== (val[id(i, j, k + 1)] < 0))
          quad(vidx[id(i - 1, j - 1, k)], vidx[id(i, j - 1, k)], vidx[id(i, j, k)], vidx[id(i - 1, j, k)], !v);
      }

  const count = pos.length / 3;
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const e = cell * 0.75;
  const c = new THREE.Color();
  for (let v = 0; v < count; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const gx = sdf(x + e, y, z) - sdf(x - e, y, z);
    const gy = sdf(x, y + e, z) - sdf(x, y - e, z);
    const gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    normals[v * 3] = gx / l; normals[v * 3 + 1] = gy / l; normals[v * 3 + 2] = gz / l;
    color(x, y, z, c);
    colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setIndex(index);
  return g;
}
