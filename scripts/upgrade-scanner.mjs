#!/usr/bin/env node
// scripts/upgrade-scanner.mjs
//
// Plan-aware monthly allowance scanner.
// For every paying-or-free tier below Enterprise, if a user exceeds the
// monthly click allowance of their CURRENT plan in a rolling 30-day window,
// send them a single email recommending the NEXT tier up.
//
// Tier ladder:
//   free       10K     → starter
//   starter    1M      → growth
//   growth     5M      → pro
//   pro        25M     → business
//   business   100M    → enterprise
//   enterprise unlimited (no email)
//
// Cooldown: one email per 30 days per user, also respecting legacy
// abuse_warning_* emails so no double-nudging.
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

/* ───────────── Plan ladder ─────────────
 * Mirrors artifacts/snipr/src/views/Pricing.tsx. Keep in sync when prices/caps change.
 */
const PLAN_LADDER = {
  free: {
    label: "Free",
    monthlyClicks: 10_000,
    next: "starter",
    nextLabel: "Starter",
    nextPrice: "$4/mo",
    nextClicks: "1M clicks/month",
    nextHighlights: [
      "100× your current allowance (1M clicks/month)",
      "1 custom domain",
      "Geo &amp; device analytics",
      "Link expiry, scheduling, password protection",
      "Folders &amp; tags for organising your links",
    ],
  },
  starter: {
    label: "Starter",
    monthlyClicks: 1_000_000,
    next: "growth",
    nextLabel: "Growth",
    nextPrice: "$12/mo",
    nextClicks: "5M clicks/month",
    nextHighlights: [
      "5× your current allowance (5M clicks/month)",
      "3 custom domains (up from 1)",
      "Link cloaking &amp; geo/device routing rules",
      "UTM builder",
      "AI-powered insights",
    ],
  },
  growth: {
    label: "Growth",
    monthlyClicks: 5_000_000,
    next: "pro",
    nextLabel: "Pro",
    nextPrice: "$29/mo",
    nextClicks: "25M clicks/month",
    nextHighlights: [
      "5× your current allowance (25M clicks/month)",
      "10 custom domains",
      "Conversion &amp; revenue tracking",
      "Pixel integrations (Meta, Google, TikTok)",
      "Advanced link rules (city, OS, language) + priority support",
    ],
  },
  pro: {
    label: "Pro",
    monthlyClicks: 25_000_000,
    next: "business",
    nextLabel: "Business",
    nextPrice: "$79/mo",
    nextClicks: "100M clicks/month",
    nextHighlights: [
      "4× your current allowance (100M clicks/month)",
      "Unlimited custom domains",
      "Team workspaces &amp; role-based access",
      "Webhook &amp; Zapier integrations + full API access",
      "Dedicated support",
    ],
  },
  business: {
    label: "Business",
    monthlyClicks: 100_000_000,
    next: "enterprise",
    nextLabel: "Enterprise",
    nextPrice: "$149/mo",
    nextClicks: "Unlimited clicks",
    nextHighlights: [
      "Unlimited clicks, domains, and workspaces",
      "Custom AI reporting",
      "SLA &amp; uptime guarantee",
      "Custom onboarding",
      "24/7 dedicated support",
    ],
  },
  // enterprise: already top tier, no upgrade email
};

/* ───────────── Config ───────────── */
const COOLDOWN_DAYS = 30;
const LOOKBACK_HOURS = 24 * 30;
const REMINDER_AFTER_HOURS = 48;    // send reminder email (email #2) this many hours after email #1
const ENFORCEMENT_DELAY_DAYS = 3;   // flag links this many days after email #1 if user still over cap
const DRY_RUN = process.argv.includes("--dry");

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

/* ───────────── Email template ───────────── */
const BRAND = { primary: "#728DA7", dark: "#0A0A0A", light: "#F4F4F6", text: "#3A3A3E", muted: "#8888A0", white: "#FFFFFF" };
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

