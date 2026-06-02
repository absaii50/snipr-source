/**
 * Guide content — keep this file pure data, no JSX, no imports from the
 * dashboard runtime. The Guide view renders these articles via a tiny
 * inline renderer (see Guide.tsx → RichBody). Update screenshots by
 * dropping files into /public/guide/<file>.png — the slug references
 * here become the relative URLs.
 */

export type Block =
  | { kind: "p";       text: string }
  | { kind: "h2";      text: string }
  | { kind: "h3";      text: string }
  | { kind: "ul";      items: string[] }
  | { kind: "ol";      items: string[] }
  | { kind: "code";    lang?: string; text: string }
  | { kind: "callout"; tone: "info" | "tip" | "warn" | "danger"; title?: string; text: string }
  | { kind: "kv";      pairs: Array<{ key: string; value: string }> }
  | { kind: "image";   src: string; caption: string; alt?: string };

export interface Article {
  id: string;            // slug used in URL fragment
  title: string;
  blurb: string;         // one-sentence summary for TOC
  blocks: Block[];
}

export interface Section {
  id: string;
  title: string;
  intro: string;
  articles: Article[];
}

/* ────────────────────────────────────────────────────────────────────── */

const SECTION_GETTING_STARTED: Section = {
  id: "getting-started",
  title: "Getting started",
  intro: "Sign up, verify, and create your first short link in under 2 minutes.",
  articles: [
    {
      id: "signup",
      title: "Sign up for Snipr",
      blurb: "Create your account — Free tier needs no credit card.",
      blocks: [
        { kind: "p", text: "Snipr is free to start. You get 10,000 clicks/month and up to 5 short links on the Free plan — no credit card, no trial, no time limit." },
        { kind: "h2", text: "Steps" },
        { kind: "ol", items: [
          "Visit snipr.sh and click Sign Up (top right).",
          "Pick a plan — Free is selected by default. You can switch later from Billing.",
          "Enter your name, work email, and a password (min 8 chars).",
          "Click Create free account.",
        ] },
        { kind: "image", src: "/guide/getting-started-signup.png", caption: "The signup form with the Free plan selected. Switching to a paid plan changes the button to 'Continue to checkout — $X/mo'." },
        { kind: "callout", tone: "info", title: "Why we ask for a work email", text: "We send link-click reports, abuse warnings, and security alerts to this address. Use one you actually check." },
      ],
    },
    {
      id: "verify-email",
      title: "Verify your email",
      blurb: "Click the link we send — takes 5 seconds.",
      blocks: [
        { kind: "p", text: "Right after signup we email you a one-click verification link. Until you click it, the dashboard shows a 'Check your inbox' gate." },
        { kind: "image", src: "/guide/getting-started-verify-gate.png", caption: "The verify-email gate that appears until your address is confirmed. Includes a 'Resend' button in case the first email didn't arrive." },
        { kind: "h2", text: "If the email didn't arrive" },
        { kind: "ul", items: [
          "Check the spam folder — first-time senders sometimes land there.",
          "Click 'Resend verification email' on the gate page.",
          "Verification links expire 24 hours after they're sent. Re-send to get a fresh one.",
        ] },
      ],
    },
    {
      id: "first-link",
      title: "Create your first short link",
      blurb: "Paste a URL → get a snipr.sh/r/abc back.",
      blocks: [
        { kind: "p", text: "Once your email is verified you'll see the dashboard. Creating a link takes one field: the destination URL." },
        { kind: "h2", text: "Steps" },
        { kind: "ol", items: [
          "Click the purple Create Link button (top right of the Links page).",
          "Paste your destination URL in the first field.",
          "Optionally: customize the slug (e.g. /r/my-promo), add a title, or pick a domain.",
          "Click Create.",
        ] },
        { kind: "image", src: "/guide/getting-started-create-link.png", caption: "The Create Link modal. Only destinationUrl is required — every other field is optional." },
        { kind: "callout", tone: "tip", title: "Free plan link cap", text: "Free accounts can have up to 5 active short links at a time. Delete an old one to make room, or upgrade to Starter for unlimited links." },
        { kind: "h3", text: "What you get back" },
        { kind: "p", text: "The link appears at the top of your Links page. Click Copy to grab the short URL, or QR to get a downloadable QR code." },
      ],
    },
  ],
};

