import { describe, it, expect, vi, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { validateStartup, type ValidationResult } from "../../src/validation/startup.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

const mockedExecSync = vi.mocked(execSync);

describe("validateStartup", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns error when API key is missing", () => {
    process.env = { ...originalEnv };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const result = validateStartup({ provider: "anthropic", model: "m" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ component: "api_key" })
    );
  });

  it("passes when API key is in config", () => {
    mockedExecSync.mockReturnValue(Buffer.from("/usr/bin/blender\n"));
    const result = validateStartup({
      provider: "anthropic",
      model: "m",
      apiKey: "sk-test",
    });
    const apiKeyErrors = result.errors.filter(
      (e) => e.component === "api_key"
    );
    expect(apiKeyErrors).toHaveLength(0);
  });

  it("returns error when Blender is not found", () => {
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: "sk-test" };
    mockedExecSync.mockImplementation(() => {
      throw new Error("not found");
    });
    const result = validateStartup({ provider: "anthropic", model: "m" });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ component: "blender" })
    );
  });

  it("passes all checks when everything configured", () => {
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: "sk-test" };
    mockedExecSync.mockReturnValue(Buffer.from("/usr/bin/blender\n"));
    const result = validateStartup({ provider: "anthropic", model: "m" });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
