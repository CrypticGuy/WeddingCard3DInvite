import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, noise3, sstep, lerp, rng, paint, vertexSoft, windMaterial, xf, Bag } from './kit.js';
import { sdfGeometry, smin, sphere } from './sdf.js';

export const R = 9;

// Every stop gets its own meadow: ground colour, grass tint, flower palette.
export const ZONES = {
  start: { ground: '#bfe8c4', grass: '#a8e0b0', flowers: ['#ffc9d6', '#ffe0a8', '#fff3f6', '#d9c8f5'] },
  mehendi: { ground: '#a8dcae', grass: '#8fd4a0', flowers: ['#fff6e8', '#ffd0dc', '#c9efd7', '#f7e3a1'] },
  haldi: { ground: '#eaeb9f', grass: '#dfe48a', flowers: ['#ffb84d', '#ffd05c', '#ff9f4a', '#fff0b0'] },
  sangeet: { ground: '#c9c4ef', grass: '#b5b1ea', flowers: ['#e9c6ff', '#b9a4f6', '#ffc4e6', '#a7d3ff'] },
  wedding: { ground: '#fbcdd5', grass: '#f8bcc8', flowers: ['#ff9db4', '#fff0ee', '#ffc9a8', '#f7d98c'] },
};
const PATH = new THREE.Color('#fff0dc');
const PATH_EDGE = new THREE.Color('#f7dcc2');

export function dirAt(phi, zOff = 0) {
  const lam = zOff / R;
  return new THREE.Vector3(Math.sin(phi) * Math.cos(lam), Math.cos(phi) * Math.cos(lam), Math.sin(lam));
}

export function createTerrain(stops) {
  const angDist = (a, b) => {
    let d = Math.abs(a - b) % (Math.PI * 2);
    return d > Math.PI ? Math.PI * 2 - d : d;
  };

  function height(d) {
    const z = Math.abs(d.z) * R;
    const phi = Math.atan2(d.x, d.y);
    let flat = sstep(0.8, 2.4, z);
    for (const s of stops) {
      const rr = Math.hypot(angDist(phi, s.phi) * R, z * 0.55);
      flat *= sstep(2.2, 4.2, rr);
    }
    const hills = (fbm(d.x * 2.1 + 3, d.y * 2.1, d.z * 2.1) - 0.5) * 2.6;
    const poles = sstep(4, 8.5, z) * (fbm(d.x * 3.1, d.y * 3.1 + 7, d.z * 3.1) - 0.32) * 2.1;
    return (hills + poles) * flat;
  }

  const ca = new THREE.Color(), cb = new THREE.Color();
  function zoneMix(d, key, out) {
    const phi = Math.atan2(d.x, d.y);
    let wsum = 0;
    out.setRGB(0, 0, 0);
    for (const s of stops) {
      const w = Math.pow(Math.max(0.001, 1 - angDist(phi, s.phi) / 1.7), 3.2);
      cb.set(ZONES[s.zone][key]);
      out.r += cb.r * w; out.g += cb.g * w; out.b += cb.b * w;
      wsum += w;
    }
    out.multiplyScalar(1 / wsum);
    return out;
  }
  function nearestZone(d, jitter = 0) {
    const phi = Math.atan2(d.x, d.y) + jitter;
    let best = stops[0], bd = 1e9;
    for (const s of stops) {
      const dd = angDist(phi, s.phi);
      if (dd < bd) { bd = dd; best = s; }
    }
    return best;
  }
  function groundColor(d, out) {
    zoneMix(d, 'ground', out);
    ca.set('#b6e4bd');
    out.lerp(ca, sstep(0.45, 0.9, Math.abs(d.z)));
    const n = fbm(d.x * 5, d.y * 5, d.z * 5);
    const n2 = fbm(d.x * 19, d.y * 19, d.z * 19);
    out.multiplyScalar(0.9 + n * 0.14 + (n2 - 0.5) * 0.2);
    // Sunny patches, like light through a watercolour wash
    ca.set('#fff6d6');
    out.lerp(ca, sstep(0.56, 0.72, n) * 0.26);
    // The path itself
    const phi = Math.atan2(d.x, d.y);
    const z = d.z * R + Math.sin(phi * 7) * 0.07 + Math.sin(phi * 17) * 0.03;
    const pm = sstep(0.82, 0.6, Math.abs(z));
    const em = sstep(0.95, 0.72, Math.abs(z));
    out.lerp(PATH_EDGE, em * 0.9);
    out.lerp(PATH, pm);
    return out;
  }
  return { height, groundColor, zoneMix, nearestZone };
}

