import type { DepthMetrics, StyleMetrics } from "../store/types.js";

export interface PromptInput {
  readonly archetype: string;
  readonly subtype: string;
  readonly traits: Record<string, number>;
  readonly depth: DepthMetrics;
  readonly style: StyleMetrics;
  readonly stage: number;
  readonly previousParts: readonly unknown[] | null;
}

export function buildPrompt(input: PromptInput): string {
  const traitList = Object.entries(input.traits)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  const previousPartsSection = input.previousParts
    ? `\n## Previous parts (reference for visual continuity)\n\`\`\`json\n${JSON.stringify(input.previousParts, null, 2)}\n\`\`\``
    : "";

  return `You are a creature designer. Build a cute toy-style character using 3D primitives.

## Character personality
- Archetype: ${input.archetype} (leans ${input.subtype})
- Trait scores: ${traitList}
- Depth: sessions=${input.depth.totalSessions}, edit-test loops=${input.depth.editTestLoopCount}, phase switches=${input.depth.phaseSwitchCount}
- Style: codeblock ratio=${input.style.codeblockRatio.toFixed(2)}, question ratio=${input.style.questionRatio.toFixed(2)}, heading ratio=${input.style.headingRatio.toFixed(2)}, avg message len=${Math.round(input.style.avgMessageLen)}
${previousPartsSection}

## Output format

Return ONLY a JSON object (no explanation, no markdown fences) with this structure:

{
  "parts": [ ... ],
  "expressions": { "default": ..., "happy": ..., "sleepy": ..., "focused": ... },
  "personality": { "name": "...", "quirk": "..." }
}

### parts

An array of part objects. Each part is a 3D primitive:
- name: string — descriptive name (e.g. "body", "head", "left_eye")
- primitive: "sphere" | "box" | "cylinder" | "cone" | "torus" | "capsule"
- position: [x, y, z] — world position
- rotation: [x, y, z] — rotation in radians
- scale: [x, y, z] — scale factors
- color: "#RRGGBB" — hex color
- material: { roughness: 0-1, metalness: 0-1, flatShading: boolean }
- animatable (optional): { type: "sway"|"bob"|"rotate"|"wiggle"|"flap", speed?: number, amplitude?: number }
- children (optional): nested array of parts (same structure, max 20)

Build the character bottom-up:
1. Body: large sphere or capsule as torso (position near origin)
2. Head: sphere on top of body (larger relative to body for cute proportions)
3. Eyes: two small spheres on head front (use dark color for pupils, lighter for iris)
4. Ears/horns: small shapes on top or sides of head
5. Limbs: small cylinders or capsules for arms/legs
6. Tail: optional, use cone or capsule behind body
7. Accessories: optional extras reflecting the archetype personality

### expressions

Four expression presets: "default", "happy", "sleepy", "focused".
Each has optional:
- eyes: { scaleY?: number, offsetY?: number, shape?: "round"|"happy"|"sleepy"|"sparkle" }
- mouth: { scaleX?: number, scaleY?: number, shape?: "smile"|"open"|"flat"|"pout" }

### personality

- name: a creative character name
- quirk: one-sentence personality description

## Design guidelines

- Choose colors that match the archetype (e.g. builder=warm tones, scholar=cool tones)
- Use material roughness 0.6-0.9 and metalness 0.0-0.1 for a toon/clay look
- Set flatShading: false for smooth surfaces
- Keep total parts between 8-25 for a detailed but performant character
- Add animatable to 2-3 parts for liveliness (ears wiggle, tail sway, body bob)

## Example output

{
  "parts": [
    { "name": "body", "primitive": "sphere", "position": [0, 0.5, 0], "rotation": [0, 0, 0], "scale": [0.6, 0.7, 0.5], "color": "#FF9966", "material": { "roughness": 0.8, "metalness": 0.0, "flatShading": false }, "animatable": { "type": "bob", "speed": 1.0, "amplitude": 0.05 } },
    { "name": "head", "primitive": "sphere", "position": [0, 1.3, 0], "rotation": [0, 0, 0], "scale": [0.55, 0.5, 0.5], "color": "#FF9966", "material": { "roughness": 0.8, "metalness": 0.0, "flatShading": false } },
    { "name": "left_eye", "primitive": "sphere", "position": [-0.15, 1.4, 0.35], "rotation": [0, 0, 0], "scale": [0.08, 0.1, 0.08], "color": "#2B2B2B", "material": { "roughness": 0.3, "metalness": 0.0, "flatShading": false } },
    { "name": "right_eye", "primitive": "sphere", "position": [0.15, 1.4, 0.35], "rotation": [0, 0, 0], "scale": [0.08, 0.1, 0.08], "color": "#2B2B2B", "material": { "roughness": 0.3, "metalness": 0.0, "flatShading": false } },
    { "name": "left_ear", "primitive": "cone", "position": [-0.3, 1.7, 0], "rotation": [0, 0, 0.3], "scale": [0.12, 0.2, 0.12], "color": "#FFB088", "material": { "roughness": 0.8, "metalness": 0.0, "flatShading": false }, "animatable": { "type": "wiggle", "speed": 2.0, "amplitude": 0.1 } },
    { "name": "right_ear", "primitive": "cone", "position": [0.3, 1.7, 0], "rotation": [0, 0, -0.3], "scale": [0.12, 0.2, 0.12], "color": "#FFB088", "material": { "roughness": 0.8, "metalness": 0.0, "flatShading": false }, "animatable": { "type": "wiggle", "speed": 2.0, "amplitude": 0.1 } }
  ],
  "expressions": {
    "default": { "eyes": { "shape": "round" }, "mouth": { "shape": "flat" } },
    "happy": { "eyes": { "shape": "happy", "scaleY": 0.8 }, "mouth": { "shape": "smile", "scaleX": 1.2 } },
    "sleepy": { "eyes": { "shape": "sleepy", "scaleY": 0.5 }, "mouth": { "shape": "flat" } },
    "focused": { "eyes": { "shape": "sparkle", "scaleY": 1.1 }, "mouth": { "shape": "flat" } }
  },
  "personality": { "name": "Ember", "quirk": "Always excited to start a new build" }
}`;
}
