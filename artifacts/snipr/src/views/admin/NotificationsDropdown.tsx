"use client";
import { useEffect, useRef, useState } from "react";
import { UserPlus, MailX, ShieldAlert, Inbox } from "lucide-react";
import { apiFetch } from "./utils";

interface SignupItem {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
}
interface FailedEmailItem {
  id: string;
  recipient: string;
  subject: string | null;
  createdAt: string;
}
interface AuditItem {
  id: string;
  action: string;
  targetType: string | null;
  createdAt: string;
}
interface NotificationsData {
  newSignups: SignupItem[];
  failedEmails: FailedEmailItem[];
  recentAudit: AuditItem[];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function NotificationsDropdown({ open, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<NotificationsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiFetch("/admin/notifications")
      .then((d) => setData(d as NotificationsData))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "100%",
        right: 0,
        marginTop: 8,
        width: 370,
        maxHeight: 480,
        overflowY: "auto",
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        zIndex: 100,
        padding: "12px 0",
      }}
    >
      <div style={{ padding: "0 16px 8px", fontWeight: 600, fontSize: 15, color: "#111" }}>
        Notifications
      </div>

      {loading && (
        <div style={{ padding: "24px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
          Loading...
        </div>
      )}

      {!loading && data && (
        <>
          <Section title="New Signups">
            {data.newSignups.length === 0 ? (
              <EmptyState text="No new signups in the last 24h" />
            ) : (
              data.newSignups.map((u) => (
                <Row
                  key={u.id}
                  icon={<UserPlus size={15} color="#2563eb" />}
                  text={u.name || u.email}
                  sub={u.name ? u.email : undefined}
                  time={relativeTime(u.createdAt)}
                />
              ))
            )}
          </Section>

          <Section title="Failed Emails">
            {data.failedEmails.length === 0 ? (
              <EmptyState text="No failed emails in the last 24h" />
            ) : (
              data.failedEmails.map((e) => (
                <Row
                  key={e.id}
                  icon={<MailX size={15} color="#dc2626" />}
                  text={e.recipient}
                  sub={e.subject ?? undefined}
                  time={relativeTime(e.createdAt)}
                />
              ))
            )}
          </Section>

          <Section title="Admin Actions">
            {data.recentAudit.length === 0 ? (
              <EmptyState text="No admin actions in the last 24h" />
            ) : (
              data.recentAudit.map((a) => (
                <Row
                  key={a.id}
                  icon={<ShieldAlert size={15} color="#f59e0b" />}
                  text={a.action.replace(/_/g, " ")}
                  sub={a.targetType ?? undefined}
                  time={relativeTime(a.createdAt)}
                />
              ))
            )}
          </Section>
        </>
      )}

      {!loading && !data && (
        <div style={{ padding: "24px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
          Failed to load notifications
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "4px 0" }}>
      <div
        style={{
          padding: "6px 16px",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#6b7280",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({
  icon,
  text,
  sub,
  time,
}: {
  icon: React.ReactNode;
  text: string;
  sub?: string;
  time: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "8px 16px",
      }}
    >
      <div style={{ marginTop: 2, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: "#111",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {text}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 12,
              color: "#9ca3af",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sub}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", marginTop: 2 }}>
        {time}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        color: "#9ca3af",
        fontSize: 13,
      }}
    >
      <Inbox size={14} />
      {text}
    </div>
  );
}
