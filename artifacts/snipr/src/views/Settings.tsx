"use client";
import { useState } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMeQueryKey,
  useListApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  getListApiKeysQueryKey,
} from "@workspace/api-client-react";
import type { ApiKey, CreatedApiKey } from "@workspace/api-client-react";
import {
  User, Mail, Lock, Shield, Trash2, Eye, EyeOff,
  Loader2, CheckCircle2, AlertTriangle, Settings as SettingsIcon,
  KeyRound, UserCircle, Copy, Plus, Check,
} from "lucide-react";
import { format } from "date-fns";

function ProfileSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Update failed", description: data.error, variant: "destructive" });
        return;
      }
      if (data.user) {
        queryClient.setQueryData(getGetMeQueryKey(), data);
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setName(data.user.name ?? "");
        setEmail(data.user.email ?? "");
      }
      toast({ title: "Profile updated", description: data.message === "No changes" ? "No changes were made." : "Your profile has been updated." });
    } catch (err) {
      console.error("[Settings] profile save failed:", err);
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = name.trim() !== (user?.name ?? "") || email.trim().toLowerCase() !== (user?.email ?? "").toLowerCase();

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  return (
    <div className="overflow-hidden bg-[#18181B] border border-[#27272A] rounded-xl">
      <div className="px-6 py-5 border-b border-[#27272A] bg-[#18181B]">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA] flex items-center justify-center">
            <span className="text-white text-[18px] font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[16px] font-bold text-[#FAFAFA]">{user?.name || "Your Profile"}</h2>
            <p className="text-[12px] text-[#A1A1AA] truncate">{user?.email}</p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#A1A1AA]">
                <UserCircle className="w-3 h-3" />
                Member since {user?.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "\u2014"}
              </span>
              {user?.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" /> Unverified
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className="block text-[12px] font-semibold text-[#71717A] mb-1.5">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg text-[13px] text-[#E4E4E7] bg-[#09090B] border border-[#27272A] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/10 focus:border-[#8B5CF6]/40 transition-all placeholder:text-[#71717A]"
            placeholder="Your full name"
          />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-[#71717A] mb-1.5">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg text-[13px] text-[#E4E4E7] bg-[#09090B] border border-[#27272A] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/10 focus:border-[#8B5CF6]/40 transition-all placeholder:text-[#71717A]"
            placeholder="you@example.com"
          />
          {email.trim().toLowerCase() !== (user?.email ?? "") && (
            <p className="mt-1.5 text-[11px] text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Changing your email will require re-verification
            </p>
          )}
        </div>
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-[13px] font-semibold active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? "Saving\u2026" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordSection() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function handleChangePassword() {
    if (!currentPassword) {
      toast({ title: "Enter your current password", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "New password must be at least 8 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = currentPassword && newPassword.length >= 8 && newPassword === confirmPassword;

  const strengthLevel = newPassword.length === 0 ? 0 : newPassword.length < 8 ? 1 : newPassword.length < 12 ? 2 : 3;
  const strengthColors = ["", "bg-red-400", "bg-amber-400", "bg-emerald-400"];
  const strengthLabels = ["", "Weak", "Good", "Strong"];

  return (
    <div className="overflow-hidden bg-[#18181B] border border-[#27272A] rounded-xl">
      <div className="px-6 py-5 border-b border-[#27272A] bg-[#18181B]">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
          >
            <KeyRound className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-[#FAFAFA]">Change Password</h2>
            <p className="text-[12px] text-[#A1A1AA]">Update your password to keep your account secure</p>
          </div>
        </div>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className="block text-[12px] font-semibold text-[#71717A] mb-1.5">Current Password</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 pr-10 rounded-lg text-[13px] text-[#E4E4E7] bg-[#09090B] border border-[#27272A] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/10 focus:border-[#8B5CF6]/40 transition-all placeholder:text-[#71717A]"
              placeholder="Enter current password"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#71717A] transition-colors"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-[#71717A] mb-1.5">New Password</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 pr-10 rounded-lg text-[13px] text-[#E4E4E7] bg-[#09090B] border border-[#27272A] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/10 focus:border-[#8B5CF6]/40 transition-all placeholder:text-[#71717A]"
              placeholder="Enter new password (min 8 characters)"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#71717A] transition-colors"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {newPassword && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3].map((level) => (
                  <div key={level} className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${level <= strengthLevel ? strengthColors[strengthLevel] : "bg-[#27272A]"}`} />
                ))}
              </div>
              <p className={`text-[10px] font-medium ${strengthLevel <= 1 ? "text-red-500" : strengthLevel === 2 ? "text-amber-500" : "text-emerald-500"}`}>
                {strengthLabels[strengthLevel]}
              </p>
            </div>
          )}
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-[#71717A] mb-1.5">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg text-[13px] text-[#E4E4E7] bg-[#09090B] border border-[#27272A] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/10 focus:border-[#8B5CF6]/40 transition-all placeholder:text-[#71717A]"
            placeholder="Confirm new password"
          />
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="mt-1.5 text-[11px] text-red-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Passwords don't match
            </p>
          )}
          {confirmPassword && confirmPassword === newPassword && newPassword.length >= 8 && (
            <p className="mt-1.5 text-[11px] text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Passwords match
            </p>
          )}
        </div>
        <div className="flex justify-end pt-2">
          <button
            onClick={handleChangePassword}
            disabled={saving || !canSubmit}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-[13px] font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all bg-[#27272A] border border-[#3F3F46]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {saving ? "Updating\u2026" : "Update Password"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DangerZone() {
  const { toast } = useToast();
  const { logout } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!password) {
      toast({ title: "Enter your password to confirm", variant: "destructive" });
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Account deleted", description: "Your account has been permanently deleted." });
      logout();
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="overflow-hidden bg-[#18181B] border border-red-500/20 rounded-xl">
      <div className="px-6 py-5 border-b border-red-500/15 bg-red-500/5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #EF4444, #DC2626)" }}
          >
            <Trash2 className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-[#F87171]">Danger Zone</h2>
            <p className="text-[12px] text-red-400/70">Irreversible and destructive actions</p>
          </div>
        </div>
      </div>
      <div className="px-6 py-5">
        {!showConfirm ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-[#FAFAFA]">Delete your account</p>
              <p className="text-[12px] text-[#A1A1AA]">Permanently remove your account and all associated data</p>
            </div>
            <button
              onClick={() => setShowConfirm(true)}
              className="px-4 py-2 rounded-lg border border-red-500/30 text-[#F87171] text-[12px] font-semibold hover:bg-red-500/10 transition-all hover:border-red-500/50"
            >
              Delete Account
            </button>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-up">
            <div className="p-3 rounded-lg bg-red-500/8 border border-red-500/15">
              <p className="text-[12px] text-[#F87171] font-medium">This action cannot be undone. All your links, analytics data, and workspace will be permanently deleted.</p>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#71717A] mb-1.5">Enter your password to confirm</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg text-[13px] text-[#E4E4E7] bg-[#09090B] border border-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/40 transition-all placeholder:text-[#71717A]"
                placeholder="Your password"
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => { setShowConfirm(false); setPassword(""); }}
                className="px-4 py-2 rounded-lg text-[12px] font-medium text-[#71717A] hover:bg-[#27272A] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || !password}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[12px] font-semibold active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{ background: "linear-gradient(135deg, #EF4444, #DC2626)" }}
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {deleting ? "Deleting\u2026" : "Permanently Delete"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ApiKeysSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: keys = [], isLoading } = useListApiKeys({
    query: { queryKey: getListApiKeysQueryKey() },
  });
  const createMutation = useCreateApiKey();
  const revokeMutation = useRevokeApiKey();

  const [newKeyName, setNewKeyName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [justCreated, setJustCreated] = useState<CreatedApiKey | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const activeKeys = (keys as ApiKey[]).filter((k) => !k.revokedAt);

  async function handleCreate() {
    if (!newKeyName.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    try {
      const result = await createMutation.mutateAsync({ data: { name: newKeyName.trim() } });
      setJustCreated(result);
      setNewKeyName("");
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
    } catch (err: any) {
      toast({ title: err?.message || "Failed to create API key", variant: "destructive" });
    }
  }

  async function handleRevoke(id: string, name: string) {
    if (!confirm(`Revoke API key "${name}"? Anything using it will start getting 401 errors immediately. This cannot be undone.`)) return;
    try {
      await revokeMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
      toast({ title: "API key revoked" });
    } catch (err: any) {
      toast({ title: err?.message || "Failed to revoke key", variant: "destructive" });
    }
  }

  function copyJustCreated() {
    if (!justCreated?.key) return;
    navigator.clipboard.writeText(justCreated.key).then(() => {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }).catch(() => toast({ title: "Failed to copy", variant: "destructive" }));
  }

  return (
    <div className="rounded-xl bg-[#18181B] border border-[#27272A] p-6">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-[16px] font-bold text-[#FAFAFA] flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#A78BFA]" /> API Keys
          </h2>
          <p className="text-[12px] text-[#71717A] mt-0.5">
            Use these to call <code className="text-[#A1A1AA]">/api/conversions</code> from your server. Pass <code className="text-[#A1A1AA]">X-API-Key</code> in the header.
          </p>
        </div>
        {!showCreate && !justCreated && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}
          >
            <Plus className="w-3.5 h-3.5" /> New key
          </button>
        )}
      </div>

      {justCreated && (
        <div
          className="mt-4 rounded-lg p-4"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)" }}
        >
          <p className="text-[12px] font-semibold text-[#34D399] mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> API key created — copy it now
          </p>
          <p className="text-[11px] text-[#86EFAC] mb-2">
            This is the only time we&apos;ll show you the full secret. Store it somewhere safe.
          </p>
          <div className="flex items-center gap-2 p-2 rounded bg-[#09090B] border border-[#27272A]">
            <code className="flex-1 text-[12px] font-mono text-[#E4E4E7] truncate">{justCreated.key}</code>
            <button
              onClick={copyJustCreated}
              className="px-3 py-1.5 rounded text-[11px] font-semibold text-white bg-[#27272A] hover:bg-[#3F3F46] flex items-center gap-1"
            >
              {copiedKey ? <><Check className="w-3 h-3 text-[#10B981]" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>
          <button
            onClick={() => setJustCreated(null)}
            className="mt-3 text-[11px] text-[#86EFAC] hover:text-[#34D399]"
          >
            I&apos;ve saved the key — dismiss
          </button>
        </div>
      )}

      {showCreate && (
        <div className="mt-4 rounded-lg p-4 bg-[#09090B] border border-[#27272A]">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#A1A1AA] block mb-2">
            Key name
          </label>
          <input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g. Production server, Stripe webhook"
            maxLength={80}
            className="w-full h-10 rounded-lg px-3 text-[13px] text-[#E4E4E7] bg-[#18181B] border border-[#27272A] outline-none focus:border-[#8B5CF6]/40 focus:ring-2 focus:ring-[#8B5CF6]/10"
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newKeyName.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}
            >
              {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewKeyName(""); }}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#A1A1AA] hover:text-[#E4E4E7]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-[#71717A]" />
          </div>
        ) : activeKeys.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-[#71717A]">
            No API keys yet. Create one to start tracking conversions from your server.
          </div>
        ) : (
          activeKeys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between p-3 rounded-lg bg-[#09090B] border border-[#27272A]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#E4E4E7] truncate">{k.name}</p>
                <p className="text-[11px] font-mono text-[#71717A] mt-0.5">
                  {k.keyPrefix}…&nbsp;
                  <span className="text-[#52525B]">
                    · created {format(new Date(k.createdAt), "MMM d, yyyy")}
                    {k.lastUsedAt && ` · last used ${format(new Date(k.lastUsedAt), "MMM d, yyyy")}`}
                    {!k.lastUsedAt && " · never used"}
                  </span>
                </p>
              </div>
              <button
                onClick={() => handleRevoke(k.id, k.name)}
                disabled={revokeMutation.isPending}
                className="ml-3 p-1.5 rounded text-[#71717A] hover:text-[#EF4444] hover:bg-[#EF4444]/10 disabled:opacity-50"
                title="Revoke key"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedLayout>
      <div className="flex-1 px-4 sm:px-8 py-8 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-8 animate-fade-up">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}
          >
            <SettingsIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[28px] font-[family-name:var(--font-space-grotesk)] font-extrabold tracking-[-0.02em] text-[#FAFAFA]">Settings</h1>
            <p className="text-[13px] text-[#A1A1AA]">Manage your account and preferences</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="animate-fade-up" style={{ animationDelay: "60ms" }}>
            <ProfileSection />
          </div>
          <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
            <PasswordSection />
          </div>
          <div className="animate-fade-up" style={{ animationDelay: "180ms" }}>
            <ApiKeysSection />
          </div>
          <div className="animate-fade-up" style={{ animationDelay: "240ms" }}>
            <DangerZone />
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
