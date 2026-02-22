# Template-Based 3D Creature Design Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace free-form LLM 3D coordinate generation with a template system where humanoid body coordinates are hardcoded and LLM only customizes colors, accessories, expressions, and personality.

**Architecture:** A `humanoid` template defines all part positions/scales/rotations as constants. A new `Customization` type replaces the raw `CreatureDesign` as the LLM output. `applyCustomization(template, customization)` produces a valid `CreatureDesign`. The existing viewer, schema, and animation systems remain unchanged — only the generation layer changes.

**Tech Stack:** TypeScript, Zod, vitest, Three.js (viewer unchanged)

---

## Background: Why This Change

LLM (Claude) cannot reliably generate 3D coordinates. The current approach asks Claude to output `position [x,y,z]`, `rotation [x,y,z]`, `scale [x,y,z]` for every part — but Claude lacks spatial reasoning for:
- Parent-child scale accumulation (children scale relative to parent)
- Precise joint positioning (parts end up disconnected)
- Overall proportion control

The result is a monster of floating, misaligned parts (see screenshot from 2026-02-20).

**Solution:** Hardcode the geometry. Let Claude pick colors, personality, and accessories.

## Key Design Decisions

1. **Template = complete CreatureDesign minus colors/expressions/personality** — The template stores all 3D geometry data (primitive, position, rotation, scale) for every part. Colors, materials, expressions, personality, and which optional parts to show are determined by the `Customization` object.

2. **`Customization` is the new LLM output** — Much simpler than `CreatureDesign`:
   ```typescript
   interface Customization {
     bodyColor: string;        // "#RRGGBB" - main body color
     accentColor: string;      // "#RRGGBB" - accent (ears, tail tip, etc.)
     eyeColor: string;         // "#RRGGBB" - pupil color
     accessoryColor: string;   // "#RRGGBB" - for accessories
     showAccessories: string[];// subset of ["hat", "scarf", "backpack", "glasses"]
     animationStyle: "calm" | "energetic" | "sleepy";
     expressions: CreatureDesign["expressions"];
     personality: { name: string; quirk: string };
   }
   ```

3. **`applyCustomization` is a pure function** — Takes template geometry + customization → returns `CreatureDesign`. No side effects. Easy to test.

4. **Viewer needs zero changes** — The output is still a valid `CreatureDesign`. `buildFromDesign()`, `applyAnimations()`, `applyExpression()` all work as-is.

5. **Existing `creatureDesignSchema` unchanged** — It validates the _output_ of `applyCustomization`, not the LLM's raw input.

## File Changes

### New Files
| File | Purpose |
|------|---------|
| `src/generation/templates/humanoid.ts` | Hardcoded humanoid body template |
| `src/generation/templates/types.ts` | `TemplatePart`, `BodyTemplate`, `Customization` types + Zod schema |
| `src/generation/templates/apply.ts` | `applyCustomization(template, customization): CreatureDesign` |
| `src/generation/templates/index.ts` | Barrel export |
| `test/generation/templates/apply.test.ts` | Tests for `applyCustomization` |
| `test/generation/templates/humanoid.test.ts` | Tests for humanoid template validity |

### Modified Files
| File | Change |
|------|--------|
| `src/generation/cli.ts` | `getDesignContext` outputs template-aware context; `saveDesign` accepts `Customization` JSON and runs `applyCustomization` before saving |
| `src/generation/prompt.ts` | `buildPrompt` now describes `Customization` schema instead of raw parts |
| `src/generation/index.ts` | Add template barrel re-exports |
| `.claude/commands/generate-design.md` | Update instructions to describe `Customization` format |
| `test/generation/cli.test.ts` | Update test fixtures to use `Customization` input |
| `test/generation/prompt.test.ts` | Update prompt expectations |

### Unchanged Files (verify still work)
| File | Reason |
|------|--------|
| `src/generation/schema.ts` | Output format unchanged |
| `src/viewer/public/js/creature.js` | Consumes `CreatureDesign` — no change needed |
| `src/viewer/public/js/animation.js` | Reads `userData.animatable` — still present |
| `src/viewer/public/js/expression.js` | Reads expressions by name — still works |
| `src/sidecar/render-data.ts` | Reads `generatedDesigns[stage]` — still `CreatureDesign` |

