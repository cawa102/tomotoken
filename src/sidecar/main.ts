import { runFull } from "../index.js";
import { generateSeed } from "../utils/seed.js";
import { buildRenderData } from "./render-data.js";
import { hostname } from "node:os";

/**
 * Sidecar entry point.
 *
 * Runs the full ingestion/progression/personality pipeline,
 * builds PetRenderData, and writes JSON to stdout.
 *
 * Designed to be called periodically (e.g., every 5 seconds) by the
 * viewer dev server or Tauri backend.
 */
async function main(): Promise<void> {
  try {
    const result = await runFull();
    const seed = generateSeed(hostname(), result.state.currentPet.petId);
    const renderData = buildRenderData(result.state, seed);
    process.stdout.write(JSON.stringify(renderData) + "\n");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`sidecar error: ${message}\n`);
    process.exit(1);
  }
}

main();
