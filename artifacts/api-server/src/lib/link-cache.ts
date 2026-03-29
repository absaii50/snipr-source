import { db, linksTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";

const CACHE_TTL_MS = 30_000;
const CACHE_MAX_SIZE = 10_000;

interface CachedLink {
  link: typeof linksTable.$inferSelect;
  fetchedAt: number;
}

const cache = new Map<string, CachedLink>();

function evictOldest(): void {
  const firstKey = cache.keys().next().value;
  if (firstKey !== undefined) {
    cache.delete(firstKey);
  }
}

/**
 * Generate cache key including domainId for subdomain support
 * SUBDOMAIN SUPPORT: Key format includes domain to allow same slug on different domains
 */
function getCacheKey(slug: string, domainId?: string | null): string {
  return domainId ? `${domainId}:${slug}` : `default:${slug}`;
}

/**
 * Get link from cache, scoped by domain
 * SUBDOMAIN SUPPORT: Lookup includes domainId to distinguish links on different domains
 */
export async function getLinkBySlug(slug: string, domainId?: string | null): Promise<typeof linksTable.$inferSelect | null> {
  const now = Date.now();
  const cacheKey = getCacheKey(slug, domainId);
  const hit = cache.get(cacheKey);
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.link;
  }

  // Query database with domain scope.
  // When domainId is provided, match exactly. When absent, match any link with
  // that slug (fallback for /r/:slug path when no custom-domain routing applies).
  const [link] = await db
    .select()
    .from(linksTable)
    .where(domainId
      ? and(eq(linksTable.slug, slug), eq(linksTable.domainId, domainId))
      : eq(linksTable.slug, slug)
    );

  if (link) {
    if (cache.size >= CACHE_MAX_SIZE) {
      evictOldest();
    }
    cache.set(cacheKey, { link, fetchedAt: now });
  } else {
    cache.delete(cacheKey);
  }
  return link ?? null;
}

/**
 * Invalidate cache for a specific link
 * SUBDOMAIN SUPPORT: Invalidate by slug and domain to affect only the right link
 */
export function invalidateLinkCache(slug: string, domainId?: string | null): void {
  const cacheKey = getCacheKey(slug, domainId);
  cache.delete(cacheKey);
}
