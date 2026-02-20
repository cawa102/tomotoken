// src/viewer/public/js/postprocess.js
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/**
 * Create an EffectComposer with the post-processing pipeline.
 *
 * Pipeline: RenderPass → UnrealBloomPass → FXAA → OutputPass
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @returns {{ composer: EffectComposer, resize: (w: number, h: number) => void }}
 */
export function createPostProcessing(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());

  const renderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: 4,
  });

  const composer = new EffectComposer(renderer, renderTarget);

  // 1. Base scene render
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 2. Bloom — subtle glow on eye highlights and emissive accents
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    0.3,   // strength: subtle, not overwhelming
    0.4,   // radius
    0.85,  // threshold: only bright areas bloom
  );
  composer.addPass(bloomPass);

  // 3. FXAA — fast approximate anti-aliasing
  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.uniforms["resolution"].value.set(1 / size.x, 1 / size.y);
  composer.addPass(fxaaPass);

  // 4. Output — correct color space conversion
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  /**
   * Update composer and pass sizes on window resize.
   * @param {number} width
   * @param {number} height
   */
  function resize(width, height) {
    composer.setSize(width, height);
    fxaaPass.uniforms["resolution"].value.set(1 / width, 1 / height);
  }

  return { composer, resize };
}
