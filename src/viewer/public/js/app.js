import { createScene } from "./scene.js";
import { createPostProcessing } from "./postprocess.js";
import { buildFromDesign, buildFromModel, disposeCreature } from "./creature.js";
import { applyAnimations } from "./animation.js";
import { applyExpression, selectExpression } from "./expression.js";
import { applyMorphExpression } from "./morph-expression.js";
import { createProceduralEgg } from "./procedural-egg.js";
import { EggWobbleController } from "./egg-wobble.js";
import { showLoading, hideLoading, playFlash, bounceIn } from "./hatch-transition.js";
import { renderRadarChart } from "./radar-chart.js";
import * as THREE from "three";

// --- DOM references ---
const container = document.getElementById("canvas-container");
const statusEl = document.getElementById("connection-status");
const archetypeLabel = document.getElementById("archetype-label");
const progressPct = document.getElementById("progress-pct");
const expFill = document.getElementById("exp-fill");
const radarCanvas = document.getElementById("radar-canvas");

// --- Scene setup ---
const { scene, camera, renderer, controls } = createScene(container);
const { composer, resize: resizeComposer } = createPostProcessing(renderer, scene, camera);

window.addEventListener("resize", () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  resizeComposer(w, h);
});

// --- State ---
let currentParts = null;
let currentGroup = null;
let currentPetId = null;
let currentStage = null;
let currentDesign = null;
let currentMixer = null;
let currentProgress = 0;
let currentWobble = null;

/**
 * Capture a PNG snapshot of the current canvas and POST it to the server.
 */
function captureSnapshot(petId) {
  requestAnimationFrame(() => {
    // Render one final frame to ensure canvas is up-to-date
    composer.render();
    const canvas = renderer.domElement;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await fetch(`/api/snapshot/${encodeURIComponent(petId)}`, {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: blob,
        });
      } catch (_err) {
        // Snapshot save is best-effort, don't disrupt the viewer
      }
    }, "image/png");
  });
}

/**
 * Place a group so its bounding box bottom sits at y=0 (on the ground).
 */
function placeOnGround(group) {
  group.position.y = 0;
  const box = new THREE.Box3().setFromObject(group);
  group.position.y = -box.min.y;
}

// --- WebSocket with exponential backoff ---
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;

function connectWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${location.host}`);

  ws.addEventListener("open", () => {
    statusEl.textContent = "Connected";
    statusEl.className = "connected";
    reconnectDelay = 1000; // reset on successful connection
  });

  ws.addEventListener("message", (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (_err) {
      return; // Ignore malformed JSON
    }
    // Detect pet completion: petId changed means previous pet completed
    if (currentPetId && data.petId && currentPetId !== data.petId) {
      captureSnapshot(currentPetId);
    }
    updateCreature(data).catch(() => { /* model load failure, non-fatal */ });
    updateUI(data);
  });

  ws.addEventListener("close", () => {
    statusEl.textContent = "Disconnected";
    statusEl.className = "disconnected";
    setTimeout(connectWebSocket, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
  });

  ws.addEventListener("error", () => {
    ws.close();
  });
}

/**
 * Update or rebuild the 3D creature from PetRenderData.
 * Rebuilds when pet ID changes or growth stage advances.
 * Stages 0-3: load egg model. Stage 4 (hatched): load character model.
 */
async function updateCreature(data) {
  const { archetype, creatureDesign, palette, stage, petId, progress } = data;

  currentProgress = progress || 0;

  // Detect hatching transition: egg → character
  if (stage === 4 && currentStage !== null && currentStage < 4) {
    if (currentWobble) {
      currentWobble.dispose();
      currentWobble = null;
    }

    showLoading();

    let newResult = null;
    if (archetype) {
      newResult = await buildFromModel(archetype, palette);
    }
    if (!newResult && creatureDesign) {
      newResult = buildFromDesign(creatureDesign);
      currentDesign = creatureDesign;
    }

    hideLoading();

    if (newResult) {
      // Only apply palette for non-glTF models (buildFromModel handles palette internally)
      if (palette && newResult.group && !newResult.group.userData?.isGltfModel) {
        const { applyPalette } = await import("./palette-apply.js");
        applyPalette(newResult.group, palette);
      }

      await playFlash(() => {
        disposeCreature(scene);
        scene.add(newResult.group);
        placeOnGround(newResult.group);
        currentGroup = newResult.group;
        currentParts = newResult.parts;
        currentMixer = newResult.mixer || null;
      });
      bounceIn(currentGroup);
    }

    currentPetId = petId;
    currentStage = stage;
    return;
  }

  if (petId !== currentPetId || stage !== currentStage) {
    disposeCreature(scene);
    currentDesign = null;
    currentMixer = null;
    if (currentWobble) {
      currentWobble.dispose();
      currentWobble = null;
    }

    let result = null;

    if (stage < 4) {
      const group = createProceduralEgg(stage, petId);
      result = { group, parts: {}, mixer: null };
    } else {
      // Hatched (stage 4): load character model
      if (archetype) {
        result = await buildFromModel(archetype, palette);
      }
      if (!result && creatureDesign) {
        result = buildFromDesign(creatureDesign);
        currentDesign = creatureDesign;
      }
    }

    if (result) {
      // Apply palette colors to egg or LLM-generated creature
      // (buildFromModel handles palette internally for glTF models)
      if (palette && result.group && !result.group.userData?.isGltfModel && !result.group.userData?.isEgg) {
        const { applyPalette } = await import("./palette-apply.js");
        applyPalette(result.group, palette);
      }

      // Start wobble controller for eggs
      if (stage < 4) {
        currentWobble = new EggWobbleController(result.group, progress);
      }

      scene.add(result.group);
      placeOnGround(result.group);
      currentGroup = result.group;
      currentParts = result.parts;
      currentMixer = result.mixer || null;
      currentPetId = petId;
      currentStage = stage;
    }
  }
}

/**
 * Update the bottom bar and radar chart from PetRenderData.
 */
function updateUI(data) {
  const pct = Math.round(data.progress * 100);
  archetypeLabel.textContent = data.archetype || "--";
  progressPct.textContent = `${pct}%`;
  expFill.style.width = `${pct}%`;

  if (data.traits && radarCanvas) {
    renderRadarChart(radarCanvas, data.traits, data.archetype);
  }
}

// --- Animation loop ---
const clock = { startTime: performance.now() / 1000, lastTime: 0 };

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now() / 1000;
  const time = now - clock.startTime;
  const deltaTime = time - clock.lastTime;
  clock.lastTime = time;

  if (currentGroup) {
    if (currentGroup.userData?.isEgg) {
      // Egg: wobble animation handled by EggWobbleController
      if (currentWobble) {
        currentWobble.updateProgress(currentProgress);
      }
    } else if (currentGroup.userData?.isGltfModel) {
      // glTF character model: animation mixer + morph-target expressions
      if (currentMixer) {
        currentMixer.update(deltaTime);
      }
      const expr = currentDesign?.expressions
        ? selectExpression(currentDesign.expressions, {
            progress: currentProgress,
            hour: new Date().getHours(),
          })
        : null;
      applyMorphExpression(currentGroup, expr || "default");
    } else if (currentDesign) {
      // LLM-generated: flag-based animation + expressions
      applyAnimations(currentGroup, time);
      if (currentDesign.expressions) {
        const expr = selectExpression(currentDesign.expressions, {
          progress: currentProgress,
          hour: new Date().getHours(),
        });
        if (expr) {
          applyExpression(currentParts, expr);
        }
      }
    }
  }

  controls.update();
  composer.render();
}

// --- Startup ---
connectWebSocket();

// Fallback: fetch via REST if WebSocket not available
fetch("/api/pet")
  .then((r) => r.json())
  .then((data) => {
    if (!currentPetId) {
      updateCreature(data);
      updateUI(data);
    }
  })
  .catch(() => { /* WebSocket will handle it */ });

animate();
