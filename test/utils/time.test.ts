import { describe, it, expect } from "vitest";
import { currentMonthString, daysBetween, hoursAgo } from "../../src/utils/time.js";

describe("currentMonthString", () => {
  it("formats correctly", () => {
    expect(currentMonthString(new Date("2026-02-15"))).toBe("2026-02");
    expect(currentMonthString(new Date("2026-12-01"))).toBe("2026-12");
  });

  it("pads single-digit months with leading zero", () => {
    expect(currentMonthString(new Date("2026-01-05"))).toBe("2026-01");
    expect(currentMonthString(new Date("2026-09-30"))).toBe("2026-09");
  });
});

describe("daysBetween", () => {
  it("returns 1 for same day", () => {
    expect(daysBetween("2026-01-15T08:00:00Z", "2026-01-15T20:00:00Z")).toBe(1);
  });

  it("returns correct days", () => {
    expect(daysBetween("2026-01-01T00:00:00Z", "2026-01-10T00:00:00Z")).toBe(10);
  });

  it("returns 1 for invalid date strings (NaN fallback)", () => {
    expect(daysBetween("not-a-date", "2026-01-15")).toBe(1);
    expect(daysBetween("2026-01-15", "invalid")).toBe(1);
    expect(daysBetween("garbage", "trash")).toBe(1);
  });

  it("handles reversed date order (uses absolute difference)", () => {
    expect(daysBetween("2026-01-10T00:00:00Z", "2026-01-01T00:00:00Z")).toBe(10);
  });
});

describe("hoursAgo", () => {
  it("returns positive hours for past timestamps", () => {
    const now = new Date("2026-01-15T12:00:00Z");
    const result = hoursAgo("2026-01-15T10:00:00Z", now);
    expect(result).toBeCloseTo(2);
  });

  it("returns negative hours for future timestamps", () => {
    const now = new Date("2026-01-15T10:00:00Z");
    const result = hoursAgo("2026-01-15T12:00:00Z", now);
    expect(result).toBeCloseTo(-2);
  });

  it("returns 0 for same timestamp", () => {
    const now = new Date("2026-01-15T12:00:00Z");
    const result = hoursAgo("2026-01-15T12:00:00Z", now);
    expect(result).toBe(0);
  });

  it("handles fractional hours", () => {
    const now = new Date("2026-01-15T12:30:00Z");
    const result = hoursAgo("2026-01-15T12:00:00Z", now);
    expect(result).toBeCloseTo(0.5);
  });
});
