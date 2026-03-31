import { Router, type IRouter } from "express";
import { eq, and, or, count, inArray, gte, sql, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { db, linksTable, workspacesTable, linkTagsTable, tagsTable, foldersTable, clickEventsTable, domainsTable } from "@workspace/db";
import {
  CreateLinkBody,
  UpdateLinkBody,
  GetLinkParams,
  UpdateLinkParams,
  DeleteLinkParams,
  GetLinkQrParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { invalidateLinkCache } from "../lib/link-cache";

const router: IRouter = Router();

function serializeLink(link: typeof linksTable.$inferSelect) {
  const { passwordHash, ...rest } = link;
  return { ...rest, hasPassword: !!passwordHash };
}

router.get("/links", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;

  const links = await db
    .select()
    .from(linksTable)
    .where(eq(linksTable.workspaceId, workspaceId))
    .orderBy(desc(linksTable.createdAt));

  if (links.length === 0) {
    res.json([]);
    return;
  }

  const linkIds = links.map((l) => l.id);
  const linkTagRows = await db
    .select({ linkId: linkTagsTable.linkId, id: tagsTable.id, name: tagsTable.name, color: tagsTable.color })
    .from(linkTagsTable)
    .innerJoin(tagsTable, eq(tagsTable.id, linkTagsTable.tagId))
    .where(inArray(linkTagsTable.linkId, linkIds));

  const tagsByLinkId = linkTagRows.reduce<Record<string, Array<{ id: string; name: string; color: string }>>>((acc, row) => {
    if (!acc[row.linkId]) acc[row.linkId] = [];
    acc[row.linkId].push({ id: row.id, name: row.name, color: row.color });
    return acc;
  }, {});

  res.json(links.map((link) => ({ ...serializeLink(link), tags: tagsByLinkId[link.id] ?? [] })));
});

router.post("/links", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation error", message: parsed.error.message });
    return;
  }

  const workspaceId = req.session.workspaceId!;
  const { destinationUrl, title, expiresAt } = parsed.data;
  let slug = parsed.data.slug;

  // SECURITY: Validate destination URL is safe (http/https only)
  try {
    const urlObj = new URL(destinationUrl);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      res.status(400).json({ error: "Validation error", message: "Destination URL must be http or https" });
      return;
    }
  } catch {
    res.status(400).json({ error: "Validation error", message: "Invalid destination URL" });
    return;
  }

  if (!slug) {
    slug = nanoid(7);
  } else {
    // Normalize and validate slug
    slug = slug.trim().toLowerCase();

    // Only allow alphanumeric, dashes, and underscores
    if (!/^[a-z0-9_-]+$/.test(slug)) {
      res.status(400).json({
        error: "Validation error",
        message: "Slug can only contain letters, numbers, dashes, and underscores",
      });
      return;
    }

    // Check slug length
    if (slug.length < 2 || slug.length > 255) {
      res.status(400).json({
        error: "Validation error",
        message: "Slug must be between 2 and 255 characters",
      });
      return;
    }

    // Reject reserved slugs
    const reservedSlugs = ["admin", "api", "r", "app", "login", "logout", "register", "signup"];
    if (reservedSlugs.includes(slug)) {
      res.status(400).json({
        error: "Validation error",
        message: `The slug "${slug}" is reserved and cannot be used`,
      });
      return;
    }
  }

  const body = req.body as Record<string, unknown>;

  // SECURITY: Validate optional fields with additional constraints
  let password: string | null = null;
  if (body.password && typeof body.password === "string") {
    if (body.password.length < 4) {
      res.status(400).json({ error: "Validation error", message: "Password must be at least 4 characters" });
      return;
    }
    if (body.password.length > 255) {
      res.status(400).json({ error: "Validation error", message: "Password must be at most 255 characters" });
      return;
    }
    password = body.password;
  }

  const passwordHash = password ? await bcrypt.hash(password, 10) : null;
  const clickLimit = typeof body.clickLimit === "number" ? body.clickLimit : null;

  // SECURITY: Validate fallbackUrl is a valid URL if provided
  let fallbackUrl: string | null = null;
  if (body.fallbackUrl && typeof body.fallbackUrl === "string") {
    try {
      const url = new URL(body.fallbackUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        res.status(400).json({ error: "Validation error", message: "Fallback URL must be http or https" });
        return;
      }
      fallbackUrl = body.fallbackUrl;
    } catch {
      res.status(400).json({ error: "Validation error", message: "Fallback URL is not a valid URL" });
      return;
    }
  }

  const folderId = typeof body.folderId === "string" && body.folderId ? body.folderId : null;
  const isCloakedVal = typeof body.isCloaked === "boolean" ? body.isCloaked : false;
  const hideReferrerVal = typeof body.hideReferrer === "boolean" ? body.hideReferrer : false;

  let iosDeepLink: string | null = null;
  if (body.iosDeepLink && typeof body.iosDeepLink === "string") {
    iosDeepLink = body.iosDeepLink;
  }
  let androidDeepLink: string | null = null;
  if (body.androidDeepLink && typeof body.androidDeepLink === "string") {
    androidDeepLink = body.androidDeepLink;
  }

  // Require a verified custom domain for every link
  if (!body.domainId || typeof body.domainId !== "string") {
    res.status(400).json({
      error: "Validation error",
      message: "A verified custom domain is required. snipr.sh cannot be used as a URL shortener.",
    });
    return;
  }

  const [domainRecord] = await db
    .select({ id: domainsTable.id })
    .from(domainsTable)
    .where(and(
      eq(domainsTable.id, body.domainId),
      eq(domainsTable.verified, true),
      or(
        eq(domainsTable.workspaceId, workspaceId),
        eq(domainsTable.isPlatformDomain, true)
      )
    ));

  if (!domainRecord) {
    res.status(400).json({
      error: "Validation error",
      message: "Invalid or unverified domain. Domain must belong to your workspace and be verified.",
    });
    return;
  }

  const domainId = domainRecord.id;

  let link;
  try {
    const result = await db
      .insert(linksTable)
      .values({
        workspaceId,
        slug,
        destinationUrl,
        title: title ?? null,
        expiresAt: expiresAt ?? null,
        passwordHash,
        clickLimit,
        fallbackUrl,
        folderId,
        domainId,
        isCloaked: isCloakedVal,
        hideReferrer: hideReferrerVal,
        iosDeepLink,
        androidDeepLink,
      })
      .returning();

    link = result[0];
  } catch (error) {
    // Handle unique constraint violation (slug + domain already exists)
    if (error instanceof Error && "code" in error) {
      const pgError = error as any;
      if (pgError.code === "23505" && pgError.constraint?.includes("unique")) {
        const domainInfo = domainId ? " on this domain" : "";
        res.status(409).json({ error: "Slug already taken", message: `The slug "${slug}" is already in use${domainInfo}.` });
        return;
      }
    }

    // Re-throw other database errors
    throw error;
  }

  const tagIds = Array.isArray(body.tagIds) ? (body.tagIds as string[]) : [];
  if (tagIds.length > 0) {
    await db.insert(linkTagsTable).values(tagIds.map((tagId) => ({ linkId: link.id, tagId })));
  }

  // Clear any stale negative cache entry for this slug
  invalidateLinkCache(link.slug);
  res.status(201).json(serializeLink(link));
});

