import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, workspacesTable } from "@workspace/db";
import {
  RegisterBody,
  LoginBody,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { sendVerificationEmail, sendWelcomeEmail } from "../lib/email";
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

  // Send verification email (non-blocking)
  sendVerificationEmail({
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerificationToken,
  }).catch((err) => logger.error({ err }, "Failed to send verification email"));

  req.session.userId = user.id;
  req.session.workspaceId = workspace.id;

  res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt },
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
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

  res.json({
    user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt },
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
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

/* ── Email Verification ──────────────────────────────────────────── */
router.get("/auth/verify-email", async (req, res): Promise<void> => {
  const token = req.query.token as string;
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
});

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

export default router;
