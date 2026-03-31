# Snipr - Complete Project Briefing for AI Assistant

## What is Snipr?
Snipr is a full-featured **link management and analytics SaaS** (like Bitly/Dub.co). Users can shorten URLs, track clicks with detailed analytics, use custom domains, set up A/B testing, geo-targeting, and more.

**Live URL**: https://snipr.sh
**Main Server IP**: 104.218.51.234
**Redirect Server IP**: 163.245.216.153

---

## Tech Stack
- **Frontend**: Next.js 15 + React 19 (App Router) + Tailwind CSS v4
- **Backend**: Express 5 (TypeScript) on port 8080
- **Database**: PostgreSQL with Drizzle ORM
- **Charts**: Recharts
- **Data Fetching**: TanStack React Query
- **Icons**: Lucide React
- **Monorepo**: pnpm workspaces

---

## Two-Server Architecture

### Server 1: Main App (104.218.51.234)
- Next.js frontend on port 3000
- Express API server on port 8080
- Next.js rewrites all `/api/*` requests to `http://localhost:8080`
- Handles: user auth, dashboard, analytics, link management, billing, admin panel

### Server 2: Redirect Server (163.245.216.153)
- Lightweight Express server
- Handles all custom domain redirects
- When someone visits a short link on a custom domain (e.g., `go.yourbrand.com/promo`), this server:
  1. Looks up the domain + slug in PostgreSQL
  2. Tracks the click (device, browser, country, city, UTM params, QR detection)
  3. Inserts click event into `click_events` table
  4. Redirects user to the destination URL (302)
- Located in: `snipr-redirect/src/index.ts` (separate from main repo)
- Connects to the SAME PostgreSQL database as the main server

### How Redirects Work:
```
User clicks: go.brand.com/promo
  → DNS points to 163.245.216.153 (redirect server)
  → Server looks up domain "go.brand.com" + slug "promo" in DB
  → Tracks click (IP hash, geo, device, browser, UTM, QR)
  → 302 redirect to destination URL

User clicks: snipr.sh/r/promo
  → Main server handles /r/:slug route
  → Same tracking + redirect logic
  → Also supports: password protection, expiry, click limits, A/B rules, geo rules
```

---

## Project Structure
```
/artifacts/
  ├── api-server/              # Express API (port 8080)
  │   ├── src/
  │   │   ├── app.ts           # Express setup (CORS, session, rate limiting)
  │   │   ├── index.ts         # Server entry point
  │   │   ├── routes/
  │   │   │   ├── analytics.ts # Analytics API endpoints
  │   │   │   ├── redirect.ts  # /r/:slug redirect handler
  │   │   │   ├── admin.ts     # Admin panel API
  │   │   │   ├── auth.ts      # User auth (register/login/logout)
  │   │   │   ├── billing.ts   # LemonSqueezy payments
  │   │   │   ├── links.ts     # CRUD for short links
  │   │   │   ├── domains.ts   # Custom domain management
  │   │   │   ├── folders.ts   # Link organization
  │   │   │   ├── tags.ts      # Link tagging
  │   │   │   ├── conversions.ts
  │   │   │   ├── link-rules.ts # Geo/device/AB targeting
  │   │   │   └── integrations.ts
  │   │   └── lib/
  │   │       ├── click-tracker.ts  # Batched click tracking (500ms flush)
  │   │       ├── email.ts          # Resend email service
  │   │       ├── auth.ts           # Session middleware
  │   │       └── integrations-fire.ts # Webhook/integration dispatcher
  │   └── package.json
  │
  └── snipr/                   # Next.js Frontend (port 3000)
      ├── src/
      │   ├── app/
      │   │   ├── globals.css      # Design system (sf-card, sf-badge, etc.)
      │   │   ├── layout.tsx
      │   │   └── (pages)/
      │   ├── views/               # Main page components
      │   │   ├── Dashboard.tsx     # Main dashboard with KPIs + chart
      │   │   ├── Analytics.tsx     # Detailed analytics (charts, breakdowns)
      │   │   ├── Links.tsx         # Link management table
      │   │   ├── Live.tsx          # Real-time click feed (SSE)
      │   │   ├── Domains.tsx       # Custom domain management
      │   │   └── LinkAnalytics.tsx # Per-link analytics
      │   └── components/
      │       ├── layout/
      │       │   ├── ProtectedSidebar.tsx  # Sidebar nav (desktop + mobile)
      │       │   └── ProtectedLayout.tsx   # Auth wrapper layout
      │       ├── LinkModal.tsx     # Create/edit link modal
      │       ├── QrModal.tsx       # QR code generator
      │       └── DomainSetupWizard.tsx
      ├── next.config.ts           # API proxy rewrites
      └── package.json

/lib/
  ├── db/                    # Drizzle ORM
  │   └── src/schema/        # Database table definitions
  ├── api-zod/               # Request/response validation schemas
  ├── api-client-react/      # Auto-generated React Query hooks
  └── integrations/
      └── integrations-openai-ai-server/  # AI insights

/snipr-redirect/             # SEPARATE: Redirect server for custom domains
  └── src/index.ts           # Lightweight redirect + click tracking
```

