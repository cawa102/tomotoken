import express from "express";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { hostname } from "node:os";
import { runFull } from "../index.js";
import { generateSeed } from "../utils/seed.js";
import { buildRenderData } from "../sidecar/render-data.js";
import { triggerGenerationIfNeeded } from "../sidecar/generation-trigger.js";
import { loadConfig } from "../config/index.js";
import { validateStartup } from "../validation/startup.js";
import { saveSnapshot, getSnapshotPath, listSnapshotPetIds } from "./snapshot.js";
import { loadCollection } from "../store/index.js";
import { buildCollectionResponse, findPetById, buildCompletedPetRenderData } from "./api-collection.js";

const POLL_INTERVAL_MS = 5_000;

async function fetchRenderData(): Promise<string> {
  const result = await runFull();
  const state = await triggerGenerationIfNeeded(result.state);
  const seed = generateSeed(hostname(), state.currentPet.petId);
  const renderData = buildRenderData(state, seed);
  return JSON.stringify(renderData);
}

export function startServer(): void {
  // Validate environment (warnings only — core app works without LLM/Blender)
  const config = loadConfig();
  const validation = validateStartup(config.llm);
  if (!validation.ok) {
    process.stderr.write("\n⚠ Optional setup incomplete:\n\n");
    for (const error of validation.errors) {
      process.stderr.write(`  [${error.component}] ${error.message}\n`);
    }
    process.stderr.write("\n  Core features will work. LLM creature generation disabled.\n\n");
  }

  const rawPort = parseInt(process.env.VIEWER_PORT ?? "3456", 10);
  if (Number.isNaN(rawPort) || rawPort < 1 || rawPort > 65535) {
    throw new Error(`Invalid VIEWER_PORT: "${process.env.VIEWER_PORT}". Must be 1-65535.`);
  }

  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const publicDir = join(process.cwd(), "src", "viewer", "public");
  if (!existsSync(join(publicDir, "index.html"))) {
    process.stderr.write(
      `\n✗ Cannot find public directory at ${publicDir}\n` +
      `  Run "npm start" from the project root directory.\n\n`,
    );
    process.exit(1);
  }

  // Security headers (defense-in-depth, even for localhost)
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });

  app.use(express.static(publicDir));

  // REST: current pet
  app.get("/api/pet", async (_req, res) => {
    try {
      const json = await fetchRenderData();
      res.setHeader("Content-Type", "application/json");
      res.send(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`/api/pet error: ${message}\n`);
      res.status(500).json({ error: "Failed to fetch pet data" });
    }
  });

  // REST: collection list
  app.get("/api/collection", (_req, res) => {
    try {
      const collection = loadCollection();
      const snapshotIds = listSnapshotPetIds();
      const response = buildCollectionResponse(collection, snapshotIds);
      res.json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`/api/collection error: ${message}\n`);
      res.status(500).json({ error: "Failed to fetch collection" });
    }
  });

  // REST: collection detail
  app.get("/api/collection/:petId", (req, res) => {
    try {
      const collection = loadCollection();
      const pet = findPetById(collection, req.params.petId);
      if (!pet) { res.status(404).json({ error: "Pet not found" }); return; }
      res.json(pet);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`/api/collection/:petId error: ${message}\n`);
      res.status(500).json({ error: "Failed to fetch pet" });
    }
  });

  // REST: collection pet render data (PetRenderData for 3D viewer)
  app.get("/api/collection/:petId/render", (req, res) => {
    try {
      const collection = loadCollection();
      const pet = findPetById(collection, req.params.petId);
      if (!pet) { res.status(404).json({ error: "Pet not found" }); return; }
      const renderData = buildCompletedPetRenderData(pet);
      res.json(renderData);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`/api/collection/:petId/render error: ${message}\n`);
      res.status(500).json({ error: "Failed to build render data" });
    }
  });

  // Clean URL for collection page
  app.get("/collection", (_req, res) => {
    res.sendFile(join(publicDir, "collection.html"));
  });

  // REST: save snapshot (PNG from client)
  app.post("/api/snapshot/:petId", express.raw({ type: "image/png", limit: "2mb" }), (req, res) => {
    try {
      saveSnapshot(req.params.petId, req.body as Buffer);
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: message });
    }
  });

  // REST: serve snapshot PNG
  app.get("/api/snapshot/:petId", (req, res) => {
    try {
      const path = getSnapshotPath(req.params.petId);
      if (!path) { res.status(404).json({ error: "Snapshot not found" }); return; }
      res.sendFile(path);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: message });
    }
  });

  // WebSocket: push updates
  const clients = new Set<WebSocket>();
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));
    fetchRenderData()
      .then((json) => { if (ws.readyState === WebSocket.OPEN) ws.send(json); })
      .catch(() => {});
  });

  let polling = false;
  setInterval(async () => {
    if (polling || clients.size === 0) return;
    polling = true;
    try {
      const json = await fetchRenderData();
      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) ws.send(json);
      }
    } catch {} finally { polling = false; }
  }, POLL_INTERVAL_MS);

  // Centralized error handler — must be last middleware
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      process.stderr.write(`Unhandled error: ${err.message}\n`);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      process.stderr.write(
        `Error: Port ${rawPort} is already in use.\n` +
          `Run: kill $(lsof -t -i :${rawPort}) to stop the existing process, then retry.\n`,
      );
      process.exit(1);
    }
    throw err;
  });

  server.listen(rawPort, "127.0.0.1", () => {
    process.stdout.write(`Tomotoken running at http://localhost:${rawPort}\n`);
  });
}