const SECTION_CUSTOM_DOMAINS: Section = {
  id: "custom-domains",
  title: "Custom domains",
  intro: "Use your own domain (yours.com or links.yours.com) instead of snipr.sh.",
  articles: [
    {
      id: "domains-overview",
      title: "How custom domains work",
      blurb: "DNS routing → SSL provisioning → first link.",
      blocks: [
        { kind: "p", text: "A custom domain lets you serve short links from your own brand — for example brand.com/black-friday instead of snipr.sh/r/x7yz12k. We handle DNS verification, free SSL via Let's Encrypt, and automatic renewal." },
        { kind: "h2", text: "Flow at a glance" },
        { kind: "ol", items: [
          "Add the domain in your Snipr Domains tab.",
          "Add an A record at your DNS provider pointing to our server.",
          "Wait for DNS to propagate (usually under 5 minutes — we auto-verify in the background).",
          "We auto-issue a Let's Encrypt cert (~60 seconds after verification).",
          "Create links and pick the domain in the Domain dropdown.",
        ] },
        { kind: "image", src: "/guide/domains-list.png", caption: "Your Domains page with one active custom domain. The SSL badge shows cert status: pending while we provision, active once Let's Encrypt issues, or failed (with the actual error) if something blocks it." },
      ],
    },
    {
      id: "add-domain",
      title: "Add a custom domain",
      blurb: "Two minutes — type the domain, set one A record.",
      blocks: [
        { kind: "p", text: "Custom domains are available on Starter and above. Free plan accounts can only use the platform domains (snipr.sh, snipr.is, etc.)." },
        { kind: "h2", text: "Steps" },
        { kind: "ol", items: [
          "Go to Domains in the sidebar.",
          "Click Add Domain.",
          "Type your domain or subdomain (e.g. links.yourdomain.com).",
          "Pick a purpose: 'Links only' (root domain is unused) or 'I have a website' (we'll suggest a subdomain so we don't break your site).",
          "Click Add. The setup wizard opens with the DNS record you need to copy.",
        ] },
        { kind: "image", src: "/guide/domains-setup-wizard.png", caption: "The setup wizard shows the exact A record to add — name, value, and a Copy button for each. We auto-detect when DNS propagates so you don't have to click 'Verify' manually." },
      ],
    },
    {
      id: "dns-setup",
      title: "DNS record setup",
      blurb: "One A record. That's it.",
      blocks: [
        { kind: "p", text: "Whether your domain is a root (yours.com) or a subdomain (links.yours.com), the setup is the same: one A record pointing to our server IP." },
        { kind: "h2", text: "The record" },
        { kind: "kv", pairs: [
          { key: "Type",  value: "A" },
          { key: "Name",  value: "@ (for root domain)   OR   the subdomain (e.g. 'links')" },
          { key: "Value", value: "163.245.216.153" },
          { key: "TTL",   value: "Auto / 5 minutes (default is fine)" },
        ] },
        { kind: "image", src: "/guide/domains-dns-record.png", caption: "How the A record looks in a typical DNS provider's UI. Name is '@' for root domains or just the subdomain part (without the trailing domain) for subdomains." },
        { kind: "callout", tone: "warn", title: "If you also have a website on the root domain", text: "Don't point your root domain's A record at us — your existing website will stop working. Use a subdomain like links.yours.com or go.yours.com instead. The wizard offers to create one automatically." },
        { kind: "h3", text: "Common DNS providers" },
        { kind: "ul", items: [
          "Cloudflare: DNS → Add record → A → enter name + 163.245.216.153. Set proxy status to DNS-only (gray cloud) until SSL is active, then you can flip it back to proxied if you want.",
          "GoDaddy: My Products → DNS → Add → A record → enter host + 163.245.216.153.",
          "Namecheap: Advanced DNS → Add New Record → A Record → enter host + 163.245.216.153.",
          "Google Domains / Squarespace: DNS → Custom records → A → enter name + value.",
        ] },
      ],
    },
    {
      id: "verify-and-ssl",
      title: "Verification + SSL",
      blurb: "We auto-detect DNS propagation + issue SSL within ~60s.",
      blocks: [
        { kind: "p", text: "Once you've saved the DNS record at your provider, you don't have to do anything else. Our background watcher checks every 30 seconds, and as soon as DNS resolves correctly we mark the domain verified and start provisioning a free Let's Encrypt SSL certificate." },
        { kind: "image", src: "/guide/domains-verify-success.png", caption: "What you see in the wizard when DNS propagates and SSL is being issued. Updates live — no page refresh needed." },
        { kind: "h2", text: "Timeline" },
        { kind: "kv", pairs: [
          { key: "DNS propagation",     value: "Usually 1–5 min. Some providers can take up to 30 min." },
          { key: "Verification",        value: "Automatic within 30 s of DNS propagating." },
          { key: "SSL issuance",        value: "~60 s after verification (Let's Encrypt)." },
          { key: "SSL renewal",         value: "Automatic every 60 days — you don't have to do anything." },
        ] },
        { kind: "callout", tone: "info", title: "Stuck on 'pending' for more than 15 minutes?", text: "Most often it's a typo in the DNS record name (e.g. 'go' vs 'go.yourdomain.com') or a Cloudflare proxy that's intercepting verification. Use the 'Re-check DNS' button to see what each public resolver is returning." },
      ],
    },
    {
      id: "provider-steps",
      title: "Quick steps by DNS provider",
      blurb: "Cloudflare / GoDaddy / Namecheap / Route 53 / Google / Vercel.",
      blocks: [
        { kind: "p", text: "The wizard auto-detects your DNS host from your nameservers and shows a one-click 'Open <provider> DNS console' button. Below is the exact menu path for the most common providers in case you want to do it manually." },

        { kind: "h2", text: "Cloudflare" },
        { kind: "ol", items: [
          "Sign in at dash.cloudflare.com → pick your domain.",
          "Left sidebar: DNS → Records → Add record.",
          "Type: A · Name: copy from wizard · IPv4 address: 163.245.216.153.",
          "Proxy status: DNS only (gray cloud). Switch to proxied (orange cloud) AFTER your SSL is active in Snipr — otherwise Cloudflare intercepts our Let's Encrypt verification.",
          "Save.",
        ] },

        { kind: "h2", text: "GoDaddy" },
        { kind: "ol", items: [
          "Sign in at godaddy.com → My Products → DNS next to your domain.",
          "Click Add record (or Add at the top of the DNS Records table).",
          "Type: A · Name: copy from wizard · Value: 163.245.216.153 · TTL: 1 hour.",
          "Save. GoDaddy can take 5–60 min to propagate.",
        ] },

        { kind: "h2", text: "Namecheap" },
        { kind: "ol", items: [
          "Sign in at namecheap.com → Domain List → Manage next to your domain.",
          "Advanced DNS tab → Add New Record.",
          "Type: A Record · Host: copy from wizard · Value: 163.245.216.153 · TTL: Automatic.",
          "Save (green checkmark).",
        ] },

        { kind: "h2", text: "AWS Route 53" },
        { kind: "ol", items: [
          "Open the Route 53 console → Hosted Zones → click your domain.",
          "Click Create record.",
          "Record name: leave blank for root, OR enter just the subdomain (e.g. 'go') — do NOT add the full domain.",
          "Record type: A.",
          "Value: 163.245.216.153.",
          "TTL: 300 s.",
          "Create.",
        ] },

        { kind: "h2", text: "Google Domains / Squarespace Domains" },
        { kind: "ol", items: [
          "Sign in at domains.google.com → click your domain → DNS tab.",
          "Scroll to 'Custom records' → Manage custom records → Create new record.",
          "Type: A · Host name: copy from wizard · TTL: 1H · Data: 163.245.216.153.",
          "Save.",
        ] },

        { kind: "h2", text: "Vercel / Netlify / DigitalOcean / Shopify" },
        { kind: "p", text: "These all expose a similar UI: a 'DNS' or 'Custom records' section with an 'Add record' button. Pick Type=A, set Name/Host to the value the wizard shows, and Value/Points-to to 163.245.216.153. Use the auto/default TTL." },

        { kind: "callout", tone: "tip", title: "After saving the record", text: "You don't need to come back to Snipr — our background watcher checks every 30 seconds and verifies the domain automatically when DNS propagates. You'll see the status change in your Domains list, and we email you when SSL goes live." },
      ],
    },
    {
      id: "troubleshooting",
      title: "Troubleshooting domain setup",
      blurb: "DNS not resolving, SSL stuck pending, Cloudflare proxy issues.",
      blocks: [
        { kind: "p", text: "If your domain is stuck in any state, work through the diagnostics here from top to bottom. The wizard's per-resolver dots are your fastest signal — they show what Google, Cloudflare, OpenDNS, and Quad9 each see right now." },

        { kind: "h2", text: "DNS doesn't propagate after 30 minutes" },
        { kind: "ul", items: [
          "Open the Domains tab → click your domain → wizard → step 4 (Verify). The 'Resolver Status' grid tells you which public DNS servers see your record and which don't.",
          "If ALL 4 resolvers show NXDOMAIN: the record didn't save at your registrar, or you saved it on the wrong zone. Re-check the registrar's DNS UI.",
          "If 3 or 4 resolvers show 'Wrong target': you added the A record but pointed it to the wrong IP. The correct value is 163.245.216.153 — copy it from the wizard, don't type.",
          "If some resolvers are green and some still red: DNS is propagating normally — wait another 5–10 minutes.",
          "If the Resolver row shows a TTL much higher than expected (e.g. 86400 s = 1 day), you'll be waiting up to that long for any future DNS changes. Lower the TTL to 300 s at your registrar BEFORE making changes.",
        ] },

        { kind: "h2", text: "SSL stuck on 'pending' for >5 minutes" },
        { kind: "ul", items: [
          "The most common cause is Cloudflare's orange-cloud proxy. Let's Encrypt needs to reach our server directly on port 80 — if Cloudflare is intercepting it, the validation fails. Set the record to 'DNS only' (gray cloud) until SSL goes active, then you can flip it back.",
          "Other proxy services (Sucuri, Imperva, Akamai) cause the same issue.",
          "If the wizard says 'SSL certificate failed' with an error like 'Connection refused' or 'Timeout', it's almost always a proxy/firewall issue at your end.",
          "Let's Encrypt rate-limits to 5 failed validations per hour per domain. If you've retried several times, wait 60 minutes before trying again.",
        ] },

        { kind: "h2", text: "Custom domain works but visitors get an SSL warning" },
        { kind: "ul", items: [
          "Make sure you're using https:// (not http://) when sharing your short links.",
          "Check that ssl_status shows 'active' on the Domains page (not 'pending' or 'failed').",
          "If you toggled Cloudflare's proxy ON without setting SSL/TLS mode to 'Full' or 'Full (strict)', visitors get a redirect loop. Cloudflare → SSL/TLS → Overview → set to Full.",
        ] },

        { kind: "h2", text: "I have a website on the root domain" },
        { kind: "ul", items: [
          "Pointing yours.com (root) at Snipr will break your existing website. Use a subdomain like links.yours.com or go.yours.com instead.",
          "When you add the root domain in the wizard, we detect this and offer to switch to a subdomain with one click.",
          "Subdomains also work with email — adding go.yours.com as an A record won't touch your MX records for yours.com.",
        ] },

        { kind: "h2", text: "How to remove a domain" },
        { kind: "p", text: "On the Domains page, click the trash icon next to the domain. We delete the row + revoke the SSL cert. Existing links on that domain will stop redirecting immediately, so update or delete them first." },

        { kind: "callout", tone: "danger", title: "Still stuck?", text: "Open a support ticket from the Support tab with: (1) your domain name, (2) the current DNS provider, (3) a screenshot of the wizard's Resolver Status grid. That's everything we need to diagnose in 2 minutes." },
      ],
    },
  ],
};