---

## Tasks

### Task 1: Define template types and Customization schema

**Files:**
- Create: `src/generation/templates/types.ts`

**Step 1: Write the types and Zod schema**

```typescript
// src/generation/templates/types.ts
import { z } from "zod";

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/**
 * A template part stores geometry data only (no color).
 * Color is applied later from Customization.
 */
export interface TemplatePart {
  readonly name: string;
  readonly primitive: "sphere" | "box" | "cylinder" | "cone" | "torus" | "capsule";
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
  readonly colorRole: "body" | "accent" | "eye" | "eyeWhite" | "mouth" | "accessory";
  readonly material: {
    readonly roughness: number;
    readonly metalness: number;
    readonly flatShading: boolean;
  };
  readonly animatable?: {
    readonly type: "sway" | "bob" | "rotate" | "wiggle" | "flap";
    readonly speed?: number;
    readonly amplitude?: number;
  };
  readonly children?: readonly TemplatePart[];
  readonly optional?: boolean; // true = only shown if included in showAccessories
  readonly accessoryGroup?: string; // e.g., "hat", "scarf" — links to showAccessories
}

export interface BodyTemplate {
  readonly id: string;
  readonly name: string;
  readonly parts: readonly TemplatePart[];
}

export const customizationSchema = z.object({
  bodyColor: hexColorSchema,
  accentColor: hexColorSchema,
  eyeColor: hexColorSchema,
  accessoryColor: hexColorSchema,
  showAccessories: z.array(z.enum(["hat", "scarf", "backpack", "glasses"])),
  animationStyle: z.enum(["calm", "energetic", "sleepy"]),
  expressions: z.record(z.string(), z.object({
    eyes: z.object({
      scaleY: z.number().optional(),
      offsetY: z.number().optional(),
      shape: z.enum(["round", "happy", "sleepy", "sparkle"]).optional(),
    }).optional(),
    mouth: z.object({
      scaleX: z.number().optional(),
      scaleY: z.number().optional(),
      shape: z.enum(["smile", "open", "flat", "pout"]).optional(),
    }).optional(),
  })),
  personality: z.object({
    name: z.string().min(1),
    quirk: z.string().min(1),
  }),
});

export type Customization = z.infer<typeof customizationSchema>;
```

**Step 2: Commit**

```bash
git add src/generation/templates/types.ts
git commit -m "feat: add template types and Customization Zod schema"
```

---

### Task 2: Create humanoid body template

**Files:**
- Create: `src/generation/templates/humanoid.ts`
- Create: `test/generation/templates/humanoid.test.ts`

**Step 1: Write test to validate humanoid template structure**

```typescript
// test/generation/templates/humanoid.test.ts
import { describe, it, expect } from "vitest";
import { humanoidTemplate } from "../../../src/generation/templates/humanoid.js";

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
      // x: -1 to 1, y: -0.5 to 2.5, z: -1 to 1
      expect(p.position[0]).toBeGreaterThanOrEqual(-1.5);
      expect(p.position[0]).toBeLessThanOrEqual(1.5);
      expect(p.position[1]).toBeGreaterThanOrEqual(-0.5);
      expect(p.position[1]).toBeLessThanOrEqual(2.5);
      expect(p.position[2]).toBeGreaterThanOrEqual(-1.5);
      expect(p.position[2]).toBeLessThanOrEqual(1.5);
    }
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

function flattenNames(parts: readonly any[]): string[] {
  return flattenParts(parts).map(p => p.name);
}

function flattenColorRoles(parts: readonly any[]): string[] {
  return flattenParts(parts).map(p => p.colorRole);
}
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/generation/templates/humanoid.test.ts`
Expected: FAIL — module not found

**Step 3: Create the humanoid template**

The coordinates below are adapted from the **working** `buildLegacyCreature` in `creature.js` (lines 106-371), which produces a correctly proportioned character. The key insight is to use absolute (not relative) coordinates for top-level parts and minimal nesting.

