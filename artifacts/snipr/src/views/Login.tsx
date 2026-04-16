"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useSearchParams } from "next/navigation";
import { BarChart3, Globe, Zap } from "lucide-react";
import { SniprLogo } from "@/components/SniprLogo";

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const { login, isLoggingIn } = useAuth(
    inviteToken ? { redirectTo: `/join?token=${inviteToken}` } : undefined
  );

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  const onSubmit = (data: LoginForm) => {
    login(data);
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
            Shorten links.<br />Amplify results.
          </h2>
          <p className="text-[#71717A] text-[15px] leading-relaxed max-w-[320px]">
            The intelligent link management platform trusted by teams worldwide.
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

          <div className="mb-8">
            <h1 className="text-[26px] font-bold text-[#FAFAFA] tracking-tight">Welcome back</h1>
            <p className="text-[#71717A] text-[15px] mt-1.5">Enter your credentials to access your account</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium text-[#A1A1AA]">Email address</Label>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[13px] font-medium text-[#A1A1AA]">Password</Label>
                <Link href="/forgot-password" className="text-[12px] font-medium text-[#71717A] hover:text-[#FAFAFA] transition-colors">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                {...form.register("password")}
                className="rounded-xl h-11 text-[14px] bg-[#18181B] border border-[#27272A] text-[#FAFAFA] placeholder:text-[#52525B] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/20 focus-visible:border-[#8B5CF6] transition-all"
              />
              {form.formState.errors.password && (
                <p className="text-xs text-red-500 font-medium mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full h-11 rounded-xl text-[14px] font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}
            >
              {isLoggingIn ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-[13px] text-[#71717A]">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#8B5CF6] font-semibold hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
