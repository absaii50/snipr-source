"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LifeBuoy, Search, Send, Loader2, ChevronLeft, X,
  AlertCircle, CheckCircle2, Clock, MessageSquare, User,
  Headphones, Lock, Circle,
} from "lucide-react";
import { apiFetch, fmtDate } from "../utils";
import { useToast } from "../Toast";

/* ── Types ──────────────────────────────────────────────────── */
interface AdminTicket {
  id: string;
  subject: string;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "pending" | "resolved" | "closed";
  assignedAdmin: string | null;
  createdAt: string;
  updatedAt: string;
  lastUserReplyAt: string | null;
  lastAdminReplyAt: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  userPlan: string;
  messageCount: number;
}

interface AdminTicketDetail {
  ticket: AdminTicket;
  messages: {
    id: string;
    senderType: "user" | "admin";
    senderLabel: string | null;
    body: string;
    isInternalNote: string;
    createdAt: string;
  }[];
}

interface Summary {
  totals: { open: number; pending: number; resolved: number; closed: number };
  openByPriority: { low: number; normal: number; high: number; urgent: number };
}

/* ── Style maps ─────────────────────────────────────────────── */
const STATUS_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  open:     { label: "Open",          bg: "bg-blue-50 border-blue-200",    text: "text-blue-700" },
  pending:  { label: "Awaiting user", bg: "bg-amber-50 border-amber-200",  text: "text-amber-700" },
  resolved: { label: "Resolved",      bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  closed:   { label: "Closed",        bg: "bg-gray-50 border-gray-200",    text: "text-gray-600" },
};

const PRIORITY_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  urgent: { bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500" },
  high:   { bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500" },
  normal: { bg: "bg-gray-50",   text: "text-gray-700",   dot: "bg-gray-400" },
  low:    { bg: "bg-gray-50",   text: "text-gray-500",   dot: "bg-gray-300" },
};

/* ══════════════════════════════════════════════════════════════════════
 * Component
 * ═════════════════════════════════════════════════════════════════════ */
export default function SupportTab() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<AdminTicket[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "pending" | "resolved" | "closed">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "low" | "normal" | "high" | "urgent">("all");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    if (search.trim()) params.set("search", search.trim());
    try {
      const [list, sum] = await Promise.all([
        apiFetch(`/admin/support/tickets?${params}`),
        apiFetch(`/admin/support/tickets/summary`),
      ]);
      setTickets(list);
      setSummary(sum);
    } catch {
      toast("Failed to load tickets", "error");
    }
  }, [statusFilter, priorityFilter, search, toast]);

  useEffect(() => {
    const t = setTimeout(() => load(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Open" value={summary?.totals.open ?? "—"} accent="#3B82F6" bg="#EFF6FF" />
        <KpiCard label="Awaiting user" value={summary?.totals.pending ?? "—"} accent="#F59E0B" bg="#FFFBEB" />
        <KpiCard label="Resolved" value={summary?.totals.resolved ?? "—"} accent="#10B981" bg="#ECFDF5" />
        <KpiCard label="Urgent / high open" value={(summary ? (summary.openByPriority.urgent + summary.openByPriority.high) : "—")} accent="#EF4444" bg="#FEF2F2" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888A0]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by subject, user email, or name..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-[#0A0A0A] placeholder:text-[#8888A0] outline-none focus:border-[#728DA7] transition-colors"
          />
        </div>
        <FilterChips
          label="Status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as any)}
          options={[
            { value: "all", label: "All" },
            { value: "open", label: "Open" },
            { value: "pending", label: "Pending" },
            { value: "resolved", label: "Resolved" },
            { value: "closed", label: "Closed" },
          ]}
        />
        <FilterChips
          label="Priority"
          value={priorityFilter}
          onChange={(v) => setPriorityFilter(v as any)}
          options={[
            { value: "all", label: "All" },
            { value: "urgent", label: "Urgent" },
            { value: "high", label: "High" },
            { value: "normal", label: "Normal" },
            { value: "low", label: "Low" },
          ]}
        />
      </div>

      {/* List */}
      {tickets === null ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 text-[#728DA7] animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#EEF3F7] flex items-center justify-center mx-auto mb-3">
            <LifeBuoy className="w-6 h-6 text-[#728DA7]" />
          </div>
          <h3 className="text-[14px] font-semibold text-[#0A0A0A] mb-1">No tickets match your filters</h3>
          <p className="text-[12px] text-[#8888A0]">Try adjusting the filters above.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
          <div className="divide-y divide-[#F0F4F8]">
            {tickets.map((t) => (
              <TicketRow key={t.id} ticket={t} onOpen={() => setSelectedId(t.id)} />
            ))}
          </div>
        </div>
      )}

      {selectedId && (
        <AdminTicketDrawer
          ticketId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdate={load}
        />
      )}
    </div>
  );
}

/* ─── KPI card ──────────────────────────────────────────── */
function KpiCard({ label, value, accent, bg }: { label: string; value: number | string; accent: string; bg: string }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: bg }}>
          <Circle className="w-3 h-3" fill={accent} stroke={accent} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8888A0]">{label}</span>
      </div>
      <div className="text-[22px] font-bold text-[#0A0A0A] tabular-nums">{value}</div>
    </div>
  );
}

