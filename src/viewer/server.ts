import express from "express";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { hostname } from "node:os";
import { runFull } from "../index.js";
import { generateSeed } from "../art/seed.js";
import { buildRenderData } from "../sidecar/render-data.js";
import { triggerGenerationIfNeeded } from "../sidecar/generation-trigger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rawPort = parseInt(process.env.VIEWER_PORT ?? "3456", 10);
if (Number.isNaN(rawPort) || rawPort < 1 || rawPort > 65535) {
  throw new Error(`Invalid VIEWER_PORT: "${process.env.VIEWER_PORT}". Must be 1-65535.`);
}
const PORT = rawPort;
const POLL_INTERVAL_MS = 5_000;

async function fetchRenderData(): Promise<string> {
  const result = await runFull();
  const state = await triggerGenerationIfNeeded(result.state);
  const seed = generateSeed(hostname(), state.currentPet.petId);
  const renderData = buildRenderData(state, seed);
  return JSON.stringify(renderData);
}

function startServer(): void {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // Serve static files from viewer/public/
  // In dev: src/viewer/public/  In dist: resolve from cwd
  const publicDir = join(process.cwd(), "src", "viewer", "public");
  app.use(express.static(publicDir));

  // REST endpoint for one-shot fetch
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

  // WebSocket: push updates to all connected clients
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));

    // Send initial data immediately
    fetchRenderData()
      .then((json) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(json);
      })
      .catch(() => { /* ignore — client will get next poll */ });
  });

  // Periodic polling
  let polling = false;
  setInterval(async () => {
    if (polling || clients.size === 0) return;
    polling = true;
    try {
      const json = await fetchRenderData();
      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) ws.send(json);
      }
    } catch (_err) {
      // Silently continue — next poll will retry
    } finally {
      polling = false;
    }
  }, POLL_INTERVAL_MS);

  server.listen(PORT, () => {
    process.stdout.write(`Tomotoken 3D viewer: http://localhost:${PORT}\n`);
  });
}

startServer();