---

## Environment Variables & API Keys

### Core Config
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/snipr_prod
SESSION_SECRET=<random 64 char string>
NODE_ENV=production
PORT=8080
FRONTEND_URL=https://snipr.sh
```

### External Services

| Service | Variable(s) | Purpose |
|---------|-------------|---------|
| **Resend** | `RESEND_API_KEY` | Transactional emails (verification, welcome). Sends from `no-reply@snipr.sh` |
| **LemonSqueezy** | `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `LEMONSQUEEZY_PRO_VARIANT_ID`, `LEMONSQUEEZY_BUSINESS_VARIANT_ID` | Payment processing, subscription management |
| **OpenAI** | `OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL` | AI analytics insights |
| **DeepSeek** | `DEEPSEEK_API_KEY` | Alternative AI model |

### Admin Panel
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<bcrypt hash>
```

---

## Authentication System
- **Type**: Express-session with PostgreSQL session store
- **Session Duration**: 7 days
- **Cookie**: httpOnly, secure (HTTPS in production)
- **Session stores**: `userId`, `workspaceId`, `isAdmin`
- All dashboard API routes use `requireAuth` middleware
- Admin routes use separate `requireAdmin` middleware with rate limiting (5 attempts / 15 min)

---

## Database Tables (Key Ones)

| Table | Purpose |
|-------|---------|
| `users` | User accounts (name, email, passwordHash, plan, billing IDs) |
| `workspaces` | Multi-tenant workspaces (each user has one) |
| `links` | Short links (slug, destinationUrl, enabled, expiresAt, clickLimit, passwordHash, folderId, domainId) |
| `click_events` | Click analytics (linkId, timestamp, country, city, device, browser, os, referrer, ipHash, isQr, UTM fields) |
| `domains` | Custom domains (domain, verified, workspaceId) |
| `link_rules` | Targeting rules: geo, device, A/B test, rotator (conditions stored as JSONB) |
| `folders` | Link organization |
| `tags` / `link_tags` | Link categorization |
| `conversions` | Conversion tracking |
| `pixels` | Tracking pixels |
| `workspace_integrations` | Slack, Zapier, GA4, webhook, Segment configs |
| `ai_insights` | Cached AI-generated analytics |
| `email_logs` | Email delivery tracking |
| `session` | Express session store |
| `platform_settings` | Runtime config (billing keys, etc.) |

---

## Key API Routes

### Auth
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/register` | Sign up |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/verify-email` | Verify email token |
| POST | `/api/auth/logout` | Sign out |

### Links
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/links` | List all links |
| POST | `/api/links` | Create link |
| PUT | `/api/links/:id` | Update link |
| DELETE | `/api/links/:id` | Delete link |
| POST | `/api/links/:id/duplicate` | Duplicate link |
| POST | `/api/links/bulk` | Bulk enable/disable/delete/move/tag |
| GET | `/api/links/clicks` | Click counts per link |
| GET | `/api/links/sparklines` | 7-day sparkline data per link |

