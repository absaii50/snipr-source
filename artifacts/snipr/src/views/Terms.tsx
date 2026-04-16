"use client";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";

const sections = [
  {
    id: "acceptance",
    title: "Acceptance of Terms",
    body: `By accessing or using Snipr (available at snipr.sh), you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, you may not use the service. Snipr, Inc. reserves the right to update these terms at any time. We will notify you of material changes via email or an in-app notice. Your continued use after any update constitutes acceptance.`,
  },
  {
    id: "services",
    title: "Description of Services",
    body: `Snipr provides a URL shortening and link intelligence platform, including: custom short links, click analytics and reporting, QR code generation, smart routing rules (geo-targeting, device targeting, A/B splits), branded domains, pixel tracking, AI-powered insights, and team collaboration tools. Features vary by subscription plan. We reserve the right to modify, suspend, or discontinue any feature with reasonable notice.`,
  },
  {
    id: "accounts",
    title: "Account Registration & Responsibilities",
    body: `You must provide accurate and complete information when creating an account. You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account. You must notify us immediately at security@snipr.sh if you suspect unauthorized access. You may not share your account with others or allow multiple individuals to use the same login. Accounts are non-transferable.`,
  },
  {
    id: "acceptable-use",
    title: "Acceptable Use Policy",
    body: `You agree not to use Snipr to: (a) distribute spam, malware, phishing links, or other malicious content; (b) infringe on any third-party intellectual property rights; (c) link to illegal content including child sexual abuse material; (d) circumvent, disable, or interfere with security features of the service; (e) use automated tools to create links in bulk without prior written approval; (f) impersonate any person or entity; (g) engage in any activity that violates applicable laws or regulations. We may suspend or terminate accounts that violate this policy, without notice or refund.`,
  },
  {
    id: "payment",
    title: "Billing & Payment",
    body: `Paid plans are billed monthly or annually in advance. All prices are in USD and exclude applicable taxes. By providing payment information, you authorize us to charge the applicable fees to your payment method. Subscriptions auto-renew unless cancelled at least 24 hours before the renewal date. Refunds are not issued for partial months, but we will provide a pro-rated credit if you downgrade mid-cycle. If payment fails, we will retry three times over 7 days before suspending your account. Disputes must be raised within 30 days of the charge.`,
  },
  {
    id: "intellectual-property",
    title: "Intellectual Property",
    body: `Snipr and all of its content, features, and functionality — including logos, design, software, and documentation — are owned by Snipr, Inc. and are protected by intellectual property laws. You are granted a limited, non-exclusive, non-transferable license to use the service as permitted by these terms. You retain ownership of all links, content, and data you create or upload. By using Snipr, you grant us a non-exclusive license to store and process your data solely to provide the service.`,
  },
  {
    id: "third-party",
    title: "Third-Party Links & Services",
    body: `Snipr may integrate with third-party services (e.g., Stripe, Slack, Google Analytics). We are not responsible for the content, privacy practices, or terms of these services. Your use of third-party integrations is governed by those services' terms. We do not endorse or make any representations about third-party services.`,
  },
  {
    id: "disclaimer",
    title: "Disclaimer of Warranties",
    body: `Snipr is provided "as is" and "as available" without any warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the service will be uninterrupted, error-free, or completely secure. While we aim for 99.9% uptime, we do not guarantee continuous availability.`,
  },
  {
    id: "limitation",
    title: "Limitation of Liability",
    body: `To the maximum extent permitted by law, Snipr, Inc. and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages — including lost profits, lost data, or loss of goodwill — arising from your use of the service or these terms. Our total aggregate liability to you for any claims arising under these terms is limited to the amount you paid us in the 12 months preceding the claim, or $100, whichever is greater.`,
  },
  {
    id: "termination",
    title: "Termination",
    body: `You may cancel your account at any time through your account settings. We may suspend or terminate your account immediately if we believe you have violated these terms or our Acceptable Use Policy. Upon termination, your right to use the service ceases immediately. We will retain your data for 30 days after termination, during which you may request an export. After 30 days, your data will be permanently deleted.`,
  },
  {
    id: "governing-law",
    title: "Governing Law & Disputes",
    body: `These terms are governed by the laws of the State of California, without regard to conflict of law principles. Any disputes arising from these terms or your use of Snipr shall be resolved by binding arbitration in San Francisco, California, under the rules of JAMS. You waive any right to a jury trial or class action. If any provision of these terms is found unenforceable, the remaining provisions shall remain in full force and effect.`,
  },
  {
    id: "contact",
    title: "Contact",
    body: `Questions about these Terms? Contact us at legal@snipr.sh or: Snipr, Inc., 340 Pine Street, Suite 800, San Francisco, CA 94104.`,
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicNavbar />

      {/* ── Page header ── */}
      <div className="bg-[#FAFAFA] border-b border-[#E2E8F0]">
        <div className="container max-w-6xl mx-auto px-6 py-20">
          <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888] mb-4">Legal</p>
          <h1 className="font-display font-black text-[42px] md:text-[56px] text-[#0A0A0A] tracking-[-0.035em] leading-[1.04] mb-5">
            Terms of Service
          </h1>
          <p className="text-[16px] text-[#555] max-w-[560px] leading-[1.7]">
            These terms govern your use of Snipr. Please read them carefully — they contain important information about your rights and obligations.
          </p>
          <p className="text-[12px] text-[#AAA] mt-6">Last updated: March 27, 2026 · Effective: March 27, 2026</p>
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
                <section key={section.id} id={section.id} className="mb-12 scroll-mt-28">
                  <h2 className="font-display font-black text-[22px] text-[#0A0A0A] tracking-tight mb-4 pb-3 border-b border-[#E2E8F0]">
                    {section.title}
                  </h2>
                  <p className="text-[14px] text-[#555] leading-[1.8]">{section.body}</p>
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
