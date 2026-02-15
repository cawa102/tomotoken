import { describe, it, expect, beforeAll } from "vitest";
import chalk from "chalk";
import { renderArt } from "../../src/art/renderer.js";
import type { DepthMetrics, StyleMetrics } from "../../src/store/types.js";

const DEPTH: DepthMetrics = { editTestLoopCount: 5, repeatEditSameFileCount: 3, phaseSwitchCount: 10, totalSessions: 5 };
const STYLE: StyleMetrics = { bulletRatio: 0.3, questionRatio: 0.02, codeblockRatio: 0.1, avgMessageLen: 200, messageLenStd: 50, headingRatio: 0.05 };
const TRAITS = { builder: 50, fixer: 20, refiner: 10, scholar: 10, scribe: 5, architect: 5, operator: 0, guardian: 0 };

beforeAll(() => {
  chalk.level = 1; // Force ANSI color output in test environment
});

describe("renderArt", () => {
  it("produces 4 frames of correct dimensions", () => {
    const output = renderArt({
      seed: "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
      progress: 0.5,
      traits: TRAITS,
      depthMetrics: DEPTH,
      styleMetrics: STYLE,
      canvasWidth: 32,
      canvasHeight: 16,
    });
    expect(output.frames).toHaveLength(4);
    expect(output.colorFrames).toHaveLength(4);
    for (const frame of output.frames) {
      expect(frame.length).toBe(16);
      for (const line of frame) {
        expect(line.length).toBe(32);
      }
    }
  });

  it("is deterministic for same seed", () => {
    const params = {
      seed: "dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444",
      progress: 0.7,
      traits: { builder: 10, fixer: 30, refiner: 5, scholar: 40, scribe: 5, architect: 5, operator: 3, guardian: 2 },
      depthMetrics: DEPTH,
      styleMetrics: STYLE,
      canvasWidth: 32,
      canvasHeight: 16,
    };
    const a = renderArt(params);
    const b = renderArt(params);
    expect(a.frames).toEqual(b.frames);
  });

  it("produces half-block characters in raw frames", () => {
    const output = renderArt({
      seed: "ffff6666ffff6666ffff6666ffff6666ffff6666ffff6666ffff6666ffff6666",
      progress: 0.9,
      traits: { builder: 80 },
      depthMetrics: DEPTH,
      styleMetrics: STYLE,
      canvasWidth: 32,
      canvasHeight: 16,
    });

    // At least some frame lines should contain half-block characters
    const allChars = output.frames.flat().join("");
    const hasBlocks = /[\u2580\u2584\u2588]/.test(allChars);
    expect(hasBlocks).toBe(true);
  });

  it("colorFrames contain ANSI escape sequences", () => {
    const output = renderArt({
      seed: "aaaa7777aaaa7777aaaa7777aaaa7777aaaa7777aaaa7777aaaa7777aaaa7777",
      progress: 0.5,
      traits: { builder: 50 },
      depthMetrics: DEPTH,
      styleMetrics: STYLE,
      canvasWidth: 32,
      canvasHeight: 16,
    });

    // Color frames should have ANSI escape sequences
    const allColorChars = output.colorFrames.flat().join("");
    expect(allColorChars).toContain("\x1b[");
  });
});
