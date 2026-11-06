import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value noise, cheap and plenty for gentle hills.
function h3(x, y, z) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const f = (t) => t * t * (3 - 2 * t);
  const u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const L = lerp;
  return L(
    L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
    L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}
export const fbm = (x, y, z) =>
  noise3(x, y, z) * 0.55 + noise3(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3) * 0.15;

// Uniforms every "soft" material shares, so mood changes are one write.
export const shared = {
  uTime: { value: 0 },
  uRim: { value: new THREE.Color('#fff0f4') },
  uRimK: { value: 0.35 },
};

const RIM = `float rimF = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 2.6);
  outgoingLight += uRim * rimF * uRimK;
  #include <opaque_fragment>`;

function patchRim(mat) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.uRim = shared.uRim;
    s.uniforms.uRimK = shared.uRimK;
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim; uniform float uRimK;')
      .replace('#include <opaque_fragment>', RIM);
  };
  return mat;
}

export function soft(opts = {}) {
  return patchRim(new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0, ...opts }));
}
export const vertexSoft = (opts = {}) => soft({ vertexColors: true, ...opts });

// Instanced plants: per-vertex aTint (1 = takes instance colour) and aSway (wind weight).
export function windMaterial(opts = {}) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, ...opts });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.uTime;
    s.uniforms.uRim = shared.uRim;
    s.uniforms.uRimK = shared.uRimK;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTint; attribute float aSway; uniform float uTime;')
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
         #ifdef USE_INSTANCING_COLOR
           vColor.rgb = mix(color.rgb, color.rgb * instanceColor.rgb, aTint);
         #endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec3 wOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
         float wPh = dot(wOrigin, vec3(1.3, 0.9, 1.1));
         transformed.x += sin(uTime * 1.6 + wPh) * aSway * 0.09;
         transformed.z += cos(uTime * 1.2 + wPh * 0.7) * aSway * 0.07;`,
      );
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim; uniform float uRimK;')
      .replace('#include <opaque_fragment>', RIM);
  };
  return mat;
}

const _c = new THREE.Color();
export function paint(geo, color, gradientTo = null, axis = 'y') {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.deleteAttribute('uv1');
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  g.computeBoundingBox();
  const lo = g.boundingBox.min[axis], hi = g.boundingBox.max[axis];
  const a = new THREE.Color(color), b = gradientTo ? new THREE.Color(gradientTo) : a;
  const ax = 'xyz'.indexOf(axis);
  for (let i = 0; i < pos.count; i++) {
    const t = hi > lo ? (pos.getComponent(i, ax) - lo) / (hi - lo) : 0;
    _c.copy(a).lerp(b, t);
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const _e = new THREE.Euler();
export const xf = (p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(_e.set(...r)),
    new THREE.Vector3(...(typeof s === 'number' ? [s, s, s] : s)),
  );

// Collects vertex-coloured pieces and merges them into a single draw call.
export class Bag {
  constructor() { this.parts = []; }
  add(geo, color, m, gradientTo, axis) {
    const g = paint(geo, color, gradientTo, axis);
    if (m) g.applyMatrix4(m);
    this.parts.push(g);
    return this;
  }
  ball(p, r, color, s = [1, 1, 1], detail = 2, gradientTo) {
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, xf(p, [0, 0, 0], s), gradientTo);
  }
  cyl(p, rt, rb, h, color, r = [0, 0, 0], seg = 14, gradientTo) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, xf(p, r), gradientTo);
  }
  lathe(p, profile, color, seg = 24, gradientTo, s = 1) {
    const pts = profile.map(([x, y]) => new THREE.Vector2(x, y));
    const curve = new THREE.SplineCurve(pts).getPoints(profile.length * 6);
    return this.add(new THREE.LatheGeometry(curve, seg), color, xf(p, [0, 0, 0], s), gradientTo);
  }
  tube(points, r, color, seg = 24, gradientTo) {
    const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return this.add(new THREE.TubeGeometry(c, seg, r, 7), color, null, gradientTo);
  }
  build(mat = vertexSoft(), { cast = true, receive = true } = {}) {
    const mesh = new THREE.Mesh(mergeGeometries(this.parts, false), mat);
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return mesh;
  }
}

// A string of little blooms along a sagging curve.
export function garland(bag, a, b, sag, n, r, colors, rand) {
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = [
      lerp(a[0], b[0], t) + (rand() - 0.5) * r * 0.5,
      lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag + (rand() - 0.5) * r * 0.5,
      lerp(a[2], b[2], t) + (rand() - 0.5) * r * 0.5,
    ];
    bag.ball(p, r * (0.85 + rand() * 0.35), colors[(rand() * colors.length) | 0], [1, 0.85, 1], 1);
  }
}

// A vertical strand of marigolds, the classic toran.
export function strand(bag, top, len, r, colors, rand, tassel) {
  const n = Math.round(len / (r * 1.5));
  for (let i = 0; i < n; i++) {
    bag.ball([top[0], top[1] - i * r * 1.5, top[2]], r * (0.9 + rand() * 0.2), colors[i % colors.length], [1, 0.8, 1], 1);
  }
  if (tassel) bag.ball([top[0], top[1] - n * r * 1.5, top[2]], r * 0.7, tassel, [1, 1.5, 1], 1);
}
