import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql, count, countDistinct, desc } from "drizzle-orm";
import { db, linksTable, clickEventsTable, workspacesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function parseDateRange(from?: string, to?: string) {
  const now = new Date();
  const toDate = to
    ? (to.includes("T") ? new Date(to) : new Date(to + "T23:59:59Z"))
    : now;
  const fromDate = from
    ? (from.includes("T") ? new Date(from) : new Date(from + "T00:00:00Z"))
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { fromDate, toDate };
}

async function topN(
  workspaceId: string,
  column: typeof clickEventsTable.country | typeof clickEventsTable.browser | typeof clickEventsTable.os | typeof clickEventsTable.device | typeof clickEventsTable.referrer | typeof clickEventsTable.city | typeof clickEventsTable.utmSource | typeof clickEventsTable.utmMedium | typeof clickEventsTable.utmCampaign,
  fromDate: Date,
  toDate: Date,
  linkId?: string,
  limit = 10
): Promise<{ label: string; count: number }[]> {
  const linkFilter = linkId
    ? and(eq(linksTable.workspaceId, workspaceId), eq(linksTable.id, linkId))
    : eq(linksTable.workspaceId, workspaceId);

  const rows = await db
    .select({
      label: column,
      count: count(),
    })
    .from(clickEventsTable)
    .innerJoin(linksTable, eq(clickEventsTable.linkId, linksTable.id))
    .where(
      and(
        linkFilter,
        gte(clickEventsTable.timestamp, fromDate),
        lte(clickEventsTable.timestamp, toDate)
      )
    )
    .groupBy(column)
    .orderBy(desc(count()))
    .limit(limit);

  return rows
    .filter((r) => r.label !== null)
    .map((r) => ({ label: r.label as string, count: Number(r.count) }));
}

async function topLinks(workspaceId: string, fromDate: Date, toDate: Date, limit = 10) {
  const rows = await db
    .select({
      label: linksTable.slug,
      count: count(),
    })
    .from(clickEventsTable)
    .innerJoin(linksTable, eq(clickEventsTable.linkId, linksTable.id))
    .where(
      and(
        eq(linksTable.workspaceId, workspaceId),
        gte(clickEventsTable.timestamp, fromDate),
        lte(clickEventsTable.timestamp, toDate)
      )
    )
    .groupBy(linksTable.slug)
    .orderBy(desc(count()))
    .limit(limit);

  return rows.map((r) => ({ label: r.label as string, count: Number(r.count) }));
}

// GET /api/analytics/workspace
router.get("/analytics/workspace", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { from, to, linkId } = req.query as { from?: string; to?: string; linkId?: string };
  const { fromDate, toDate } = parseDateRange(from, to);

  const linkFilter = linkId
    ? and(eq(linksTable.workspaceId, workspaceId), eq(linksTable.id, linkId))
    : eq(linksTable.workspaceId, workspaceId);

  const [clickStats] = await db

    .select({
      totalClicks: count(),
      uniqueClicks: countDistinct(clickEventsTable.ipHash),
    })
    .from(clickEventsTable)
    .innerJoin(linksTable, eq(clickEventsTable.linkId, linksTable.id))
    .where(
      and(
        linkFilter,
        gte(clickEventsTable.timestamp, fromDate),
        lte(clickEventsTable.timestamp, toDate)
      )
    );

  const [linkStats] = await db
    .select({
      totalLinks: count(),
      enabledLinks: sql<number>`cast(sum(case when ${linksTable.enabled} = true then 1 else 0 end) as int)`,
    })
    .from(linksTable)
    .where(eq(linksTable.workspaceId, workspaceId));

  const [tLinks, tCountries, tReferrers, tBrowsers, tDevices, tOs, tCities, tUtmSources, tUtmMediums, tUtmCampaigns] = await Promise.all([
    topLinks(workspaceId, fromDate, toDate),
    topN(workspaceId, clickEventsTable.country, fromDate, toDate, linkId),
    topN(workspaceId, clickEventsTable.referrer, fromDate, toDate, linkId),
    topN(workspaceId, clickEventsTable.browser, fromDate, toDate, linkId),
    topN(workspaceId, clickEventsTable.device, fromDate, toDate, linkId),
    topN(workspaceId, clickEventsTable.os, fromDate, toDate, linkId),
    topN(workspaceId, clickEventsTable.city, fromDate, toDate, linkId, 15),
    topN(workspaceId, clickEventsTable.utmSource, fromDate, toDate, linkId),
    topN(workspaceId, clickEventsTable.utmMedium, fromDate, toDate, linkId),
    topN(workspaceId, clickEventsTable.utmCampaign, fromDate, toDate, linkId),
  ]);

  const [qrStats] = await db
    .select({
      qrClicks: sql<number>`cast(sum(case when ${clickEventsTable.isQr} = true then 1 else 0 end) as int)`,
      directClicks: sql<number>`cast(sum(case when ${clickEventsTable.isQr} IS NOT TRUE then 1 else 0 end) as int)`,
    })
    .from(clickEventsTable)
    .innerJoin(linksTable, eq(clickEventsTable.linkId, linksTable.id))
    .where(
      and(
        linkFilter,
        gte(clickEventsTable.timestamp, fromDate),
        lte(clickEventsTable.timestamp, toDate)
      )
    );

  const hourRows = await db
    .select({
      hour: sql<number>`extract(hour from ${clickEventsTable.timestamp})::int`,
      count: count(),
    })
    .from(clickEventsTable)
    .innerJoin(linksTable, eq(clickEventsTable.linkId, linksTable.id))
    .where(
      and(
        linkFilter,
        gte(clickEventsTable.timestamp, fromDate),
        lte(clickEventsTable.timestamp, toDate)
      )
    )
    .groupBy(sql`extract(hour from ${clickEventsTable.timestamp})`)
    .orderBy(sql`extract(hour from ${clickEventsTable.timestamp})`);

  const hourOfDay = Array.from({ length: 24 }, (_, i) => {
    const match = hourRows.find(r => Number(r.hour) === i);
    return { hour: i, count: match ? Number(match.count) : 0 };
  });

  res.json({
    totalClicks: Number(clickStats?.totalClicks ?? 0),
    uniqueClicks: Number(clickStats?.uniqueClicks ?? 0),
    totalLinks: Number(linkStats?.totalLinks ?? 0),
    enabledLinks: Number(linkStats?.enabledLinks ?? 0),
    topLinks: tLinks,
    topCountries: tCountries,
    topReferrers: tReferrers,
    topBrowsers: tBrowsers,
    topDevices: tDevices,
    topOs: tOs,
    topCities: tCities,
    topUtmSources: tUtmSources,
    topUtmMediums: tUtmMediums,
    topUtmCampaigns: tUtmCampaigns,
    qrClicks: Number(qrStats?.qrClicks ?? 0),
    directClicks: Number(qrStats?.directClicks ?? 0),
    hourOfDay,
  });
});

