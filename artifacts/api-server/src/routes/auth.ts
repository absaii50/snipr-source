import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq, and, gt, inArray } from "drizzle-orm";
import geoip from "geoip-lite";
import { db, usersTable, workspacesTable, workspaceMembersTable } from "@workspace/db";
import {
  RegisterBody,
  LoginBody,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation error", message: parsed.error.message });
    return;
  }

  const { name, email, password } = parsed.data;

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));

  if (existing.length > 0) {
    res.status(409).json({ error: "Email already taken", message: "An account with this email already exists." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const emailVerificationToken = crypto.randomUUID();

  const [user] = await db
    .insert(usersTable)
    .values({ name, email: email.toLowerCase(), passwordHash, emailVerificationToken })
    .returning();

  const workspaceSlug = email.toLowerCase().split("@")[0].replace(/[^a-z0-9]/g, "-") + "-" + Date.now();
  const [workspace] = await db
    .insert(workspacesTable)
    .values({ name: `${name}'s Workspace`, slug: workspaceSlug, userId: user.id })
    .returning();

  await db.insert(workspaceMembersTable).values({
    workspaceId: workspace.id,
    userId: user.id,
    email: user.email,
    role: "owner",
    status: "active",
    joinedAt: new Date(),
  });

  // Auto-accept any pending invitations for this email
  await db
    .update(workspaceMembersTable)
    .set({ status: "active", userId: user.id, joinedAt: new Date(), inviteToken: null })
    .where(
      and(
        eq(workspaceMembersTable.email, user.email),
        eq(workspaceMembersTable.status, "invited")
      )
    );

  // Send verification email (non-blocking)
  sendVerificationEmail({
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerificationToken,
  }).catch((err) => logger.error({ err }, "Failed to send verification email"));

  req.session.userId = user.id;
  req.session.workspaceId = workspace.id;

  req.session.save((err) => {
    if (err) {
      logger.error({ err }, "Failed to save session after register");
      res.status(500).json({ error: "Session error" });
      return;
    }
    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt },
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
    });
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation error", message: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));

  if (!user) {
    res.status(401).json({ error: "Invalid credentials", message: "Incorrect email or password." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials", message: "Incorrect email or password." });
    return;
  }

  if (user.suspendedAt) {
    res.status(403).json({ error: "Account suspended", message: "Your account has been suspended. Please contact support." });
    return;
  }

  const [workspace] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.userId, user.id));

  if (!workspace) {
    res.status(500).json({ error: "Server error", message: "No workspace found for user." });
    return;
  }

  req.session.userId = user.id;
  req.session.workspaceId = workspace.id;

  req.session.save((err) => {
    if (err) {
      logger.error({ err }, "Failed to save session after login");
      res.status(500).json({ error: "Session error" });
      return;
    }
    res.json({
      user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt },
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
    });
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!));

  if (!user || user.suspendedAt) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [workspace] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.userId, user.id));

  res.json({
    user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt },
    workspace: workspace
      ? { id: workspace.id, name: workspace.name, slug: workspace.slug }
      : null,
  });
});

/* ── User Context (IP-based geo + greeting) ────────────────────── */

const COUNTRY_NAMES: Record<string, string> = {
  US:"United States", GB:"United Kingdom", DE:"Germany", FR:"France",
  NL:"Netherlands", IT:"Italy", VN:"Vietnam", CA:"Canada", AU:"Australia",
  JP:"Japan", CN:"China", KR:"South Korea", BR:"Brazil", MX:"Mexico",
  IN:"India", ES:"Spain", PL:"Poland", SE:"Sweden", NO:"Norway",
  DK:"Denmark", FI:"Finland", CH:"Switzerland", AT:"Austria", BE:"Belgium",
  PT:"Portugal", CZ:"Czech Republic", TR:"Turkey", RU:"Russia", UA:"Ukraine",
  PK:"Pakistan", BD:"Bangladesh", NG:"Nigeria", ZA:"South Africa", EG:"Egypt",
  AR:"Argentina", CL:"Chile", CO:"Colombia", ID:"Indonesia", TH:"Thailand",
  MY:"Malaysia", SG:"Singapore", PH:"Philippines", HK:"Hong Kong", TW:"Taiwan",
  NZ:"New Zealand", IE:"Ireland", IL:"Israel", AE:"UAE", SA:"Saudi Arabia",
  GR:"Greece", RO:"Romania", HU:"Hungary", SK:"Slovakia", HR:"Croatia",
};