const SECTION_LINK_FEATURES: Section = {
  id: "link-features",
  title: "Link features",
  intro: "Password protection, expiry, deep links, cloaking, and routing rules.",
  articles: [
    {
      id: "password",
      title: "Password-protected links",
      blurb: "Visitors must enter a password before the redirect fires.",
      blocks: [
        { kind: "p", text: "Use this for any short link that points to sensitive material — drafts, internal docs, private events. Plan: Starter+." },
        { kind: "h2", text: "Set a password" },
        { kind: "ol", items: [
          "Open the Create Link or Edit Link modal.",
          "Expand 'Advanced'.",
          "Enter a password in the Password field. Anything 4+ characters works; we store a bcrypt hash, never the raw password.",
          "Save.",
        ] },
        { kind: "image", src: "/guide/features-password-form.png", caption: "Setting a password on a link. The hash is stored server-side; even Snipr admins cannot read the original password." },
        { kind: "h2", text: "Visitor experience" },
        { kind: "p", text: "When someone clicks the link they see a password prompt. Entering the correct password lets them through to the destination once — every fresh click re-prompts." },
        { kind: "image", src: "/guide/features-password-prompt.png", caption: "The password prompt visitors see. Branding-free + works on every device." },
        { kind: "callout", tone: "tip", title: "Sharing the password", text: "Send the password through a different channel than the link itself — e.g. link via email, password via Slack DM. That way an intercepted email alone isn't enough." },
      ],
    },
    {
      id: "expiry",
      title: "Link expiry & scheduling",
      blurb: "Auto-expire on a date, or fall back to another URL.",
      blocks: [
        { kind: "p", text: "Expiry turns a link off automatically at a chosen moment. Optionally set a fallback URL so visitors after expiry land somewhere useful instead of seeing 'Link expired'. Plan: Starter+." },
        { kind: "h2", text: "Set an expiry date" },
        { kind: "ol", items: [
          "Edit the link.",
          "Pick an expiry date + time in the Advanced section.",
          "(Optional) set a Fallback URL — where to send visitors after expiry.",
          "Save.",
        ] },
        { kind: "image", src: "/guide/features-expiry-picker.png", caption: "The date/time picker. Times are in your local timezone but stored as UTC." },
        { kind: "callout", tone: "info", title: "Use cases", text: "Flash sales, RSVP forms with a cutoff, time-limited promo codes, event registrations, contest entries." },
      ],
    },
    {
      id: "cloak",
      title: "Link cloaking",
      blurb: "Hide the destination URL from the address bar.",
      blocks: [
        { kind: "p", text: "A cloaked link keeps your short URL in the address bar even after the redirect — the destination loads in an invisible iframe. Plan: Growth+." },
        { kind: "image", src: "/guide/features-cloak-toggle.png", caption: "The 'Cloak destination' toggle in the link form." },
        { kind: "h2", text: "When to use it" },
        { kind: "ul", items: [
          "Affiliate links where you don't want the network name visible.",
          "Long ugly URLs (e.g. tracking-heavy product pages) that you want to keep clean in browser history.",
          "Brand consistency — visitors see brand.com/sale instead of partner-tracking-site.com/?aff=12345.",
        ] },
        { kind: "callout", tone: "warn", title: "Limitations", text: "Cloaking uses an iframe. Some sites (Google, banks, anything with X-Frame-Options: DENY) refuse to load inside iframes — those destinations will auto-fall-through to a normal redirect after 8 seconds." },
      ],
    },
    {
      id: "deep-links",
      title: "iOS / Android deep links",
      blurb: "Open native apps directly when installed.",
      blocks: [
        { kind: "p", text: "Deep links let your short URL open a specific screen in the user's native app (Instagram, YouTube, your own app, etc.) when that app is installed — otherwise fall through to the web URL. Plan: Growth+." },
        { kind: "h2", text: "Setup" },
        { kind: "ol", items: [
          "Edit the link.",
          "In Advanced, enter the iOS deep link scheme (e.g. instagram://user?username=snipr).",
          "And/or the Android deep link (often the same scheme, sometimes intent:// — check your app's deep-link docs).",
          "Save. The web destinationUrl stays as the fallback.",
        ] },
        { kind: "image", src: "/guide/features-deep-link-form.png", caption: "Deep link fields. Both iOS and Android are optional — fill the ones that matter for your audience." },
        { kind: "callout", tone: "tip", title: "Testing deep links", text: "Test on a real device with the target app installed. Browser dev tools simulators won't fire the OS-level app handoff." },
      ],
    },
    {
      id: "hide-referrer",
      title: "Hide referrer",
      blurb: "Don't tell the destination where the visitor came from.",
      blocks: [
        { kind: "p", text: "When this is on, the destination site receives no Referer header — they only see that someone arrived, not which page sent them. Useful for privacy-sensitive links or anti-cloak scraping. Plan: Growth+." },
        { kind: "image", src: "/guide/features-hide-referrer-toggle.png", caption: "The Hide Referrer toggle." },
      ],
    },
    {
      id: "link-rules",
      title: "Routing rules (geo / device / A-B)",
      blurb: "Send different visitors to different destinations.",
      blocks: [
        { kind: "p", text: "Routing rules let one short link split traffic by visitor country, city, device, or random weighted split. Plan: Pro+." },
        { kind: "h2", text: "Available rule types" },
        { kind: "kv", pairs: [
          { key: "Geo",     value: "Match by visitor country (ISO-2 code, e.g. US, GB)." },
          { key: "City",    value: "Match by city or region — useful for hyper-local campaigns." },
          { key: "Device",  value: "Match by device class — desktop, mobile, tablet." },
          { key: "A / B",   value: "Random split with weights — e.g. 50/50 between two destinations." },
          { key: "Rotator", value: "Even round-robin across N destinations." },
        ] },
        { kind: "image", src: "/guide/features-link-rules.png", caption: "The rules editor for a link. Rules evaluate in priority order; first match wins. If no rule matches, the link's default destination is used." },
        { kind: "callout", tone: "info", title: "Use case", text: "Geo-split your global campaign: US visitors → app.com/usa, UK visitors → app.com/uk, everyone else → app.com." },
      ],
    },
  ],
};

