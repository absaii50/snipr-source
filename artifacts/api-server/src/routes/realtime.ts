import { Router } from "express";
import { subscribe, connectedCount, pruneDeadClients, broadcast } from "../lib/realtime-bus";

const router = Router();

// ~8KB padding to force Cloudflare to flush its HTTP/2 buffer
// Cloudflare buffers small SSE frames; 8KB reliably triggers a flush on all plans
const CF_FLUSH_PAD = " ".repeat(8192);

/** Helper: write SSE data and force-flush through all buffer layers */
function sseWrite(res: import("express").Response, data: string): void {
  try {
    if (res.writableEnded || res.destroyed) return;
    res.write(data);
    // Force-flush compression / Node buffers so data reaches client immediately
    if (typeof (res as any).flush === "function") (res as any).flush();
  } catch {
    // Connection dead — caller handles cleanup
  }
}

// Periodically prune dead SSE clients (every 30s) as safety net
setInterval(pruneDeadClients, 30_000);

router.get("/realtime/stream", async (req, res) => {
  const workspaceId = req.session?.workspaceId;
  const userId = req.session?.userId;
  if (!userId || !workspaceId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // SSE headers — must disable ALL buffering layers (Express, Nginx, Cloudflare)
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, no-transform, must-revalidate");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  const origin = req.headers.origin;
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.flushHeaders();

  // Disable Node.js socket buffering (Nagle's algorithm)
  if (typeof (res as any).socket?.setNoDelay === "function") {
    (res as any).socket.setNoDelay(true);
  }

  // Send 16KB initial burst to reliably break through Cloudflare's HTTP/2 buffer
  // First block: 8KB padding comment (forces Cloudflare to start streaming)
  sseWrite(res, `: ${CF_FLUSH_PAD}\n`);
  // Second block: another 8KB padding + the connected event
  sseWrite(res, `: ${CF_FLUSH_PAD}\ndata: ${JSON.stringify({ type: "connected", workspaceId })}\n\n`);

  // Subscribe AFTER headers are flushed so the response is ready for SSE writes
  const unsubscribe = subscribe(workspaceId, res);
  if (!unsubscribe) {
    sseWrite(res, `data: ${JSON.stringify({ type: "error", message: "Too many live connections" })}\n\n`);
    res.end();
    return;
  }

  // Heartbeat every 5s — shorter interval to keep Cloudflare connection alive
  // Includes 8KB padding to force Cloudflare's HTTP/2 buffer to flush
  const heartbeat = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(heartbeat);
      unsubscribe();
      return;
    }
    sseWrite(res, `: ${CF_FLUSH_PAD}\ndata: ${JSON.stringify({ type: "ping" })}\n\n`);
  }, 5_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    if (!res.writableEnded) res.end();
  });
});

// Polling fallback
router.get("/realtime/poll", async (req, res) => {
  const workspaceId = req.session?.workspaceId;
  if (!req.session?.userId || !workspaceId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ connected: true, viewers: connectedCount(workspaceId) });
});

// ─── Internal ingest endpoint for cross-server realtime broadcast ───
// The redirect server (Server 2) calls this after recording a click so
// the SSE bus on this server can push the event to connected Live-page clients.
const INGEST_SECRET = process.env.REALTIME_INGEST_SECRET;

router.post("/realtime/ingest", (req, res) => {
  if (!INGEST_SECRET) {
    res.status(503).json({ error: "Ingest secret not configured" });
    return;
  }
  const auth = req.headers["x-ingest-secret"];
  if (!auth || auth !== INGEST_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { workspaceId, event } = req.body ?? {};
  if (!workspaceId || !event) {
    res.status(400).json({ error: "Missing workspaceId or event" });
    return;
  }

  broadcast(workspaceId, event);
  res.json({ ok: true });
});

export default router;
