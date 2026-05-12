"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Shield, Sparkles, Check } from "lucide-react";
import { SniprLogo } from "@/components/SniprLogo";

const registerSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  email: z.string().email({ message: "Please enter a valid email" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

type RegisterForm = z.infer<typeof registerSchema>;

const PLANS = [
  { id: "free",     name: "Free",     price: "$0",   sub: "10K clicks/month · 5 links · no card needed", recommended: true,  free: true },
  { id: "starter",  name: "Starter",  price: "$4",   sub: "1M clicks/month · 1 custom domain", recommended: false, free: false },
  { id: "growth",   name: "Growth",   price: "$12",  sub: "5M clicks/month · 3 custom domains · UTM builder", recommended: false, free: false },
  { id: "pro",      name: "Pro",      price: "$29",  sub: "25M clicks/month · 10 domains · pixels & rules", recommended: false, free: false },
  { id: "business", name: "Business", price: "$79",  sub: "100M clicks/month · unlimited domains · team", recommended: false, free: false },
] as const;

export default function Signup() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const presetPlan = (searchParams.get("plan") || "free") as typeof PLANS[number]["id"];
  const [selectedPlan, setSelectedPlan] = useState<string>(presetPlan);

  // Free signups go straight to the dashboard. Paid plans collect card at
  // /checkout (no trial — the Free tier is the no-card option). Invited team
  // members still respect the invite redirect.
  const redirectTo = inviteToken
    ? `/join?token=${inviteToken}`
    : selectedPlan === "free"
      ? "/dashboard"
      : `/checkout?plan=${selectedPlan}&new=1`;

  const { register: authRegister, isRegistering } = useAuth({ redirectTo });

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" }
  });

  const onSubmit = (data: RegisterForm) => {
    authRegister(data);
  };

  return (
    <div className="min-h-screen flex bg-[#09090B]">
      {/* Left side - Brand */}
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
            Start free.<br />Upgrade when you grow.
          </h2>
          <p className="text-[#71717A] text-[15px] leading-relaxed max-w-[320px]">
            The Free plan gives you 10K clicks/month and 5 links — no card needed. Upgrade anytime for unlimited links, more clicks, and custom domains.
          </p>
        </div>
        <div className="relative z-10 space-y-3">
          {[
            { icon: CheckCircle2, text: "No credit card required for Free plan" },
            { icon: Shield, text: "Enterprise-grade security & privacy" },
            { icon: Sparkles, text: "AI insights included on all plans" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-[#71717A] text-sm">
              <item.icon className="w-4 h-4 shrink-0" />
              {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[#09090B]">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-10 lg:hidden">
            <div className="bg-[#18181B] p-2.5 rounded-xl mb-3 flex items-center justify-center border border-[#27272A]">
              <SniprLogo size={20} color="white" />
            </div>
            <span className="font-bold text-lg text-[#FAFAFA]">Snipr</span>
          </div>

          <div className="mb-6">
            <h1 className="text-[26px] font-bold text-[#FAFAFA] tracking-tight">Create your account</h1>
            <p className="text-[#71717A] text-[15px] mt-1.5">Start on the Free plan — upgrade any time.</p>
          </div>

          {/* Plan picker — hidden when joining via team invite */}
          {!inviteToken && (
            <div className="mb-6">
              <Label className="text-[13px] font-medium text-[#A1A1AA] mb-2 block">Choose your plan</Label>
              <div className="space-y-2">
                {PLANS.map((p) => {
                  const isSelected = selectedPlan === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlan(p.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${
                        isSelected
                          ? "bg-[#8B5CF6]/10 border-[#8B5CF6]/50"
                          : "bg-[#18181B] border-[#27272A] hover:border-[#3F3F46]"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? "border-[#8B5CF6] bg-[#8B5CF6]" : "border-[#3F3F46]"
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-[#FAFAFA]">{p.name}</span>
                          {p.free && <span className="text-[9px] font-bold text-[#34D399] bg-[#10B981]/15 border border-[#10B981]/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Free forever</span>}
                          {p.recommended && !p.free && <span className="text-[9px] font-bold text-[#FAFAFA] bg-[#27272A] px-1.5 py-0.5 rounded uppercase tracking-wider">Popular</span>}
                        </div>
                        <p className="text-[11px] text-[#71717A] mt-0.5 truncate">{p.sub}</p>
                      </div>
                      <span className="text-[13px] font-bold text-[#FAFAFA] shrink-0">{p.price}<span className="text-[10px] text-[#71717A] font-normal">/mo</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-[13px] font-medium text-[#A1A1AA]">Full name</Label>
              <Input
                id="name"
                placeholder="Jane Doe"
                autoComplete="name"
                {...form.register("name")}
                className="rounded-xl h-11 text-[14px] bg-[#18181B] border border-[#27272A] text-[#FAFAFA] placeholder:text-[#52525B] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/20 focus-visible:border-[#8B5CF6] transition-all"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-red-500 font-medium mt-1">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium text-[#A1A1AA]">Work email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                autoComplete="email"
                {...form.register("email")}
                className="rounded-xl h-11 text-[14px] bg-[#18181B] border border-[#27272A] text-[#FAFAFA] placeholder:text-[#52525B] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/20 focus-visible:border-[#8B5CF6] transition-all"
              />
              {form.formState.errors.email && (
                <p className="text-xs text-red-500 font-medium mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] font-medium text-[#A1A1AA]">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                {...form.register("password")}
                className="rounded-xl h-11 text-[14px] bg-[#18181B] border border-[#27272A] text-[#FAFAFA] placeholder:text-[#52525B] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/20 focus-visible:border-[#8B5CF6] transition-all"
              />
              {form.formState.errors.password && (
                <p className="text-xs text-red-500 font-medium mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isRegistering}
              className="w-full h-11 rounded-xl text-[14px] font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}
            >
              {isRegistering ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (inviteToken ? "Join workspace" : "Continue to checkout")}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-[#71717A] leading-relaxed">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-[#A1A1AA]">Terms</Link> and{" "}
            <Link href="/privacy" className="underline hover:text-[#A1A1AA]">Privacy Policy</Link>
          </p>

          <p className="mt-4 text-center text-[13px] text-[#71717A]">
            Already have an account?{" "}
            <Link href="/login" className="text-[#8B5CF6] font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
