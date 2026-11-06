// Post-processing lives in its own chunk, so only the top tier ever downloads it.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

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

export function buildPost(renderer, scene, camera) {
  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.24, 0.5, 1.05);
  composer.addPass(bloom);
  const post = new ShaderPass(PostShader);
  composer.addPass(post);
  composer.addPass(new OutputPass());
  return { composer, bloom, post };
}
