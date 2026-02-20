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

function shouldInclude(part: TemplatePart, showAccessories: readonly string[]): boolean {
  if (!part.optional) return true;
  return showAccessories.includes(part.accessoryGroup ?? "");
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
    const children = templatePart.children
      .filter(child => shouldInclude(child, customization.showAccessories))
      .map(child => convertPart(child, customization, speedMultiplier));
    if (children.length > 0) {
      part.children = children;
    }
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
    .filter(p => shouldInclude(p, customization.showAccessories))
    .map(p => convertPart(p, customization, speedMultiplier));

  return {
    parts,
    expressions: customization.expressions,
    personality: customization.personality,
  };
}
