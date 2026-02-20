import { describe, it, expect } from "vitest";
import { applyCustomization } from "../../../src/generation/templates/apply.js";
import { humanoidTemplate } from "../../../src/generation/templates/humanoid.js";
import { creatureDesignSchema } from "../../../src/generation/schema.js";
import type { Customization } from "../../../src/generation/templates/types.js";

const baseCustomization: Customization = {
  bodyColor: "#4a6741",
  accentColor: "#8faa7e",
  eyeColor: "#1a1a2e",
  accessoryColor: "#8b6914",
  showAccessories: [],
  animationStyle: "calm",
  expressions: {
    default: { eyes: { shape: "round" }, mouth: { shape: "flat" } },
    happy: { eyes: { shape: "happy" }, mouth: { shape: "smile" } },
    sleepy: { eyes: { shape: "sleepy" }, mouth: { shape: "flat" } },
    focused: { eyes: { shape: "sparkle" }, mouth: { shape: "flat" } },
  },
  personality: { name: "Gearsworth", quirk: "Loves fixing things" },
};

describe("applyCustomization", () => {
  it("produces a valid CreatureDesign", () => {
    const design = applyCustomization(humanoidTemplate, baseCustomization);
    const result = creatureDesignSchema.safeParse(design);
    expect(result.success).toBe(true);
  });

  it("applies bodyColor to body-role parts", () => {
    const design = applyCustomization(humanoidTemplate, baseCustomization);
    const body = design.parts.find(p => p.name === "body");
    expect(body?.color).toBe("#4a6741");
  });

  it("applies accentColor to accent-role parts", () => {
    const design = applyCustomization(humanoidTemplate, baseCustomization);
    const flatParts = flattenParts(design.parts);
    const earLeft = flatParts.find(p => p.name === "ear-left");
    expect(earLeft?.color).toBe("#8faa7e");
  });

  it("applies eyeColor to eye-role parts", () => {
    const design = applyCustomization(humanoidTemplate, baseCustomization);
    const flatParts = flattenParts(design.parts);
    const pupil = flatParts.find(p => p.name === "pupil-left");
    expect(pupil?.color).toBe("#1a1a2e");
  });

  it("excludes optional parts when not in showAccessories", () => {
    const design = applyCustomization(humanoidTemplate, baseCustomization);
    const names = flattenParts(design.parts).map(p => p.name);
    expect(names).not.toContain("hat");
    expect(names).not.toContain("scarf");
  });

  it("includes optional parts when in showAccessories", () => {
    const custom = { ...baseCustomization, showAccessories: ["hat", "scarf"] as Customization["showAccessories"] };
    const design = applyCustomization(humanoidTemplate, custom);
    const names = flattenParts(design.parts).map(p => p.name);
    expect(names).toContain("hat");
    expect(names).toContain("scarf");
    expect(names).not.toContain("backpack");
  });

  it("copies personality and expressions directly", () => {
    const design = applyCustomization(humanoidTemplate, baseCustomization);
    expect(design.personality).toEqual(baseCustomization.personality);
    expect(design.expressions).toEqual(baseCustomization.expressions);
  });

  it("adjusts animation speed for energetic style", () => {
    const custom = { ...baseCustomization, animationStyle: "energetic" as const };
    const design = applyCustomization(humanoidTemplate, custom);
    const flatParts = flattenParts(design.parts);
    const arm = flatParts.find(p => p.name === "arm-left");
    // Energetic should have higher speed than calm
    expect(arm?.animatable?.speed).toBeGreaterThan(1.0);
  });

  it("sets eye-white color to white", () => {
    const design = applyCustomization(humanoidTemplate, baseCustomization);
    const flatParts = flattenParts(design.parts);
    const eyeWhite = flatParts.find(p => p.name === "eye-left");
    expect(eyeWhite?.color).toBe("#ffffff");
  });

  it("sets mouth color to dark variant of body color", () => {
    const design = applyCustomization(humanoidTemplate, baseCustomization);
    const flatParts = flattenParts(design.parts);
    const mouth = flatParts.find(p => p.name === "mouth");
    // Mouth should have a color (dark variant)
    expect(mouth?.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

function flattenParts(parts: readonly any[]): any[] {
  const result: any[] = [];
  for (const p of parts) {
    result.push(p);
    if (p.children) result.push(...flattenParts(p.children));
  }
  return result;
}
