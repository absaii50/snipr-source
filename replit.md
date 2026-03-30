# Workspace — Snipr

## Overview

Snipr is a full-stack URL shortener SaaS built in a pnpm monorepo. Features: short links with custom slugs, QR codes, expiration/enable-disable, session-based auth, full analytics/click tracking, smart routing (geo/device/A/B/rotator redirects), password-protected links, click limits, fallback URLs, retargeting pixels (Meta/Google/LinkedIn/TikTok/custom), custom domains, tags/folders, AI insights (streaming Q&A, smart suggestions, link audit, slug generator), in-process link cache, batch click tracker, PG session store, rate limiting, gzip compression.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + **Next.js 15** App Router (Tailwind CSS v4, shadcn/ui, react-query, react-hook-form)
- **Design system**: Short Freely dark palette — `#080708` bg, `#3C3C44` card, `#EFEFF0` text, `#728DA7` accent (steel blue), `#877971` warm accent, `#5A5C60` muted. Fonts: Plus Jakarta Sans (headings) + Inter (body).
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: express-session + bcryptjs (email/password)
- **QR Codes**: qrcode npm package
- **Geo/Device detection**: geoip-lite, ua-parser-js
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   └── snipr/              # Next.js 15 App Router frontend (port 22647)
│       ├── src/
│       │   ├── app/        # Next.js App Router routes (page.tsx, layout.tsx, etc.)
│       │   ├── views/      # Page view components (imported by app/ pages)
│       │   ├── components/ # Shared UI components (layout/, ui/, etc.)
│       │   ├── hooks/      # Custom React hooks (use-auth.ts, etc.)
│       │   └── lib/        # Utilities and API client
│       ├── next.config.ts
│       └── postcss.config.mjs
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

### Next.js Routing Notes
- **App Router** in `src/app/` — Server Components for metadata/SEO, Client Components for interactive pages
- **Page views** in `src/views/` — All existing page components (renamed from `src/pages/` to avoid Pages Router conflict)
- All view components have `"use client"` directive
- Routing: `next/link` (not wouter), `useRouter`/`usePathname`/`useParams` from `next/navigation`
- Admin routes: `/admin` and `/admin/[tab]` (not optional catch-all)

## Frontend Pages

### Public
- `/` — Landing page
- `/pricing` — Pricing tiers
- `/login` — Email/password login
- `/signup` — Account registration