function getGreeting(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getRealIpFromReq(req: import("express").Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? "";
}

router.get("/auth/context", requireAuth, async (req, res): Promise<void> => {
  const ip = getRealIpFromReq(req);
  const geo = geoip.lookup(ip);

  const timezone = geo?.timezone || "UTC";
  const country = geo?.country || null;
  const city = geo?.city || null;
  const countryName = country ? (COUNTRY_NAMES[country] || country) : null;

  let localDate: Date;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const get = (t: string) => parts.find(p => p.type === t)?.value || "0";
    localDate = new Date(
      parseInt(get("year")),
      parseInt(get("month")) - 1,
      parseInt(get("day")),
      parseInt(get("hour")),
      parseInt(get("minute")),
      parseInt(get("second"))
    );
  } catch {
    localDate = new Date();
  }

  const hour = localDate.getHours();
  const greeting = getGreeting(hour);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateFormatted = `${dayNames[localDate.getDay()]}, ${monthNames[localDate.getMonth()]} ${localDate.getDate()}`;

  const localTimeFormatted = localDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  res.json({
    greeting,
    dateFormatted,
    localTime: localTimeFormatted,
    timezone,
    country,
    countryName,
    city,
    ip: ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.$2.***.$4"),
  });
});

/* ── Email Verification ──────────────────────────────────────────── */
async function handleVerifyEmail(req: import("express").Request, res: import("express").Response): Promise<void> {
  const token = (req.body?.token || req.query.token) as string;
  if (!token) {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.emailVerificationToken, token));

  if (!user) {
    res.status(404).json({ error: "Invalid or expired verification token" });
    return;
  }

  if (user.emailVerified) {
    res.json({ ok: true, message: "Email already verified" });
    return;
  }

  // Verification tokens expire after 24 hours (based on when token was last set via updatedAt)
  const tokenAge = Date.now() - new Date(user.updatedAt).getTime();
  const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
  if (tokenAge > TOKEN_EXPIRY_MS) {
    res.status(410).json({ error: "Verification link has expired. Please request a new one from the dashboard." });
    return;
  }

  await db
    .update(usersTable)
    .set({ emailVerified: true, emailVerificationToken: null })
    .where(eq(usersTable.id, user.id));

  // Send welcome email (non-blocking)
  sendWelcomeEmail({
    id: user.id,
    name: user.name,
    email: user.email,
  }).catch((err) => logger.error({ err }, "Failed to send welcome email"));

  res.json({ ok: true, message: "Email verified successfully" });
}

// Support both GET (old email links) and POST (new frontend) for backward compat
router.get("/auth/verify-email", handleVerifyEmail);
router.post("/auth/verify-email", handleVerifyEmail);

router.post("/auth/resend-verification", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.emailVerified) {
    res.json({ ok: true, message: "Email already verified" });
    return;
  }

  const newToken = crypto.randomUUID();
  await db
    .update(usersTable)
    .set({ emailVerificationToken: newToken })
    .where(eq(usersTable.id, user.id));

  await sendVerificationEmail({
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerificationToken: newToken,
  });

  res.json({ ok: true, message: "Verification email sent" });
});

