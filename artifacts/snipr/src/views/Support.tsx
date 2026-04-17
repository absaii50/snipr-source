"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import {
  LifeBuoy, Plus, Send, Search, Loader2, ChevronLeft, X,
  Clock, CheckCircle2, AlertCircle, MessageSquare, User, Headphones,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/* ── Types ─────────────────────────────────────────────── */
interface TicketListItem {
  id: string;
  subject: string;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "pending" | "resolved" | "closed";
  createdAt: string;
  updatedAt: string;
  lastAdminReplyAt: string | null;
  lastUserReplyAt: string | null;
  messageCount: number;
}

interface TicketDetail {
  ticket: TicketListItem & { workspaceId?: string | null };
  messages: {
    id: string;
    senderType: "user" | "admin";
    senderLabel: string | null;
    body: string;
    createdAt: string;
  }[];
}

const CATEGORIES = [
  { value: "technical", label: "Technical issue" },
  { value: "billing", label: "Billing & plans" },
  { value: "bug", label: "Report a bug" },
  { value: "feature", label: "Feature request" },
  { value: "other", label: "Other" },
];

const PRIORITY_STYLE: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  urgent: { bg: "bg-[#EF4444]/12",  text: "text-[#FCA5A5]",  border: "border-[#EF4444]/30", dot: "bg-[#EF4444]" },
  high:   { bg: "bg-[#F59E0B]/12",  text: "text-[#FCD34D]",  border: "border-[#F59E0B]/30", dot: "bg-[#F59E0B]" },
  normal: { bg: "bg-[#27272A]",     text: "text-[#A1A1AA]",  border: "border-[#3F3F46]",    dot: "bg-[#71717A]" },
  low:    { bg: "bg-[#27272A]",     text: "text-[#71717A]",  border: "border-[#3F3F46]",    dot: "bg-[#52525B]" },
};

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  open:     { label: "Open",         bg: "bg-[#8B5CF6]/12", text: "text-[#C4B5FD]", border: "border-[#8B5CF6]/30", icon: <AlertCircle className="w-3 h-3" /> },
  pending:  { label: "Awaiting you", bg: "bg-[#F59E0B]/12", text: "text-[#FCD34D]", border: "border-[#F59E0B]/30", icon: <Clock className="w-3 h-3" /> },
  resolved: { label: "Resolved",     bg: "bg-[#10B981]/12", text: "text-[#6EE7B7]", border: "border-[#10B981]/30", icon: <CheckCircle2 className="w-3 h-3" /> },
  closed:   { label: "Closed",       bg: "bg-[#27272A]",    text: "text-[#A1A1AA]", border: "border-[#3F3F46]",    icon: <X className="w-3 h-3" /> },
};

/* ── Helpers ───────────────────────────────────────────── */
async function apiFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

/* ══════════════════════════════════════════════════════════════════════
 * Root
 * ═════════════════════════════════════════════════════════════════════ */
export default function Support() {
  return (
    <ProtectedLayout>
      <SupportInner />
    </ProtectedLayout>
  );
}

