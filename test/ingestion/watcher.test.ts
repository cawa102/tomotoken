import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

// Mock fs.watch
const mockClose = vi.fn();
const mockWatch = vi.fn();
vi.mock("node:fs", () => ({
  watch: (...args: unknown[]) => mockWatch(...args),
}));

import { LogWatcher } from "../../src/ingestion/watcher.js";

describe("LogWatcher", () => {
  beforeEach(() => {
    mockWatch.mockReset();
    mockClose.mockReset();
    mockWatch.mockReturnValue({ close: mockClose });
  });

  it("extends EventEmitter", () => {
    const watcher = new LogWatcher();
    expect(watcher).toBeInstanceOf(EventEmitter);
  });

  it("starts watching each directory with recursive option", () => {
    const watcher = new LogWatcher();
    watcher.start(["/dir/a", "/dir/b"]);

    expect(mockWatch).toHaveBeenCalledTimes(2);
    expect(mockWatch).toHaveBeenCalledWith(
      "/dir/a",
      { recursive: true },
      expect.any(Function),
    );
    expect(mockWatch).toHaveBeenCalledWith(
      "/dir/b",
      { recursive: true },
      expect.any(Function),
    );
  });

  it("emits 'change' when a .jsonl file changes", () => {
    const watcher = new LogWatcher();
    const handler = vi.fn();
    watcher.on("change", handler);

    mockWatch.mockImplementation((_dir: string, _opts: unknown, cb: Function) => {
      cb("change", "session.jsonl");
      return { close: mockClose };
    });

    watcher.start(["/dir/a"]);

    expect(handler).toHaveBeenCalledWith({
      eventType: "change",
      filename: "session.jsonl",
      dir: "/dir/a",
    });
  });

  it("ignores non-.jsonl files", () => {
    const watcher = new LogWatcher();
    const handler = vi.fn();
    watcher.on("change", handler);

    mockWatch.mockImplementation((_dir: string, _opts: unknown, cb: Function) => {
      cb("change", "readme.md");
      return { close: mockClose };
    });

    watcher.start(["/dir/a"]);

    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores events with null filename", () => {
    const watcher = new LogWatcher();
    const handler = vi.fn();
    watcher.on("change", handler);

    mockWatch.mockImplementation((_dir: string, _opts: unknown, cb: Function) => {
      cb("rename", null);
      return { close: mockClose };
    });

    watcher.start(["/dir/a"]);

    expect(handler).not.toHaveBeenCalled();
  });

  it("handles non-existent directories gracefully", () => {
    mockWatch.mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    const watcher = new LogWatcher();
    // Should not throw
    expect(() => watcher.start(["/nonexistent"])).not.toThrow();
  });

  it("closes all watchers on stop()", () => {
    const watcher = new LogWatcher();
    watcher.start(["/dir/a", "/dir/b"]);

    watcher.stop();

    expect(mockClose).toHaveBeenCalledTimes(2);
  });

  it("clears watchers list on stop() so subsequent stop is a no-op", () => {
    const watcher = new LogWatcher();
    watcher.start(["/dir/a"]);

    watcher.stop();
    watcher.stop();

    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
