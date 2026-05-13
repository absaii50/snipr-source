import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sum, count, desc } from "drizzle-orm";
import { db, conversionsTable, linksTable, clickEventsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { requireAuthOrApiKey } from "../lib/api-key-auth";

const router: IRouter = Router();

function parseDateRange(from?: string, to?: string) {
  const now = new Date();
  // Accept either YYYY-MM-DD or a full ISO timestamp.
  const toDate = to
    ? (to.includes("T") ? new Date(to) : new Date(to + "T23:59:59Z"))
    : now;
  const fromDate = from
    ? (from.includes("T") ? new Date(from) : new Date(from + "T00:00:00Z"))
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { fromDate, toDate };
}

/** 3-letter ISO-4217 currency codes. We don't reject unknown ones (Stripe
 *  occasionally adds new ones) but we do require the shape so junk like
 *  "BITCOIN" or "" doesn't make it into the DB. */
function isValidCurrency(c: unknown): c is string {
  return typeof c === "string" && /^[A-Z]{3}$/.test(c.toUpperCase());
}

/** Coerce revenue into a non-negative numeric string for the numeric column.
 *  Returns null when the value is missing or not a usable number. */
function coerceRevenue(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  const num = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(num) || num < 0) return null;
  // Cap at 1e9 so a bad caller can't push a 100-digit number into the column.
  return Math.min(num, 1_000_000_000).toFixed(2);
}

/** Stringify metadata defensively. Cap at 8KB so jsonb rows stay sane. */
function clampMetadata(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (typeof v !== "object") return null;
  try {
    const json = JSON.stringify(v);
    if (json.length > 8 * 1024) return null;
    return v;
  } catch {
    return null;
  }
}

/**
 * POST /conversions — record a conversion event. Accepts either a dashboard
 * session OR an X-API-Key header so it can be called from the customer's own
 * server. Validates that any referenced linkId / clickEventId belong to the
 * caller's workspace (no cross-workspace attribution).
 */
router.post("/conversions", requireAuthOrApiKey, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const workspaceId = req.session.workspaceId!;

  // ─── Resolve & validate linkId ────────────────────────────────────────
  let linkId: string | null = null;
  if (typeof body.slug === "string" && body.slug.length > 0) {
    const [link] = await db
      .select({ id: linksTable.id })
      .from(linksTable)
      .where(and(eq(linksTable.slug, body.slug.toLowerCase()), eq(linksTable.workspaceId, workspaceId)));
    if (!link) {
      res.status(404).json({ error: "Not found", message: "No link with that slug in this workspace." });
      return;
    }
    linkId = link.id;
  } else if (typeof body.linkId === "string" && body.linkId.length > 0) {
    // SECURITY: verify the link belongs to the caller's workspace. Without
    // this check a logged-in user could attribute conversions to other
    // workspaces' links.
    const [link] = await db
      .select({ id: linksTable.id })
      .from(linksTable)
      .where(and(eq(linksTable.id, body.linkId), eq(linksTable.workspaceId, workspaceId)));
    if (!link) {
      res.status(404).json({ error: "Not found", message: "linkId does not belong to this workspace." });
      return;
    }
    linkId = link.id;
  }

  // ─── Resolve & validate clickEventId (optional) ───────────────────────
  let clickEventId: string | null = null;
  if (typeof body.clickEventId === "string" && body.clickEventId.length > 0) {
    // The click_events table doesn't have workspace_id directly — verify via
    // its link's workspace.
    const [ce] = await db
      .select({ id: clickEventsTable.id })
      .from(clickEventsTable)
      .innerJoin(linksTable, eq(clickEventsTable.linkId, linksTable.id))
      .where(and(
        eq(clickEventsTable.id, body.clickEventId),
        eq(linksTable.workspaceId, workspaceId),
      ));
    if (!ce) {
      res.status(404).json({ error: "Not found", message: "clickEventId does not belong to this workspace." });
      return;
    }
    clickEventId = ce.id;
  }

  // ─── Validate event fields ────────────────────────────────────────────
  const rawEventName = typeof body.eventName === "string" ? body.eventName.trim() : "conversion";
  if (rawEventName.length > 64) {
    res.status(400).json({ error: "Validation error", message: "eventName must be ≤ 64 chars." });
    return;
  }
  const eventName = rawEventName || "conversion";

  const revenue = coerceRevenue(body.revenue);

  const currency = isValidCurrency(body.currency)
    ? (body.currency as string).toUpperCase()
    : "USD";

  const stringOrNull = (v: unknown, max = 255): string | null => {
    if (typeof v !== "string") return null;
    const trimmed = v.trim();
    if (trimmed.length === 0) return null;
    return trimmed.slice(0, max);
  };

  const [conv] = await db
    .insert(conversionsTable)
    .values({
      workspaceId,
      linkId,
      clickEventId,
      eventName,
      revenue,
      currency,
      utmCampaign: stringOrNull(body.utmCampaign),
      utmSource: stringOrNull(body.utmSource),
      utmMedium: stringOrNull(body.utmMedium),
      metadata: clampMetadata(body.metadata),
    })
    .returning();

  res.status(201).json(conv);
});

