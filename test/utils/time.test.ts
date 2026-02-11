import { describe, it, expect } from "vitest";
import { currentMonthString, daysBetween, hoursAgo } from "../../src/utils/time.js";

describe("currentMonthString", () => {
  it("formats correctly", () => {
    expect(currentMonthString(new Date("2026-02-15"))).toBe("2026-02");
    expect(currentMonthString(new Date("2026-12-01"))).toBe("2026-12");
  });
});

describe("daysBetween", () => {
  it("returns 1 for same day", () => {
    expect(daysBetween("2026-01-15T08:00:00Z", "2026-01-15T20:00:00Z")).toBe(1);
  });
  it("returns correct days", () => {
    expect(daysBetween("2026-01-01T00:00:00Z", "2026-01-10T00:00:00Z")).toBe(10);
  });
});
