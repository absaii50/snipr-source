"use client";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Shield, Lock, Server, Eye, AlertTriangle, RefreshCw, CheckCircle } from "lucide-react";

const practices = [
  {
    icon: Lock,
    title: "Encryption Everywhere",
    description:
      "All data transmitted to and from Snipr is encrypted using TLS 1.3. Data at rest is encrypted using AES-256. Encryption keys are managed via AWS KMS with automatic rotation.",
  },
  {
    icon: Server,
    title: "SOC 2 Type II Certified",
    description:
      "Snipr is hosted on AWS infrastructure that is SOC 2 Type II certified. Our internal controls covering security, availability, and confidentiality are independently audited annually.",
  },
  {
    icon: Shield,
    title: "Access Controls & MFA",
    description:
      "Access to production systems is restricted to authorized engineers only, protected by hardware MFA (YubiKey), short-lived credentials, and principle of least privilege. We conduct quarterly access reviews.",
  },
  {
    icon: Eye,
    title: "Continuous Monitoring",
    description:
      "We run 24/7 automated intrusion detection, anomaly monitoring, and real-time log analysis. Security events trigger immediate PagerDuty alerts to our on-call team.",
  },
  {
    icon: RefreshCw,
    title: "Incident Response",
    description:
      "We maintain a formal incident response plan with defined escalation paths, SLAs for notification, and post-incident reviews. For any breach affecting user data, we commit to notifying affected users within 72 hours.",
  },
  {
    icon: AlertTriangle,
    title: "DDoS & Abuse Protection",
    description:
      "All traffic passes through Cloudflare's global network for DDoS mitigation, Web Application Firewall (WAF) filtering, and bot detection. Rate limiting is applied at every API endpoint.",
  },
];

const certifications = [
  { label: "SOC 2 Type II", detail: "Annually audited", color: "bg-[#728DA7]/8 border-[#728DA7]/20 text-[#728DA7]" },
  { label: "GDPR Compliant", detail: "EU data residency available", color: "bg-[#3B9A6A]/8 border-[#3B9A6A]/20 text-[#3B9A6A]" },
  { label: "CCPA Ready", detail: "California Consumer Privacy Act", color: "bg-[#C47860]/8 border-[#C47860]/20 text-[#C47860]" },
  { label: "HTTPS Only", detail: "TLS 1.3 enforced", color: "bg-[#7B9EA6]/8 border-[#7B9EA6]/20 text-[#7B9EA6]" },
  { label: "AES-256 at Rest", detail: "All databases encrypted", color: "bg-[#9C7AB8]/8 border-[#9C7AB8]/20 text-[#9C7AB8]" },
  { label: "99.9% Uptime SLA", detail: "Enterprise guarantee", color: "bg-[#6A9E78]/8 border-[#6A9E78]/20 text-[#6A9E78]" },
];

const bugBountyScope = [
  "Authentication bypass or privilege escalation",
  "SQL injection or remote code execution",
  "Cross-site scripting (XSS) on authenticated pages",
  "Unauthorized access to another user's links or analytics data",
  "Server-side request forgery (SSRF)",
  "Sensitive data exposure in API responses",
];

