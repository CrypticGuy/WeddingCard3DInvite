import * as THREE from 'three';
import { sdfGeometry, smin, ell, cone, sphere } from './sdf.js';
import { vertexSoft, soft, sstep, lerp, clamp, Bag, xf } from './kit.js';

const COL = {
  tan: new THREE.Color('#d9974f'),
  tanDeep: new THREE.Color('#bd7637'),
  white: new THREE.Color('#fff7ee'),
  saddle: new THREE.Color('#4a3a44'),
  ear: new THREE.Color('#a9602f'),
  earTip: new THREE.Color('#7f4526'),
  pink: new THREE.Color('#f6a7ae'),
};
const mix = (out, a, b, t) => out.copy(a).lerp(b, t);

function headGeo() {
  const sdf = (x, y, z) => {
    let d = ell(x, y, z, 0, 0.02, 0, 0.28, 0.26, 0.27);
    d = smin(d, cone(x, y, z, 0.17, -0.07, 0, 0.36, -0.1, 0, 0.13, 0.115), 0.1);
    d = smin(d, sphere(x, y, Math.abs(z), 0.11, -0.1, 0.12, 0.125), 0.08);
    d = smin(d, sphere(x, y, Math.abs(z), 0.17, 0.12, 0.1, 0.07), 0.08); // brow
    return d;
  };
  const color = (x, y, z, c) => {
    const az = Math.abs(z);
    // White blaze widening toward the muzzle.
    const bw = 0.024 + 0.05 * sstep(0.1, -0.03, y);
    const blaze = sstep(bw + 0.012, bw - 0.012, az) * sstep(-0.02, 0.05, x);
    const muzzle = Math.max(sstep(0.24, 0.285, x) * sstep(0.0, -0.05, y), sstep(-0.15, -0.19, y) * sstep(0.04, 0.12, x));
    mix(c, COL.tan, COL.tanDeep, sstep(0.05, 0.28, y) * 0.55);
    c.lerp(COL.white, Math.max(blaze, muzzle));
  };
  return sdfGeometry({ sdf, color, min: [-0.34, -0.3, -0.34], max: [0.54, 0.34, 0.34], cell: 0.0135 });
}

function torsoGeo() {
  const sdf = (x, y, z) => {
    let d = cone(x, y, z, -0.2, 0, 0, 0.2, 0.04, 0, 0.215, 0.235);
    d = smin(d, sphere(x, y, z, 0.24, -0.03, 0, 0.2), 0.1);
    d = smin(d, sphere(x, y, z, -0.23, -0.01, 0, 0.215), 0.1);
    d = smin(d, cone(x, y, z, 0.26, 0.1, 0, 0.36, 0.3, 0, 0.14, 0.125), 0.1);
    return d;
  };
  const color = (x, y, z, c) => {
    const az = Math.abs(z);
    const edge = 0.03 * Math.sin(x * 19 + 1) + 0.02 * Math.sin(x * 41);
    const saddle = sstep(-0.045 + edge, -0.01 + edge, y - az * 0.1) * sstep(-0.4, -0.34, x) * sstep(0.27, 0.21, x + (y - 0.1) * 0.25);
    const belly = sstep(-0.05, -0.1, y + az * 0.12);
    const chest = sstep(0.3, 0.37, x - y * 0.2) * sstep(0.1, 0.03, az - 0.02 - (0.2 - y) * 0.15);
    c.copy(COL.tan);
    c.lerp(COL.saddle, saddle);
    c.lerp(COL.white, Math.max(belly, chest));
  };
  return sdfGeometry({ sdf, color, min: [-0.5, -0.3, -0.32], max: [0.52, 0.46, 0.32], cell: 0.0165 });
}

