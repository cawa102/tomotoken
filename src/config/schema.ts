import { z } from "zod";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  DEFAULT_FPS,
  ENCOURAGEMENT_COOLDOWN_HOURS,
  ENCOURAGEMENT_THRESHOLD,
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
  animation: z
    .object({
      enabled: z.boolean().default(true),
      fps: z.number().min(1).max(10).default(DEFAULT_FPS),
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
  llm: z
    .object({
      provider: z.enum(["anthropic", "openai"]).default("anthropic"),
      model: z.string().optional(),
      apiKey: z.string().min(1).optional(),
    })
    .default({})
    .transform((llm) => ({
      ...llm,
      model:
        llm.model ??
        (llm.provider === "openai" ? "gpt-5.2" : "claude-sonnet-4-6-20250620"),
    })),
});

export type Config = z.infer<typeof ConfigSchema>;

export function createDefaultConfig(): Config {
  return ConfigSchema.parse({});
}
