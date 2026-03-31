"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { ArrowLeft, Lock, Shield, CreditCard, ChevronDown } from "lucide-react";
import Link from "next/link";

// ─── Plan config ────────────────────────────────────────────────────────────

const VALID_PLANS = ["starter", "growth", "pro", "business", "enterprise"] as const;
type PlanName = typeof VALID_PLANS[number];

const PLAN_INFO: Record<PlanName, { name: string; monthlyPrice: number; annualPrice: number; color: string; description: string }> = {
  starter:    { name: "Starter",    monthlyPrice: 4,   annualPrice: 38,   color: "#728DA7", description: "1M clicks/month · 1 custom domain" },
  growth:     { name: "Growth",     monthlyPrice: 12,  annualPrice: 115,  color: "#4A9B7F", description: "5M clicks/month · 3 custom domains" },
  pro:        { name: "Pro",        monthlyPrice: 29,  annualPrice: 278,  color: "#7C5CC4", description: "25M clicks/month · 10 custom domains" },
  business:   { name: "Business",   monthlyPrice: 79,  annualPrice: 758,  color: "#C45C5C", description: "100M clicks/month · Unlimited domains" },
  enterprise: { name: "Enterprise", monthlyPrice: 149, annualPrice: 1430, color: "#C4945C", description: "Unlimited clicks · Unlimited domains" },
};

// ─── Stripe element styles ───────────────────────────────────────────────────

const elementStyle = {
  base: {
    color: "#EFEFF0",
    fontSize: "14px",
    fontFamily: "'Inter', sans-serif",
    "::placeholder": { color: "#5A5C60" },
  },
  invalid: { color: "#EF4444" },
};

// ─── Countries ───────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" }, { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" }, { code: "FR", name: "France" },
  { code: "IN", name: "India" }, { code: "PK", name: "Pakistan" },
  { code: "AE", name: "United Arab Emirates" }, { code: "SG", name: "Singapore" },
  { code: "NL", name: "Netherlands" }, { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" }, { code: "DK", name: "Denmark" },
  { code: "CH", name: "Switzerland" }, { code: "JP", name: "Japan" },
  { code: "BR", name: "Brazil" }, { code: "MX", name: "Mexico" },
  { code: "ZA", name: "South Africa" }, { code: "NG", name: "Nigeria" },
];

// ─── Inner form (needs Stripe context) ───────────────────────────────────────

interface FormProps {
  plan: PlanName;
  billing: "monthly" | "annual";
  userEmail: string;
}

