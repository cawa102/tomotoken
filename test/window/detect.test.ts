import { describe, it, expect, afterEach } from "vitest";
import { detectPlatform, detectTerminal } from "../../src/window/detect.js";

describe("detectPlatform", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("returns darwin on macOS", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    expect(detectPlatform()).toBe("darwin");
  });

  it("returns unsupported on windows", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    expect(detectPlatform()).toBe("unsupported");
  });
});

describe("detectTerminal", () => {
  const originalPlatform = process.platform;
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    process.env = { ...originalEnv };
  });

  it("detects iTerm2 on macOS via TERM_PROGRAM", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    process.env.TERM_PROGRAM = "iTerm.app";
    const info = detectTerminal();
    expect(info.platform).toBe("darwin");
    expect(info.terminalApp).toBe("iTerm.app");
  });

  it("returns null terminalApp when TERM_PROGRAM not set on macOS", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    delete process.env.TERM_PROGRAM;
    const info = detectTerminal();
    expect(info.platform).toBe("darwin");
    expect(info.terminalApp).toBeNull();
  });
});
