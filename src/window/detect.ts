import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export type Platform = "darwin" | "linux" | "wsl" | "unsupported";

export interface TerminalInfo {
  readonly platform: Platform;
  readonly terminalApp: string | null;
}

function isWsl(): boolean {
  try {
    const version = readFileSync("/proc/version", "utf-8");
    return /microsoft/i.test(version);
  } catch {
    return false;
  }
}

export function detectPlatform(): Platform {
  if (process.platform === "darwin") return "darwin";
  if (process.platform === "linux") return isWsl() ? "wsl" : "linux";
  return "unsupported";
}

function findLinuxTerminal(): string | null {
  const candidates = [
    "gnome-terminal",
    "xfce4-terminal",
    "konsole",
    "xterm",
    "x-terminal-emulator",
  ];
  for (const cmd of candidates) {
    try {
      execFileSync("which", [cmd], { stdio: "pipe" });
      return cmd;
    } catch {
      // not found, try next
    }
  }
  return null;
}

export function detectTerminal(): TerminalInfo {
  const platform = detectPlatform();

  if (platform === "darwin") {
    return {
      platform,
      terminalApp: process.env.TERM_PROGRAM ?? null,
    };
  }

  if (platform === "linux") {
    return { platform, terminalApp: findLinuxTerminal() };
  }

  if (platform === "wsl") {
    return { platform, terminalApp: "cmd.exe" };
  }

  return { platform, terminalApp: null };
}
