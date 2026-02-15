import { describe, it, expect } from "vitest";
import { buildSpawnArgs } from "../../src/window/spawn.js";
import type { TerminalInfo } from "../../src/window/detect.js";

describe("buildSpawnArgs", () => {
  const binPath = "/usr/local/bin/tomotoken";

  it("macOS Terminal.app uses osascript", () => {
    const info: TerminalInfo = { platform: "darwin", terminalApp: null };
    const result = buildSpawnArgs(info, binPath, []);
    expect(result.command).toBe("osascript");
    expect(result.args[0]).toBe("-e");
    expect(result.args[1]).toContain("Terminal");
    expect(result.args[1]).toContain(binPath);
    expect(result.args[1]).toContain("watch");
  });

  it("macOS iTerm2 uses osascript with iTerm2", () => {
    const info: TerminalInfo = { platform: "darwin", terminalApp: "iTerm.app" };
    const result = buildSpawnArgs(info, binPath, []);
    expect(result.command).toBe("osascript");
    expect(result.args[1]).toContain("iTerm");
  });

  it("linux gnome-terminal uses -- separator", () => {
    const info: TerminalInfo = { platform: "linux", terminalApp: "gnome-terminal" };
    const result = buildSpawnArgs(info, binPath, []);
    expect(result.command).toBe("gnome-terminal");
    expect(result.args).toContain("--");
    expect(result.args).toContain(binPath);
  });

  it("linux xterm uses -e flag", () => {
    const info: TerminalInfo = { platform: "linux", terminalApp: "xterm" };
    const result = buildSpawnArgs(info, binPath, []);
    expect(result.command).toBe("xterm");
    expect(result.args[0]).toBe("-e");
  });

  it("wsl uses cmd.exe to start wt.exe", () => {
    const info: TerminalInfo = { platform: "wsl", terminalApp: "cmd.exe" };
    const result = buildSpawnArgs(info, binPath, []);
    expect(result.command).toBe("cmd.exe");
    expect(result.args).toContain("/c");
  });

  it("passes extra args through", () => {
    const info: TerminalInfo = { platform: "linux", terminalApp: "xterm" };
    const result = buildSpawnArgs(info, binPath, ["--no-animate"]);
    expect(result.args.join(" ")).toContain("--no-animate");
  });

  it("throws for unsupported platform", () => {
    const info: TerminalInfo = { platform: "unsupported", terminalApp: null };
    expect(() => buildSpawnArgs(info, binPath, [])).toThrow();
  });
});
