import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
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

export function saveConfig(config: Config, path: string = CONFIG_PATH): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(config, null, 2), "utf-8");
}

export function ensureDataDir(): void {
  if (!existsSync(TOMOTOKEN_DIR)) {
    mkdirSync(TOMOTOKEN_DIR, { recursive: true });
  }
}
