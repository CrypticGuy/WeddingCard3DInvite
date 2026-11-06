import * as THREE from 'three';
import { soft, vertexSoft, Bag, xf, lerp, clamp } from './kit.js';
import { R } from './planet.js';
import { invite } from '../config.js';

export const EW = 1.8, EH = 2.5;           // envelope size
export const CARD_W = 1.6, CARD_H = 2.24;  // 5:7 card

function paper(base, speck) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = speck;
    x.globalAlpha = Math.random() * 0.1;
    x.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 9, 1);
  }
  return c;
}

function uvFromBounds(g, w, h) {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) / w + 0.5;
    uv[i * 2 + 1] = p.getY(i) / h + 0.5;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

function pocketTexture() {
  const c = paper('#fff6ee', '#f6d9d4');
  const k = c.getContext('2d');
  k.globalAlpha = 1;
  k.fillStyle = '#b5617f';
  k.textAlign = 'center';
  k.font = '70px "Imperial Script", cursive';
  k.fillText(invite.envelopeLine, 256, 405);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function linerTexture() {
  const c = paper('#c9ead6', '#ffffff');
  const k = c.getContext('2d');
  k.globalAlpha = 0.55;
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    const px = x * 60 + (y % 2) * 30, py = y * 60;
    k.fillStyle = ['#fff', '#ffd9e2', '#fff2c9'][(x + y) % 3];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * 6.28;
      k.beginPath();
      k.ellipse(px + Math.cos(a) * 8, py + Math.sin(a) * 8, 7, 4, a, 0, 6.3);
      k.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function cardTexture(art) {
  const W = 1024, H = 1434;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const k = c.getContext('2d');
  k.fillStyle = '#fffaf5';
  k.fillRect(0, 0, W, H);
  if (art) k.drawImage(art, 0, 0, W, H);
  k.textAlign = 'center';
  k.textBaseline = 'alphabetic';
  k.fillStyle = '#8a5a72';
  k.font = '500 34px "Jost Variable", sans-serif';
  if ('letterSpacing' in k) k.letterSpacing = '6px';
  k.fillText(invite.cardIntro.toUpperCase(), W / 2, 560);
  if ('letterSpacing' in k) k.letterSpacing = '0px';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

// Names sit on their own layer so they can write themselves on.
function namesTexture() {
  const W = 1024, H = 640;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const k = c.getContext('2d');
  k.textAlign = 'center';
  k.fillStyle = '#6d3f5c';
  const title = '300 italic 148px "Fraunces Variable", Georgia, serif';
  k.font = title;
  k.fillText(invite.couple.first, W / 2, 170);
  k.font = '150px "Imperial Script", cursive';
  k.fillStyle = '#d98ba3';
  k.fillText('&', W / 2, 322);
  k.fillStyle = '#6d3f5c';
  k.font = title;
  k.fillText(invite.couple.second, W / 2, 472);
  k.fillStyle = '#8a5a72';
  k.font = '500 34px "Jost Variable", sans-serif';
  if ('letterSpacing' in k) k.letterSpacing = '6px';
  k.fillText(invite.cardOutro.toUpperCase(), W / 2, 590);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

export function createEnvelope({ art } = {}) {
  const group = new THREE.Group();   // stands on the planet, leaning back
  const lean = new THREE.Group();
  lean.rotation.x = -0.16;
  group.add(lean);

  const w = EW / 2, h = EH / 2;
  const body = new THREE.Group();
  body.position.y = h + 0.02;
  lean.add(body);

  const paperMat = soft({ map: new THREE.CanvasTexture(paper('#ffe6e1', '#ffffff')), roughness: 0.82 });
  paperMat.map.colorSpace = THREE.SRGBColorSpace;
  const backMat = soft({ color: '#f7d7cf', roughness: 0.85 });

  const back = new THREE.Mesh(new THREE.BoxGeometry(EW, EH, 0.03), backMat);
  back.position.z = -0.03;
  back.castShadow = true;
  body.add(back);
  const liner = new THREE.Mesh(new THREE.PlaneGeometry(EW - 0.08, EH - 0.08), soft({ map: linerTexture() }));
  liner.position.z = -0.012;
  body.add(liner);

  // Card, tucked inside; later it flies free of the envelope.
  const card = new THREE.Group();
  const cardMat = new THREE.MeshBasicMaterial({ map: cardTexture(art) });
  const cardFace = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), cardMat);
  const cardEdge = new THREE.Mesh(new THREE.BoxGeometry(CARD_W, CARD_H, 0.012), soft({ color: '#fff4ee' }));
  cardEdge.position.z = -0.008;
  cardEdge.castShadow = true;
  card.add(cardEdge, cardFace);

  const reveal = { value: 0 };
  const namesMat = new THREE.MeshBasicMaterial({ map: namesTexture(), transparent: true, depthWrite: false, toneMapped: false });
  namesMat.onBeforeCompile = (s) => {
    s.uniforms.uReveal = reveal;
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uReveal;')
      .replace(
        '#include <opaque_fragment>',
        `float rv = uReveal * 1.5;
         float sweep = vMapUv.x * 0.28 + (1.0 - vMapUv.y) * 1.0;
         diffuseColor.a *= smoothstep(sweep, sweep + 0.14, rv);
         #include <opaque_fragment>`,
      );
  };
  const names = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W * 0.86, CARD_W * 0.86 * (640 / 1024)), namesMat);
  names.position.set(0, -0.3, 0.004);
  card.add(names);
  body.add(card);

  // Front pocket with a V notch for the flap
  const s = new THREE.Shape();
  s.moveTo(-w, -h); s.lineTo(w, -h); s.lineTo(w, h); s.lineTo(0, h - 1.14); s.lineTo(-w, h); s.closePath();
  const pocketG = uvFromBounds(new THREE.ShapeGeometry(s), EW, EH);
  const pocket = new THREE.Mesh(pocketG, soft({ map: pocketTexture(), roughness: 0.8 }));
  pocket.position.z = 0.03;
  pocket.castShadow = true;
  pocket.receiveShadow = true;
  body.add(pocket);

  // Fold lines on the pocket, gentle embossing
  const fold = new Bag();
  fold.tube([[-w + 0.02, h - 0.02, 0.034], [0, h - 1.14, 0.034]], 0.005, '#e9c48a', 2);
  fold.tube([[w - 0.02, h - 0.02, 0.034], [0, h - 1.14, 0.034]], 0.005, '#e9c48a', 2);
  body.add(fold.build(vertexSoft(), { cast: false }));

  // Top flap, hinged along the top edge
  const flap = new THREE.Group();
  flap.position.set(0, h, 0.036);
  const fs = new THREE.Shape();
  fs.moveTo(-w, 0); fs.lineTo(w, 0); fs.lineTo(0.09, -1.26);
  fs.quadraticCurveTo(0, -1.33, -0.09, -1.26); fs.closePath();
  const flapG = new THREE.ShapeGeometry(fs, 10);
  const uv = flapG.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / EW + 0.5, uv.getY(i) / EW + 1);
  const flapOut = new THREE.Mesh(flapG, paperMat);
  flapOut.castShadow = true;
  flapOut.receiveShadow = true;
  const flapIn = new THREE.Mesh(flapG, soft({ map: liner.material.map, side: THREE.BackSide }));
  // Gold edge along the flap
  const fe = new Bag();
  fe.tube([[-w + 0.03, -0.01, 0.003], [0.0, -1.3, 0.003]], 0.006, '#e9c48a', 2);
  fe.tube([[w - 0.03, -0.01, 0.003], [0.0, -1.3, 0.003]], 0.006, '#e9c48a', 2);
  flap.add(flapOut, flapIn, fe.build(vertexSoft(), { cast: false }));
  body.add(flap);

  // Thread wrapping the envelope, plus the bow
  const KNOT_Y = 0.02;
  const threadCol = '#e87f97';
  const wraps = new THREE.Group();
  const wb = new Bag();
  wb.add(new THREE.BoxGeometry(EW + 0.02, 0.028, 0.012), threadCol, xf([0, KNOT_Y, 0]));
  wb.add(new THREE.BoxGeometry(EW + 0.02, 0.012, 0.014), '#f4c882', xf([0, KNOT_Y + 0.022, 0]));
  wraps.add(wb.build());
  const vert = new THREE.Group();
  wraps.position.z = 0.062;
  body.add(wraps);

  const bow = new THREE.Group();
  bow.position.set(0, KNOT_Y, 0.09);
  const bb = new Bag();
  for (const sgn of [1, -1]) {
    bb.tube([[0, 0, 0], [0.18 * sgn, 0.13, 0.02], [0.4 * sgn, 0.16, 0.03], [0.46 * sgn, 0.02, 0.02], [0.32 * sgn, -0.09, 0.02], [0.1 * sgn, -0.04, 0.01], [0, 0, 0]], 0.022, threadCol, 40);
    bb.tube([[0, 0, 0], [0.09 * sgn, -0.16, 0.02], [0.17 * sgn, -0.36, 0.015]], 0.015, threadCol, 12);
  }
  bb.ball([0, 0, 0.012], 0.055, '#f4c882', [1, 0.92, 0.75], 2);
  bow.add(bb.build());
  body.add(bow);

  const knotAnchor = new THREE.Object3D();
  knotAnchor.position.set(0, KNOT_Y, 0.11);
  body.add(knotAnchor);

  return { group, lean, body, flap, card, cardFace, names, reveal, wraps, vert, bow, knotAnchor, EW, EH };
}

