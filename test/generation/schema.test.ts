import { describe, it, expect } from "vitest";
import { creatureDesignSchema } from "../../src/generation/schema.js";

describe("creatureDesignSchema", () => {
  const validDesign = {
    parts: [
      {
        name: "body",
        primitive: "sphere",
        position: [0, 0.5, 0],
        rotation: [0, 0, 0],
        scale: [0.5, 0.6, 0.4],
        color: "#ff8844",
        material: { roughness: 0.7, metalness: 0.05, flatShading: true },
      },
    ],
    expressions: {
      default: {
        eyes: { scaleY: 1.0, shape: "round" },
        mouth: { scaleX: 1.0, shape: "smile" },
      },
    },
    personality: { name: "Patches", quirk: "always curious" },
  };

  it("accepts a valid CreatureDesign", () => {
    const result = creatureDesignSchema.safeParse(validDesign);
    expect(result.success).toBe(true);
  });

  it("accepts nested children parts", () => {
    const withChildren = {
      ...validDesign,
      parts: [
        {
          ...validDesign.parts[0],
          children: [
            {
              name: "hat",
              primitive: "cone",
              position: [0, 0.3, 0],
              rotation: [0, 0, 0],
              scale: [0.2, 0.3, 0.2],
              color: "#3366cc",
              material: { roughness: 0.5, metalness: 0.1, flatShading: true },
            },
          ],
        },
      ],
    };
    const result = creatureDesignSchema.safeParse(withChildren);
    expect(result.success).toBe(true);
  });

  it("accepts parts with animatable property", () => {
    const withAnim = {
      ...validDesign,
      parts: [
        {
          ...validDesign.parts[0],
          animatable: { type: "bob", speed: 1.5, amplitude: 0.1 },
        },
      ],
    };
    const result = creatureDesignSchema.safeParse(withAnim);
    expect(result.success).toBe(true);
  });

  it("rejects invalid primitive type", () => {
    const bad = {
      ...validDesign,
      parts: [{ ...validDesign.parts[0], primitive: "pyramid" }],
    };
    const result = creatureDesignSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const bad = { parts: [], expressions: {} };
    const result = creatureDesignSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects invalid color format", () => {
    const bad = {
      ...validDesign,
      parts: [{ ...validDesign.parts[0], color: "red" }],
    };
    const result = creatureDesignSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("accepts all valid primitive types", () => {
    for (const prim of ["sphere", "box", "cylinder", "cone", "torus", "capsule"]) {
      const design = {
        ...validDesign,
        parts: [{ ...validDesign.parts[0], primitive: prim }],
      };
      expect(creatureDesignSchema.safeParse(design).success).toBe(true);
    }
  });

  it("accepts all valid animation types", () => {
    for (const type of ["sway", "bob", "rotate", "wiggle", "flap"]) {
      const design = {
        ...validDesign,
        parts: [{
          ...validDesign.parts[0],
          animatable: { type },
        }],
      };
      expect(creatureDesignSchema.safeParse(design).success).toBe(true);
    }
  });

  it("accepts all valid expression shapes", () => {
    const design = {
      ...validDesign,
      expressions: {
        default: { eyes: { shape: "round" }, mouth: { shape: "smile" } },
        happy: { eyes: { shape: "happy" }, mouth: { shape: "open" } },
        sleepy: { eyes: { shape: "sleepy" }, mouth: { shape: "flat" } },
        focused: { eyes: { shape: "sparkle" }, mouth: { shape: "pout" } },
      },
    };
    expect(creatureDesignSchema.safeParse(design).success).toBe(true);
  });
});
