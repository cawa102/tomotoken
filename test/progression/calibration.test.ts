import { describe, it, expect } from "vitest";
import { computeCalibration } from "../../src/progression/calibration.js";

describe("computeCalibration", () => {
  it("computes T0 = M / 4.75 with g=1.5", () => {
    // 100k tokens over 10 days → M = (100000/10)*30 = 300000
    // T0 = 300000 / 4.75 = 63157.89... → ceil = 63158
    const result = computeCalibration(
      {
        totalTokensAllTime: 100_000,
        earliestTimestamp: "2026-01-01T00:00:00Z",
        latestTimestamp: "2026-01-10T00:00:00Z",
      },
      1.5,
      "ceil",
    );
    expect(result.monthlyEstimate).toBe(300_000);
    expect(result.t0).toBe(63158);
  });

  it("applies floor rounding", () => {
    const result = computeCalibration(
      {
        totalTokensAllTime: 100_000,
        earliestTimestamp: "2026-01-01T00:00:00Z",
        latestTimestamp: "2026-01-10T00:00:00Z",
      },
      1.5,
      "floor",
    );
    expect(result.t0).toBe(63157);
  });

  it("enforces minimum T0 of 1000", () => {
    const result = computeCalibration(
      {
        totalTokensAllTime: 100,
        earliestTimestamp: "2026-01-01T00:00:00Z",
        latestTimestamp: "2026-01-30T00:00:00Z",
      },
      1.5,
      "ceil",
    );
    expect(result.t0).toBeGreaterThanOrEqual(1000);
  });

  it("handles single-day data", () => {
    // Same day: daysBetween returns 1
    const result = computeCalibration(
      {
        totalTokensAllTime: 50_000,
        earliestTimestamp: "2026-01-15T08:00:00Z",
        latestTimestamp: "2026-01-15T20:00:00Z",
      },
      1.5,
      "ceil",
    );
    // M = (50000/1)*30 = 1500000, T0 = 1500000/4.75 = 315789.47... → 315790
    expect(result.monthlyEstimate).toBe(1_500_000);
    expect(result.t0).toBe(315790);
  });
});