router.get("/links/clicks", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;

  const links = await db
    .select({ id: linksTable.id })
    .from(linksTable)
    .where(eq(linksTable.workspaceId, workspaceId));

  if (links.length === 0) {
    res.json({});
    return;
  }

  const linkIds = links.map((l) => l.id);

  const clicks = await db
    .select({ linkId: clickEventsTable.linkId, total: count() })
    .from(clickEventsTable)
    .where(inArray(clickEventsTable.linkId, linkIds))
    .groupBy(clickEventsTable.linkId);

  const result: Record<string, number> = {};
  for (const row of clicks) {
    result[row.linkId] = Number(row.total);
  }

  res.json(result);
});

// GET /api/links/sparklines — 7-day daily click counts per link
// IMPORTANT: must be registered BEFORE /links/:id to avoid route shadowing
router.get("/links/sparklines", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const links = await db
    .select({ id: linksTable.id })
    .from(linksTable)
    .where(eq(linksTable.workspaceId, workspaceId));

  if (links.length === 0) {
    res.json({});
    return;
  }

  const linkIds = links.map((l) => l.id);

  const rows = await db
    .select({
      linkId: clickEventsTable.linkId,
      day: sql<string>`to_char(date_trunc('day', ${clickEventsTable.timestamp}), 'YYYY-MM-DD')`,
      clicks: count(),
    })
    .from(clickEventsTable)
    .where(and(inArray(clickEventsTable.linkId, linkIds), gte(clickEventsTable.timestamp, fromDate)))
    .groupBy(clickEventsTable.linkId, sql`date_trunc('day', ${clickEventsTable.timestamp})`);

  const topCountryRows = await db
    .select({
      linkId: clickEventsTable.linkId,
      country: clickEventsTable.country,
      cnt: count(),
    })
    .from(clickEventsTable)
    .where(and(inArray(clickEventsTable.linkId, linkIds), gte(clickEventsTable.timestamp, fromDate)))
    .groupBy(clickEventsTable.linkId, clickEventsTable.country)
    .orderBy(sql`count(*) desc`);

  const topCountries: Record<string, string | null> = {};
  for (const r of topCountryRows) {
    if (!topCountries[r.linkId] && r.country) {
      topCountries[r.linkId] = r.country;
    }
  }

  const byLink: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    if (!byLink[row.linkId]) byLink[row.linkId] = {};
    byLink[row.linkId][row.day] = Number(row.clicks);
  }

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(fromDate.getTime() + i * 24 * 60 * 60 * 1000);
    return d.toISOString().split("T")[0];
  });

  const result: Record<string, { sparkline: number[]; topCountry: string | null }> = {};
  for (const linkId of linkIds) {
    const dayMap = byLink[linkId] ?? {};
    result[linkId] = {
      sparkline: last7Days.map((d) => dayMap[d] ?? 0),
      topCountry: topCountries[linkId] ?? null,
    };
  }

  res.json(result);
});

