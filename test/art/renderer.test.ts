import { describe, it, expect } from "vitest";
import { renderArt } from "../../src/art/renderer.js";

describe("renderArt", () => {
  it("produces 4 frames of correct dimensions", () => {
    const output = renderArt({
      seed: "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
      progress: 0.5,
      archetype: "builder",
      subtype: "scholar",
      traits: { builder: 50, fixer: 20, refiner: 10, scholar: 10, scribe: 5, architect: 5, operator: 0, guardian: 0 },
      canvasWidth: 24,
      canvasHeight: 12,
    });
    expect(output.frames).toHaveLength(4);
    expect(output.colorFrames).toHaveLength(4);
    for (const frame of output.frames) {
      expect(frame.length).toBe(12);
      for (const line of frame) {
        expect(line.length).toBe(24);
      }
    }
  });

  it("is deterministic for same seed", () => {
    const params = {
      seed: "dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444",
      progress: 0.7,
      archetype: "scholar",
      subtype: "fixer",
      traits: { builder: 10, fixer: 30, refiner: 5, scholar: 40, scribe: 5, architect: 5, operator: 3, guardian: 2 },
      canvasWidth: 24,
      canvasHeight: 12,
    };
    const a = renderArt(params);
    const b = renderArt(params);
    expect(a.frames).toEqual(b.frames);
  });
});
