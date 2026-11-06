import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { shared, clamp, lerp, sstep, damp, rng, soft } from './kit.js';
import { R, ZONES, createTerrain, createGround, createFlora, createWater, dirAt } from './planet.js';
import { Quality } from './quality.js';
import { builders, place } from './props.js';
import { Beagle } from './beagle.js';
import { createEnvelope, Thread, CARD_H, CARD_W } from './envelope.js';
import { ambientPetals, Burst, Hearts, createSkyObjects } from './particles.js';

const C = (h) => new THREE.Color(h);
const mood = (top, mid, bot, sun, sunI, hemiSky, hemiGround, hemiI, rim, night = 0) => ({
  top: C(top), mid: C(mid), bot: C(bot), sun: C(sun), sunI, hemiSky: C(hemiSky), hemiGround: C(hemiGround), hemiI, rim: C(rim), night,
});

// One light-and-sky recipe per chapter; the scroll blends between them.
const MOODS = {
  intro: mood('#f9c7da', '#fddfd9', '#fff1dc', '#fff0dc', 1.55, '#fff2ee', '#e7f3dc', 1.4, '#ffeef2'),
  hero: mood('#a9c9f3', '#e9cdea', '#ffe6d3', '#fff3e0', 1.6, '#f6f0ff', '#e6f2e0', 1.45, '#ffe9f3'),
  mehendi: mood('#9fdccf', '#cdeed0', '#fff3d2', '#fff4da', 1.5, '#effff2', '#d7eccd', 1.3, '#f0fff2'),
  haldi: mood('#ffcf74', '#ffdf9c', '#fff1c4', '#ffeab8', 1.6, '#fff6d9', '#f4edc0', 1.35, '#fff4cc'),
  sangeet: mood('#4e4b9c', '#a583d4', '#f7a8c4', '#e8dcff', 1.15, '#d4ccf6', '#c2a8e0', 1.45, '#e0c8ff', 1),
  wedding: mood('#f38fa8', '#fbbfb4', '#ffe2b0', '#ffdcb0', 1.55, '#ffe6e2', '#fbdccb', 1.35, '#ffe4d6', 0.25),
  finale: mood('#6f7fcf', '#d7a8df', '#ffcfbd', '#ffe4d0', 1.4, '#e2d8fb', '#f2d2dc', 1.4, '#ffdfea', 0.6),
};