function SupportInner() {
  const [tickets, setTickets] = useState<TicketListItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "pending" | "resolved" | "closed">("all");

  const loadTickets = useCallback(async () => {
    const data = await apiFetch<TicketListItem[]>("/api/support/tickets");
    setTickets(data);
  }, []);

  useEffect(() => { loadTickets().catch(() => setTickets([])); }, [loadTickets]);

  const visible = useMemo(() => {
    if (!tickets) return [];
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (search && !t.subject.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tickets, search, statusFilter]);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)" }}>
              <LifeBuoy className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-[22px] font-bold text-[#FAFAFA] font-[family-name:var(--font-space-grotesk)]">Support</h1>
          </div>
          <p className="text-[13px] text-[#71717A]">Open a ticket and our team will get back to you.</p>
        </div>
        <button
          onClick={() => setComposerOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[13px] font-semibold transition-all hover:-translate-y-0.5"
          style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)", boxShadow: "0 4px 14px rgba(139,92,246,0.2)" }}
        >
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52525B]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets by subject..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#18181B] border border-[#27272A] text-[13px] text-[#E4E4E7] placeholder:text-[#52525B] outline-none focus:border-[#8B5CF6] transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-[#18181B] border border-[#27272A] rounded-lg p-1">
          {(["all", "open", "pending", "resolved", "closed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-md text-[12px] font-medium capitalize transition-colors ${
                statusFilter === s ? "bg-[#8B5CF6]/15 text-[#C4B5FD] ring-1 ring-inset ring-[#8B5CF6]/30" : "text-[#71717A] hover:text-[#E4E4E7]"
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {tickets === null ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 text-[#8B5CF6] animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          hasTickets={tickets.length > 0}
          onCreate={() => setComposerOpen(true)}
        />
      ) : (
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden divide-y divide-[#27272A]">
          {visible.map((t) => (
            <TicketRow key={t.id} ticket={t} onOpen={() => setSelectedId(t.id)} />
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {selectedId && (
        <TicketDetailDrawer
          ticketId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdate={() => loadTickets()}
        />
      )}

      {/* Composer */}
      {composerOpen && (
        <NewTicketModal
          onClose={() => setComposerOpen(false)}
          onCreated={async (id) => { setComposerOpen(false); await loadTickets(); setSelectedId(id); }}
        />
      )}
    </div>
  );
}

/* ─── Empty state ──────────────────────────────────────── */
function EmptyState({ hasTickets, onCreate }: { hasTickets: boolean; onCreate: () => void }) {
  return (
    <div className="text-center py-16 bg-[#18181B] border border-[#27272A] rounded-xl">
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)" }}>
        <Headphones className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-[15px] font-semibold text-[#FAFAFA] mb-1">
        {hasTickets ? "No tickets match your filters" : "No tickets yet"}
      </h3>
      <p className="text-[13px] text-[#71717A] mb-5 max-w-sm mx-auto">
        {hasTickets ? "Try adjusting the filters above." : "Need help or have a question? Our team is one message away."}
      </p>
      {!hasTickets && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[13px] font-semibold transition-all hover:-translate-y-0.5"
          style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)", boxShadow: "0 4px 14px rgba(139,92,246,0.2)" }}
        >
          <Plus className="w-4 h-4" /> Open your first ticket
        </button>
      )}
    </div>
  );
}

/* ─── Ticket row ───────────────────────────────────────── */
function TicketRow({ ticket, onOpen }: { ticket: TicketListItem; onOpen: () => void }) {
  const status = STATUS_STYLE[ticket.status];
  const priority = PRIORITY_STYLE[ticket.priority];
  const awaiting = ticket.status === "pending" || (ticket.lastAdminReplyAt && new Date(ticket.lastAdminReplyAt) > new Date(ticket.lastUserReplyAt ?? 0));

  return (
    <button onClick={onOpen} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#27272A]/50 transition-colors text-left">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="text-[14px] font-semibold text-[#FAFAFA] truncate">{ticket.subject}</h3>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.bg} ${status.text} ${status.border}`}>
            {status.icon}{status.label}
          </span>
          {(ticket.priority === "high" || ticket.priority === "urgent") && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${priority.bg} ${priority.text} ${priority.border}`}>
              <span className={`w-1 h-1 rounded-full ${priority.dot}`} /> {ticket.priority}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[#71717A]">
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> {ticket.messageCount} message{ticket.messageCount === 1 ? "" : "s"}
          </span>
          <span>·</span>
          <span>Updated {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}</span>
        </div>
      </div>
      {awaiting && ticket.status === "pending" && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#C4B5FD] bg-[#8B5CF6]/12 border border-[#8B5CF6]/30 px-2 py-0.5 rounded-full shrink-0">
          <span className="w-1 h-1 rounded-full bg-[#A78BFA] animate-pulse" /> Reply
        </span>
      )}
    </button>
  );
}

/* ─── New Ticket modal ─────────────────────────────────── */
function NewTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("technical");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subject.trim() || !body.trim()) { setError("Subject and message are required."); return; }
    setSubmitting(true);
    try {
      const t = await apiFetch<{ id: string }>("/api/support/tickets", {
        method: "POST",
        body: JSON.stringify({ subject: subject.trim(), body: body.trim(), category, priority }),
      });
      onCreated(t.id);
    } catch (e: any) {
      setError(e.message ?? "Failed to create ticket");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#18181B] border border-[#27272A] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#27272A] flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[#FAFAFA]">New Support Ticket</h2>
          <button type="button" onClick={onClose} className="p-1 text-[#71717A] hover:text-[#FAFAFA] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Subject" required>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              placeholder="Brief summary of your issue"
              className="w-full px-3 py-2.5 rounded-lg bg-[#09090B] border border-[#27272A] text-[14px] text-[#FAFAFA] placeholder:text-[#52525B] outline-none focus:border-[#8B5CF6] transition-colors"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#09090B] border border-[#27272A] text-[14px] text-[#FAFAFA] outline-none focus:border-[#8B5CF6] transition-colors appearance-none"
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#09090B] border border-[#27272A] text-[14px] text-[#FAFAFA] outline-none focus:border-[#8B5CF6] transition-colors appearance-none"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
          </div>

          <Field label="Message" required>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={8000}
              rows={6}
              placeholder="Describe your issue in detail. Include steps to reproduce, URLs, and any error messages."
              className="w-full px-3 py-2.5 rounded-lg bg-[#09090B] border border-[#27272A] text-[14px] text-[#FAFAFA] placeholder:text-[#52525B] outline-none focus:border-[#8B5CF6] transition-colors resize-none"
              required
            />
            <p className="text-[11px] text-[#52525B] mt-1">{body.length}/8000 characters</p>
          </Field>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[12px] px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-[#27272A] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] text-[#A1A1AA] hover:bg-[#27272A] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px] font-semibold disabled:opacity-60 transition-all"
            style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)", boxShadow: "0 4px 14px rgba(139,92,246,0.2)" }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Ticket
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-[#A1A1AA] mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

/* ─── Detail drawer ────────────────────────────────────── */
function TicketDetailDrawer({ ticketId, onClose, onUpdate }: { ticketId: string; onClose: () => void; onUpdate: () => void }) {
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<TicketDetail>(`/api/support/tickets/${ticketId}`);
    setDetail(data);
  }, [ticketId]);

  useEffect(() => { load().catch(() => setError("Ticket not found")); }, [load]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [detail?.messages.length]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch(`/api/support/tickets/${ticketId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: reply.trim() }),
      });
      setReply("");
      await load();
      onUpdate();
    } catch (e: any) {
      setError(e.message ?? "Failed to send reply");
    } finally { setSending(false); }
  }

  async function closeTicket() {
    if (!confirm("Close this ticket? You can still reopen it later.")) return;
    await apiFetch(`/api/support/tickets/${ticketId}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "close" }),
    });
    await load();
    onUpdate();
  }

  const ticket = detail?.ticket;
  const status = ticket ? STATUS_STYLE[ticket.status] : null;
  const isClosed = ticket?.status === "closed";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl h-full bg-[#09090B] border-l border-[#27272A] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#27272A] flex items-start gap-3">
          <button onClick={onClose} className="p-1.5 text-[#71717A] hover:text-[#FAFAFA] transition-colors shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            {ticket ? (
              <>
                <h2 className="text-[15px] font-semibold text-[#FAFAFA] truncate">{ticket.subject}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {status && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.bg} ${status.text} ${status.border}`}>
                      {status.icon}{status.label}
                    </span>
                  )}
                  <span className="text-[11px] text-[#52525B] capitalize">{ticket.category}</span>
                  <span className="text-[11px] text-[#52525B]">·</span>
                  <span className="text-[11px] text-[#52525B] capitalize">{ticket.priority} priority</span>
                </div>
              </>
            ) : (
              <div className="h-5 w-32 bg-[#27272A] rounded animate-pulse" />
            )}
          </div>
          {ticket && !isClosed && (
            <button
              onClick={closeTicket}
              className="text-[12px] text-[#71717A] hover:text-[#FAFAFA] transition-colors shrink-0"
              title="Close ticket"
            >
              Close
            </button>
          )}
        </div>

        {/* Messages */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {detail?.messages.map((m) => (
            <Message key={m.id} msg={m} />
          ))}
          {!detail && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-[#8B5CF6] animate-spin" />
            </div>
          )}
        </div>

        {/* Reply composer */}
        <div className="border-t border-[#27272A] px-5 py-4">
          {isClosed ? (
            <p className="text-[12px] text-[#71717A] text-center">
              This ticket is closed. Open a new ticket if you need further help.
            </p>
          ) : (
            <form onSubmit={sendReply} className="space-y-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                maxLength={8000}
                placeholder="Type your reply..."
                className="w-full px-3 py-2.5 rounded-lg bg-[#18181B] border border-[#27272A] text-[13px] text-[#FAFAFA] placeholder:text-[#52525B] outline-none focus:border-[#8B5CF6] transition-colors resize-none"
              />
              {error && (
                <p className="text-[11px] text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {error}
                </p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!reply.trim() || sending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px] font-semibold disabled:opacity-60 transition-all"
                  style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)", boxShadow: "0 4px 14px rgba(139,92,246,0.2)" }}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Reply
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Message({ msg }: { msg: TicketDetail["messages"][number] }) {
  const isAdmin = msg.senderType === "admin";
  return (
    <div className={`flex gap-3 ${isAdmin ? "" : "flex-row-reverse"}`}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ring-1 ring-inset"
        style={isAdmin
          ? { background: "#1C1C20", borderColor: "transparent" }
          : { background: "linear-gradient(135deg, #8B5CF6, #06B6D4)" }}
      >
        {isAdmin
          ? <Headphones className="w-4 h-4 text-[#A78BFA]" />
          : <User className="w-4 h-4 text-white" />}
      </div>
      <div className={`flex-1 min-w-0 ${isAdmin ? "" : "text-right"}`}>
        <div className={`inline-block max-w-[85%] text-left rounded-2xl px-4 py-3 border ${
          isAdmin
            ? "bg-[#18181B] border-[#27272A] text-[#E4E4E7]"
            : "bg-[#8B5CF6]/12 border-[#8B5CF6]/30 text-[#FAFAFA]"
        }`}>
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-[11px] font-semibold ${isAdmin ? "text-[#A78BFA]" : "text-[#C4B5FD]"}`}>
              {isAdmin ? (msg.senderLabel || "Support Team") : "You"}
            </span>
            <span className="text-[10px] text-[#52525B]">
              {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words text-[#E4E4E7]">{msg.body}</p>
        </div>
      </div>
    </div>
  );
}
