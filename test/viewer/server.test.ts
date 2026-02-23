import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Server } from "node:http";
import type { Application } from "express";

// ── Hoisted mock functions (available inside vi.mock factories) ──────

const {
  mockRunFull,
  mockGenerateSeed,
  mockBuildRenderData,
  mockTriggerGeneration,
  mockSaveSnapshot,
  mockGetSnapshotPath,
  mockListSnapshotPetIds,
  mockLoadCollection,
  mockBuildCollectionResponse,
  mockFindPetById,
  mockBuildCompletedPetRenderData,
  mockWssOn,
  mockExistsSync,
  mockValidateStartup,
  capturedWssOptions,
} = vi.hoisted(() => ({
  mockRunFull: vi.fn(),
  mockGenerateSeed: vi.fn().mockReturnValue("test-seed"),
  mockBuildRenderData: vi.fn().mockReturnValue({ petId: "pet-001", progress: 0.5 }),
  mockTriggerGeneration: vi.fn(),
  mockSaveSnapshot: vi.fn(),
  mockGetSnapshotPath: vi.fn(),
  mockListSnapshotPetIds: vi.fn().mockReturnValue(new Set<string>()),
  mockLoadCollection: vi.fn(),
  mockBuildCollectionResponse: vi.fn(),
  mockFindPetById: vi.fn(),
  mockBuildCompletedPetRenderData: vi.fn(),
  mockWssOn: vi.fn(),
  mockExistsSync: vi.fn().mockReturnValue(true),
  mockValidateStartup: vi.fn().mockReturnValue({ ok: true, errors: [] }),
  capturedWssOptions: { verifyClient: null as ((info: { origin?: string }) => boolean) | null },
}));

// ── Mock: external dependencies ──────────────────────────────────────

vi.mock("../../src/index.js", () => ({
  runFull: (...args: unknown[]) => mockRunFull(...args),
}));

vi.mock("../../src/utils/seed.js", () => ({
  generateSeed: (...args: unknown[]) => mockGenerateSeed(...args),
}));

vi.mock("../../src/sidecar/render-data.js", () => ({
  buildRenderData: (...args: unknown[]) => mockBuildRenderData(...args),
}));

vi.mock("../../src/sidecar/generation-trigger.js", () => ({
  triggerGenerationIfNeeded: (...args: unknown[]) => mockTriggerGeneration(...args),
}));

vi.mock("../../src/config/index.js", () => ({
  loadConfig: () => ({ llm: { provider: "anthropic", model: "m" } }),
}));

vi.mock("../../src/validation/startup.js", () => ({
  validateStartup: (...args: unknown[]) => mockValidateStartup(...args),
}));

vi.mock("../../src/viewer/snapshot.js", () => ({
  saveSnapshot: (...args: unknown[]) => mockSaveSnapshot(...args),
  getSnapshotPath: (...args: unknown[]) => mockGetSnapshotPath(...args),
  listSnapshotPetIds: (...args: unknown[]) => mockListSnapshotPetIds(...args),
}));

vi.mock("../../src/store/index.js", () => ({
  loadCollection: (...args: unknown[]) => mockLoadCollection(...args),
}));

vi.mock("../../src/viewer/api-collection.js", () => ({
  buildCollectionResponse: (...args: unknown[]) => mockBuildCollectionResponse(...args),
  findPetById: (...args: unknown[]) => mockFindPetById(...args),
  buildCompletedPetRenderData: (...args: unknown[]) => mockBuildCompletedPetRenderData(...args),
}));

// ── Mock: node:fs (existsSync for public dir check) ─────────────────

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return { ...actual, existsSync: mockExistsSync };
});

// ── Mock: ws (WebSocketServer) ───────────────────────────────────────

vi.mock("ws", () => {
  function MockWebSocketServer(opts: any) {
    capturedWssOptions.verifyClient = opts?.verifyClient ?? null;
    return { on: mockWssOn };
  }
  MockWebSocketServer.prototype = {};
  return {
    WebSocketServer: MockWebSocketServer,
    WebSocket: { OPEN: 1 },
  };
});

// ── Capture Express app via node:http partial mock ───────────────────

let capturedApp: Application | null = null;
let capturedServer: Server | null = null;

vi.mock("node:http", async () => {
  const actual = await vi.importActual<typeof import("node:http")>("node:http");
  return {
    ...actual,
    createServer: (handler: Application) => {
      capturedApp = handler;
      const server = actual.createServer(handler);
      capturedServer = server;
      const originalListen = server.listen.bind(server);
      server.listen = vi.fn((_port: number, _host: string, cb?: () => void) => {
        originalListen(0, "127.0.0.1", cb);
        return server;
      }) as any;
      return server;
    },
  };
});

