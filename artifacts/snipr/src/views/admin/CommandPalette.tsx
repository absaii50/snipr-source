"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  LayoutDashboard, Users, Link2, Globe, BarChart3,
  CreditCard, FileText, Mail, Sparkles, ScrollText,
  Settings, BookOpen, Search, Download, RefreshCw,
  ArrowRight, User,
} from "lucide-react";
import { apiFetch } from "./utils";

/* ── types ─────────────────────────────────────────────────── */

type Category = "Navigation" | "Quick Actions" | "Users";

interface CommandItem {
  id: string;
  label: string;
  icon: React.ElementType;
  category: Category;
  keywords?: string;
  sub?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onAction: (action: string) => void;
}

/* ── static data ──────────────────────────────────────────── */

const STATIC_ITEMS: CommandItem[] = [
  // Navigation
  { id: "overview",  label: "Overview",      icon: LayoutDashboard, category: "Navigation" },
  { id: "users",     label: "Users",         icon: Users,           category: "Navigation" },
  { id: "links",     label: "Links",         icon: Link2,           category: "Navigation" },
  { id: "domains",   label: "Domains",       icon: Globe,           category: "Navigation" },
  { id: "analytics", label: "Analytics",     icon: BarChart3,       category: "Navigation" },
  { id: "plans",     label: "Plans",         icon: CreditCard,      category: "Navigation" },
  { id: "reports",   label: "Reports",       icon: FileText,        category: "Navigation" },
  { id: "email",     label: "Email",         icon: Mail,            category: "Navigation" },
  { id: "ai",        label: "AI Insights",   icon: Sparkles,        category: "Navigation" },
  { id: "audit",     label: "Audit Log",     icon: ScrollText,      category: "Navigation" },
  { id: "settings",  label: "Settings",      icon: Settings,        category: "Navigation" },
  { id: "guide",     label: "How-To Guide",  icon: BookOpen,        category: "Navigation" },

  // Quick Actions
  { id: "export-users", label: "Export Users CSV", icon: Download,  category: "Quick Actions", keywords: "download export users csv" },
  { id: "export-links", label: "Export Links CSV", icon: Download,  category: "Quick Actions", keywords: "download export links csv" },
  { id: "refresh-data", label: "Refresh Data",     icon: RefreshCw, category: "Quick Actions", keywords: "reload refresh" },
];

/* ── component ─────────────────────────────────────────────── */

export default function CommandPalette({ open, onClose, onNavigate, onAction }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [userResults, setUserResults] = useState<CommandItem[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  /* filter static items */
  const filteredStatic = STATIC_ITEMS.filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      (item.keywords && item.keywords.toLowerCase().includes(q))
    );
  });

  const filtered = [...filteredStatic, ...userResults];

  /* search users from API when query is 2+ chars */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setUserResults([]);
      setSearchingUsers(false);
      return;
    }

    setSearchingUsers(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch(`/admin/users/performance?search=${encodeURIComponent(query)}`);
        const users = (data.users ?? data ?? []).slice(0, 5);
        setUserResults(
          users.map((u: any) => ({
            id: `user-${u.id}`,
            label: u.name || u.full_name || u.email,
            sub: u.email,
            icon: User,
            category: "Users" as Category,
            keywords: u.email,
          }))
        );
      } catch {
        setUserResults([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  /* reset state when opening / closing */
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setUserResults([]);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  /* clamp selection when results change */
  useEffect(() => {
    setSelectedIdx((prev) => Math.min(prev, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  /* scroll selected item into view */
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  /* global Cmd+K / Ctrl+K listener */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /* select handler */
  const handleSelect = useCallback(
    (item: CommandItem) => {
      if (item.category === "Users") {
        // Navigate to users tab — the user's email is in the item
        const email = item.sub || item.label;
        onNavigate(`users?search=${encodeURIComponent(email)}`);
      } else if (item.category === "Navigation") {
        onNavigate(item.id);
      } else {
        onAction(item.id);
      }
      onClose();
    },
    [onNavigate, onAction, onClose],
  );

  /* keyboard nav inside the palette */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" && filtered[selectedIdx]) {
      e.preventDefault();
      handleSelect(filtered[selectedIdx]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  /* group filtered items by category */
  const groups: Record<string, CommandItem[]> = {};
  for (const item of filtered) {
    (groups[item.category] ??= []).push(item);
  }

  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={onClose}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* modal */}
      <div
        className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* search */}
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands or users... ⌘K"
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
          {searchingUsers && (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin shrink-0" />
          )}
        </div>

        {/* results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 && !searchingUsers && (
            <p className="px-4 py-6 text-center text-sm text-gray-400">
              No results found
            </p>
          )}

          {(["Navigation", "Users", "Quick Actions"] as const).map((cat) => {
            const items = groups[cat];
            if (!items?.length) return null;

            return (
              <div key={cat}>
                <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {cat}
                </p>

                {items.map((item) => {
                  const idx = flatIdx++;
                  const Icon = item.icon;
                  const isSelected = idx === selectedIdx;

                  return (
                    <button
                      key={item.id}
                      data-idx={idx}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                        isSelected
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          isSelected ? "text-blue-500" : "text-gray-400"
                        }`}
                      />
                      <div className="flex-1 text-left min-w-0">
                        <span className="block truncate">{item.label}</span>
                        {item.sub && (
                          <span className={`block text-xs truncate ${isSelected ? "text-blue-400" : "text-gray-400"}`}>
                            {item.sub}
                          </span>
                        )}
                      </div>
                      <ArrowRight
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isSelected ? "text-blue-400" : "text-transparent"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* footer hint */}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
          <span>
            <kbd className="rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>{" "}
            navigate{" "}
            <kbd className="ml-1 rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono text-[10px]">↵</kbd>{" "}
            select
          </span>
          <span>
            <kbd className="rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono text-[10px]">esc</kbd>{" "}
            close
          </span>
        </div>
      </div>
    </div>
  );
}
