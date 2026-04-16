"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart3, Globe, Zap, ShieldCheck, ArrowLeft, CheckCircle2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { SniprLogo } from "@/components/SniprLogo";
import { useResetPassword } from "@workspace/api-client-react";

const resetSchema = z.object({
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetForm = z.infer<typeof resetSchema>;

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 1, label: "Weak", color: "bg-red-400" };
  if (score <= 2) return { score: 2, label: "Fair", color: "bg-amber-400" };
  if (score <= 3) return { score: 3, label: "Good", color: "bg-blue-400" };
  return { score: 4, label: "Strong", color: "bg-emerald-400" };
}

export default function ResetPassword() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const mutation = useResetPassword({
    mutation: {
      onSuccess: () => setDone(true),
      onError: (err: any) => {
        const msg = err?.response?.data?.error || err?.message || "Something went wrong";
        setApiError(msg);
      },
    },
  });

  const form = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const watchedPassword = form.watch("password");
  const strength = useMemo(() => getPasswordStrength(watchedPassword || ""), [watchedPassword]);

  const onSubmit = (data: ResetForm) => {
    if (!token) return;
    setApiError(null);
    mutation.mutate({ data: { token, password: data.password } });
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B] px-6">
        <div className="max-w-[380px] w-full text-center animate-fade-up">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
          </div>
          <h1 className="text-[26px] font-bold text-[#FAFAFA] tracking-tight">Invalid reset link</h1>
          <p className="text-[#A1A1AA] text-[15px] mt-2 leading-relaxed">
            This password reset link is invalid or missing a token. Please request a new one.
          </p>
          <div className="mt-8 space-y-3">
            <Link
              href="/forgot-password"
              className="flex items-center justify-center w-full h-11 rounded-xl text-[14px] font-semibold text-white transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}
            >
              Request new link
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl text-[14px] font-semibold text-[#71717A] hover:text-[#FAFAFA] transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#09090B]">
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] bg-[#09090B] flex-col justify-between p-10 relative overflow-hidden border-r border-[#27272A]">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-16">
            <div className="bg-[#27272A] p-2 rounded-xl flex items-center justify-center">
              <SniprLogo size={20} color="white" />
            </div>
            <span className="font-bold text-lg text-[#FAFAFA] tracking-tight">Snipr</span>
          </div>
          <h2 className="text-3xl font-bold text-[#FAFAFA] leading-tight mb-4">
            Set your new<br />password
          </h2>
          <p className="text-[#71717A] text-[15px] leading-relaxed max-w-[320px]">
            Choose a strong password to keep your account and links secure.
          </p>
        </div>
        <div className="relative z-10 space-y-4">
          {[
            { icon: BarChart3, text: "Real-time click analytics" },
            { icon: Globe, text: "Custom domain support" },
            { icon: Zap, text: "AI-powered link insights" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-[#71717A] text-sm">
              <div className="w-8 h-8 rounded-lg bg-[#27272A] flex items-center justify-center">
                <item.icon className="w-4 h-4" />
              </div>
              {item.text}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[#09090B]">
        <div className="w-full max-w-[380px]">
          <div className="flex flex-col items-center mb-10 lg:hidden">
            <div className="bg-[#18181B] p-2.5 rounded-xl mb-3 flex items-center justify-center border border-[#27272A]">
              <SniprLogo size={20} color="white" />
            </div>
            <span className="font-bold text-lg text-[#FAFAFA]">Snipr</span>
          </div>

          {done ? (
            <div className="animate-fade-up">
              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-[#10B981]" />
                </div>
              </div>
              <h1 className="text-[26px] font-bold text-[#FAFAFA] tracking-tight text-center">Password reset!</h1>
              <p className="text-[#A1A1AA] text-[15px] mt-2 text-center leading-relaxed">
                Your password has been updated successfully. You can now sign in with your new password.
              </p>
              <div className="mt-8">
                <Link
                  href="/login"
                  className="flex items-center justify-center w-full h-11 rounded-xl text-[14px] font-semibold text-white transition-all active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}
                >
                  Sign in
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <div className="flex justify-center lg:justify-start mb-6">
                  <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-[#8B5CF6]" />
                  </div>
                </div>
                <h1 className="text-[26px] font-bold text-[#FAFAFA] tracking-tight">Create new password</h1>
                <p className="text-[#A1A1AA] text-[15px] mt-1.5">Your new password must be at least 8 characters</p>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-[13px] font-medium text-[#A1A1AA]">New password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      autoFocus
                      {...form.register("password")}
                      className="rounded-xl h-11 text-[14px] bg-[#18181B] border border-[#27272A] text-[#FAFAFA] placeholder:text-[#52525B] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/20 focus-visible:border-[#8B5CF6] transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#A1A1AA] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {watchedPassword && (
                    <div className="pt-1.5 space-y-1.5">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all ${
                              i <= strength.score ? strength.color : "bg-[#27272A]"
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-[11px] font-medium ${
                        strength.score <= 1 ? "text-red-500" :
                        strength.score <= 2 ? "text-amber-500" :
                        strength.score <= 3 ? "text-blue-500" : "text-emerald-500"
                      }`}>{strength.label}</p>
                    </div>
                  )}
                  {form.formState.errors.password && (
                    <p className="text-xs text-red-500 font-medium mt-1">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-[13px] font-medium text-[#A1A1AA]">Confirm password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      {...form.register("confirmPassword")}
                      className="rounded-xl h-11 text-[14px] bg-[#18181B] border border-[#27272A] text-[#FAFAFA] placeholder:text-[#52525B] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/20 focus-visible:border-[#8B5CF6] transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#A1A1AA] transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {form.formState.errors.confirmPassword && (
                    <p className="text-xs text-red-500 font-medium mt-1">{form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                {apiError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-[13px] text-red-400 font-medium">{apiError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="w-full h-11 rounded-xl text-[14px] font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}
                >
                  {mutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Resetting...
                    </span>
                  ) : "Reset password"}
                </button>
              </form>

              <p className="mt-8 text-center text-[13px] text-[#71717A]">
                Remember your password?{" "}
                <Link href="/login" className="text-[#8B5CF6] font-semibold hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