// Verlet thread: one end on the bow, the other in the pup's mouth.
export class Thread {
  constructor(nodes = 34, length = 2.7) {
    this.n = nodes;
    this.seg = length / (nodes - 1);
    this.p = new Float32Array(nodes * 3);
    this.o = new Float32Array(nodes * 3);
    this.pinA = new THREE.Vector3();
    this.pinB = new THREE.Vector3();
    this.hasA = true;
    this.hasB = false;
    this.acc = 0;

    const radial = 6;
    this.radial = radial;
    const verts = nodes * radial;
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(verts * 3), 3);
    this.nor = new THREE.BufferAttribute(new Float32Array(verts * 3), 3);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.nor.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pos);
    geo.setAttribute('normal', this.nor);
    const idx = [];
    for (let i = 0; i < nodes - 1; i++)
      for (let j = 0; j < radial; j++) {
        const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = a + radial, d = b + radial;
        idx.push(a, c, b, b, c, d);
      }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, soft({ color: '#e87f97', roughness: 0.5 }));
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;

    const tb = new Bag();
    tb.ball([0, 0, 0], 0.042, '#f4c882', [1, 1, 1], 2);
    tb.add(new THREE.ConeGeometry(0.058, 0.16, 12), '#f4c882', xf([0, -0.1, 0], [Math.PI, 0, 0]), '#e87f97');
    this.tassel = tb.build();
    this.mesh.add(this.tassel);
  }

  layOut(start, end) {
    // Hang from the knot straight down, then run along the ground to the tassel.
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = lerp(start.x, end.x, t), z = lerp(start.z, end.z, t);
      const y = lerp(start.y, end.y, Math.min(1, t * 2.1));
      this.p.set([x, y, z], i * 3);
      this.o.set([x, y, z], i * 3);
    }
    this.pinA.copy(start);
    for (let i = 0; i < 180; i++) this.step(1 / 120);
  }

  step(h) {
    const { p, o, n, seg } = this;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      const x = p[k], y = p[k + 1], z = p[k + 2];
      const vx = (x - o[k]) * 0.985, vy = (y - o[k + 1]) * 0.985, vz = (z - o[k + 2]) * 0.985;
      o[k] = x; o[k + 1] = y; o[k + 2] = z;
      p[k] = x + vx; p[k + 1] = y + vy - 7.5 * h * h; p[k + 2] = z + vz;
    }
    for (let it = 0; it < 18; it++) {
      for (let i = 0; i < n - 1; i++) {
        const a = i * 3, b = a + 3;
        const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-5, f = ((d - seg) / d) * 0.5;
        p[a] += dx * f; p[a + 1] += dy * f; p[a + 2] += dz * f;
        p[b] -= dx * f; p[b + 1] -= dy * f; p[b + 2] -= dz * f;
      }
      if (this.hasA) { p[0] = this.pinA.x; p[1] = this.pinA.y; p[2] = this.pinA.z; }
      if (this.hasB) { const k = (n - 1) * 3; p[k] = this.pinB.x; p[k + 1] = this.pinB.y; p[k + 2] = this.pinB.z; }
      // Rest on the planet
      const floor = R + 0.03;
      for (let i = 0; i < n; i++) {
        const k = i * 3, l = Math.hypot(p[k], p[k + 1], p[k + 2]);
        if (l < floor) {
          const s = floor / l;
          p[k] *= s; p[k + 1] *= s; p[k + 2] *= s;
          o[k] = lerp(o[k], p[k], 0.25); o[k + 2] = lerp(o[k + 2], p[k + 2], 0.25);
        }
      }
    }
  }

  update(dt) {
    this.acc = Math.min(this.acc + dt, 1 / 20);
    const h = 1 / 120;
    while (this.acc >= h) { this.step(h); this.acc -= h; }
    this.sync();
  }

  sync() {
    const { p, n, radial, pos, nor } = this;
    const t = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < n; i++) {
      const k = i * 3, k0 = Math.max(0, i - 1) * 3, k1 = Math.min(n - 1, i + 1) * 3;
      t.set(p[k1] - p[k0], p[k1 + 1] - p[k0 + 1], p[k1 + 2] - p[k0 + 2]).normalize();
      a.crossVectors(t, up).normalize();
      b.crossVectors(t, a).normalize();
      for (let j = 0; j < radial; j++) {
        const ang = (j / radial) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
        const nx = a.x * c + b.x * s, ny = a.y * c + b.y * s, nz = a.z * c + b.z * s;
        const v = i * radial + j, r = 0.016;
        pos.setXYZ(v, p[k] + nx * r, p[k + 1] + ny * r, p[k + 2] + nz * r);
        nor.setXYZ(v, nx, ny, nz);
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    const e = (n - 1) * 3;
    this.tassel.position.set(p[e], p[e + 1], p[e + 2]);
    const q = (n - 3) * 3;
    t.set(p[e] - p[q], p[e + 1] - p[q + 1], p[e + 2] - p[q + 2]).normalize();
    this.tassel.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), t);
  }
}

export { clamp };