```typescript
// src/generation/templates/humanoid.ts
import type { BodyTemplate } from "./types.js";

export const humanoidTemplate: BodyTemplate = {
  id: "humanoid",
  name: "Humanoid",
  parts: [
    // === BODY (main torso) ===
    {
      name: "body",
      primitive: "capsule",
      position: [0, 0.75, 0],
      rotation: [0, 0, 0],
      scale: [0.45, 0.45, 0.38],
      colorRole: "body",
      material: { roughness: 0.7, metalness: 0.05, flatShading: true },
    },
    // === HEAD ===
    {
      name: "head",
      primitive: "sphere",
      position: [0, 1.45, 0],
      rotation: [0, 0, 0],
      scale: [0.32, 0.30, 0.30],
      colorRole: "body",
      material: { roughness: 0.7, metalness: 0.05, flatShading: true },
      animatable: { type: "bob", speed: 0.8, amplitude: 0.015 },
      children: [
        // Eyes (children of head — positions relative to head center)
        {
          name: "eye-left",
          primitive: "sphere",
          position: [-0.4, 0.1, 0.75],
          rotation: [0, 0, 0],
          scale: [0.3, 0.35, 0.18],
          colorRole: "eyeWhite",
          material: { roughness: 0.3, metalness: 0.0, flatShading: false },
          children: [{
            name: "pupil-left",
            primitive: "sphere",
            position: [0, 0, 0.45],
            rotation: [0, 0, 0],
            scale: [0.5, 0.55, 0.35],
            colorRole: "eye",
            material: { roughness: 0.2, metalness: 0.0, flatShading: false },
          }],
        },
        {
          name: "eye-right",
          primitive: "sphere",
          position: [0.4, 0.1, 0.75],
          rotation: [0, 0, 0],
          scale: [0.3, 0.35, 0.18],
          colorRole: "eyeWhite",
          material: { roughness: 0.3, metalness: 0.0, flatShading: false },
          children: [{
            name: "pupil-right",
            primitive: "sphere",
            position: [0, 0, 0.45],
            rotation: [0, 0, 0],
            scale: [0.5, 0.55, 0.35],
            colorRole: "eye",
            material: { roughness: 0.2, metalness: 0.0, flatShading: false },
          }],
        },
        // Mouth
        {
          name: "mouth",
          primitive: "sphere",
          position: [0, -0.35, 0.7],
          rotation: [0, 0, 0],
          scale: [0.35, 0.1, 0.12],
          colorRole: "mouth",
          material: { roughness: 0.8, metalness: 0.0, flatShading: true },
        },
        // Ears
        {
          name: "ear-left",
          primitive: "cone",
          position: [-0.7, 0.35, 0],
          rotation: [0, 0, 0.4],
          scale: [0.18, 0.28, 0.15],
          colorRole: "accent",
          material: { roughness: 0.8, metalness: 0.1, flatShading: true },
          animatable: { type: "wiggle", speed: 1.2, amplitude: 0.08 },
        },
        {
          name: "ear-right",
          primitive: "cone",
          position: [0.7, 0.35, 0],
          rotation: [0, 0, -0.4],
          scale: [0.18, 0.28, 0.15],
          colorRole: "accent",
          material: { roughness: 0.8, metalness: 0.1, flatShading: true },
          animatable: { type: "wiggle", speed: 1.2, amplitude: 0.08 },
        },
      ],
    },
    // === ARMS ===
    {
      name: "arm-left",
      primitive: "capsule",
      position: [-0.5, 0.85, 0],
      rotation: [0, 0, 0.3],
      scale: [0.08, 0.18, 0.08],
      colorRole: "body",
      material: { roughness: 0.7, metalness: 0.05, flatShading: true },
      animatable: { type: "sway", speed: 1.0, amplitude: 0.12 },
    },
    {
      name: "arm-right",
      primitive: "capsule",
      position: [0.5, 0.85, 0],
      rotation: [0, 0, -0.3],
      scale: [0.08, 0.18, 0.08],
      colorRole: "body",
      material: { roughness: 0.7, metalness: 0.05, flatShading: true },
      animatable: { type: "sway", speed: 1.0, amplitude: 0.12 },
    },
    // === LEGS ===
    {
      name: "leg-left",
      primitive: "capsule",
      position: [-0.18, 0.22, 0],
      rotation: [0, 0, 0],
      scale: [0.1, 0.18, 0.1],
      colorRole: "accent",
      material: { roughness: 0.9, metalness: 0.05, flatShading: true },
      children: [{
        name: "foot-left",
        primitive: "box",
        position: [0, -0.7, 0.15],
        rotation: [0, 0, 0],
        scale: [0.85, 0.3, 1.2],
        colorRole: "accent",
        material: { roughness: 0.9, metalness: 0.0, flatShading: true },
      }],
    },
    {
      name: "leg-right",
      primitive: "capsule",
      position: [0.18, 0.22, 0],
      rotation: [0, 0, 0],
      scale: [0.1, 0.18, 0.1],
      colorRole: "accent",
      material: { roughness: 0.9, metalness: 0.05, flatShading: true },
      children: [{
        name: "foot-right",
        primitive: "box",
        position: [0, -0.7, 0.15],
        rotation: [0, 0, 0],
        scale: [0.85, 0.3, 1.2],
        colorRole: "accent",
        material: { roughness: 0.9, metalness: 0.0, flatShading: true },
      }],
    },
    // === TAIL ===
    {
      name: "tail",
      primitive: "capsule",
      position: [0, 0.5, -0.35],
      rotation: [0.6, 0, 0],
      scale: [0.06, 0.15, 0.06],
      colorRole: "accent",
      material: { roughness: 0.8, metalness: 0.1, flatShading: true },
      animatable: { type: "sway", speed: 2.0, amplitude: 0.2 },
    },
    // === ACCESSORIES (optional) ===
    {
      name: "hat",
      primitive: "cylinder",
      position: [0, 1.78, 0],
      rotation: [0, 0, 0],
      scale: [0.35, 0.15, 0.35],
      colorRole: "accessory",
      material: { roughness: 0.6, metalness: 0.1, flatShading: true },
      optional: true,
      accessoryGroup: "hat",
    },
    {
      name: "scarf",
      primitive: "torus",
      position: [0, 1.15, 0],
      rotation: [1.5708, 0, 0],
      scale: [0.32, 0.32, 0.06],
      colorRole: "accessory",
      material: { roughness: 0.9, metalness: 0.0, flatShading: true },
      optional: true,
      accessoryGroup: "scarf",
    },
    {
      name: "backpack",
      primitive: "box",
      position: [0, 0.8, -0.35],
      rotation: [0, 0, 0],
      scale: [0.25, 0.3, 0.15],
      colorRole: "accessory",
      material: { roughness: 0.8, metalness: 0.05, flatShading: true },
      optional: true,
      accessoryGroup: "backpack",
    },
    {
      name: "glasses",
      primitive: "torus",
      position: [0, 1.47, 0.25],
      rotation: [1.5708, 0, 0],
      scale: [0.28, 0.08, 0.12],
      colorRole: "accessory",
      material: { roughness: 0.3, metalness: 0.5, flatShading: true },
      optional: true,
      accessoryGroup: "glasses",
    },
  ],
};
```

