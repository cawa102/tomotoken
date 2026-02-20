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