// GET /api/analytics/workspace/timeseries
router.get("/analytics/workspace/timeseries", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { from, to, interval = "day", linkId } = req.query as {
    from?: string;
    to?: string;
    interval?: string;
    linkId?: string;
  };
  const { fromDate, toDate } = parseDateRange(from, to);

  const truncUnit = interval === "hour" ? "hour" : interval === "week" ? "week" : "day";

  const linkFilter = linkId
    ? and(eq(linksTable.workspaceId, workspaceId), eq(linksTable.id, linkId))
    : eq(linksTable.workspaceId, workspaceId);

  const truncRaw = sql.raw(`'${truncUnit}'`);
  const rows = await db
    .select({
      time: sql<string>`to_char(date_trunc(${truncRaw}, ${clickEventsTable.timestamp}), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      clicks: count(),
      uniqueClicks: countDistinct(clickEventsTable.ipHash),
    })
    .from(clickEventsTable)
    .innerJoin(linksTable, eq(clickEventsTable.linkId, linksTable.id))
    .where(
      and(
        linkFilter,
        gte(clickEventsTable.timestamp, fromDate),
        lte(clickEventsTable.timestamp, toDate)
      )
    )
    .groupBy(sql`date_trunc(${truncRaw}, ${clickEventsTable.timestamp})`)
    .orderBy(sql`date_trunc(${truncRaw}, ${clickEventsTable.timestamp})`);

  res.json(
    rows.map((r) => ({
      time: r.time,
      clicks: Number(r.clicks),
      uniqueClicks: Number(r.uniqueClicks),
    }))
  );
});

// GET /api/analytics/links/:id
router.get("/analytics/links/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { from, to } = req.query as { from?: string; to?: string };
  const { fromDate, toDate } = parseDateRange(from, to);

  const [link] = await db
    .select()
    .from(linksTable)
    .where(and(eq(linksTable.id, id), eq(linksTable.workspaceId, workspaceId)));

  if (!link) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [stats] = await db
    .select({
      totalClicks: count(),
      uniqueClicks: countDistinct(clickEventsTable.ipHash),
      qrClicks: sql<number>`cast(sum(case when ${clickEventsTable.isQr} = true then 1 else 0 end) as int)`,
      directClicks: sql<number>`cast(sum(case when ${clickEventsTable.isQr} IS NOT TRUE then 1 else 0 end) as int)`,
    })
    .from(clickEventsTable)
    .where(
      and(
        eq(clickEventsTable.linkId, id),
        gte(clickEventsTable.timestamp, fromDate),
        lte(clickEventsTable.timestamp, toDate)
      )
    );

  const [tCountries, tReferrers, tBrowsers, tDevices, tOs] = await Promise.all([
    topN(workspaceId, clickEventsTable.country, fromDate, toDate, id),
    topN(workspaceId, clickEventsTable.referrer, fromDate, toDate, id),
    topN(workspaceId, clickEventsTable.browser, fromDate, toDate, id),
    topN(workspaceId, clickEventsTable.device, fromDate, toDate, id),
    topN(workspaceId, clickEventsTable.os, fromDate, toDate, id),
  ]);

  res.json({
    totalClicks: Number(stats?.totalClicks ?? 0),
    uniqueClicks: Number(stats?.uniqueClicks ?? 0),
    directClicks: Number(stats?.directClicks ?? 0),
    qrClicks: Number(stats?.qrClicks ?? 0),
    topCountries: tCountries,
    topReferrers: tReferrers,
    topBrowsers: tBrowsers,
    topDevices: tDevices,
    topOs: tOs,
  });
});

// GET /api/analytics/links/:id/timeseries
router.get("/analytics/links/:id/timeseries", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { from, to, interval = "day" } = req.query as {
    from?: string;
    to?: string;
    interval?: string;
  };
  const { fromDate, toDate } = parseDateRange(from, to);

  const [link] = await db
    .select()
    .from(linksTable)
    .where(and(eq(linksTable.id, id), eq(linksTable.workspaceId, workspaceId)));

  if (!link) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const truncUnit = interval === "hour" ? "hour" : interval === "week" ? "week" : "day";
  const truncRaw = sql.raw(`'${truncUnit}'`);

  const rows = await db
    .select({
      time: sql<string>`to_char(date_trunc(${truncRaw}, ${clickEventsTable.timestamp}), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      clicks: count(),
      uniqueClicks: countDistinct(clickEventsTable.ipHash),
    })
    .from(clickEventsTable)
    .where(
      and(
        eq(clickEventsTable.linkId, id),
        gte(clickEventsTable.timestamp, fromDate),
        lte(clickEventsTable.timestamp, toDate)
      )
    )
    .groupBy(sql`date_trunc(${truncRaw}, ${clickEventsTable.timestamp})`)
    .orderBy(sql`date_trunc(${truncRaw}, ${clickEventsTable.timestamp})`);

  res.json(
    rows.map((r) => ({
      time: r.time,
      clicks: Number(r.clicks),
      uniqueClicks: Number(r.uniqueClicks),
    }))
  );
});

