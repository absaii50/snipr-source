import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql, sum, count, desc, lt, inArray } from "drizzle-orm";
import { db, linksTable, clickEventsTable, conversionsTable, aiInsightsTable } from "@workspace/db";
import OpenAI from "openai";
import { requireAuth } from "../lib/auth";

let deepseek: OpenAI | null = null;
function getDeepseek() {
  if (!deepseek) {
    deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || "placeholder",
      baseURL: "https://api.deepseek.com",
    });
  }
  return deepseek;
}

const router: IRouter = Router();

async function gatherAnalyticsContext(workspaceId: string, days = 7) {
  const now = new Date();
  const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevFrom = new Date(fromDate.getTime() - days * 24 * 60 * 60 * 1000);

  const [totalClicks] = await db
    .select({ value: count() })
    .from(clickEventsTable)
    .innerJoin(linksTable, eq(clickEventsTable.linkId, linksTable.id))
    .where(
      and(
        eq(linksTable.workspaceId, workspaceId),
        gte(clickEventsTable.timestamp, fromDate)
      )
    );

  const [prevClicks] = await db
    .select({ value: count() })
    .from(clickEventsTable)
    .innerJoin(linksTable, eq(clickEventsTable.linkId, linksTable.id))
    .where(
      and(
        eq(linksTable.workspaceId, workspaceId),
        gte(clickEventsTable.timestamp, prevFrom),
        lt(clickEventsTable.timestamp, fromDate)
      )
    );

  const topLinks = await db
    .select({
      slug: linksTable.slug,
      title: linksTable.title,
      clicks: count(),
    })
    .from(clickEventsTable)
    .innerJoin(linksTable, eq(clickEventsTable.linkId, linksTable.id))
    .where(
      and(
        eq(linksTable.workspaceId, workspaceId),
        gte(clickEventsTable.timestamp, fromDate)
      )
    )
    .groupBy(linksTable.slug, linksTable.title)
    .orderBy(desc(count()))
    .limit(5);

  const topCountries = await db
    .select({
      country: clickEventsTable.country,
      clicks: count(),
    })
    .from(clickEventsTable)
    .innerJoin(linksTable, eq(clickEventsTable.linkId, linksTable.id))
    .where(
      and(
        eq(linksTable.workspaceId, workspaceId),
        gte(clickEventsTable.timestamp, fromDate)
      )
    )
    .groupBy(clickEventsTable.country)
    .orderBy(desc(count()))
    .limit(5);

  const [conversionData] = await db
    .select({
      totalConversions: count(),
      totalRevenue: sum(conversionsTable.revenue),
    })
    .from(conversionsTable)
    .where(
      and(
        eq(conversionsTable.workspaceId, workspaceId),
        gte(conversionsTable.createdAt, fromDate)
      )
    );

  const topCampaigns = await db
    .select({
      campaign: conversionsTable.utmCampaign,
      conversions: count(),
      revenue: sum(conversionsTable.revenue),
    })
    .from(conversionsTable)
    .where(
      and(
        eq(conversionsTable.workspaceId, workspaceId),
        gte(conversionsTable.createdAt, fromDate)
      )
    )
    .groupBy(conversionsTable.utmCampaign)
    .orderBy(desc(count()))
    .limit(5);

  const clicksThisPeriod = Number(totalClicks?.value ?? 0);
  const clicksLastPeriod = Number(prevClicks?.value ?? 0);
  const changePercent =
    clicksLastPeriod > 0
      ? Math.round(((clicksThisPeriod - clicksLastPeriod) / clicksLastPeriod) * 100)
      : null;

  return {
    period: `${days} days`,
    clicks: {
      total: clicksThisPeriod,
      previousPeriod: clicksLastPeriod,
      changePercent,
    },
    topLinks: topLinks.map((l) => ({
      slug: l.slug,
      title: l.title ?? l.slug,
      clicks: Number(l.clicks),
    })),
    topCountries: topCountries
      .filter((c) => c.country)
      .map((c) => ({ country: c.country!, clicks: Number(c.clicks) })),
    conversions: {
      total: Number(conversionData?.totalConversions ?? 0),
      revenue: Number(conversionData?.totalRevenue ?? 0),
    },
    topCampaigns: topCampaigns.map((c) => ({
      campaign: c.campaign ?? "(none)",
      conversions: Number(c.conversions),
      revenue: Number(c.revenue ?? 0),
    })),
  };
}

