import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, workspaceMembersTable, usersTable, workspacesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { sendTeamInviteExistingUser, sendTeamInviteNewUser } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const VALID_ROLES = ["owner", "admin", "member", "viewer"] as const;

router.get("/team", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;

  const members = await db
    .select({
      id: workspaceMembersTable.id,
      userId: workspaceMembersTable.userId,
      email: workspaceMembersTable.email,
      role: workspaceMembersTable.role,
      status: workspaceMembersTable.status,
      invitedAt: workspaceMembersTable.invitedAt,
      joinedAt: workspaceMembersTable.joinedAt,
      name: usersTable.name,
    })
    .from(workspaceMembersTable)
    .leftJoin(usersTable, eq(workspaceMembersTable.userId, usersTable.id))
    .where(eq(workspaceMembersTable.workspaceId, workspaceId))
    .orderBy(workspaceMembersTable.createdAt);

  res.json(members);
});

router.post("/team/invite", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const inviterUserId = req.session.userId!;
  const body = req.body as Record<string, unknown>;

  const email = (body.email as string)?.toLowerCase().trim();
  const role = (body.role as string) ?? "member";

  if (!email) {
    res.status(400).json({ error: "Email required" });
    return;
  }
  if (!VALID_ROLES.includes(role as any)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  const existing = await db
    .select()
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        eq(workspaceMembersTable.email, email)
      )
    );

  if (existing.length > 0) {
    res.status(409).json({ error: "Member already invited or in workspace" });
    return;
  }

  // Get inviter name + workspace name for the email
  const [inviter] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, inviterUserId));
  const [workspace] = await db.select({ name: workspacesTable.name }).from(workspacesTable).where(eq(workspacesTable.id, workspaceId));
  const inviterName = inviter?.name ?? "Someone";
  const workspaceName = workspace?.name ?? "a workspace";

  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  const inviteToken = nanoid(32);

  const [member] = await db
    .insert(workspaceMembersTable)
    .values({
      workspaceId,
      userId: user[0]?.id ?? null,
      email,
      role,
      status: user[0] ? "active" : "invited",
      inviteToken,
      joinedAt: user[0] ? new Date() : null,
    })
    .returning();

  // Send invitation email (non-blocking)
  if (user[0]) {
    // Existing user — email + they're already active
    sendTeamInviteExistingUser({
      to: email,
      userId: user[0].id,
      inviterName,
      workspaceName,
      role,
    }).catch((err) => logger.error({ err }, "Failed to send team invite email to existing user"));
  } else {
    // New user — email with signup link containing invite token
    sendTeamInviteNewUser({
      to: email,
      inviterName,
      workspaceName,
      role,
      inviteToken,
    }).catch((err) => logger.error({ err }, "Failed to send team invite email to new user"));
  }

  res.status(201).json(member);
});

/* ── Accept Invitation (for existing users clicking from email) ── */
router.post("/team/accept-invite", requireAuth, async (req, res): Promise<void> => {
  const { token } = req.body as { token?: string };
  const userId = req.session.userId!;

  if (!token) {
    res.status(400).json({ error: "Invite token is required" });
    return;
  }

  const [invite] = await db
    .select()
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.inviteToken, token));

  if (!invite) {
    res.status(404).json({ error: "Invalid or expired invitation" });
    return;
  }

  if (invite.status === "active") {
    res.json({ message: "Invitation already accepted", workspaceId: invite.workspaceId });
    return;
  }

  // Verify the logged-in user's email matches the invitation
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.email !== invite.email) {
    res.status(403).json({ error: "This invitation was sent to a different email address" });
    return;
  }

  await db
    .update(workspaceMembersTable)
    .set({ status: "active", userId, joinedAt: new Date(), inviteToken: null })
    .where(eq(workspaceMembersTable.id, invite.id));

  res.json({ message: "Invitation accepted", workspaceId: invite.workspaceId });
});

/* ── Get invite details by token (public, no auth) ── */
router.get("/team/invite/:token", async (req, res): Promise<void> => {
  const { token } = req.params;

  const [invite] = await db
    .select({
      id: workspaceMembersTable.id,
      email: workspaceMembersTable.email,
      role: workspaceMembersTable.role,
      status: workspaceMembersTable.status,
      workspaceId: workspaceMembersTable.workspaceId,
    })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.inviteToken, token));

  if (!invite) {
    res.status(404).json({ error: "Invalid or expired invitation" });
    return;
  }

  const [workspace] = await db
    .select({ name: workspacesTable.name })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, invite.workspaceId));

  res.json({
    email: invite.email,
    role: invite.role,
    status: invite.status,
    workspaceName: workspace?.name ?? "Unknown workspace",
  });
});

router.put("/team/members/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const userId = req.session.userId!;
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const role = body.role as string;

  if (!VALID_ROLES.includes(role as any)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  // SECURITY: Only owners and admins can change roles
  const [requester] = await db
    .select({ role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        eq(workspaceMembersTable.userId, userId)
      )
    );

  if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
    res.status(403).json({ error: "Only owners and admins can change member roles" });
    return;
  }

  // SECURITY: Only owners can promote to owner or admin
  if ((role === "owner" || role === "admin") && requester.role !== "owner") {
    res.status(403).json({ error: "Only the workspace owner can assign owner or admin roles" });
    return;
  }

  const [member] = await db
    .select()
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.id, id),
        eq(workspaceMembersTable.workspaceId, workspaceId)
      )
    );

  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  // SECURITY: Cannot change the owner's role
  if (member.role === "owner" && member.userId !== userId) {
    res.status(403).json({ error: "Cannot change the workspace owner's role" });
    return;
  }

  const [updated] = await db
    .update(workspaceMembersTable)
    .set({ role })
    .where(eq(workspaceMembersTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/team/members/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const userId = req.session.userId!;
  const { id } = req.params;

  // SECURITY: Only owners and admins can remove members
  const [requester] = await db
    .select({ role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        eq(workspaceMembersTable.userId, userId)
      )
    );

  if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
    res.status(403).json({ error: "Only owners and admins can remove members" });
    return;
  }

  const [member] = await db
    .select()
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.id, id),
        eq(workspaceMembersTable.workspaceId, workspaceId)
      )
    );

  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  // SECURITY: Cannot remove the workspace owner
  if (member.role === "owner") {
    res.status(403).json({ error: "Cannot remove the workspace owner" });
    return;
  }

  await db
    .delete(workspaceMembersTable)
    .where(eq(workspaceMembersTable.id, id));

  res.json({ message: "Member removed" });
});

export default router;