// POST /api/links/bulk — bulk operations on multiple links
// IMPORTANT: must be registered BEFORE /links/:id to avoid route shadowing
router.post("/links/bulk", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const body = req.body as { action: string; ids: string[] };
  const { action, ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids required" });
    return;
  }

  if (!["enable", "disable", "delete", "move", "tag"].includes(action)) {
    res.status(400).json({ error: "action must be enable, disable, delete, move, or tag" });
    return;
  }

  if (action === "tag") {
    const { tagIds: tagIdList = [] } = body as { action: string; ids: string[]; tagIds?: string[] };
    if (!Array.isArray(tagIdList) || tagIdList.length === 0) {
      res.status(400).json({ error: "tagIds required for tag action" });
      return;
    }
    const ownedLinksForTag = await db
      .select({ id: linksTable.id })
      .from(linksTable)
      .where(and(inArray(linksTable.id, ids), eq(linksTable.workspaceId, workspaceId)));
    const ownedIdsForTag = ownedLinksForTag.map((l) => l.id);
    if (ownedIdsForTag.length === 0) {
      res.status(404).json({ error: "No matching links found" });
      return;
    }
    const ownedTags = await db
      .select({ id: tagsTable.id })
      .from(tagsTable)
      .where(and(inArray(tagsTable.id, tagIdList), eq(tagsTable.workspaceId, workspaceId)));
    const ownedTagIds = ownedTags.map((t) => t.id);
    if (ownedTagIds.length > 0) {
      const pairs = ownedIdsForTag.flatMap((linkId) =>
        ownedTagIds.map((tagId) => ({ linkId, tagId }))
      );
      await db.insert(linkTagsTable).values(pairs).onConflictDoNothing();
    }
    res.json({ affected: ownedIdsForTag.length });
    return;
  }

  if (action === "move") {
    const folderId = (body as { action: string; ids: string[]; folderId?: string | null }).folderId ?? null;
    if (folderId !== null) {
      const [folder] = await db
        .select({ id: foldersTable.id })
        .from(foldersTable)
        .where(and(eq(foldersTable.id, folderId), eq(foldersTable.workspaceId, workspaceId)));
      if (!folder) {
        res.status(400).json({ error: "Folder not found or does not belong to this workspace" });
        return;
      }
    }
    const ownedLinks2 = await db
      .select({ id: linksTable.id })
      .from(linksTable)
      .where(and(inArray(linksTable.id, ids), eq(linksTable.workspaceId, workspaceId)));
    const ownedIds2 = ownedLinks2.map((l) => l.id);
    if (ownedIds2.length === 0) {
      res.status(404).json({ error: "No matching links found" });
      return;
    }
    await db.update(linksTable).set({ folderId }).where(inArray(linksTable.id, ownedIds2));
    res.json({ affected: ownedIds2.length });
    return;
  }

  const ownedLinks = await db
    .select({ id: linksTable.id, slug: linksTable.slug })
    .from(linksTable)
    .where(and(inArray(linksTable.id, ids), eq(linksTable.workspaceId, workspaceId)));

  const ownedIds = ownedLinks.map((l) => l.id);
  if (ownedIds.length === 0) {
    res.status(404).json({ error: "No matching links found" });
    return;
  }

  if (action === "delete") {
    await db.delete(linksTable).where(inArray(linksTable.id, ownedIds));
    for (const l of ownedLinks) invalidateLinkCache(l.slug);
    res.json({ affected: ownedIds.length });
    return;
  }

  const enabled = action === "enable";
  const updated = await db
    .update(linksTable)
    .set({ enabled })
    .where(inArray(linksTable.id, ownedIds))
    .returning({ slug: linksTable.slug });

  for (const l of updated) invalidateLinkCache(l.slug);
  res.json({ affected: ownedIds.length });
});

