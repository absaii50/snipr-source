import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql, sum, count, desc } from "drizzle-orm";
import { db, conversionsTable, linksTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function parseDateRange(from?: string, to?: string) {
  const now = new Date();
  const toDate = to ? new Date(to + "T23:59:59Z") : now;
  const fromDate = from
    ? new Date(from + "T00:00:00Z")
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { fromDate, toDate };
}

router.post("/conversions", requireAuth, async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const workspaceId = req.session.workspaceId!;
  let linkId = body.linkId as string | undefined;

  if (body.slug) {
    const [link] = await db
      .select()
      .from(linksTable)
      .where(and(eq(linksTable.slug, body.slug as string), eq(linksTable.workspaceId, workspaceId)));
    if (!link) {
      res.status(404).json({ error: "Link not found" });
      return;
    }
    linkId = link.id;
  }

  const [conv] = await db
    .insert(conversionsTable)
    .values({
      workspaceId,
      linkId: linkId ?? null,
      clickEventId: (body.clickEventId as string) ?? null,
      eventName: (body.eventName as string) ?? "conversion",
      revenue: body.revenue !== undefined ? String(body.revenue) : null,
      currency: (body.currency as string) ?? "USD",
      utmCampaign: (body.utmCampaign as string) ?? null,
      utmSource: (body.utmSource as string) ?? null,
      utmMedium: (body.utmMedium as string) ?? null,
      metadata: body.metadata ?? null,
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
