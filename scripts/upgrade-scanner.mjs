#!/usr/bin/env node
// scripts/upgrade-scanner.mjs
//
// Monthly free-plan allowance scanner.
// When a user on the Free (or Starter) plan crosses CLICK_THRESHOLD clicks
// in the last 30 days, they receive one plan-upgrade email.
// Cooldown prevents re-sending for the same user more than once per 30 days.
//
// Usage:
//   node scripts/upgrade-scanner.mjs          # live send
//   node scripts/upgrade-scanner.mjs --dry    # report only, no sends
//
// Cron (every 6 hours):
//   15 */6 * * * /usr/bin/node /var/www/snipr/scripts/upgrade-scanner.mjs >> /var/log/snipr-upgrade-scanner.log 2>&1

import { readFileSync } from "fs";
import pgLib from "/var/www/snipr/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
const { Client } = pgLib;
import { Resend } from "/var/www/snipr/node_modules/.pnpm/resend@6.9.4/node_modules/resend/dist/index.mjs";

/* ───────────── Config ───────────── */
const CLICK_THRESHOLD = 10_000;
const COOLDOWN_DAYS   = 30;             // don't email the same user more than once per 30d
const LOOKBACK_HOURS  = 24 * 30;        // 30-day rolling window
const ELIGIBLE_PLANS  = ["free", "starter"];
const DRY_RUN         = process.argv.includes("--dry");

/* ───────────── Env ───────────── */
const envFile = readFileSync("/var/www/snipr/.env", "utf-8");
const env = Object.fromEntries(
  envFile
    .split(/\r?\n/)
    .filter((l) => l.match(/^[A-Z_]+=/))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")]; })
);
const FRONTEND_URL = env.FRONTEND_URL || "https://snipr.sh";
const FROM_EMAIL   = env.FROM_EMAIL   || "Snipr <no-reply@snipr.sh>";

/* ───────────── Email Template ───────────── */
const BRAND = {
  primary: "#728DA7", dark: "#0A0A0A", light: "#F4F4F6",
  text: "#3A3A3E", muted: "#8888A0", white: "#FFFFFF",
};
const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const button  = (text, url) => `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:24px 0 8px;"><a href="${url}" style="display:inline-block;background:${BRAND.dark};color:${BRAND.white};font-weight:600;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;letter-spacing:-0.2px;">${text}</a></td></tr></table>`;
const layout  = (content) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Snipr</title></head>
<body style="margin:0;padding:0;background-color:${BRAND.light};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BRAND.light};padding:40px 20px;"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">
  <tr><td align="center" style="padding-bottom:24px;"><div style="display:inline-block;background:${BRAND.dark};color:white;font-weight:800;font-size:20px;letter-spacing:-0.5px;padding:10px 20px;border-radius:12px;">snipr</div></td></tr>
  <tr><td style="background:${BRAND.white};border-radius:16px;padding:40px;border:1px solid #E4E4EC;">${content}</td></tr>
  <tr><td align="center" style="padding-top:24px;"><p style="color:${BRAND.muted};font-size:12px;margin:0;line-height:1.5;">Snipr &mdash; AI-Powered Link Intelligence<br><a href="https://snipr.sh" style="color:${BRAND.primary};text-decoration:none;">snipr.sh</a></p></td></tr>