### Analytics
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/analytics/workspace` | Workspace-level analytics (topLinks, topCountries, topBrowsers, topDevices, topReferrers) |
| GET | `/api/analytics/timeseries` | Click timeseries (day/hour/week intervals) |
| GET | `/api/stats/today` | Today's click count |
| GET | `/api/analytics/link/:id` | Per-link analytics |

### Domains
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/domains` | List domains |
| POST | `/api/domains` | Add domain |
| POST | `/api/domains/:id/verify` | DNS verification check |
| DELETE | `/api/domains/:id` | Remove domain |

### Billing (LemonSqueezy)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/billing/checkout` | Create checkout URL |
| GET | `/api/billing/portal` | Customer portal URL |
| GET | `/api/billing/subscription` | Current plan info |
| POST | `/api/billing/webhook` | LemonSqueezy webhook receiver (HMAC verified) |

### Admin
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/admin/login` | Admin auth |
| GET | `/api/admin/stats` | Platform stats |
| GET | `/api/admin/users` | User management |
| GET | `/api/admin/links` | Global link search |
| GET/POST | `/api/admin/settings/billing` | Billing config |

### Real-time
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/realtime/stream` | SSE stream for live click events |

### Other
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST/DELETE | `/api/folders/*` | Folder CRUD |
| GET/POST/DELETE | `/api/tags/*` | Tag CRUD |
| GET/POST/PUT/DELETE | `/api/link-rules/*` | Targeting rules |
| GET/POST/PUT/DELETE | `/api/integrations/*` | Integration management |
| POST | `/api/ai/insights` | AI analytics insights |

---

## Design System (CSS Classes)

The frontend uses a custom design system in `globals.css`:
- `.sf-card` / `.sf-card-elevated` - Card components
- `.sf-section-header` - Card headers
- `.sf-progress-bar` - Horizontal progress bars
- `.sf-badge` - Inline badges
- `.live-dot` - Pulse animation for live indicators
- `.event-slide-in` - Slide-in animation for live feed
- `.kpi-number` - Count-in animation for KPI values
- Color palette: `#728DA7` (accent blue), `#7C5CC4` (purple), `#2E9A72` (green), `#E07B30` (orange), `#0A0A0A` (text)
- Background: `#F6F6F8`

---

## Link Features
1. **Custom slugs** - User-defined or auto-generated
2. **Custom domains** - Any verified domain
3. **Password protection** - Bcrypt-hashed, 30-min unlock window
4. **Expiration dates** - Auto 410 Gone after expiry
5. **Click limits** - Hard cap per link
6. **Fallback URLs** - Used when link disabled/expired
7. **QR codes** - Generated client-side
8. **UTM tracking** - Auto-extracted from query params
9. **Geo targeting** - Country-level redirect rules
10. **Device targeting** - Desktop/mobile/tablet routing
11. **A/B testing** - Weighted traffic split
12. **Rotators** - Round-robin URL cycling
13. **Folders & Tags** - Organization
14. **Bulk actions** - Enable/disable/delete/move/tag multiple links

---

## Important Notes for Editing

1. **Frontend files to edit**: `artifacts/snipr/src/views/` and `artifacts/snipr/src/components/`
2. **CSS/styling**: `artifacts/snipr/src/app/globals.css` + Tailwind classes
3. **API hooks**: Auto-generated in `lib/api-client-react/` - don't edit manually
4. **Next.js proxies API**: All `/api/*` calls go through Next.js rewrite to Express
5. **Domain-scoped slugs**: Links have composite unique constraint on (slug + domainId)
6. **Workspace isolation**: All data is scoped to workspaces - never leak across
7. **snipr.sh is protected**: The domain `snipr.sh` is excluded from custom domain routing
