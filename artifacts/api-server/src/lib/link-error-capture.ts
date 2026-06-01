import type { Request, Response, NextFunction } from "express";
import { db, linkErrorEventsTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Express middleware that records every 4xx/5xx response on link-mutation
 * routes into link_error_events. Powers two things:
 *   1. The "user_stuck_on_links" health check — flags users repeatedly
 *      hitting the same error so an admin can reach out.
 *   2. The per-user error timeline in the admin Health tab.
 *
 * Why not just use the existing pino HTTP logger? pino logs are great for
 * grep but bad for SQL queries like "give me every user who saw 3+ 422s
 * on POST /links in the last 15 min." A dedicated table makes that a
 * single indexed query.
 *
 * Privacy: we capture *which field* failed and *which slug* the user tried,
 * not the full request body. No destination URLs, no passwords, no PII.
 */
export function captureLinkErrors(req: Request, res: Response, next: NextFunction): void {
  // Only mutations — GET /links is high-volume and not interesting here.
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }

  // We need to inspect the response body the route is about to send, so we
  // wrap res.json (and res.send for routes that don't use res.json). After
  // the route fires its response, we extract the error fields and persist.
  const originalJson = res.json.bind(res);
  res.json = function patchedJson(body: any): Response {
    try {
      const status = res.statusCode;
      if (status >= 400) {
        captureOne(req, res, body).catch((err) =>
          logger.warn({ err }, "captureLinkErrors: persist failed"),
        );
      }
    } catch {
      // Never let our instrumentation break the route response.
    }
    return originalJson(body);
  } as any;

  next();
}

async function captureOne(req: Request, res: Response, body: any): Promise<void> {
  const status = res.statusCode;
  const path = req.baseUrl + req.path;
  const userId = (req.session as any)?.userId ?? null;
  const workspaceId = (req.session as any)?.workspaceId ?? null;

  // Pull the fields we care about out of the response body. Different routes
  // emit slightly different shapes — we tolerate all of them.
  const errorCode = typeof body?.error === "string" ? body.error : null;
  const errorMessage = typeof body?.message === "string" ? body.message.slice(0, 500) : null;
  const errorField = typeof body?.field === "string" ? body.field : null;

  // Tiny safe summary of what the user was trying to do. Truncated to keep
  // the row small + avoid leaking long URLs / secrets into the audit table.
  const requestBody = (req.body ?? {}) as Record<string, unknown>;
  const requestSummary: Record<string, unknown> = {};
  if (typeof requestBody.slug === "string") requestSummary.slug = requestBody.slug.slice(0, 100);
  if (typeof requestBody.destinationUrl === "string") {
    // Just keep the hostname, not the path / query / fragment
    try {
      requestSummary.destinationHost = new URL(requestBody.destinationUrl).hostname;
    } catch {
      requestSummary.destinationHost = "(invalid url)";
    }
  }
  if (requestBody.password) requestSummary.hasPassword = true;
  if (requestBody.expiresAt) requestSummary.hasExpiry = true;
  if (requestBody.isCloaked) requestSummary.isCloaked = true;
  if (requestBody.clickLimit) requestSummary.hasClickLimit = true;
  if (typeof requestBody.domainId === "string") requestSummary.domainId = requestBody.domainId;

  await db.insert(linkErrorEventsTable).values({
    userId,
    workspaceId,
    method: req.method,
    path: path.length > 200 ? path.slice(0, 200) : path,
    status,
    errorCode,
    errorMessage,
    errorField,
    requestSummary: Object.keys(requestSummary).length > 0 ? requestSummary : null,
    userAgent: (req.headers["user-agent"] as string | undefined)?.slice(0, 250) ?? null,
  });
}
