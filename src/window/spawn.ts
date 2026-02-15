import { spawn } from "node:child_process";
import { detectTerminal } from "./detect.js";
import type { TerminalInfo } from "./detect.js";

export interface SpawnResult {
  readonly success: boolean;
  readonly error?: string;
  readonly terminalUsed: string;
}

interface SpawnArgs {
  readonly command: string;
  readonly args: readonly string[];
}

const GNOME_LIKE = new Set(["gnome-terminal", "xfce4-terminal"]);
const XTERM_LIKE = new Set(["xterm", "x-terminal-emulator", "konsole"]);

function escapeAppleScript(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function buildSpawnArgs(
  info: TerminalInfo,
  binPath: string,
  extraArgs: readonly string[],
): SpawnArgs {
  const watchCmd = [binPath, "watch", ...extraArgs];
  const fullCmd = watchCmd.join(" ");

  if (info.platform === "darwin") {
    const escaped = escapeAppleScript(fullCmd);
    if (info.terminalApp === "iTerm.app") {
      return {
        command: "osascript",
        args: [
          "-e",
          `tell application "iTerm2" to create window with default profile command "${escaped}"`,
        ],
      };
    }
    return {
      command: "osascript",
      args: ["-e", `tell application "Terminal" to do script "${escaped}"`],
    };
  }

  if (info.platform === "linux") {
    const term = info.terminalApp;
    if (term && GNOME_LIKE.has(term)) {
      return { command: term, args: ["--", ...watchCmd] };
    }
    if (term && XTERM_LIKE.has(term)) {
      return { command: term, args: ["-e", ...watchCmd] };
    }
    if (term) {
      return { command: term, args: ["-e", ...watchCmd] };
    }
    throw new Error(
      "No supported terminal emulator found. Install gnome-terminal, xterm, or similar.",
    );
  }

  if (info.platform === "wsl") {
    return {
      command: "cmd.exe",
      args: ["/c", "start", "wt.exe", "wsl", "--", ...watchCmd],
    };
  }

  throw new Error(
    `Unsupported platform: ${info.platform}. Run "tomotoken watch" manually.`,
  );
}

export function spawnWindow(
  binPath: string,
  extraArgs: readonly string[] = [],
): SpawnResult {
  const info = detectTerminal();
  const terminalUsed = info.terminalApp ?? info.platform;

  try {
    const { command, args } = buildSpawnArgs(info, binPath, extraArgs);
    const child = spawn(command, [...args], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return { success: true, terminalUsed };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      terminalUsed,
    };
  }
}
