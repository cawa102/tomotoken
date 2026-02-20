import { describe, it, expect } from "vitest";
import { humanoidTemplate } from "../../../src/generation/templates/humanoid.js";
import type { TemplatePart } from "../../../src/generation/templates/types.js";

describe("humanoidTemplate", () => {
  it("has a valid id and name", () => {
    expect(humanoidTemplate.id).toBe("humanoid");
    expect(humanoidTemplate.name).toBeTruthy();
  });

  it("has at least body, head, eyes, arms, and legs", () => {
    const names = flattenNames(humanoidTemplate.parts);
    expect(names).toContain("body");
    expect(names).toContain("head");
    expect(names).toContain("eye-left");
    expect(names).toContain("eye-right");
    expect(names).toContain("arm-left");
    expect(names).toContain("arm-right");
    expect(names).toContain("leg-left");
    expect(names).toContain("leg-right");
  });

  it("all parts have valid colorRole", () => {
    const validRoles = ["body", "accent", "eye", "eyeWhite", "mouth", "accessory"];
    const roles = flattenColorRoles(humanoidTemplate.parts);
    for (const role of roles) {
      expect(validRoles).toContain(role);
    }
  });

  it("accessory parts have optional=true and accessoryGroup", () => {
    const accessories = flattenParts(humanoidTemplate.parts)
      .filter(p => p.optional);
    for (const acc of accessories) {
      expect(acc.accessoryGroup).toBeTruthy();
    }
  });

  it("all positions are within reasonable bounds", () => {
    const parts = flattenParts(humanoidTemplate.parts);
    for (const p of parts) {
      // Relative child positions can go lower, so use wider bounds
      // x: -1.5 to 1.5, y: -1.0 to 2.5, z: -1.5 to 1.5
      expect(p.position[0]).toBeGreaterThanOrEqual(-1.5);
      expect(p.position[0]).toBeLessThanOrEqual(1.5);
      expect(p.position[1]).toBeGreaterThanOrEqual(-1.0);
      expect(p.position[1]).toBeLessThanOrEqual(2.5);
      expect(p.position[2]).toBeGreaterThanOrEqual(-1.5);
      expect(p.position[2]).toBeLessThanOrEqual(1.5);
    }
  });
});

function flattenParts(parts: readonly TemplatePart[]): TemplatePart[] {
  const result: TemplatePart[] = [];
  for (const p of parts) {
    result.push(p);
    if (p.children) result.push(...flattenParts(p.children));
  }
  return result;
}

function flattenNames(parts: readonly TemplatePart[]): string[] {
  return flattenParts(parts).map(p => p.name);
}

function flattenColorRoles(parts: readonly TemplatePart[]): string[] {
  return flattenParts(parts).map(p => p.colorRole);
}
