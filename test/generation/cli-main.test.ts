import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import type { AppState } from "../../src/store/types.js";
import type { Customization } from "../../src/generation/templates/types.js";

// Mock store module
const mockLoadState = vi.fn<() => AppState | null>();
const mockSaveState = vi.fn();
vi.mock("../../src/store/store.js", () => ({
  loadState: () => mockLoadState(),
  saveState: (...args: unknown[]) => mockSaveState(...args),
  updatePetInState: (state: AppState, update: Partial<AppState["currentPet"]>) => ({
    ...state,
    currentPet: { ...state.currentPet, ...update },
  }),
}));

// Mock runFull
vi.mock("../../src/index.js", () => ({
  runFull: () => Promise.resolve({ state: null }),
}));

const validCustomization: Customization = {
  bodyColor: "#4a6741",
  accentColor: "#8faa7e",
  eyeColor: "#1a1a2e",
  accessoryColor: "#8b6914",
  showAccessories: [],
  animationStyle: "calm",
  expressions: {
    default: { eyes: { shape: "round" }, mouth: { shape: "flat" } },
    happy: { eyes: { shape: "happy" }, mouth: { shape: "smile" } },
    sleepy: { eyes: { shape: "sleepy" }, mouth: { shape: "flat" } },
    focused: { eyes: { shape: "sparkle" }, mouth: { shape: "flat" } },
  },
  personality: { name: "Gearsworth", quirk: "Loves fixing things" },
};

function createTestState(overrides: Partial<AppState["currentPet"]> = {}): AppState {
  return {
    version: 2,
    currentMonth: "2026-01",
    currentPet: {
      petId: "test-pet-abc",
      spawnedAt: "2026-01-15T00:00:00Z",
      requiredTokens: 10000,
      consumedTokens: 5000,
      spawnIndex: 0,
      personalitySnapshot: {
        usageMix: { impl: 40, debug: 20, refactor: 10, research: 15, docs: 5, planning: 5, ops: 3, security: 2 },
        depthMetrics: { editTestLoopCount: 5, repeatEditSameFileCount: 2, phaseSwitchCount: 3, totalSessions: 10 },
        styleMetrics: { bulletRatio: 0.3, questionRatio: 0.1, codeblockRatio: 0.4, avgMessageLen: 120, messageLenStd: 40, headingRatio: 0.2 },
        traits: { builder: 50, fixer: 30, refiner: 20, scholar: 40, scribe: 10, architect: 60, operator: 25, guardian: 35 },
      },
      generatedDesigns: null,
      ...overrides,
    },
    ingestionState: { files: {} },
    globalStats: { totalTokensAllTime: 50000, totalSessionsIngested: 10, earliestTimestamp: "2026-01-01", latestTimestamp: "2026-01-20" },
    lastEncouragementShownAt: null,
    firstRunCompleted: true,
  };
}

// Resolve the path to cli.ts (matches what fileURLToPath(import.meta.url) resolves to in the source)
const testDir = fileURLToPath(new URL(".", import.meta.url));
const cliTsPath = resolve(testDir, "../../src/generation/cli.ts");

describe("CLI main() entry point", () => {
  let originalArgv: string[];
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalArgv = [...process.argv];
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    mockLoadState.mockReset();
    mockSaveState.mockReset();
  });

  afterEach(() => {
    process.argv = originalArgv;
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("--context writes design context JSON to stdout", async () => {
    const state = createTestState();
    mockLoadState.mockReturnValue(state);

    process.argv = ["node", cliTsPath, "--context"];
    vi.resetModules();

    await import("../../src/generation/cli.js");

    // main() is async — wait for it to settle
    await new Promise((r) => setTimeout(r, 50));

    expect(stdoutSpy).toHaveBeenCalled();
    const output = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.stage).toBe(2);
    expect(parsed.petId).toBe("test-pet-abc");
  });

  it("no args prints usage and exits with code 1", async () => {
    process.argv = ["node", cliTsPath];
    vi.resetModules();

    await import("../../src/generation/cli.js");
    await new Promise((r) => setTimeout(r, 50));

    expect(stderrSpy).toHaveBeenCalledWith(
      "Usage: npx tsx src/generation/cli.ts --context | --save\n"
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("--context error triggers catch handler", async () => {
    // No personality snapshot → getDesignContext will throw
    const state = createTestState({ personalitySnapshot: null });
    mockLoadState.mockReturnValue(state);

    process.argv = ["node", cliTsPath, "--context"];
    vi.resetModules();

    await import("../../src/generation/cli.js");
    await new Promise((r) => setTimeout(r, 50));

    expect(stderrSpy).toHaveBeenCalled();
    const errOutput = stderrSpy.mock.calls[0][0] as string;
    expect(errOutput).toContain("Error:");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("--save reads stdin and saves design", async () => {
    const state = createTestState();
    mockLoadState.mockReturnValue(state);

    // Create a readable stream that emits our JSON
    const input = JSON.stringify(validCustomization);
    const mockStdin = Readable.from([Buffer.from(input)]);

    // Replace process.stdin temporarily
    const originalStdin = process.stdin;
    Object.defineProperty(process, "stdin", {
      value: mockStdin,
      writable: true,
      configurable: true,
    });

    process.argv = ["node", cliTsPath, "--save"];
    vi.resetModules();

    await import("../../src/generation/cli.js");
    await new Promise((r) => setTimeout(r, 100));

    expect(stdoutSpy).toHaveBeenCalled();
    const output = stdoutSpy.mock.calls[0][0] as string;
    expect(output).toContain("Design saved for stage");
    expect(output).toContain("Gearsworth");
    expect(mockSaveState).toHaveBeenCalledOnce();

    // Restore stdin
    Object.defineProperty(process, "stdin", {
      value: originalStdin,
      writable: true,
      configurable: true,
    });
  });
});
