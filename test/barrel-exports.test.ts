import { describe, it, expect } from "vitest";

describe("barrel exports", () => {
  it("src/config/index.ts exports expected members", async () => {
    const mod = await import("../src/config/index.js");
    expect(mod.loadConfig).toBeTypeOf("function");
    expect(mod.ensureDataDir).toBeTypeOf("function");
    expect(mod.CLAUDE_PROJECTS_DIR).toBeTypeOf("string");
    expect(mod.resolveApiKey).toBeTypeOf("function");
  });

  it("src/creature/index.ts exports expected members", async () => {
    const mod = await import("../src/creature/index.js");
    expect(mod.deriveCreatureParams).toBeTypeOf("function");
    expect(mod.adjustParamsForProgress).toBeTypeOf("function");
    expect(mod.generatePalette).toBeTypeOf("function");
    expect(mod.paletteToHexArray).toBeTypeOf("function");
    expect(mod.ansi256ToHex).toBeTypeOf("function");
  });

  it("src/generation/index.ts exports expected members", async () => {
    const mod = await import("../src/generation/index.js");
    expect(mod.creatureDesignSchema).toBeDefined();
    expect(mod.buildPrompt).toBeTypeOf("function");
    expect(mod.getDesignContext).toBeTypeOf("function");
    expect(mod.saveDesign).toBeTypeOf("function");
    expect(mod.humanoidTemplate).toBeDefined();
    expect(mod.applyCustomization).toBeTypeOf("function");
    expect(mod.customizationSchema).toBeDefined();
    expect(mod.createLLMProvider).toBeTypeOf("function");
  });

  it("src/generation/templates/index.ts exports expected members", async () => {
    const mod = await import("../src/generation/templates/index.js");
    expect(mod.humanoidTemplate).toBeDefined();
    expect(mod.applyCustomization).toBeTypeOf("function");
    expect(mod.customizationSchema).toBeDefined();
  });

  it("src/ingestion/index.ts exports expected members", async () => {
    const mod = await import("../src/ingestion/index.js");
    expect(mod.aggregateSessions).toBeTypeOf("function");
    expect(mod.scanLogFiles).toBeTypeOf("function");
    expect(mod.readIncremental).toBeTypeOf("function");
  });

  it("src/palette/index.ts re-exports creature palette functions", async () => {
    const mod = await import("../src/palette/index.js");
    expect(mod.generatePalette).toBeTypeOf("function");
    expect(mod.paletteToHexArray).toBeTypeOf("function");
    expect(mod.ansi256ToHex).toBeTypeOf("function");
  });

  it("src/personality/index.ts exports expected members", async () => {
    const mod = await import("../src/personality/index.js");
    expect(mod.classifySession).toBeTypeOf("function");
    expect(mod.computeDepthMetrics).toBeTypeOf("function");
    expect(mod.computeStyleMetrics).toBeTypeOf("function");
    expect(mod.computeTraits).toBeTypeOf("function");
  });

  it("src/progression/index.ts exports expected members", async () => {
    const mod = await import("../src/progression/index.js");
    expect(mod.advancePet).toBeTypeOf("function");
    expect(mod.detectMonthChange).toBeTypeOf("function");
    expect(mod.handleMonthChange).toBeTypeOf("function");
    expect(mod.computeEggStage).toBeTypeOf("function");
  });

  it("src/store/index.ts exports expected members", async () => {
    const mod = await import("../src/store/index.js");
    expect(mod.createInitialState).toBeTypeOf("function");
    expect(mod.loadState).toBeTypeOf("function");
    expect(mod.saveState).toBeTypeOf("function");
    expect(mod.loadCollection).toBeTypeOf("function");
    expect(mod.saveCollection).toBeTypeOf("function");
    expect(mod.addCompletedPet).toBeTypeOf("function");
    expect(mod.updatePetInState).toBeTypeOf("function");
    expect(mod.updateIngestionFile).toBeTypeOf("function");
    expect(mod.updateGlobalStats).toBeTypeOf("function");
    expect(mod.updateEncouragementTimestamp).toBeTypeOf("function");
    expect(mod.acquireLock).toBeTypeOf("function");
    expect(mod.releaseLock).toBeTypeOf("function");
  });

  it("src/utils/index.ts exports expected members", async () => {
    const mod = await import("../src/utils/index.js");
    expect(mod.expandHome).toBeTypeOf("function");
  });

  it("src/validation/index.ts exports expected members", async () => {
    const mod = await import("../src/validation/index.js");
    expect(mod.validateStartup).toBeTypeOf("function");
  });
});