function CheckoutForm({ plan, billing, userEmail }: FormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const info = PLAN_INFO[plan];
  const price = billing === "annual" ? info.annualPrice : info.monthlyPrice;
  const priceLabel = billing === "annual" ? `$${info.annualPrice}/yr` : `$${info.monthlyPrice}/mo`;

  const [form, setForm] = useState({
    email: userEmail,
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) return;

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create subscription on backend — get client secret
      const res = await fetch("/api/billing/create-subscription-intent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          billing,
          billingDetails: {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone,
            address: form.address,
            city: form.city,
            state: form.state,
            postalCode: form.postalCode,
            country: form.country,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create subscription."); setSubmitting(false); return; }

      // 2. Confirm card payment with Stripe.js
      const { error: stripeError } = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: cardNumber,
          billing_details: {
            name: `${form.firstName} ${form.lastName}`,
            email: form.email,
            phone: form.phone || undefined,
            address: {
              line1: form.address,
              city: form.city,
              state: form.state,
              postal_code: form.postalCode,
              country: form.country,
            },
          },
        },
        return_url: `${window.location.origin}/billing?upgraded=1`,
      });

      if (stripeError) {
        setError(stripeError.message || "Payment failed. Please try again.");
        setSubmitting(false);
        return;
      }

      // 3. Success — go to billing page
      router.push("/billing?upgraded=1");
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const inputCls = "w-full bg-[#1A1A1E] border border-[#2A2A2E] rounded-xl px-4 h-11 text-[14px] text-[#EFEFF0] placeholder-[#5A5C60] focus:outline-none focus:border-[#728DA7] transition-colors";
  const stripeCls = "bg-[#1A1A1E] border border-[#2A2A2E] rounded-xl px-4 h-11 flex items-center focus-within:border-[#728DA7] transition-colors";
  const labelCls = "block text-[12px] font-semibold text-[#8888A0] uppercase tracking-wide mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* Contact information */}
      <div>
        <h2 className="text-[15px] font-bold text-[#EFEFF0] mb-4">Contact information</h2>
        <div>
          <label className={labelCls}>Email address</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@example.com"
            className={inputCls}
          />
        </div>
      </div>

      {/* Billing address */}
      <div>
        <h2 className="text-[15px] font-bold text-[#EFEFF0] mb-4">Billing address</h2>
        <div className="space-y-3">
          {/* Country */}
          <div className="relative">
            <label className={labelCls}>Country / Region</label>
            <div className="relative">
              <select
                required
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                className={`${inputCls} appearance-none pr-10`}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5C60] pointer-events-none" />
            </div>
          </div>

          {/* First / Last name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First name</label>
              <input required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="John" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Last name</label>
              <input required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Doe" className={inputCls} />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className={labelCls}>Address</label>
            <input required value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="123 Main St" className={inputCls} />
          </div>

          {/* City / State / Postal */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>City</label>
              <input required value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="New York" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>State</label>
              <input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="NY" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Postal code</label>
              <input required value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} placeholder="10001" className={inputCls} />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className={labelCls}>Phone <span className="text-[#5A5C60] normal-case font-normal">(optional)</span></label>
            <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 555 000 0000" className={inputCls} />
          </div>
        </div>
      </div>

      {/* Payment */}
      <div>
        <h2 className="text-[15px] font-bold text-[#EFEFF0] mb-4">Payment options</h2>
        <div className="border border-[#2A2A2E] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-[#1A1A1E] border-b border-[#2A2A2E]">
            <div className="w-4 h-4 rounded-full border-2 border-[#728DA7] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-[#728DA7]" />
            </div>
            <span className="text-[13px] font-semibold text-[#EFEFF0]">Credit / Debit Card</span>
            <div className="ml-auto flex items-center gap-1.5">
              {["visa", "mc", "amex", "discover"].map((b) => (
                <div key={b} className="h-5 px-1.5 bg-white rounded text-[8px] font-bold text-[#0A0A0A] flex items-center">
                  {b === "mc" ? "MC" : b === "amex" ? "AMEX" : b.toUpperCase()}
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 space-y-3 bg-[#141416]">
            <div>
              <label className={labelCls}>Card number</label>
              <div className={stripeCls}>
                <CardNumberElement className="flex-1" options={{ style: elementStyle, showIcon: true }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Expiration date</label>
                <div className={stripeCls}>
                  <CardExpiryElement className="flex-1" options={{ style: elementStyle }} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Security code</label>
                <div className={stripeCls}>
                  <CardCvcElement className="flex-1" options={{ style: elementStyle }} />
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-[#2A2A2E] accent-[#728DA7]" />
              <span className="text-[12px] text-[#8888A0]">Save payment information for future purchases</span>
            </label>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-[13px] text-red-400">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || !stripe}
        className="w-full h-12 rounded-xl text-[14px] font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ background: info.color }}
      >
        {submitting ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing…
          </span>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            Subscribe · {priceLabel}
          </>
        )}
      </button>
    </form>
  );
}

// ─── Main Checkout page ───────────────────────────────────────────────────────

export default function Checkout() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const plan = searchParams.get("plan") as PlanName | null;
  const billing = (searchParams.get("billing") ?? "monthly") as "monthly" | "annual";

  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?redirect=/checkout?plan=${plan ?? "starter"}&billing=${billing}`);
    }
  }, [authLoading, user, plan, billing, router]);

  // Load Stripe
  useEffect(() => {
    if (!plan || !VALID_PLANS.includes(plan) || !user) return;
    fetch("/api/billing/publishable-key")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || !data.publishableKey) { setKeyError(data.error || "Billing not configured."); return; }
        setStripePromise(loadStripe(data.publishableKey));
      })
      .catch(() => setKeyError("Could not connect to billing service."));
  }, [plan, user]);

  if (authLoading || (!authLoading && !user)) return null;
  if (!plan || !VALID_PLANS.includes(plan)) { router.replace("/pricing"); return null; }

  const info = PLAN_INFO[plan];
  const price = billing === "annual" ? info.annualPrice : info.monthlyPrice;
  const priceLabel = billing === "annual" ? `$${info.annualPrice}/yr` : `$${info.monthlyPrice}/mo`;
  const perMonth = billing === "annual" ? `$${(info.annualPrice / 12).toFixed(2)}/mo` : null;

  return (
    <div className="min-h-screen bg-[#080708] font-sans">
      {/* Top bar */}
      <div className="border-b border-[#1A1A1E]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/pricing" className="inline-flex items-center gap-2 text-[13px] text-[#5A5C60] hover:text-[#EFEFF0] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to pricing
          </Link>
          <div className="flex items-center gap-2 text-[12px] text-[#5A5C60]">
            <Lock className="w-3.5 h-3.5" />
            Secure checkout
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10 items-start">

        {/* Left — Form */}
        <div>
          {keyError ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
              <div className="text-[16px] font-semibold text-red-400 mb-2">Checkout unavailable</div>
              <p className="text-[13px] text-[#8888A0] mb-4">{keyError}</p>
              <Link href="/pricing" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold bg-white/10 text-white hover:bg-white/15 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Return to pricing
              </Link>
            </div>
          ) : !stripePromise ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-11 bg-[#1A1A1E] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <Elements stripe={stripePromise}>
              <CheckoutForm plan={plan} billing={billing} userEmail={user?.email ?? ""} />
            </Elements>
          )}
        </div>

        {/* Right — Order summary */}
        <div className="lg:sticky lg:top-10">
          <div className="bg-[#141416] border border-[#2A2A2E] rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-[#2A2A2E]">
              <h3 className="text-[14px] font-bold text-[#EFEFF0] mb-4">Order summary</h3>
              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${info.color}20`, border: `1px solid ${info.color}40` }}
                >
                  <CreditCard className="w-6 h-6" style={{ color: info.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold text-[#EFEFF0]">Snipr {info.name}</div>
                  <div className="text-[12px] text-[#5A5C60] mt-0.5">{info.description}</div>
                  <div className="text-[12px] text-[#8888A0] mt-1 capitalize">{billing} billing</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[15px] font-bold text-[#EFEFF0]">{priceLabel}</div>
                  {perMonth && <div className="text-[11px] text-[#5A5C60]">{perMonth}</div>}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 space-y-3">
              <div className="flex justify-between text-[13px]">
                <span className="text-[#8888A0]">Subtotal</span>
                <span className="text-[#EFEFF0] font-medium">{priceLabel}</span>
              </div>
              {billing === "annual" && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-green-400">Annual discount (20%)</span>
                  <span className="text-green-400 font-medium">−${Math.round(info.monthlyPrice * 12 * 0.2)}.00</span>
                </div>
              )}
              <div className="border-t border-[#2A2A2E] pt-3 flex justify-between">
                <span className="text-[14px] font-bold text-[#EFEFF0]">Total</span>
                <span className="text-[14px] font-bold text-[#EFEFF0]">{priceLabel}</span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#2A2A2E] space-y-2.5">
              {[
                { icon: Shield, text: "256-bit SSL encryption" },
                { icon: Lock,   text: "PCI-DSS compliant" },
                { icon: CreditCard, text: "Powered by Stripe" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 text-[12px] text-[#5A5C60]">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {text}
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-[#5A5C60]">
            Cancel anytime · No contracts · Instant access
          </p>
        </div>
      </div>
    </div>
  );
}
