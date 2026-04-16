"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Users, Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { SniprLogo } from "@/components/SniprLogo";
import Link from "next/link";

interface InviteInfo {
  email: string;
  role: string;
  status: string;
  workspaceName: string;
}

export default function JoinTeam() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const { user, isLoading: authLoading } = useAuth();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Fetch invite details
  useEffect(() => {
    if (!token) {
      setError("No invitation token provided");
      setLoading(false);
      return;
    }
    fetch(`/api/team/invite/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Invalid invitation");
        }
        return res.json();
      })
      .then((data) => {
        setInvite(data);
        if (data.status === "active") setAccepted(true);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  // Auto-accept if logged in user matches invite email
  useEffect(() => {
    if (!invite || !user || accepted || accepting || invite.status === "active") return;
    if (user.email === invite.email) {
      handleAccept();
    }
  }, [invite, user]);

  async function handleAccept() {
    if (!token) return;
    setAccepting(true);
    try {
      const res = await fetch("/api/team/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to accept invitation");
      }
      setAccepted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#71717A]" />
          <p className="text-[#A1A1AA] text-sm">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B]">
        <div className="max-w-md w-full mx-4">
          <div className="bg-[#18181B] rounded-xl border border-[#27272A] p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-7 h-7 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-[#FAFAFA] mb-2">Invalid Invitation</h1>
            <p className="text-[#A1A1AA] text-sm mb-6">{error}</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-all"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B]">
        <div className="max-w-md w-full mx-4">
          <div className="bg-[#18181B] rounded-xl border border-[#27272A] p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[#10B981]/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-[#10B981]" />
            </div>
            <h1 className="text-xl font-bold text-[#FAFAFA] mb-2">You're in!</h1>
            <p className="text-[#A1A1AA] text-sm mb-6">
              You've joined <strong className="text-[#E4E4E7]">{invite?.workspaceName}</strong> as a <strong className="text-[#E4E4E7]">{invite?.role}</strong>.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-2 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-all"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // User is logged in but email doesn't match
  if (user && invite && user.email !== invite.email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B]">
        <div className="max-w-md w-full mx-4">
          <div className="bg-[#18181B] rounded-xl border border-[#27272A] p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-amber-400" />
            </div>
            <h1 className="text-xl font-bold text-[#FAFAFA] mb-2">Email Mismatch</h1>
            <p className="text-[#A1A1AA] text-sm mb-2">
              This invitation was sent to <strong className="text-[#E4E4E7]">{invite.email}</strong>, but you're logged in as <strong className="text-[#E4E4E7]">{user.email}</strong>.
            </p>
            <p className="text-[#A1A1AA] text-sm mb-6">
              Please log out and sign in with <strong className="text-[#E4E4E7]">{invite.email}</strong>, or create a new account with that email.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-all w-full"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}
              >
                Log In with Different Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in — show invitation details + signup/login options
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090B]">
      <div className="max-w-md w-full mx-4">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-[#18181B] p-2.5 rounded-xl mb-3 flex items-center justify-center border border-[#27272A]">
            <SniprLogo size={20} color="white" />
          </div>
          <span className="font-bold text-lg text-[#FAFAFA]">Snipr</span>
        </div>

        <div className="bg-[#18181B] rounded-xl border border-[#27272A] p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-[#8B5CF6]" />
            </div>
            <h1 className="text-xl font-bold text-[#FAFAFA] mb-2">You're Invited!</h1>
            <p className="text-[#A1A1AA] text-sm">
              You've been invited to join <strong className="text-[#E4E4E7]">{invite?.workspaceName}</strong> as a <strong className="text-[#E4E4E7]">{invite?.role}</strong>.
            </p>
          </div>

          <div className="bg-[#27272A]/50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#8B5CF6]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#FAFAFA]">{invite?.workspaceName}</p>
                <p className="text-xs text-[#A1A1AA]">Role: {invite?.role}</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-[#A1A1AA] text-center mb-4">
            Create an account or sign in to accept this invitation.
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href={`/signup?invite=${token}`}
              className="inline-flex items-center justify-center gap-2 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-all w-full"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}
            >
              Create Account <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={`/login?invite=${token}`}
              className="inline-flex items-center justify-center gap-2 bg-[#18181B] hover:bg-[#27272A] text-[#E4E4E7] text-sm font-semibold px-6 py-3 rounded-xl border border-[#27272A] transition-all w-full"
            >
              I Already Have an Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