export default function Security() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicNavbar />

      {/* ── Page header ── */}
      <div className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
        <div className="container max-w-6xl mx-auto px-6 py-20">
          <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888] mb-4">Trust & Safety</p>
          <h1 className="font-display font-black text-[42px] md:text-[56px] text-[#0A0A0A] tracking-[-0.035em] leading-[1.04] mb-5">
            Security at Snipr
          </h1>
          <p className="text-[16px] text-[#555] max-w-[580px] leading-[1.7]">
            Your links and data are the foundation of our business. We take security seriously at every layer — from encryption and access controls to incident response and independent audits.
          </p>
          <div className="flex items-center gap-2 mt-7">
            <span className="w-2 h-2 rounded-full bg-[#3B9A6A] animate-pulse" />
            <span className="text-[13px] text-[#888]">No active security incidents · Last audit: Q1 2026</span>
          </div>
        </div>
      </div>

      <main className="flex-1">

        {/* ── Certifications strip ── */}
        <div className="bg-white border-b border-[#EBEBEB]">
          <div className="container max-w-6xl mx-auto px-6 py-10">
            <p className="text-[10px] font-bold tracking-[0.24em] uppercase text-[#BBB] mb-6">Certifications & Compliance</p>
            <div className="flex flex-wrap gap-3">
              {certifications.map((cert) => (
                <div key={cert.label} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm ${cert.color}`}>
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-[13px]">{cert.label}</div>
                    <div className="text-[11px] opacity-70">{cert.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Security practices ── */}
        <div className="bg-[#FAFAFA]">
          <div className="container max-w-6xl mx-auto px-6 py-20">
            <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888] mb-3">Our Practices</p>
            <h2 className="font-display font-black text-[32px] md:text-[40px] text-[#0A0A0A] tracking-[-0.03em] leading-[1.1] mb-14">
              Defense in depth.
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {practices.map((p) => (
                <div key={p.title} className="bg-white rounded-2xl p-7 border border-[#E8E8E8]">
                  <div className="w-10 h-10 rounded-xl bg-[#728DA7]/8 flex items-center justify-center mb-5">
                    <p.icon className="w-5 h-5 text-[#728DA7]" />
                  </div>
                  <h3 className="font-display font-bold text-[17px] text-[#0A0A0A] tracking-tight mb-3">{p.title}</h3>
                  <p className="text-[13px] text-[#666] leading-[1.7]">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Infrastructure ── */}
        <div className="bg-white border-y border-[#EBEBEB]">
          <div className="container max-w-6xl mx-auto px-6 py-20">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div>
                <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888] mb-4">Infrastructure</p>
                <h2 className="font-display font-black text-[30px] md:text-[36px] text-[#0A0A0A] tracking-tight leading-[1.1] mb-6">
                  Built on enterprise-grade cloud.
                </h2>
                <div className="space-y-4">
                  {[
                    { label: "Cloud Provider", value: "Amazon Web Services (AWS)" },
                    { label: "Regions", value: "us-east-1 (primary), eu-west-1 (EU customers)" },
                    { label: "Database", value: "PostgreSQL on RDS with Multi-AZ failover" },
                    { label: "CDN & DDoS", value: "Cloudflare Enterprise" },
                    { label: "Backups", value: "Encrypted daily snapshots, 90-day retention" },
                    { label: "Uptime Monitoring", value: "Checkly + PagerDuty, 1-minute intervals" },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between gap-4 py-3 border-b border-[#F0F0F0] last:border-0">
                      <span className="text-[13px] font-semibold text-[#0A0A0A]">{item.label}</span>
                      <span className="text-[13px] text-[#555] text-right">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#FAFAFA] rounded-2xl p-8 border border-[#EBEBEB]">
                <p className="text-[10px] font-bold tracking-[0.24em] uppercase text-[#BBB] mb-5">Data Flow</p>
                <div className="space-y-3">
                  {[
                    { step: "1", label: "User clicks short link", detail: "Browser → Cloudflare Edge" },
                    { step: "2", label: "Edge caches & routes", detail: "~2ms average response" },
                    { step: "3", label: "Click event recorded", detail: "Async write to analytics queue" },
                    { step: "4", label: "IP address hashed", detail: "Never stored in plain text" },
                    { step: "5", label: "Analytics aggregated", detail: "Batch processing every 60s" },
                    { step: "6", label: "Dashboard updated", detail: "Real-time via WebSocket" },
                  ].map((row) => (
                    <div key={row.step} className="flex items-start gap-4">
                      <span className="w-6 h-6 rounded-full bg-[#728DA7]/10 border border-[#728DA7]/20 text-[#728DA7] text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {row.step}
                      </span>
                      <div>
                        <div className="text-[13px] font-semibold text-[#0A0A0A]">{row.label}</div>
                        <div className="text-[12px] text-[#888]">{row.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bug bounty ── */}
        <div className="bg-[#FAFAFA]">
          <div className="container max-w-6xl mx-auto px-6 py-20">
            <div className="max-w-[680px]">
              <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888] mb-4">Responsible Disclosure</p>
              <h2 className="font-display font-black text-[30px] text-[#0A0A0A] tracking-tight leading-[1.1] mb-5">
                Found a vulnerability? We want to know.
              </h2>
              <p className="text-[14px] text-[#555] leading-[1.8] mb-8">
                We maintain a responsible disclosure program. If you discover a security issue in Snipr, please report it to{" "}
                <a href="mailto:security@snipr.sh" className="text-[#728DA7] hover:underline font-semibold">security@snipr.sh</a>.
                We will acknowledge your report within 24 hours, provide status updates as we investigate, and offer public credit (if desired) upon resolution. We commit to not pursuing legal action against researchers who follow responsible disclosure guidelines.
              </p>

              <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 mb-8">
                <p className="text-[12px] font-bold tracking-[0.18em] uppercase text-[#BBB] mb-4">In-scope vulnerabilities</p>
                <div className="space-y-2.5">
                  {bugBountyScope.map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#728DA7] flex-shrink-0 mt-[6px]" />
                      <span className="text-[13px] text-[#555]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <a
                  href="mailto:security@snipr.sh"
                  className="inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#222] text-white text-[13px] font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                  Report a Vulnerability
                </a>
                <span className="text-[13px] text-[#888]">security@snipr.sh</span>
              </div>
            </div>
          </div>
        </div>

      </main>

      <PublicFooter />
    </div>
  );
}
