"use client";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";

const sections = [
  {
    id: "information-we-collect",
    title: "Information We Collect",
    content: [
      {
        sub: "Account Information",
        body: "When you create a Snipr account, we collect your name, email address, and password. If you sign up via a third-party provider (Google, GitHub), we receive the profile data those services share with us.",
      },
      {
        sub: "Links & Usage Data",
        body: "We store the links you shorten, including the destination URL, custom slug, tags, and any smart routing rules you configure. We also collect metadata about when and how links are accessed — including timestamps, IP addresses (hashed after processing), browser user-agent, referrer, and country of origin.",
      },
      {
        sub: "Payment Information",
        body: "For paid plans, billing is handled by Stripe. We never store your full card number — only the last 4 digits, card brand, and expiry for display purposes. All payment processing happens on Stripe's PCI-DSS-compliant infrastructure.",
      },
      {
        sub: "Log & Device Data",
        body: "Our servers automatically record access logs including IP addresses, request paths, and error codes. We use this data for security monitoring, abuse prevention, and debugging.",
      },
    ],
  },
  {
    id: "how-we-use-information",
    title: "How We Use Your Information",
    content: [
      {
        sub: "To Provide the Service",
        body: "We use your data to operate Snipr — creating short links, delivering analytics dashboards, generating QR codes, applying smart routing rules, and sending transactional emails (e.g., password resets, invoice receipts).",
      },
      {
        sub: "To Improve Snipr",
        body: "Aggregated and anonymized usage patterns help us understand which features are most valuable and where to focus our engineering effort.",
      },
      {
        sub: "To Communicate With You",
        body: "We send product announcements and feature updates only if you have opted in. You can unsubscribe at any time from every marketing email we send.",
      },
      {
        sub: "To Prevent Abuse",
        body: "We analyze traffic patterns to detect spam, phishing links, and other violations of our Acceptable Use Policy.",
      },
    ],
  },
  {
    id: "sharing-information",
    title: "Sharing Your Information",
    content: [
      {
        sub: "We Never Sell Your Data",
        body: "Snipr does not sell, rent, or trade your personal information to third parties for their marketing purposes. Ever.",
      },
      {
        sub: "Service Providers",
        body: "We share data with trusted sub-processors who help us operate the platform: Stripe (payments), AWS (cloud infrastructure), Postmark (transactional email), and Cloudflare (CDN and DDoS protection). Each is bound by a data processing agreement.",
      },
      {
        sub: "Legal Requirements",
        body: "We may disclose information when required by law, court order, or governmental authority — but we will notify you where legally permitted before doing so.",
      },
      {
        sub: "Business Transfers",
        body: "In the event of a merger, acquisition, or sale of assets, your data may be transferred. We will notify affected users via email and provide the opportunity to delete accounts before any transfer.",
      },
    ],
  },
  {
    id: "data-retention",
    title: "Data Retention",
    content: [
      {
        sub: "Active Accounts",
        body: "We retain your data for as long as your account is active. Click analytics are retained for 24 months on the Free plan, 36 months on Pro, and indefinitely on Enterprise.",
      },
      {
        sub: "Deleted Accounts",
        body: "When you delete your account, we begin purging your personal data within 30 days. Anonymized, aggregate analytics may be retained for platform performance analysis.",
      },
      {
        sub: "Backups",
        body: "Encrypted backups may retain data for up to 90 days after deletion as part of our disaster recovery procedures.",
      },
    ],
  },
  {
    id: "your-rights",
    title: "Your Rights",
    content: [
      {
        sub: "Access & Portability",
        body: "You can export all your links, analytics, and account data at any time from your dashboard settings.",
      },
      {
        sub: "Correction",
        body: "You may update your profile information at any time within your account settings.",
      },
      {
        sub: "Deletion",
        body: "You may request deletion of your account and associated data at any time. Requests are processed within 30 days.",
      },
      {
        sub: "GDPR & CCPA",
        body: "If you are in the European Union or California, you have additional rights under GDPR and CCPA respectively — including the right to restrict processing and the right to non-discrimination. Contact us at privacy@snipr.sh to exercise these rights.",
      },
    ],
  },
  {
    id: "security",
    title: "Security",
    content: [
      {
        sub: "Encryption",
        body: "All data is encrypted in transit using TLS 1.3 and at rest using AES-256. Our infrastructure is hosted on AWS with SOC 2 Type II certified data centers.",
      },
      {
        sub: "Access Controls",
        body: "Access to production systems is restricted to authorized engineers, gated by MFA and short-lived credentials. We conduct quarterly access reviews.",
      },
      {
        sub: "Reporting a Vulnerability",
        body: "If you discover a security issue, please report it responsibly to security@snipr.sh. We will acknowledge within 24 hours and provide updates as we investigate.",
      },
    ],
  },
  {
    id: "cookies",
    title: "Cookies",
    content: [
      {
        sub: "What We Use",
        body: "We use strictly necessary cookies (authentication session tokens), functional cookies (your preferences), and analytics cookies (to understand feature usage). We do not use third-party advertising cookies.",
      },
      {
        sub: "Managing Cookies",
        body: "You can control cookie preferences via our Cookie Settings page. Disabling analytics cookies will not affect core product functionality.",
      },
    ],
  },
  {
    id: "changes",
    title: "Changes to This Policy",
    content: [
      {
        sub: "",
        body: "We may update this Privacy Policy from time to time. When we do, we will revise the 'Last updated' date at the top of this page and, for material changes, notify you via email or an in-app banner. Your continued use of Snipr after any change constitutes your acceptance of the new policy.",
      },
    ],
  },
  {
    id: "contact",
    title: "Contact Us",
    content: [
      {
        sub: "",
        body: "If you have questions about this Privacy Policy or how we handle your data, contact us at privacy@snipr.sh or by mail at: Snipr, Inc., 340 Pine Street, Suite 800, San Francisco, CA 94104.",
      },
    ],
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicNavbar />

      {/* ── Page header ── */}
      <div className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
        <div className="container max-w-6xl mx-auto px-6 py-20">
          <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888] mb-4">Legal</p>
          <h1 className="font-display font-black text-[42px] md:text-[56px] text-[#0A0A0A] tracking-[-0.035em] leading-[1.04] mb-5">
            Privacy Policy
          </h1>
          <p className="text-[16px] text-[#555] max-w-[560px] leading-[1.7]">
            We believe privacy is a right, not a feature. Here's exactly how Snipr collects, uses, and protects your data.
          </p>
          <p className="text-[12px] text-[#AAA] mt-6">Last updated: March 27, 2026</p>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="flex-1">
        <div className="container max-w-6xl mx-auto px-6 py-16">
          <div className="flex gap-16">

            {/* Sidebar TOC */}
            <aside className="hidden lg:block w-56 flex-shrink-0">
              <div className="sticky top-28">
                <p className="text-[10px] font-bold tracking-[0.20em] uppercase text-[#BBB] mb-4">On this page</p>
                <nav className="space-y-2">
                  {sections.map((s) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className="block text-[13px] text-[#888] hover:text-[#0A0A0A] transition-colors leading-snug"
                    >
                      {s.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Main prose */}
            <div className="flex-1 max-w-[720px]">
              {sections.map((section) => (
                <section key={section.id} id={section.id} className="mb-14 scroll-mt-28">
                  <h2 className="font-display font-black text-[22px] text-[#0A0A0A] tracking-tight mb-6 pb-3 border-b border-[#EBEBEB]">
                    {section.title}
                  </h2>
                  <div className="space-y-6">
                    {section.content.map((item, i) => (
                      <div key={i}>
                        {item.sub && (
                          <h3 className="font-semibold text-[14px] text-[#0A0A0A] mb-2">{item.sub}</h3>
                        )}
                        <p className="text-[14px] text-[#555] leading-[1.8]">{item.body}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
