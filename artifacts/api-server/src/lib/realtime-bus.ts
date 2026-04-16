import { Response } from "express";

interface SseClient {
  workspaceId: string;
  res: Response;
}

const clients = new Set<SseClient>();

// Max SSE connections per workspace to prevent resource exhaustion
const MAX_CONNECTIONS_PER_WORKSPACE = 20;

export function subscribe(workspaceId: string, res: Response): (() => void) | null {
  // Enforce per-workspace connection limit
  if (connectedCount(workspaceId) >= MAX_CONNECTIONS_PER_WORKSPACE) {
    return null; // Caller should reject the connection
  }
  const client: SseClient = { workspaceId, res };
  clients.add(client);
  return () => clients.delete(client);
}

// ~8KB padding to force Cloudflare HTTP/2 buffer flush on every event
const CF_FLUSH_PAD = " ".repeat(8192);

export function broadcast(workspaceId: string, event: Record<string, unknown>): void {
  const data = `: ${CF_FLUSH_PAD}\ndata: ${JSON.stringify(event)}\n\n`;
  // Snapshot to array first — safe to delete from Set while iterating snapshot
  const snapshot = Array.from(clients);
  for (const client of snapshot) {
    if (client.workspaceId === workspaceId) {
      try {
        if (client.res.writableEnded || client.res.destroyed) {
          clients.delete(client);
          continue;
        }
        client.res.write(data);
        // Force-flush so click events reach the browser immediately
        if (typeof (client.res as any).flush === "function") {
          (client.res as any).flush();
        }
      } catch {
        clients.delete(client);
      }
    }
  }
}

export function connectedCount(workspaceId: string): number {
  let n = 0;
  for (const client of clients) {
    if (client.workspaceId === workspaceId) n++;
  }
  return n;
}

/** Clean up all dead connections — called periodically */
export function pruneDeadClients(): void {
  const snapshot = Array.from(clients);
  for (const client of snapshot) {
    if (client.res.writableEnded || client.res.destroyed) {
      clients.delete(client);
    }
  }
}