router.get("/links/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetLinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const workspaceId = req.session.workspaceId!;

  const [link] = await db
    .select()
    .from(linksTable)
    .where(and(eq(linksTable.id, params.data.id), eq(linksTable.workspaceId, workspaceId)));

  if (!link) {
    res.status(404).json({ error: "Not found", message: "Link not found." });
    return;
  }

  res.json(serializeLink(link));
});

router.put("/links/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateLinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const parsed = UpdateLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation error", message: parsed.error.message });
    return;
  }

  const workspaceId = req.session.workspaceId!;

  const [existing] = await db
    .select()
    .from(linksTable)
    .where(and(eq(linksTable.id, params.data.id), eq(linksTable.workspaceId, workspaceId)));

  if (!existing) {
    res.status(404).json({ error: "Not found", message: "Link not found." });
    return;
  }

  const updateData: Partial<typeof linksTable.$inferInsert> = {};
  const body = req.body as Record<string, unknown>;

  if (parsed.data.destinationUrl !== undefined && parsed.data.destinationUrl !== null) {
    updateData.destinationUrl = parsed.data.destinationUrl;
  }
  if (parsed.data.title !== undefined) {
    updateData.title = parsed.data.title ?? null;
  }
  if (parsed.data.enabled !== undefined && parsed.data.enabled !== null) {
    updateData.enabled = parsed.data.enabled;
  }
  if (parsed.data.expiresAt !== undefined) {
    updateData.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  }
  if (parsed.data.slug !== undefined && parsed.data.slug !== null) {
    const newSlug = parsed.data.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    if (newSlug !== existing.slug) {
      // SUBDOMAIN SUPPORT: Check slug conflict scoped to workspace and domain
      const [slugConflict] = await db
        .select()
        .from(linksTable)
        .where(and(
          eq(linksTable.slug, newSlug),
          eq(linksTable.workspaceId, workspaceId),
          eq(linksTable.domainId, existing.domainId)
        ));
      if (slugConflict) {
        const domainInfo = existing.domainId ? " on this domain" : "";
        res.status(409).json({ error: "Slug taken", message: `The slug "${newSlug}" is already in use${domainInfo}.` });
        return;
      }
      updateData.slug = newSlug;
    }
  }

  if ("password" in body) {
    const pw = body.password;
    if (pw === null || pw === "") {
      updateData.passwordHash = null;
    } else if (typeof pw === "string" && pw.length > 0) {
      updateData.passwordHash = await bcrypt.hash(pw, 10);
    }
  }

  if ("clickLimit" in body) {
    updateData.clickLimit = typeof body.clickLimit === "number" ? body.clickLimit : null;
  }
  if ("fallbackUrl" in body) {
    updateData.fallbackUrl = typeof body.fallbackUrl === "string" && body.fallbackUrl ? body.fallbackUrl : null;
  }
  if ("folderId" in body) {
    updateData.folderId = typeof body.folderId === "string" && body.folderId ? body.folderId : null;
  }
  if ("isCloaked" in body) {
    updateData.isCloaked = typeof body.isCloaked === "boolean" ? body.isCloaked : false;
  }
  if ("hideReferrer" in body) {
    updateData.hideReferrer = typeof body.hideReferrer === "boolean" ? body.hideReferrer : false;
  }
  if ("iosDeepLink" in body) {
    updateData.iosDeepLink = typeof body.iosDeepLink === "string" && body.iosDeepLink ? body.iosDeepLink : null;
  }
  if ("androidDeepLink" in body) {
    updateData.androidDeepLink = typeof body.androidDeepLink === "string" && body.androidDeepLink ? body.androidDeepLink : null;
  }

  // Require a verified custom domain — cannot clear domainId
  if ("domainId" in body) {
    if (body.domainId === null || body.domainId === "") {
      res.status(400).json({
        error: "Validation error",
        message: "A verified custom domain is required. You cannot remove the domain from a link.",
      });
      return;
    } else if (typeof body.domainId === "string") {
      // Validate that new domain belongs to this workspace (or is a platform domain) and is verified
      const [newDomain] = await db
        .select({ id: domainsTable.id })
        .from(domainsTable)
        .where(and(
          eq(domainsTable.id, body.domainId),
          eq(domainsTable.verified, true),
          or(
            eq(domainsTable.workspaceId, workspaceId),
            eq(domainsTable.isPlatformDomain, true)
          )
        ));

      if (!newDomain) {
        res.status(400).json({
          error: "Validation error",
          message: "Invalid or unverified domain. Domain must belong to your workspace and be verified.",
        });
        return;
      }
      updateData.domainId = newDomain.id;
    }
  }

  if ("tagIds" in body && Array.isArray(body.tagIds)) {
    const tagIds = body.tagIds as string[];
    await db.delete(linkTagsTable).where(eq(linkTagsTable.linkId, params.data.id));
    if (tagIds.length > 0) {
      await db.insert(linkTagsTable).values(tagIds.map((tagId) => ({ linkId: params.data.id, tagId })));
    }
  }

  const [updated] = await db
    .update(linksTable)
    .set(updateData)
    .where(eq(linksTable.id, params.data.id))
    .returning();

  // Invalidate the link cache so future redirects see the new state immediately
  invalidateLinkCache(existing.slug);
  if (updated.slug !== existing.slug) {
    invalidateLinkCache(updated.slug);
  }

  res.json(serializeLink(updated));
});