function renderEmail({ userName, monthlyClicks, uniqueVisitors, peakPerMinute, linkSlugs, tier }) {
  const billingUrl = `${FRONTEND_URL}/billing`;
  const supportUrl = `${FRONTEND_URL}/support`;
  const currentCapStr = tier.monthlyClicks.toLocaleString();

  return layout(`
    <div style="display:inline-block;background:#F3E8FF;color:#6B21A8;font-size:10px;font-weight:700;letter-spacing:0.08em;padding:4px 10px;border-radius:999px;text-transform:uppercase;margin-bottom:12px;">Monthly Limit Reached</div>
    <h1 style="color:${BRAND.dark};font-size:22px;font-weight:700;margin:0 0 8px;letter-spacing:-0.3px;line-height:1.3;">You've hit your ${escHtml(tier.label)}-plan monthly limit — upgrade to ${escHtml(tier.nextLabel)}</h1>
    <p style="color:${BRAND.text};font-size:15px;line-height:1.6;margin:0 0 4px;">Hi ${escHtml(userName)},</p>
    <p style="color:${BRAND.text};font-size:14px;line-height:1.7;margin:0 0 16px;">
      Your Snipr links have crossed <strong>${monthlyClicks.toLocaleString()} clicks</strong> in the last 30 days — past the ${currentCapStr}-click allowance included in the ${escHtml(tier.label)} plan. Upgrading to <strong>${escHtml(tier.nextLabel)} (${escHtml(tier.nextPrice)})</strong> keeps your links running without throttling and gives you <strong>${escHtml(tier.nextClicks)}</strong>.
    </p>

    <div style="background:${BRAND.light};border-radius:12px;padding:16px;margin-bottom:16px;border-left:3px solid ${BRAND.primary};">
      <p style="color:${BRAND.muted};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 10px;">Your activity this month</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr><td style="padding:4px 0;color:${BRAND.text};font-size:13px;">Total clicks (last 30 days)</td><td style="padding:4px 0;color:${BRAND.dark};font-size:13px;font-weight:700;text-align:right;">${monthlyClicks.toLocaleString()}</td></tr>
        <tr><td style="padding:4px 0;color:${BRAND.text};font-size:13px;">Unique visitors</td><td style="padding:4px 0;color:${BRAND.dark};font-size:13px;font-weight:700;text-align:right;">${uniqueVisitors.toLocaleString()}</td></tr>
        <tr><td style="padding:4px 0;color:${BRAND.text};font-size:13px;">Peak throughput</td><td style="padding:4px 0;color:${BRAND.dark};font-size:13px;font-weight:700;text-align:right;">${peakPerMinute.toLocaleString()} / min</td></tr>
        <tr><td style="padding:4px 0;color:${BRAND.text};font-size:13px;">Current plan</td><td style="padding:4px 0;color:${BRAND.dark};font-size:13px;font-weight:700;text-align:right;">${escHtml(tier.label)} &middot; ${currentCapStr} clicks/mo</td></tr>
        <tr><td style="padding:4px 0;color:${BRAND.text};font-size:13px;vertical-align:top;">Top links</td><td style="padding:4px 0;color:${BRAND.dark};font-size:13px;font-weight:700;text-align:right;">${linkSlugs.length ? linkSlugs.map((s) => `<code style="background:#fff;border:1px solid #E4E4EC;border-radius:4px;padding:1px 6px;font-family:monospace;font-size:12px;">/${escHtml(s)}</code>`).join(" ") : "—"}</td></tr>
      </table>
    </div>

    <p style="color:${BRAND.text};font-size:14px;line-height:1.7;margin:0 0 8px;font-weight:600;">What you unlock on ${escHtml(tier.nextLabel)}</p>
    <ul style="color:${BRAND.text};font-size:14px;line-height:1.8;margin:0 0 16px;padding-left:22px;">
      ${tier.nextHighlights.map((h) => `<li>${h}</li>`).join("")}
    </ul>

    ${button(`Upgrade to ${escHtml(tier.nextLabel)}`, billingUrl)}

    <p style="color:${BRAND.muted};font-size:12px;line-height:1.6;margin:20px 0 0;text-align:center;">Not sure which plan fits? <a href="${supportUrl}" style="color:${BRAND.primary};text-decoration:none;">Open a support ticket</a> and our team will help you pick the right tier.</p>
  `);
}

/* ───────────── Main ───────────── */
const pg = new Client({ connectionString: env.DATABASE_URL });
await pg.connect();
const resend = new Resend(env.RESEND_API_KEY);

console.log(`[${new Date().toISOString()}] upgrade-scanner starting  window=30d  cooldown=${COOLDOWN_DAYS}d  dry=${DRY_RUN}`);

