import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, workspacesTable } from "@workspace/db";
import {
  RegisterBody,
  LoginBody,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

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

  const [user] = await db
    .insert(usersTable)
    .values({ name, email: email.toLowerCase(), passwordHash })
    .returning();

  const workspaceSlug = email.toLowerCase().split("@")[0].replace(/[^a-z0-9]/g, "-") + "-" + Date.now();
  const [workspace] = await db
    .insert(workspacesTable)
    .values({ name: `${name}'s Workspace`, slug: workspaceSlug, userId: user.id })
    .returning();

  req.session.userId = user.id;
  req.session.workspaceId = workspace.id;

  res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
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
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
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
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
    workspace: workspace
      ? { id: workspace.id, name: workspace.name, slug: workspace.slug }
      : null,
  });
});

export default router;
