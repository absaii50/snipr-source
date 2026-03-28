import { UAParser } from "ua-parser-js";
import geoip from "geoip-lite";
import crypto from "crypto";
import { db, clickEventsTable, linksTable } from "@workspace/db";
import { Request } from "express";
import { logger } from "./logger";
import { fireIntegrations } from "./integrations-fire";
import { broadcast } from "./realtime-bus";

type Link = typeof linksTable.$inferSelect;
type ClickPayload = typeof clickEventsTable.$inferInsert;

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip + "snipr-salt").digest("hex").slice(0, 16);
}

function getRealIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? "";
}

function parseUserAgent(ua: string | undefined) {
  if (!ua) return { browser: null, os: null, device: null };
  const parser = new UAParser(ua);
  const result = parser.getResult();
  return {
    browser: result.browser.name ?? null,
    os: result.os.name ?? null,
    device: result.device.type ?? "desktop",
  };
}

function getGeo(ip: string) {
  try {
    const geo = geoip.lookup(ip);
    return { country: geo?.country ?? null, city: geo?.city ?? null };
  } catch {
    return { country: null, city: null };
  }
}

function parseReferrer(referrer: string | undefined): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    return url.hostname || referrer;
  } catch {
    return referrer;
  }
}

/* ── Batch Write Queue ────────────────────────────────────────────────── */

const BATCH_MAX = 100;
const FLUSH_INTERVAL_MS = 500;
const MAX_RETRY_ATTEMPTS = 3;

const clickQueue: ClickPayload[] = [];
let consecutiveFailures = 0;

async function flushQueue(): Promise<void> {
  if (clickQueue.length === 0) return;

  const batch = clickQueue.splice(0, BATCH_MAX);

  try {
    await db.insert(clickEventsTable).values(batch);

    // Reset failure counter on success
    if (consecutiveFailures > 0) {
      consecutiveFailures = 0;
      logger.info("Click queue flush recovered after failures");
    }
  } catch (error) {
    // Log the error for monitoring
    logger.error(error, {
      message: "Failed to flush click queue",
      batchSize: batch.length,
      queueSize: clickQueue.length,
    });

    // Re-add batch to queue for retry (only if not already retried too many times)
    if (consecutiveFailures < MAX_RETRY_ATTEMPTS) {
      clickQueue.unshift(...batch); // Put at front for next flush
      consecutiveFailures++;

      // If queue is getting too large, log warning
      if (clickQueue.length > 5000) {
        logger.warn({
          message: "Click queue overflow warning",
          queueSize: clickQueue.length,
          consecutiveFailures,
        });
      }
    } else {
      // After too many failures, drop batch but log it
      logger.error({
        message: "Click batch permanently lost after max retries",
        batchSize: batch.length,
        consecutiveFailures,
      });
      consecutiveFailures = 0; // Reset after giving up
    }
  }
}

setInterval(flushQueue, FLUSH_INTERVAL_MS);

// Flush remaining events on graceful shutdown to minimise data loss
async function shutdown() {
  await flushQueue();
  process.exit(0);
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

/* ── Public API ────────────────────────────────────────────────────────── */

export async function trackClick(req: Request, link: Link, isQr: boolean = false): Promise<void> {
  try {
    const ip = getRealIp(req);
    const ipHash = ip ? hashIp(ip) : null;
    const ua = req.headers["user-agent"];
    const { browser, os, device } = parseUserAgent(ua);
    const { country, city } = getGeo(ip);
    const referrer = parseReferrer(req.headers.referer ?? (req.headers.referrer as string | undefined));

    const utmSource = (req.query.utm_source as string) ?? null;
    const utmMedium = (req.query.utm_medium as string) ?? null;
    const utmCampaign = (req.query.utm_campaign as string) ?? null;
    const utmTerm = (req.query.utm_term as string) ?? null;
    const utmContent = (req.query.utm_content as string) ?? null;

    clickQueue.push({
      linkId: link.id,
      timestamp: new Date(),
      referrer,
      userAgent: ua ?? null,
      browser,
      os,
      device,
      country,
      city,
      ipHash,
      isQr,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
    });

    if (clickQueue.length >= BATCH_MAX) {
      void flushQueue();
    }

    broadcast(link.workspaceId, {
      type: "click",
      linkId: link.id,
      slug: link.slug,
      country,
      city,
      device,
      browser,
      os,
      referrer,
      isQr,
      timestamp: new Date().toISOString(),
    });

    fireIntegrations(link.workspaceId, {
      linkId: link.id,
      slug: link.slug,
      destinationUrl: link.destinationUrl,
      workspaceId: link.workspaceId,
      country,
      city,
      device,
      browser,
      os,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      timestamp: new Date().toISOString(),
      isQr,
    });
  } catch {
    // Fire-and-forget: swallow errors so redirect is never broken
  }
}
