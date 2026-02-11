import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Mulberry32 seeded PRNG.
 * Returns a function that produces deterministic floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a seeded PRNG from a hex string (e.g., SHA-256 hash).
 */
export function createPrng(hexSeed: string): () => number {
  const numericSeed = parseInt(hexSeed.slice(0, 8), 16);
  return mulberry32(numericSeed);
}
