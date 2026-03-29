#!/bin/bash
set -e

echo "============================================"
echo "  SNIPR - One Command Server Setup"
echo "  Server: Fresh Ubuntu 22.04"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { echo -e "\n${GREEN}▶ STEP $1: $2${NC}\n"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash deploy.sh"
  exit 1
fi

step "1/9" "System Update + Essentials"
apt update && apt upgrade -y
apt install -y curl git build-essential nginx certbot python3-certbot-nginx

step "2/9" "Installing Node.js 22"
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt install -y nodejs
  npm install -g pnpm
fi
echo "Node: $(node -v) | pnpm: $(pnpm -v)"

step "3/9" "Installing PostgreSQL"
if ! command -v psql &> /dev/null; then
  apt install -y postgresql postgresql-contrib
  systemctl enable postgresql
  systemctl start postgresql
fi

step "4/9" "Creating Database"
sudo -u postgres psql -c "CREATE USER snipr_user WITH PASSWORD 'Snipr@Prod2026!';" 2>/dev/null || warn "User already exists"
sudo -u postgres psql -c "CREATE DATABASE snipr_prod OWNER snipr_user;" 2>/dev/null || warn "Database already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE snipr_prod TO snipr_user;" 2>/dev/null || true
echo "Database ready!"

step "5/9" "Installing Dependencies"
cd /var/www/snipr
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

step "6/9" "Setting up Environment"
if [ ! -f .env ]; then
  SESSION_SECRET=$(openssl rand -hex 32)
  
  echo ""
  echo "============================================"
  echo "  ADMIN SETUP"
  echo "============================================"
  read -p "Enter admin username: " ADMIN_USER
  read -s -p "Enter admin password: " ADMIN_PASS
  echo ""
  
  ADMIN_HASH=$(node -e "require('./artifacts/api-server/node_modules/bcryptjs').hash('$ADMIN_PASS',10).then(h=>console.log(h))")
  
  read -p "Enter your domain (e.g., snipr.sh): " DOMAIN
  
  cat > .env << EOF
DATABASE_URL=postgresql://snipr_user:Snipr@Prod2026!@localhost:5432/snipr_prod
SESSION_SECRET=$SESSION_SECRET
PORT=8080
NODE_ENV=production
ADMIN_USERNAME=$ADMIN_USER
ADMIN_PASSWORD_HASH=$ADMIN_HASH
FRONTEND_URL=https://$DOMAIN
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
AI_INTEGRATIONS_OPENAI_API_KEY=dev_key
OPENAI_API_KEY=dev_key
DEEPSEEK_API_KEY=dev_key
LEMONSQUEEZY_API_KEY=dev_key
LEMONSQUEEZY_STORE_ID=123
LEMONSQUEEZY_WEBHOOK_SECRET=dev_secret
EOF
  echo ".env created!"
else
  warn ".env already exists, skipping"
  DOMAIN=$(grep FRONTEND_URL .env | sed 's|.*https://||')
fi

step "7/9" "Running Database Migration"
cd lib/db
DATABASE_URL="postgresql://snipr_user:Snipr@Prod2026!@localhost:5432/snipr_prod" pnpm run push || warn "Migration may need manual confirmation"
cd /var/www/snipr

step "8/9" "Creating System Services"

cat > /etc/systemd/system/snipr-api.service << 'EOF'
[Unit]
Description=Snipr API Server
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/snipr/artifacts/api-server
EnvironmentFile=/var/www/snipr/.env
ExecStart=/usr/bin/node --enable-source-maps ./dist/index.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/snipr-frontend.service << 'EOF'
[Unit]
Description=Snipr Frontend
After=network.target snipr-api.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/snipr/artifacts/snipr
Environment=PORT=3000
Environment=NODE_ENV=production
ExecStart=/usr/bin/node node_modules/.bin/next start -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable snipr-api snipr-frontend
systemctl start snipr-api snipr-frontend
sleep 3
echo "API: $(systemctl is-active snipr-api)"
echo "Frontend: $(systemctl is-active snipr-frontend)"

step "9/9" "Configuring Nginx"

cat > /etc/nginx/sites-available/snipr << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /r/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
EOF

ln -sf /etc/nginx/sites-available/snipr /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "============================================"
echo -e "  ${GREEN}SNIPR DEPLOYED SUCCESSFULLY!${NC}"
echo "============================================"
echo ""
echo "  Website: http://$DOMAIN"
echo "  Admin:   http://$DOMAIN/admin"
echo ""
echo "  Next: Setup SSL with:"
echo "  certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "============================================"
