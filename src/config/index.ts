export { ConfigSchema, type Config, createDefaultConfig } from "./schema.js";
export { loadConfig, saveConfig, ensureDataDir } from "./loader.js";
export {
  TOMOTOKEN_DIR,
  CONFIG_PATH,
  STATE_PATH,
  COLLECTION_PATH,
  CLAUDE_PROJECTS_DIR,
  GROWTH_MULTIPLIER,
  GROWTH_DENOMINATOR,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  FRAME_COUNT,
  DEFAULT_FPS,
  ENCOURAGEMENT_THRESHOLD,
  ENCOURAGEMENT_COOLDOWN_HOURS,
  CATEGORY_IDS,
  TRAIT_IDS,
  CATEGORY_TO_TRAIT,
} from "./constants.js";
