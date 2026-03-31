"use client";
import { useState } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import {
  User, Mail, Lock, Shield, Trash2, Eye, EyeOff,
  Loader2, CheckCircle2, AlertTriangle, Settings as SettingsIcon,
  KeyRound, UserCircle,
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
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = name.trim() !== (user?.name ?? "") || email.trim().toLowerCase() !== (user?.email ?? "");

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  return (
    <div className="bg-white rounded-2xl border border-[#E4E8F0] overflow-hidden sf-card-hover">
      <div className="px-6 py-5 border-b border-[#E4E8F0] bg-gradient-to-r from-[#FAFBFF] to-[#F8F7FF]">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center shadow-[0_4px_12px_rgba(79,70,229,0.3)]">
            <span className="text-white text-[18px] font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[16px] font-bold text-[#111827]">{user?.name || "Your Profile"}</h2>
            <p className="text-[12px] text-[#9CA3AF] truncate">{user?.email}</p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#9CA3AF]">
                <UserCircle className="w-3 h-3" />
                Member since {user?.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "—"}
              </span>
              {user?.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" /> Unverified
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E8F0] bg-white text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] transition-all placeholder:text-[#CBD5E1]"
            placeholder="Your full name"
          />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E8F0] bg-white text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] transition-all placeholder:text-[#CBD5E1]"
            placeholder="you@example.com"
          />
          {email.trim().toLowerCase() !== (user?.email ?? "") && (
            <p className="mt-1.5 text-[11px] text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Changing your email will require re-verification
            </p>
          )}
        </div>
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[13px] font-semibold active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all sf-btn-primary"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? "Saving…" : "Save Changes"}
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
    <div className="bg-white rounded-2xl border border-[#E4E8F0] overflow-hidden sf-card-hover">
      <div className="px-6 py-5 border-b border-[#E4E8F0]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
            <KeyRound className="w-4.5 h-4.5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-[#111827]">Change Password</h2>
            <p className="text-[12px] text-[#9CA3AF]">Update your password to keep your account secure</p>
          </div>
        </div>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Current Password</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E4E8F0] bg-white text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] transition-all placeholder:text-[#CBD5E1]"
              placeholder="Enter current password"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">New Password</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E4E8F0] bg-white text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] transition-all placeholder:text-[#CBD5E1]"
              placeholder="Enter new password (min 8 characters)"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {newPassword && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3].map((level) => (
                  <div key={level} className={`h-1 flex-1 rounded-full transition-all duration-300 ${level <= strengthLevel ? strengthColors[strengthLevel] : "bg-[#E2E8F0]"}`} />
                ))}
              </div>
              <p className={`text-[10px] font-medium ${strengthLevel <= 1 ? "text-red-500" : strengthLevel === 2 ? "text-amber-500" : "text-emerald-500"}`}>
                {strengthLabels[strengthLevel]}
              </p>
            </div>
          )}
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E8F0] bg-white text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] transition-all placeholder:text-[#CBD5E1]"
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#111827] text-white text-[13px] font-semibold hover:bg-[#1F2937] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {saving ? "Updating…" : "Update Password"}
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
    <div className="bg-white rounded-2xl border border-red-200/80 overflow-hidden">
      <div className="px-6 py-5 border-b border-red-100 bg-gradient-to-r from-red-50/50 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
            <Trash2 className="w-4.5 h-4.5 text-red-500" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-red-700">Danger Zone</h2>
            <p className="text-[12px] text-red-400">Irreversible and destructive actions</p>
          </div>
        </div>
      </div>
      <div className="px-6 py-5">
        {!showConfirm ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-[#111827]">Delete your account</p>
              <p className="text-[12px] text-[#9CA3AF]">Permanently remove your account and all associated data</p>
            </div>
            <button
              onClick={() => setShowConfirm(true)}
              className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-[12px] font-semibold hover:bg-red-50 transition-all hover:border-red-300"
            >
              Delete Account
            </button>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-up">
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-[12px] text-red-700 font-medium">This action cannot be undone. All your links, analytics data, and workspace will be permanently deleted.</p>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Enter your password to confirm</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-red-200 bg-white text-[13px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition-all placeholder:text-[#CBD5E1]"
                placeholder="Your password"
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => { setShowConfirm(false); setPassword(""); }}
                className="px-4 py-2 rounded-xl text-[12px] font-medium text-[#6B7280] hover:bg-[#F3F4F9] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || !password}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-[12px] font-semibold hover:bg-red-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {deleting ? "Deleting…" : "Permanently Delete"}
              </button>
            </div>
          </div>
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F3F4F9] to-[#E8E9F3] flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-[#6B7280]" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Settings</h1>
            <p className="text-[13px] text-[#9CA3AF]">Manage your account and preferences</p>
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
            <DangerZone />
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