/* ─── Filter chips ──────────────────────────────────────── */
function FilterChips<T extends string>({ label, value, onChange, options }: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1 bg-white border border-[#E2E8F0] rounded-lg p-1 overflow-x-auto max-w-full">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8888A0] px-2 shrink-0">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`shrink-0 px-2.5 py-1 rounded-md text-[12px] font-medium capitalize transition-colors ${
            value === o.value ? "bg-[#E8EEF4] text-[#4A7A94]" : "text-[#8888A0] hover:text-[#0A0A0A]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Ticket row ──────────────────────────────────────── */
function TicketRow({ ticket, onOpen }: { ticket: AdminTicket; onOpen: () => void }) {
  const status = STATUS_STYLE[ticket.status];
  const priority = PRIORITY_STYLE[ticket.priority];
  const hasUnrespondedReply = ticket.status === "open" && (!ticket.lastAdminReplyAt || new Date(ticket.lastUserReplyAt ?? 0) > new Date(ticket.lastAdminReplyAt));

  return (
    <button onClick={onOpen} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#F8F8FC] transition-colors text-left">
      <div className="w-8 h-8 rounded-full bg-[#E8EEF4] flex items-center justify-center text-[10px] font-bold text-[#728DA7] shrink-0">
        {ticket.userName?.charAt(0)?.toUpperCase() ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="text-[14px] font-semibold text-[#0A0A0A] truncate max-w-[200px] sm:max-w-[340px]">{ticket.subject}</h3>
          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.bg} ${status.text}`}>
            {status.label}
          </span>
          {(ticket.priority === "urgent" || ticket.priority === "high") && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${priority.bg} ${priority.text}`}>
              <span className={`w-1 h-1 rounded-full ${priority.dot}`} /> {ticket.priority}
            </span>
          )}
          {hasUnrespondedReply && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
              <span className="w-1 h-1 rounded-full bg-violet-500 animate-pulse" /> Needs reply
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#8888A0] flex-wrap min-w-0">
          <span className="font-medium text-[#3A3A3E] truncate max-w-[140px]">{ticket.userName}</span>
          <span className="hidden sm:inline">·</span>
          <span className="truncate max-w-[180px] hidden sm:inline">{ticket.userEmail}</span>
          <span>·</span>
          <span className="capitalize">{ticket.userPlan}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> {ticket.messageCount}
          </span>
          <span>·</span>
          <span>{fmtDate(ticket.updatedAt)}</span>
        </div>
      </div>
    </button>
  );
}

