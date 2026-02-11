import { z } from "zod";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEFAULT_FPS,
  ENCOURAGEMENT_COOLDOWN_HOURS,
  ENCOURAGEMENT_THRESHOLD,
  FRAME_COUNT,
  GROWTH_MULTIPLIER,
} from "./constants.js";

export const ConfigSchema = z.object({
  logPath: z.string().optional().refine(
    (p) => {
      if (!p) return true;
      const resolved = p.startsWith("~/") ? resolve(homedir(), p.slice(2)) : resolve(p);
      return resolved.startsWith(homedir());
    },
    "logPath must be within home directory",
  ),
  canvas: z
    .object({
      width: z.number().int().min(16).max(80).default(CANVAS_WIDTH),
      height: z.number().int().min(8).max(40).default(CANVAS_HEIGHT),
      frames: z.number().int().min(2).max(8).default(FRAME_COUNT),
    })
    .default({}),
  animation: z
    .object({
      enabled: z.boolean().default(true),
      fps: z.number().min(1).max(10).default(DEFAULT_FPS),
    })
    .default({}),
  growth: z
    .object({
      g: z.number().min(1.0).max(3.0).default(GROWTH_MULTIPLIER),
      t0Rounding: z.enum(["ceil", "floor", "round"]).default("ceil"),
    })
    .default({}),
  encouragement: z
    .object({
      enabled: z.boolean().default(true),
      tokensPerHourThreshold: z
        .number()
        .int()
        .min(1000)
        .default(ENCOURAGEMENT_THRESHOLD),
      cooldownHours: z
        .number()
        .min(0.5)
        .default(ENCOURAGEMENT_COOLDOWN_HOURS),
    })
    .default({}),
  privacy: z
    .object({
      storeRawMessages: z.boolean().default(false),
    })
    .default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export function createDefaultConfig(): Config {
  return ConfigSchema.parse({});
}