**Important:** These coordinates MUST be visually verified in the viewer. The exact values above are a starting point derived from `buildLegacyCreature` but will need manual tuning.

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/generation/templates/humanoid.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/generation/templates/humanoid.ts test/generation/templates/humanoid.test.ts
git commit -m "feat: add humanoid body template with hardcoded coordinates"
```

---

### Task 3: Implement `applyCustomization`

**Files:**
- Create: `src/generation/templates/apply.ts`
- Create: `test/generation/templates/apply.test.ts`

**Step 1: Write failing tests**

```typescript
// test/generation/templates/apply.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/generation/templates/apply.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/generation/templates/apply.ts
import type { CreatureDesign, Part } from "../schema.js";
import type { BodyTemplate, TemplatePart, Customization } from "./types.js";

const ANIMATION_SPEED_MULTIPLIERS: Record<string, number> = {
  calm: 1.0,
  energetic: 1.8,
  sleepy: 0.5,
};

function resolveColor(colorRole: string, customization: Customization): string {
  switch (colorRole) {
    case "body": return customization.bodyColor;
    case "accent": return customization.accentColor;
    case "eye": return customization.eyeColor;
    case "eyeWhite": return "#ffffff";
    case "mouth": return darkenColor(customization.bodyColor, 0.5);
    case "accessory": return customization.accessoryColor;
    default: return customization.bodyColor;
  }
}

