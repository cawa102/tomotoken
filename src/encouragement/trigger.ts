import { hoursAgo } from "../utils/time.js";
import { ENCOURAGEMENT_MESSAGES } from "./messages.js";

export function shouldTrigger(
  tokensLastHour: number,
  threshold: number,
  lastShownAt: string | null,
  cooldownHours: number,
): boolean {
  if (tokensLastHour < threshold) return false;
  if (lastShownAt === null) return true;
  return hoursAgo(lastShownAt) >= cooldownHours;
}

export function selectMessage(prng: () => number): string {
  const idx = Math.floor(prng() * ENCOURAGEMENT_MESSAGES.length);
  return ENCOURAGEMENT_MESSAGES[idx];
}
