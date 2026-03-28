# Snipr - aaPanel Deployment Guide

**Server:** 104.218.51.234
**Domain:** snipr.sh
**OS:** Ubuntu/Debian

---

## Step 1: Install Required Software in aaPanel

Login to your aaPanel dashboard and install these from **App Store**:

### 1.1 Install Nginx
- Go to **App Store** → Search **Nginx** → Click **Install**
- Choose latest version (1.24+)

### 1.2 Install PostgreSQL
- Go to **App Store** → Search **PostgreSQL** → Click **Install**
- Choose version **15** (recommended)
- After install, set a root password (remember it!)

### 1.3 Install Node.js (via Terminal)
aaPanel's Node.js manager may be outdated. Use terminal instead:

Go to aaPanel → **Terminal** (left sidebar) → Run these commands one by one:

```bash
# Install Node.js 22 (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
# Should show: v22.x.x

npm --version
# Should show: 10.x.x

# Install pnpm (our package manager)
npm install -g pnpm

# Verify pnpm
pnpm --version
```

---

## Step 2: Setup PostgreSQL Database

In aaPanel Terminal, run:

```bash
# Switch to postgres user
sudo -u postgres psql

# Inside PostgreSQL prompt, run these:
CREATE USER snipr_user WITH PASSWORD 'YOUR_STRONG_PASSWORD_HERE';
CREATE DATABASE snipr_prod OWNER snipr_user;
GRANT ALL PRIVILEGES ON DATABASE snipr_prod TO snipr_user;
\q
```

**IMPORTANT:** Replace `YOUR_STRONG_PASSWORD_HERE` with a strong password. Remember this password!

---

## Step 3: Clone the Code from GitHub

In aaPanel Terminal:

```bash
# Go to web directory
cd /www/wwwroot

# Clone your private repo
git clone https://github.com/absaii50/snipr-source.git snipr
cd snipr

# If it asks for GitHub login:
# Username: absaii50
# Password: Use a Personal Access Token (NOT your GitHub password)
# Create token at: https://github.com/settings/tokens → Generate new token (classic) → Select 'repo' scope
```

---

## Step 4: Install Dependencies & Build

```bash
cd /www/wwwroot/snipr

# Install all dependencies
pnpm install

# Build the API server
cd artifacts/api-server
pnpm run build

# Build the frontend
cd ../snipr
pnpm run build

# Go back to root
cd /www/wwwroot/snipr
```

---

## Step 5: Create Environment File

```bash
cd /www/wwwroot/snipr

# Copy the template
cp .env.example .env

# Edit the file
nano .env
```

Replace the contents with (update the values marked with ← ):

```
DATABASE_URL=postgresql://snipr_user:YOUR_STRONG_PASSWORD_HERE@localhost:5432/snipr_prod  ← your DB password
SESSION_SECRET=GENERATE_RANDOM_64_CHAR_STRING_HERE  ← see below
PORT=8080
NODE_ENV=production

ADMIN_USERNAME=your_admin_username  ← choose your admin username
ADMIN_PASSWORD_HASH=GENERATE_BCRYPT_HASH  ← see below

FRONTEND_URL=https://snipr.sh

AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
AI_INTEGRATIONS_OPENAI_API_KEY=your-openai-key  ← your OpenAI key (or put 'dev_key' for now)
OPENAI_API_KEY=your-openai-key
DEEPSEEK_API_KEY=your-deepseek-key

LEMONSQUEEZY_API_KEY=dev_key
LEMONSQUEEZY_STORE_ID=123
LEMONSQUEEZY_WEBHOOK_SECRET=dev_secret
```

Save: Press `Ctrl+X` → `Y` → `Enter`

### Generate Session Secret:
```bash
openssl rand -hex 32
```
Copy the output and paste it as SESSION_SECRET.

### Generate Admin Password Hash:
```bash
cd /www/wwwroot/snipr
node -e "const b=require('./artifacts/api-server/node_modules/bcryptjs'); b.hash('YOUR_ADMIN_PASSWORD',10).then(h=>console.log(h))"
```
Replace `YOUR_ADMIN_PASSWORD` with the password you want. Copy the output (starts with `$2b$10$...`) and paste it as ADMIN_PASSWORD_HASH.

---

## Step 6: Run Database Migrations

```bash
cd /www/wwwroot/snipr/lib/db
DATABASE_URL="postgresql://snipr_user:YOUR_DB_PASSWORD@localhost:5432/snipr_prod" pnpm run push
```

If it asks about data loss, type `yes` (first time setup has no data to lose).

---

## Step 7: Create Systemd Services (Auto-Start)

### 7.1 API Server Service

```bash
sudo nano /etc/systemd/system/snipr-api.service
```

Paste this:

```ini
[Unit]
Description=Snipr API Server
After=network.target postgresql.service

[Service]
Type=simple
User=www
WorkingDirectory=/www/wwwroot/snipr/artifacts/api-server
EnvironmentFile=/www/wwwroot/snipr/.env
ExecStart=/usr/bin/node --enable-source-maps ./dist/index.mjs
Restart=always
RestartSec=5
StandardOutput=append:/www/wwwlogs/snipr-api.log
StandardError=append:/www/wwwlogs/snipr-api-error.log

[Install]
WantedBy=multi-user.target
```

Save: `Ctrl+X` → `Y` → `Enter`

