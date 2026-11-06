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

    // Wedding outfit: a blush collar, gold bell and bow tie
    const dress = new Bag();
    dress.add(new THREE.TorusGeometry(0.15, 0.024, 10, 30), '#f8b6c4', xf([0.565, 0.22, 0], [Math.PI / 2, 0.42, 0]));
    dress.ball([0.72, 0.14, 0], 0.036, '#f0c872', [1, 1, 1], 2);
    for (const s of [1, -1]) dress.ball([0.685, 0.175, 0.055 * s], 0.05, '#f39bb0', [0.45, 0.85, 1.25], 2);
    dress.ball([0.7, 0.178, 0], 0.024, '#f8cdd6');
    this.body.add(dress.build());

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

  placeOnRing(R, psi, heading) {
    this.root.position.set(Math.sin(psi) * R, Math.cos(psi) * R, 0);
    this.root.rotation.set(0, 0, -psi);
    this.yaw.rotation.y = heading;
  }

  update(dt, t) {
    const { walk, sit, crouch, lean } = this;
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
