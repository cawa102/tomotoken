import { createScene } from "./scene.js";
import { createPostProcessing } from "./postprocess.js";
import { buildFromModel, buildFromDesign, disposeCreature } from "./creature.js";
import { applyMorphExpression } from "./morph-expression.js";
import * as THREE from "three";

/**
 * Create a self-contained Three.js viewer inside a container element.
 * Renders a completed pet from PetRenderData (always stage 4).
 *
 * @param {HTMLElement} container - DOM element to render into
 * @param {object} renderData - PetRenderData from /api/collection/:petId/render
 * @returns {Promise<{ dispose: () => void }>} Cleanup handle
 */
export async function createPetViewer(container, renderData) {
  const { scene, camera, renderer, controls } = createScene(container);
  const { composer, resize: resizeComposer } = createPostProcessing(renderer, scene, camera);

  let currentGroup = null;
  let currentMixer = null;
  let animFrameId = null;

  // Load completed pet model (always stage 4)
  const { archetype, palette, creatureDesign } = renderData;
  let result = null;

  if (archetype) {
    result = await buildFromModel(archetype, palette);
  }
  if (!result && creatureDesign) {
    result = buildFromDesign(creatureDesign);
  }

  if (result) {
    scene.add(result.group);
    // Place on ground
    result.group.position.y = 0;
    const box = new THREE.Box3().setFromObject(result.group);
    result.group.position.y = -box.min.y;
    currentGroup = result.group;
    currentMixer = result.mixer || null;
  }

  // Resize handler
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w > 0 && h > 0) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      resizeComposer(w, h);
    }
  };
  window.addEventListener("resize", onResize);

  // Use ResizeObserver for container-level resizes (modal open/close)
  let resizeObserver = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);
  }

  // Animation loop
  const clock = { lastTime: performance.now() / 1000 };

  function animate() {
    animFrameId = requestAnimationFrame(animate);

    const now = performance.now() / 1000;
    const delta = now - clock.lastTime;
    clock.lastTime = now;

    if (currentGroup) {
      if (currentMixer) {
        currentMixer.update(delta);
      }
      if (currentGroup.userData?.isGltfModel) {
        applyMorphExpression(currentGroup, "default");
      }
    }

    controls.update();
    composer.render();
  }

  animate();

  // Return dispose handle for cleanup
  return {
    dispose() {
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      window.removeEventListener("resize", onResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      disposeCreature(scene);
      renderer.dispose();
      composer.dispose();
      container.innerHTML = "";
    },
  };
}
