"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Link2 } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center font-sans bg-[#F8F9FB] px-4 py-16">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="bg-gradient-to-br from-[#728DA7] to-[#5A7A94] text-white p-3 rounded-2xl mb-4 shadow-lg shadow-[#728DA7]/20">
            <Link2 className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-[20px] text-[#0A0A0A] tracking-tight">Snipr</span>
          <span className="text-[13px] text-[#6B7280] mt-1">AI-powered link intelligence</span>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-sm">
          <h1 className="text-[22px] font-bold text-[#0A0A0A] mb-1">Welcome back</h1>
          <p className="text-[13px] text-[#6B7280] mb-7">Log in to your Snipr account</p>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium text-[#374151]">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...form.register("email")}
                className="rounded-xl h-11 text-[14px] bg-[#F8F9FB] border border-[#E5E7EB] text-[#0A0A0A] placeholder:text-[#9CA3AF] focus-visible:ring-[#728DA7] focus-visible:border-[#728DA7] transition-all"
              />
              {form.formState.errors.email && (
                <p className="text-xs text-red-500 font-medium mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] font-medium text-[#374151]">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                {...form.register("password")}
                className="rounded-xl h-11 text-[14px] bg-[#F8F9FB] border border-[#E5E7EB] text-[#0A0A0A] placeholder:text-[#9CA3AF] focus-visible:ring-[#728DA7] focus-visible:border-[#728DA7] transition-all"
              />
              {form.formState.errors.password && (
                <p className="text-xs text-red-500 font-medium mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full h-11 mt-2 rounded-xl text-[14px] font-semibold bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? "Logging in..." : "Log in"}
            </button>
          </form>

          <div className="mt-7 text-center text-[13px] text-[#6B7280]">
            Don't have an account?{" "}
            <Link href="/signup" className="text-[#728DA7] font-semibold hover:text-[#5A7A94] transition-colors">
              Sign up
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-[13px] text-[#6B7280] hover:text-[#374151] transition-colors">
            &larr; Back to home
          </Link>
        </div>

      </div>
    </div>
  );
}
