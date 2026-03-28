import { Response } from "express";

interface SseClient {
  workspaceId: string;
  res: Response;
}

const clients = new Set<SseClient>();

export function subscribe(workspaceId: string, res: Response): () => void {
  const client: SseClient = { workspaceId, res };
  clients.add(client);
  return () => clients.delete(client);
}

export function broadcast(workspaceId: string, event: Record<string, unknown>): void {
  const data = JSON.stringify(event);
  for (const client of clients) {
    if (client.workspaceId === workspaceId) {
      try {
        client.res.write(`data: ${data}\n\n`);
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
