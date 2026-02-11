import { describe, it, expect } from "vitest";
import { shouldTrigger, selectMessage } from "../../src/encouragement/trigger.js";
import { createPrng } from "../../src/utils/hash.js";

describe("shouldTrigger", () => {
  it("returns true when rate exceeds threshold and cooldown elapsed", () => {
    const result = shouldTrigger(60_000, 50_000, "2026-01-01T00:00:00Z", 3);
    expect(result).toBe(true);
  });

  it("returns false when rate below threshold", () => {
    expect(shouldTrigger(10_000, 50_000, "2026-01-01T00:00:00Z", 3)).toBe(false);
  });

  it("returns false when cooldown not elapsed", () => {
    // lastShown = 1 hour ago, cooldown = 3 hours
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(shouldTrigger(60_000, 50_000, oneHourAgo, 3)).toBe(false);
  });

  it("returns true when lastShownAt is null (never shown)", () => {
    expect(shouldTrigger(60_000, 50_000, null, 3)).toBe(true);
  });
});

describe("selectMessage", () => {
  it("returns a non-empty string", () => {
    const prng = createPrng("aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111");
    const msg = selectMessage(prng);
    expect(msg).toBeTruthy();
    expect(typeof msg).toBe("string");
  });
});