const SECTION_ANALYTICS: Section = {
  id: "analytics",
  title: "Analytics & tracking",
  intro: "Click charts, UTM builder, conversion API, and ad-platform pixels.",
  articles: [
    {
      id: "dashboard-overview",
      title: "Dashboard analytics",
      blurb: "Real-time clicks, top links, geo, devices, referrers.",
      blocks: [
        { kind: "p", text: "Every link click is tracked in real time. The dashboard's Analytics page shows clicks over time, top links, top referrers, geo breakdown, device split, and a live click feed." },
        { kind: "image", src: "/guide/analytics-dashboard.png", caption: "The Analytics page. Use the period selector (top right) to switch between Last 1h / 24h / 7d / 30d / 3m / 12m." },
        { kind: "callout", tone: "info", title: "Click limits per plan", text: "Free: 10K clicks/month. Starter: 1M. Growth: 5M. Pro: 25M. Business: 100M. When you exceed the cap we warn you, then start serving plan-limit pages on links 3 days later if you don't upgrade." },
      ],
    },
    {
      id: "utm",
      title: "UTM builder + templates",
      blurb: "Pre-fill source / medium / campaign on every link.",
      blocks: [
        { kind: "p", text: "UTM parameters tell your analytics tools (GA4, Mixpanel, Amplitude) which channel a visitor came from. Snipr's UTM builder pre-fills them per link and saves templates for the channels you use often. Plan: Growth+." },
        { kind: "h2", text: "Build UTMs inline" },
        { kind: "ol", items: [
          "Open the Create Link or Edit Link modal.",
          "Expand 'UTM tracking'.",
          "Fill source / medium / campaign / (optional) term + content. Each field autocompletes from your past values.",
          "Save. The UTM params get appended to the destination URL.",
        ] },
        { kind: "image", src: "/guide/analytics-utm-builder.png", caption: "The UTM builder. Click 'Save as template' to reuse the same source/medium/campaign across many links." },
        { kind: "h2", text: "Templates" },
        { kind: "p", text: "Templates are presets — e.g. a 'Facebook ads' template with source=facebook, medium=cpc, campaign=auto-detect. Apply a template with one click on any new link." },
      ],
    },
    {
      id: "conversions",
      title: "Conversion tracking",
      blurb: "Fire an API call when a click turns into a sale / signup.",
      blocks: [
        { kind: "p", text: "Conversion tracking measures what % of clicks turn into real outcomes (purchase, signup, lead). You call our /api/conversions endpoint from your server when a conversion happens — we attribute it back to the click. Plan: Pro+." },
        { kind: "h2", text: "API setup" },
        { kind: "ol", items: [
          "Create an API key in Settings → API Keys (Pro+).",
          "On your server, when a conversion happens (e.g. checkout completes), POST to /api/conversions.",
          "View conversions + revenue in the Conversions tab of your dashboard.",
        ] },
        { kind: "code", lang: "bash", text: `curl -X POST https://snipr.sh/api/conversions \\
  -H "X-API-Key: sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "slug": "summer-sale",
    "eventType": "purchase",
    "value": 49.99,
    "currency": "USD",
    "metadata": {"orderId": "abc123"}
  }'` },
        { kind: "image", src: "/guide/analytics-conversions.png", caption: "The Conversions page — see total conversions, conversion rate, and revenue attributed per link." },
      ],
    },
    {
      id: "pixels",
      title: "Conversion pixels (Meta / Google / TikTok / LinkedIn)",
      blurb: "Fire ad-platform pixels on every link click without editing the destination.",
      blocks: [
        { kind: "p", text: "Pixels let your ad platform (Meta, Google Ads, TikTok, LinkedIn) count short-link clicks as page views — useful when the destination is a site you don't own (e.g. a partner's product page). Plan: Pro+." },
        { kind: "h2", text: "How it works" },
        { kind: "p", text: "When someone clicks a short link, we serve a tiny intermediate HTML page that loads your pixel script, fires a PageView event, then forwards to the destination 50ms later. The visitor never sees the page — they just feel a normal redirect." },
        { kind: "h2", text: "Add a pixel" },
        { kind: "ol", items: [
          "Go to Pixels in the sidebar.",
          "Click Add Pixel.",
          "Pick a type (Meta, Google Ads, TikTok, LinkedIn, or Custom).",
          "Paste your pixel ID (e.g. Meta's 16-digit ID, Google's AW-XXXXXXX, TikTok's CABC123). For Custom, paste the script tag your platform gave you.",
          "Save. The pixel now fires on every link in this workspace.",
        ] },
        { kind: "image", src: "/guide/analytics-pixels-form.png", caption: "Adding a pixel. The 'type' you pick determines the script we inject; you just need the pixel ID." },
        { kind: "callout", tone: "warn", title: "All-workspace by default", text: "Right now pixels fire on every link in your workspace. If you need per-link pixel selection, contact support — it's on our roadmap." },
        { kind: "callout", tone: "tip", title: "Custom scripts", text: "The 'Custom' pixel type accepts a full <script>...</script> tag. We block dangerous patterns (document.cookie writes, eval, fetch to non-tracking hosts) so paste only ad-platform-provided scripts." },
      ],
    },
  ],
};

export const SECTIONS: Section[] = [
  SECTION_GETTING_STARTED,
  SECTION_CUSTOM_DOMAINS,
  SECTION_LINK_FEATURES,
  SECTION_ANALYTICS,
];

/** Flat list used by the search index. */
export const ALL_ARTICLES: Array<Article & { sectionId: string; sectionTitle: string }> = SECTIONS.flatMap(
  (s) => s.articles.map((a) => ({ ...a, sectionId: s.id, sectionTitle: s.title })),
);