/* ── Forgot Password ────────────────────────────────────────── */
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()));

  if (!user) {
    res.json({ ok: true, message: "If an account exists with this email, a reset link has been sent." });
    return;
  }

  const resetToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await db
    .update(usersTable)
    .set({ passwordResetToken: resetToken, passwordResetExpiresAt: expiresAt })
    .where(eq(usersTable.id, user.id));

  sendPasswordResetEmail({
    id: user.id,
    name: user.name,
    email: user.email,
    passwordResetToken: resetToken,
  }).catch((err) => logger.error({ err }, "Failed to send password reset email"));

  res.json({ ok: true, message: "If an account exists with this email, a reset link has been sent." });
});

/* ── Reset Password ─────────────────────────────────────────── */
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body;

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Reset token is required" });
    return;
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const newHash = await bcrypt.hash(password, 10);

  const updated = await db
    .update(usersTable)
    .set({ passwordHash: newHash, passwordResetToken: null, passwordResetExpiresAt: null })
    .where(
      and(
        eq(usersTable.passwordResetToken, token),
        gt(usersTable.passwordResetExpiresAt, new Date())
      )
    )
    .returning({ id: usersTable.id });

  if (updated.length === 0) {
    res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
    return;
  }

  res.json({ ok: true, message: "Password has been reset successfully. You can now sign in." });
});

/* ── Profile Update ──────────────────────────────────────────── */
router.patch("/auth/profile", requireAuth, async (req, res): Promise<void> => {
  const { name, email } = req.body;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const updates: Partial<{ name: string; email: string; emailVerified: boolean; emailVerificationToken: string | null }> = {};

  if (name && name.trim() && name.trim() !== user.name) {
    updates.name = name.trim();
  }

  if (email && email.trim().toLowerCase() !== user.email) {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.trim().toLowerCase()));

    if (existing.length > 0) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    updates.email = email.trim().toLowerCase();
    updates.emailVerified = false;
    updates.emailVerificationToken = crypto.randomUUID();
  }

  if (Object.keys(updates).length === 0) {
    res.json({ ok: true, message: "No changes" });
    return;
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id));

  if (updates.emailVerificationToken) {
    sendVerificationEmail({
      id: user.id,
      name: updates.name || user.name,
      email: updates.email!,
      emailVerificationToken: updates.emailVerificationToken,
    }).catch((err) => logger.error({ err }, "Failed to send verification email after email change"));
  }

  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  const [workspace] = await db.select().from(workspacesTable).where(eq(workspacesTable.userId, user.id));

  res.json({
    user: { id: updated.id, name: updated.name, email: updated.email, emailVerified: updated.emailVerified, createdAt: updated.createdAt },
    workspace: workspace ? { id: workspace.id, name: workspace.name, slug: workspace.slug } : null,
  });
});

/* ── Change Password ─────────────────────────────────────────── */
router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current password and new password are required" });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));

  res.json({ ok: true, message: "Password changed successfully" });
});

/* ── Delete Account ──────────────────────────────────────────── */
router.delete("/auth/account", requireAuth, async (req, res): Promise<void> => {
  const { password } = req.body;

  if (!password) {
    res.status(400).json({ error: "Password is required to delete account" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Password is incorrect" });
    return;
  }

  // Clean up workspace members for this user's workspaces
  const userWorkspaces = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(eq(workspacesTable.userId, user.id));

  if (userWorkspaces.length > 0) {
    const wsIds = userWorkspaces.map((w) => w.id);
    await db.delete(workspaceMembersTable).where(
      inArray(workspaceMembersTable.workspaceId, wsIds)
    );
  }

  // Also remove this user from any workspaces they were invited to
  await db.delete(workspaceMembersTable).where(eq(workspaceMembersTable.userId, user.id));

  await db.delete(workspacesTable).where(eq(workspacesTable.userId, user.id));
  await db.delete(usersTable).where(eq(usersTable.id, user.id));

  req.session.destroy(() => {
    res.json({ ok: true, message: "Account deleted" });
  });
});

export default router;
