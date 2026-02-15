import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { CONFIG_PATH, TOMOTOKEN_DIR } from "./constants.js";
import { Config, ConfigSchema, createDefaultConfig } from "./schema.js";

export function loadConfig(path: string = CONFIG_PATH): Config {
  if (!existsSync(path)) {
    return createDefaultConfig();
  }

  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    return ConfigSchema.parse(parsed);
  } catch (_err) {
    return createDefaultConfig();
  }
}

export function ensureDataDir(): void {
  if (!existsSync(TOMOTOKEN_DIR)) {
    mkdirSync(TOMOTOKEN_DIR, { recursive: true, mode: 0o700 });
  }
}
