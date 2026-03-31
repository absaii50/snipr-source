"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Link2, BarChart3, Globe, Zap } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { login, isLoggingIn } = useAuth();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  const onSubmit = (data: LoginForm) => {
    login(data);
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left side - Brand */}
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
            Shorten links.<br />Amplify results.
          </h2>
          <p className="text-white/50 text-[15px] leading-relaxed max-w-[320px]">
            The intelligent link management platform trusted by teams worldwide.
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

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[#FAFAFA]">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-10 lg:hidden">
            <div className="bg-[#0A0A0A] text-white p-2.5 rounded-xl mb-3">
              <Link2 className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-[#0A0A0A]">Snipr</span>
          </div>

          <div className="mb-8">
            <h1 className="text-[26px] font-bold text-[#0A0A0A] tracking-tight">Welcome back</h1>
            <p className="text-[#6B7280] text-[15px] mt-1.5">Enter your credentials to access your account</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium text-[#374151]">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                autoComplete="email"
                {...form.register("email")}
                className="rounded-xl h-11 text-[14px] bg-white border border-[#E5E7EB] text-[#0A0A0A] placeholder:text-[#C0C0C8] focus-visible:ring-2 focus-visible:ring-[#0A0A0A]/10 focus-visible:border-[#0A0A0A] transition-all shadow-sm"
              />
              {form.formState.errors.email && (
                <p className="text-xs text-red-500 font-medium mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[13px] font-medium text-[#374151]">Password</Label>
                <Link href="/forgot-password" className="text-[12px] font-medium text-[#6B7280] hover:text-[#0A0A0A] transition-colors">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                {...form.register("password")}
                className="rounded-xl h-11 text-[14px] bg-white border border-[#E5E7EB] text-[#0A0A0A] placeholder:text-[#C0C0C8] focus-visible:ring-2 focus-visible:ring-[#0A0A0A]/10 focus-visible:border-[#0A0A0A] transition-all shadow-sm"
              />
              {form.formState.errors.password && (
                <p className="text-xs text-red-500 font-medium mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full h-11 rounded-xl text-[14px] font-semibold bg-[#0A0A0A] hover:bg-[#1F1F1F] text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isLoggingIn ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-[13px] text-[#9CA3AF]">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#0A0A0A] font-semibold hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
