"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Shield, Sparkles } from "lucide-react";
import { SniprLogo } from "@/components/SniprLogo";

const registerSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  email: z.string().email({ message: "Please enter a valid email" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Signup() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const { register: authRegister, isRegistering } = useAuth(
    inviteToken ? { redirectTo: `/join?token=${inviteToken}` } : undefined
  );

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" }
  });

  const onSubmit = (data: RegisterForm) => {
    authRegister(data);
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left side - Brand */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] bg-[#0A0A0A] flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-16">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm flex items-center justify-center">
              <SniprLogo size={20} color="white" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">Snipr</span>
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Start free.<br />Scale infinitely.
          </h2>
          <p className="text-white/50 text-[15px] leading-relaxed max-w-[320px]">
            Join thousands of marketers and developers who trust Snipr for link intelligence.
          </p>
        </div>
        <div className="relative z-10 space-y-3">
          {[
            { icon: CheckCircle2, text: "Free forever for up to 1,000 links" },
            { icon: Shield, text: "Enterprise-grade security & privacy" },
            { icon: Sparkles, text: "AI insights included on all plans" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-white/40 text-sm">
              <item.icon className="w-4 h-4 shrink-0" />
              {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[#FAFAFA]">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-10 lg:hidden">
            <div className="bg-[#0A0A0A] p-2.5 rounded-xl mb-3 flex items-center justify-center">
              <SniprLogo size={20} color="white" />
            </div>
            <span className="font-bold text-lg text-[#0A0A0A]">Snipr</span>
          </div>

          <div className="mb-8">
            <h1 className="text-[26px] font-bold text-[#0A0A0A] tracking-tight">Create your account</h1>
            <p className="text-[#7A7A84] text-[15px] mt-1.5">Get started in under 30 seconds</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-[13px] font-medium text-[#3A3A3E]">Full name</Label>
              <Input
                id="name"
                placeholder="Jane Doe"
                autoComplete="name"
                {...form.register("name")}
                className="rounded-xl h-11 text-[14px] bg-white border border-[#E2E8F0] text-[#0A0A0A] placeholder:text-[#C0C0C8] focus-visible:ring-2 focus-visible:ring-[#0A0A0A]/10 focus-visible:border-[#0A0A0A] transition-all shadow-sm"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-red-500 font-medium mt-1">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium text-[#3A3A3E]">Work email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                autoComplete="email"
                {...form.register("email")}
                className="rounded-xl h-11 text-[14px] bg-white border border-[#E2E8F0] text-[#0A0A0A] placeholder:text-[#C0C0C8] focus-visible:ring-2 focus-visible:ring-[#0A0A0A]/10 focus-visible:border-[#0A0A0A] transition-all shadow-sm"
              />
              {form.formState.errors.email && (
                <p className="text-xs text-red-500 font-medium mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] font-medium text-[#3A3A3E]">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                {...form.register("password")}
                className="rounded-xl h-11 text-[14px] bg-white border border-[#E2E8F0] text-[#0A0A0A] placeholder:text-[#C0C0C8] focus-visible:ring-2 focus-visible:ring-[#0A0A0A]/10 focus-visible:border-[#0A0A0A] transition-all shadow-sm"
              />
              {form.formState.errors.password && (
                <p className="text-xs text-red-500 font-medium mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isRegistering}
              className="w-full h-11 rounded-xl text-[14px] font-semibold bg-[#0A0A0A] hover:bg-[#1F1F1F] text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isRegistering ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-[#7A7A84] leading-relaxed">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-[#7A7A84]">Terms</Link> and{" "}
            <Link href="/privacy" className="underline hover:text-[#7A7A84]">Privacy Policy</Link>
          </p>

          <p className="mt-4 text-center text-[13px] text-[#7A7A84]">
            Already have an account?{" "}
            <Link href="/login" className="text-[#0A0A0A] font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
