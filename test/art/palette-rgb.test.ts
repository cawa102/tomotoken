import { describe, it, expect } from "vitest";
import { ansi256ToHex, paletteToHexArray, generatePalette, type Palette } from "../../src/art/parametric/palette.js";

describe("ansi256ToHex", () => {
  it("converts standard black (index 0) to #000000", () => {
    expect(ansi256ToHex(0)).toBe("#000000");
  });

  it("converts standard red (index 1) to #800000", () => {
    expect(ansi256ToHex(1)).toBe("#800000");
  });

  it("converts standard white (index 15) to #ffffff", () => {
    expect(ansi256ToHex(15)).toBe("#ffffff");
  });

  it("converts color cube index 16 (0,0,0) to #000000", () => {
    expect(ansi256ToHex(16)).toBe("#000000");
  });

  it("converts color cube index 196 (5,0,0 = red) to #ff0000", () => {
    // 196 = 16 + 5*36 + 0*6 + 0 = 16 + 180 = 196
    expect(ansi256ToHex(196)).toBe("#ff0000");
  });

  it("converts color cube index 231 (5,5,5 = white) to #ffffff", () => {
    // 231 = 16 + 5*36 + 5*6 + 5 = 16 + 180 + 30 + 5 = 231
    expect(ansi256ToHex(231)).toBe("#ffffff");
  });

  it("converts color cube index 46 (0,5,0 = green) to #00ff00", () => {
    // 46 = 16 + 0*36 + 5*6 + 0 = 16 + 30 = 46
    expect(ansi256ToHex(46)).toBe("#00ff00");
  });

  it("converts grayscale index 232 to darkest gray (#080808)", () => {
    expect(ansi256ToHex(232)).toBe("#080808");
  });

  it("converts grayscale index 255 to lightest gray (#f8f8f8)", () => {
    // 255 = 232 + 23, gray = 8 + 23*10 = 238 = 0xee
    expect(ansi256ToHex(255)).toBe("#eeeeee");
  });

  it("always returns a 7-character hex string", () => {
    for (let i = 0; i < 256; i++) {
      const hex = ansi256ToHex(i);
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("paletteToHexArray", () => {
  it("converts all palette slots to hex strings", () => {
    const palette: Palette = {
      colors: [0, 16, 231, 196, 46, 231, 16, 21, 34, 124],
    };
    const result = paletteToHexArray(palette);
    expect(result).toHaveLength(10);
    expect(result.every((h) => h.startsWith("#"))).toBe(true);
  });

  it("preserves palette slot order", () => {
    const palette: Palette = { colors: [0, 16] };
    const result = paletteToHexArray(palette);
    expect(result[0]).toBe("#000000"); // transparent → black
    expect(result[1]).toBe("#000000"); // index 16 → black in cube
  });
});

describe("generatePalette → paletteToHexArray determinism", () => {
  it("produces identical hex palette for the same seed", () => {
    const traits = { builder: 50, fixer: 30, refiner: 20, scholar: 40, scribe: 10, architect: 60, operator: 25, guardian: 35 };
    const depth = { editTestLoopCount: 5, repeatEditSameFileCount: 2, phaseSwitchCount: 3, totalSessions: 10 };
    const style = { bulletRatio: 0.3, questionRatio: 0.1, codeblockRatio: 0.4, avgMessageLen: 120, messageLenStd: 40, headingRatio: 0.2 };

    // Mulberry32 PRNG from same seed
    function mulberry32(seed: number): () => number {
      let state = seed | 0;
      return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const prng1 = mulberry32(12345);
    const prng2 = mulberry32(12345);

    const palette1 = generatePalette(traits, depth, style, prng1);
    const palette2 = generatePalette(traits, depth, style, prng2);

    const hex1 = paletteToHexArray(palette1);
    const hex2 = paletteToHexArray(palette2);

    expect(hex1).toEqual(hex2);
  });
});