/* ─── Admin Ticket drawer ──────────────────────────────── */
function AdminTicketDrawer({ ticketId, onClose, onUpdate }: { ticketId: string; onClose: () => void; onUpdate: () => void }) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<AdminTicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [internal, setInternal] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/admin/support/tickets/${ticketId}`);
      setDetail(data);
    } catch {
      toast("Failed to load ticket", "error");
    }
  }, [ticketId, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [detail?.messages.length]);

  async function updateField(updates: Record<string, any>) {
    try {
      await apiFetch(`/admin/support/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      toast("Ticket updated", "success");
      await load();
      onUpdate();
    } catch {
      toast("Failed to update ticket", "error");
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      await apiFetch(`/admin/support/tickets/${ticketId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: reply.trim(), internal }),
      });
      toast(internal ? "Internal note added" : "Reply sent to user", "success");
      setReply("");
      setInternal(false);
      await load();
      onUpdate();
    } catch {
      toast("Failed to send reply", "error");
    } finally { setSending(false); }
  }

  const ticket = detail?.ticket;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-3xl h-full bg-[#F8F8FC] border-l border-[#E2E8F0] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] bg-white flex items-start gap-3">
          <button onClick={onClose} className="p-1.5 text-[#8888A0] hover:text-[#0A0A0A] transition-colors shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            {ticket ? (
              <>
                <h2 className="text-[15px] font-semibold text-[#0A0A0A] truncate">{ticket.subject}</h2>
                <p className="text-[12px] text-[#8888A0] mt-0.5">
                  {ticket.userName} &middot; {ticket.userEmail} &middot; <span className="capitalize">{ticket.userPlan}</span>
                </p>
              </>
            ) : (
              <div className="h-5 w-48 bg-[#F0F4F8] rounded animate-pulse" />
            )}
          </div>
        </div>

        {/* Controls */}
        {ticket && (
          <div className="px-5 py-3 border-b border-[#E2E8F0] bg-white flex items-center gap-3 flex-wrap">
            <InlineSelect
              label="Status"
              value={ticket.status}
              onChange={(v) => updateField({ status: v })}
              options={[
                { value: "open", label: "Open" },
                { value: "pending", label: "Awaiting user" },
                { value: "resolved", label: "Resolved" },
                { value: "closed", label: "Closed" },
              ]}
            />
            <InlineSelect
              label="Priority"
              value={ticket.priority}
              onChange={(v) => updateField({ priority: v })}
              options={[
                { value: "low", label: "Low" },
                { value: "normal", label: "Normal" },
                { value: "high", label: "High" },
                { value: "urgent", label: "Urgent" },
              ]}
            />
            <div className="text-[11px] text-[#8888A0] capitalize ml-auto">{ticket.category}</div>
          </div>
        )}

        {/* Messages */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {detail?.messages.map((m) => <AdminMessage key={m.id} msg={m} />)}
          {!detail && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-[#728DA7] animate-spin" />
            </div>
          )}
        </div>

        {/* Reply composer */}
        <div className="border-t border-[#E2E8F0] bg-white px-5 py-4">
          <form onSubmit={sendReply} className="space-y-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              maxLength={8000}
              placeholder={internal ? "Internal note (only visible to admins)..." : "Type your reply to the user..."}
              className={`w-full px-3 py-2.5 rounded-lg border text-[13px] outline-none transition-colors resize-none ${
                internal
                  ? "bg-amber-50 border-amber-200 focus:border-amber-400 placeholder:text-amber-400 text-amber-900"
                  : "bg-white border-[#E2E8F0] focus:border-[#728DA7] placeholder:text-[#8888A0] text-[#0A0A0A]"
              }`}
            />
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-[12px] text-[#3A3A3E] cursor-pointer">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  className="rounded border-[#E2E8F0]"
                />
                <Lock className="w-3 h-3 text-[#8888A0]" />
                Internal note (not sent to user)
              </label>
              <button
                type="submit"
                disabled={!reply.trim() || sending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold hover:bg-[#1A1A1A] disabled:opacity-50 transition-colors"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {internal ? "Save Note" : "Send Reply"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function InlineSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11px]">
      <span className="font-bold uppercase tracking-[0.08em] text-[#8888A0]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 rounded-md bg-[#F8F8FC] border border-[#E2E8F0] text-[12px] font-medium text-[#0A0A0A] outline-none focus:border-[#728DA7]"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function AdminMessage({ msg }: { msg: AdminTicketDetail["messages"][number] }) {
  const isAdmin = msg.senderType === "admin";
  const isInternal = msg.isInternalNote === "true";
  return (
    <div className={`flex gap-3 ${isAdmin ? "" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isInternal ? "bg-amber-100" : isAdmin ? "bg-gradient-to-br from-[#728DA7] to-[#4A7A94]" : "bg-[#E8EEF4]"
      }`}>
        {isInternal ? <Lock className="w-3.5 h-3.5 text-amber-700" /> :
         isAdmin ? <Headphones className="w-4 h-4 text-white" /> :
         <User className="w-4 h-4 text-[#728DA7]" />}
      </div>
      <div className={`flex-1 min-w-0 rounded-xl border px-4 py-3 ${
        isInternal
          ? "bg-amber-50 border-amber-200"
          : isAdmin
            ? "bg-[#EEF3F7] border-[#D7E2ED]"
            : "bg-white border-[#E2E8F0]"
      }`}>
        <div className="flex items-baseline gap-2 mb-1 flex-wrap">
          <span className="text-[11px] font-semibold text-[#0A0A0A]">
            {isInternal ? "Internal Note" : isAdmin ? (msg.senderLabel || "Support Team") : "User"}
          </span>
          <span className="text-[10px] text-[#8888A0]">{fmtDate(msg.createdAt)}</span>
        </div>
        <p className="text-[13px] text-[#3A3A3E] leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
      </div>
    </div>
  );
}
