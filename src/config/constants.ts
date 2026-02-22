import { homedir } from "node:os";
import { join } from "node:path";

export const TOMOTOKEN_DIR = join(homedir(), ".tomotoken");
export const CONFIG_PATH = join(TOMOTOKEN_DIR, "config.json");
export const STATE_PATH = join(TOMOTOKEN_DIR, "state.json");
export const COLLECTION_PATH = join(TOMOTOKEN_DIR, "collection.json");
export const LOCK_PATH = join(TOMOTOKEN_DIR, "tomotoken.lock");

export const CLAUDE_PROJECTS_DIR = join(homedir(), ".claude", "projects");

export const TOKENS_PER_PET = 1_000_000_000;

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
