"use client";
import { useState } from "react";
import {
  BookOpen, Globe, Link2, BarChart3, CreditCard, ShieldCheck,
  ChevronDown, ChevronRight, CheckCircle2, Copy, ExternalLink,
  Zap, Server, Lock, Users, Settings2,
} from "lucide-react";

interface SectionProps {
  icon: React.ElementType;
  title: string;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ icon: Icon, title, badge, badgeColor = "bg-blue-100 text-blue-700", children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#F8F8FC] transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-[#F4F4F6] flex items-center justify-center shrink-0">
          <Icon className="w-4.5 h-4.5 text-[#728DA7]" style={{ width: 18, height: 18 }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#0A0A0A]">{title}</span>
            {badge && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>}
          </div>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-[#8888A0] shrink-0" />
          : <ChevronRight className="w-4 h-4 text-[#8888A0] shrink-0" />
        }
      </button>
      {open && <div className="px-5 pb-5 pt-1 text-sm text-[#3A3A3E] space-y-3 border-t border-[#E2E8F0]">{children}</div>}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-[#0A0A0A] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</div>
      <div className="flex-1 text-[#3A3A3E] leading-relaxed">{children}</div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="flex items-center gap-2 bg-[#F4F4F6] rounded-lg px-3 py-2 font-mono text-xs text-[#0A0A0A] border border-[#E2E8F0]">
      <span className="flex-1 break-all">{children}</span>
      <button onClick={copy} className="text-[#8888A0] hover:text-[#0A0A0A] transition-colors shrink-0" title="Copy">
        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function InfoBox({ type, children }: { type: "tip" | "warning" | "info"; children: React.ReactNode }) {
  const styles = {
    tip: "bg-green-50 border-green-200 text-green-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    info: "bg-blue-50 border-blue-200 text-blue-700",
  };
  const labels = { tip: "Tip", warning: "Note", info: "Info" };
  return (
    <div className={`border rounded-xl px-4 py-3 text-xs leading-relaxed ${styles[type]}`}>
      <strong>{labels[type]}:</strong> {children}
    </div>
  );
}

export default function GuideTab() {
  return (
    <div className="max-w-3xl space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0A0A0A] to-[#1E2A38] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Snipr Admin Guide</h2>
            <p className="text-white/60 text-xs">Complete platform setup & management reference</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: "Custom Domains", icon: Globe },
            { label: "Link Management", icon: Link2 },
            { label: "Analytics", icon: BarChart3 },
            { label: "Billing", icon: CreditCard },
          ].map(({ label, icon: Icon }) => (
            <div key={label} className="bg-white/5 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <Icon className="w-3.5 h-3.5 text-white/70 shrink-0" />
              <span className="text-xs text-white/80 font-medium truncate">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Domain Setup */}
      <Section icon={Globe} title="Custom Domain Setup" badge="Most Important" badgeColor="bg-[#E8EEF4] text-[#4A7A94]" defaultOpen>
        <p className="text-[#6666A0] text-xs leading-relaxed">
          Users can connect their own branded domains (e.g. <code className="bg-[#F4F4F6] px-1 rounded text-[#0A0A0A]">links.company.com</code>) to Snipr so their short links appear on their own domain.
        </p>

        <div className="space-y-2 mt-2">
          <p className="font-semibold text-[#0A0A0A] text-xs uppercase tracking-wide">Step-by-Step Process</p>
          <div className="space-y-3">
            <Step n={1}>
              <strong>User adds their domain</strong> in their Snipr dashboard under Settings → Custom Domains.
              The domain is saved with <em>unverified</em> status.
            </Step>
            <Step n={2}>
              <strong>User configures DNS</strong> at their domain registrar. They have two options:
              <div className="mt-2 space-y-2">
                <p className="font-medium text-[#0A0A0A] text-xs">Option A — CNAME Record (recommended):</p>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono bg-[#F8F8FC] rounded-xl p-3 border border-[#E2E8F0]">
                    <span className="text-[#8888A0] font-sans">Type</span>
                    <span className="text-[#8888A0] font-sans">Name</span>
                    <span className="text-[#8888A0] font-sans">Value</span>
                    <span className="font-semibold text-[#0A0A0A]">CNAME</span>
                    <span className="text-[#4A7A94]">links</span>
                    <span className="text-[#4A7A94]">snipr.sh</span>
                  </div>
                  <InfoBox type="info">Replace <code>links</code> with whatever subdomain the user wants, e.g. <code>go</code> or <code>l</code>.</InfoBox>
                </div>
                <p className="font-medium text-[#0A0A0A] text-xs">Option B — TXT Verification (for apex domains):</p>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono bg-[#F8F8FC] rounded-xl p-3 border border-[#E2E8F0]">
                    <span className="text-[#8888A0] font-sans">Type</span>
                    <span className="text-[#8888A0] font-sans">Name</span>
                    <span className="text-[#8888A0] font-sans">Value</span>
                    <span className="font-semibold text-[#0A0A0A]">TXT</span>
                    <span className="text-[#4A7A94]">_snipr-verify</span>
                    <span className="text-[#4A7A94] break-all">{"<token>"}</span>
                  </div>
                  <InfoBox type="info">The verification token is unique per domain. Find it in the Domains tab → expand any domain row.</InfoBox>
                </div>
              </div>
            </Step>
            <Step n={3}>
              <strong>Admin verifies the domain</strong> in the Domains tab. Click the <strong>Verify DNS</strong> button next to any domain to check DNS records. If DNS is not propagated yet, use <strong>Force Verify</strong> to manually approve it (admin override).
            </Step>
            <Step n={4}>
              Once verified, all links in that user's workspace can be accessed via the custom domain. For example:
            </Step>
          </div>
          <Code>https://links.company.com/my-slug</Code>
          <InfoBox type="tip">DNS propagation can take 5 minutes to 48 hours depending on the registrar. Use Force Verify to unblock users while they wait.</InfoBox>
        </div>
      </Section>

      {/* Link Management */}
      <Section icon={Link2} title="Link Management">
        <p className="text-[#6666A0] text-xs">Each link belongs to a workspace and has a unique slug. As an admin you can:</p>
        <ul className="mt-2 space-y-1.5 text-xs">
          {[
            "View all links across all users in the Links tab",
            "See unique click counts, last click time, top country and device per link",
            "Sort by clicks, created date, or alphabetically",
            "Delete any link (destructive — also removes all click analytics for that link)",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <InfoBox type="warning">Link slugs must be unique per workspace. Users on the Free plan have a link limit; upgrade their plan in the Users tab to increase it.</InfoBox>
      </Section>

      {/* Analytics */}
      <Section icon={BarChart3} title="Analytics & Reporting">
        <p className="text-[#6666A0] text-xs">Snipr tracks every click event with country, device, browser, and referrer data.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            { label: "Platform Analytics", desc: "Total clicks over time, top countries, devices, referrers — shown in the Analytics tab." },
            { label: "Per-User Analytics", desc: "Click volume, top links, engagement — click any user row to open their profile drawer." },
            { label: "Per-Link Stats", desc: "Unique clicks, last click time, top country and device per link in the Links tab." },
            { label: "Top Users", desc: "Users ranked by total clicks on the Overview tab dashboard." },
          ].map(({ label, desc }) => (
            <div key={label} className="bg-[#F8F8FC] rounded-xl p-3 border border-[#E2E8F0]">
              <p className="font-semibold text-[#0A0A0A] text-xs mb-1">{label}</p>
              <p className="text-[10px] text-[#6666A0] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <InfoBox type="tip">Use the date range selector (7d / 30d / 90d) in the Analytics tab to zoom into specific periods.</InfoBox>
      </Section>

      {/* Users & Plans */}
      <Section icon={Users} title="Users & Plans">
        <p className="text-[#6666A0] text-xs">Each user account is tied to a workspace. Plans control feature limits.</p>
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { plan: "Free", color: "bg-gray-100 text-gray-700", limits: "5 links · 1 domain · Basic analytics" },
              { plan: "Pro", color: "bg-violet-100 text-violet-700", limits: "Unlimited links · 5 domains · Full analytics" },
              { plan: "Business", color: "bg-amber-100 text-amber-700", limits: "Unlimited everything · AI Insights · API access" },
            ].map(({ plan, color, limits }) => (
              <div key={plan} className="bg-[#F8F8FC] rounded-xl p-3 border border-[#E2E8F0]">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>{plan}</span>
                <p className="text-[10px] text-[#6666A0] mt-1.5 leading-relaxed">{limits}</p>
              </div>
            ))}
          </div>
          <InfoBox type="info">Plans are managed via Stripe. Webhook events update the plan field automatically. You can manually set a user&apos;s plan in the Users tab → Performance table.</InfoBox>
        </div>
      </Section>

      {/* Billing / Stripe */}
      <Section icon={CreditCard} title="Billing with Stripe">
        <p className="text-[#6666A0] text-xs">Snipr uses Stripe for subscriptions. Billing is managed via the Stripe integration.</p>
        <div className="mt-3 space-y-2">
          <Step n={1}>Connect Stripe via the Replit integrations panel.</Step>
          <Step n={2}>Create products for Pro and Business plans in the Stripe dashboard.</Step>
          <Step n={3}>Webhooks are managed automatically by the Stripe integration.</Step>
        </div>
        <InfoBox type="tip">Until billing is fully configured, you can manually set user plans in the Users tab using the plan dropdown in each user&apos;s profile.</InfoBox>
      </Section>

      {/* Security & Admin */}
      <Section icon={ShieldCheck} title="Admin Security">
        <p className="text-[#6666A0] text-xs">The admin panel is protected by HTTP-only session cookies.</p>
        <div className="mt-3 space-y-2 text-xs">
          <div className="bg-[#F8F8FC] rounded-xl p-4 border border-[#E2E8F0] space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-[#728DA7]" />
              <span className="font-semibold text-[#0A0A0A]">Change default admin credentials immediately</span>
            </div>
            <p className="text-[#6666A0] leading-relaxed">
              Default credentials are <code className="bg-[#E4E4EC] px-1 rounded">admin / admin</code>. Update them in your environment secrets or server config before going to production.
            </p>
          </div>
          <InfoBox type="warning">All admin endpoints require the <code>requireAdmin</code> middleware. Never expose admin routes without authentication.</InfoBox>
        </div>
      </Section>

      {/* Architecture */}
      <Section icon={Server} title="Architecture Reference">
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Frontend", value: "Next.js 15 App Router · React 19 · Tailwind CSS" },
              { label: "Backend", value: "Express 5 · TypeScript · Drizzle ORM" },
              { label: "Database", value: "PostgreSQL (Replit managed)" },
              { label: "Billing", value: "Stripe payments & webhooks" },
              { label: "Redirect Engine", value: "Express router · custom domain Host-header routing" },
              { label: "Analytics", value: "Click events stored in PostgreSQL · recharts visualization" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#F8F8FC] rounded-xl p-3 border border-[#E2E8F0]">
                <p className="font-semibold text-[#0A0A0A] mb-0.5">{label}</p>
                <p className="text-[10px] text-[#6666A0] leading-relaxed">{value}</p>
              </div>
            ))}
          </div>
          <InfoBox type="info">The redirect server runs on port 8080 and handles <code>/r/:slug</code> (standard) and custom domain Host-header routing. Next.js runs on port 22647 proxied at root.</InfoBox>
        </div>
      </Section>

      {/* Quick Reference */}
      <Section icon={Zap} title="Quick Reference — Key URLs">
        <div className="space-y-2 text-xs">
          {[
            { label: "Admin Panel", url: "/admin" },
            { label: "Standard redirect", url: "/r/:slug" },
            { label: "Custom domain redirect", url: "https://yourdomain.com/:slug" },
            { label: "Billing webhook", url: "/api/stripe/webhook" },
            { label: "Admin API base", url: "/api/admin/*" },
          ].map(({ label, url }) => (
            <div key={label} className="flex items-center gap-3 bg-[#F8F8FC] rounded-xl px-3 py-2.5 border border-[#E2E8F0]">
              <span className="text-[#8888A0] w-32 shrink-0">{label}</span>
              <code className="text-[#4A7A94] text-[10px] break-all">{url}</code>
            </div>
          ))}
        </div>
      </Section>

      <div className="text-center py-2">
        <p className="text-xs text-[#8888A0]">Snipr Admin Guide · Platform v1.0 · Built with React + Express</p>
      </div>
    </div>
  );
}
