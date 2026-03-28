import { Router } from "express";
import { db, workspacesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { subscribe, connectedCount } from "../lib/realtime-bus";

const router = Router();

router.get("/realtime/stream", async (req, res) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [workspace] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.userId, req.session.userId));

  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  const origin = req.headers.origin;
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: "connected", workspaceId: workspace.id })}\n\n`);

  const unsubscribe = subscribe(workspace.id, res);

  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

export default router;
