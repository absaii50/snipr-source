import { db, integrationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export interface ClickPayload {
  linkId: string;
  slug: string;
  destinationUrl: string;
  workspaceId: string;
  country: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  timestamp: string;
  isQr: boolean;
}

async function fireSlack(webhookUrl: string, payload: ClickPayload): Promise<void> {
  const flag = payload.country ? `:flag-${payload.country.toLowerCase()}:` : ":globe_with_meridians:";
  const text = [
    `${flag} *New click on* \`/${payload.slug}\``,
    `→ <${payload.destinationUrl}|${payload.destinationUrl.slice(0, 60)}>`,
    `Device: ${payload.device ?? "unknown"} · Browser: ${payload.browser ?? "unknown"} · Country: ${payload.country ?? "unknown"}`,
    payload.utmCampaign ? `Campaign: \`${payload.utmCampaign}\`` : null,
  ].filter(Boolean).join("\n");

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(5000),
  });
}

async function fireWebhook(webhookUrl: string, secret: string | null, payload: ClickPayload): Promise<void> {
  const body = JSON.stringify({ event: "click", data: payload });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    headers["X-Snipr-Signature"] = Buffer.from(sig).toString("hex");
  }
  await fetch(webhookUrl, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(5000),
  });
}

async function fireZapier(webhookUrl: string, payload: ClickPayload): Promise<void> {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "click",
      slug: payload.slug,
      destination_url: payload.destinationUrl,
      country: payload.country,
      device: payload.device,
      browser: payload.browser,
      referrer: payload.referrer,
      utm_source: payload.utmSource,
      utm_medium: payload.utmMedium,
      utm_campaign: payload.utmCampaign,
      is_qr: payload.isQr,
      timestamp: payload.timestamp,
    }),
    signal: AbortSignal.timeout(5000),
  });
}

async function fireGa4(measurementId: string, apiSecret: string, payload: ClickPayload): Promise<void> {
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
  const eventParams: Record<string, string | boolean | null> = {
    link_slug: payload.slug,
    destination_url: payload.destinationUrl,
    country: payload.country,
    device_type: payload.device,
    browser: payload.browser,
    referrer: payload.referrer,
    is_qr: payload.isQr,
  };
  if (payload.utmSource) eventParams.source = payload.utmSource;
  if (payload.utmMedium) eventParams.medium = payload.utmMedium;
  if (payload.utmCampaign) eventParams.campaign = payload.utmCampaign;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: payload.linkId,
      events: [{ name: "snipr_click", params: eventParams }],
    }),
    signal: AbortSignal.timeout(5000),
  });
}

async function fireSegment(writeKey: string, payload: ClickPayload): Promise<void> {
  const auth = Buffer.from(writeKey + ":").toString("base64");
  await fetch("https://api.segment.io/v1/track", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      userId: payload.workspaceId,
      event: "Link Clicked",
      properties: {
        slug: payload.slug,
        destination_url: payload.destinationUrl,
        country: payload.country,
        device: payload.device,
        browser: payload.browser,
        referrer: payload.referrer,
        utm_source: payload.utmSource,
        utm_medium: payload.utmMedium,
        utm_campaign: payload.utmCampaign,
        is_qr: payload.isQr,
      },
      timestamp: payload.timestamp,
    }),
    signal: AbortSignal.timeout(5000),
  });
}

export async function fireIntegrations(workspaceId: string, payload: ClickPayload): Promise<void> {
  try {
    const integrations = await db
      .select()
      .from(integrationsTable)
      .where(and(eq(integrationsTable.workspaceId, workspaceId), eq(integrationsTable.enabled, true)));

    await Promise.allSettled(
      integrations.map(async (integration) => {
        const cfg = integration.config as Record<string, string>;
        try {
          switch (integration.type) {
            case "slack":
              if (cfg.webhookUrl) await fireSlack(cfg.webhookUrl, payload);
              break;
            case "webhook":
              if (cfg.webhookUrl) await fireWebhook(cfg.webhookUrl, cfg.secret ?? null, payload);
              break;
            case "zapier":
              if (cfg.webhookUrl) await fireZapier(cfg.webhookUrl, payload);
              break;
            case "ga4":
              if (cfg.measurementId && cfg.apiSecret) await fireGa4(cfg.measurementId, cfg.apiSecret, payload);
              break;
            case "segment":
              if (cfg.writeKey) await fireSegment(cfg.writeKey, payload);
              break;
          }
        } catch {
        }
      })
    );
  } catch {
  }
}

export async function testIntegration(integration: { type: string; config: Record<string, string> }, workspaceId: string): Promise<{ ok: boolean; error?: string }> {
  const testPayload: ClickPayload = {
    linkId: "test-link-id",
    slug: "test-link",
    destinationUrl: "https://example.com",
    workspaceId,
    country: "US",
    city: "New York",
    device: "desktop",
    browser: "Chrome",
    os: "macOS",
    referrer: "https://twitter.com",
    utmSource: "twitter",
    utmMedium: "social",
    utmCampaign: "test-campaign",
    timestamp: new Date().toISOString(),
    isQr: false,
  };
  const cfg = integration.config;
  try {
    switch (integration.type) {
      case "slack":
        if (!cfg.webhookUrl) return { ok: false, error: "webhookUrl is required" };
        await fireSlack(cfg.webhookUrl, testPayload);
        break;
      case "webhook":
        if (!cfg.webhookUrl) return { ok: false, error: "webhookUrl is required" };
        await fireWebhook(cfg.webhookUrl, cfg.secret ?? null, testPayload);
        break;
      case "zapier":
        if (!cfg.webhookUrl) return { ok: false, error: "webhookUrl is required" };
        await fireZapier(cfg.webhookUrl, testPayload);
        break;
      case "ga4":
        if (!cfg.measurementId || !cfg.apiSecret) return { ok: false, error: "measurementId and apiSecret are required" };
        await fireGa4(cfg.measurementId, cfg.apiSecret, testPayload);
        break;
      case "segment":
        if (!cfg.writeKey) return { ok: false, error: "writeKey is required" };
        await fireSegment(cfg.writeKey, testPayload);
        break;
      default:
        return { ok: false, error: "Unknown integration type" };
    }
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
