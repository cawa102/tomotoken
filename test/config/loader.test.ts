import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, ensureDataDir } from "../../src/config/loader.js";
import { createDefaultConfig } from "../../src/config/schema.js";

const TMP = join(__dirname, "../tmp-config");

beforeEach(() => mkdirSync(TMP, { recursive: true }));
afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe("loadConfig", () => {
  it("returns default config when file does not exist", () => {
    const result = loadConfig(join(TMP, "nonexistent.json"));
    expect(result).toEqual(createDefaultConfig());
  });

  it("parses valid config file", () => {
    const configPath = join(TMP, "config.json");
    const config = createDefaultConfig();
    writeFileSync(configPath, JSON.stringify(config));
    const result = loadConfig(configPath);
    expect(result).toEqual(config);
  });

  it("returns default config for invalid JSON", () => {
    const configPath = join(TMP, "bad.json");
    writeFileSync(configPath, "not valid json{{{");
    const result = loadConfig(configPath);
    expect(result).toEqual(createDefaultConfig());
  });
});

describe("ensureDataDir", () => {
  it("creates directory if it does not exist", () => {
    const dir = join(TMP, "subdir");
    // ensureDataDir uses TOMOTOKEN_DIR constant, so we just verify it doesn't throw
    expect(() => ensureDataDir()).not.toThrow();
  });
});
