"use client";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";

const cookieTypes = [
  {
    name: "Strictly Necessary",
    required: true,
    description:
      "These cookies are essential for the website to function and cannot be disabled. They are set in response to actions you take, such as logging in or setting your privacy preferences.",
    examples: [
      { name: "snipr_session", purpose: "Maintains your authenticated session", expiry: "7 days" },
      { name: "csrf_token", purpose: "Prevents cross-site request forgery attacks", expiry: "Session" },
      { name: "cookie_consent", purpose: "Stores your cookie preference choices", expiry: "1 year" },
    ],
  },
  {
    name: "Functional",
    required: false,
    description:
      "These cookies allow Snipr to remember choices you make (such as your preferred timezone, language, or dashboard layout) to provide a more personalized experience.",
    examples: [
      { name: "snipr_tz", purpose: "Stores your preferred timezone for analytics display", expiry: "1 year" },
      { name: "snipr_theme", purpose: "Remembers your UI theme preference", expiry: "1 year" },
      { name: "snipr_last_ws", purpose: "Remembers your last active workspace", expiry: "30 days" },
    ],
  },
  {
    name: "Analytics",
    required: false,
    description:
      "These cookies help us understand how you interact with Snipr, which pages are most useful, and where errors occur. All data is aggregated and anonymized — we never use it to identify individuals.",
    examples: [
      { name: "_snipr_anon", purpose: "Anonymous session identifier for usage analytics", expiry: "90 days" },
      { name: "pf_visitor", purpose: "Tracks feature adoption across sessions (anonymized)", expiry: "6 months" },
    ],
  },
  {
    name: "Third-Party (Sub-processors)",
    required: false,
    description:
      "Some features rely on third-party services that may set their own cookies. We minimize these integrations and only include them where strictly necessary for product functionality.",
    examples: [
      { name: "__stripe_mid", purpose: "Stripe fraud prevention on checkout pages", expiry: "1 year" },
      { name: "__stripe_sid", purpose: "Stripe session for payment processing", expiry: "30 minutes" },
    ],
  },
];

export default function Cookies() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicNavbar />

      {/* ── Page header ── */}
      <div className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
        <div className="container max-w-6xl mx-auto px-6 py-20">
          <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888] mb-4">Legal</p>
          <h1 className="font-display font-black text-[42px] md:text-[56px] text-[#0A0A0A] tracking-[-0.035em] leading-[1.04] mb-5">
            Cookie Policy
          </h1>
          <p className="text-[16px] text-[#555] max-w-[560px] leading-[1.7]">
            Snipr uses cookies to keep your session secure, remember your preferences, and improve the product. Here's a full breakdown of exactly what we use and why.
          </p>
          <p className="text-[12px] text-[#AAA] mt-6">Last updated: March 27, 2026</p>
        </div>
      </div>

      <main className="flex-1">
        <div className="container max-w-4xl mx-auto px-6 py-16 space-y-16">

          {/* Intro */}
          <section>
            <h2 className="font-display font-black text-[22px] text-[#0A0A0A] tracking-tight mb-4 pb-3 border-b border-[#EBEBEB]">
              What Are Cookies?
            </h2>
            <p className="text-[14px] text-[#555] leading-[1.8]">
              Cookies are small text files stored on your device by your web browser. They are widely used to make websites and web applications work, improve user experiences, and provide analytical information to site owners. Cookies are not programs — they cannot carry viruses or install malware.
            </p>
            <p className="text-[14px] text-[#555] leading-[1.8] mt-4">
              Snipr uses cookies and similar technologies (such as local storage) to authenticate users, remember preferences, and measure product usage. We do not use cookies for advertising or cross-site tracking.
            </p>
          </section>

          {/* Cookie types */}
          {cookieTypes.map((type) => (
            <section key={type.name}>
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#EBEBEB]">
                <h2 className="font-display font-black text-[22px] text-[#0A0A0A] tracking-tight flex-1">
                  {type.name}
                </h2>
                <span className={`text-[10px] font-bold tracking-[0.18em] uppercase px-2.5 py-1 rounded-full border ${
                  type.required
                    ? "text-[#728DA7] border-[#728DA7]/30 bg-[#728DA7]/5"
                    : "text-[#888] border-[#DDD] bg-[#F5F5F5]"
                }`}>
                  {type.required ? "Always On" : "Optional"}
                </span>
              </div>
              <p className="text-[14px] text-[#555] leading-[1.8] mb-6">{type.description}</p>

              {/* Cookie table */}
              <div className="rounded-xl border border-[#EBEBEB] overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#FAFAFA] border-b border-[#EBEBEB]">
                      <th className="text-left px-5 py-3 font-semibold text-[#0A0A0A]">Cookie name</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#0A0A0A]">Purpose</th>
                      <th className="text-left px-5 py-3 font-semibold text-[#0A0A0A] whitespace-nowrap">Expiry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {type.examples.map((ex, i) => (
                      <tr key={ex.name} className={i < type.examples.length - 1 ? "border-b border-[#EBEBEB]" : ""}>
                        <td className="px-5 py-3.5 font-mono text-[12px] text-[#728DA7]">{ex.name}</td>
                        <td className="px-5 py-3.5 text-[#555]">{ex.purpose}</td>
                        <td className="px-5 py-3.5 text-[#888] whitespace-nowrap">{ex.expiry}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {/* Managing cookies */}
          <section>
            <h2 className="font-display font-black text-[22px] text-[#0A0A0A] tracking-tight mb-4 pb-3 border-b border-[#EBEBEB]">
              Managing Your Cookie Preferences
            </h2>
            <div className="space-y-5">
              <p className="text-[14px] text-[#555] leading-[1.8]">
                You can control optional cookies at any time through our Cookie Settings panel (accessible from the footer of any page). Disabling analytics or functional cookies will not affect your ability to use the core product — it may only impact things like saved preferences.
              </p>
              <p className="text-[14px] text-[#555] leading-[1.8]">
                You can also control cookies directly in your browser. Most browsers allow you to view, delete, and block cookies. Here are links to cookie management instructions for popular browsers:{" "}
                <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-[#728DA7] hover:underline">Chrome</a>,{" "}
                <a href="https://support.mozilla.org/kb/enable-and-disable-cookies-website-preferences" target="_blank" rel="noopener noreferrer" className="text-[#728DA7] hover:underline">Firefox</a>,{" "}
                <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471" target="_blank" rel="noopener noreferrer" className="text-[#728DA7] hover:underline">Safari</a>.
              </p>
              <p className="text-[14px] text-[#555] leading-[1.8]">
                Note: Blocking strictly necessary cookies will prevent Snipr from functioning correctly. We recommend allowing all cookies in the "Strictly Necessary" category.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h2 className="font-display font-black text-[22px] text-[#0A0A0A] tracking-tight mb-4 pb-3 border-b border-[#EBEBEB]">
              Questions?
            </h2>
            <p className="text-[14px] text-[#555] leading-[1.8]">
              If you have questions about our use of cookies, email us at <a href="mailto:privacy@snipr.sh" className="text-[#728DA7] hover:underline">privacy@snipr.sh</a>.
            </p>
          </section>

        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
