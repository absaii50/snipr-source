import { db, platformSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const DB_KEY_MAP: Record<string, string> = {
  LEMONSQUEEZY_API_KEY:          "ls_api_key",
  LEMONSQUEEZY_STORE_ID:         "ls_store_id",
  LEMONSQUEEZY_WEBHOOK_SECRET:   "ls_webhook_secret",
  LEMONSQUEEZY_PRO_VARIANT_ID:   "ls_pro_variant_id",
  LEMONSQUEEZY_BUSINESS_VARIANT_ID: "ls_business_variant_id",
};

const _cache: Record<string, string | null> = {};
const _cacheTime: Record<string, number> = {};
const CACHE_TTL = 60_000;

export async function getConfig(envKey: string): Promise<string | null> {
  if (process.env[envKey]) return process.env[envKey]!;

  const dbKey = DB_KEY_MAP[envKey];
  if (!dbKey) return null;

  const now = Date.now();
  if (_cache[dbKey] !== undefined && now - (_cacheTime[dbKey] ?? 0) < CACHE_TTL) {
    return _cache[dbKey];
  }

  try {
    const [row] = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, dbKey));
    const value = row?.value ?? null;
    _cache[dbKey] = value;
    _cacheTime[dbKey] = now;
    return value;
  } catch {
    return null;
  }
}

export function invalidateConfigCache(dbKey?: string) {
  if (dbKey) {
    delete _cache[dbKey];
    delete _cacheTime[dbKey];
  } else {
    Object.keys(_cache).forEach((k) => {
      delete _cache[k];
      delete _cacheTime[k];
    });
  }
}
