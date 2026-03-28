import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, workspaceMembersTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

const VALID_ROLES = ["owner", "admin", "member", "viewer"] as const;

router.get("/team", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;

  const members = await db
    .select({
      id: workspaceMembersTable.id,
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

  res.status(201).json(member);
});

router.put("/team/members/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const role = body.role as string;

  if (!VALID_ROLES.includes(role as any)) {
    res.status(400).json({ error: "Invalid role" });
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

  const [updated] = await db
    .update(workspaceMembersTable)
    .set({ role })
    .where(eq(workspaceMembersTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/team/members/:id", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.session.workspaceId!;
  const { id } = req.params;

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

  await db
    .delete(workspaceMembersTable)
    .where(eq(workspaceMembersTable.id, id));

  res.json({ message: "Member removed" });
});

export default router;
