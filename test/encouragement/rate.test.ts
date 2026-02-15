import { describe, it, expect } from "vitest";
import { tokensInWindow } from "../../src/encouragement/rate.js";
import type { TokenEvent } from "../../src/encouragement/rate.js";

describe("tokensInWindow", () => {
  const now = new Date("2026-02-15T12:00:00.000Z");

  it("returns 0 for empty events", () => {
    expect(tokensInWindow([], 60, now)).toBe(0);
  });

  it("sums all events within window", () => {
    const events: TokenEvent[] = [
      { tokens: 1000, timestamp: "2026-02-15T11:30:00.000Z" },
      { tokens: 2000, timestamp: "2026-02-15T11:45:00.000Z" },
    ];
    expect(tokensInWindow(events, 60, now)).toBe(3000);
  });

  it("excludes events outside window", () => {
    const events: TokenEvent[] = [
      { tokens: 5000, timestamp: "2026-02-15T10:00:00.000Z" }, // 2h ago
      { tokens: 1000, timestamp: "2026-02-15T11:30:00.000Z" }, // 30m ago
    ];
    expect(tokensInWindow(events, 60, now)).toBe(1000);
  });

  it("includes events exactly at window boundary", () => {
    const events: TokenEvent[] = [
      { tokens: 500, timestamp: "2026-02-15T11:00:00.000Z" }, // exactly 60m ago
    ];
    expect(tokensInWindow(events, 60, now)).toBe(500);
  });

  it("returns 0 when all events are expired", () => {
    const events: TokenEvent[] = [
      { tokens: 9999, timestamp: "2026-02-15T09:00:00.000Z" },
    ];
    expect(tokensInWindow(events, 60, now)).toBe(0);
  });
});