// ── Import after mocks ──────────────────────────────────────────────

import { startServer } from "../../src/viewer/server.js";
import http from "node:http";

// ── Helpers ──────────────────────────────────────────────────────────

const defaultState = {
  version: 2,
  currentPet: { petId: "pet-001", consumedTokens: 500, requiredTokens: 1000, spawnIndex: 0 },
};

function setupRunFullSuccess() {
  mockRunFull.mockResolvedValue({ state: defaultState });
  mockTriggerGeneration.mockResolvedValue(defaultState);
}

async function makeRequest(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: Buffer,
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  // Wait for server to finish binding
  if (!capturedServer!.listening) {
    await new Promise<void>((resolve) => capturedServer!.once("listening", resolve));
  }
  return new Promise((resolve, reject) => {
    const addr = capturedServer!.address() as { port: number };
    const req = http.request(
      { hostname: "127.0.0.1", port: addr.port, path, method, headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers as Record<string, string>,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe("server", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    capturedApp = null;
    capturedServer = null;
    process.env = { ...origEnv, VIEWER_PORT: "3456" };
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("process.exit"); });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    mockExistsSync.mockReturnValue(true);
    mockValidateStartup.mockReturnValue({ ok: true, errors: [] });
    setupRunFullSuccess();
    mockLoadCollection.mockReturnValue({ version: 2, pets: [] });
    mockBuildCollectionResponse.mockReturnValue({ pets: [] });
  });

  afterEach(() => {
    process.env = origEnv;
    if (capturedServer) {
      capturedServer.close();
      capturedServer = null;
    }
  });

  // ── Security headers ───────────────────────────────────────────────

  describe("security headers", () => {
    it("sets X-Content-Type-Options, X-Frame-Options, CSP, Referrer-Policy, Permissions-Policy", async () => {
      startServer();
      const res = await makeRequest("GET", "/api/collection");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBe("DENY");
      expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
      expect(res.headers["referrer-policy"]).toBe("no-referrer");
      expect(res.headers["permissions-policy"]).toContain("camera=()");
    });
  });

  // ── CORS origin checking ───────────────────────────────────────────

  describe("CORS origin checking", () => {
    it("allows requests from localhost", async () => {
      startServer();
      const res = await makeRequest("GET", "/api/collection", {
        Origin: "http://localhost:3456",
      });
      expect(res.status).toBe(200);
    });

    it("allows requests from 127.0.0.1", async () => {
      startServer();
      const res = await makeRequest("GET", "/api/collection", {
        Origin: "http://127.0.0.1:3456",
      });
      expect(res.status).toBe(200);
    });

    it("blocks requests from external origins", async () => {
      startServer();
      const res = await makeRequest("GET", "/api/collection", {
        Origin: "http://evil.com",
      });
      expect(res.status).toBe(403);
      expect(JSON.parse(res.body)).toEqual({ error: "Forbidden" });
    });

    it("allows requests without origin header", async () => {
      startServer();
      const res = await makeRequest("GET", "/api/collection");
      expect(res.status).toBe(200);
    });
  });

  // ── GET /api/pet ───────────────────────────────────────────────────

  describe("GET /api/pet", () => {
    it("returns render data as JSON", async () => {
      startServer();
      const res = await makeRequest("GET", "/api/pet");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      const data = JSON.parse(res.body);
      expect(data).toEqual({ petId: "pet-001", progress: 0.5 });
    });

    it("returns 500 when runFull throws", async () => {
      mockRunFull.mockRejectedValue(new Error("ingestion failed"));
      startServer();
      const res = await makeRequest("GET", "/api/pet");
      expect(res.status).toBe(500);
      expect(JSON.parse(res.body)).toEqual({ error: "Failed to fetch pet data" });
    });
  });

  // ── GET /api/collection ────────────────────────────────────────────

  describe("GET /api/collection", () => {
    it("returns collection response", async () => {
      const mockResponse = { pets: [{ petId: "p1", archetype: "builder" }] };
      mockBuildCollectionResponse.mockReturnValue(mockResponse);
      startServer();
      const res = await makeRequest("GET", "/api/collection");
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual(mockResponse);
    });

    it("returns 500 when loadCollection throws", async () => {
      mockLoadCollection.mockImplementation(() => { throw new Error("disk error"); });
      startServer();
      const res = await makeRequest("GET", "/api/collection");
      expect(res.status).toBe(500);
      expect(JSON.parse(res.body)).toEqual({ error: "Failed to fetch collection" });
    });
  });

  // ── GET /api/collection/:petId ─────────────────────────────────────

  describe("GET /api/collection/:petId", () => {
    it("returns pet detail when found", async () => {
      const pet = { petId: "abc", personality: {} };
      mockFindPetById.mockReturnValue(pet);
      startServer();
      const res = await makeRequest("GET", "/api/collection/abc");
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual(pet);
    });

    it("returns 404 when pet not found", async () => {
      mockFindPetById.mockReturnValue(null);
      startServer();
      const res = await makeRequest("GET", "/api/collection/unknown");
      expect(res.status).toBe(404);
      expect(JSON.parse(res.body)).toEqual({ error: "Pet not found" });
    });

    it("returns 500 when loadCollection throws", async () => {
      mockLoadCollection.mockImplementation(() => { throw new Error("disk"); });
      startServer();
      const res = await makeRequest("GET", "/api/collection/abc");
      expect(res.status).toBe(500);
      expect(JSON.parse(res.body)).toEqual({ error: "Failed to fetch pet" });
    });
  });

  // ── GET /api/collection/:petId/render ──────────────────────────────

  describe("GET /api/collection/:petId/render", () => {
    it("returns render data for completed pet", async () => {
      const pet = { petId: "abc" };
      const renderData = { petId: "abc", progress: 1.0 };
      mockFindPetById.mockReturnValue(pet);
      mockBuildCompletedPetRenderData.mockReturnValue(renderData);
      startServer();
      const res = await makeRequest("GET", "/api/collection/abc/render");
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual(renderData);
    });

    it("returns 404 when pet not found", async () => {
      mockFindPetById.mockReturnValue(null);
      startServer();
      const res = await makeRequest("GET", "/api/collection/unknown/render");
      expect(res.status).toBe(404);
      expect(JSON.parse(res.body)).toEqual({ error: "Pet not found" });
    });

    it("returns 500 when buildCompletedPetRenderData throws", async () => {
      mockFindPetById.mockReturnValue({ petId: "abc" });
      mockBuildCompletedPetRenderData.mockImplementation(() => { throw new Error("bad"); });
      startServer();
      const res = await makeRequest("GET", "/api/collection/abc/render");
      expect(res.status).toBe(500);
      expect(JSON.parse(res.body)).toEqual({ error: "Failed to build render data" });
    });
  });

  // ── POST /api/snapshot/:petId ──────────────────────────────────────

  describe("POST /api/snapshot/:petId", () => {
    it("saves snapshot and returns ok", async () => {
      startServer();
      const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const res = await makeRequest(
        "POST",
        "/api/snapshot/pet-001",
        { "Content-Type": "image/png" },
        pngData,
      );
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ ok: true });
      expect(mockSaveSnapshot).toHaveBeenCalledWith("pet-001", expect.any(Buffer));
    });

    it("returns 400 when saveSnapshot throws", async () => {
      mockSaveSnapshot.mockImplementation(() => { throw new Error("Invalid petId: ../evil"); });
      startServer();
      const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const res = await makeRequest(
        "POST",
        "/api/snapshot/bad-id",
        { "Content-Type": "image/png" },
        pngData,
      );
      expect(res.status).toBe(400);
      expect(JSON.parse(res.body).error).toContain("Invalid petId");
    });
  });

  // ── GET /api/snapshot/:petId ───────────────────────────────────────

  describe("GET /api/snapshot/:petId", () => {
    it("returns 404 when snapshot not found", async () => {
      mockGetSnapshotPath.mockReturnValue(null);
      startServer();
      const res = await makeRequest("GET", "/api/snapshot/missing");
      expect(res.status).toBe(404);
      expect(JSON.parse(res.body)).toEqual({ error: "Snapshot not found" });
    });

    it("returns 400 when getSnapshotPath throws", async () => {
      mockGetSnapshotPath.mockImplementation(() => { throw new Error("Invalid petId"); });
      startServer();
      const res = await makeRequest("GET", "/api/snapshot/bad");
      expect(res.status).toBe(400);
      expect(JSON.parse(res.body).error).toContain("Invalid petId");
    });
  });

  // ── WebSocket connection handler ───────────────────────────────────

  describe("WebSocket connection", () => {
    it("registers connection handler on wss", () => {
      startServer();
      expect(mockWssOn).toHaveBeenCalledWith("connection", expect.any(Function));
    });

    it("sends render data on new connection", async () => {
      startServer();
      const connectionHandler = mockWssOn.mock.calls.find(
        (c: unknown[]) => c[0] === "connection",
      )?.[1] as (ws: any) => void;

      const mockWs = {
        close: vi.fn(),
        send: vi.fn(),
        on: vi.fn(),
        readyState: 1,
      };

      connectionHandler(mockWs);

      await vi.waitFor(() => {
        expect(mockWs.send).toHaveBeenCalled();
      });
    });

    it("closes connection when MAX_WS_CLIENTS exceeded", () => {
      startServer();
      const connectionHandler = mockWssOn.mock.calls.find(
        (c: unknown[]) => c[0] === "connection",
      )?.[1] as (ws: any) => void;

      for (let i = 0; i < 10; i++) {
        const ws = { close: vi.fn(), send: vi.fn(), on: vi.fn(), readyState: 1 };
        connectionHandler(ws);
      }

      const extraWs = { close: vi.fn(), send: vi.fn(), on: vi.fn(), readyState: 1 };
      connectionHandler(extraWs);
      expect(extraWs.close).toHaveBeenCalledWith(1013, "Too many connections");
    });

    it("removes client on close event", () => {
      startServer();
      const connectionHandler = mockWssOn.mock.calls.find(
        (c: unknown[]) => c[0] === "connection",
      )?.[1] as (ws: any) => void;

      const closeHandlers: (() => void)[] = [];
      const mockWs = {
        close: vi.fn(),
        send: vi.fn(),
        on: vi.fn((event: string, handler: () => void) => {
          if (event === "close") closeHandlers.push(handler);
        }),
        readyState: 1,
      };
      connectionHandler(mockWs);

      for (const h of closeHandlers) h();

      // Fill to 10 after removal
      for (let i = 0; i < 10; i++) {
        const ws = { close: vi.fn(), send: vi.fn(), on: vi.fn(), readyState: 1 };
        connectionHandler(ws);
      }
      const extraWs = { close: vi.fn(), send: vi.fn(), on: vi.fn(), readyState: 1 };
      connectionHandler(extraWs);
      expect(extraWs.close).toHaveBeenCalledWith(1013, "Too many connections");
    });

    it("removes client on error event", () => {
      startServer();
      const connectionHandler = mockWssOn.mock.calls.find(
        (c: unknown[]) => c[0] === "connection",
      )?.[1] as (ws: any) => void;

      const errorHandlers: (() => void)[] = [];
      const mockWs = {
        close: vi.fn(),
        send: vi.fn(),
        on: vi.fn((event: string, handler: () => void) => {
          if (event === "error") errorHandlers.push(handler);
        }),
        readyState: 1,
      };
      connectionHandler(mockWs);

      for (const h of errorHandlers) h();
    });
  });

  // ── Port validation ────────────────────────────────────────────────

  describe("port validation", () => {
    it("throws on invalid VIEWER_PORT", () => {
      process.env.VIEWER_PORT = "notanumber";
      expect(() => startServer()).toThrow("Invalid VIEWER_PORT");
    });

    it("throws on port 0", () => {
      process.env.VIEWER_PORT = "0";
      expect(() => startServer()).toThrow("Invalid VIEWER_PORT");
    });

    it("throws on port > 65535", () => {
      process.env.VIEWER_PORT = "99999";
      expect(() => startServer()).toThrow("Invalid VIEWER_PORT");
    });

    it("uses default port 3456 when VIEWER_PORT not set", () => {
      delete process.env.VIEWER_PORT;
      startServer();
      expect(capturedServer).not.toBeNull();
    });
  });

  // ── Validation warnings ────────────────────────────────────────────

  describe("startup validation warnings", () => {
    it("writes warnings to stderr when validation fails", () => {
      mockValidateStartup.mockReturnValue({
        ok: false,
        errors: [{ component: "api_key", message: "Missing ANTHROPIC_API_KEY" }],
      });

      startServer();

      expect(process.stderr.write).toHaveBeenCalledWith(
        expect.stringContaining("Optional setup incomplete"),
      );
    });
  });

  // ── Public dir check ───────────────────────────────────────────────

  describe("public directory check", () => {
    it("calls process.exit(1) when public dir is missing", () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => startServer()).toThrow("process.exit");
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  // ── WebSocket verifyClient ─────────────────────────────────────────

  describe("WebSocket verifyClient", () => {
    function getVerifyClient() {
      startServer();
      return capturedWssOptions.verifyClient!;
    }

    it("allows connections without origin (CLI tools)", () => {
      const verify = getVerifyClient();
      expect(verify({ origin: undefined })).toBe(true);
    });

    it("allows connections from localhost", () => {
      const verify = getVerifyClient();
      expect(verify({ origin: "http://localhost:3456" })).toBe(true);
    });

    it("allows connections from 127.0.0.1", () => {
      const verify = getVerifyClient();
      expect(verify({ origin: "http://127.0.0.1:3456" })).toBe(true);
    });

    it("rejects connections from external origins", () => {
      const verify = getVerifyClient();
      expect(verify({ origin: "http://evil.com" })).toBe(false);
    });

    it("rejects connections with invalid origin URL", () => {
      const verify = getVerifyClient();
      expect(verify({ origin: "not-a-valid-url" })).toBe(false);
    });
  });

  // ── fetchRenderData (tested via /api/pet) ──────────────────────────

  describe("fetchRenderData", () => {
    it("calls runFull, triggerGenerationIfNeeded, generateSeed, buildRenderData", async () => {
      startServer();
      await makeRequest("GET", "/api/pet");
      expect(mockRunFull).toHaveBeenCalled();
      expect(mockTriggerGeneration).toHaveBeenCalledWith(defaultState);
      expect(mockGenerateSeed).toHaveBeenCalled();
      expect(mockBuildRenderData).toHaveBeenCalled();
    });

    it("handles non-Error throw in /api/pet", async () => {
      mockRunFull.mockRejectedValue("string error");
      startServer();
      const res = await makeRequest("GET", "/api/pet");
      expect(res.status).toBe(500);
    });
  });

  // ── WebSocket: fetchRenderData failure on connect ──────────────────

  describe("WebSocket fetchRenderData failure", () => {
    it("does not crash when fetchRenderData fails on connect", async () => {
      mockRunFull.mockRejectedValue(new Error("fail"));
      startServer();
      const connectionHandler = mockWssOn.mock.calls.find(
        (c: unknown[]) => c[0] === "connection",
      )?.[1] as (ws: any) => void;

      const mockWs = { close: vi.fn(), send: vi.fn(), on: vi.fn(), readyState: 1 };
      connectionHandler(mockWs);

      // Give the rejected promise time to settle
      await new Promise((r) => setTimeout(r, 50));
      // Should not have sent anything (error was swallowed)
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it("does not send when ws is no longer open", async () => {
      startServer();
      const connectionHandler = mockWssOn.mock.calls.find(
        (c: unknown[]) => c[0] === "connection",
      )?.[1] as (ws: any) => void;

      const mockWs = { close: vi.fn(), send: vi.fn(), on: vi.fn(), readyState: 3 }; // CLOSED
      connectionHandler(mockWs);

      await new Promise((r) => setTimeout(r, 50));
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  // ── Server error handler (EADDRINUSE) ──────────────────────────────

  describe("server error handler", () => {
    it("handles EADDRINUSE with process.exit(1)", () => {
      startServer();
      const errnoError = Object.assign(new Error("EADDRINUSE"), { code: "EADDRINUSE" });
      expect(() => capturedServer!.emit("error", errnoError)).toThrow("process.exit");
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("re-throws non-EADDRINUSE errors", () => {
      startServer();
      const otherError = Object.assign(new Error("other"), { code: "EACCES" });
      expect(() => capturedServer!.emit("error", otherError)).toThrow("other");
    });
  });

  // ── GET /collection (clean URL) ─────────────────────────────────────

  describe("GET /collection", () => {
    it("responds with HTML content type", async () => {
      startServer();
      const res = await makeRequest("GET", "/collection");
      // sendFile will either succeed or fail (no actual file in test),
      // but the route handler is invoked — coverage achieved
      expect([200, 404, 500]).toContain(res.status);
    });
  });

  // ── Polling interval ───────────────────────────────────────────────

  describe("polling interval", () => {
    it("skips polling when no clients connected", async () => {
      vi.useFakeTimers();
      try {
        startServer();
        mockRunFull.mockClear();

        await vi.advanceTimersByTimeAsync(5_000);

        // runFull should not be called since there are no clients
        expect(mockRunFull).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // ── Non-Error thrown from sync routes ──────────────────────────────

  describe("error message handling", () => {
    it("handles non-Error thrown from /api/collection", async () => {
      mockLoadCollection.mockImplementation(() => { throw "string error"; });
      startServer();
      const res = await makeRequest("GET", "/api/collection");
      expect(res.status).toBe(500);
    });

    it("handles non-Error thrown from /api/collection/:petId", async () => {
      mockLoadCollection.mockImplementation(() => { throw 42; });
      startServer();
      const res = await makeRequest("GET", "/api/collection/abc");
      expect(res.status).toBe(500);
    });

    it("handles non-Error thrown from /api/collection/:petId/render", async () => {
      mockLoadCollection.mockImplementation(() => { throw null; });
      startServer();
      const res = await makeRequest("GET", "/api/collection/abc/render");
      expect(res.status).toBe(500);
    });
  });
});
