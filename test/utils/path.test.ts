import { describe, it, expect } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import { expandHome } from "../../src/utils/path.js";

describe("expandHome", () => {
  it("expands ~ prefix to home directory", () => {
    const result = expandHome("~/Documents/file.txt");
    expect(result).toBe(join(homedir(), "Documents/file.txt"));
  });

  it("returns path unchanged when no ~ prefix", () => {
    expect(expandHome("/absolute/path")).toBe("/absolute/path");
    expect(expandHome("relative/path")).toBe("relative/path");
  });

  it("does not expand ~ in the middle of a path", () => {
    expect(expandHome("/some/~/path")).toBe("/some/~/path");
  });
});
