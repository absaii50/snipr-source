import { Router, type IRouter } from "express";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  db,
  supportTicketsTable,
  supportMessagesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";
import { notifySupportNewTicket, notifySupportUserReply } from "../lib/email";

const router: IRouter = Router();

const VALID_CATEGORIES = ["bug", "billing", "feature", "technical", "other"] as const;
const VALID_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

function sanitizeString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

/* ───── GET /support/tickets — list current user's tickets ───── */
router.get("/support/tickets", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { status } = req.query as { status?: string };

  const conditions = [eq(supportTicketsTable.userId, userId)];
  if (status && typeof status === "string") {
    conditions.push(eq(supportTicketsTable.status, status));
  }

  const rows = await db
    .select({
      id: supportTicketsTable.id,
      subject: supportTicketsTable.subject,
      category: supportTicketsTable.category,
      priority: supportTicketsTable.priority,
      status: supportTicketsTable.status,
      createdAt: supportTicketsTable.createdAt,
      updatedAt: supportTicketsTable.updatedAt,
      lastAdminReplyAt: supportTicketsTable.lastAdminReplyAt,
      lastUserReplyAt: supportTicketsTable.lastUserReplyAt,
      messageCount: sql<number>`(SELECT count(*) FROM ${supportMessagesTable} WHERE ${supportMessagesTable.ticketId} = ${supportTicketsTable.id})::int`,
    })
    .from(supportTicketsTable)
    .where(and(...conditions))
    .orderBy(desc(supportTicketsTable.updatedAt));

  res.json(rows);
});

/* ───── GET /support/tickets/:id — ticket + messages ───── */
router.get("/support/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const ticketId = req.params.id;

  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, ticketId), eq(supportTicketsTable.userId, userId)));

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const messages = await db
    .select({
      id: supportMessagesTable.id,
      senderType: supportMessagesTable.senderType,
      senderLabel: supportMessagesTable.senderLabel,
      body: supportMessagesTable.body,
      createdAt: supportMessagesTable.createdAt,
    })
    .from(supportMessagesTable)
    .where(and(
      eq(supportMessagesTable.ticketId, ticketId),
      // Users never see admin internal notes
      eq(supportMessagesTable.isInternalNote, "false"),
    ))
    .orderBy(asc(supportMessagesTable.createdAt));

  res.json({ ticket, messages });
});

/* ───── POST /support/tickets — create ticket + first message ───── */
router.post("/support/tickets", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const workspaceId = req.session.workspaceId ?? null;

  const subject = sanitizeString(req.body?.subject, 200);
  const body = sanitizeString(req.body?.body, 8000);
  const rawCategory = typeof req.body?.category === "string" ? req.body.category : "other";
  const rawPriority = typeof req.body?.priority === "string" ? req.body.priority : "normal";

  if (!subject) { res.status(400).json({ error: "Subject is required" }); return; }
  if (!body) { res.status(400).json({ error: "Message body is required" }); return; }

  const category = (VALID_CATEGORIES as readonly string[]).includes(rawCategory) ? rawCategory : "other";
  const priority = (VALID_PRIORITIES as readonly string[]).includes(rawPriority) ? rawPriority : "normal";

  const [ticket] = await db
    .insert(supportTicketsTable)
    .values({
      userId,
      workspaceId,
      subject,
      category,
      priority,
      status: "open",
      lastUserReplyAt: new Date(),
    })
    .returning();

  await db.insert(supportMessagesTable).values({
    ticketId: ticket.id,
    senderType: "user",
    senderUserId: userId,
    body,
  });

  // Fetch user for email
  const [user] = await db
    .select({ name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (user) {
    notifySupportNewTicket({ ticketId: ticket.id, subject, body, userName: user.name, userEmail: user.email, priority })
      .catch((err) => logger.error({ err }, "Failed to send new-ticket notification"));
  }

  res.status(201).json(ticket);
});

/* ───── POST /support/tickets/:id/messages — user reply ───── */
router.post("/support/tickets/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const ticketId = req.params.id;
  const body = sanitizeString(req.body?.body, 8000);
  if (!body) { res.status(400).json({ error: "Message body is required" }); return; }

  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, ticketId), eq(supportTicketsTable.userId, userId)));

  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  if (ticket.status === "closed") { res.status(400).json({ error: "This ticket is closed. Open a new one if you need help." }); return; }

  const [message] = await db
    .insert(supportMessagesTable)
    .values({ ticketId, senderType: "user", senderUserId: userId, body })
    .returning();

  // Reopen if resolved, mark user has replied
  const nextStatus = ticket.status === "resolved" ? "open" : ticket.status;
  await db
    .update(supportTicketsTable)
    .set({ status: nextStatus, lastUserReplyAt: new Date() })
    .where(eq(supportTicketsTable.id, ticketId));

  // Notify admin
  const [user] = await db
    .select({ name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (user) {
    notifySupportUserReply({ ticketId, subject: ticket.subject, body, userName: user.name, userEmail: user.email })
      .catch((err) => logger.error({ err }, "Failed to send user-reply notification"));
  }

  res.status(201).json(message);
});

/* ───── PATCH /support/tickets/:id — user close own ticket ───── */
router.patch("/support/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const ticketId = req.params.id;
  const action = req.body?.action;

  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, ticketId), eq(supportTicketsTable.userId, userId)));

  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  if (action === "close") {
    await db
      .update(supportTicketsTable)
      .set({ status: "closed", closedAt: new Date() })
      .where(eq(supportTicketsTable.id, ticketId));
    res.json({ ok: true });
    return;
  }

  if (action === "reopen" && ticket.status === "closed") {
    await db
      .update(supportTicketsTable)
      .set({ status: "open", closedAt: null })
      .where(eq(supportTicketsTable.id, ticketId));
    res.json({ ok: true });
    return;
  }

  res.status(400).json({ error: "Invalid action" });
});

export default router;
