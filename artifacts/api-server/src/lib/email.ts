import { Resend } from "resend";
import { db, emailLogsTable } from "@workspace/db";
import { logger } from "./logger";
import { getVerificationEmailHtml, getWelcomeEmailHtml, getPasswordResetEmailHtml, getTeamInviteExistingUserHtml, getTeamInviteNewUserHtml, getSupportNewTicketAdminHtml, getSupportUserReplyAdminHtml, getSupportAdminReplyUserHtml, getAbuseWarningEmailHtml } from "./email-templates";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://snipr.sh";
const FROM_EMAIL = process.env.FROM_EMAIL || "Snipr <no-reply@snipr.sh>";

let resend: Resend | null = null;

if (RESEND_API_KEY && RESEND_API_KEY !== "dev_key") {
  resend = new Resend(RESEND_API_KEY);
  logger.info("Email service initialized with Resend");
} else {
  logger.warn("RESEND_API_KEY not set - emails will be logged but not sent");
}

interface SendEmailOpts {
  to: string;
  subject: string;
  html: string;
  userId?: string;
  type: string;
}

export async function sendEmail(opts: SendEmailOpts): Promise<{ id?: string; error?: string }> {
  const { to, subject, html, userId, type } = opts;

  if (!resend) {
    logger.info({ to, subject, type }, "Email skipped (no API key) - would have sent");
    await db.insert(emailLogsTable).values({
      userId: userId ?? null,
      to,
      subject,
      type,
      status: "skipped",
      error: "RESEND_API_KEY not configured",
    });
    return { error: "Email service not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      logger.error({ error, to, type }, "Failed to send email");
      await db.insert(emailLogsTable).values({
        userId: userId ?? null,
        to,
        subject,
        type,
        status: "failed",
        error: error.message,
      });
      return { error: error.message };
    }

    await db.insert(emailLogsTable).values({
      userId: userId ?? null,
      to,
      subject,
      type,
      resendId: data?.id ?? null,
      status: "sent",
    });

    logger.info({ to, type, resendId: data?.id }, "Email sent successfully");
    return { id: data?.id };
  } catch (err: any) {
    logger.error({ err, to, type }, "Email send exception");
    await db.insert(emailLogsTable).values({
      userId: userId ?? null,
      to,
      subject,
      type,
      status: "failed",
      error: err.message,
    });
    return { error: err.message };
  }
}

export async function sendVerificationEmail(user: {
  id: string;
  name: string;
  email: string;
  emailVerificationToken: string;
}): Promise<{ id?: string; error?: string }> {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${user.emailVerificationToken}`;
  const html = getVerificationEmailHtml(user.name, verifyUrl);

  return sendEmail({
    to: user.email,
    subject: "Verify your email address - Snipr",
    html,
    userId: user.id,
    type: "verification",
  });
}

export async function sendPasswordResetEmail(user: {
  id: string;
  name: string;
  email: string;
  passwordResetToken: string;
}): Promise<void> {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${user.passwordResetToken}`;
  const html = getPasswordResetEmailHtml(user.name, resetUrl);

  await sendEmail({
    to: user.email,
    subject: "Reset your password - Snipr",
    html,
    userId: user.id,
    type: "password_reset",
  });
}

export async function sendWelcomeEmail(user: {
  id: string;
  name: string;
  email: string;
}): Promise<void> {
  const dashboardUrl = `${FRONTEND_URL}/dashboard`;
  const html = getWelcomeEmailHtml(user.name, dashboardUrl);

  await sendEmail({
    to: user.email,
    subject: "Welcome to Snipr! 🎉",
    html,
    userId: user.id,
    type: "welcome",
  });
}

export async function sendTeamInviteExistingUser(opts: {
  to: string;
  userId: string;
  inviterName: string;
  workspaceName: string;
  role: string;
}): Promise<void> {
  const dashboardUrl = `${FRONTEND_URL}/dashboard`;
  const html = getTeamInviteExistingUserHtml(opts.inviterName, opts.workspaceName, opts.role, dashboardUrl);

  await sendEmail({
    to: opts.to,
    subject: `${opts.inviterName} invited you to ${opts.workspaceName} — Snipr`,
    html,
    userId: opts.userId,
    type: "team_invite",
  });
}