router.post("/ai/insights/weekly", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;

  const ctx = await gatherAnalyticsContext(workspaceId, 7);

  const systemPrompt = `You are an analytics assistant for a URL shortener SaaS called Snipr.
Generate a concise weekly performance summary based ONLY on the provided data.
Be direct, specific, and actionable. Keep it under 200 words.
If data is empty or zero, acknowledge that honestly rather than inventing insights.

FORMAT RULES:
- Use clear section headings with a bold label followed by a colon (e.g. "**Click Performance:**")
- Under each heading, write 1-2 concise sentences
- Use numbers and percentages when available
- End with a clear "**Recommendation:**" section with one actionable step
- Do NOT use raw dash-prefixed bullet lists. Write in short paragraph style under each heading.`;

  const userPrompt = `Here is the real analytics data for the past 7 days:
${JSON.stringify(ctx, null, 2)}

Write a weekly summary covering:
1. Overall click performance vs last period
2. Top performing links
3. Key geographic trends
4. Conversion/revenue highlights (if any)
5. One actionable recommendation`;

  const response = await getDeepseek().chat.completions.create({
    model: "deepseek-chat",
    max_tokens: 512,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "Unable to generate summary.";

  const [insight] = await db
    .insert(aiInsightsTable)
    .values({
      workspaceId,
      type: "weekly_summary",
      content,
      metadata: ctx as Record<string, unknown>,
    })
    .returning();

  res.json(insight);
});

router.get("/ai/insights", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const limit = Math.min(Number(req.query.limit ?? 10), 50);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  await db
    .delete(aiInsightsTable)
    .where(
      and(
        eq(aiInsightsTable.workspaceId, workspaceId),
        eq(aiInsightsTable.type, "qa_response"),
        lt(aiInsightsTable.createdAt, oneHourAgo)
      )
    );

  const insights = await db
    .select()
    .from(aiInsightsTable)
    .where(eq(aiInsightsTable.workspaceId, workspaceId))
    .orderBy(desc(aiInsightsTable.createdAt))
    .limit(limit);

  res.json(insights);
});

