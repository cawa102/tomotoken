import { createScene } from "./scene.js";
import { createPostProcessing } from "./postprocess.js";
import { buildFromDesign, buildLegacyCreature, disposeCreature } from "./creature.js";
import { applyAnimations, applyLegacyAnimations } from "./animation.js";
import { applyExpression, selectExpression } from "./expression.js";

// --- DOM references ---
const container = document.getElementById("canvas-container");
const statusEl = document.getElementById("connection-status");
const petIdEl = document.getElementById("pet-id");
const archetypeEl = document.getElementById("archetype");
const stageEl = document.getElementById("stage");
const progressFill = document.getElementById("progress-fill");
const petNameEl = document.getElementById("pet-name");
const petQuirkEl = document.getElementById("pet-quirk");

const STAGE_NAMES = ["Egg", "Infant", "Child", "Youth", "Complete", "Mastered"];

// --- Scene setup ---
const { scene, camera, renderer } = createScene(container);
const { composer, resize: resizeComposer } = createPostProcessing(renderer, scene, camera);

window.addEventListener("resize", () => {
  resizeComposer(container.clientWidth, container.clientHeight);
});

// --- State ---
let currentParts = null;
let currentGroup = null;
let currentPetId = null;
let currentStage = null;
let currentDesign = null;
let currentProgress = 0;

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
    try {
      const data = JSON.parse(event.data);
      updateCreature(data);
      updateInfoPanel(data);
    } catch (_err) {
      // Ignore malformed messages
    }
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
 * Uses LLM-generated design if available, falls back to PRNG legacy builder.
 */
function updateCreature(data) {
  const { creatureDesign, creatureParams, palette, stage, petId, progress } = data;

  currentProgress = progress || 0;

  if (petId !== currentPetId || stage !== currentStage) {
    disposeCreature(scene);

    let result;
    if (creatureDesign) {
      result = buildFromDesign(creatureDesign);
      currentDesign = creatureDesign;
    } else {
      result = buildLegacyCreature(creatureParams, palette, stage);
      currentDesign = null;
    }

    scene.add(result.group);
    currentGroup = result.group;
    currentParts = result.parts;
    currentPetId = petId;
    currentStage = stage;
  }
}

/**
 * Update the info panel text.
 */
function updateInfoPanel(data) {
  petIdEl.textContent = data.petId.slice(0, 8);
  archetypeEl.textContent = data.archetype;
  stageEl.textContent = STAGE_NAMES[data.stage] || `Stage ${data.stage}`;
  progressFill.style.width = `${Math.round(data.progress * 100)}%`;

  // Show personality info from LLM-generated design
  if (data.creatureDesign?.personality) {
    petNameEl.textContent = data.creatureDesign.personality.name;
    petQuirkEl.textContent = data.creatureDesign.personality.quirk;
    petNameEl.parentElement.style.display = "";
    petQuirkEl.parentElement.style.display = "";
  } else {
    petNameEl.parentElement.style.display = "none";
    petQuirkEl.parentElement.style.display = "none";
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

  if (currentGroup && currentParts) {
    if (currentDesign) {
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
    } else {
      // PRNG fallback: legacy fixed animation functions
      applyLegacyAnimations(currentGroup, currentParts, time, deltaTime);
    }
  }

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
      updateInfoPanel(data);
    }
  })
  .catch(() => { /* WebSocket will handle it */ });

animate();
