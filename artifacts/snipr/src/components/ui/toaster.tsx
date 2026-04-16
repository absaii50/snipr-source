"use client";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import {
  CheckCircle2, XCircle, AlertTriangle, Info, Link2,
  LogIn, UserPlus, LogOut, Copy, Trash2, Globe, Users,
  Folder, Tag, Zap, Bell,
} from "lucide-react";

/* ── Auto-detect the visual style from the toast title + variant ── */
type ToastKind = "success" | "error" | "warning" | "info" | "copied";

interface KindConfig {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  border: string;
  progressColor: string;
}

function detectKind(title?: React.ReactNode, variant?: string): KindConfig {
  const text = (typeof title === "string" ? title : "").toLowerCase();

  // Explicit destructive variant → error
  if (variant === "destructive" || text.includes("fail") || text.includes("error") || text.includes("invalid") || text.includes("wrong") || text.includes("denied")) {
    return {
      icon: <XCircle className="w-5 h-5" />,
      iconBg: "bg-[rgba(248,113,113,0.12)]",
      iconColor: "text-red-500",
      border: "border-l-red-400",
      progressColor: "bg-red-400",
    };
  }

  // Warning patterns
  if (text.includes("warn") || text.includes("required") || text.includes("select") || text.includes("enter") || text.includes("must")) {
    return {
      icon: <AlertTriangle className="w-5 h-5" />,
      iconBg: "bg-[rgba(251,191,36,0.12)]",
      iconColor: "text-amber-500",
      border: "border-l-amber-400",
      progressColor: "bg-amber-400",
    };
  }

  // Copy action
  if (text.includes("copied") || text.includes("copy")) {
    return {
      icon: <Copy className="w-4 h-4" />,
      iconBg: "bg-[rgba(167,139,250,0.12)]",
      iconColor: "text-violet-500",
      border: "border-l-violet-400",
      progressColor: "bg-violet-400",
    };
  }

  // Auth events
  if (text.includes("welcome") || text.includes("logged in") || text.includes("login")) {
    return {
      icon: <LogIn className="w-5 h-5" />,
      iconBg: "bg-[rgba(96,165,250,0.12)]",
      iconColor: "text-blue-500",
      border: "border-l-blue-400",
      progressColor: "bg-blue-400",
    };
  }
  if (text.includes("account created") || text.includes("registered") || text.includes("sign")) {
    return {
      icon: <UserPlus className="w-5 h-5" />,
      iconBg: "bg-[rgba(52,211,153,0.12)]",
      iconColor: "text-emerald-500",
      border: "border-l-emerald-400",
      progressColor: "bg-emerald-400",
    };
  }
  if (text.includes("logged out") || text.includes("logout")) {
    return {
      icon: <LogOut className="w-5 h-5" />,
      iconBg: "bg-[rgba(255,255,255,0.06)]",
      iconColor: "text-[#64748B]",
      border: "border-l-gray-300",
      progressColor: "bg-gray-400",
    };
  }

  // CRUD successes
  if (text.includes("deleted") || text.includes("removed")) {
    return {
      icon: <Trash2 className="w-4 h-4" />,
      iconBg: "bg-[rgba(248,113,113,0.12)]",
      iconColor: "text-red-400",
      border: "border-l-red-300",
      progressColor: "bg-red-300",
    };
  }
  if (text.includes("link")) {
    return {
      icon: <Link2 className="w-5 h-5" />,
      iconBg: "bg-[rgba(52,211,153,0.12)]",
      iconColor: "text-emerald-500",
      border: "border-l-emerald-400",
      progressColor: "bg-emerald-400",
    };
  }
  if (text.includes("domain")) {
    return {
      icon: <Globe className="w-5 h-5" />,
      iconBg: "bg-[rgba(96,165,250,0.12)]",
      iconColor: "text-blue-500",
      border: "border-l-blue-400",
      progressColor: "bg-blue-400",
    };
  }
  if (text.includes("invit") || text.includes("team") || text.includes("member") || text.includes("role")) {
    return {
      icon: <Users className="w-5 h-5" />,
      iconBg: "bg-[rgba(129,140,248,0.12)]",
      iconColor: "text-indigo-500",
      border: "border-l-indigo-400",
      progressColor: "bg-indigo-400",
    };
  }
  if (text.includes("folder")) {
    return {
      icon: <Folder className="w-5 h-5" />,
      iconBg: "bg-[rgba(251,191,36,0.12)]",
      iconColor: "text-amber-500",
      border: "border-l-amber-400",
      progressColor: "bg-amber-400",
    };
  }
  if (text.includes("tag")) {
    return {
      icon: <Tag className="w-5 h-5" />,
      iconBg: "bg-[rgba(167,139,250,0.12)]",
      iconColor: "text-violet-500",
      border: "border-l-violet-400",
      progressColor: "bg-violet-400",
    };
  }
  if (text.includes("pixel")) {
    return {
      icon: <Zap className="w-5 h-5" />,
      iconBg: "bg-[rgba(251,146,60,0.12)]",
      iconColor: "text-orange-500",
      border: "border-l-orange-400",
      progressColor: "bg-orange-400",
    };
  }
  if (text.includes("rule") || text.includes("routing") || text.includes("saved")) {
    return {
      icon: <CheckCircle2 className="w-5 h-5" />,
      iconBg: "bg-[rgba(52,211,153,0.12)]",
      iconColor: "text-emerald-500",
      border: "border-l-emerald-400",
      progressColor: "bg-emerald-400",
    };
  }

  // Generic success (created, updated, added, success)
  if (
    text.includes("created") || text.includes("updated") || text.includes("added") ||
    text.includes("success") || text.includes("sent") || text.includes("enabled") ||
    text.includes("disabled") || text.includes("duplicated") || text.includes("verified")
  ) {
    return {
      icon: <CheckCircle2 className="w-5 h-5" />,
      iconBg: "bg-[rgba(52,211,153,0.12)]",
      iconColor: "text-emerald-500",
      border: "border-l-emerald-400",
      progressColor: "bg-emerald-400",
    };
  }

  // Default: info
  return {
    icon: <Info className="w-5 h-5" />,
    iconBg: "bg-[rgba(96,165,250,0.12)]",
    iconColor: "text-blue-500",
    border: "border-l-blue-400",
    progressColor: "bg-blue-400",
  };
}

/* ── Auto-dismiss progress bar ── */
const DURATION_MS = 5000;

function ProgressBar({ color }: { color: string }) {
  const [width, setWidth] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / DURATION_MS) * 100);
      setWidth(remaining);
      if (remaining > 0) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[rgba(255,255,255,0.06)] overflow-hidden rounded-b-2xl">
      <div
        className={`h-full transition-none ${color}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/* ── Main Toaster ── */
export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={DURATION_MS}>
      {toasts.map(({ id, title, description, action, variant, ...props }) => {
        const kind = detectKind(title, variant as string | undefined);

        return (
          <Toast key={id} variant={variant as any} className={kind.border} {...props}>
            {/* Icon */}
            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${kind.iconBg} ${kind.iconColor} mt-0.5`}>
              {kind.icon}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0 py-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
              {action && <div className="mt-2">{action}</div>}
            </div>

            <ToastClose />
            <ProgressBar color={kind.progressColor} />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
