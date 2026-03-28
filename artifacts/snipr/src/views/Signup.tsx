"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Link2 } from "lucide-react";

const registerSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  email: z.string().email({ message: "Please enter a valid email" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Signup() {
  const { register: authRegister, isRegistering } = useAuth();

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" }
  });

  const onSubmit = (data: RegisterForm) => {
    authRegister(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-sans bg-[#080708] px-4 py-16">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="bg-[#728DA7] text-white p-2.5 rounded-xl mb-4">
            <Link2 className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-[20px] text-[#EFEFF0] tracking-tight">Snipr</span>
          <span className="text-[13px] text-[#5A5C60] mt-1">AI-powered link intelligence</span>
        </div>

        {/* Card */}
        <div className="bg-[#3C3C44] border border-[#4A4A52] rounded-2xl p-8">
          <h1 className="text-[22px] font-bold text-[#EFEFF0] mb-1">Create your account</h1>
          <p className="text-[13px] text-[#5A5C60] mb-7">Start for free, upgrade anytime.</p>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-[13px] font-medium text-[#C3C3C1]">Full Name</Label>
              <Input
                id="name"
                placeholder="Jane Doe"
                {...form.register("name")}
                className="rounded-lg h-11 text-[14px] bg-[#2E2E35] border border-[#4A4A52] text-[#EFEFF0] placeholder:text-[#5A5C60] focus-visible:ring-[#728DA7] focus-visible:border-[#728DA7] transition-all"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-red-400 font-medium mt-1">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium text-[#C3C3C1]">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...form.register("email")}
                className="rounded-lg h-11 text-[14px] bg-[#2E2E35] border border-[#4A4A52] text-[#EFEFF0] placeholder:text-[#5A5C60] focus-visible:ring-[#728DA7] focus-visible:border-[#728DA7] transition-all"
              />
              {form.formState.errors.email && (
                <p className="text-xs text-red-400 font-medium mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] font-medium text-[#C3C3C1]">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                {...form.register("password")}
                className="rounded-lg h-11 text-[14px] bg-[#2E2E35] border border-[#4A4A52] text-[#EFEFF0] placeholder:text-[#5A5C60] focus-visible:ring-[#728DA7] focus-visible:border-[#728DA7] transition-all"
              />
              {form.formState.errors.password && (
                <p className="text-xs text-red-400 font-medium mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isRegistering}
              className="w-full h-11 mt-2 rounded-lg text-[14px] font-semibold bg-[#728DA7] hover:bg-[#5a7a94] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRegistering ? "Creating account..." : "Sign up"}
            </button>
          </form>

          <div className="mt-7 text-center text-[13px] text-[#5A5C60]">
            Already have an account?{" "}
            <Link href="/login" className="text-[#728DA7] font-medium hover:text-[#8fa8be] transition-colors">
              Log in
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-[13px] text-[#5A5C60] hover:text-[#C3C3C1] transition-colors">
            ← Back to home
          </Link>
        </div>

      </div>
    </div>
  );
}