// GET /api/analytics/links/:id/events
router.get("/analytics/links/:id/events", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  const [link] = await db
    .select()
    .from(linksTable)
    .where(and(eq(linksTable.id, id), eq(linksTable.workspaceId, workspaceId)));

  if (!link) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const events = await db
    .select({
      id: clickEventsTable.id,
      linkId: clickEventsTable.linkId,
      timestamp: clickEventsTable.timestamp,
      referrer: clickEventsTable.referrer,
      browser: clickEventsTable.browser,
      os: clickEventsTable.os,
      device: clickEventsTable.device,
      country: clickEventsTable.country,
      city: clickEventsTable.city,
      isQr: clickEventsTable.isQr,
      utmSource: clickEventsTable.utmSource,
      utmMedium: clickEventsTable.utmMedium,
      utmCampaign: clickEventsTable.utmCampaign,
    })
    .from(clickEventsTable)
    .where(eq(clickEventsTable.linkId, id))
    .orderBy(desc(clickEventsTable.timestamp))
    .limit(limit)
    .offset(offset);

  res.json(events);
});

// GET /api/analytics/events — workspace-wide click log with pagination
router.get("/analytics/events", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  const events = await db
    .select({
      id: clickEventsTable.id,
      linkId: clickEventsTable.linkId,
      slug: linksTable.slug,
      domainId: linksTable.domainId,
      destinationUrl: linksTable.destinationUrl,
      timestamp: clickEventsTable.timestamp,
      referrer: clickEventsTable.referrer,
      browser: clickEventsTable.browser,
      os: clickEventsTable.os,
      device: clickEventsTable.device,
      country: clickEventsTable.country,
      city: clickEventsTable.city,
      isQr: clickEventsTable.isQr,
      utmSource: clickEventsTable.utmSource,
      utmMedium: clickEventsTable.utmMedium,
      utmCampaign: clickEventsTable.utmCampaign,
    })
    .from(clickEventsTable)
    .innerJoin(linksTable, eq(clickEventsTable.linkId, linksTable.id))
    .where(eq(linksTable.workspaceId, workspaceId))
    .orderBy(desc(clickEventsTable.timestamp))
    .limit(limit)
    .offset(offset);

  // Get total count for pagination
  const [{ total }] = await db
    .select({ total: count() })
    .from(clickEventsTable)
    .innerJoin(linksTable, eq(clickEventsTable.linkId, linksTable.id))
    .where(eq(linksTable.workspaceId, workspaceId));

  res.json({ events, total: Number(total), limit, offset });
});

// GET /api/stats/today — today's click count for the workspace
router.get("/stats/today", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [result] = await db
    .select({ clicks: count() })
    .from(clickEventsTable)
    .innerJoin(linksTable, eq(clickEventsTable.linkId, linksTable.id))
    .where(
      and(
        eq(linksTable.workspaceId, workspaceId),
        gte(clickEventsTable.timestamp, startOfDay)
      )
    );

  res.json({ clicks: Number(result?.clicks ?? 0) });
});

export default router;