export async function sendTeamInviteNewUser(opts: {
  to: string;
  inviterName: string;
  workspaceName: string;
  role: string;
  inviteToken: string;
}): Promise<void> {
  const joinUrl = `${FRONTEND_URL}/join?token=${opts.inviteToken}`;
  const html = getTeamInviteNewUserHtml(opts.inviterName, opts.workspaceName, opts.role, joinUrl);

  await sendEmail({
    to: opts.to,
    subject: `${opts.inviterName} invited you to join Snipr`,
    html,
    type: "team_invite",
  });
}

/* ──────────────────────── Support System emails ──────────────────────── */

const SUPPORT_ADMIN_ADDRESS = process.env.SUPPORT_ADMIN_EMAIL || process.env.FROM_EMAIL?.match(/<([^>]+)>/)?.[1] || "support@snipr.sh";

/** Notify the support team when a user opens a new ticket. */
export async function notifySupportNewTicket(opts: {
  ticketId: string;
  subject: string;
  body: string;
  userName: string;
  userEmail: string;
  priority: string;
}): Promise<void> {
  const ticketUrl = `${FRONTEND_URL}/admin/support?ticket=${opts.ticketId}`;
  const html = getSupportNewTicketAdminHtml({
    subject: opts.subject,
    body: opts.body,
    userName: opts.userName,
    userEmail: opts.userEmail,
    priority: opts.priority,
    ticketUrl,
  });
  await sendEmail({
    to: SUPPORT_ADMIN_ADDRESS,
    subject: `[Snipr Support] New ticket: ${opts.subject}`,
    html,
    type: "support_new_ticket",
  });
}

/** Notify the support team when a user replies on an existing ticket. */
export async function notifySupportUserReply(opts: {
  ticketId: string;
  subject: string;
  body: string;
  userName: string;
  userEmail: string;
}): Promise<void> {
  const ticketUrl = `${FRONTEND_URL}/admin/support?ticket=${opts.ticketId}`;
  const html = getSupportUserReplyAdminHtml({
    subject: opts.subject,
    body: opts.body,
    userName: opts.userName,
    userEmail: opts.userEmail,
    ticketUrl,
  });
  await sendEmail({
    to: SUPPORT_ADMIN_ADDRESS,
    subject: `[Snipr Support] Reply from ${opts.userName}: ${opts.subject}`,
    html,
    type: "support_user_reply",
  });
}

/** Notify the user when admin replies to their ticket. */
export async function notifySupportAdminReply(opts: {
  ticketId: string;
  subject: string;
  body: string;
  userName: string;
  userEmail: string;
}): Promise<void> {
  const ticketUrl = `${FRONTEND_URL}/support/${opts.ticketId}`;
  const html = getSupportAdminReplyUserHtml({
    subject: opts.subject,
    body: opts.body,
    userName: opts.userName,
    ticketUrl,
  });
  await sendEmail({
    to: opts.userEmail,
    subject: `Re: ${opts.subject} — Snipr Support`,
    html,
    type: "support_admin_reply",
  });
}

/** Warn a user about suspicious/automated traffic patterns on their links.
 *  Sent twice (reminderNumber 1 and 2, 24h apart) before automatic flagging. */
export async function sendAbuseWarningEmail(opts: {
  userId: string;
  userName: string;
  userEmail: string;
  reminderNumber: number;
  deadlineHours: number;
  detectedClicks: number;
  uniqueVisitors: number;
  peakPerMinute: number;
  linkSlugs: string[];
}): Promise<{ id?: string; error?: string }> {
  const html = getAbuseWarningEmailHtml({
    userName: opts.userName,
    reminderNumber: opts.reminderNumber,
    deadlineHours: opts.deadlineHours,
    detectedClicks: opts.detectedClicks,
    uniqueVisitors: opts.uniqueVisitors,
    peakPerMinute: opts.peakPerMinute,
    linkSlugs: opts.linkSlugs,
    dashboardUrl: `${FRONTEND_URL}/links`,
    supportUrl: `${FRONTEND_URL}/support`,
  });
  const subject = opts.reminderNumber === 1
    ? "Action required: Unusual traffic detected on your Snipr links"
    : "Final reminder: Unusual traffic still active on your Snipr links";
  return sendEmail({
    to: opts.userEmail,
    subject,
    html,
    userId: opts.userId,
    type: `abuse_warning_${opts.reminderNumber}`,
  });
}