function darkenColor(hex: string, factor: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function convertPart(
  templatePart: TemplatePart,
  customization: Customization,
  speedMultiplier: number,
): Part {
  const part: Part = {
    name: templatePart.name,
    primitive: templatePart.primitive,
    position: [...templatePart.position] as [number, number, number],
    rotation: [...templatePart.rotation] as [number, number, number],
    scale: [...templatePart.scale] as [number, number, number],
    color: resolveColor(templatePart.colorRole, customization),
    material: { ...templatePart.material },
  };

  if (templatePart.animatable) {
    part.animatable = {
      type: templatePart.animatable.type,
      speed: (templatePart.animatable.speed ?? 1.0) * speedMultiplier,
      amplitude: templatePart.animatable.amplitude,
    };
  }

  if (templatePart.children) {
    part.children = templatePart.children
      .filter(child => !child.optional || customization.showAccessories.includes(child.accessoryGroup as any))
      .map(child => convertPart(child, customization, speedMultiplier));
  }

  return part;
}

/**
 * Apply a Customization to a BodyTemplate, producing a valid CreatureDesign.
 * Pure function — no side effects.
 */
export function applyCustomization(
  template: BodyTemplate,
  customization: Customization,
): CreatureDesign {
  const speedMultiplier = ANIMATION_SPEED_MULTIPLIERS[customization.animationStyle] ?? 1.0;

  const parts = template.parts
    .filter(p => !p.optional || customization.showAccessories.includes(p.accessoryGroup as any))
    .map(p => convertPart(p, customization, speedMultiplier));

  return {
    parts,
    expressions: customization.expressions,
    personality: customization.personality,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/generation/templates/apply.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/generation/templates/apply.ts test/generation/templates/apply.test.ts
git commit -m "feat: implement applyCustomization to convert template + customization to CreatureDesign"
```

---

### Task 4: Create barrel export for templates

**Files:**
- Create: `src/generation/templates/index.ts`

**Step 1: Write barrel export**

```typescript
// src/generation/templates/index.ts
export { humanoidTemplate } from "./humanoid.js";
export { applyCustomization } from "./apply.js";
export { customizationSchema, type Customization, type BodyTemplate, type TemplatePart } from "./types.js";
```

**Step 2: Update generation barrel (`src/generation/index.ts`)**

Add template re-exports to existing barrel:

```typescript
// Append to src/generation/index.ts:
export { humanoidTemplate, applyCustomization, customizationSchema, type Customization } from "./templates/index.js";
```

**Step 3: Commit**

```bash
git add src/generation/templates/index.ts src/generation/index.ts
git commit -m "feat: add barrel exports for template system"
```

---

### Task 5: Update `cli.ts` to accept Customization input

**Files:**
- Modify: `src/generation/cli.ts`
- Modify: `test/generation/cli.test.ts`

**Step 1: Update cli.test.ts**

Key changes:
- `getDesignContext` should now include `templateId` and `customizationSchema` description instead of full `prompt` + `schemaHint`
- `saveDesign` should accept a `Customization` JSON (not raw `CreatureDesign`), run `applyCustomization`, then save the resulting `CreatureDesign`

```typescript
// Update the imports in test/generation/cli.test.ts:
import type { Customization } from "../../src/generation/templates/types.js";

// Replace validDesign with validCustomization for saveDesign tests:
const validCustomization: Customization = {
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

// Update saveDesign tests to use validCustomization instead of validDesign
// The returned design should be a full CreatureDesign (result of applyCustomization)
```

**Step 2: Update `cli.ts`**

Update `getDesignContext`:
- Replace `schemaHint` with customization-focused hint
- Replace `prompt` with a shorter prompt that describes the `Customization` format
- Add `templateId: "humanoid"` to context

Update `saveDesign`:
- Parse input as `Customization` (not `CreatureDesign`)
- Run `customizationSchema.parse()` for validation
- Call `applyCustomization(humanoidTemplate, customization)` to get `CreatureDesign`
- Validate result with `creatureDesignSchema.parse()` (defense in depth)
- Save the resulting `CreatureDesign` (not the raw customization)

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: All PASS

**Step 4: Commit**

```bash
git add src/generation/cli.ts test/generation/cli.test.ts
git commit -m "feat: update CLI to accept Customization input and apply template"
```

---

### Task 6: Update prompt.ts for Customization format

**Files:**
- Modify: `src/generation/prompt.ts`
- Modify: `test/generation/prompt.test.ts`

**Step 1: Update prompt.ts**

Replace the full `CreatureDesign` JSON format instructions with `Customization` format.
The prompt should:
- Explain the character's personality data (archetype, traits — same as before)
- Show the `Customization` JSON schema (much simpler)
- List available accessories
- Explain animation styles (calm/energetic/sleepy)
- Still ask for expressions and personality name/quirk

**Step 2: Update prompt tests**

- Expect prompt to contain "bodyColor" and "accentColor" instead of "position" and "primitive"
- Expect prompt to contain "showAccessories"
- Keep existing checks for archetype/subtype/trait presence

**Step 3: Run tests**

Run: `npx vitest run test/generation/prompt.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/generation/prompt.ts test/generation/prompt.test.ts
git commit -m "feat: update prompt to describe Customization format instead of raw parts"
```

---

### Task 7: Update `.claude/commands/generate-design.md`

**Files:**
- Modify: `.claude/commands/generate-design.md`

**Step 1: Update command instructions**

Key changes:
- The `--context` output now includes `customizationHint` describing the simpler format
- Claude should output a `Customization` JSON (bodyColor, accentColor, eyeColor, etc.) not raw parts
- Step-by-step stays the same (context → generate → save)
- Add example output to help Claude generate correct format

**Step 2: Commit**

```bash
git add .claude/commands/generate-design.md
git commit -m "docs: update generate-design command for template-based customization"
```

---

### Task 8: Visual verification and coordinate tuning

**Files:**
- May modify: `src/generation/templates/humanoid.ts` (coordinate adjustments)

**Step 1: Start the viewer**

Run: `npm run dev:viewer`

**Step 2: Generate a design using the new template system**

Run: `npx tsx src/generation/cli.ts --context`
Then pipe a `Customization` JSON to `--save`:

```bash
echo '{"bodyColor":"#4a6741","accentColor":"#8faa7e","eyeColor":"#1a1a2e","accessoryColor":"#d4a017","showAccessories":["hat"],"animationStyle":"calm","expressions":{"default":{"eyes":{"shape":"round"},"mouth":{"shape":"flat"}},"happy":{"eyes":{"shape":"happy"},"mouth":{"shape":"smile"}},"sleepy":{"eyes":{"shape":"sleepy"},"mouth":{"shape":"flat"}},"focused":{"eyes":{"shape":"sparkle"},"mouth":{"shape":"flat"}}},"personality":{"name":"TestBot","quirk":"Testing coordinates"}}' | npx tsx src/generation/cli.ts --save
```

**Step 3: Check http://localhost:3456**

Verify:
- [-] Body and head are connected (no gap)
- [-] Eyes are visible, proportional, on the face
- [-] Arms attach to body sides
- [-] Legs touch the ground (y ≈ 0)
- [-] Ears are on top of head
- [-] Hat (if shown) sits on top of head
- [-] Tail emerges from back of body
- [-] Animations play (arm sway, head bob, ear wiggle, tail wag)

**Step 4: Adjust coordinates in `humanoid.ts` if needed**

This is manual visual tuning. Common adjustments:
- Move head down if floating above body
- Adjust arm y-position to align with body sides
- Adjust foot y-position so legs touch ground
- Scale eyes down if too large

**Step 5: Run tests after adjustments**

Run: `npx vitest run`
Expected: All PASS

**Step 6: Commit**

```bash
git add src/generation/templates/humanoid.ts
git commit -m "fix: tune humanoid template coordinates after visual verification"
```

---

### Task 9: Full verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All PASS (330+ tests)

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Run build**

Run: `npm run build`
Expected: Success

**Step 4: End-to-end test**

1. `npx tsx src/generation/cli.ts --context` → outputs JSON with `templateId` and customization hints
2. `echo '<Customization JSON>' | npx tsx src/generation/cli.ts --save` → saves successfully
3. `npm run dev:viewer` → character displays correctly with applied colors

**Step 5: Final commit if any remaining changes**

```bash
git add -A && git commit -m "chore: final verification — all tests, typecheck, build pass"
```
