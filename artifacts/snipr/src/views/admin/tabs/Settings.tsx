"use client";
import { useEffect, useState } from "react";
import {
  Globe, Sliders, ToggleLeft, ShieldCheck, Save,
  CheckCircle2, Loader2,
  RefreshCw, Megaphone, Gauge, Database, Download,
} from "lucide-react";
import { apiFetch } from "../utils";
import { useToast } from "../Toast";

function Section({ icon: Icon, title, children, badge }: {
  icon: React.ElementType; title: string; children: React.ReactNode; badge?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center gap-2">
        <Icon className="w-4 h-4 text-[#728DA7]" />
        <h3 className="text-sm font-semibold text-[#0A0A0A]">{title}</h3>
        {badge && <span className="ml-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{badge}</span>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldRow({ label, placeholder, type = "text", sub, value, onChange }: {
  label: string; placeholder: string; type?: string; sub?: string;
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-[#F4F4F6] last:border-0">
      <div className="sm:w-48 shrink-0">
        <div className="text-sm font-medium text-[#0A0A0A]">{label}</div>
        {sub && <div className="text-xs text-[#8888A0] mt-0.5">{sub}</div>}
      </div>
      <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        className="flex-1 px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#0A0A0A] outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/15 transition-all" />
    </div>
  );
}

function ToggleRow({ label, sub, checked, onChange }: {
  label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#F4F4F6] last:border-0">
      <div>
        <div className="text-sm font-medium text-[#0A0A0A]">{label}</div>
        {sub && <div className="text-xs text-[#8888A0] mt-0.5">{sub}</div>}
      </div>
      <button onClick={() => onChange(!checked)}
        className={`w-10 h-[22px] rounded-full relative transition-colors ${checked ? "bg-[#728DA7]" : "bg-[#C8C8D8]"}`}>
        <div className={`absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

export default function SettingsTab() {
  const [announcement, setAnnouncement] = useState({ text: "", type: "info" as "info" | "warning" | "success" | "error", enabled: false });
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [platformCfg, setPlatformCfg] = useState({
    platform_name: "", support_email: "", default_domain: "", max_links_per_user: "",
    feature_user_registration: true, feature_custom_domains: true, feature_ai_insights: false,
    feature_api_access: true, feature_team_workspaces: true, feature_qr_codes: true, feature_link_expiry: true,
    limit_rate_per_min: "", limit_max_custom_domains: "", limit_click_retention_days: "", limit_max_team_members: "",
    admin_username: "", access_enforce_2fa: false, access_ip_allowlist: false,
  });
  const [platformLoaded, setPlatformLoaded] = useState(false);
  const [platformSaving, setPlatformSaving] = useState(false);
  const [platformSaved, setPlatformSaved] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [rateLimits, setRateLimits] = useState<{ name: string; path: string; windowMs: number; max: number; effectiveMax: number; overridden: boolean; description: string }[]>([]);
  const [recentBlocked, setRecentBlocked] = useState<{ total: number; byPath: Record<string, number>; lastEvents: { path: string; ip: string; timestamp: string }[] } | null>(null);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [newWhitelistIp, setNewWhitelistIp] = useState("");
  const [editingLimit, setEditingLimit] = useState<string | null>(null);
  const [editLimitValue, setEditLimitValue] = useState("");
  const [dbSizeMb, setDbSizeMb] = useState<number | null>(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadAnnouncement(); loadRateLimits(); loadPlatformSettings(); loadDbSize(); }, []);

  async function loadAnnouncement() {
    try {
      const data = await apiFetch("/admin/announcement");
      if (data) setAnnouncement({ text: data.text || "", type: data.type || "info", enabled: data.enabled ?? false });
    } catch { toast("Failed to load announcement", "error"); }
  }

  async function loadPlatformSettings() {
    try {
      const data = await apiFetch("/admin/platform-settings");
      if (data && Object.keys(data).length > 0) {
        setPlatformCfg(prev => ({ ...prev, ...data }));
      }
      setPlatformLoaded(true);
    } catch { setPlatformLoaded(true); toast("Failed to load platform settings", "error"); }
  }

  async function savePlatformSettings() {
    setPlatformSaving(true); setPlatformSaved(false);
    try {
      await apiFetch("/admin/platform-settings", { method: "POST", body: JSON.stringify(platformCfg) });
      setPlatformSaved(true);
      setTimeout(() => setPlatformSaved(false), 2000);
    } catch { toast("Failed to save settings", "error"); }
    finally { setPlatformSaving(false); }
  }

  async function changePassword() {
    if (!newPassword || newPassword.length < 4) { toast("Password must be at least 4 characters", "error"); return; }
    setPasswordSaving(true);
    try {
      await apiFetch("/admin/change-password", { method: "POST", body: JSON.stringify({ password: newPassword }) });
      setNewPassword("");
      toast("Password changed successfully. Use the new password on next login.", "success");
    } catch { toast("Failed to change password", "error"); }
    finally { setPasswordSaving(false); }
  }

  function setCfg<K extends keyof typeof platformCfg>(key: K, val: typeof platformCfg[K]) {
    setPlatformCfg(prev => ({ ...prev, [key]: val }));
  }

  async function saveAnnouncement() {
    setAnnouncementSaving(true);
    try {
      await apiFetch("/admin/announcement", { method: "POST", body: JSON.stringify(announcement) });
    } catch { toast("Failed to save announcement", "error"); }
    finally { setAnnouncementSaving(false); }
  }

  async function loadRateLimits() {
    try {
      const data = await apiFetch("/admin/rate-limits");
      setRateLimits(data.limits || []);
      setRecentBlocked(data.recentBlocked || null);
      setWhitelist(data.whitelist || []);
    } catch { toast("Failed to load rate limits", "error"); }
  }

  async function loadDbSize() {
    setDbLoading(true);
    try {
      const data = await apiFetch("/admin/health-detail");
      setDbSizeMb(data.dbSizeMb ?? null);
    } catch { setDbSizeMb(null); }
    finally { setDbLoading(false); }
  }

  async function downloadBackup() {
    setBackupLoading(true);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Backup failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^"]+)"?/);
      a.download = match?.[1] || `snipr-backup-${new Date().toISOString().slice(0, 10)}.sql`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Backup downloaded successfully", "success");
    } catch (e: any) {
      toast(e.message || "Failed to generate backup", "error");
    } finally { setBackupLoading(false); }
  }

  async function addWhitelistIp() {
    if (!newWhitelistIp.trim()) return;
    try {
      const data = await apiFetch("/admin/rate-limits/whitelist", {
        method: "POST", body: JSON.stringify({ ip: newWhitelistIp.trim(), action: "add" }),
      });
      setWhitelist(data.whitelist || []);
      setNewWhitelistIp("");
    } catch { toast("Failed to add IP", "error"); }
  }

  async function removeWhitelistIp(ip: string) {
    try {
      const data = await apiFetch("/admin/rate-limits/whitelist", {
        method: "POST", body: JSON.stringify({ ip, action: "remove" }),
      });
      setWhitelist(data.whitelist || []);
    } catch { toast("Failed to remove IP", "error"); }
  }

  async function adjustLimit(name: string, max: number | null) {
    try {
      await apiFetch("/admin/rate-limits/adjust", {
        method: "POST", body: JSON.stringify({ name, max }),
      });
      setEditingLimit(null);
      loadRateLimits();
    } catch { toast("Failed to adjust limit", "error"); }
  }


  return (
    <div className="space-y-5 max-w-4xl">
      {platformSaved && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <div className="text-sm font-medium text-green-700">Settings saved successfully</div>
        </div>
      )}

      {/* ─── General ─────────────────────────────────────────────── */}
      <Section icon={Globe} title="General Platform Settings">
        <div>
          <FieldRow label="Platform name"    placeholder="Snipr"               sub="Shown in emails and UI"
            value={platformCfg.platform_name} onChange={v => setCfg("platform_name", v)} />
          <FieldRow label="Support email"    placeholder="support@snipr.sh"    type="email"
            value={platformCfg.support_email} onChange={v => setCfg("support_email", v)} />
          <FieldRow label="Default domain"   placeholder="snipr.sh"            sub="Base domain for short links"
            value={platformCfg.default_domain} onChange={v => setCfg("default_domain", v)} />
          <FieldRow label="Max links / user" placeholder="10" type="number"    sub="Free tier limit"
            value={platformCfg.max_links_per_user} onChange={v => setCfg("max_links_per_user", v)} />
        </div>
      </Section>

      {/* ─── Feature Toggles ─────────────────────────────────────── */}
      <Section icon={ToggleLeft} title="Feature Toggles">
        <div>
          <ToggleRow label="User registration"  sub="Allow new users to sign up"
            checked={platformCfg.feature_user_registration} onChange={v => setCfg("feature_user_registration", v)} />
          <ToggleRow label="Custom domains"     sub="Allow users to connect their own domains"
            checked={platformCfg.feature_custom_domains} onChange={v => setCfg("feature_custom_domains", v)} />
          <ToggleRow label="AI Insights"        sub="Enable AI analysis for user workspaces"
            checked={platformCfg.feature_ai_insights} onChange={v => setCfg("feature_ai_insights", v)} />
          <ToggleRow label="API access"         sub="Allow users to generate API keys"
            checked={platformCfg.feature_api_access} onChange={v => setCfg("feature_api_access", v)} />
          <ToggleRow label="Team workspaces"    sub="Allow users to invite team members"
            checked={platformCfg.feature_team_workspaces} onChange={v => setCfg("feature_team_workspaces", v)} />
          <ToggleRow label="QR code downloads"  sub="Enable QR code generation on links"
            checked={platformCfg.feature_qr_codes} onChange={v => setCfg("feature_qr_codes", v)} />
          <ToggleRow label="Link expiry"        sub="Allow setting expiration dates on links"
            checked={platformCfg.feature_link_expiry} onChange={v => setCfg("feature_link_expiry", v)} />
        </div>
      </Section>

      {/* ─── Platform Limits ─────────────────────────────────────── */}
      <Section icon={Sliders} title="Platform Limits">
        <div>
          <FieldRow label="Rate limit (req/min)"  placeholder="60"  type="number" sub="Per user API rate limit"
            value={platformCfg.limit_rate_per_min} onChange={v => setCfg("limit_rate_per_min", v)} />
          <FieldRow label="Max custom domains"    placeholder="3"   type="number" sub="Per workspace (free tier)"
            value={platformCfg.limit_max_custom_domains} onChange={v => setCfg("limit_max_custom_domains", v)} />
          <FieldRow label="Click data retention"  placeholder="365" type="number" sub="Days to retain click logs"
            value={platformCfg.limit_click_retention_days} onChange={v => setCfg("limit_click_retention_days", v)} />
          <FieldRow label="Max team members"      placeholder="5"   type="number" sub="Per workspace (free tier)"
            value={platformCfg.limit_max_team_members} onChange={v => setCfg("limit_max_team_members", v)} />
        </div>
      </Section>

      {/* ─── Access Control ──────────────────────────────────────── */}
      <Section icon={ShieldCheck} title="Access Control">
        <div>
          <FieldRow label="Admin username" placeholder="admin" sub="Admin panel login username"
            value={platformCfg.admin_username} onChange={v => setCfg("admin_username", v)} />
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-[#F4F4F6]">
            <div className="sm:w-48 shrink-0">
              <div className="text-sm font-medium text-[#0A0A0A]">Admin password</div>
              <div className="text-xs text-[#8888A0] mt-0.5">Change admin login password</div>
            </div>
            <div className="flex-1 flex gap-2">
              <input type="password" placeholder="New password (min 4 chars)" value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#0A0A0A] outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/15 transition-all" />
              <button onClick={changePassword} disabled={passwordSaving || newPassword.length < 4}
                className="px-3 py-2 rounded-xl bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#1A1A2E] disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap">
                {passwordSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Update"}
              </button>
            </div>
          </div>
          <ToggleRow label="Enforce 2FA for admin" sub="Require TOTP on admin login"
            checked={platformCfg.access_enforce_2fa} onChange={v => setCfg("access_enforce_2fa", v)} />
          <ToggleRow label="IP allowlist"          sub="Restrict admin panel to specific IP ranges"
            checked={platformCfg.access_ip_allowlist} onChange={v => setCfg("access_ip_allowlist", v)} />
        </div>
      </Section>

      {/* ─── Save All Settings ──────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button onClick={savePlatformSettings} disabled={platformSaving || !platformLoaded}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-sm font-semibold hover:bg-[#1A1A2E] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          {platformSaving ? <Loader2 className="w-4 h-4 animate-spin" />
            : platformSaved ? <CheckCircle2 className="w-4 h-4 text-green-400" />
            : <Save className="w-4 h-4" />}
          {platformSaving ? "Saving…" : platformSaved ? "Saved!" : "Save All Settings"}
        </button>
        {platformSaved && <span className="text-xs text-green-600 font-medium">Changes saved to database</span>}
      </div>

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
              {(["info", "warning", "success", "error"] as const).map(t => (
                <button key={t} onClick={() => setAnnouncement(a => ({ ...a, type: t }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    announcement.type === t
                      ? t === "info" ? "bg-blue-100 text-blue-700 border border-blue-200"
                        : t === "warning" ? "bg-amber-100 text-amber-700 border border-amber-200"
                        : t === "error" ? "bg-red-100 text-red-700 border border-red-200"
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
              className="w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-sm outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/15 transition-all resize-none"
            />
          </div>
          {announcement.text && (
            <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${
              announcement.type === "warning" ? "bg-amber-50 text-amber-800 border border-amber-200"
                : announcement.type === "success" ? "bg-green-50 text-green-800 border border-green-200"
                : announcement.type === "error" ? "bg-red-50 text-red-800 border border-red-200"
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
        <div className="space-y-4">
          {rateLimits.length === 0 ? (
            <p className="text-xs text-[#8888A0]">No rate limit data available.</p>
          ) : (
            <div className="divide-y divide-[#F4F4F6]">
              {rateLimits.map((rl) => (
                <div key={rl.name} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#0A0A0A]">{rl.name}</div>
                    <div className="text-xs text-[#8888A0]">
                      <code className="bg-[#F4F4F6] px-1 rounded text-[10px]">{rl.path}</code>
                      <span className="ml-2">{rl.effectiveMax} req / {Math.round(rl.windowMs / 1000)}s</span>
                      {rl.overridden && <span className="ml-1 text-amber-600">(custom, default: {rl.max})</span>}
                    </div>
                    <div className="text-[10px] text-[#8888A0] mt-0.5">{rl.description}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {editingLimit === rl.name ? (
                      <div className="flex items-center gap-1.5">
                        <input type="number" value={editLimitValue} onChange={e => setEditLimitValue(e.target.value)}
                          className="w-20 px-2 py-1 rounded-lg border border-[#E2E8F0] text-xs" min={1} max={10000} />
                        <button onClick={() => adjustLimit(rl.name, parseInt(editLimitValue) || rl.max)}
                          className="px-2 py-1 rounded-lg bg-[#0A0A0A] text-white text-[10px] font-semibold">Save</button>
                        {rl.overridden && (
                          <button onClick={() => adjustLimit(rl.name, null)}
                            className="px-2 py-1 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-semibold">Reset</button>
                        )}
                        <button onClick={() => setEditingLimit(null)}
                          className="px-2 py-1 rounded-lg text-[#8888A0] text-[10px] hover:bg-[#F4F4F6]">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingLimit(rl.name); setEditLimitValue(String(rl.effectiveMax)); }}
                        className="px-2 py-1 rounded-lg text-[10px] text-[#728DA7] hover:bg-[#F4F4F6] border border-[#E2E8F0]">
                        <Sliders className="w-3 h-3 inline mr-1" />Adjust
                      </button>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-semibold">Active</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-3 bg-[#F8F8FC] rounded-xl border border-[#E2E8F0]">
            <div className="text-xs font-semibold text-[#0A0A0A] mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#728DA7]" />
              IP Whitelist
            </div>
            <div className="text-[10px] text-[#8888A0] mb-2">Whitelisted IPs bypass all rate limits.</div>
            <div className="flex items-center gap-2 mb-2">
              <input value={newWhitelistIp} onChange={e => setNewWhitelistIp(e.target.value)}
                placeholder="Enter IP address..." onKeyDown={e => e.key === "Enter" && addWhitelistIp()}
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs outline-none focus:border-[#728DA7]" />
              <button onClick={addWhitelistIp} disabled={!newWhitelistIp.trim()}
                className="px-3 py-1.5 rounded-lg bg-[#728DA7] text-white text-xs font-semibold hover:bg-[#5A7590] disabled:opacity-40">Add</button>
            </div>
            {whitelist.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {whitelist.map(ip => (
                  <span key={ip} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-[#E2E8F0] text-[10px] font-mono text-[#3A3A3E]">
                    {ip}
                    <button onClick={() => removeWhitelistIp(ip)} className="text-red-400 hover:text-red-600 ml-0.5">&times;</button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-[#8888A0] italic">No whitelisted IPs.</p>
            )}
          </div>

          {recentBlocked && (
            <div className="p-3 bg-[#FFF7ED] rounded-xl border border-orange-200">
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

      {/* ─── Database ────────────────────────────────────────────── */}
      <Section icon={Database} title="Database">
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-[#F4F4F6]">
            <div>
              <div className="text-sm font-medium text-[#0A0A0A]">Database Size</div>
              <div className="text-xs text-[#8888A0] mt-0.5">Current PostgreSQL database size on disk</div>
            </div>
            <div className="text-sm font-semibold text-[#0A0A0A]">
              {dbLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#728DA7]" />
              ) : dbSizeMb !== null ? (
                <span>{dbSizeMb < 1024 ? `${dbSizeMb.toFixed(1)} MB` : `${(dbSizeMb / 1024).toFixed(2)} GB`}</span>
              ) : (
                <span className="text-[#8888A0]">Unavailable</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[#0A0A0A]">Download Backup</div>
              <div className="text-xs text-[#8888A0] mt-0.5">Generate and download a full SQL dump of the database</div>
            </div>
            <button onClick={downloadBackup} disabled={backupLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#1A1A2E] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {backupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {backupLoading ? "Generating..." : "Download Backup"}
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}
