"use client";
import { useState } from "react";
import { ShieldCheck, Eye, EyeOff, XCircle } from "lucide-react";
import { apiFetch } from "./utils";

export default function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/admin/login", { method: "POST", body: JSON.stringify({ username, password }) });
      onLogin();
    } catch (err: any) {
      setError(err?.error ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F4F6]">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0A0A0A] mb-4 shadow-lg">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#0A0A0A]">Admin Panel</h1>
          <p className="text-sm text-[#8888A0] mt-1">Snipr platform management</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#3A3A3E] mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8F8FC] text-[#0A0A0A] text-sm outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/15 transition-all"
                placeholder="admin"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3A3A3E] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E2E8F0] bg-[#F8F8FC] text-[#0A0A0A] text-sm outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/15 transition-all"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8888A0] hover:text-[#728DA7] transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                <XCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-2.5 rounded-xl bg-[#0A0A0A] text-white text-sm font-semibold hover:bg-[#1A1A1A] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Signing in…" : "Sign in to Admin"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#8888A0] mt-6">
          Snipr Admin · Authorized access only
        </p>
      </div>
    </div>
  );
}
