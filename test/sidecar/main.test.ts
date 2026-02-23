import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies before import
const mockRunFull = vi.fn();
vi.mock("../../src/index.js", () => ({
  runFull: (...args: unknown[]) => mockRunFull(...args),
}));

const mockGenerateSeed = vi.fn().mockReturnValue("test-seed-abc");
vi.mock("../../src/utils/seed.js", () => ({
  generateSeed: (...args: unknown[]) => mockGenerateSeed(...args),
}));

const mockBuildRenderData = vi.fn().mockReturnValue({ petId: "pet-1", progress: 0.5 });
vi.mock("../../src/sidecar/render-data.js", () => ({
  buildRenderData: (...args: unknown[]) => mockBuildRenderData(...args),
}));

const mockHostname = vi.fn().mockReturnValue("test-host");
vi.mock("node:os", () => ({
  hostname: () => mockHostname(),
}));

describe("sidecar/main", () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let stderrWrite: ReturnType<typeof vi.spyOn>;
  let processExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockRunFull.mockReset();
    mockGenerateSeed.mockReset().mockReturnValue("test-seed-abc");
    mockBuildRenderData.mockReset().mockReturnValue({ petId: "pet-1", progress: 0.5 });
    mockHostname.mockReset().mockReturnValue("test-host");

    stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    processExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  it("runs full pipeline and writes JSON to stdout on success", async () => {
    const mockState = {
      currentPet: { petId: "pet-1" },
    };
    mockRunFull.mockResolvedValue({ state: mockState });

    // Dynamic import triggers main()
    await import("../../src/sidecar/main.js");

    // Wait for async main() to settle
    await vi.waitFor(() => {
      expect(stdoutWrite).toHaveBeenCalled();
    });

    expect(mockRunFull).toHaveBeenCalled();
    expect(mockGenerateSeed).toHaveBeenCalledWith("test-host", "pet-1");
    expect(mockBuildRenderData).toHaveBeenCalledWith(mockState, "test-seed-abc");

    const output = stdoutWrite.mock.calls[0][0] as string;
    expect(JSON.parse(output.trim())).toEqual({ petId: "pet-1", progress: 0.5 });
  });

  it("writes error to stderr and exits with code 1 on Error", async () => {
    mockRunFull.mockRejectedValue(new Error("pipeline failed"));

    // Re-import to trigger main() again
    vi.resetModules();

    // Re-setup mocks after resetModules
    vi.doMock("../../src/index.js", () => ({
      runFull: () => mockRunFull(),
    }));
    vi.doMock("../../src/utils/seed.js", () => ({
      generateSeed: (...args: unknown[]) => mockGenerateSeed(...args),
    }));
    vi.doMock("../../src/sidecar/render-data.js", () => ({
      buildRenderData: (...args: unknown[]) => mockBuildRenderData(...args),
    }));
    vi.doMock("node:os", () => ({
      hostname: () => mockHostname(),
    }));

    await import("../../src/sidecar/main.js");

    await vi.waitFor(() => {
      expect(stderrWrite).toHaveBeenCalled();
    });

    expect(stderrWrite).toHaveBeenCalledWith("sidecar error: pipeline failed\n");
    expect(processExit).toHaveBeenCalledWith(1);
  });

  it("handles non-Error thrown values", async () => {
    mockRunFull.mockRejectedValue("string error");

    vi.resetModules();

    vi.doMock("../../src/index.js", () => ({
      runFull: () => mockRunFull(),
    }));
    vi.doMock("../../src/utils/seed.js", () => ({
      generateSeed: (...args: unknown[]) => mockGenerateSeed(...args),
    }));
    vi.doMock("../../src/sidecar/render-data.js", () => ({
      buildRenderData: (...args: unknown[]) => mockBuildRenderData(...args),
    }));
    vi.doMock("node:os", () => ({
      hostname: () => mockHostname(),
    }));

    await import("../../src/sidecar/main.js");

    await vi.waitFor(() => {
      expect(stderrWrite).toHaveBeenCalled();
    });

    expect(stderrWrite).toHaveBeenCalledWith("sidecar error: string error\n");
    expect(processExit).toHaveBeenCalledWith(1);
  });
});