export function createGround(terrain, n) {
  const faces = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
    [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
    [[1, 0, 0], [0, 0, 1], [0, -1, 0]], [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
  ];
  const vcount = 6 * (n + 1) * (n + 1);
  const pos = new Float32Array(vcount * 3), nor = new Float32Array(vcount * 3), col = new Float32Array(vcount * 3);
  const idx = [];
  const d = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), q = new THREE.Vector3();
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), p0 = new THREE.Vector3(), c = new THREE.Color();
  let v = 0;
  const e = 0.012;
  for (const [u, w, f] of faces) {
    const base = v;
    for (let j = 0; j <= n; j++)
      for (let i = 0; i <= n; i++) {
        // Tangent-warped grid keeps cells even across the cube sphere.
        const a = Math.tan(((i / n) * 2 - 1) * Math.PI / 4), b = Math.tan(((j / n) * 2 - 1) * Math.PI / 4);
        d.set(u[0] * a + w[0] * b + f[0], u[1] * a + w[1] * b + f[1], u[2] * a + w[2] * b + f[2]).normalize();
        p0.copy(d).multiplyScalar(R + terrain.height(d));
        t1.set(0, 1, 0).cross(d);
        if (t1.lengthSq() < 1e-4) t1.set(1, 0, 0).cross(d);
        t1.normalize();
        t2.crossVectors(d, t1);
        q.copy(d).addScaledVector(t1, e).normalize();
        pa.copy(q).multiplyScalar(R + terrain.height(q)).sub(p0);
        q.copy(d).addScaledVector(t2, e).normalize();
        pb.copy(q).multiplyScalar(R + terrain.height(q)).sub(p0);
        pa.cross(pb).normalize();
        if (pa.dot(d) < 0) pa.negate();
        pos.set([p0.x, p0.y, p0.z], v * 3);
        nor.set([pa.x, pa.y, pa.z], v * 3);
        terrain.groundColor(d, c);
        col.set([c.r, c.g, c.b], v * 3);
        v++;
      }
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const a = base + j * (n + 1) + i, b = a + 1, cc = a + n + 1, dd = cc + 1;
        idx.push(a, b, dd, a, dd, cc);
      }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, vertexSoft({ roughness: 0.92, side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  return mesh;
}

// ── plant geometry ──────────────────────────────────────────
function plant(parts) {
  // parts: [{ geo, color, tint, to, m }]; sway grows with height.
  const gs = parts.map(({ geo, color, tint = 0, to, m }) => {
    const g = paint(geo, color, to);
    if (m) g.applyMatrix4(m);
    const c = g.attributes.position.count;
    g.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(c).fill(tint), 1));
    return g;
  });
  const g = mergeGeometries(gs, false);
  g.computeBoundingBox();
  const h = g.boundingBox.max.y || 1;
  const p = g.attributes.position;
  const sway = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) { const k = Math.max(0, p.getY(i) / h); sway[i] = k * k; }
  g.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
  return g;
}

function blade(h, w, bend) {
  const seg = 3, pos = [], idx = [], nor = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, ww = w * (1 - t * t), y = h * t, z = bend * t * t;
    pos.push(-ww / 2, y, z, ww / 2, y, z);
    nor.push(0, 1, 0.1, 0, 1, 0.1);
  }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

function tuftGeo() {
  const r = rng(5), parts = [];
  for (let i = 0; i < 7; i++) {
    const a = r() * 6.28, rad = r() * 0.09;
    parts.push({
      geo: blade(0.2 + r() * 0.2, 0.055, 0.05 + r() * 0.1), color: '#b8bcb0', to: '#ffffff', tint: 1,
      m: xf([Math.cos(a) * rad, 0, Math.sin(a) * rad], [0, r() * 6.28, 0]),
    });
  }
  return plant(parts);
}

function stem(h) {
  return { geo: new THREE.CylinderGeometry(0.009, 0.014, h, 5), color: '#7cc08b', to: '#9ad7a0', m: xf([0, h / 2, 0]) };
}
function leaf(y, a) {
  return { geo: new THREE.IcosahedronGeometry(0.06, 1), color: '#8fd19b', m: xf([Math.cos(a) * 0.05, y, Math.sin(a) * 0.05], [0, -a, 0.5], [1.1, 0.16, 0.5]) };
}

