import { Resend } from "resend";
import { db, emailLogsTable } from "@workspace/db";
import { logger } from "./logger";
import { getVerificationEmailHtml, getWelcomeEmailHtml, getPasswordResetEmailHtml, getTeamInviteExistingUserHtml, getTeamInviteNewUserHtml } from "./email-templates";

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
