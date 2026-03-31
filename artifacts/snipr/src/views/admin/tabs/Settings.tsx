"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Globe, Sliders, ToggleLeft, AlertTriangle, ShieldCheck, Save,
  CreditCard, CheckCircle2, XCircle, Loader2, Copy, CheckCircle, ExternalLink,
  Eye, EyeOff, RefreshCw, Zap, Info, Megaphone, Gauge,
} from "lucide-react";
import { apiFetch } from "../utils";

function Section({ icon: Icon, title, children, badge }: {
  icon: React.ElementType; title: string; children: React.ReactNode; badge?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E4E4EC] flex items-center gap-2">
        <Icon className="w-4 h-4 text-[#728DA7]" />
        <h3 className="text-sm font-semibold text-[#0A0A0A]">{title}</h3>
        {badge && <span className="ml-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{badge}</span>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldRow({ label, placeholder, type = "text", sub }: {
  label: string; placeholder: string; type?: string; sub?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-[#F4F4F6] last:border-0">
      <div className="sm:w-48 shrink-0">
        <div className="text-sm font-medium text-[#0A0A0A]">{label}</div>
        {sub && <div className="text-xs text-[#8888A0] mt-0.5">{sub}</div>}
      </div>
      <input type={type} placeholder={placeholder} disabled
        className="flex-1 px-3 py-2 rounded-xl border border-[#E4E4EC] bg-[#F8F8FC] text-sm text-[#8888A0] cursor-not-allowed" />
    </div>
  );
}

function ToggleRow({ label, sub, defaultOn = false }: { label: string; sub?: string; defaultOn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#F4F4F6] last:border-0">
      <div>
        <div className="text-sm font-medium text-[#0A0A0A]">{label}</div>
        {sub && <div className="text-xs text-[#8888A0] mt-0.5">{sub}</div>}
      </div>
      <div className={`w-10 h-[22px] rounded-full relative cursor-not-allowed opacity-60 ${defaultOn ? "bg-[#728DA7]" : "bg-[#C8C8D8]"}`}>
        <div className={`absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-all ${defaultOn ? "left-[22px]" : "left-0.5"}`} />
      </div>
    </div>
  );
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <button onClick={copy} className="shrink-0 p-1.5 rounded-lg hover:bg-[#E8EEF4] text-[#8888A0] hover:text-[#4A7A94] transition-all" title="Copy">
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

type StatusSource = "env" | "db" | "none";
interface KeyStatus { set: boolean; masked: string; source: StatusSource }
type BillingStatus = Record<string, KeyStatus>;
interface TestResult {
  ok: boolean; error?: string;
  stores?: { id: string; name: string }[];
  matchedStore?: { id: string; name: string } | null;
}

const LS_FIELDS: { key: string; label: string; placeholder: string; isSecret?: boolean; help: string }[] = [
  { key: "ls_api_key",             label: "API Key",             placeholder: "eyJ0eXAiOiJKV1Qi…", isSecret: true, help: "Settings → API → Personal Access Keys → New Key" },
  { key: "ls_store_id",            label: "Store ID",            placeholder: "12345",              help: "From your store URL: app.lemonsqueezy.com/stores/[ID]" },
  { key: "ls_webhook_secret",      label: "Webhook Secret",      placeholder: "whsec_…",            isSecret: true, help: "Generated when creating a webhook in Lemon Squeezy" },
  { key: "ls_pro_variant_id",      label: "Pro Variant ID",      placeholder: "67890",              help: "Store → Products → Pro plan → Variants → ID" },
  { key: "ls_business_variant_id", label: "Business Variant ID", placeholder: "11223",              help: "Store → Products → Business plan → Variants → ID" },
];

function StatusBadge({ status }: { status: KeyStatus }) {
  if (status.source === "none") return (
    <span className="inline-flex items-center gap-1 text-xs text-red-500">
      <XCircle className="w-3.5 h-3.5" /> Not set
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600">
      <CheckCircle2 className="w-3.5 h-3.5" />
      {status.source === "env" ? "Replit Secret" : "Saved"}
    </span>
  );
}

function SecretInput({ label, status, value, onChange, help, isSecret }: {
  label: string; status: KeyStatus | undefined;
  value: string; onChange: (v: string) => void; help: string; isSecret?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isEnv = status?.source === "env";
  return (
    <div className="py-3.5 border-b border-[#F4F4F6] last:border-0 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#0A0A0A]">{label}</p>
          <p className="text-[11px] text-[#8888A0] mt-0.5">{help}</p>
        </div>
        {status && <StatusBadge status={status} />}
      </div>
      {isEnv ? (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#D4ECD6] bg-[#F4FAF4]">
          <span className="flex-1 text-sm font-mono text-[#2E6E34] tracking-wide">{status?.masked}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-600 text-white font-semibold shrink-0">Replit Secret</span>
        </div>
      ) : (
        <div className="relative">
          <input
            type={isSecret && !show ? "password" : "text"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={status?.masked || (isSecret ? "Paste new value…" : "Enter value…")}
            className="w-full px-3 py-2.5 rounded-xl border border-[#E4E4EC] bg-white text-sm outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/15 transition-all"
          />
          {isSecret && (
            <button onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8888A0] hover:text-[#3A3A3E] transition-colors">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsTab() {
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [announcement, setAnnouncement] = useState({ text: "", type: "info" as "info" | "warning" | "success", enabled: false });
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [rateLimits, setRateLimits] = useState<{ name: string; path: string; windowMs: number; max: number; description: string }[]>([]);
  const [recentBlocked, setRecentBlocked] = useState<{ total: number; byPath: Record<string, number>; lastEvents: { path: string; ip: string; timestamp: string }[] } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.host;
      setWebhookUrl(`https://${host}/api/billing/webhook`);
    }
  }, []);

  const loadBillingStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const data = await apiFetch("/admin/settings/billing");
      setBillingStatus(data);
    } catch {}
    finally { setLoadingStatus(false); }
  }, []);

  useEffect(() => { loadBillingStatus(); loadAnnouncement(); loadRateLimits(); }, [loadBillingStatus]);

  async function loadAnnouncement() {
    try {
      const data = await apiFetch("/admin/announcement");
      if (data) setAnnouncement({ text: data.text || "", type: data.type || "info", enabled: data.enabled ?? false });
    } catch {}
  }

  async function saveAnnouncement() {
    setAnnouncementSaving(true);
    try {
      await apiFetch("/admin/announcement", { method: "POST", body: JSON.stringify(announcement) });
    } catch { alert("Failed to save announcement"); }
    finally { setAnnouncementSaving(false); }
  }

  async function loadRateLimits() {
    try {
      const data = await apiFetch("/admin/rate-limits");
      setRateLimits(data.limits || []);
      setRecentBlocked(data.recentBlocked || null);
    } catch {}
  }

  function setField(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setTestResult(null);
  }

  async function saveBilling() {
    setSaving(true); setSaved(false);
    try {
      await apiFetch("/admin/settings/billing", { method: "POST", body: JSON.stringify(form) });
      setSaved(true); setForm({});
      await loadBillingStatus();
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) { alert(e?.error ?? "Failed to save settings"); }
    finally { setSaving(false); }
  }

  async function testConnection() {
    setTesting(true); setTestResult(null);
    try {
      const result = await apiFetch("/admin/settings/billing/test", { method: "POST" });
      setTestResult(result);
    } catch (e: any) { setTestResult({ ok: false, error: e?.error ?? "Connection failed" }); }
    finally { setTesting(false); }
  }

  const allSet = billingStatus ? LS_FIELDS.every((f) => billingStatus[f.key]?.set) : false;
  const configuredCount = billingStatus ? LS_FIELDS.filter((f) => billingStatus[f.key]?.set).length : 0;
  const hasUnsavedChanges = Object.values(form).some((v) => v.trim() !== "");

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Notice */}
      <div className="bg-[#FEF9E7] border border-[#F9E4A0] rounded-2xl px-5 py-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-amber-700">Lemon Squeezy section is live — other settings are read-only</div>
          <div className="text-xs text-amber-600 mt-0.5">
            Billing credentials are fully configurable and saved to the database. General platform settings will be activated in a future update.
          </div>
        </div>
      </div>

      {/* ─── Lemon Squeezy ─────────────────────────────────────────── */}
      <Section icon={CreditCard} title="Lemon Squeezy Billing" badge="Live">
        {/* Status banner */}
        <div className={`mb-5 rounded-xl p-4 border flex items-center gap-3 ${
          loadingStatus ? "bg-[#F8F8FC] border-[#E4E4EC]" :
          allSet ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
        }`}>
          {loadingStatus
            ? <Loader2 className="w-4 h-4 text-[#8888A0] animate-spin shrink-0" />
            : allSet
            ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
          <span className={`text-sm font-semibold flex-1 ${
            loadingStatus ? "text-[#8888A0]" : allSet ? "text-green-700" : "text-amber-700"
          }`}>
            {loadingStatus ? "Loading configuration…" :
             allSet ? "Billing fully configured — ready to accept payments" :
             `${configuredCount} / ${LS_FIELDS.length} credentials configured`}
          </span>
          <button onClick={loadBillingStatus} className="text-[#8888A0] hover:text-[#3A3A3E] transition-colors shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Credential fields */}
        <div>
          {LS_FIELDS.map((f) => (
            <SecretInput key={f.key} label={f.label} status={billingStatus?.[f.key]}
              value={form[f.key] ?? ""} onChange={(v) => setField(f.key, v)}
              help={f.help} isSecret={f.isSecret} />
          ))}
        </div>

        {/* Webhook URL */}
        <div className="mt-5 p-4 bg-[#F4F4F6] rounded-xl border border-[#E4E4EC] space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#728DA7]" />
            <span className="text-sm font-semibold text-[#0A0A0A]">Webhook Endpoint URL</span>
          </div>
          <p className="text-xs text-[#6666A0] leading-relaxed">
            Add this URL in Lemon Squeezy → Settings → Webhooks. Subscribe to{" "}
            <code className="bg-white px-1 rounded border border-[#E4E4EC]">subscription_created</code>,{" "}
            <code className="bg-white px-1 rounded border border-[#E4E4EC]">subscription_updated</code>,{" "}
            <code className="bg-white px-1 rounded border border-[#E4E4EC]">subscription_cancelled</code>
          </p>
          <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 border border-[#E4E4EC]">
            <span className="flex-1 text-sm font-mono text-[#4A7A94] break-all text-xs">{webhookUrl || "https://your-domain.com/api/billing/webhook"}</span>
            {webhookUrl && <CopyBtn value={webhookUrl} />}
          </div>
          <a href="https://app.lemonsqueezy.com/webhooks" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#4A7A94] hover:underline">
            <ExternalLink className="w-3 h-3" />Open Lemon Squeezy Webhooks
          </a>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`mt-4 rounded-xl border p-4 ${testResult.ok ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              {testResult.ok
                ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                : <XCircle className="w-4 h-4 text-red-500" />}
              <span className={`text-sm font-semibold ${testResult.ok ? "text-green-700" : "text-red-700"}`}>
                {testResult.ok ? "API connection successful!" : "Connection failed"}
              </span>
            </div>
            {testResult.ok && testResult.stores && (
              <div className="space-y-1.5 text-xs text-green-700">
                <p>Stores accessible ({testResult.stores.length}):</p>
                {testResult.stores.map((s) => (
                  <div key={s.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                    testResult.matchedStore?.id === s.id ? "bg-green-100 font-semibold" : "bg-white/60"
                  }`}>
                    {testResult.matchedStore?.id === s.id && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />}
                    Store #{s.id} — {s.name}
                    {testResult.matchedStore?.id === s.id && (
                      <span className="ml-auto text-[10px] bg-green-600 text-white px-2 py-0.5 rounded-full">Matched Store ID</span>
                    )}
                  </div>
                ))}
                {!testResult.matchedStore && (
                  <p className="text-amber-600 flex items-center gap-1.5 mt-1">
                    <Info className="w-3.5 h-3.5" /> Store ID didn&apos;t match any accessible store — double-check it.
                  </p>
                )}
              </div>
            )}
            {!testResult.ok && <p className="text-sm text-red-600">{testResult.error}</p>}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2.5 mt-5 pt-4 border-t border-[#F4F4F6]">
          <button onClick={saveBilling} disabled={saving || !hasUnsavedChanges}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0A0A0A] text-white text-sm font-medium hover:bg-[#222] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : saved ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : saved ? "Saved!" : "Save Credentials"}
          </button>
          <button onClick={testConnection} disabled={testing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F4F4F6] border border-[#E4E4EC] text-sm font-medium text-[#3A3A3E] hover:bg-[#E8EEF4] disabled:opacity-40 transition-all">
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-[#728DA7]" />}
            Test Connection
          </button>
        </div>

        {/* Setup tips */}
        <div className="mt-4 bg-[#F8F8FC] rounded-xl p-4 border border-[#E4E4EC]">
          <p className="text-xs font-semibold text-[#0A0A0A] mb-2.5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#728DA7]" /> Where to find each value
          </p>
          <ul className="space-y-1.5 text-xs text-[#6666A0]">
            <li><strong className="text-[#3A3A3E]">API Key</strong> — Lemon Squeezy → Settings → API → Personal Access Keys → Create New</li>
            <li><strong className="text-[#3A3A3E]">Store ID</strong> — Found in your store&apos;s URL: <code className="bg-[#EEEEF8] px-1 rounded">app.lemonsqueezy.com/stores/[ID]/dashboard</code></li>
            <li><strong className="text-[#3A3A3E]">Webhook Secret</strong> — Auto-generated when you add a new webhook</li>
            <li><strong className="text-[#3A3A3E]">Variant IDs</strong> — Store → Products → [Plan] → Variants tab → copy the numeric ID</li>
          </ul>
          <div className="mt-3 pt-3 border-t border-[#E4E4EC] text-[10px] text-[#8888A0]">
            <strong className="text-[#3A3A3E]">Tip:</strong> For production, add these as Replit Secrets instead — they take priority over DB-saved values and are never stored in plain text.
          </div>
        </div>
      </Section>

      {/* ─── General ─────────────────────────────────────────────── */}
      <Section icon={Globe} title="General Platform Settings">
        <div>
          <FieldRow label="Platform name"    placeholder="Snipr"               sub="Shown in emails and UI" />
          <FieldRow label="Support email"    placeholder="support@snipr.sh"    type="email" />
          <FieldRow label="Default domain"   placeholder="snipr.sh"            sub="Base domain for short links" />
          <FieldRow label="Max links / user" placeholder="10" type="number"    sub="Free tier limit" />
        </div>
      </Section>

      {/* ─── Feature Toggles ─────────────────────────────────────── */}
      <Section icon={ToggleLeft} title="Feature Toggles">
        <div>
          <ToggleRow label="User registration"  sub="Allow new users to sign up"                          defaultOn />
          <ToggleRow label="Custom domains"     sub="Allow users to connect their own domains"             defaultOn />
          <ToggleRow label="AI Insights"        sub="Enable AI analysis for user workspaces" />
          <ToggleRow label="API access"         sub="Allow users to generate API keys"                     defaultOn />
          <ToggleRow label="Team workspaces"    sub="Allow users to invite team members"                   defaultOn />
          <ToggleRow label="QR code downloads"  sub="Enable QR code generation on links"                   defaultOn />
          <ToggleRow label="Link expiry"        sub="Allow setting expiration dates on links"               defaultOn />
        </div>
      </Section>

      {/* ─── Platform Limits ─────────────────────────────────────── */}
      <Section icon={Sliders} title="Platform Limits">
        <div>
          <FieldRow label="Rate limit (req/min)"  placeholder="60"  type="number" sub="Per user API rate limit" />
          <FieldRow label="Max custom domains"    placeholder="3"   type="number" sub="Per workspace (free tier)" />
          <FieldRow label="Click data retention"  placeholder="365" type="number" sub="Days to retain click logs" />
          <FieldRow label="Max team members"      placeholder="5"   type="number" sub="Per workspace (free tier)" />
        </div>
      </Section>

      {/* ─── Access Control ──────────────────────────────────────── */}
      <Section icon={ShieldCheck} title="Access Control">
        <div>
          <FieldRow label="Admin username" placeholder="admin"    sub="Admin panel login username" />
          <FieldRow label="Admin password" placeholder="••••••••" type="password" sub="Change admin password" />
          <ToggleRow label="Enforce 2FA for admin" sub="Require TOTP on admin login" />
          <ToggleRow label="IP allowlist"          sub="Restrict admin panel to specific IP ranges" />
        </div>
      </Section>

      {/* ─── Announcement Banner ───────────────────────────────── */}
      <Section icon={Megaphone} title="Announcement Banner">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[#0A0A0A]">Enable Banner</div>
              <div className="text-xs text-[#8888A0] mt-0.5">Show a banner to all users across the platform</div>
            </div>
            <button
              onClick={() => setAnnouncement(a => ({ ...a, enabled: !a.enabled }))}
              className={`w-10 h-[22px] rounded-full relative transition-colors ${announcement.enabled ? "bg-[#728DA7]" : "bg-[#C8C8D8]"}`}>
              <div className={`absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-all ${announcement.enabled ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
          <div>
            <label className="text-xs font-medium text-[#8888A0] uppercase mb-1.5 block">Type</label>
            <div className="flex gap-2">
              {(["info", "warning", "success"] as const).map(t => (
                <button key={t} onClick={() => setAnnouncement(a => ({ ...a, type: t }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    announcement.type === t
                      ? t === "info" ? "bg-blue-100 text-blue-700 border border-blue-200"
                        : t === "warning" ? "bg-amber-100 text-amber-700 border border-amber-200"
                        : "bg-green-100 text-green-700 border border-green-200"
                      : "bg-[#F4F4F6] text-[#8888A0] border border-transparent hover:bg-[#E8EEF4]"
                  }`}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[#8888A0] uppercase mb-1.5 block">Message</label>
            <textarea
              value={announcement.text}
              onChange={e => setAnnouncement(a => ({ ...a, text: e.target.value }))}
              placeholder="Enter your announcement message..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E4E4EC] bg-white text-sm outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/15 transition-all resize-none"
            />
          </div>
          {announcement.text && (
            <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${
              announcement.type === "warning" ? "bg-amber-50 text-amber-800 border border-amber-200"
                : announcement.type === "success" ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-blue-50 text-blue-800 border border-blue-200"
            }`}>
              <Megaphone className="w-4 h-4 shrink-0" />
              <span>{announcement.text}</span>
            </div>
          )}
          <button onClick={saveAnnouncement} disabled={announcementSaving}
            className="px-4 py-2 rounded-xl bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#1A1A2E] disabled:opacity-40 transition-all flex items-center gap-2">
            {announcementSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Announcement
          </button>
        </div>
      </Section>

      {/* ─── Rate Limit Dashboard ──────────────────────────────── */}
      <Section icon={Gauge} title="Rate Limit Dashboard">
        <div className="space-y-3">
          {rateLimits.length === 0 ? (
            <p className="text-xs text-[#8888A0]">No rate limit data available.</p>
          ) : (
            <div className="divide-y divide-[#F4F4F6]">
              {rateLimits.map((rl, i) => (
                <div key={i} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-[#0A0A0A]">{rl.name}</div>
                    <div className="text-xs text-[#8888A0]">
                      <code className="bg-[#F4F4F6] px-1 rounded text-[10px]">{rl.path}</code>
                      <span className="ml-2">{rl.max} req / {Math.round(rl.windowMs / 1000)}s</span>
                    </div>
                    <div className="text-[10px] text-[#8888A0] mt-0.5">{rl.description}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-semibold">Active</span>
                </div>
              ))}
            </div>
          )}
          {recentBlocked && (
            <div className="mt-3 p-3 bg-[#FFF7ED] rounded-xl border border-orange-200">
              <div className="text-xs font-semibold text-orange-800 mb-2">Recent Blocked Requests (24h)</div>
              <div className="text-sm font-medium text-orange-900 mb-1">{recentBlocked.total} total blocked</div>
              {Object.keys(recentBlocked.byPath).length > 0 && (
                <div className="space-y-1 mb-2">
                  {Object.entries(recentBlocked.byPath).map(([path, cnt]) => (
                    <div key={path} className="flex items-center justify-between text-xs">
                      <code className="bg-white/60 px-1 rounded text-[10px] text-orange-700">{path}</code>
                      <span className="font-semibold text-orange-800">{cnt}</span>
                    </div>
                  ))}
                </div>
              )}
              {recentBlocked.lastEvents.length > 0 && (
                <details className="text-xs text-orange-700">
                  <summary className="cursor-pointer hover:text-orange-900">Last {recentBlocked.lastEvents.length} events</summary>
                  <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                    {recentBlocked.lastEvents.map((evt, i) => (
                      <div key={i} className="flex gap-2 font-mono text-[10px]">
                        <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                        <span>{evt.ip}</span>
                        <span className="text-orange-900">{evt.path}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
          <button onClick={loadRateLimits}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#8888A0] hover:text-[#3A3A3E] hover:bg-[#F4F4F6] transition-all flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </Section>
    </div>
  );
}