function earGeo() {
  const sdf = (x, y, z) => cone(x, y, z * 2.6, 0, 0, 0, -0.035, -0.3, 0, 0.095, 0.125) * 0.45;
  const color = (x, y, z, c) => mix(c, COL.ear, COL.earTip, sstep(-0.12, -0.42, y));
  return sdfGeometry({ sdf, color, min: [-0.22, -0.48, -0.09], max: [0.16, 0.12, 0.09], cell: 0.0125 });
}

function legGeo() {
  const sdf = (x, y, z) => {
    const d = cone(x, y, z, 0, 0.02, 0, 0, -0.22, 0, 0.09, 0.07);
    return smin(d, ell(x, y, z, 0.03, -0.25, 0, 0.098, 0.052, 0.082), 0.05);
  };
  const color = (x, y, z, c) => mix(c, COL.white, COL.tan, sstep(-0.09, -0.02, y));
  return sdfGeometry({ sdf, color, min: [-0.14, -0.33, -0.13], max: [0.17, 0.14, 0.13], cell: 0.0125 });
}

function tailGeo() {
  const sdf = (x, y, z) => smin(
    cone(x, y, z, 0, 0, 0, -0.1, 0.17, 0, 0.055, 0.042),
    cone(x, y, z, -0.1, 0.17, 0, -0.1, 0.36, 0, 0.042, 0.022), 0.04,
  );
  const color = (x, y, z, c) => mix(c, COL.tan, COL.white, sstep(0.2, 0.24, y));
  return sdfGeometry({ sdf, color, min: [-0.2, -0.08, -0.08], max: [0.08, 0.42, 0.08], cell: 0.0105 });
}

