import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

/** Parse from/to in the same shape as the rest of analytics — accept either
 *  YYYY-MM-DD or a full ISO timestamp, default to last 30 days. */
function parseRange(from?: string, to?: string) {
  const now = new Date();
  const toDate = to
    ? (to.includes("T") ? new Date(to) : new Date(to + "T23:59:59Z"))
    : now;
  const fromDate = from
    ? (from.includes("T") ? new Date(from) : new Date(from + "T00:00:00Z"))
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { fromDate, toDate };
}

/**
 * GET /analytics/utm/overview — high-level UTM dashboard data:
 *   • KPIs: total clicks with UTMs, distinct sources/mediums/campaigns,
 *     attributed revenue from conversions in the same window
 *   • Top breakdowns by source, medium, campaign with revenue
 */
router.get("/analytics/utm/overview", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { from, to } = req.query as Record<string, string>;
  const { fromDate, toDate } = parseRange(from, to);

  const [kpis] = (await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_clicks,
      COUNT(*) FILTER (WHERE ce.utm_source IS NOT NULL OR ce.utm_medium IS NOT NULL OR ce.utm_campaign IS NOT NULL)::int AS utm_clicks,
      COUNT(DISTINCT ce.utm_source) AS distinct_sources,
      COUNT(DISTINCT ce.utm_medium) AS distinct_mediums,
      COUNT(DISTINCT ce.utm_campaign) AS distinct_campaigns
    FROM click_events ce
    JOIN links l ON l.id = ce.link_id
    WHERE l.workspace_id = ${workspaceId}
      AND ce.timestamp BETWEEN ${fromDate} AND ${toDate}
  `)).rows as any[];

  const [revKpi] = (await db.execute(sql`
    SELECT
      COALESCE(SUM(revenue), 0)::numeric(14,2) AS total_revenue,
      COUNT(*)::int AS conversions
    FROM conversions
    WHERE workspace_id = ${workspaceId}
      AND created_at BETWEEN ${fromDate} AND ${toDate}
      AND (utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL)
  `)).rows as any[];

  const breakdown = async (col: "utm_source" | "utm_medium" | "utm_campaign") => {
    const rows = (await db.execute(sql`
      WITH click_agg AS (
        SELECT ${sql.raw(`ce.${col}`)} AS label, COUNT(*)::int AS clicks
        FROM click_events ce
        JOIN links l ON l.id = ce.link_id
        WHERE l.workspace_id = ${workspaceId}
          AND ce.timestamp BETWEEN ${fromDate} AND ${toDate}
          AND ${sql.raw(`ce.${col}`)} IS NOT NULL
        GROUP BY label
      ),
      conv_agg AS (
        SELECT ${sql.raw(col)} AS label,
               COUNT(*)::int AS conversions,
               COALESCE(SUM(revenue), 0)::numeric(14,2) AS revenue
        FROM conversions
        WHERE workspace_id = ${workspaceId}
          AND created_at BETWEEN ${fromDate} AND ${toDate}
          AND ${sql.raw(col)} IS NOT NULL
        GROUP BY label
      )
      SELECT
        COALESCE(click_agg.label, conv_agg.label) AS label,
        COALESCE(click_agg.clicks, 0) AS clicks,
        COALESCE(conv_agg.conversions, 0) AS conversions,
        COALESCE(conv_agg.revenue, 0) AS revenue
      FROM click_agg
      FULL OUTER JOIN conv_agg ON click_agg.label = conv_agg.label
      ORDER BY clicks DESC, revenue DESC
      LIMIT 25
    `)).rows;
    return rows.map((r: any) => ({
      label: r.label,
      clicks: Number(r.clicks),
      conversions: Number(r.conversions),
      revenue: Number(r.revenue),
      conversionRate: Number(r.clicks) > 0
        ? Math.round((Number(r.conversions) / Number(r.clicks)) * 10000) / 100
        : 0,
    }));
  };

  const [bySource, byMedium, byCampaign] = await Promise.all([
    breakdown("utm_source"),
    breakdown("utm_medium"),
    breakdown("utm_campaign"),
  ]);

  res.json({
    kpis: {
      totalClicks: Number(kpis?.total_clicks ?? 0),
      utmClicks: Number(kpis?.utm_clicks ?? 0),
      distinctSources: Number(kpis?.distinct_sources ?? 0),
      distinctMediums: Number(kpis?.distinct_mediums ?? 0),
      distinctCampaigns: Number(kpis?.distinct_campaigns ?? 0),
      conversions: Number(revKpi?.conversions ?? 0),
      revenue: Number(revKpi?.total_revenue ?? 0),
    },
    bySource,
    byMedium,
    byCampaign,
  });
});

/**
 * GET /analytics/utm/timeseries — daily click counts for the top N values of
 *   the requested dimension (source / medium / campaign). Returns an array of
 *   `{ date, series: { label1: n, label2: n, ... } }` plus the labels list so
 *   the chart can render a stacked / multi-line view.
 */
router.get("/analytics/utm/timeseries", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { from, to } = req.query as Record<string, string>;
  const dimension = (req.query.dimension as string) ?? "source";
  const topN = Math.min(Math.max(Number(req.query.top ?? 5), 1), 10);

  const colMap: Record<string, string> = {
    source: "utm_source",
    medium: "utm_medium",
    campaign: "utm_campaign",
  };
  const col = colMap[dimension] ?? "utm_source";
  const { fromDate, toDate } = parseRange(from, to);

  // 1. Find the top N labels in window.
  const topRows = (await db.execute(sql`
    SELECT ${sql.raw(`ce.${col}`)} AS label, COUNT(*)::int AS clicks
    FROM click_events ce
    JOIN links l ON l.id = ce.link_id
    WHERE l.workspace_id = ${workspaceId}
      AND ce.timestamp BETWEEN ${fromDate} AND ${toDate}
      AND ${sql.raw(`ce.${col}`)} IS NOT NULL
    GROUP BY label
    ORDER BY clicks DESC
    LIMIT ${topN}
  `)).rows as any[];
  const labels: string[] = topRows.map((r) => r.label);

  if (labels.length === 0) {
    res.json({ labels: [], series: [] });
    return;
  }

  // 2. Day-bucketed time series for those labels only.
  const rows = (await db.execute(sql`
    SELECT
      to_char(date_trunc('day', ce.timestamp), 'YYYY-MM-DD') AS day,
      ${sql.raw(`ce.${col}`)} AS label,
      COUNT(*)::int AS clicks
    FROM click_events ce
    JOIN links l ON l.id = ce.link_id
    WHERE l.workspace_id = ${workspaceId}
      AND ce.timestamp BETWEEN ${fromDate} AND ${toDate}
      AND ${sql.raw(`ce.${col}`)} = ANY(${labels})
    GROUP BY day, label
    ORDER BY day
  `)).rows as any[];

  // 3. Pivot day -> { label1: n, label2: n }
  const byDay: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (!byDay[r.day]) byDay[r.day] = {};
    byDay[r.day][r.label] = Number(r.clicks);
  }
  const series = Object.keys(byDay).sort().map((day) => ({
    day,
    ...labels.reduce((acc, l) => ({ ...acc, [l]: byDay[day][l] ?? 0 }), {}),
  }));

  res.json({ labels, series });
});

/**
 * GET /analytics/utm/cross-tab — source × medium intersection for a heatmap.
 *   Returns `{ sources: [], mediums: [], cells: [{ source, medium, clicks }] }`.
 */
router.get("/analytics/utm/cross-tab", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { from, to } = req.query as Record<string, string>;
  const { fromDate, toDate } = parseRange(from, to);

  const rows = (await db.execute(sql`
    SELECT
      COALESCE(ce.utm_source, '(none)') AS source,
      COALESCE(ce.utm_medium, '(none)') AS medium,
      COUNT(*)::int AS clicks
    FROM click_events ce
    JOIN links l ON l.id = ce.link_id
    WHERE l.workspace_id = ${workspaceId}
      AND ce.timestamp BETWEEN ${fromDate} AND ${toDate}
      AND (ce.utm_source IS NOT NULL OR ce.utm_medium IS NOT NULL)
    GROUP BY source, medium
    ORDER BY clicks DESC
    LIMIT 200
  `)).rows as any[];

  const sources = Array.from(new Set(rows.map((r) => r.source)));
  const mediums = Array.from(new Set(rows.map((r) => r.medium)));
  const cells = rows.map((r) => ({
    source: r.source,
    medium: r.medium,
    clicks: Number(r.clicks),
  }));

  res.json({ sources, mediums, cells });
});

/**
 * GET /analytics/utm/history — distinct historical values per dimension so
 *   the LinkModal can autocomplete from the user's own past UTMs. Cuts down
 *   on typos and inconsistent capitalisation across the workspace.
 */
router.get("/analytics/utm/history", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

  const distinct = async (col: "utm_source" | "utm_medium" | "utm_campaign" | "utm_term" | "utm_content") => {
    const rows = (await db.execute(sql`
      SELECT DISTINCT ${sql.raw(`ce.${col}`)} AS v
      FROM click_events ce
      JOIN links l ON l.id = ce.link_id
      WHERE l.workspace_id = ${workspaceId}
        AND ce.timestamp > ${since}
        AND ${sql.raw(`ce.${col}`)} IS NOT NULL
      LIMIT 100
    `)).rows as any[];
    return rows.map((r) => r.v as string);
  };

  const [source, medium, campaign, term, content] = await Promise.all([
    distinct("utm_source"),
    distinct("utm_medium"),
    distinct("utm_campaign"),
    distinct("utm_term"),
    distinct("utm_content"),
  ]);

  res.json({ source, medium, campaign, term, content });
});

/**
 * GET /analytics/utm/export — CSV of every click that carried at least one
 *   UTM in the window. Useful for piping into spreadsheets / BI tools.
 */
router.get("/analytics/utm/export", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { from, to } = req.query as Record<string, string>;
  const { fromDate, toDate } = parseRange(from, to);

  const rows = (await db.execute(sql`
    SELECT
      to_char(ce.timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS timestamp,
      l.slug,
      COALESCE(ce.utm_source, '') AS utm_source,
      COALESCE(ce.utm_medium, '') AS utm_medium,
      COALESCE(ce.utm_campaign, '') AS utm_campaign,
      COALESCE(ce.utm_term, '') AS utm_term,
      COALESCE(ce.utm_content, '') AS utm_content,
      COALESCE(ce.country, '') AS country,
      COALESCE(ce.device, '') AS device,
      COALESCE(ce.browser, '') AS browser,
      COALESCE(ce.referrer, '') AS referrer
    FROM click_events ce
    JOIN links l ON l.id = ce.link_id
    WHERE l.workspace_id = ${workspaceId}
      AND ce.timestamp BETWEEN ${fromDate} AND ${toDate}
      AND (ce.utm_source IS NOT NULL OR ce.utm_medium IS NOT NULL OR ce.utm_campaign IS NOT NULL
           OR ce.utm_term IS NOT NULL OR ce.utm_content IS NOT NULL)
    ORDER BY ce.timestamp DESC
    LIMIT 50000
  `)).rows as any[];

  const headers = ["timestamp","slug","utm_source","utm_medium","utm_campaign","utm_term","utm_content","country","device","browser","referrer"];
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(",")),
  ].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="snipr-utm-${Date.now()}.csv"`);
  res.send(csv);
});

export default router;