const PostShader = {
  uniforms: {
    tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uBlur: { value: 0 },
    uFocus: { value: 0.5 }, uBand: { value: 0.22 }, uTime: { value: 0 }, uVig: { value: 0.16 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `
    varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uRes;
    uniform float uBlur, uFocus, uBand, uTime, uVig;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      float d = abs(vUv.y - uFocus);
      float rad = uBlur * smoothstep(uBand, uBand + 0.34, d);
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      if (rad > 0.15) {
        vec3 acc = c; float w = 1.;
        float rot = h(vUv * uRes) * 6.283;
        for (int i = 1; i < 14; i++) {
          float fi = float(i);
          float r = sqrt(fi / 13.) * rad;
          float a = fi * 2.39996 + rot;
          acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r / uRes).rgb; w += 1.;
        }
        c = acc / w;
      }
      vec2 q = vUv - .5;
      c *= 1. - uVig * smoothstep(.3, .85, length(q));
      c += (h(vUv * uRes + uTime) - .5) * .012;
      gl_FragColor = vec4(c, 1.);
    }`,
};

const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const v3 = (a) => new THREE.Vector3(...a);

export class World {
  constructor(canvas, events, { high }) {
    this.canvas = canvas;
    this.events = events;
    this.high = high;
    this.chapters = ['hero', ...events.map((e) => e.id), 'finale'];
    const step = (Math.PI * 2) / (events.length + 1);
    this.stops = [{ id: 'start', zone: 'start', phi: 0 }, ...events.map((e, i) => ({ id: e.id, zone: ZONES[e.id] ? e.id : 'start', phi: (i + 1) * step }))];
    // Each event rests with its diorama dead centre on top, so it stands upright on screen.
    this.phis = [0, ...events.map((_, i) => (i + 1) * step + 0.75 / R), Math.PI * 2];

    this.s = 0;           // chapter position, float
    this.introBlend = 0;  // 0 = intro close-up, 1 = scroll rig has the camera
    this.intro = { psi: 0.14, heading: -1.1, camX: 0, camPush: 0, cardFly: 0, cardExit: 0, blur: 0.6 };
    this.idle = 0;
    this.theta = 0;
    this.prevTheta = 0;
    this.speed = 0;
    this.heading = -0.55;
    this.pointer = new THREE.Vector2();
    this.pointerS = new THREE.Vector2();
    this.ticks = [];
    this.skyTicks = [];
    this.pixelRatio = 1;
    this.frames = 0;
    this.lastShadowTheta = 1e9;
  }

  async build(onStep = () => {}) {
    const pause = () => new Promise((r) => setTimeout(r, 0));
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.high, powerPreference: 'high-performance' }));
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = false;   // redrawn only when something moves
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 800);

    this.buildSky();
    this.buildLights();
    onStep(0.1); await pause();

    this.roll = new THREE.Group();
    this.scene.add(this.roll);
    this.terrain = createTerrain(this.stops);
    this.roll.add(createGround(this.terrain, this.high ? 96 : 64));
    this.water = createWater();
    this.roll.add(this.water);
    onStep(0.3); await pause();

    // Dioramas first, so flowers know where not to grow.
    const rand = rng(31);
    this.footprints = [];
    this.bulbMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.lanternMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.95, 0.72) });
    for (const stop of this.stops) {
      const make = builders[stop.id];
      if (!make) continue;
      const p = stop.id === 'sangeet' ? make(rand, this.bulbMat, this.lanternMat) : make(rand, this.high);
      place(p.root, this.terrain, stop.phi, -2.05, 0.75);
      this.roll.add(p.root);
      this.ticks.push(...p.ticks);
      this.footprints.push({ d: dirAt(stop.phi + 0.75 / R, -2.05), r: p.radius });
    }
    onStep(0.5); await pause();

    const env = (this.env = createEnvelope({ art: this.cardArt }));
    place(env.group, this.terrain, 0, -1.0, -0.42);
    this.roll.add(env.group);
    this.footprints.push({ d: dirAt(-0.42 / R, -1.0), r: 1.25 });

    const blocked = (d, k = 1) => {
      if (Math.abs(d.z) * R < 0.8) return true;
      for (const f of this.footprints) if (f.d.distanceTo(d) * R < f.r * k) return true;
      return false;
    };
    const flora = createFlora(this.terrain, this.stops, blocked, this.high);
    this.roll.add(flora.group);
    this.nearFlora = flora.near;
    onStep(0.75); await pause();

    this.dog = new Beagle();
    this.scene.add(this.dog.root);
    this.hearts = new Hearts();
    this.scene.add(this.hearts.group);
    this.burst = new Burst();
    this.scene.add(this.burst.mesh);
    this.petals = ambientPetals(this.high ? 300 : 90);
    this.scene.add(this.petals);

    this.skyObjects = createSkyObjects(this.high);
    this.scene.add(this.skyObjects.group);
    this.skyTicks.push(...this.skyObjects.ticks);
    onStep(0.88); await pause();

    this.scene.updateMatrixWorld(true);
    this.thread = new Thread(34, 2.2);
    this.scene.add(this.thread.mesh);
    const knot = env.knotAnchor.getWorldPosition(new THREE.Vector3());
    this.thread.layOut(knot, new THREE.Vector3(0.42, R + 0.05, 0.24));

    // Phones skip post-processing and draw straight to the screen with native
    // anti-aliasing: far cheaper, and there is no off-screen buffer to go wrong.
    if (this.high) this.buildPost();
    this.quality = new Quality(this);
    this.resize();
    this.setMood(MOODS.intro);
    this.compile();
    onStep(1);
  }

  compile() {
    this.renderer.compile(this.scene, this.camera);
  }

  buildSky() {
    this.skyU = {
      top: { value: C('#fff') }, mid: { value: C('#fff') }, bot: { value: C('#fff') },
      sunDir: { value: new THREE.Vector3(0.5, 0.45, -0.72).normalize() }, sunCol: { value: C('#fff') },
      night: { value: 0 }, uTime: { value: 0 },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(380, 32, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyU,
        vertexShader: 'varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: `
          varying vec3 vD; uniform vec3 top, mid, bot, sunDir, sunCol; uniform float night;
          void main(){
            vec3 d = normalize(vD);
            float h = d.y;
            vec3 c = mix(bot, mid, smoothstep(-.28, .06, h));
            c = mix(c, top, smoothstep(.0, .42, h));
            float s = max(dot(d, sunDir), 0.);
            c += sunCol * (pow(s, 6.) * .16 + pow(s, 60.) * .25) * (1. - night * .6);
            gl_FragColor = vec4(c, 1.);
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.scene.add(sky);
    this.sky = sky;

    // Stars for the sangeet night and the finale
    const n = 900, p = new Float32Array(n * 3), rr = rng(9);
    for (let i = 0; i < n; i++) {
      const u = rr() * 2 - 1, a = rr() * 6.28, q = Math.sqrt(1 - u * u);
      p.set([q * Math.cos(a) * 300, Math.abs(u) * 300 - 40, q * Math.sin(a) * 300], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color(1.3, 1.25, 1.1), size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.scene.add(this.stars);
    this.scene.fog = new THREE.Fog('#ffffff', 14, 70);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight('#fff', '#fff', 1.8);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff', 2);
    this.sun.position.set(-7, R + 14, 12);
    this.sun.target.position.set(0, R - 1, -1);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(this.high ? 2048 : 1024, this.high ? 2048 : 1024);
    s.camera.left = -10; s.camera.right = 10; s.camera.top = 10; s.camera.bottom = -10;
    s.camera.near = 1; s.camera.far = 42;
    s.bias = -0.0006;
    s.normalBias = 0.03;
    s.radius = 5;
    this.scene.add(this.sun, this.sun.target);
  }

  buildPost() {
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: this.high ? 4 : 2 });
    const c = (this.composer = new EffectComposer(this.renderer, target));
    c.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.24, 0.5, 1.05);
    this.bloom.enabled = this.high;
    c.addPass(this.bloom);
    this.post = new ShaderPass(PostShader);
    c.addPass(this.post);
    c.addPass(new OutputPass());
  }

  setMood(m) {
    const u = this.skyU;
    u.top.value.copy(m.top); u.mid.value.copy(m.mid); u.bot.value.copy(m.bot);
    u.sunCol.value.copy(m.sun);
    u.night.value = m.night;
    this.sun.color.copy(m.sun); this.sun.intensity = m.sunI;
    this.hemi.color.copy(m.hemiSky); this.hemi.groundColor.copy(m.hemiGround); this.hemi.intensity = m.hemiI;
    shared.uRim.value.copy(m.rim);
    this.stars.material.opacity = m.night;
    this.water.material.uniforms.uSky.value.copy(m.mid);
    this.water.material.uniforms.uLight.value = 1 - m.night * 0.3;
    this.scene.fog.color.copy(m.mid).lerp(m.bot, 0.5);
    this.petals.material.uniforms.uLight.value = 1 - m.night * 0.35;
    const glow = (this.high ? 0.62 : 0.72) + 0.4 * sstep(0.1, 0.9, m.night);
    this.lanternMat.color.setRGB(1.2 * glow, 0.8 * glow, 0.66 * glow);
    this.bulbMat.color.setScalar(0.85 + 0.42 * m.night);
  }

  blendMood(a, b, t, slot = '_m') {
    const o = (this[slot] ||= mood('#fff', '#fff', '#fff', '#fff', 1, '#fff', '#fff', 1, '#fff'));
    for (const k of ['top', 'mid', 'bot', 'sun', 'hemiSky', 'hemiGround', 'rim']) o[k].copy(a[k]).lerp(b[k], t);
    for (const k of ['sunI', 'hemiI', 'night']) o[k] = lerp(a[k], b[k], t);
    return o;
  }

  resize() {
    // The canvas is sized to the tallest viewport in CSS, so a phone's address bar
    // sliding away changes nothing here and costs nothing.
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.pixelRatio;
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w; this.h = h;
    this.aspect = w / h;
    this.dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(w, h);
      this.post.uniforms.uRes.value.set(w * dpr, h * dpr);
    }
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  // Camera pose for a chapter, adjusted for the screen shape.
  pose(name) {
    const a = this.aspect, portrait = a < 0.9;
    const fit = clamp(1.32 / a, 1, 2.0);
    if (name === 'intro') {
      const f = clamp(0.98 / a, 1, 2.05);
      const tgt = [0.22 + this.intro.camX, R + 1.12, -0.6];
      const dist = (7.4 - this.intro.camPush) * f;
      return { pos: [tgt[0] + 0.14 * dist, tgt[1] + 0.2 * dist, tgt[2] + dist], tgt, sx: 0, sy: 0, wide: 0, blur: this.intro.blur };
    }
    if (name === 'hero' || name === 'finale') {
      const hero = name === 'hero';
      const dist = (hero ? 52 : 58) * clamp(0.98 / a, 1, 1.7);
      const az = hero ? 0.82 : 0.95, el = hero ? 0.16 : 0.3;
      return {
        pos: [Math.sin(az) * dist, Math.sin(el) * dist, Math.cos(az) * dist], tgt: [0, 0, 0],
        sx: 0, sy: portrait ? (hero ? -0.14 : 0.24) : (hero ? -0.3 : 0),
        sxWide: !portrait && !hero ? -0.2 : 0, wide: 1, blur: 0,
      };
    }
    const dist = 9.3 * fit;
    const tgt = [0, R + 1.5, -1.3];
    return {
      pos: [tgt[0] + 0.07 * dist, tgt[1] + 0.13 * dist, tgt[2] + dist], tgt,
      sx: portrait ? 0 : 0.19, sy: portrait ? 0.2 : 0.03, wide: 0, blur: this.high ? 3.4 : 0,
    };
  }

  thetaAt(s) {
    const i = clamp(Math.floor(s), 0, this.phis.length - 2);
    return lerp(this.phis[i], this.phis[i + 1], smoother(clamp(s - i)));
  }

  applyCamera(dt) {
    const n = this.chapters.length;
    const s = clamp(this.s, 0, n - 1);
    const i = Math.min(Math.floor(s), n - 2), f = s - i, e = smoother(f);
    const A = this.pose(this.chapters[i]), B = this.pose(this.chapters[i + 1]);
    const pos = v3(A.pos).lerp(v3(B.pos), e), tgt = v3(A.tgt).lerp(v3(B.tgt), e);
    // A little leap between stops, so travel feels like a flight.
    const hop = Math.sin(f * Math.PI);
    const closeHop = (1 - Math.max(A.wide, B.wide)) * hop;
    pos.y += closeHop * 3.2;
    pos.z += closeHop * 4.5;
    tgt.y += closeHop * 0.5;
    let sx = lerp(A.sxWide ?? A.sx, B.sxWide ?? B.sx, e), sy = lerp(A.sy, B.sy, e);
    let wide = lerp(A.wide, B.wide, e), blur = lerp(A.blur, B.blur, e) * (1 - hop * 0.6);

    if (this.introBlend < 1) {
      const I = this.pose('intro'), k = smoother(this.introBlend);
      pos.lerp(v3(I.pos), 1 - k); tgt.lerp(v3(I.tgt), 1 - k);
      sx *= k; sy *= k;
      wide *= k;
      blur = lerp(I.blur, blur, k);
    }
    this.wide = wide;

    // Pointer parallax, gentler on the wide shots
    const px = this.pointerS.x, py = this.pointerS.y, pk = lerp(0.28, 1.6, wide);
    this.camera.position.set(pos.x + px * pk, pos.y - py * pk * 0.6, pos.z);
    this.camera.lookAt(tgt);
    const W = this.w, H = this.h;
    this.camera.setViewOffset(W, H, sx * W, sy * H, W, H);
    if (this.post) {
      this.post.uniforms.uBlur.value = blur * this.dpr;
      this.post.uniforms.uFocus.value = 0.5 + sy * -1 + (this.aspect < 0.9 ? -0.02 : -0.05);
    }
    // Small plants leave as the camera does, before they shrink below a pixel.
    shared.uGrow.value = 1 - sstep(0.25, 0.7, wide);
    this.nearFlora.visible = shared.uGrow.value > 0.01;
    if (!this.high) this.petals.visible = wide < 0.5;
    this.scene.fog.near = lerp(15, 90, wide);
    this.scene.fog.far = lerp(58, 260, wide);
    this.petals.material.uniforms.uCenter.value.lerpVectors(tgt, this.camera.position, 0.35);
    this.petals.material.uniforms.uBox.value = lerp(15, 46, wide);
    this.petals.material.uniforms.uSize.value = lerp(0.08, 0.16, wide);
  }

  applyMood() {
    const n = this.chapters.length;
    const s = clamp(this.s, 0, n - 1);
    const i = Math.min(Math.floor(s), n - 2), f = s - i;
    const m = this.blendMood(MOODS[this.chapters[i]] || MOODS.hero, MOODS[this.chapters[i + 1]] || MOODS.hero, sstep(0.1, 0.9, f));
    this.setMood(this.introBlend < 1 ? this.blendMood(MOODS.intro, m, smoother(this.introBlend), '_m2') : m);
  }

  updateDog(dt, t) {
    const dog = this.dog;
    if (this.introBlend < 1 && this.introDrivesDog) {
      const k = smoother(this.introBlend);
      dog.placeOnRing(R, this.intro.psi * (1 - k), lerp(this.intro.heading, this.heading, k));
      dog.update(dt, t);
      return;
    }
    // The planet turns under the pup, so walking is just speed-matching.
    const v = (this.theta - this.prevTheta) / Math.max(dt, 0.001);
    this.speed = damp(this.speed, v, 9, dt);
    const sp = Math.abs(this.speed) * R;
    const moving = sstep(0.12, 0.5, sp);
    dog.walk = damp(dog.walk, moving, 8, dt);
    // Reversing, a dog does not turn round. It keeps facing forward and shuffles
    // back in slow, hesitant steps with its head low.
    const backing = sp > 0.14 && this.speed < 0;
    this.back = damp(this.back ?? 0, backing ? 1 : 0, 6, dt);
    dog.gait = backing ? -(2.4 + 3 * (0.5 + 0.5 * Math.sin(t * 2.3))) : clamp(sp * 6.2, 6, 26);
    dog.sit = damp(dog.sit, 1 - sstep(0.04, 0.3, sp), 7, dt);
    dog.wag = damp(dog.wag, backing ? 0.18 : moving ? 0.55 : 0.85, 3, dt);
    dog.pant = damp(dog.pant, 1, 3, dt);
    const want = sp > 0.14 ? 0 : -0.62;
    this.heading = damp(this.heading, want, 7, dt);
    dog.lookYaw = damp(dog.lookYaw, backing ? -0.45 : moving ? 0 : -0.2 + this.pointerS.x * 0.3, 4, dt);
    dog.lookPitch = damp(dog.lookPitch, backing ? -0.16 : this.pointerS.y * -0.14 + 0.08 * (1 - moving), 4, dt);
    dog.tilt = damp(dog.tilt, moving ? 0 : Math.sin(t * 0.45) * 0.14, 3, dt);
    dog.crouch = damp(dog.crouch, this.back * 0.42, 6, dt);
    dog.lean = damp(dog.lean, 0, 6, dt);
    // At a stop the pup stands just left of the diorama, kept upright.
    dog.placeOnRing(R, (-0.75 / R) * (1 - (this.wide ?? 0)), this.heading);
    dog.root.rotation.z = 0;
    dog.update(dt, t);
  }

  petTheDog() {
    const head = this.dog.head.getWorldPosition(new THREE.Vector3());
    this.hearts.pop(head.add(new THREE.Vector3(0, 0.3, 0)), 6);
    const d = this.dog;
    let k = 0;
    const id = setInterval(() => {
      k += 0.08;
      d.hop = Math.sin(Math.min(1, k) * Math.PI) * 0.22;
      if (k >= 1) { d.hop = 0; clearInterval(id); }
    }, 16);
  }

  dogScreenPos() {
    const p = this.dog.head.getWorldPosition(new THREE.Vector3()).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (0.5 - p.y * 0.5) * this.h };
  }

  frame(dt, t) {
    shared.uTime.value = t;
    if (this.post) this.post.uniforms.uTime.value = t % 10;
    this.petals.material.uniforms.uTime.value = t;
    this.pointerS.x = damp(this.pointerS.x, this.pointer.x, 3, dt);
    this.pointerS.y = damp(this.pointerS.y, this.pointer.y, 3, dt);

    // Rolling the planet. Wide shots also get a slow idle spin.
    const wideK = sstep(0.75, 1, this.wide ?? 0) * sstep(0.85, 1, this.introBlend);
    if (wideK > 0.98) {
      this.idle += dt * 0.055;
      if (this.idle > Math.PI) this.idle -= Math.PI * 2;
    }
    this.prevTheta = this.theta;
    const raw = this.thetaAt(this.s) + this.idle * wideK;
    // Keep theta continuous through the idle wrap so the pup never flinches.
    const twoPi = Math.PI * 2;
    this.theta = raw + Math.round((this.prevTheta - raw) / twoPi) * twoPi;
    this.roll.rotation.z = this.theta;

    this.applyCamera(dt);
    this.applyMood();
    this.updateDog(dt, t);
    for (const f of this.ticks) f(t, dt);
    for (const f of this.skyTicks) f(t, dt);
    this.burst.update(dt, t);
    this.hearts.update(dt);
    this.updateCard();
    if (this.thread.mesh.visible) {
      if (this.thread.hasB) this.dog.mouth.getWorldPosition(this.thread.pinB);
      if (this.thread.hasA) this.env.knotAnchor.getWorldPosition(this.thread.pinA);
      this.thread.update(dt);
    }
    this.frames++;
    // Shadows only change when the planet turns or the pup is performing.
    const turned = Math.abs(this.theta - this.lastShadowTheta) > 0.0008;
    if (turned || this.introBlend < 1 || this.frames % 10 === 0) {
      this.renderer.shadowMap.needsUpdate = true;
      this.lastShadowTheta = this.theta;
    }
    this.probe?.begin();
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
    this.probe?.end();
    this.quality.update(dt, this.s);
  }

  detachCard() {
    const c = this.env.card;
    this.scene.attach(c);
    this.cardFrom = { p: c.position.clone(), q: c.quaternion.clone(), s: c.scale.x };
    this.cardFree = true;
  }

  updateCard() {
    if (!this.cardFree || this.cardDone) return;
    const c = this.env.card, cam = this.camera;
    const { cardFly: k, cardExit: x } = this.intro;
    const fov = THREE.MathUtils.degToRad(cam.fov);
    const visH = (d) => 2 * Math.tan(fov / 2) * d;
    const d = 6;
    const hFit = (visH(d) * 0.78) / CARD_H;
    const wFit = (visH(d) * this.aspect * 0.84) / CARD_W;
    const scale = Math.min(hFit, wFit);
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const dest = cam.position.clone().addScaledVector(fwd, d).addScaledVector(up, x * visH(d) * 1.2);
    c.position.lerpVectors(this.cardFrom.p, dest, k);
    c.quaternion.slerpQuaternions(this.cardFrom.q, cam.quaternion, k);
    c.rotateZ(x * 0.35 + Math.sin(k * Math.PI) * -0.12);
    c.rotateY(Math.sin(k * Math.PI) * 0.35);
    c.scale.setScalar(lerp(this.cardFrom.s, scale, k));
    if (x >= 0.99) { c.visible = false; this.cardDone = true; }
  }
}

export { soft };
