import { z } from "zod";

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const materialSchema = z.object({
  roughness: z.number().min(0).max(1),
  metalness: z.number().min(0).max(1),
  flatShading: z.boolean(),
});

const animatableSchema = z.object({
  type: z.enum(["sway", "bob", "rotate", "wiggle", "flap"]),
  speed: z.number().optional(),
  amplitude: z.number().optional(),
});

const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

const basePartSchema = z.object({
  name: z.string().min(1),
  primitive: z.enum(["sphere", "box", "cylinder", "cone", "torus", "capsule"]),
  position: vec3Schema,
  rotation: vec3Schema,
  scale: vec3Schema,
  color: hexColorSchema,
  material: materialSchema,
  animatable: animatableSchema.optional(),
});

type Part = z.infer<typeof basePartSchema> & { children?: Part[] };
const partSchema: z.ZodType<Part> = basePartSchema.extend({
  children: z.lazy(() => partSchema.array()).optional(),
});

const eyeExpressionSchema = z.object({
  scaleY: z.number().optional(),
  offsetY: z.number().optional(),
  shape: z.enum(["round", "happy", "sleepy", "sparkle"]).optional(),
});

const mouthExpressionSchema = z.object({
  scaleX: z.number().optional(),
  scaleY: z.number().optional(),
  shape: z.enum(["smile", "open", "flat", "pout"]).optional(),
});

const expressionSchema = z.object({
  eyes: eyeExpressionSchema.optional(),
  mouth: mouthExpressionSchema.optional(),
});

const personalitySchema = z.object({
  name: z.string().min(1),
  quirk: z.string().min(1),
});

export const creatureDesignSchema = z.object({
  parts: z.array(partSchema).min(1),
  expressions: z.record(z.string(), expressionSchema),
  personality: personalitySchema,
});

export type CreatureDesign = z.infer<typeof creatureDesignSchema>;
export type { Part };
export type Expression = z.infer<typeof expressionSchema>;
