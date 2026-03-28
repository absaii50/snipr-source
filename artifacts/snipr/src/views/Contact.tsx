"use client";
import { useState, type FormEvent } from "react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Mail, MessageSquare, Twitter, Github, MapPin, Clock, CheckCircle } from "lucide-react";

const contactOptions = [
  {
    icon: Mail,
    title: "General Inquiries",
    description: "Questions about Snipr, partnerships, or press.",
    value: "hello@snipr.sh",
    href: "mailto:hello@snipr.sh",
  },
  {
    icon: MessageSquare,
    title: "Customer Support",
    description: "Help with your account, links, or billing.",
    value: "support@snipr.sh",
    href: "mailto:support@snipr.sh",
  },
  {
    icon: Mail,
    title: "Privacy & Legal",
    description: "Data requests, legal notices, compliance questions.",
    value: "legal@snipr.sh",
    href: "mailto:legal@snipr.sh",
  },
  {
    icon: Mail,
    title: "Security",
    description: "Report a vulnerability or security concern.",
    value: "security@snipr.sh",
    href: "mailto:security@snipr.sh",
  },
];

const subjects = [
  "General question",
  "Account & billing",
  "Technical support",
  "Partnership inquiry",
  "Enterprise plan",
  "Press & media",
  "Other",
];

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: subjects[0],
    message: "",
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicNavbar />

      {/* ── Page header ── */}
      <div className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
        <div className="container max-w-6xl mx-auto px-6 py-20">
          <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888] mb-4">Get in Touch</p>
          <h1 className="font-display font-black text-[42px] md:text-[56px] text-[#0A0A0A] tracking-[-0.035em] leading-[1.04] mb-5">
            We'd love to hear<br className="hidden md:block" /> from you.
          </h1>
          <p className="text-[16px] text-[#555] max-w-[520px] leading-[1.7]">
            Whether you have a question about features, pricing, or anything else — our team is ready to answer.
          </p>
        </div>
      </div>

      <main className="flex-1">
        <div className="container max-w-6xl mx-auto px-6 py-16">
          <div className="grid lg:grid-cols-[1fr_400px] gap-16 items-start">

            {/* ── Contact form ── */}
            <div>
              {submitted ? (
                <div className="flex flex-col items-start gap-5 py-16">
                  <div className="w-14 h-14 rounded-2xl bg-[#3B9A6A]/8 border border-[#3B9A6A]/20 flex items-center justify-center">
                    <CheckCircle className="w-7 h-7 text-[#3B9A6A]" />
                  </div>
                  <div>
                    <h2 className="font-display font-black text-[28px] text-[#0A0A0A] tracking-tight mb-2">Message sent!</h2>
                    <p className="text-[15px] text-[#555] leading-[1.7] max-w-[440px]">
                      Thanks for reaching out, <strong className="text-[#0A0A0A]">{form.name}</strong>. We typically respond within one business day. Keep an eye on <span className="font-mono text-[#728DA7]">{form.email}</span>.
                    </p>
                  </div>
                  <button
                    onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: subjects[0], message: "" }); }}
                    className="text-[13px] text-[#728DA7] hover:underline font-semibold mt-2"
                  >
                    Send another message →
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[12px] font-semibold text-[#0A0A0A] mb-2">Full name</label>
                      <input
                        type="text"
                        required
                        placeholder="Alex Johnson"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full bg-[#FAFAFA] border border-[#E0E0E0] text-[14px] text-[#0A0A0A] placeholder-[#BBB] px-4 py-3 rounded-xl focus:outline-none focus:border-[#728DA7] focus:bg-white transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-[#0A0A0A] mb-2">Email address</label>
                      <input
                        type="email"
                        required
                        placeholder="alex@company.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full bg-[#FAFAFA] border border-[#E0E0E0] text-[14px] text-[#0A0A0A] placeholder-[#BBB] px-4 py-3 rounded-xl focus:outline-none focus:border-[#728DA7] focus:bg-white transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-[#0A0A0A] mb-2">Subject</label>
                    <select
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      className="w-full bg-[#FAFAFA] border border-[#E0E0E0] text-[14px] text-[#0A0A0A] px-4 py-3 rounded-xl focus:outline-none focus:border-[#728DA7] focus:bg-white transition-colors appearance-none cursor-pointer"
                    >
                      {subjects.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-[#0A0A0A] mb-2">Message</label>
                    <textarea
                      required
                      rows={7}
                      placeholder="Tell us what's on your mind..."
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="w-full bg-[#FAFAFA] border border-[#E0E0E0] text-[14px] text-[#0A0A0A] placeholder-[#BBB] px-4 py-3 rounded-xl focus:outline-none focus:border-[#728DA7] focus:bg-white transition-colors resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#222] text-white text-[14px] font-semibold px-8 py-3.5 rounded-xl transition-colors"
                  >
                    Send Message
                  </button>

                  <p className="text-[12px] text-[#AAA]">
                    We typically respond within 1 business day. For urgent issues, email support@snipr.sh directly.
                  </p>
                </form>
              )}
            </div>

            {/* ── Sidebar ── */}
            <div className="space-y-6">

              {/* Contact options */}
              <div className="space-y-3">
                {contactOptions.map((opt) => (
                  <a
                    key={opt.title}
                    href={opt.href}
                    className="block bg-[#FAFAFA] hover:bg-[#F5F5F5] border border-[#EBEBEB] rounded-2xl p-5 transition-colors group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-9 h-9 rounded-xl bg-white border border-[#E0E0E0] flex items-center justify-center flex-shrink-0 group-hover:border-[#728DA7]/30 transition-colors">
                        <opt.icon className="w-4 h-4 text-[#888]" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[14px] text-[#0A0A0A] mb-0.5">{opt.title}</div>
                        <div className="text-[12px] text-[#888] mb-2">{opt.description}</div>
                        <div className="font-mono text-[12px] text-[#728DA7]">{opt.value}</div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>

              {/* Office & hours */}
              <div className="bg-[#FAFAFA] border border-[#EBEBEB] rounded-2xl p-6 space-y-5">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#888] mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-[12px] font-semibold text-[#0A0A0A] mb-1">Office</div>
                    <div className="text-[13px] text-[#555] leading-[1.6]">
                      340 Pine Street, Suite 800<br />
                      San Francisco, CA 94104<br />
                      United States
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-[#888] mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-[12px] font-semibold text-[#0A0A0A] mb-1">Support Hours</div>
                    <div className="text-[13px] text-[#555] leading-[1.6]">
                      Monday – Friday<br />
                      9:00 AM – 6:00 PM PST
                    </div>
                  </div>
                </div>
              </div>

              {/* Social */}
              <div className="bg-[#FAFAFA] border border-[#EBEBEB] rounded-2xl p-6">
                <p className="text-[12px] font-semibold text-[#888] mb-4">Also find us on</p>
                <div className="flex gap-3">
                  <a href="#" className="flex items-center gap-2 text-[13px] text-[#555] hover:text-[#0A0A0A] transition-colors">
                    <Twitter className="w-4 h-4" />
                    @snipr_sh
                  </a>
                  <span className="text-[#DDD]">·</span>
                  <a href="#" className="flex items-center gap-2 text-[13px] text-[#555] hover:text-[#0A0A0A] transition-colors">
                    <Github className="w-4 h-4" />
                    snipr-hq
                  </a>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