### 7.2 Frontend Service

```bash
sudo nano /etc/systemd/system/snipr-frontend.service
```

Paste this:

```ini
[Unit]
Description=Snipr Frontend (Next.js)
After=network.target snipr-api.service

[Service]
Type=simple
User=www
WorkingDirectory=/www/wwwroot/snipr/artifacts/snipr
Environment=PORT=3000
Environment=NODE_ENV=production
ExecStart=/usr/bin/node node_modules/.bin/next start -p 3000
Restart=always
RestartSec=5
StandardOutput=append:/www/wwwlogs/snipr-frontend.log
StandardError=append:/www/wwwlogs/snipr-frontend-error.log

[Install]
WantedBy=multi-user.target
```

### 7.3 Enable & Start Services

```bash
sudo systemctl daemon-reload

# Start API server
sudo systemctl enable snipr-api
sudo systemctl start snipr-api

# Start Frontend
sudo systemctl enable snipr-frontend
sudo systemctl start snipr-frontend

# Check they're running
sudo systemctl status snipr-api
sudo systemctl status snipr-frontend
```

Both should show **"active (running)"** in green.

---

## Step 8: Configure Nginx in aaPanel

### 8.1 Add Website in aaPanel

1. Go to aaPanel → **Website** → **Add site**
2. Domain: `snipr.sh`
3. Select: **Static** (we'll customize Nginx config)
4. Click **Submit**

### 8.2 Configure SSL

1. Click on `snipr.sh` in the website list
2. Go to **SSL** tab
3. Click **Let's Encrypt** → Enter email → Click **Apply**
4. Enable **Force HTTPS**

### 8.3 Edit Nginx Config

1. Click on `snipr.sh` → **Config** tab (or Nginx Config)
2. Replace the entire `server` block with:

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name snipr.sh www.snipr.sh;

    # SSL (aaPanel will add these automatically after SSL setup)
    # ssl_certificate    /www/server/panel/vhost/cert/snipr.sh/fullchain.pem;
    # ssl_certificate_key /www/server/panel/vhost/cert/snipr.sh/privkey.pem;

    # Force HTTPS
    if ($scheme = http) {
        return 301 https://$host$request_uri;
    }

    # API Server (port 8080)
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120;
    }

    # Redirect routes (short links like snipr.sh/slug)
    location /r/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend (Next.js on port 3000)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static file caching
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    access_log /www/wwwlogs/snipr.sh.log;
    error_log /www/wwwlogs/snipr.sh.error.log;
}
```

3. Click **Save**

### 8.4 Add Custom Domain Server Block (for short link redirects)

If users add custom domains (e.g., `go.mysite.com`), add another server block:

```bash
sudo nano /www/server/panel/vhost/nginx/snipr-custom-domains.conf
```

```nginx
# Catch-all for custom domains pointing to Snipr
server {
    listen 80;
    listen 443 ssl http2;
    server_name _;

    # Default SSL cert (use snipr.sh cert as fallback)
    ssl_certificate    /www/server/panel/vhost/cert/snipr.sh/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/snipr.sh/privkey.pem;

    # Route everything to API server for redirect handling
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Step 9: DNS Configuration

### 9.1 Point snipr.sh to your server

In your domain registrar (where you bought snipr.sh), set these DNS records:

| Type | Name | Value |
|------|------|-------|
| A | @ | 104.218.51.234 |
| A | www | 104.218.51.234 |

### 9.2 For custom domains (wildcard)

When users add custom domains, they'll point their CNAME to `snipr.sh`, which resolves to your server IP.

---

## Step 10: Verify Everything Works

```bash
# Check API server is running
curl http://localhost:8080/api/health

# Check frontend is running
curl http://localhost:3000 | head -5

# Check Nginx is routing correctly
curl -I https://snipr.sh

# Test admin login
curl -X POST https://snipr.sh/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"YOUR_ADMIN_USERNAME","password":"YOUR_ADMIN_PASSWORD"}'
```

---

## Useful Commands

```bash
# Restart API server
sudo systemctl restart snipr-api

# Restart Frontend
sudo systemctl restart snipr-frontend

# View API logs
tail -f /www/wwwlogs/snipr-api.log

# View Frontend logs
tail -f /www/wwwlogs/snipr-frontend.log

# View Nginx error logs
tail -f /www/wwwlogs/snipr.sh.error.log

# Update code from GitHub
cd /www/wwwroot/snipr
git pull origin main
pnpm install
cd artifacts/api-server && pnpm run build && cd ..
cd snipr && pnpm run build && cd ../..
sudo systemctl restart snipr-api
sudo systemctl restart snipr-frontend
```

---

## Troubleshooting

**API server won't start:**
```bash
sudo journalctl -u snipr-api -n 50 --no-pager
```

**Frontend won't start:**
```bash
sudo journalctl -u snipr-frontend -n 50 --no-pager
```

**Database connection error:**
```bash
psql -U snipr_user -h localhost -d snipr_prod
# If this fails, check PostgreSQL is running:
sudo systemctl status postgresql
```

**502 Bad Gateway:**
- Check if both services are running: `sudo systemctl status snipr-api snipr-frontend`
- Check ports: `ss -tlnp | grep -E '8080|3000'`

**SSL certificate error:**
- Re-apply in aaPanel → Website → snipr.sh → SSL → Let's Encrypt