router.get("/conversions", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { from, to } = req.query as Record<string, string>;
  const { fromDate, toDate } = parseDateRange(from, to);

  const rows = await db
    .select({
      id: conversionsTable.id,
      linkId: conversionsTable.linkId,
      eventName: conversionsTable.eventName,
      revenue: conversionsTable.revenue,
      currency: conversionsTable.currency,
      utmCampaign: conversionsTable.utmCampaign,
      utmSource: conversionsTable.utmSource,
      utmMedium: conversionsTable.utmMedium,
      createdAt: conversionsTable.createdAt,
      slug: linksTable.slug,
      linkTitle: linksTable.title,
    })
    .from(conversionsTable)
    .leftJoin(linksTable, eq(conversionsTable.linkId, linksTable.id))
    .where(
      and(
        eq(conversionsTable.workspaceId, workspaceId),
        gte(conversionsTable.createdAt, fromDate),
        lte(conversionsTable.createdAt, toDate)
      )
    )
    .orderBy(desc(conversionsTable.createdAt))
    .limit(200);

  res.json(rows);
});

router.get("/conversions/revenue", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { from, to } = req.query as Record<string, string>;
  const { fromDate, toDate } = parseDateRange(from, to);

  const baseWhere = and(
    eq(conversionsTable.workspaceId, workspaceId),
    gte(conversionsTable.createdAt, fromDate),
    lte(conversionsTable.createdAt, toDate)
  );

  const [totals] = await db
    .select({
      totalRevenue: sum(conversionsTable.revenue),
      totalConversions: count(),
    })
    .from(conversionsTable)
    .where(baseWhere);

  const byLink = await db
    .select({
      linkId: conversionsTable.linkId,
      slug: linksTable.slug,
      title: linksTable.title,
      conversions: count(),
      revenue: sum(conversionsTable.revenue),
    })
    .from(conversionsTable)
    .leftJoin(linksTable, eq(conversionsTable.linkId, linksTable.id))
    .where(baseWhere)
    .groupBy(conversionsTable.linkId, linksTable.slug, linksTable.title)
    .orderBy(desc(sum(conversionsTable.revenue)))
    .limit(20);

  const byCampaign = await db
    .select({
      campaign: conversionsTable.utmCampaign,
      conversions: count(),
      revenue: sum(conversionsTable.revenue),
    })
    .from(conversionsTable)
    .where(baseWhere)
    .groupBy(conversionsTable.utmCampaign)
    .orderBy(desc(sum(conversionsTable.revenue)))
    .limit(20);

  const byEvent = await db
    .select({
      eventName: conversionsTable.eventName,
      conversions: count(),
      revenue: sum(conversionsTable.revenue),
    })
    .from(conversionsTable)
    .where(baseWhere)
    .groupBy(conversionsTable.eventName)
    .orderBy(desc(count()))
    .limit(10);

  res.json({
    totalRevenue: Number(totals?.totalRevenue ?? 0),
    totalConversions: Number(totals?.totalConversions ?? 0),
    byLink: byLink.map((r) => ({
      ...r,
      conversions: Number(r.conversions),
      revenue: Number(r.revenue ?? 0),
    })),
    byCampaign: byCampaign.map((r) => ({
      ...r,
      campaign: r.campaign ?? "(none)",
      conversions: Number(r.conversions),
      revenue: Number(r.revenue ?? 0),
    })),
    byEvent: byEvent.map((r) => ({
      ...r,
      conversions: Number(r.conversions),
      revenue: Number(r.revenue ?? 0),
    })),
  });
});

export default router;
