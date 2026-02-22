import { renderArt } from "./src/art/renderer.js";
import { generateSeed } from "./src/art/seed.js";

const CANVAS_W = 32;
const CANVAS_H = 16;

const creatures = [
  {
    name: "Builder (高depth・blade持ち)",
    seed: generateSeed("preview-machine", "creature-alpha"),
    traits: { builder: 90, fixer: 30, refiner: 20, scholar: 40, scribe: 10, architect: 50, operator: 15, guardian: 60 },
    depth: { editTestLoopCount: 40, repeatEditSameFileCount: 25, phaseSwitchCount: 15, totalSessions: 10 },
    style: { bulletRatio: 0.2, questionRatio: 0.1, codeblockRatio: 0.4, avgMessageLen: 120, messageLenStd: 30, headingRatio: 0.1 },
    usageMix: { impl: 0.5, fix: 0.2, refactor: 0.1, test: 0.1, docs: 0.1 },
    tokenRatio: 1.5,
  },
  {
    name: "Scholar (低depth・orb持ち)",
    seed: generateSeed("preview-machine", "creature-beta"),
    traits: { builder: 20, fixer: 15, refiner: 70, scholar: 95, scribe: 80, architect: 30, operator: 10, guardian: 10 },
    depth: { editTestLoopCount: 5, repeatEditSameFileCount: 3, phaseSwitchCount: 2, totalSessions: 8 },
    style: { bulletRatio: 0.4, questionRatio: 0.3, codeblockRatio: 0.1, avgMessageLen: 200, messageLenStd: 60, headingRatio: 0.3 },
    usageMix: { docs: 0.6, impl: 0.1, fix: 0.05, refactor: 0.15, test: 0.1 },
    tokenRatio: 0.3,
  },
  {
    name: "Guardian (中depth・shield持ち)",
    seed: generateSeed("preview-machine", "creature-gamma"),
    traits: { builder: 40, fixer: 60, refiner: 30, scholar: 20, scribe: 25, architect: 70, operator: 50, guardian: 95 },
    depth: { editTestLoopCount: 20, repeatEditSameFileCount: 15, phaseSwitchCount: 8, totalSessions: 12 },
    style: { bulletRatio: 0.15, questionRatio: 0.05, codeblockRatio: 0.3, avgMessageLen: 80, messageLenStd: 20, headingRatio: 0.05 },
    usageMix: { fix: 0.4, impl: 0.3, test: 0.2, refactor: 0.05, docs: 0.05 },
    tokenRatio: 1.0,
  },
];

for (const c of creatures) {
  const art = renderArt({
    seed: c.seed,
    progress: 1.0,
    traits: c.traits,
    depthMetrics: c.depth,
    styleMetrics: c.style,
    canvasWidth: CANVAS_W,
    canvasHeight: CANVAS_H,
    usageMix: c.usageMix,
    tokenRatio: c.tokenRatio,
  });

  console.log(`\n${"=".repeat(40)}`);
  console.log(`  ${c.name}`);
  console.log(`  LimbStage: ${art.limbStage}  |  Palette: [${art.palette.colors.slice(0, 5).join(", ")}...]`);
  console.log(`${"=".repeat(40)}`);
  for (const line of art.colorFrames[0]) {
    console.log(line);
  }
}

console.log("\n--- Done ---\n");