function blossomGeo() {
  const h = 0.36, parts = [stem(h), leaf(0.12, 0.6), leaf(0.2, 3.4)];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push({
      geo: new THREE.IcosahedronGeometry(0.06, 1), color: '#ffffff', to: '#f2e9ee', tint: 1,
      m: xf([Math.cos(a) * 0.07, h + 0.01, Math.sin(a) * 0.07], [0, -a, 0.22], [1.15, 0.26, 0.72]),
    });
  }
  parts.push({ geo: new THREE.IcosahedronGeometry(0.036, 1), color: '#ffd776', m: xf([0, h + 0.025, 0], [0, 0, 0], [1, 0.6, 1]) });
  return plant(parts);
}

function tulipGeo() {
  const h = 0.4, parts = [stem(h), leaf(0.1, 2.1), leaf(0.16, 5.2)];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push({
      geo: new THREE.IcosahedronGeometry(0.07, 1), color: '#ffffff', to: '#fff', tint: 1,
      m: xf([Math.cos(a) * 0.035, h + 0.06, Math.sin(a) * 0.035], [0, -a, -0.16], [0.5, 1.2, 0.72]),
    });
  }
  return plant(parts);
}

function peonyGeo() {
  const h = 0.32, parts = [stem(h), leaf(0.14, 1)];
  const r = rng(9);
  for (let ring = 0; ring < 3; ring++) {
    const n = 7 - ring * 2, rad = 0.1 - ring * 0.035;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring;
      parts.push({
        geo: new THREE.IcosahedronGeometry(0.07 - ring * 0.012, 1), color: ring ? '#ffffff' : '#fff2f4', tint: 1,
        m: xf([Math.cos(a) * rad, h + 0.03 + ring * 0.03, Math.sin(a) * rad], [r() * 0.3, -a, 0.5 + ring * 0.25], [1, 0.45, 0.82]),
      });
    }
  }
  return plant(parts);
}

function lavenderGeo() {
  const h = 0.42, parts = [stem(h)];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.3, y = h - 0.08 + i * 0.022;
    parts.push({ geo: new THREE.IcosahedronGeometry(0.024 - i * 0.0012, 0), color: '#ffffff', tint: 1, m: xf([Math.cos(a) * 0.024, y, Math.sin(a) * 0.024]) });
  }
  return plant(parts);
}

function canopyGeo(seed) {
  const r = rng(seed), blobs = [];
  for (let i = 0; i < 9; i++) {
    const a = r() * 6.28, rad = 0.45 + r() * 0.55, y = 0.1 + r() * 0.75;
    blobs.push([Math.cos(a) * rad * (1 - y * 0.45), y, Math.sin(a) * rad * (1 - y * 0.45), 0.42 + r() * 0.25]);
  }
  blobs.push([0, 0.55, 0, 0.75]);
  const sdf = (x, y, z) => {
    let d = 1e9;
    for (const b of blobs) d = smin(d, sphere(x, y, z, b[0], b[1], b[2], b[3]), 0.22);
    return d + (fbm(x * 3 + 9, y * 3, z * 3) - 0.5) * 0.14;
  };
  const dark = new THREE.Color('#c9b4c0'), light = new THREE.Color('#ffffff');
  const color = (x, y, z, c) => c.copy(dark).lerp(light, sstep(-0.3, 0.95, y + (fbm(x * 4, y * 4, z * 4) - 0.5) * 0.5));
  const g = sdfGeometry({ sdf, color, min: [-1.5, -0.6, -1.5], max: [1.5, 1.7, 1.5], cell: 0.085 });
  const c = g.attributes.position.count;
  g.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(c).fill(1), 1));
  const sway = new Float32Array(c);
  for (let i = 0; i < c; i++) sway[i] = 0.3;
  g.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);