router.post("/ai/ask", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const body = req.body as Record<string, unknown>;
  const question = (body.question as string)?.trim();

  if (!question) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  const ctx = await gatherAnalyticsContext(workspaceId, 30);

  const systemPrompt = `You are an analytics assistant for a URL shortener SaaS called Snipr.
Answer the user's question about their analytics using ONLY the provided real data.
Be concise and direct. If the answer cannot be determined from the data, say so clearly.
Never invent numbers. If data shows zeros, say so honestly.

FORMAT RULES:
- Write in clear, well-structured short paragraphs
- Use **bold** for key metrics and important numbers
- If comparing periods, format as: "**X clicks** this period vs **Y clicks** last period (**+Z%**)"
- If listing links or items, use a clear format like "**1.** /slug — X clicks"
- Keep answers 2-5 sentences. Never dump raw data.
- End with a brief actionable insight when relevant.`;

  const userPrompt = `Analytics data (last 30 days):
${JSON.stringify(ctx, null, 2)}

Question: ${question}`;

  const response = await getDeepseek().chat.completions.create({
    model: "deepseek-chat",
    max_tokens: 400,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const answer = response.choices[0]?.message?.content ?? "Unable to generate answer.";

  const [insight] = await db
    .insert(aiInsightsTable)
    .values({
      workspaceId,
      type: "qa_response",
      content: answer,
      metadata: { question, dataContext: ctx as Record<string, unknown> },
    })
    .returning();

  res.json({ question, answer, id: insight.id });
});

// POST /api/ai/ask/stream — streaming SSE version of Ask AI
router.post("/ai/ask/stream", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const body = req.body as Record<string, unknown>;
  const question = (body.question as string)?.trim();

  if (!question) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  const ctx = await gatherAnalyticsContext(workspaceId, 30);

  const systemPrompt = `You are an analytics assistant for a URL shortener SaaS called Snipr.
Answer the user's question about their analytics using ONLY the provided real data.
Be concise and direct. If the answer cannot be determined from the data, say so clearly.
Never invent numbers. If data shows zeros, say so honestly.

FORMAT RULES:
- Write in clear, well-structured short paragraphs
- Use **bold** for key metrics and important numbers
- If comparing periods, format as: "**X clicks** this period vs **Y clicks** last period (**+Z%**)"
- If listing links or items, use a clear format like "**1.** /slug — X clicks"
- Keep answers 2-5 sentences. Never dump raw data.
- End with a brief actionable insight when relevant.`;

  const userPrompt = `Analytics data (last 30 days):
${JSON.stringify(ctx, null, 2)}

Question: ${question}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let fullAnswer = "";

  try {
    const stream = await getDeepseek().chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 256,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? "";
      if (token) {
        fullAnswer += token;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }
  } catch {
    res.write(`data: ${JSON.stringify({ error: "AI unavailable" })}\n\n`);
    res.end();
    return;
  }

  // Save the full answer
  try {
    await db.insert(aiInsightsTable).values({
      workspaceId,
      type: "qa_response",
      content: fullAnswer,
      metadata: { question, dataContext: ctx as Record<string, unknown> },
    });
  } catch { /* best-effort */ }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

// POST /api/ai/smart-suggestions — proactive data-driven suggestions
router.post("/ai/smart-suggestions", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const ctx = await gatherAnalyticsContext(workspaceId, 30);

  const systemPrompt = `You are an analytics assistant for Snipr, a URL shortener SaaS.
Based on the user's real analytics data, generate exactly 5 short, actionable suggestions.
Each suggestion should be concrete, specific to the data, and 1-2 sentences max.
Format: return a JSON array of objects like:
[{"title":"Short title","body":"1-2 sentence insight.","icon":"trend|mobile|country|time|tag"}]
Icons must be one of: trend, mobile, country, time, tag.
Only output the JSON array, no other text.`;

  const userPrompt = `Analytics data (last 30 days):
${JSON.stringify(ctx, null, 2)}

Generate 5 smart, actionable insights for this user. Return only a JSON array.`;

  let suggestions: Array<{ title: string; body: string; icon: string }> = [];

  try {
    const response = await getDeepseek().chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 512,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = (response.choices[0]?.message?.content ?? "").trim();

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) suggestions = parsed.slice(0, 5);
    } catch {
      const match = raw.match(/\[[\s\S]*?\]/);
      if (match) {
        try { suggestions = JSON.parse(match[0]).slice(0, 5); } catch { /* fallback */ }
      }
    }
  } catch { /* AI unavailable */ }

  if (suggestions.length === 0) {
    suggestions = ctx.clicks.total === 0
      ? [
          { title: "Create your first link", body: "You haven't received any clicks yet. Share your Snipr links to start tracking traffic.", icon: "trend" },
          { title: "Add titles to links", body: "Named links are easier to recognize in reports and analytics.", icon: "tag" },
        ]
      : [
          { title: "Track your top link", body: `/${ctx.topLinks[0]?.slug ?? "your link"} is your best performer — consider promoting it more.`, icon: "trend" },
        ];
  }

  res.json({ suggestions });
});

// POST /api/ai/audit — AI link audit report
router.post("/ai/audit", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;

  const allLinks = await db
    .select()
    .from(linksTable)
    .where(eq(linksTable.workspaceId, workspaceId));

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const clickRows = await db
    .select({ linkId: clickEventsTable.linkId, total: count() })
    .from(clickEventsTable)
    .where(
      and(
        inArray(clickEventsTable.linkId, allLinks.map((l) => l.id)),
        gte(clickEventsTable.timestamp, sevenDaysAgo)
      )
    )
    .groupBy(clickEventsTable.linkId);

  const clickMap: Record<string, number> = {};
  for (const r of clickRows) clickMap[r.linkId] = Number(r.total);

  const linkSummaries = allLinks.map((l) => ({
    slug: l.slug,
    title: l.title ?? null,
    enabled: l.enabled,
    hasExpiry: !!l.expiresAt,
    expired: l.expiresAt ? new Date(l.expiresAt) < new Date() : false,
    clicks7d: clickMap[l.id] ?? 0,
    daysOld: Math.floor((Date.now() - new Date(l.createdAt).getTime()) / (24 * 60 * 60 * 1000)),
    hasTitle: !!l.title,
  }));

  const systemPrompt = `You are an expert link performance auditor for Snipr, a URL shortener SaaS.
Review the user's links and produce a structured audit report.
For each finding, include:
- type: "expired" | "zero_click" | "no_title" | "improvement"
- slug: the link slug
- message: a clear, specific 1-2 sentence finding or recommendation

Return only a JSON array of findings: [{"type":"...","slug":"...","message":"..."}]
Limit to 10 most important findings. If everything looks good, say so with one positive finding.
Output only the JSON array.`;

  const userPrompt = `Link data to audit:
${JSON.stringify(linkSummaries, null, 2)}

Produce the audit report as a JSON array.`;

  let findings: Array<{ type: string; slug: string; message: string }> = [];

  try {
    const response = await getDeepseek().chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 768,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = (response.choices[0]?.message?.content ?? "").trim();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) findings = parsed.slice(0, 10);
    } catch {
      const match = raw.match(/\[[\s\S]*?\]/);
      if (match) {
        try { findings = JSON.parse(match[0]).slice(0, 10); } catch { /* fallback */ }
      }
    }
  } catch { /* AI unavailable */ }

  if (findings.length === 0) {
    const expiredFindings = linkSummaries
      .filter((l) => l.expired)
      .slice(0, 3)
      .map((l) => ({ type: "expired", slug: l.slug, message: `/${l.slug} has passed its expiry date and may no longer be serving traffic.` }));

    const zeroClickFindings = linkSummaries
      .filter((l) => l.clicks7d === 0 && l.daysOld >= 7 && !l.expired)
      .slice(0, 3)
      .map((l) => ({ type: "zero_click", slug: l.slug, message: `/${l.slug} received no clicks in the last 7 days. Consider promoting it or checking the destination URL.` }));

    const noTitleFindings = linkSummaries
      .filter((l) => !l.hasTitle)
      .slice(0, 2)
      .map((l) => ({ type: "no_title", slug: l.slug, message: `/${l.slug} has no title set. Adding a descriptive title makes it easier to identify in reports.` }));

    const improvementFindings = linkSummaries
      .filter((l) => l.clicks7d > 0 && l.clicks7d < 5 && l.daysOld >= 7 && !l.expired)
      .slice(0, 2)
      .map((l) => ({ type: "improvement", slug: l.slug, message: `/${l.slug} has only ${l.clicks7d} click(s) this week. Consider sharing it on social media or adding UTM tracking to identify traffic sources.` }));

    findings = [
      ...expiredFindings,
      ...zeroClickFindings,
      ...noTitleFindings,
      ...improvementFindings,
    ].slice(0, 10);
  }

  res.json({ totalLinks: allLinks.length, findings });
});

router.post("/ai/slug-suggest", requireAuth, async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const url = (body.url as string)?.trim();
  const title = (body.title as string)?.trim();

  if (!url && !title) {
    res.status(400).json({ error: "url or title required" });
    return;
  }

  // Build source words from URL and title for fallback generation
  const sourceText = [title, url]
    .filter(Boolean)
    .join(" ")
    .replace(/https?:\/\/[^/]+\//i, "")
    .replace(/[^a-z0-9\s-]/gi, " ")
    .toLowerCase()
    .trim();

  const words = sourceText.split(/\s+/).filter((w) => w.length > 2).slice(0, 4);

  function makeFallbackSlugs(words: string[]): string[] {
    const base = words.slice(0, 2).join("-").substring(0, 15) || "my-link";
    return [
      base,
      `${words[0] ?? "link"}-${Math.floor(Math.random() * 9000) + 1000}`,
      words.slice(0, 3).join("-").substring(0, 15) || "quick-link",
      `${words[0] ?? "go"}-now`,
      `${words[1] ?? words[0] ?? "link"}-${words[0] ?? "go"}`,
    ].map((s) => s.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")).slice(0, 5);
  }

  let suggestions: string[] = [];

  try {
    const response = await getDeepseek().chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            'You are a URL slug generator. Generate exactly 5 short, memorable, lowercase URL slugs. Rules: 3-20 characters each, hyphens allowed, no spaces or special characters, no numbers alone. Output format: a JSON array only, like ["slug1","slug2","slug3","slug4","slug5"]. No other text.',
        },
        {
          role: "user",
          content: `Generate 5 URL slugs for:\nURL: ${url ?? "N/A"}\nTitle: ${title ?? "N/A"}\n\nRespond with only the JSON array.`,
        },
      ],
    });

    const raw = (response.choices[0]?.message?.content ?? "").trim();

    // Try multiple parsing strategies
    let parsed: string[] = [];

    // Strategy 1: direct parse
    try { parsed = JSON.parse(raw); } catch { /* try next */ }

    // Strategy 2: find JSON array in text
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const match = raw.match(/\[[\s\S]*?\]/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* try next */ }
      }
    }

    // Strategy 3: extract quoted strings
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const matches = raw.match(/"([^"]+)"/g);
      if (matches) {
        parsed = matches.map((m) => m.replace(/"/g, "")).filter((s) => s.length > 0);
      }
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
      suggestions = parsed
        .filter((s) => typeof s === "string" && s.length > 0)
        .map((s) => s.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""))
        .filter((s) => s.length >= 2)
        .slice(0, 5);
    }
  } catch (err) {
    // AI call failed — use fallback
    suggestions = [];
  }

  // Pad with fallback slugs if AI returned fewer than 3
  if (suggestions.length < 3) {
    const fallbacks = makeFallbackSlugs(words).filter((s) => !suggestions.includes(s));
    suggestions = [...suggestions, ...fallbacks].slice(0, 5);
  }

  res.json({ suggestions });
});

export default router;