</table></td></tr></table></body></html>`;

function renderMonthlyCapEmail({ userName, monthlyClicks, uniqueVisitors, peakPerMinute, linkSlugs, currentPlan }) {
  const planLabel = currentPlan === "free" ? "Free" : "Starter";
  const billingUrl = `${FRONTEND_URL}/billing`;
  const supportUrl = `${FRONTEND_URL}/support`;

  return layout(`
    <div style="display:inline-block;background:#F3E8FF;color:#6B21A8;font-size:10px;font-weight:700;letter-spacing:0.08em;padding:4px 10px;border-radius:999px;text-transform:uppercase;margin-bottom:12px;">Monthly Limit Reached</div>
    <h1 style="color:${BRAND.dark};font-size:22px;font-weight:700;margin:0 0 8px;letter-spacing:-0.3px;line-height:1.3;">You've hit your ${escHtml(planLabel)}-plan monthly limit — time to upgrade</h1>
    <p style="color:${BRAND.text};font-size:15px;line-height:1.6;margin:0 0 4px;">Hi ${escHtml(userName)},</p>
    <p style="color:${BRAND.text};font-size:14px;line-height:1.7;margin:0 0 16px;">
      Congrats — your Snipr links have crossed <strong>${monthlyClicks.toLocaleString()} clicks</strong> in the last 30 days, past the ${CLICK_THRESHOLD.toLocaleString()}-click allowance included in the ${escHtml(planLabel)} plan. Upgrade to keep your links running without limits.
    </p>

    <div style="background:${BRAND.light};border-radius:12px;padding:16px;margin-bottom:16px;border-left:3px solid ${BRAND.primary};">
      <p style="color:${BRAND.muted};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 10px;">Your activity this month</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr><td style="padding:4px 0;color:${BRAND.text};font-size:13px;">Total clicks (last 30 days)</td><td style="padding:4px 0;color:${BRAND.dark};font-size:13px;font-weight:700;text-align:right;">${monthlyClicks.toLocaleString()}</td></tr>
        <tr><td style="padding:4px 0;color:${BRAND.text};font-size:13px;">Unique visitors</td><td style="padding:4px 0;color:${BRAND.dark};font-size:13px;font-weight:700;text-align:right;">${uniqueVisitors.toLocaleString()}</td></tr>
        <tr><td style="padding:4px 0;color:${BRAND.text};font-size:13px;">Peak throughput</td><td style="padding:4px 0;color:${BRAND.dark};font-size:13px;font-weight:700;text-align:right;">${peakPerMinute.toLocaleString()} / min</td></tr>
        <tr><td style="padding:4px 0;color:${BRAND.text};font-size:13px;">Current plan</td><td style="padding:4px 0;color:${BRAND.dark};font-size:13px;font-weight:700;text-align:right;">${escHtml(planLabel)} &middot; ${CLICK_THRESHOLD.toLocaleString()} clicks/mo</td></tr>
        <tr><td style="padding:4px 0;color:${BRAND.text};font-size:13px;vertical-align:top;">Top links</td><td style="padding:4px 0;color:${BRAND.dark};font-size:13px;font-weight:700;text-align:right;">${linkSlugs.length ? linkSlugs.map((s) => `<code style="background:#fff;border:1px solid #E4E4EC;border-radius:4px;padding:1px 6px;font-family:monospace;font-size:12px;">/${escHtml(s)}</code>`).join(" ") : "—"}</td></tr>
      </table>
    </div>

    <p style="color:${BRAND.text};font-size:14px;line-height:1.7;margin:0 0 8px;font-weight:600;">What you unlock with a paid plan</p>
    <ul style="color:${BRAND.text};font-size:14px;line-height:1.8;margin:0 0 16px;padding-left:22px;">
      <li>Much higher monthly click allowance — up to unlimited on Business</li>
      <li>Unlimited links with full-fidelity analytics and UTM tracking</li>
      <li>Custom domains (bring your own, or pick from our portfolio)</li>
      <li>Smart routing rules, QR codes, A/B splits, and pixel integrations</li>
      <li>Priority support and 30+ days of click history retention</li>
    </ul>

    ${button("Upgrade My Plan", billingUrl)}

    <p style="color:${BRAND.muted};font-size:12px;line-height:1.6;margin:20px 0 0;text-align:center;">Not sure which plan fits? <a href="${supportUrl}" style="color:${BRAND.primary};text-decoration:none;">Open a support ticket</a> and our team will help you pick the right tier.</p>
  `);
}

/* ───────────── Main ───────────── */
const pg = new Client({ connectionString: env.DATABASE_URL });
await pg.connect();
const resend = new Resend(env.RESEND_API_KEY);

console.log(`[${new Date().toISOString()}] upgrade-scanner starting  threshold=${CLICK_THRESHOLD}  window=30d  cooldown=${COOLDOWN_DAYS}d  dry=${DRY_RUN}`);

const { rows: candidates } = await pg.query(
  `WITH user_stats AS (
     SELECT u.id, u.name, u.email, u.plan,
       COUNT(ce.id)::int AS clicks_30d,
       COUNT(DISTINCT ce.ip_hash)::int AS uniques_30d
     FROM users u
     JOIN workspaces w ON w.user_id = u.id
     JOIN links l ON l.workspace_id = w.id
     JOIN click_events ce ON ce.link_id = l.id
     WHERE u.plan = ANY($1::text[])
       AND u.suspended_at IS NULL
       AND u.email_verified = true
       AND ce.timestamp > NOW() - ($2 || ' hours')::interval
     GROUP BY u.id, u.name, u.email, u.plan
     HAVING COUNT(ce.id) >= $3
   ),
   recent_sends AS (
     SELECT user_id FROM email_logs
     WHERE (type = 'upgrade_monthly_cap' OR type LIKE 'abuse_warning%')
       AND status = 'sent'
       AND created_at > NOW() - ($4 || ' days')::interval
       AND user_id IS NOT NULL
   )
   SELECT us.id, us.name, us.email, us.plan, us.clicks_30d, us.uniques_30d,
     COALESCE(
       (SELECT array_agg(slug_ordered.slug)
        FROM (
          SELECT l.slug
          FROM links l
          JOIN workspaces w ON w.id = l.workspace_id
          WHERE w.user_id = us.id AND l.enabled = true
          ORDER BY (SELECT COUNT(*) FROM click_events WHERE link_id = l.id) DESC
          LIMIT 5
        ) slug_ordered), ARRAY[]::text[]
     ) AS slugs
   FROM user_stats us
   WHERE us.id NOT IN (SELECT user_id FROM recent_sends)
   ORDER BY us.clicks_30d DESC`,
  [ELIGIBLE_PLANS, String(LOOKBACK_HOURS), CLICK_THRESHOLD, String(COOLDOWN_DAYS)]
);

console.log(`  found ${candidates.length} eligible user(s)`);

for (const u of candidates) {
  const { rows: peakRows } = await pg.query(
    `SELECT COUNT(*)::int AS cnt
     FROM click_events ce
     JOIN links l ON l.id = ce.link_id
     JOIN workspaces w ON w.id = l.workspace_id
     WHERE w.user_id = $1 AND ce.timestamp > NOW() - INTERVAL '30 days'
     GROUP BY date_trunc('minute', ce.timestamp)
     ORDER BY cnt DESC LIMIT 1`,
    [u.id]
  );
  const peakPerMinute = peakRows[0]?.cnt ?? 0;
  const linkSlugs = (u.slugs ?? []).slice(0, 5);

  const html = renderMonthlyCapEmail({
    userName: u.name || u.email.split("@")[0],
    monthlyClicks: u.clicks_30d,
    uniqueVisitors: u.uniques_30d,
    peakPerMinute,
    linkSlugs,
    currentPlan: u.plan,
  });
  const planLabel = u.plan === "free" ? "Free" : "Starter";
  const subject = `You've hit your Snipr ${planLabel}-plan monthly limit — time to upgrade`;

  if (DRY_RUN) {
    console.log(`  [DRY] ${u.email}  plan=${u.plan}  clicks_30d=${u.clicks_30d}  uniques=${u.uniques_30d}  peak/min=${peakPerMinute}`);
    continue;
  }

  let status = "sent", resendId = null, errMsg = null;
  try {
    const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to: u.email, subject, html });
    if (error) { status = "failed"; errMsg = error.message; }
    else       { resendId = data?.id ?? null; }
  } catch (e) {
    status = "failed"; errMsg = String(e?.message ?? e);
  }

  await pg.query(
    `INSERT INTO email_logs (user_id, "to", subject, type, resend_id, status, error) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [u.id, u.email, subject, "upgrade_monthly_cap", resendId, status, errMsg]
  );
  console.log(`  [${u.email}]  plan=${u.plan}  clicks_30d=${u.clicks_30d}  uniques=${u.uniques_30d}  peak/min=${peakPerMinute}  →  ${status}${errMsg ? "  error=" + errMsg : ""}`);
}

await pg.end();
console.log(`[${new Date().toISOString()}] upgrade-scanner done`);