export class Beagle {
  constructor() {
    const mat = vertexSoft({ roughness: 0.72 });
    const mesh = (g) => {
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    this.root = new THREE.Group();     // sits on the planet surface
    this.yaw = new THREE.Group();      // heading
    this.root.add(this.yaw);
    this.body = new THREE.Group();     // pose pivot at the rear hip
    this.body.position.set(-0.22, 0.4, 0);
    this.yaw.add(this.body);

    const torso = mesh(torsoGeo());
    torso.position.x = 0.22;
    this.body.add(torso);

    // Head rig
    this.neck = new THREE.Group();
    this.neck.position.set(0.62, 0.34, 0);
    this.body.add(this.neck);
    this.head = mesh(headGeo());
    this.head.position.set(0.05, 0.05, 0);
    this.neck.add(this.head);

    const eyeMat = soft({ color: '#2b1d26', roughness: 0.12 });
    const glint = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const noseMat = soft({ color: '#2f222b', roughness: 0.25 });
    this.eyes = [];
    for (const s of [1, -1]) {
      const eye = new THREE.Group();
      eye.position.set(0.215, 0.075, 0.15 * s);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.056, 24, 18), eyeMat);
      ball.scale.set(0.8, 1.05, 0.6);
      eye.add(ball);
      const g1 = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), glint);
      g1.position.set(0.02, 0.026, 0.028 * s);
      const g2 = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), glint);
      g2.position.set(0.034, -0.012, 0.024 * s);
      eye.add(g1, g2);
      this.head.add(eye);
      this.eyes.push(eye);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.062, 20, 14), noseMat);
    nose.scale.set(0.8, 0.66, 1);
    nose.position.set(0.462, -0.052, 0);
    const noseGlint = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), glint);
    noseGlint.position.set(0.488, -0.03, 0.022);
    this.head.add(nose, noseGlint);

    // Smile and tongue
    const smileBag = new Bag();
    for (const s of [1, -1]) {
      smileBag.tube([[0.46, -0.1, 0], [0.45, -0.145, 0.03 * s], [0.4, -0.165, 0.085 * s], [0.33, -0.14, 0.125 * s]], 0.0065, '#6e4a50', 14);
    }
    this.head.add(smileBag.build(vertexSoft(), { cast: false }));
    this.tongue = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), soft({ color: COL.pink, roughness: 0.4 }));
    this.tongue.position.set(0.415, -0.185, 0.015);
    this.tongue.scale.set(0.82, 1.35, 0.72);
    this.head.add(this.tongue);

    // Ears
    const eg = earGeo();
    this.ears = [1, -1].map((s) => {
      const piv = new THREE.Group();
      piv.position.set(-0.02, 0.12, 0.245 * s);
      const e = mesh(eg);
      if (s < 0) e.scale.z = -1;
      piv.add(e);
      piv.userData.side = s;
      this.head.add(piv);
      return piv;
    });

    // Legs
    const lg = legGeo();
    const mk = (x, y, z) => {
      const p = new THREE.Group();
      p.position.set(x, y, z);
      p.add(mesh(lg));
      this.body.add(p);
      return p;
    };
    this.legs = {
      fl: mk(0.47, -0.11, 0.135), fr: mk(0.47, -0.11, -0.135),
      rl: mk(0.0, -0.11, 0.15), rr: mk(0.0, -0.11, -0.15),
    };

    // Tail
    this.tail = new THREE.Group();
    this.tail.position.set(-0.2, 0.12, 0);
    this.tail.add(mesh(tailGeo()));
    this.body.add(this.tail);

    // Outfits, one per event, swapped as the scroll reaches it (see setOutfit).
    this.buildOutfits(mat, torso);

    // The pup's mouth is what the thread clips to.
    this.mouth = new THREE.Object3D();
    this.mouth.position.set(0.47, -0.14, 0);
    this.head.add(this.mouth);

    // Pose state, driven by the timeline or the scroll rig
    Object.assign(this, {
      walk: 0, gait: 0, sit: 1, wag: 0.8, pant: 1, crouch: 0, lean: 0, shake: 0,
      lookYaw: 0, lookPitch: 0, hop: 0, tilt: 0,
      phase: 0, earV: [0, 0], earA: [0, 0], blinkAt: 2, blink: 0, _hp: 0,
    });
  }

  // Every outfit is made once from a few hundred low-poly triangles in the dog's own
  // material, then only shown or hidden. Each piece is built around an anchor, so it can
  // pop in and out by scale. Body pieces ride the torso, head pieces turn with the head.
  buildOutfits(mat, torso) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const piece = (parent, at, fill) => {
      const bag = new Bag();
      fill(bag, (q) => [q.x - at[0], q.y - at[1], q.z - at[2]]);
      const m = bag.build(mat);
      m.position.set(...at);
      m.visible = false;
      parent.add(m);
      return m;
    };
    // Body pieces are fitted to the torso's real surface: rays are cast at it once, here,
    // so they hug the fur instead of floating or sinking in. Everything is in body space.
    const probe = torso.clone();
    probe.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const onSkin = (c, d, lift) => {
      ray.set(c.clone().addScaledVector(d, 1.2), d.clone().negate());
      const h = ray.intersectObject(probe, false)[0];
      return h ? h.point.addScaledVector(h.face.normal, lift) : c.clone().addScaledVector(d, 0.2);
    };
    // A sheet that follows the skin: grid(u, v) gives the axis point and outward direction.
    const sheet = (nu, nv, grid, lift, at) => {
      const pos = [], idx = [];
      let out = 0;
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const [c, d] = grid(i / nu, j / nv);
        if (i === nu >> 1 && j === nv >> 1) out = d;
        const q = onSkin(c, d, lift);
        pos.push(q.x - at[0], q.y - at[1], q.z - at[2]);
      }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const k = j * (nu + 1) + i;
        idx.push(k, k + 1, k + nu + 2, k, k + nu + 2, k + nu + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      // Faces point away from the body, whichever way the grid happened to run.
      const k = (nv >> 1) * (nu + 1) + (nu >> 1), n = g.attributes.normal;
      if (n.getX(k) * out.x + n.getY(k) * out.y + n.getZ(k) * out.z < 0) {
        for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
        g.setIndex(idx);
        g.computeVertexNormals();
      }
      return g;
    };
    // Round the base of the neck. drop slides the front of the loop down onto the chest.
    const NC = V(0.56, 0.2, 0), NA = V(0.45, 1, 0).normalize(), NU = V(1, -0.45, 0).normalize(), NV = V(0, 0, 1);
    const around = (a, up = 0, drop = 0) => {
      const d = NU.clone().multiplyScalar(Math.cos(a)).addScaledVector(NV, Math.sin(a));
      return [NC.clone().addScaledVector(NA, up - Math.max(0, Math.cos(a)) * drop), d];
    };
    const band = (bag, at, color, up0, up1, drop, trim) => {
      bag.add(sheet(28, 1, (u, v) => around(u * Math.PI * 2, up0 + (up1 - up0) * v, drop), 0.014, at), color, null, trim);
    };
    // A turban: a squashed dome with wraps, sat on the crown, in head space.
    const turban = (bag, base, wrap, s = 1) => {
      bag.ball([0, 0, 0], 0.205 * s, base, [1.12, 0.6, 1.06], 1);
      for (const [y, tilt, c] of [[-0.05, 0.18, wrap], [0.0, -0.22, base], [0.05, 0.12, wrap]]) {
        bag.add(new THREE.TorusGeometry(0.2 * s, 0.026, 5, 18), c, xf([0, y * s, 0], [Math.PI / 2, tilt, 0], [1.1, 1.04, 1]));
      }
    };
    const CROWN = [-0.03, 0.25, 0];
    const NECK = [NC.x, NC.y, 0];
    const front = (y, lift) => onSkin(V(0.3, y, 0), V(1, 0, 0), lift);

    const P = {
      blush: '#f8b9c6', gold: '#f2cf7f', cream: '#fff4e4', mustard: '#f3d27c', pink: '#ffc6d4',
      peach: '#ffcfae', peachWrap: '#ffe6d2', powder: '#bcd5f5', powderDeep: '#a9c4ee', lavender: '#dcd2f6',
    };
    this.outfits = {
      // The start and the end: a blush collar with a little gold bell
      collar: [piece(this.body, NECK, (b, rel) => {
        band(b, NECK, P.blush, 0.0, 0.045, 0.03);
        b.ball(rel(onSkin(...around(0, -0.02, 0.03), 0.045)), 0.034, P.gold, [1, 1, 1], 1);
      })],
      // Mehendi & Sangeet: a marigold garland and a pastel mustard pagdi
      mehendi: [
        piece(this.body, NECK, (b, rel) => {
          const n = 30, cols = ['#ffc766', '#ffdb8f', '#ffb886', '#fff1cf'];
          for (let i = 0; i < n; i++) b.ball(rel(onSkin(...around((i / n) * Math.PI * 2, 0.01, 0.16), 0.03)), 0.034, cols[i % 4], [1, 1, 1], 0);
          b.ball(rel(onSkin(...around(0, -0.05, 0.16), 0.05)), 0.03, P.pink, [1, 1.5, 1], 0);
        }),
        piece(this.head, CROWN, (b) => {
          turban(b, P.mustard, P.pink, 0.92);
          b.ball([0.18, 0.02, 0], 0.03, P.pink, [1, 1, 1], 1);
        }),
      ],
      // Wedding: a sherwani front with a mandarin collar and gold buttons, a peach safa
      // with a tiny kalgi
      wedding: [
        piece(this.body, [0.5, 0, 0], (b, rel) => {
          b.add(sheet(12, 8, (u, v) => {
            const az = (u - 0.5) * 2.6, el = -0.75 + v * 1.55;
            return [V(0.38, 0.02, 0), V(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az))];
          }, 0.016, [0.5, 0, 0]), '#ffd3b3', null, '#ffe9d6');
          for (const y of [0.1, 0.0, -0.1]) b.ball(rel(front(y, 0.03)), 0.019, P.gold, [0.6, 1, 1], 0);
        }),
        piece(this.body, NECK, (b) => band(b, NECK, P.cream, -0.01, 0.06, 0.02, P.gold)),
        piece(this.head, CROWN, (b) => {
          turban(b, P.peach, P.peachWrap);
          b.ball([0.2, 0.03, 0], 0.034, P.pink, [0.7, 1, 1], 1);                       // jewel
          b.add(new THREE.ConeGeometry(0.028, 0.2, 6), P.cream, xf([0.15, 0.15, 0], [0, 0, 0.55]), '#ffffff');   // kalgi plume
          b.ball([0.205, 0.09, 0], 0.016, P.gold, [1, 1, 1], 0);
          b.add(new THREE.BoxGeometry(0.05, 0.22, 0.12), P.peach, xf([-0.23, -0.1, 0], [0, 0, -0.25]), P.peachWrap);   // the turra down the back
        }),
      ],
      // Reception: a powder-blue bow tie and a little cape scattered with sparkles
      reception: [
        piece(this.body, [0.6, 0.1, 0], (b, rel) => {
          const c = front(0.1, 0.035), [x, y, z] = rel(c);
          for (const s of [1, -1]) b.ball([x, y, z + 0.06 * s], 0.055, P.powder, [0.45, 0.85, 1.25], 1);
          b.ball([x + 0.01, y, z], 0.027, P.powderDeep, [1, 1, 1], 0);
        }),
        piece(this.body, [0.2, 0.15, 0], (b, rel) => {
          const grid = (u, v) => { const bb = (v - 0.5) * 3.3; return [V(0.42 - u * 0.48, 0.0, 0), V(0.25 * (0.5 - u), Math.cos(bb), Math.sin(bb)).normalize()]; };
          b.add(sheet(8, 10, grid, 0.022, [0.2, 0.15, 0]), '#c9d8f6', null, P.lavender, 'y');
          for (let i = 0; i < 9; i++) b.ball(rel(onSkin(...grid(0.12 + (i % 3) * 0.33, 0.15 + Math.floor(i / 3) * 0.35), 0.03)), 0.014, i % 2 ? '#ffffff' : '#fff3c4', [1, 1, 1], 0);
        }),
      ],
    };
    this.outfitOn = 'collar';
    this.outfitWant = 'collar';
    this.outfitK = 1;
    for (const m of this.outfits.collar) { m.visible = true; m.scale.setScalar(1); }
  }

  // Which outfit to wear for a chapter id (an event id, or 'hero'/'finale' for the collar).
  setOutfit(id, instant = false) {
    const want = this.outfits[id] ? id : 'collar';
    if (want === this.outfitWant && !instant) return;
    this.outfitWant = want;
    if (instant && want !== this.outfitOn) {
      for (const m of this.outfits[this.outfitOn]) m.visible = false;
      this.outfitOn = want;
      for (const m of this.outfits[want]) { m.visible = true; m.scale.setScalar(1); }
      this.outfitK = 1;
    }
  }

  // A quick swap: the old outfit shrinks away, the new one pops in with a small overshoot.
  stepOutfit(dt) {
    if (this.outfitOn !== this.outfitWant) {
      this._grow = false;
      this.outfitK -= dt * 8;
      if (this.outfitK <= 0) {
        for (const m of this.outfits[this.outfitOn]) m.visible = false;
        this.outfitOn = this.outfitWant;
        this.outfitK = 0;
        for (const m of this.outfits[this.outfitOn]) m.visible = true;
        this._grow = true;
      }
    } else if (this._grow) {
      this.outfitK = Math.min(1, this.outfitK + dt * 4.5);
      if (this.outfitK >= 1) this._grow = false;
    } else return;
    const k = this.outfitK;
    const s = this._grow ? 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2 : k * k;   // ease out with overshoot
    for (const m of this.outfits[this.outfitOn]) m.scale.setScalar(Math.max(0.001, s));
  }

  placeOnRing(R, psi, heading) {
    this.root.position.set(Math.sin(psi) * R, Math.cos(psi) * R, 0);
    this.root.rotation.set(0, 0, -psi);
    this.yaw.rotation.y = heading;
  }

  update(dt, t) {
    const { walk, sit, crouch, lean } = this;
    this.stepOutfit(dt);
    this.phase += this.gait * dt;
    const ph = this.phase;
    const S = Math.sin, sw = 0.72 * walk * (1 - sit);

    // Gait: diagonal pairs swing together, the classic trot.
    this.legs.fl.rotation.z = S(ph) * sw;
    this.legs.rr.rotation.z = S(ph) * sw;
    this.legs.fr.rotation.z = S(ph + Math.PI) * sw;
    this.legs.rl.rotation.z = S(ph + Math.PI) * sw;

    const bob = Math.abs(S(ph)) * 0.035 * walk;
    const pitchSit = 0.62 * sit;
    this.body.position.y = 0.4 - 0.13 * sit - 0.1 * crouch + bob + this.hop;
    this.body.rotation.z = pitchSit - 0.2 * crouch + 0.24 * lean + S(ph * 2) * 0.03 * walk;
    this.body.rotation.x = S(ph) * 0.03 * walk;

    // Sitting: hind legs tuck, front legs stay planted vertically.
    if (sit > 0.01) {
      for (const k of ['rl', 'rr']) this.legs[k].rotation.z = lerp(this.legs[k].rotation.z, 0.75, sit);
      for (const k of ['fl', 'fr']) this.legs[k].rotation.z -= pitchSit;
    }
    for (const k of ['fl', 'fr']) {
      this.legs[k].scale.y = 1 + 0.72 * sit;
      this.legs[k].rotation.z += 0.2 * crouch - 0.24 * lean;
    }
    for (const k of ['rl', 'rr']) this.legs[k].rotation.z += -0.2 * lean + 0.2 * crouch;

    // Head stays level, then adds its own look direction and any tug shake.
    const shake = S(t * 34) * 0.32 * this.shake;
    this.neck.rotation.z = -this.body.rotation.z * 0.92 + this.lookPitch + S(ph * 2) * 0.03 * walk;
    this.neck.rotation.y = this.lookYaw + shake;
    this.neck.rotation.x = this.tilt + shake * 0.5;

    // Tail
    const wagF = 15 + 8 * this.wag;
    this.tail.rotation.x = S(t * wagF) * 0.65 * this.wag;
    this.tail.rotation.z = -0.1 - 0.35 * sit + 0.1 * S(t * 3);

    // Ears on a spring, driven by head motion and bob
    const hp = this.neck.rotation.y + this.neck.rotation.z + bob * 6 + shake;
    const hv = (hp - this._hp) / Math.max(dt, 0.001);
    this._hp = hp;
    this.ears.forEach((ear, i) => {
      const a = -180 * this.earA[i] - 11 * this.earV[i] - hv * 3.2;
      this.earV[i] += clamp(a, -300, 300) * dt;
      this.earA[i] = clamp(this.earA[i] + this.earV[i] * dt, -0.9, 0.9);
      const s = ear.userData.side;
      ear.rotation.x = s * (-0.2 - this.earA[i] * 0.8 - walk * 0.08);
      ear.rotation.z = 0.1 + this.earA[i] * 0.5 + walk * 0.18;
    });

    // Blink
    this.blinkAt -= dt;
    if (this.blinkAt < 0) { this.blink = 1; this.blinkAt = 1.6 + Math.random() * 3.4; }
    this.blink = Math.max(0, this.blink - dt * 7);
    const closed = Math.sin(this.blink * Math.PI);
    for (const e of this.eyes) e.scale.y = clamp(1 - closed, 0.1, 1);

    // Pant
    this.tongue.visible = this.pant > 0.05;
    this.tongue.scale.y = 1.35 * this.pant * (0.92 + 0.14 * S(t * 11));
    this.head.position.y = 0.05 + S(t * 11) * 0.005 * this.pant;
  }
}
