"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Link2, BarChart3, Globe, Zap, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useForgotPassword } from "@workspace/api-client-react";

const forgotSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email" }),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const mutation = useForgotPassword({
    mutation: {
      onSuccess: () => {
        setSent(true);
      },
    },
  });

  const form = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data: ForgotForm) => {
    setSentEmail(data.email);
    mutation.mutate({ data: { email: data.email } });
  };

  return (
    <div className="min-h-screen flex bg-white">
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] bg-[#0A0A0A] flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-16">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm">
              <Link2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">Snipr</span>
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Forgot your<br />password?
          </h2>
          <p className="text-white/50 text-[15px] leading-relaxed max-w-[320px]">
            No worries — we'll send you a secure link to reset it in seconds.
          </p>
        </div>
        <div className="relative z-10 space-y-4">
          {[
            { icon: BarChart3, text: "Real-time click analytics" },
            { icon: Globe, text: "Custom domain support" },
            { icon: Zap, text: "AI-powered link insights" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-white/40 text-sm">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                <item.icon className="w-4 h-4" />
              </div>
              {item.text}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[#FAFAFA]">
        <div className="w-full max-w-[380px]">
          <div className="flex flex-col items-center mb-10 lg:hidden">
            <div className="bg-[#0A0A0A] text-white p-2.5 rounded-xl mb-3">
              <Link2 className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-[#0A0A0A]">Snipr</span>
          </div>

          {sent ? (
            <div className="animate-fade-up">
              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
              </div>
              <h1 className="text-[26px] font-bold text-[#0A0A0A] tracking-tight text-center">Check your email</h1>
              <p className="text-[#6B7280] text-[15px] mt-2 text-center leading-relaxed">
                We sent a password reset link to<br />
                <span className="font-semibold text-[#374151]">{sentEmail}</span>
              </p>
              <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-[13px] text-amber-700 leading-relaxed">
                  The link will expire in 1 hour. If you don't see the email, check your spam folder.
                </p>
              </div>
              <div className="mt-8 space-y-3">
                <button
                  onClick={() => { setSent(false); form.reset(); }}
                  className="w-full h-11 rounded-xl text-[14px] font-semibold bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] transition-all active:scale-[0.98] shadow-sm"
                >
                  Try a different email
                </button>
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 w-full h-11 rounded-xl text-[14px] font-semibold text-[#6B7280] hover:text-[#0A0A0A] transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <div className="flex justify-center lg:justify-start mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                    <Mail className="w-6 h-6 text-indigo-500" />
                  </div>
                </div>
                <h1 className="text-[26px] font-bold text-[#0A0A0A] tracking-tight">Reset password</h1>
                <p className="text-[#6B7280] text-[15px] mt-1.5">Enter your email and we'll send you a reset link</p>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[13px] font-medium text-[#374151]">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    autoComplete="email"
                    autoFocus
                    {...form.register("email")}
                    className="rounded-xl h-11 text-[14px] bg-white border border-[#E5E7EB] text-[#0A0A0A] placeholder:text-[#C0C0C8] focus-visible:ring-2 focus-visible:ring-[#0A0A0A]/10 focus-visible:border-[#0A0A0A] transition-all shadow-sm"
                  />
                  {form.formState.errors.email && (
                    <p className="text-xs text-red-500 font-medium mt-1">{form.formState.errors.email.message}</p>
                  )}
                </div>

                {mutation.error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                    <p className="text-[13px] text-red-600 font-medium">Something went wrong. Please try again.</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="w-full h-11 rounded-xl text-[14px] font-semibold bg-[#0A0A0A] hover:bg-[#1F1F1F] text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {mutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending link...
                    </span>
                  ) : "Send reset link"}
                </button>
              </form>

              <p className="mt-8 text-center text-[13px] text-[#9CA3AF]">
                Remember your password?{" "}
                <Link href="/login" className="text-[#0A0A0A] font-semibold hover:underline">
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