export function createFlora(terrain, stops, blocked, q) {
  const group = new THREE.Group();
  const r = rng(77);
  const mat = windMaterial({ side: THREE.DoubleSide });
  const m = new THREE.Matrix4(), quat = new THREE.Quaternion(), spin = new THREE.Quaternion();
  const pos = new THREE.Vector3(), scl = new THREE.Vector3(), d = new THREE.Vector3(), col = new THREE.Color();

  // Scatter within the band the camera actually sees, thinning toward the poles.
  const sample = (minZ, maxZ, k = 1) => {
    for (let tries = 0; tries < 40; tries++) {
      const phi = r() * Math.PI * 2;
      const bias = Math.pow(r(), 1.5);
      const z = (minZ + bias * (maxZ - minZ)) * (r() < 0.62 ? -1 : 1);
      d.copy(dirAt(phi, z));
      if (!blocked(d, k)) return d;
    }
    return null;
  };
  // Whole-sphere sampling, for what only the orbit shots ever see.
  const sampleFar = (minZ) => {
    for (let tries = 0; tries < 40; tries++) {
      const u = r() * 2 - 1, a = r() * 6.283, q2 = Math.sqrt(1 - u * u);
      d.set(q2 * Math.cos(a), q2 * Math.sin(a), u);
      if (Math.abs(d.z) * R > minZ) return d;
    }
    return null;
  };
  const scatter = (geo, count, { minZ = 1.0, maxZ = 7.5, s0 = 0.7, s1 = 1.2, colorFn, cast = false, material = mat, front = 0, far = false, k = 1 }) => {
    const im = new THREE.InstancedMesh(geo, material, count);
    im.castShadow = cast;
    im.receiveShadow = true;
    im.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      // `front` keeps tall plants out of the strip between the camera and the path.
      const pick = () => (far ? sampleFar(minZ) : sample(minZ, maxZ, k));
      let ok = pick();
      for (let t = 0; ok && t < 8 && d.z * R > 0 && d.z * R < front; t++) ok = pick();
      if (!ok || (d.z * R > 0 && d.z * R < front)) { im.setMatrixAt(i, m.makeScale(0, 0, 0)); im.setColorAt(i, col.set('#fff')); continue; }
      const hgt = terrain.height(d);
      pos.copy(d).multiplyScalar(R + hgt - 0.012);
      quat.setFromUnitVectors(UP, d);
      spin.setFromAxisAngle(UP, r() * 6.28);
      quat.multiply(spin);
      const s = s0 + r() * (s1 - s0);
      scl.setScalar(s);
      m.compose(pos, quat, scl);
      im.setMatrixAt(i, m);
      colorFn(d, col);
      im.setColorAt(i, col);
    }
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor.needsUpdate = true;
    group.add(im);
    return im;
  };

  const grassC = (dd, c) => {
    terrain.zoneMix(dd, 'grass', c);
    c.offsetHSL(0, 0, (r() - 0.5) * 0.06);
  };
  const flowerC = (dd, c) => {
    const f = ZONES[terrain.nearestZone(dd, (r() - 0.5) * 0.5).zone].flowers;
    c.set(f[(r() * f.length) | 0]);
  };

  scatter(tuftGeo(), q ? 16000 : 7000, { minZ: 0.82, s0: 0.55, s1: 1.15, colorFn: grassC, k: 0.62 });
  const tuft2 = tuftGeo(), bl2 = blossomGeo(), pe2 = peonyGeo();
  scatter(tuft2, q ? 7000 : 2500, { minZ: 5.5, s0: 1.4, s1: 2.4, colorFn: grassC, far: true });
  scatter(bl2, q ? 3000 : 1200, { minZ: 5.5, s0: 1.3, s1: 2.1, colorFn: flowerC, far: true });
  scatter(pe2, q ? 1400 : 600, { minZ: 5.5, s0: 1.3, s1: 2.2, colorFn: flowerC, far: true });
  scatter(blossomGeo(), q ? 5200 : 2200, { minZ: 0.95, maxZ: 7, s0: 0.5, s1: 0.95, colorFn: flowerC, cast: !!q, front: 2.2, k: 0.85 });
  scatter(tulipGeo(), q ? 1800 : 800, { minZ: 1.0, maxZ: 6, s0: 0.5, s1: 0.85, colorFn: flowerC, cast: !!q, front: 2.6 });
  scatter(peonyGeo(), q ? 1500 : 700, { minZ: 1.0, maxZ: 6, s0: 0.5, s1: 0.95, colorFn: flowerC, cast: !!q, front: 2.6 });
  scatter(lavenderGeo(), q ? 1800 : 800, { minZ: 1.1, maxZ: 7, s0: 0.6, s1: 1.1, colorFn: flowerC, front: 2.2 });

  // Trees
  const canopies = [canopyGeo(3), canopyGeo(11)];
  const treeC = (dd, c) => {
    const z = terrain.nearestZone(dd).zone;
    const pal = {
      start: ['#ffc4d6', '#ffd9e4'], mehendi: ['#b8e6c4', '#d7f2c8'], haldi: ['#ffd27a', '#ffe39b'],
      sangeet: ['#cdb4f7', '#b9c4fa'], wedding: ['#ffb3c7', '#ffd0d8'],
    }[z];
    c.set(pal[(r() * pal.length) | 0]);
  };
  const treeSpots = [];
  const trunkBag = new Bag();
  trunkBag.add(new THREE.CylinderGeometry(0.09, 0.17, 1.5, 9), '#b98f7f', xf([0, 0.7, 0]), '#a57c70');
  trunkBag.add(new THREE.CylinderGeometry(0.035, 0.08, 0.8, 7), '#b98f7f', xf([0.26, 1.1, 0.04], [0, 0, -0.7]));
  trunkBag.add(new THREE.CylinderGeometry(0.035, 0.08, 0.8, 7), '#b98f7f', xf([-0.22, 1.2, -0.06], [0, 0, 0.6]));
  const trunkGeo = trunkBag.build().geometry;
  const count = q ? 110 : 70;
  for (let i = 0; i < count; i++) {
    const near = i % 2 === 0;
    const pt = i % 3 === 2 ? sampleFar(7) : sample(near ? 3.0 : 4.6, near ? 5.2 : 8);
    if (!pt) continue;
    // Keep the camera's near side clear so trees never block the dioramas.
    if (pt.z * R > 0 && pt.z * R < 5.4) continue;
    if (treeSpots.some((t) => t.d.distanceTo(pt) * R < 1.3)) continue;
    treeSpots.push({ d: pt.clone(), s: 0.75 + r() * 0.6, k: i % 2 });
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, vertexSoft(), treeSpots.length);
  trunks.castShadow = true;
  trunks.frustumCulled = false;
  const byCanopy = [treeSpots.filter((t) => !t.k), treeSpots.filter((t) => t.k)];
  let ti = 0;
  byCanopy.forEach((list, ci) => {
    const im = new THREE.InstancedMesh(canopies[ci], windMaterial(), list.length);
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    list.forEach((t, i) => {
      const h = terrain.height(t.d);
      quat.setFromUnitVectors(UP, t.d);
      spin.setFromAxisAngle(UP, r() * 6.28);
      quat.multiply(spin);
      scl.setScalar(t.s);
      pos.copy(t.d).multiplyScalar(R + h - 0.03);
      m.compose(pos, quat, scl);
      trunks.setMatrixAt(ti++, m);
      pos.copy(t.d).multiplyScalar(R + h + 1.55 * t.s);
      m.compose(pos, quat, scl);
      im.setMatrixAt(i, m);
      treeC(t.d, col);
      im.setColorAt(i, col);
    });
    group.add(im);
  });
  group.add(trunks);

  // Stepping stones along the path
  const stoneGeo = new THREE.IcosahedronGeometry(0.2, 2);
  stoneGeo.scale(1, 0.14, 0.72);
  const stones = new THREE.InstancedMesh(paint(stoneGeo, '#ffffff'), vertexSoft({ roughness: 0.65 }), 120);
  stones.receiveShadow = true;
  stones.frustumCulled = false;
  for (let i = 0; i < 120; i++) {
    const phi = (i / 120) * Math.PI * 2;
    const zz = (i % 2 ? 0.34 : -0.34) + (r() - 0.5) * 0.1;
    d.copy(dirAt(phi, zz));
    pos.copy(d).multiplyScalar(R + 0.005);
    quat.setFromUnitVectors(UP, d);
    spin.setFromAxisAngle(UP, r() * 6.28);
    quat.multiply(spin);
    m.compose(pos, quat, scl.setScalar(0.65 + r() * 0.4));
    stones.setMatrixAt(i, m);
    stones.setColorAt(i, col.set(['#fde7ee', '#ece6fb', '#fff4d9', '#dff5ea'][i % 4]));
  }
  group.add(stones);
  return group;
}
