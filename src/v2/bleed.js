// The hand-off from 3D to paint. One extra full-screen draw on top of the live 3D
// frame, so it costs almost nothing and needs no off-screen buffer on phones.
//
// Two fronts spread outward from the dog's paws, as they do on real wet paper:
//   water first: the world soaks into bare paper,
//   pigment second: the painting bleeds in behind it, with the dark rim pigment
//   leaves at a drying edge, and cauliflower blooms from the noise.
// By the end every effect has settled, so the frame is exactly the painted scene.
import * as THREE from 'three';

const fragment = `
  varying vec2 vUv;
  uniform sampler2D uPaint, uNoise;
  uniform vec2 uAspect, uFoot;
  uniform vec3 uPaper;
  uniform float uT, uZoom, uFade, uReach, uWater;

  float field(vec2 p) {
    vec3 a = texture2D(uNoise, p * 0.42 + 0.13).rgb;
    vec3 b = texture2D(uNoise, p * 1.35 + 0.61).rgb;
    float warp = (a.r - 0.5) * 0.95 + (b.g - 0.5) * 0.36 + (b.b - 0.5) * 0.05;
    // Separate blooms start around the first and run together.
    vec2 f = uFoot * uAspect;
    float d = length((p - f) * vec2(1.0, 1.35));
    d = min(d, length(p - (f + vec2(0.62, 0.34) * uAspect.x)) + 0.34);
    d = min(d, length(p - (f + vec2(-0.25, 0.62) * uAspect.y)) + 0.5);
    d = min(d, length(p - (f + vec2(0.4, 0.82) * uAspect.y)) + 0.72);
    return d + warp * 0.5;
  }

  void main() {
    vec2 p = vUv * uAspect;
    float f = field(p);
    float front = uT * uReach;

    // Water front, running ahead of the pigment.
    float water = smoothstep(0.1, -0.05, f - (front + 0.3 * (1.0 - uT * uT)));
    // Pigment front, with a slightly feathered wet edge.
    float behind = front - f;
    float pigment = smoothstep(-0.012, 0.03, behind);

    vec2 uv = (vUv - 0.5) / uZoom + 0.5;
    vec3 art = texture2D(uPaint, uv).rgb;

    // Density at the drying edge, fading as the wash settles.
    float settle = 1.0 - smoothstep(0.75, 1.0, uT);
    float rim = exp(-max(behind, 0.0) / 0.028) * settle;
    float bloom = exp(-max(behind, 0.0) / 0.16) * settle;
    art *= mix(vec3(1.0), vec3(0.74, 0.62, 0.68), rim * 0.75);
    art = mix(art, art * 0.5 + uPaper * 0.5, bloom * 0.5);

    float grain = texture2D(uNoise, p * 3.1).b - 0.5;
    vec3 paper = uPaper * (1.0 + grain * 0.05);

    vec3 c = mix(paper, art, pigment);
    float alpha = max(pigment, water * 0.93 * uWater) * uFade;
    if (uZoom < 0.999) {
      // Pulling away: the sheet's edge frays as it recedes.
      vec2 e = abs(uv - 0.5) * 2.0;
      float edge = 1.0 - smoothstep(0.92, 1.0, max(e.x, e.y) + grain * 0.04);
      alpha *= edge;
    }
    gl_FragColor = vec4(c, alpha);
  }`;

export class Bleed {
  constructor(renderer, noiseTexture) {
    this.renderer = renderer;
    this.t = 0;
    noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;
    noiseTexture.colorSpace = THREE.NoColorSpace;
    this.paint = new THREE.CanvasTexture(document.createElement('canvas'));
    this.paint.colorSpace = THREE.NoColorSpace;
    this.paint.generateMipmaps = false;
    this.paint.minFilter = THREE.LinearFilter;
    this.u = {
      uPaint: { value: this.paint }, uNoise: { value: noiseTexture },
      uAspect: { value: new THREE.Vector2(1, 1) }, uFoot: { value: new THREE.Vector2(0.3, 0.1) },
      uPaper: { value: new THREE.Color(0.965, 0.93, 0.88) },
      uT: { value: 0 }, uZoom: { value: 1 }, uFade: { value: 1 }, uReach: { value: 2 }, uWater: { value: 1 },
    };
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: fragment,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    this.scene.add(quad);
    // Compiled now, so the first frame of the transition does not stall.
    renderer.compile(this.scene, this.camera);
  }

  // The frozen painting, drawn by Stage.snapshot.
  setPaint(canvas) {
    const old = this.paint.image;
    this.paint.image = canvas;
    if (old?.width !== canvas.width || old?.height !== canvas.height) this.paint.dispose();
    this.paint.needsUpdate = true;
  }

  size(W, H, footX, footY) {
    const a = W / H;
    this.u.uAspect.value.set(a, 1);
    this.u.uFoot.value.set(footX / W, 1 - footY / H);
    // Furthest corner plus the noise's largest push.
    const fx = Math.max(footX / W, 1 - footX / W) * a, fy = Math.max(footY / H, 1 - footY / H);
    this.u.uReach.value = Math.hypot(fx, fy * 1.35) + 0.42;
  }

  // zoom < 1 is the finale: the sheet recedes, so no water runs ahead of it.
  render(t, zoom = 1, fade = 1) {
    if (t <= 0) return;
    this.u.uWater.value = zoom < 1 ? 0 : 1;
    const r = this.renderer, auto = r.autoClear;
    this.u.uT.value = t;
    this.u.uZoom.value = zoom;
    this.u.uFade.value = fade;
    r.autoClear = false;
    r.setRenderTarget(null);
    r.render(this.scene, this.camera);
    r.autoClear = auto;
  }
}