// We query each tier independently so the threshold matches the user's plan.
let totalFound = 0;
for (const [planKey, tier] of Object.entries(PLAN_LADDER)) {
  const { rows: candidates } = await pg.query(
    `WITH user_stats AS (
       SELECT u.id, u.name, u.email, u.plan,
         COUNT(ce.id)::bigint AS clicks_30d,
         COUNT(DISTINCT ce.ip_hash)::int AS uniques_30d
       FROM users u
       JOIN workspaces w ON w.user_id = u.id
       JOIN links l ON l.workspace_id = w.id
       JOIN click_events ce ON ce.link_id = l.id
       WHERE u.plan = $1
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
    [planKey, String(LOOKBACK_HOURS), tier.monthlyClicks, String(COOLDOWN_DAYS)]
  );

  if (candidates.length === 0) continue;
  console.log(`  ${planKey} (cap ${tier.monthlyClicks.toLocaleString()}): ${candidates.length} candidate(s)`);
  totalFound += candidates.length;

  for (const u of candidates) {
    const clicks30d = Number(u.clicks_30d);
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

    const html = renderEmail({
      userName: u.name || u.email.split("@")[0],
      monthlyClicks: clicks30d,
      uniqueVisitors: u.uniques_30d,
      peakPerMinute,
      linkSlugs,
      tier,
    });
    const subject = `You've hit your Snipr ${tier.label}-plan monthly limit — upgrade to ${tier.nextLabel}`;

    if (DRY_RUN) {
      console.log(`    [DRY] ${u.email}  plan=${u.plan}  clicks_30d=${clicks30d.toLocaleString()}  uniques=${u.uniques_30d}  peak/min=${peakPerMinute}  → would suggest ${tier.nextLabel}`);
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
    console.log(`    [${u.email}]  plan=${u.plan}  clicks_30d=${clicks30d.toLocaleString()}  → suggest ${tier.nextLabel}  → ${status}${errMsg ? "  error=" + errMsg : ""}`);
  }
}

/* ───────────── Pass 1b: Send reminder email (email #2) at 48h ───────────── */
function renderReminderEmail({ userName, currentPlanLabel, nextPlanLabel, nextPlanPrice, monthlyClicks, currentCap, hoursUntilThrottle }) {
  const billingUrl = `${FRONTEND_URL}/billing`;
  const dashboardUrl = `${FRONTEND_URL}/links`;
  const supportUrl = `${FRONTEND_URL}/support`;
  return layout(`
    <div style="display:inline-block;background:#FEF2F2;color:#B91C1C;font-size:10px;font-weight:700;letter-spacing:0.08em;padding:4px 10px;border-radius:999px;text-transform:uppercase;margin-bottom:12px;">⚠ Final Notice</div>
    <h1 style="color:${BRAND.dark};font-size:22px;font-weight:700;margin:0 0 8px;letter-spacing:-0.3px;line-height:1.3;">Your links will be throttled in ${hoursUntilThrottle} hours</h1>
    <p style="color:${BRAND.text};font-size:15px;line-height:1.6;margin:0 0 4px;">Hi ${escHtml(userName)},</p>
    <p style="color:${BRAND.text};font-size:14px;line-height:1.7;margin:0 0 16px;">Two days ago we let you know you'd exceeded your ${escHtml(currentPlanLabel)}-plan monthly click allowance. Your account is still over the limit, and your links will be automatically throttled in approximately <strong>${hoursUntilThrottle} hours</strong> unless you upgrade.</p>
    <div style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:12px;padding:16px;margin-bottom:16px;">
      <p style="color:#B91C1C;font-size:13px;font-weight:700;margin:0 0 8px;">Here's what will happen if you don't upgrade</p>
      <ul style="color:#78350F;font-size:13px;line-height:1.7;margin:0;padding-left:20px;">
        <li>Anyone clicking your short links will see a "Link temporarily unavailable" page</li>
        <li>Redirects will stop working until you upgrade</li>
        <li>Your link analytics and click history stay intact — nothing is lost</li>
        <li>The moment you upgrade, everything resumes automatically</li>
      </ul>
    </div>
    <div style="background:${BRAND.light};border-radius:12px;padding:16px;margin-bottom:16px;border-left:3px solid ${BRAND.primary};">
      <p style="color:${BRAND.muted};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 10px;">Your current usage</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr><td style="padding:4px 0;color:${BRAND.text};font-size:13px;">Clicks used (last 30 days)</td><td style="padding:4px 0;color:${BRAND.dark};font-size:13px;font-weight:700;text-align:right;">${monthlyClicks.toLocaleString()}</td></tr>
        <tr><td style="padding:4px 0;color:${BRAND.text};font-size:13px;">${escHtml(currentPlanLabel)} plan allowance</td><td style="padding:4px 0;color:${BRAND.dark};font-size:13px;font-weight:700;text-align:right;">${currentCap.toLocaleString()}</td></tr>
        <tr><td style="padding:4px 0;color:#B91C1C;font-size:13px;font-weight:700;">Over by</td><td style="padding:4px 0;color:#B91C1C;font-size:13px;font-weight:700;text-align:right;">${(monthlyClicks - currentCap).toLocaleString()}</td></tr>
      </table>
    </div>
    ${button(`Upgrade to ${escHtml(nextPlanLabel)} — ${escHtml(nextPlanPrice)}`, billingUrl)}
    <p style="color:${BRAND.muted};font-size:12px;line-height:1.6;margin:20px 0 0;text-align:center;">Questions? <a href="${supportUrl}" style="color:${BRAND.primary};text-decoration:none;">Open a support ticket</a> — we can help you pick the right plan before the deadline.</p>
  `);
}

let reminderCount = 0;
for (const [planKey, tier] of Object.entries(PLAN_LADDER)) {
  const { rows: reminderCandidates } = await pg.query(
    `WITH first_email AS (
       -- Most recent upgrade email per user
       SELECT DISTINCT ON (el.user_id) el.user_id, el.created_at AS emailed_at
       FROM email_logs el
       WHERE (el.type = 'upgrade_monthly_cap' OR el.type LIKE 'abuse_warning%')
         AND el.status = 'sent'
         AND el.user_id IS NOT NULL
       ORDER BY el.user_id, el.created_at DESC
     ),
     already_reminded AS (
       SELECT user_id FROM email_logs
       WHERE type = 'upgrade_monthly_cap_reminder'
         AND status = 'sent'
         AND user_id IS NOT NULL
         AND created_at > NOW() - INTERVAL '7 days'
     )
     SELECT u.id, u.name, u.email, u.plan, fe.emailed_at,
       (SELECT COUNT(*)::bigint FROM click_events ce
        JOIN links l ON l.id = ce.link_id
        JOIN workspaces w ON w.id = l.workspace_id
        WHERE w.user_id = u.id AND ce.timestamp > NOW() - INTERVAL '30 days'
       ) AS clicks_30d
     FROM users u
     JOIN first_email fe ON fe.user_id = u.id
     WHERE u.plan = $1
       AND u.suspended_at IS NULL
       AND fe.emailed_at <= NOW() - ($2 || ' hours')::interval
       AND fe.emailed_at > NOW() - ($3 || ' days')::interval
       AND u.id NOT IN (SELECT user_id FROM already_reminded)`,
    [planKey, String(REMINDER_AFTER_HOURS), String(ENFORCEMENT_DELAY_DAYS)]
  );

  for (const u of reminderCandidates) {
    const clicks30d = Number(u.clicks_30d);
    if (clicks30d < tier.monthlyClicks) continue;  // no longer over cap, skip

    const hoursUntil = Math.max(1, Math.round(ENFORCEMENT_DELAY_DAYS * 24 - (Date.now() - new Date(u.emailed_at).getTime()) / (1000 * 60 * 60)));
    const html = renderReminderEmail({
      userName: u.name || u.email.split("@")[0],
      currentPlanLabel: tier.label,
      nextPlanLabel: tier.nextLabel,
      nextPlanPrice: tier.nextPrice,
      monthlyClicks: clicks30d,
      currentCap: tier.monthlyClicks,
      hoursUntilThrottle: hoursUntil,
    });
    const subject = `Final notice: Your Snipr links will be throttled in ${hoursUntil} hours — upgrade to ${tier.nextLabel}`;

    if (DRY_RUN) {
      console.log(`    [DRY REMINDER] ${u.email}  plan=${planKey}  clicks=${clicks30d.toLocaleString()}  hours_until_throttle=${hoursUntil}`);
      continue;
    }

    let status = "sent", resendId = null, errMsg = null;
    try {
      const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to: u.email, subject, html });
      if (error) { status = "failed"; errMsg = error.message; }
      else       { resendId = data?.id ?? null; }
    } catch (e) { status = "failed"; errMsg = String(e?.message ?? e); }

    await pg.query(
      `INSERT INTO email_logs (user_id, "to", subject, type, resend_id, status, error) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [u.id, u.email, subject, "upgrade_monthly_cap_reminder", resendId, status, errMsg]
    );
    reminderCount++;
    console.log(`    REMINDER: ${u.email}  plan=${planKey}  ${hoursUntil}h until throttle  →  ${status}${errMsg ? "  error=" + errMsg : ""}`);
  }
}

/* ───────────── Pass 2: Enforcement — flag links 3 days after email ───────────── */
let flaggedCount = 0;
for (const [planKey, tier] of Object.entries(PLAN_LADDER)) {
  // Users who got the email >= 3 days ago, still on this plan, still over cap
  const { rows: offenders } = await pg.query(
    `WITH last_email AS (
       -- Include legacy abuse_warning_* emails so users warned under the old system
       -- also get enforced after the 3-day grace period, not after a 30-day cooldown.
       SELECT DISTINCT ON (el.user_id) el.user_id, el.created_at AS emailed_at
       FROM email_logs el
       WHERE (el.type = 'upgrade_monthly_cap' OR el.type LIKE 'abuse_warning%')
         AND el.status = 'sent'
         AND el.user_id IS NOT NULL
       ORDER BY el.user_id, el.created_at DESC
     )
     SELECT u.id, u.email, le.emailed_at,
       (SELECT COUNT(*)::bigint
        FROM click_events ce
        JOIN links l ON l.id = ce.link_id
        JOIN workspaces w ON w.id = l.workspace_id
        WHERE w.user_id = u.id AND ce.timestamp > NOW() - INTERVAL '30 days'
       ) AS clicks_30d
     FROM users u
     JOIN last_email le ON le.user_id = u.id
     WHERE u.plan = $1
       AND u.suspended_at IS NULL
       AND le.emailed_at <= NOW() - ($2 || ' days')::interval`,
    [planKey, String(ENFORCEMENT_DELAY_DAYS)]
  );

  for (const offender of offenders) {
    if (Number(offender.clicks_30d) < tier.monthlyClicks) continue; // they're under cap, skip

    if (DRY_RUN) {
      console.log(`    [DRY ENFORCE] ${offender.email}  plan=${planKey}  clicks=${Number(offender.clicks_30d).toLocaleString()}  emailed_at=${offender.emailed_at.toISOString()}`);
      continue;
    }
    const reason = `Monthly click limit reached. ${tier.label} plan allows ${tier.monthlyClicks.toLocaleString()} clicks/month. Upgrade to ${tier.nextLabel} to restore access.`;
    const { rowCount } = await pg.query(
      `UPDATE links SET flagged_at = NOW(), flagged_reason = $1
       WHERE workspace_id IN (SELECT id FROM workspaces WHERE user_id = $2)
         AND flagged_at IS NULL
         AND enabled = true`,
      [reason, offender.id]
    );
    if (rowCount > 0) {
      flaggedCount += rowCount;
      console.log(`    ENFORCE: flagged ${rowCount} link(s) for ${offender.email} (plan=${planKey}, ${Number(offender.clicks_30d).toLocaleString()} clicks)`);
    }
  }
}

/* ───────────── Pass 3: Unflag — users who upgraded or dropped under cap ───────────── */
let unflaggedCount = 0;
const { rows: flaggedUsers } = await pg.query(
  `SELECT DISTINCT w.user_id, u.plan, u.email
   FROM links l
   JOIN workspaces w ON w.id = l.workspace_id
   JOIN users u ON u.id = w.user_id
   WHERE l.flagged_at IS NOT NULL
     AND u.suspended_at IS NULL`
);
for (const u of flaggedUsers) {
  const tier = PLAN_LADDER[u.plan];
  // Enterprise = unlimited. If they're on a plan not in the ladder (e.g. enterprise), always unflag.
  const cap = tier?.monthlyClicks ?? Infinity;

  const { rows: [{ count }] } = await pg.query(
    `SELECT COUNT(*)::bigint AS count
     FROM click_events ce
     JOIN links l ON l.id = ce.link_id
     JOIN workspaces w ON w.id = l.workspace_id
     WHERE w.user_id = $1 AND ce.timestamp > NOW() - INTERVAL '30 days'`,
    [u.user_id]
  );

  if (Number(count) < cap) {
    if (DRY_RUN) {
      console.log(`    [DRY UNFLAG] ${u.email}  plan=${u.plan}  clicks=${Number(count).toLocaleString()} < cap=${cap === Infinity ? "∞" : cap.toLocaleString()}`);
      continue;
    }
    const { rowCount } = await pg.query(
      `UPDATE links SET flagged_at = NULL, flagged_reason = NULL
       WHERE workspace_id IN (SELECT id FROM workspaces WHERE user_id = $1)
         AND flagged_at IS NOT NULL`,
      [u.user_id]
    );
    if (rowCount > 0) {
      unflaggedCount += rowCount;
      console.log(`    UNFLAG: restored ${rowCount} link(s) for ${u.email} (plan=${u.plan}, ${Number(count).toLocaleString()} < cap)`);
    }
  }
}

await pg.end();
console.log(`[${new Date().toISOString()}] upgrade-scanner done  emailed=${totalFound}  reminders=${reminderCount}  flagged=${flaggedCount}  unflagged=${unflaggedCount}`);
