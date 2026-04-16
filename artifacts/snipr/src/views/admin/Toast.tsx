"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ToastType = "success" | "error" | "info";

interface ToastEntry {
  id: number;
  message: string;
  type: ToastType;
  dismissing: boolean;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ACCENT: Record<ToastType, string> = {
  success: "#22C55E",
  error: "#EF4444",
  info: "#3B82F6",
};

const ICON_BG: Record<ToastType, string> = {
  success: "#F0FDF4",
  error: "#FEF2F2",
  info: "#EFF6FF",
};

const AUTO_DISMISS_MS = 4000;
const FADE_OUT_MS = 300;

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3.5 8.5L6.5 11.5L12.5 4.5"
        stroke="#22C55E"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M4 4L12 12M12 4L4 12"
        stroke="#EF4444"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="#3B82F6" strokeWidth="1.5" />
      <path
        d="M8 7V11"
        stroke="#3B82F6"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="5" r="0.75" fill="#3B82F6" />
    </svg>
  );
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckIcon />,
  error: <XIcon />,
  info: <InfoIcon />,
};

/* ------------------------------------------------------------------ */
/*  Toast Context                                                      */
/* ------------------------------------------------------------------ */

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, dismissing: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, FADE_OUT_MS);
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, message, type, dismissing: false }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          display: "flex",
          flexDirection: "column-reverse",
          gap: 10,
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <SingleToast key={t.id} entry={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Single Toast                                                       */
/* ------------------------------------------------------------------ */

function SingleToast({
  entry,
  onDismiss,
}: {
  entry: ToastEntry;
  onDismiss: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const visible = mounted && !entry.dismissing;

  return (
    <div
      style={{
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 300,
        maxWidth: 420,
        padding: "12px 16px",
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderLeft: `4px solid ${ACCENT[entry.type]}`,
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        transform: visible ? "translateX(0)" : "translateX(120%)",
        opacity: visible ? 1 : 0,
        transition: `transform ${FADE_OUT_MS}ms cubic-bezier(0.16,1,0.3,1), opacity ${FADE_OUT_MS}ms ease`,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: 6,
          background: ICON_BG[entry.type],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {ICONS[entry.type]}
      </div>

      <span
        style={{
          flex: 1,
          fontSize: 14,
          lineHeight: "20px",
          color: "#0A0A0A",
          fontWeight: 500,
        }}
      >
        {entry.message}
      </span>

      <button
        onClick={onDismiss}
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 4,
          color: "#94A3B8",
          fontSize: 16,
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Confirm Modal                                                      */
/* ------------------------------------------------------------------ */

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  variant?: "danger" | "warning" | "default";
}

const CONFIRM_BTN_BG: Record<string, string> = {
  danger: "#EF4444",
  warning: "#F59E0B",
  default: "#0A0A0A",
};

const CONFIRM_BTN_HOVER: Record<string, string> = {
  danger: "#DC2626",
  warning: "#D97706",
  default: "#1A1A1A",
};

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  variant = "default",
}: ConfirmModalProps) {
  const [hovering, setHovering] = useState<"confirm" | "cancel" | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.4)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 12,
          padding: "24px",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            color: "#0A0A0A",
            lineHeight: "24px",
          }}
        >
          {title}
        </h3>

        {description && (
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 14,
              color: "#64748B",
              lineHeight: "20px",
            }}
          >
            {description}
          </p>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 24,
          }}
        >
          <button
            onClick={onClose}
            onMouseEnter={() => setHovering("cancel")}
            onMouseLeave={() => setHovering(null)}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 6,
              border: "1px solid #E2E8F0",
              background: hovering === "cancel" ? "#F8FAFC" : "#FFFFFF",
              color: "#0A0A0A",
              cursor: "pointer",
              transition: "background 150ms ease",
            }}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            onMouseEnter={() => setHovering("confirm")}
            onMouseLeave={() => setHovering(null)}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 6,
              border: "none",
              background:
                hovering === "confirm"
                  ? CONFIRM_BTN_HOVER[variant]
                  : CONFIRM_BTN_BG[variant],
              color: "#FFFFFF",
              cursor: "pointer",
              transition: "background 150ms ease",
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
