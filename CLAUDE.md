# Snipr — URL Shortener Platform

## Architecture Overview

Snipr runs on **2 separate servers**:

### Server 1: Main App Server
- **IP:** 104.218.51.234
- **SSH:** `ssh root@104.218.51.234` | Password: `uSZ29H*D`
- **What runs here:** Next.js frontend (port 3000) + Express API (port 8080) + PostgreSQL database
- **Systemd service:** `snipr-api.service`
- **App path:** `/var/www/snipr/`
- **Env file:** `/var/www/snipr/.env`
- **Nginx:** Routes `snipr.sh` → frontend (3000) for `/`, API (8080) for `/api/` and `/r/`
- **Also has:** Custom domain catch-all nginx block (for CNAME-based subdomains that resolve via snipr.sh)
- **GitHub:** https://github.com/absaii50/snipr-source

### Server 2: Custom Domain Redirect Server
- **IP:** 163.245.216.153
- **SSH:** `ssh root@163.245.216.153` | Password: `gB*s4s3v`
- **What runs here:** Lightweight Express redirect server (port 8080) + SSL auto-manager
- **Systemd services:** `snipr-redirect.service`, `snipr-ssl-manager.service`
- **App path:** `/var/www/snipr-redirect/`
- **Nginx:** Catch-all for all custom domains → proxy to port 8080
- **SSL:** Auto-provisioned by ssl-manager (checks every 60s for new verified domains, runs certbot)
- **Database:** Connects to Server 1's PostgreSQL remotely (read-only for domains/links, write for click_events)
- **GitHub:** https://github.com/absaii50/snipr-redirect

## How Custom Domains Work

1. User adds domain in dashboard → stored in `domains` table (verified=false)
2. User sets DNS: **Root domain** → A record to `163.245.216.153` | **Subdomain** → CNAME to `snipr.sh`
3. User clicks verify → DNS check passes → `verified=true`
4. SSL manager on Server 2 detects new verified domain → auto-installs Let's Encrypt cert
5. When someone visits `customdomain.com/slug`:
   - DNS resolves to Server 2 (163.245.216.153)
   - Nginx → Express redirect app → looks up domain + slug in DB → 301 redirect

## Platform Domains vs User Domains

- **Platform domains** (`is_platform_domain=true`): Visible to ALL users, anyone can create links on them
- **User domains**: Owned by a specific workspace, only that workspace can create links
- Slug uniqueness is enforced per domain (not per workspace) to prevent conflicts on platform domains

## Key Technical Details

- **Stripe SDK:** v21 (API 2025-04-30.basil) — uses `confirmation_secret.client_secret` (NOT `payment_intent`)
- **Auth:** bcryptjs (NOT bcrypt) — hash generation must use same library as verification
- **Admin credentials:** Username: `9b57b8ee86ce` | Password: `e5TQiphjGhVPX8`
- **DB unique constraint on links:** `(workspace_id, slug, domain_id)` — but app-level check enforces `(slug, domain_id)` uniqueness
- **Domain table:** `domain` column is globally unique

## Deployment

### Main server (snipr-source):
```bash
# Build API server
cd artifacts/api-server && pnpm run build
# Deploy
scp dist/index.mjs root@104.218.51.234:/var/www/snipr/artifacts/api-server/dist/index.mjs
ssh root@104.218.51.234 "systemctl restart snipr-api"
```

### Redirect server (snipr-redirect):
```bash
# Fix source in src/index.ts, then on server:
ssh root@163.245.216.153
cd /var/www/snipr-redirect
# Edit dist/index.js directly OR rebuild with npx tsc
systemctl restart snipr-redirect
```

## Critical Rules

- **Never** use snipr.sh as a custom domain — it's the main app domain
- **Never** change `redirect.ts` without also updating `snipr-redirect` on Server 2
- Both servers handle redirects: Server 1 for CNAME-based subdomains, Server 2 for A-record domains
- The `.env` file on Server 1 has `<` and `>` chars in FROM_EMAIL — cannot be sourced with bash `source`
