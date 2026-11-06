import * as THREE from 'three';
import { rng, soft, vertexSoft, Bag, xf, lerp } from './kit.js';
import { sdfGeometry, smin, sphere } from './sdf.js';
import { R } from './planet.js';

function petalGeo() {
  // A cupped teardrop built from a small grid.
  const nx = 4, ny = 5, pos = [], idx = [];
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const v = j / ny, u = i / nx - 0.5;
      const w = Math.sin(v * Math.PI * 0.92 + 0.12) * 0.5;
      pos.push(u * w * 1.2, v - 0.5, (u * u) * 0.5 - Math.sin(v * 3.14) * 0.14);
    }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const PETALS = ['#ffc1d0', '#ffe0e6', '#ffd9b0', '#f6d6ff', '#fff4f0', '#ffb3c6'];

// Drifting petals. The whole loop lives in the vertex shader.
export function ambientPetals(count) {
  const g = new THREE.InstancedBufferGeometry().copy(petalGeo());
  g.instanceCount = count;
  const seed = new Float32Array(count * 4), col = new Float32Array(count * 3);
  const r = rng(21), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    seed.set([r(), r(), r(), r()], i * 4);
    c.set(PETALS[i % PETALS.length]);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  g.setAttribute('aCol', new THREE.InstancedBufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: 18 }, uSize: { value: 0.09 }, uLight: { value: 1 } },
    vertexShader: `
      attribute vec4 aSeed; attribute vec3 aCol;
      uniform float uTime, uBox, uSize; uniform vec3 uCenter;
      varying vec3 vCol; varying float vShade;
      mat3 rot(vec3 a, float t){ a=normalize(a); float s=sin(t),c=cos(t),o=1.-c;
        return mat3(o*a.x*a.x+c,o*a.x*a.y-a.z*s,o*a.z*a.x+a.y*s,
                    o*a.x*a.y+a.z*s,o*a.y*a.y+c,o*a.y*a.z-a.x*s,
                    o*a.z*a.x-a.y*s,o*a.y*a.z+a.x*s,o*a.z*a.z+c); }
      void main(){
        float t = uTime;
        vec3 p = aSeed.xyz;
        p.y = fract(p.y - t * (0.022 + aSeed.w * 0.03));
        p.x = fract(p.x + t * 0.017 + sin(t * 0.5 + aSeed.y * 9.) * 0.012);
        p.z = fract(p.z + sin(t * 0.4 + aSeed.x * 7.) * 0.01);
        vec3 base = uCenter + (p - 0.5) * uBox;
        mat3 m = rot(aSeed.xyz - 0.5 + 0.01, t * (0.7 + aSeed.w) + aSeed.x * 6.28);
        vec3 lp = m * (position * uSize * (0.75 + aSeed.w * 0.7));
        vShade = 0.86 + 0.14 * (m * normal).y;
        vCol = aCol;
        gl_Position = projectionMatrix * viewMatrix * vec4(base + lp, 1.);
      }`,
    fragmentShader: `
      varying vec3 vCol; varying float vShade; uniform float uLight;
      void main(){ gl_FragColor = vec4(vCol * vShade * uLight, 1.);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// One-shot burst of petals, simulated on the CPU.
export class Burst {
  constructor(max = 300) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(petalGeo(), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 }), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.items = [];
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.c = new THREE.Color();
    this.head = 0;
  }
  fire(origin, n, power = 3.4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, up = 0.4 + Math.random() * 0.9;
      const sp = power * (0.45 + Math.random() * 0.75);
      const item = {
        p: origin.clone(), v: new THREE.Vector3(Math.cos(a) * sp * 0.7, up * sp, Math.sin(a) * sp * 0.45 + 0.8),
        r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: new THREE.Vector3(Math.random() * 7 - 3.5, Math.random() * 7 - 3.5, Math.random() * 7 - 3.5),
        life: 0, ttl: 2.8 + Math.random() * 2.2, size: 0.07 + Math.random() * 0.08,
      };
      const slot = this.head++ % this.max;
      this.items[slot] = item;
      this.mesh.setColorAt(slot, this.c.set(PETALS[slot % PETALS.length]));
    }
    this.mesh.count = Math.min(this.max, this.items.length);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt, t) {
    if (!this.mesh.count) return;
    let alive = 0;
    for (let i = 0; i < this.mesh.count; i++) {
      const it = this.items[i];
      if (!it) continue;
      it.life += dt;
      if (it.life <= it.ttl) alive++;
      const k = Math.exp(-2.1 * dt);
      it.v.multiplyScalar(k);
      it.v.y -= 1.1 * dt;
      it.v.x += Math.sin(t * 2 + i) * 0.4 * dt;
      it.p.addScaledVector(it.v, dt);
      it.r.addScaledVector(it.w, dt);
      const fade = Math.min(1, (it.ttl - it.life) * 2);
      const s = it.life > it.ttl ? 0 : it.size * Math.max(0, fade);
      this.q.setFromEuler(this.e.set(it.r.x, it.r.y, it.r.z));
      this.m.compose(it.p, this.q, this.s.setScalar(s));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    // Every petal has landed, so stop paying for them.
    if (!alive) { this.mesh.count = 0; this.items.length = 0; this.head = 0; }
  }
}

// Hearts that float off the pup when you pet it.
export class Hearts {
  constructor(n = 14) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#ff8fa8';
    x.beginPath();
    x.moveTo(64, 112);
    x.bezierCurveTo(4, 70, 14, 16, 48, 18);
    x.bezierCurveTo(58, 18, 64, 28, 64, 34);
    x.bezierCurveTo(64, 28, 70, 18, 80, 18);
    x.bezierCurveTo(114, 16, 124, 70, 64, 112);
    x.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    this.group = new THREE.Group();
    this.items = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      this.group.add(s);
      this.items.push({ s, life: 9, ttl: 1, v: new THREE.Vector3() });
    }
    this.next = 0;
  }
  pop(origin, n = 5) {
    for (let i = 0; i < n; i++) {
      const it = this.items[this.next++ % this.items.length];
      it.life = -i * 0.08;
      it.ttl = 1.1 + Math.random() * 0.5;
      it.s.position.copy(origin);
      it.v.set((Math.random() - 0.5) * 0.9, 1 + Math.random() * 0.7, 0.2);
      it.s.visible = true;
    }
  }
  update(dt) {
    for (const it of this.items) {
      if (it.life >= it.ttl) { it.s.visible = false; continue; }
      it.life += dt;
      if (it.life < 0) continue;
      const k = it.life / it.ttl;
      it.s.position.addScaledVector(it.v, dt);
      it.s.scale.setScalar(0.1 + 0.12 * Math.min(1, k * 5));
      it.s.material.opacity = Math.min(1, (1 - k) * 2.4);
    }
  }
}

function cloudGeo(seed) {
  const r = rng(seed), blobs = [];
  for (let i = 0; i < 7; i++) blobs.push([(i - 3) * 0.52 + (r() - 0.5) * 0.2, (r() - 0.25) * 0.28, (r() - 0.5) * 0.6, 0.36 + (1 - Math.abs(i - 3) / 3) * 0.3 + r() * 0.12]);
  const sdf = (x, y, z) => {
    let d = 1e9;
    for (const b of blobs) d = smin(d, sphere(x, y, z, b[0], b[1], b[2], b[3]), 0.28);
    return Math.max(d, -(y + 0.26)); // flat-ish base
  };
  const lo = new THREE.Color('#f6dbe6'), hi = new THREE.Color('#ffffff');
  const color = (x, y, z, c) => c.copy(lo).lerp(hi, Math.min(1, Math.max(0, (y + 0.25) / 0.6)));
  return sdfGeometry({ sdf, color, min: [-2.4, -0.5, -1.2], max: [2.4, 1.1, 1.2], cell: 0.09 });
}

function balloon(bag, c1, c2) {
  const n = 12, prof = [[0.001, 0.0], [0.18, 0.08], [0.56, 0.6], [0.68, 1.08], [0.56, 1.56], [0.28, 1.84], [0.001, 1.92]];
  const pts = new THREE.SplineCurve(prof.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(30);
  for (let i = 0; i < n; i++) {
    bag.add(new THREE.LatheGeometry(pts, 3, (i / n) * Math.PI * 2, (Math.PI * 2) / n), i % 2 ? c1 : c2, null);
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bag.tube([[x * 0.13, 0.05, z * 0.13], [x * 0.11, -0.3, z * 0.11]], 0.006, '#d6b48a', 2);
  bag.add(new THREE.BoxGeometry(0.26, 0.2, 0.26), '#e7bd8e', xf([0, -0.38, 0]));
}

// Everything that orbits the planet: clouds, balloons, rings of gold.
export function createSkyObjects(q) {
  const group = new THREE.Group();
  const ticks = [];
  const r = rng(404);
  const geos = [cloudGeo(2), cloudGeo(8), cloudGeo(15)];
  const cloudMat = vertexSoft({ roughness: 1, emissive: '#fff4f6', emissiveIntensity: 0.12 });
  const n = q ? 14 : 9;
  const clouds = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geos[i % 3], cloudMat);
    const a = (i / n) * Math.PI * 2 + r() * 0.3, rad = R + 7.5 + r() * 3.5, z = -4 - r() * 6;
    m.position.set(Math.cos(a) * rad, Math.sin(a) * rad, z);
    m.rotation.z = a - Math.PI / 2;
    m.rotation.y = (r() - 0.5) * 0.5;
    const cs = 0.7 + r() * 0.8;
    m.scale.set(cs, cs * 1.35, cs * 1.2);
    clouds.add(m);
  }
  group.add(clouds);
  ticks.push((t, dt) => { clouds.rotation.z += dt * 0.012; });

  const balloons = new THREE.Group();
  [['#ffc4d2', '#fff6ec', 0.9, 13.6, -4], ['#c9efdb', '#fff6ec', 2.9, 14.3, -3], ['#fff0b5', '#ffc9a0', 4.6, 13.3, -5], ['#dacdfb', '#fff6ec', 5.7, 14, -3]].forEach(([a, b, ang, rad, z], i) => {
    const bag = new Bag();
    balloon(bag, a, b);
    const m = bag.build();
    m.castShadow = false;
    m.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad, z);
    m.rotation.z = ang - Math.PI / 2;
    m.scale.setScalar(1.1);
    balloons.add(m);
    ticks.push((t) => { m.position.z = z + Math.sin(t * 0.3 + i) * 0.35; });
  });
  group.add(balloons);
  ticks.push((t, dt) => { balloons.rotation.z -= dt * 0.02; });

  // Two interlocked rings: the wedding bands, at planet scale.
  const gold = new THREE.MeshStandardMaterial({ color: '#f7d58c', metalness: 0.65, roughness: 0.3, emissive: '#b98a3a', emissiveIntensity: 0.32 });
  const rings = new THREE.Group();
  const rg = new THREE.TorusGeometry(R + 3.2, 0.045, 12, 200);
  const r1 = new THREE.Mesh(rg, gold), r2 = new THREE.Mesh(rg, gold);
  r1.rotation.set(1.28, 0.34, 0);
  r2.rotation.set(1.28, -0.34, 0);
  rings.add(r1, r2);
  // Pearls strung along each ring
  const pearl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 2), new THREE.MeshStandardMaterial({ color: '#fff4ee', roughness: 0.25, emissive: '#ffd7dc', emissiveIntensity: 0.25 }), 48);
  const m = new THREE.Matrix4(), v = new THREE.Vector3();
  for (let i = 0; i < 48; i++) {
    const a = (i / 24) * Math.PI * 2, ring = i % 2 ? r1 : r2;
    ring.updateMatrix();
    v.set(Math.cos(a) * (R + 3.2), Math.sin(a) * (R + 3.2), 0).applyMatrix4(ring.matrix);
    m.makeTranslation(v.x, v.y, v.z);
    pearl.setMatrixAt(i, m);
  }
  pearl.frustumCulled = false;
  rings.add(pearl);
  group.add(rings);
  ticks.push((t, dt) => { rings.rotation.y += dt * 0.06; });
  return { group, rings, ticks };
}

export { lerp };
