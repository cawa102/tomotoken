import { homedir } from "node:os";
import { join } from "node:path";

export const TOMOTOKEN_DIR = join(homedir(), ".tomotoken");
export const CONFIG_PATH = join(TOMOTOKEN_DIR, "config.json");
export const STATE_PATH = join(TOMOTOKEN_DIR, "state.json");
export const COLLECTION_PATH = join(TOMOTOKEN_DIR, "collection.json");

export const CLAUDE_PROJECTS_DIR = join(homedir(), ".claude", "projects");

export const GROWTH_MULTIPLIER = 1.5;
export const GROWTH_DENOMINATOR = 1 + GROWTH_MULTIPLIER + GROWTH_MULTIPLIER ** 2; // 4.75

export const CANVAS_WIDTH = 24;
export const CANVAS_HEIGHT = 12;
export const FRAME_COUNT = 4;
export const DEFAULT_FPS = 3;

export const ENCOURAGEMENT_THRESHOLD = 50_000;
export const ENCOURAGEMENT_COOLDOWN_HOURS = 3;

export const CATEGORY_IDS = [
  "impl",
  "debug",
  "refactor",
  "research",
  "docs",
  "planning",
  "ops",
  "security",
] as const;

export const TRAIT_IDS = [
  "builder",
  "fixer",
  "refiner",
  "scholar",
  "scribe",
  "architect",
  "operator",
  "guardian",
] as const;

export const CATEGORY_TO_TRAIT: Record<string, string> = {
  impl: "builder",
  debug: "fixer",
  refactor: "refiner",
  research: "scholar",
  docs: "scribe",
  planning: "architect",
  ops: "operator",
  security: "guardian",
};