### Authenticated App (Sidebar layout)
- `/live` — Real-Time Intelligence: live SSE-powered feed with expandable visitor detail rows (click any event → full details: location, device, OS, browser, referrer, QR status, timestamp). 5 KPI cards (Active Now, Session Total, Mobile count + %, Desktop count + %, Countries). Right sidebar: Device Breakdown (mobile/desktop/tablet progress bars + browser list + OS list), Realtime Countries (ranked with flags, progress bars, percentages), Top Active Links (ranked with colored progress bars). All panels have icon + explanation empty states. Auto-reconnects on disconnect.
- `/dashboard` — Overview dashboard: KPI cards (Total Links, 7-Day Clicks, Unique Visitors, Active Links with delta vs last week), Quick Actions, 7-day click bar chart (Recharts), Top Links table with click progress bars, AI Insights summary panel
- `/links` — Link management: search bar, filter tabs (All/Active/Disabled), sort (newest/oldest/name), per-link KPI strip (Total Links/Active/All-Time Clicks from `/api/links/clicks`), copy button, status toggle, click count column, QR/edit/delete actions
- `/analytics` — In-Depth Analytics Hub: Today/Yesterday comparison cards with delta %, KPI row (Total Clicks, Unique Visitors, Total Links, Active Links) with period-over-period deltas, timeseries area chart, Today's Top Links + Top Links Last 7 Days side by side, Device Breakdown panel (mobile/desktop/tablet with progress bars + Browsers sub-section), Top Countries with flags and percentages, Traffic Sources, Today's Visitors by Device (with today's browsers + countries sub-sections). Period selector (7D/30D/90D/1Y) and link filter dropdown.
- `/analytics/:linkId` — Per-link analytics (timeseries, demographics, recent events)
- `/domains` — Custom domain management (add/delete, CNAME verification)
- `/pixels` — Retargeting pixel management (Meta, Google Ads, LinkedIn, TikTok, Custom)
- `/organize` — Folders & Tags management
- `/links/:id/rules` — Per-link routing rules (geo, device, A/B test, rotator)
- `/conversions` — Conversion tracking dashboard with KPIs and recent events table
- `/revenue` — Revenue analytics by link, campaign, and event type with date range filtering
- `/ai` — AI Insights: 3-tab interface: Ask AI (Q&A on real analytics + Quick Question chips), Weekly Summary (AI-generated performance digest), Slug Ideas (AI slug generator with fallback)
- `/team` — Team members management with role assignment and permissions reference

## Backend Routes

### Auth
- `POST /api/auth/register` — Create account + default workspace
- `POST /api/auth/login` — Cookie-based session auth
- `POST /api/auth/logout` — Destroy session
- `GET /api/auth/me` — Get current user + workspace

### Links
- `GET /api/links` — List workspace links
- `GET /api/links/clicks` — Click counts per link `{[linkId]: number}` (must be registered before /:id routes)
- `POST /api/links` — Create short link (slug, password, clickLimit, fallbackUrl, folderId, tagIds)
- `GET /api/links/:id` — Get a single link
- `PUT /api/links/:id` — Edit link (all fields + tag reassignment)
- `DELETE /api/links/:id` — Delete link
- `GET /api/links/:id/qr` — QR code SVG + short URL

### Smart Redirect
- `GET /r/:slug` — Redirect with smart routing (geo/device/A/B/rotator), password protection, click limits, pixel injection
- `POST /r/:slug` — Password form submission; unlocks link in session

### Analytics
- `GET /api/analytics/workspace` — Workspace KPIs + top tables
- `GET /api/analytics/workspace/timeseries` — Clicks over time
- `GET /api/analytics/links/:id` — Per-link KPIs + top tables
- `GET /api/analytics/links/:id/timeseries` — Per-link clicks over time
- `GET /api/analytics/links/:id/events` — Recent click events

### Domains
- `GET /api/domains` — List custom domains
- `POST /api/domains` — Add custom domain
- `DELETE /api/domains/:id` — Remove domain

### Pixels
- `GET /api/pixels` — List retargeting pixels
- `POST /api/pixels` — Add pixel (meta/google_ads/linkedin/tiktok/custom)
- `PUT /api/pixels/:id` — Update pixel
- `DELETE /api/pixels/:id` — Remove pixel

### Tags & Folders
- `GET/POST /api/tags`, `PUT/DELETE /api/tags/:id`
- `GET/POST /api/folders`, `PUT/DELETE /api/folders/:id`
- `GET /api/links/:id/tags` — Get tags for a link
- `PUT /api/links/:id/tags` — Set/replace tags for a link

### Routing Rules
- `GET /api/links/:id/rules` — Get smart routing rules for a link
- `PUT /api/links/:id/rules` — Set/replace rules for a link (bulk)

## Database Schema

- `users` — id, name, email, password_hash, timestamps
- `workspaces` — id, name, slug, user_id, timestamps
- `links` — id, workspace_id, slug, destination_url, title, enabled, expires_at, password_hash, click_limit, fallback_url, folder_id, timestamps
- `click_events` — id, link_id, timestamp, referrer, user_agent, browser, os, device, country, city, ip_hash, is_qr, utm_*
- `domains` — id, workspace_id, domain, verified, timestamps
- `pixels` — id, workspace_id, name, type, pixel_id, custom_script, timestamps
- `tags` — id, workspace_id, name, color, timestamps
- `folders` — id, workspace_id, name, color, timestamps
- `link_tags` — link_id, tag_id (junction)
- `link_rules` — id, link_id, type, destination_url, conditions (JSONB), label, priority, timestamps

## Smart Routing Logic (redirect.ts)

Rule evaluation order:
1. **Geo** — match visitor's country code against rule's `conditions.countries[]`
2. **Device** — match `mobile`/`tablet`/`desktop` against rule's `conditions.devices[]`
3. **A/B** — weighted random pick using `conditions.weight`
4. **Rotator** — uniform random pick from all rotator rules
5. First match wins for geo/device; falls through to A/B/rotator if no match

**Pixel injection**: When a workspace has retargeting pixels, the redirect serves an HTML page that fires all tracking scripts before redirecting (via JS + meta-refresh).

**Password protection**: Server-rendered HTML form; correct password sets `req.session.unlockedLinks[linkId]` and redirects back.

**Click limits**: COUNT query on click_events at redirect time; exceeds limit → fallback URL or 410 page.

## Performance Optimizations

Applied across all authenticated route pages (Dashboard, Analytics, Links, LinkAnalytics):

- **Recharts lazy-loaded**: Chart components split into `artifacts/snipr/src/components/charts/` and loaded via `next/dynamic({ ssr: false })` — removes ~500KB recharts from the initial JS bundle of Dashboard, Analytics, and LinkAnalytics pages.
- **`staleTime: 5 min` everywhere**: All React Query hooks (useGetLinks, useGetDomains, useGetWorkspaceAnalytics, useGetWorkspaceTimeseries, useGetAiInsights, useGetFolders, useGetTags, etc.) have `staleTime: 5 * 60 * 1000` — prevents unnecessary re-fetches when navigating between pages.
- **All-time analytics query fixed**: Dashboard `from: "2020-01-01"` all-time analytics query changed to last 365 days — stops full DB table scans growing indefinitely.

Chart components:
- `src/components/charts/DashboardAreaChart.tsx` — Dashboard area chart (recharts)
- `src/components/charts/AnalyticsAreaChart.tsx` — Analytics area chart (recharts)
- `src/components/charts/LinkAnalyticsChart.tsx` — Per-link analytics chart (recharts)

## Key Files

- `artifacts/api-server/src/routes/redirect.ts` — Smart redirect engine
- `artifacts/api-server/src/routes/links.ts` — Links CRUD with all advanced fields
- `artifacts/api-server/src/lib/pixels.ts` — Pixel injection HTML builder
- `artifacts/api-server/src/routes/link-rules.ts` — Routing rules + link tags
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/db/src/schema/index.ts` — Full DB schema

## TypeScript & Dev Commands

- **Typecheck from root**: `pnpm run typecheck`
- **Run codegen**: `pnpm --filter @workspace/api-spec run codegen`
- **Push DB schema**: `pnpm --filter @workspace/db run push`
- **Build API**: `pnpm --filter @workspace/api-server run build`