router.delete("/links/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteLinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const workspaceId = req.session.workspaceId!;

  const [link] = await db
    .select()
    .from(linksTable)
    .where(and(eq(linksTable.id, params.data.id), eq(linksTable.workspaceId, workspaceId)));

  if (!link) {
    res.status(404).json({ error: "Not found", message: "Link not found." });
    return;
  }

  await db.delete(linksTable).where(eq(linksTable.id, params.data.id));

  invalidateLinkCache(link.slug);
  res.json({ message: "Link deleted" });
});

router.get("/links/:id/qr", requireAuth, async (req, res): Promise<void> => {
  const params = GetLinkQrParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const workspaceId = req.session.workspaceId!;

  const [link] = await db
    .select()
    .from(linksTable)
    .where(and(eq(linksTable.id, params.data.id), eq(linksTable.workspaceId, workspaceId)));

  if (!link) {
    res.status(404).json({ error: "Not found", message: "Link not found." });
    return;
  }

  // Build the short URL — use custom domain if link has one, otherwise use FRONTEND_URL
  let shortUrl: string;
  if (link.domainId) {
    const [domain] = await db
      .select({ domain: domainsTable.domain })
      .from(domainsTable)
      .where(eq(domainsTable.id, link.domainId));
    shortUrl = domain ? `https://${domain.domain}/${link.slug}` : `${process.env.FRONTEND_URL || "https://snipr.sh"}/r/${link.slug}`;
  } else {
    shortUrl = `${process.env.FRONTEND_URL || "https://snipr.sh"}/r/${link.slug}`;
  }

  const svg = await QRCode.toString(`${shortUrl}?qr=1`, { type: "svg" });

  res.json({ svg, shortUrl });
});

// POST /api/links/:id/duplicate — duplicate a link with a new slug
router.post("/links/:id/duplicate", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;

  const [link] = await db
    .select()
    .from(linksTable)
    .where(and(eq(linksTable.id, id), eq(linksTable.workspaceId, workspaceId)));

  if (!link) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Require a verified custom domain — cannot duplicate a domain-less link
  if (!link.domainId) {
    res.status(400).json({
      error: "Validation error",
      message: "Cannot duplicate this link because it has no custom domain assigned.",
    });
    return;
  }

  // Verify domain still belongs to this workspace and is verified
  const [domainCheck] = await db
    .select({ id: domainsTable.id })
    .from(domainsTable)
    .where(and(
      eq(domainsTable.id, link.domainId),
      eq(domainsTable.workspaceId, workspaceId),
      eq(domainsTable.verified, true)
    ));

  if (!domainCheck) {
    res.status(400).json({
      error: "Validation error",
      message: "The domain associated with this link is no longer valid or verified.",
    });
    return;
  }

  const newSlug = nanoid(7);

  const [duped] = await db
    .insert(linksTable)
    .values({
      workspaceId,
      slug: newSlug,
      destinationUrl: link.destinationUrl,
      title: link.title ? `${link.title} (copy)` : null,
      expiresAt: link.expiresAt,
      passwordHash: link.passwordHash,
      clickLimit: link.clickLimit,
      fallbackUrl: link.fallbackUrl,
      folderId: link.folderId,
      domainId: link.domainId,
      isCloaked: link.isCloaked,
      hideReferrer: link.hideReferrer,
      iosDeepLink: link.iosDeepLink,
      androidDeepLink: link.androidDeepLink,
    })
    .returning();

  res.status(201).json(serializeLink(duped));
});

export default router;
