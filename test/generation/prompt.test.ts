import { describe, it, expect } from "vitest";
import { buildPrompt } from "../../src/generation/prompt.js";
import type { DepthMetrics, StyleMetrics } from "../../src/store/types.js";

describe("buildPrompt", () => {
  const traits: Record<string, number> = {
    builder: 50, fixer: 30, refiner: 20, scholar: 40,
    scribe: 10, architect: 60, operator: 25, guardian: 35,
  };
  const depth: DepthMetrics = {
    editTestLoopCount: 5, repeatEditSameFileCount: 2,
    phaseSwitchCount: 3, totalSessions: 10,
  };
  const style: StyleMetrics = {
    bulletRatio: 0.3, questionRatio: 0.1, codeblockRatio: 0.4,
    avgMessageLen: 120, messageLenStd: 40, headingRatio: 0.2,
  };

  it("includes archetype and subtype", () => {
    const prompt = buildPrompt({
      archetype: "architect", subtype: "builder",
      traits, depth, style, stage: 2, previousParts: null,
    });
    expect(prompt).toContain("architect");
    expect(prompt).toContain("builder");
  });

  it("includes stage number", () => {
    const prompt = buildPrompt({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 4, previousParts: null,
    });
    expect(prompt).toContain("4");
  });

  it("includes trait scores", () => {
    const prompt = buildPrompt({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 1, previousParts: null,
    });
    expect(prompt).toContain("builder=50");
    expect(prompt).toContain("architect=60");
  });

  it("includes previous parts when provided", () => {
    const prev = [{ name: "body", primitive: "sphere" }];
    const prompt = buildPrompt({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 3,
      previousParts: prev,
    });
    expect(prompt).toContain('"body"');
    expect(prompt).toContain("sphere");
  });

  it("returns a non-empty string", () => {
    const prompt = buildPrompt({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 0, previousParts: null,
    });
    expect(prompt.length).toBeGreaterThan(100);
  });

  // New tests for Customization format
  it("describes Customization format with bodyColor and accentColor", () => {
    const prompt = buildPrompt({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 2, previousParts: null,
    });
    expect(prompt).toContain("bodyColor");
    expect(prompt).toContain("accentColor");
    expect(prompt).toContain("eyeColor");
    expect(prompt).toContain("accessoryColor");
  });

  it("describes showAccessories options", () => {
    const prompt = buildPrompt({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 2, previousParts: null,
    });
    expect(prompt).toContain("showAccessories");
    expect(prompt).toContain("hat");
    expect(prompt).toContain("scarf");
    expect(prompt).toContain("backpack");
    expect(prompt).toContain("glasses");
  });

  it("describes animationStyle options", () => {
    const prompt = buildPrompt({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 2, previousParts: null,
    });
    expect(prompt).toContain("animationStyle");
    expect(prompt).toContain("calm");
    expect(prompt).toContain("energetic");
    expect(prompt).toContain("sleepy");
  });

  it("does NOT contain raw part geometry instructions", () => {
    const prompt = buildPrompt({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 2, previousParts: null,
    });
    // Should not instruct LLM to specify position/rotation/scale/primitive
    expect(prompt).not.toContain("position [x,y,z]");
    expect(prompt).not.toContain("rotation [x,y,z]");
    expect(prompt).not.toContain("scale [x,y,z]");
  });

  it("includes expressions and personality in output format", () => {
    const prompt = buildPrompt({
      archetype: "builder", subtype: "fixer",
      traits, depth, style, stage: 2, previousParts: null,
    });
    expect(prompt).toContain("expressions");
    expect(prompt).toContain("personality");
    expect(prompt).toContain("name");
    expect(prompt).toContain("quirk");
  });
});
